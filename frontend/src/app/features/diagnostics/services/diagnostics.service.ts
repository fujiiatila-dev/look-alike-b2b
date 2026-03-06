import { Injectable, inject, signal, computed, DestroyRef, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { HealthReport } from '../../../shared/models/camera.models';
import { WebSocketService, WsMessage } from '../../../core/services/websocket.service';

export interface ChartDataPoint {
  name: string;
  value: number;
}

export interface ChartSeries {
  name: string;
  series: ChartDataPoint[];
}

@Injectable({ providedIn: 'root' })
export class DiagnosticsService {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ws = inject(WebSocketService);

  readonly health = signal<HealthReport | null>(null);
  readonly history = signal<HealthReport[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private wsSub: Subscription | null = null;
  private historyBackfillTimer: ReturnType<typeof setInterval> | null = null;
  private liveActive = false;

  readonly ramPercent = computed(() => {
    const h = this.health();
    if (!h || !h.ram_total_mb) return 0;
    return (h.ram_used_mb / h.ram_total_mb) * 100;
  });

  readonly diskPercent = computed(() => {
    const h = this.health();
    if (!h || !h.disk_total_gb) return 0;
    return (h.disk_used_gb / h.disk_total_gb) * 100;
  });

  readonly vramPercent = computed(() => {
    const h = this.health();
    if (!h || !h.vram_used_mb || !h.vram_total_mb) return 0;
    return (h.vram_used_mb / h.vram_total_mb) * 100;
  });

  readonly netThroughputMbps = computed(() => {
    const hist = this.history();
    if (hist.length < 2) return 0;
    const prev = hist[hist.length - 2];
    const curr = hist[hist.length - 1];
    const dtSent = curr.net_bytes_sent_total - prev.net_bytes_sent_total;
    const dtRecv = curr.net_bytes_recv_total - prev.net_bytes_recv_total;
    const totalBytes = dtSent + dtRecv;
    return (totalBytes * 8) / 1_000_000 / 10;
  });

  readonly cpuGpuSeries = computed<ChartSeries[]>(() => {
    const hist = this.history();
    const cpuSeries: ChartDataPoint[] = hist.map((h, i) => ({
      name: this.formatTimeLabel(h.timestamp_utc, i),
      value: h.cpu_percent,
    }));
    const gpuSeries: ChartDataPoint[] = hist.map((h, i) => ({
      name: this.formatTimeLabel(h.timestamp_utc, i),
      value: h.gpu_util_percent ?? 0,
    }));
    return [
      { name: 'CPU %', series: cpuSeries },
      { name: 'GPU %', series: gpuSeries },
    ];
  });

  readonly ramVramSeries = computed<ChartSeries[]>(() => {
    const hist = this.history();
    const ramSeries: ChartDataPoint[] = hist.map((h, i) => ({
      name: this.formatTimeLabel(h.timestamp_utc, i),
      value: h.ram_used_mb,
    }));
    const vramSeries: ChartDataPoint[] = hist.map((h, i) => ({
      name: this.formatTimeLabel(h.timestamp_utc, i),
      value: h.vram_used_mb ?? 0,
    }));
    return [
      { name: 'RAM (MB)', series: ramSeries },
      { name: 'VRAM (MB)', series: vramSeries },
    ];
  });

  readonly networkSeries = computed<ChartSeries[]>(() => {
    const hist = this.history();
    if (hist.length < 2) return [];
    const inSeries: ChartDataPoint[] = [];
    const outSeries: ChartDataPoint[] = [];
    for (let i = 1; i < hist.length; i++) {
      const label = this.formatTimeLabel(hist[i].timestamp_utc, i);
      const dtRecv = hist[i].net_bytes_recv_total - hist[i - 1].net_bytes_recv_total;
      const dtSent = hist[i].net_bytes_sent_total - hist[i - 1].net_bytes_sent_total;
      inSeries.push({ name: label, value: Math.max(0, dtRecv / 10) });
      outSeries.push({ name: label, value: Math.max(0, dtSent / 10) });
    }
    return [
      { name: 'In (B/s)', series: inSeries },
      { name: 'Out (B/s)', series: outSeries },
    ];
  });

  /** Start receiving health updates via WebSocket with HTTP history backfill */
  startLive(): void {
    this.liveActive = true;
    // Initial data load via HTTP
    this.loadHistory();

    // Real-time health via WS
    this.wsSub?.unsubscribe();
    this.wsSub = this.ws.messages$
      ?.pipe(filter((msg: WsMessage) => msg.type === 'health'))
      .subscribe({
        next: (msg) => {
          this.health.set(msg.payload as HealthReport);
          this.loading.set(false);
          this.error.set(null);
        },
      });

    // History backfill via HTTP every 30s (for charts)
    this.historyBackfillTimer = setInterval(() => this.loadHistory(), 30_000);

    this.destroyRef.onDestroy(() => this.stopLive());
  }

  stopLive(): void {
    this.liveActive = false;
    this.wsSub?.unsubscribe();
    this.wsSub = null;
    if (this.historyBackfillTimer) {
      clearInterval(this.historyBackfillTimer);
      this.historyBackfillTimer = null;
    }
    this.stopPolling();
  }

  startPolling(intervalMs = 10_000): void {
    this.stopPolling();
    this.loadData();
    this.pollTimer = setInterval(() => this.loadData(), intervalMs);
    this.destroyRef.onDestroy(() => this.stopPolling());
  }

  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private loadData(): void {
    this.http.get<HealthReport>('/api/health/detailed').subscribe({
      next: (health) => {
        this.health.set(health);
        this.loading.set(false);
        this.error.set(null);
      },
      error: (err) => {
        this.error.set(err.message || 'Erro ao carregar diagnóstico');
        this.loading.set(false);
      },
    });
    this.loadHistory();
  }

  private loadHistory(): void {
    this.http.get<HealthReport[]>('/api/health/history').subscribe({
      next: (history) => {
        this.history.set(history);
        // If no health yet, use latest from history
        if (!this.health() && history.length > 0) {
          this.health.set(history[history.length - 1]);
        }
        this.loading.set(false);
        this.error.set(null);
      },
      error: (err) => {
        this.error.set(err.message || 'Erro ao carregar histórico');
        this.loading.set(false);
      },
    });
  }

  private formatTimeLabel(timestamp: string, index: number): string {
    try {
      const d = new Date(timestamp);
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
    } catch {
      return `#${index}`;
    }
  }
}
