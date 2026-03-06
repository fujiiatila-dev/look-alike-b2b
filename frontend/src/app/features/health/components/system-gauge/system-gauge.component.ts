import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';

@Component({
  selector: 'app-system-gauge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gauge-container">
      <svg viewBox="0 0 120 120" class="gauge-svg">
        <!-- Background circle -->
        <circle
          cx="60" cy="60" r="52"
          fill="none"
          stroke="var(--edge-border)"
          stroke-width="8" />
        <!-- Value arc -->
        <circle
          cx="60" cy="60" r="52"
          fill="none"
          [attr.stroke]="strokeColor()"
          stroke-width="8"
          stroke-linecap="round"
          [attr.stroke-dasharray]="dashArray()"
          transform="rotate(-90 60 60)" />
      </svg>
      <div class="gauge-label">
        <span class="gauge-value">{{ displayValue() }}</span>
        <span class="gauge-unit">{{ unit() }}</span>
      </div>
      <span class="gauge-title">{{ title() }}</span>
    </div>
  `,
  styles: `
    .gauge-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
    }
    .gauge-svg {
      width: 120px;
      height: 120px;
    }
    .gauge-label {
      position: absolute;
      top: 42px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .gauge-value {
      font: var(--text-h2);
      color: var(--edge-text);
      line-height: 1;
    }
    .gauge-unit {
      font: var(--text-caption);
      color: var(--edge-muted);
    }
    .gauge-title {
      margin-top: 0.5rem;
      font: var(--text-caption);
      color: var(--edge-muted);
      text-align: center;
    }
  `,
})
export class SystemGaugeComponent {
  readonly value = input(0);
  readonly max = input(100);
  readonly unit = input('%');
  readonly title = input('');
  readonly warnThreshold = input(80);

  private readonly circumference = 2 * Math.PI * 52;

  readonly displayValue = computed(() => Math.round(this.value()));

  readonly dashArray = computed(() => {
    const pct = Math.min(this.value() / this.max(), 1);
    const filled = pct * this.circumference;
    return `${filled} ${this.circumference}`;
  });

  readonly strokeColor = computed(() => {
    const pct = (this.value() / this.max()) * 100;
    if (pct >= 90) return 'var(--accent-red)';
    if (pct >= this.warnThreshold()) return 'var(--accent-yellow)';
    return 'var(--accent-green)';
  });
}
