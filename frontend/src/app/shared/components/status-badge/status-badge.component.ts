import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="badge" [style.background]="color()" [style.color]="textColor()">
      {{ label() }}
    </span>
  `,
  styles: `
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 10px;
      border-radius: 999px;
      font: var(--text-caption);
      font-weight: 600;
      white-space: nowrap;
      letter-spacing: 0.02em;
    }
  `,
})
export class StatusBadgeComponent {
  readonly label = input.required<string>();
  readonly color = input<string>('var(--edge-muted)');
  readonly textColor = input<string>('#fff');
}
