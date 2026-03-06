import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-cpu-detail-card',
  standalone: true,
  imports: [DecimalPipe, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="detail-card">
      <div class="card-header">
        <mat-icon class="header-icon">developer_board</mat-icon>
        <span class="header-title">CPU</span>
        @if (freqMhz()) {
          <span class="header-badge">{{ freqMhz() | number:'1.0-0' }} MHz</span>
        }
      </div>

      <div class="core-bars">
        @for (core of perCpu(); track $index) {
          <div class="core-row">
            <span class="core-label">Core {{ $index }}</span>
            <div class="bar-track">
              <div
                class="bar-fill"
                [style.width.%]="core"
                [style.background]="coreColor(core)">
              </div>
            </div>
            <span class="core-value">{{ core | number:'1.0-0' }}%</span>
          </div>
        }
      </div>

      @if (processCount()) {
        <div class="info-row">
          <mat-icon class="info-icon">apps</mat-icon>
          <span class="info-label">Processos</span>
          <span class="info-value">{{ processCount() }}</span>
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
    .header-badge {
      margin-left: auto;
      font: var(--text-caption);
      color: var(--accent-blue);
      background: rgba(59, 130, 246, 0.1);
      padding: 2px 8px;
      border-radius: 4px;
    }
    .core-bars {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 0.75rem;
    }
    .core-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .core-label {
      font: var(--text-caption);
      color: var(--edge-muted);
      min-width: 48px;
    }
    .bar-track {
      flex: 1;
      height: 6px;
      border-radius: 3px;
      background: var(--edge-bg);
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      border-radius: 3px;
      transition: width var(--fd-transition-base) ease;
    }
    .core-value {
      font: var(--text-caption);
      font-weight: 600;
      color: var(--edge-text);
      min-width: 36px;
      text-align: right;
    }
    .info-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding-top: 0.5rem;
      border-top: 1px solid var(--edge-border);
    }
    .info-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: var(--edge-muted);
    }
    .info-label {
      flex: 1;
      font: var(--text-caption);
      color: var(--edge-muted);
    }
    .info-value {
      font: var(--text-caption);
      font-weight: 600;
      color: var(--edge-text);
    }
  `,
})
export class CpuDetailCardComponent {
  readonly perCpu = input<number[]>([]);
  readonly freqMhz = input<number | null>(null);
  readonly processCount = input<number | null>(null);

  coreColor(value: number): string {
    if (value >= 90) return 'var(--accent-red)';
    if (value >= 80) return 'var(--accent-yellow)';
    return 'var(--accent-green)';
  }
}
