import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DecimalPipe, UpperCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { CameraStatus } from '../../../../shared/models/camera.models';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { MetricChipComponent } from '../../../../shared/components/metric-chip/metric-chip.component';
import { CameraStateLabelPipe } from '../../../../shared/pipes/camera-state-label.pipe';
import { CameraStateColorPipe } from '../../../../shared/pipes/camera-state-color.pipe';
import { RelativeTimePipe } from '../../../../shared/pipes/relative-time.pipe';
import { WebSocketService } from '../../../../core/services/websocket.service';
import { R } from '../../../../shared/utils/client-routes';

@Component({
  selector: 'app-camera-card',
  standalone: true,
  imports: [
    DecimalPipe,
    UpperCasePipe,
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    StatusBadgeComponent,
    MetricChipComponent,
    CameraStateLabelPipe,
    CameraStateColorPipe,
    RelativeTimePipe,
  ],
  templateUrl: './camera-card.component.html',
  styleUrl: './camera-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CameraCardComponent implements AfterViewInit, OnDestroy {
  private readonly ws = inject(WebSocketService);
  private readonly elRef = inject(ElementRef);
  readonly R = R;

  readonly camera = input.required<CameraStatus>();
  readonly startCamera = output<string>();
  readonly stopCamera = output<string>();
  readonly deleteCamera = output<string>();
  readonly restartCamera = output<string>();

  /** Signal — allows OnPush to detect the change */
  readonly snapshotError = signal(false);

  /** Live frame blob URL from WebSocket stream */
  readonly liveFrameUrl = signal<string | null>(null);

  /** Whether this card is visible in the viewport */
  private isVisible = false;
  private observer: IntersectionObserver | null = null;
  private frameSub: Subscription | null = null;

  /** Reset error flag whenever camera state changes (e.g. stopped → running) */
  private readonly resetOnStateChange = effect(() => {
    this.camera().state; // track
    this.snapshotError.set(false);
  });

  /** Open/close frame stream based on state + visibility */
  private readonly streamEffect = effect(() => {
    const cam = this.camera();
    const shouldStream = cam.state === 'running' && this.isVisible;

    if (shouldStream && !this.frameSub) {
      this.frameSub = this.ws.openFrameStream(cam.camera_id).subscribe({
        next: (url) => this.liveFrameUrl.set(url),
        complete: () => {
          this.liveFrameUrl.set(null);
          this.frameSub = null;
        },
        error: () => {
          this.liveFrameUrl.set(null);
          this.frameSub = null;
        },
      });
    } else if (!shouldStream && this.frameSub) {
      this.frameSub.unsubscribe();
      this.frameSub = null;
      this.liveFrameUrl.set(null);
    }
  });

  readonly snapshotUrl = computed(() => {
    const cam = this.camera();
    if (cam.state === 'stopped' && !cam.last_frame_at) return null;
    const cacheBuster = cam.last_frame_at || '';
    return `/api/cameras/${cam.camera_id}/snapshot?w=320&t=${encodeURIComponent(cacheBuster)}`;
  });

  /** Display URL: prefer live frame, fallback to snapshot */
  readonly displayUrl = computed(() => this.liveFrameUrl() ?? this.snapshotUrl());

  /** Show snapshot image when URL available + no error */
  readonly showSnapshot = computed(() => !!this.displayUrl() && !this.snapshotError());

  /** Whether we're showing a live stream (vs static snapshot) */
  readonly isLive = computed(() => !!this.liveFrameUrl());

  get isRunning(): boolean {
    return this.camera().state === 'running';
  }

  get isStopped(): boolean {
    return this.camera().state === 'stopped';
  }

  get isRestartable(): boolean {
    const state = this.camera().state;
    return state === 'error' || state === 'parked' || state === 'retrying';
  }

  ngAfterViewInit(): void {
    this.observer = new IntersectionObserver(
      ([entry]) => {
        const wasVisible = this.isVisible;
        this.isVisible = entry.isIntersecting;
        // Re-trigger streamEffect by reading camera signal
        if (wasVisible !== this.isVisible) {
          // Force effect re-evaluation: we read camera() inside streamEffect,
          // but visibility is not a signal. We use a workaround:
          // Close/open stream directly here.
          this._updateStream();
        }
      },
      { threshold: 0.1 },
    );
    this.observer.observe(this.elRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.frameSub?.unsubscribe();
    this.frameSub = null;
  }

  onStart(): void {
    this.startCamera.emit(this.camera().camera_id);
  }

  onStop(): void {
    this.stopCamera.emit(this.camera().camera_id);
  }

  onDelete(): void {
    this.deleteCamera.emit(this.camera().camera_id);
  }

  onRestart(): void {
    this.restartCamera.emit(this.camera().camera_id);
  }

  onSnapshotLoad(): void {
    this.snapshotError.set(false);
  }

  onSnapshotError(): void {
    this.snapshotError.set(true);
  }

  private _updateStream(): void {
    const cam = this.camera();
    const shouldStream = cam.state === 'running' && this.isVisible;

    if (shouldStream && !this.frameSub) {
      this.frameSub = this.ws.openFrameStream(cam.camera_id).subscribe({
        next: (url) => this.liveFrameUrl.set(url),
        complete: () => {
          this.liveFrameUrl.set(null);
          this.frameSub = null;
        },
        error: () => {
          this.liveFrameUrl.set(null);
          this.frameSub = null;
        },
      });
    } else if (!shouldStream && this.frameSub) {
      this.frameSub.unsubscribe();
      this.frameSub = null;
      this.liveFrameUrl.set(null);
    }
  }
}
