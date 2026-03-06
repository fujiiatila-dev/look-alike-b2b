import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [MatIconModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty-state">
      <mat-icon class="empty-icon">{{ icon() }}</mat-icon>
      <h3 class="empty-title">{{ title() }}</h3>
      <p class="empty-message">{{ message() }}</p>
      @if (ctaLabel()) {
        <button mat-flat-button color="primary" (click)="ctaClick.emit()">
          {{ ctaLabel() }}
        </button>
      }
    </div>
  `,
  styles: `
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 2rem;
      text-align: center;
    }
    .empty-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: var(--edge-border);
      margin-bottom: 1rem;
    }
    .empty-title {
      margin-bottom: 0.5rem;
      color: var(--edge-text);
    }
    .empty-message {
      color: var(--edge-muted);
      font: var(--text-body-sm);
      margin-bottom: 1.5rem;
      max-width: 400px;
    }
  `,
})
export class EmptyStateComponent {
  readonly icon = input<string>('videocam_off');
  readonly title = input<string>('Nenhum item encontrado');
  readonly message = input<string>('');
  readonly ctaLabel = input<string>('');
  readonly ctaClick = output<void>();
}
