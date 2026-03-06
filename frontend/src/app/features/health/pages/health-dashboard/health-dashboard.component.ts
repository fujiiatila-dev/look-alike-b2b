import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  OnInit,
  OnDestroy,
  DestroyRef,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { HealthReport } from '../../../../shared/models/camera.models';
import { SystemGaugeComponent } from '../../components/system-gauge/system-gauge.component';
import { GpuCardComponent } from '../../components/gpu-card/gpu-card.component';

@Component({
  selector: 'app-health-dashboard',
  standalone: true,
  imports: [DecimalPipe, MatIconModule, SystemGaugeComponent, GpuCardComponent],
  templateUrl: './health-dashboard.component.html',
  styleUrl: './health-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HealthDashboardComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  readonly health = signal<HealthReport | null>(null);
  readonly loading = signal(true);

  private pollTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.loadHealth();
    this.pollTimer = setInterval(() => this.loadHealth(), 10000);
    this.destroyRef.onDestroy(() => this.stopPolling());
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  private loadHealth(): void {
    this.http.get<HealthReport>('/api/health/detailed').subscribe({
      next: (data) => {
        this.health.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  get ramPercent(): number {
    const h = this.health();
    if (!h || !h.ram_total_mb) return 0;
    return (h.ram_used_mb / h.ram_total_mb) * 100;
  }

  get diskPercent(): number {
    const h = this.health();
    if (!h || !h.disk_total_gb) return 0;
    return (h.disk_used_gb / h.disk_total_gb) * 100;
  }
}
