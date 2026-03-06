import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-gpu-card',
  standalone: true,
  imports: [DecimalPipe, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gpu-card">
      <div class="gpu-header">
        <mat-icon class="gpu-icon">memory</mat-icon>
        <span class="gpu-title">GPU</span>
      </div>

      <!-- VRAM bar -->
      <div class="gpu-metric">
        <span class="metric-label">VRAM</span>
        <div class="bar-track">
          <div class="bar-fill" [style.width.%]="vramPercent()" [style.background]="vramColor()"></div>
        </div>
        <span class="metric-value">
          {{ vramUsed() | number:'1.0-0' }} / {{ vramTotal() | number:'1.0-0' }} MB
        </span>
      </div>

      <!-- Temperature -->
      <div class="gpu-row">
        <mat-icon class="row-icon" [style.color]="tempColor()">thermostat</mat-icon>
        <span class="metric-label">Temperatura</span>
        <span class="metric-value">{{ temp() | number:'1.0-0' }}°C</span>
      </div>

      <!-- Utilization -->
      <div class="gpu-row">
        <mat-icon class="row-icon">speed</mat-icon>
        <span class="metric-label">Utilização</span>
        <span class="metric-value">{{ utilization() | number:'1.0-0' }}%</span>
      </div>
    </div>
  `,
  styles: `
    .gpu-card {
      background: var(--card-bg);
      border: 1px solid var(--edge-border);
      border-radius: var(--fd-radius-md);
      padding: 1rem;
    }
    .gpu-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    .gpu-icon {
      color: var(--accent-blue);
    }
    .gpu-title {
      font: var(--text-body-sm);
      font-weight: 600;
    }
    .gpu-metric {
      margin-bottom: 0.75rem;
    }
    .bar-track {
      height: 8px;
      border-radius: 4px;
      background: var(--edge-bg);
      margin: 4px 0;
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      border-radius: 4px;
      transition: width var(--fd-transition-base) ease;
    }
    .metric-label {
      font: var(--text-caption);
      color: var(--edge-muted);
    }
    .metric-value {
      font: var(--text-caption);
      font-weight: 600;
      color: var(--edge-text);
    }
    .gpu-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }
    .gpu-row .metric-label {
      flex: 1;
    }
    .row-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--edge-muted);
    }
  `,
})
export class GpuCardComponent {
  readonly vramUsed = input(0);
  readonly vramTotal = input(1);
  readonly temp = input(0);
  readonly utilization = input(0);

  readonly vramPercent = computed(() => {
    const total = this.vramTotal();
    return total > 0 ? (this.vramUsed() / total) * 100 : 0;
  });

  readonly vramColor = computed(() => {
    const pct = this.vramPercent();
    if (pct >= 90) return 'var(--accent-red)';
    if (pct >= 75) return 'var(--accent-yellow)';
    return 'var(--accent-green)';
  });

  readonly tempColor = computed(() => {
    const t = this.temp();
    if (t >= 85) return 'var(--accent-red)';
    if (t >= 70) return 'var(--accent-yellow)';
    return 'var(--edge-muted)';
  });
}
