import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { NetworkInterfaceIO } from '../../../shared/models/camera.models';

@Component({
  selector: 'app-network-detail-card',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="detail-card">
      <div class="card-header">
        <mat-icon class="header-icon">lan</mat-icon>
        <span class="header-title">Rede</span>
      </div>

      @if (interfaces().length === 0) {
        <span class="empty-text">Nenhuma interface detectada</span>
      } @else {
        <table class="iface-table">
          <thead>
            <tr>
              <th>Interface</th>
              <th class="align-right">Enviado</th>
              <th class="align-right">Recebido</th>
            </tr>
          </thead>
          <tbody>
            @for (iface of interfaces(); track iface.name) {
              <tr>
                <td class="iface-name">{{ iface.name }}</td>
                <td class="align-right">{{ formatBytes(iface.bytes_sent) }}</td>
                <td class="align-right">{{ formatBytes(iface.bytes_recv) }}</td>
              </tr>
            }
          </tbody>
        </table>
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
    .empty-text {
      font: var(--text-caption);
      color: var(--edge-muted);
    }
    .iface-table {
      width: 100%;
      border-collapse: collapse;
    }
    .iface-table th {
      font: var(--text-caption);
      color: var(--edge-muted);
      text-align: left;
      padding: 4px 8px 8px 0;
      border-bottom: 1px solid var(--edge-border);
    }
    .iface-table td {
      font: var(--text-caption);
      color: var(--edge-text);
      padding: 6px 8px 6px 0;
      border-bottom: 1px solid var(--edge-border);
    }
    .iface-table tr:last-child td {
      border-bottom: none;
    }
    .iface-name {
      font-weight: 600;
    }
    .align-right {
      text-align: right;
    }
  `,
})
export class NetworkDetailCardComponent {
  readonly interfaces = input<NetworkInterfaceIO[]>([]);

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }
}
