import { Injectable, inject, signal, computed, DestroyRef, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { CameraConfig, CameraStatus } from '../../../shared/models/camera.models';
import { WebSocketService, WsMessage } from '../../../core/services/websocket.service';

@Injectable({ providedIn: 'root' })
export class CameraService {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ws = inject(WebSocketService);

  readonly cameras = signal<CameraStatus[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly runningCount = computed(() => this.cameras().filter((c) => c.state === 'running').length);
  readonly stoppedCount = computed(
    () => this.cameras().filter((c) => c.state === 'stopped').length
  );
  readonly errorCount = computed(
    () => this.cameras().filter((c) => c.state === 'error' || c.state === 'parked').length
  );

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private wsSub: Subscription | null = null;
  private liveActive = false;
  private liveConsumers = 0;

  /** Auto-fallback: when WS disconnects start polling, when reconnects stop polling */
  private readonly fallbackEffect = effect(() => {
    const state = this.ws.connectionState();
    if (!this.liveActive) return;
    if (state === 'disconnected') {
      this._startFallbackPolling();
    } else if (state === 'connected') {
      this._stopFallbackPolling();
    }
  });

  /** Start receiving camera updates via WebSocket (preferred over polling) */
  startLive(): void {
    this.liveConsumers += 1;
    if (this.liveActive) {
      return;
    }

    this.liveActive = true;
    this.loading.set(true);
    this.error.set(null);

    // Initial HTTP load as bootstrap
    this.loadCameras();

    this.wsSub?.unsubscribe();
    this.wsSub = this.ws.messages$
      ?.pipe(filter((msg: WsMessage) => msg.type === 'camera_list'))
      .subscribe({
        next: (msg) => {
          this.cameras.set(msg.payload as CameraStatus[]);
          this.loading.set(false);
        },
      });

    this.destroyRef.onDestroy(() => this.stopLive());
  }

  stopLive(): void {
    this.liveConsumers = Math.max(0, this.liveConsumers - 1);
    if (this.liveConsumers > 0) {
      return;
    }

    this.liveActive = false;
    this.wsSub?.unsubscribe();
    this.wsSub = null;
    this.stopPolling();
  }

  loadCameras(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<CameraStatus[]>('/api/cameras').subscribe({
      next: (data) => {
        this.cameras.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Erro ao carregar câmeras');
        this.loading.set(false);
      },
    });
  }

  registerCamera(config: Partial<CameraConfig>): void {
    this.http.post<CameraStatus>('/api/cameras', config).subscribe({
      next: () => this.loadCameras(),
      error: (err) => this.error.set(err.error?.detail || 'Erro ao registrar câmera'),
    });
  }

  updateCamera(cameraId: string, config: Partial<CameraConfig>): void {
    this.http.put<CameraStatus>(`/api/cameras/${cameraId}`, config).subscribe({
      next: () => this.loadCameras(),
      error: (err) => this.error.set(err.error?.detail || 'Erro ao atualizar câmera'),
    });
  }

  deleteCamera(cameraId: string): void {
    this.http.delete(`/api/cameras/${cameraId}`).subscribe({
      next: () => this.loadCameras(),
      error: (err) => this.error.set(err.error?.detail || 'Erro ao remover câmera'),
    });
  }

  startCamera(cameraId: string): void {
    this.http.post(`/api/cameras/${cameraId}/start`, {}).subscribe({
      next: () => this.loadCameras(),
      error: (err) => this.error.set(err.error?.detail || 'Erro ao iniciar câmera'),
    });
  }

  stopCamera(cameraId: string): void {
    this.http.post(`/api/cameras/${cameraId}/stop`, {}).subscribe({
      next: () => this.loadCameras(),
      error: (err) => this.error.set(err.error?.detail || 'Erro ao parar câmera'),
    });
  }

  restartCamera(cameraId: string): void {
    this.http.post(`/api/cameras/${cameraId}/restart`, {}).subscribe({
      next: () => this.loadCameras(),
      error: (err) => this.error.set(err.error?.detail || 'Erro ao reiniciar câmera'),
    });
  }

  startAll(): void {
    this.http.post('/api/cameras/start-all', {}).subscribe({
      next: () => this.loadCameras(),
      error: (err) => this.error.set(err.error?.detail || 'Erro ao iniciar todas'),
    });
  }

  stopAll(): void {
    this.http.post('/api/cameras/stop-all', {}).subscribe({
      next: () => this.loadCameras(),
      error: (err) => this.error.set(err.error?.detail || 'Erro ao parar todas'),
    });
  }

  startPolling(intervalMs = 5000): void {
    this.stopPolling();
    this.loadCameras();
    this.pollTimer = setInterval(() => this.loadCameras(), intervalMs);
    this.destroyRef.onDestroy(() => this.stopPolling());
  }

  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private _startFallbackPolling(): void {
    if (this.pollTimer) return; // already polling
    this.pollTimer = setInterval(() => this.loadCameras(), 5000);
  }

  private _stopFallbackPolling(): void {
    this.stopPolling();
  }
}
