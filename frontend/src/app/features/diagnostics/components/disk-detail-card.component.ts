import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-disk-detail-card',
  standalone: true,
  imports: [DecimalPipe, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="detail-card">
      <div class="card-header">
        <mat-icon class="header-icon">storage</mat-icon>
        <span class="header-title">Disco</span>
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
          {{ usedGb() | number:'1.1-1' }} / {{ totalGb() | number:'1.1-1' }} GB
        </span>
      </div>

      @if (ioReadMb() !== null || ioWriteMb() !== null) {
        <div class="io-section">
          <div class="io-row">
            <mat-icon class="io-icon">arrow_downward</mat-icon>
            <span class="io-label">Leitura acumulada</span>
            <span class="io-value">{{ (ioReadMb() ?? 0) | number:'1.0-0' }} MB</span>
          </div>
          <div class="io-row">
            <mat-icon class="io-icon">arrow_upward</mat-icon>
            <span class="io-label">Escrita acumulada</span>
            <span class="io-value">{{ (ioWriteMb() ?? 0) | number:'1.0-0' }} MB</span>
          </div>
        </div>
      }
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
    .io-section {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding-top: 0.75rem;
      border-top: 1px solid var(--edge-border);
    }
    .io-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .io-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: var(--edge-muted);
    }
    .io-label {
      flex: 1;
      font: var(--text-caption);
      color: var(--edge-muted);
    }
    .io-value {
      font: var(--text-caption);
      font-weight: 600;
      color: var(--edge-text);
    }
  `,
})
export class DiskDetailCardComponent {
  readonly usedGb = input(0);
  readonly totalGb = input(1);
  readonly ioReadMb = input<number | null>(null);
  readonly ioWriteMb = input<number | null>(null);

  readonly percent = computed(() => {
    const total = this.totalGb();
    return total > 0 ? (this.usedGb() / total) * 100 : 0;
  });

  readonly barColor = computed(() => {
    const pct = this.percent();
    if (pct >= 90) return 'var(--accent-red)';
    if (pct >= 80) return 'var(--accent-yellow)';
    return 'var(--accent-blue)';
  });
}
