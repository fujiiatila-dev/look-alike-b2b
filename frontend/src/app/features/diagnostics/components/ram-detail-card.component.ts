import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-ram-detail-card',
  standalone: true,
  imports: [DecimalPipe, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="detail-card">
      <div class="card-header">
        <mat-icon class="header-icon">memory</mat-icon>
        <span class="header-title">Memória RAM</span>
      </div>

      <div class="bar-section">
        <div class="bar-track">
          <div
            class="bar-fill"
            [style.width.%]="percent()"
            [style.background]="barColor()">
          </div>
        </div>
        <span class="bar-label">
          {{ usedMb() | number:'1.0-0' }} / {{ totalMb() | number:'1.0-0' }} MB
        </span>
      </div>

      <div class="kpi-row">
        <div class="kpi">
          <span class="kpi-value">{{ percent() | number:'1.1-1' }}%</span>
          <span class="kpi-label">Utilização</span>
        </div>
        <div class="kpi">
          <span class="kpi-value">{{ freeMb() | number:'1.0-0' }}</span>
          <span class="kpi-label">MB Livre</span>
        </div>
      </div>
    </div>
  `,
  styles: `
    .detail-card {
      background: var(--card-bg);
      border: 1px solid var(--edge-border);
      border-radius: var(--fd-radius-md);
      padding: 1rem;
    }
    .card-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    .header-icon {
      color: var(--accent-blue);
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
    .header-title {
      font: var(--text-body-sm);
      font-weight: 600;
    }
    .bar-section {
      margin-bottom: 1rem;
    }
    .bar-track {
      height: 10px;
      border-radius: 5px;
      background: var(--edge-bg);
      overflow: hidden;
      margin-bottom: 0.5rem;
    }
    .bar-fill {
      height: 100%;
      border-radius: 5px;
      transition: width var(--fd-transition-base) ease;
    }
    .bar-label {
      font: var(--text-caption);
      color: var(--edge-muted);
    }
    .kpi-row {
      display: flex;
      gap: 1.5rem;
    }
    .kpi {
      display: flex;
      flex-direction: column;
    }
    .kpi-value {
      font: var(--text-h2);
      color: var(--edge-text);
      line-height: 1.2;
    }
    .kpi-label {
      font: var(--text-caption);
      color: var(--edge-muted);
    }
  `,
})
export class RamDetailCardComponent {
  readonly usedMb = input(0);
  readonly totalMb = input(1);

  readonly percent = computed(() => {
    const total = this.totalMb();
    return total > 0 ? (this.usedMb() / total) * 100 : 0;
  });

  readonly freeMb = computed(() => Math.max(0, this.totalMb() - this.usedMb()));

  readonly barColor = computed(() => {
    const pct = this.percent();
    if (pct >= 90) return 'var(--accent-red)';
    if (pct >= 80) return 'var(--accent-yellow)';
    return 'var(--accent-green)';
  });
}
