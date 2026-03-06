import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-metric-chip',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="chip">
      <mat-icon class="chip-icon">{{ icon() }}</mat-icon>
      <span class="chip-value">{{ value() }}</span>
      @if (unit()) {
        <span class="chip-unit">{{ unit() }}</span>
      }
    </span>
  `,
  styles: `
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 8px;
      background: var(--edge-bg);
      font: var(--text-caption);
      color: var(--edge-muted);
    }
    .chip-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }
    .chip-value {
      font-weight: 600;
      color: var(--edge-text);
    }
    .chip-unit {
      font-size: 11px;
    }
  `,
})
export class MetricChipComponent {
  readonly icon = input.required<string>();
  readonly value = input.required<string | number>();
  readonly unit = input<string>('');
}
