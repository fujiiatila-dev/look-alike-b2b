import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CameraStatus } from '../../../shared/models/camera.models';

@Component({
  selector: 'app-camera-perf-table',
  standalone: true,
  imports: [DecimalPipe, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="table-card">
      <div class="card-header">
        <mat-icon class="header-icon">videocam</mat-icon>
        <span class="header-title">Performance das Câmeras</span>
      </div>

      @if (cameras().length === 0) {
        <span class="empty-text">Nenhuma câmera registrada</span>
      } @else {
        <div class="table-scroll">
          <table class="perf-table">
            <thead>
              <tr>
                <th>Câmera</th>
                <th>Estado</th>
                <th class="align-right">FPS</th>
                <th class="align-right">Target</th>
                <th class="align-right">Detect (ms)</th>
                <th class="align-right">Tracks</th>
                <th class="align-right">Uptime</th>
              </tr>
            </thead>
            <tbody>
              @for (cam of cameras(); track cam.camera_id) {
                <tr>
                  <td class="cam-id">{{ cam.camera_id }}</td>
                  <td>
                    <span class="state-badge" [class]="'state-' + cam.state">
                      {{ cam.state }}
                    </span>
                  </td>
                  <td class="align-right" [class.fps-warn]="isFpsLow(cam)">
                    {{ cam.fps_current | number:'1.1-1' }}
                  </td>
                  <td class="align-right">{{ cam.fps_target | number:'1.0-0' }}</td>
                  <td class="align-right">{{ cam.detect_ms_avg | number:'1.1-1' }}</td>
                  <td class="align-right">{{ cam.tracks_active }}</td>
                  <td class="align-right">{{ formatUptime(cam.uptime_sec) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: `
    .table-card {
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
    .table-scroll {
      overflow-x: auto;
    }
    .perf-table {
      width: 100%;
      border-collapse: collapse;
      min-width: 500px;
    }
    .perf-table th {
      font: var(--text-caption);
      color: var(--edge-muted);
      text-align: left;
      padding: 6px 10px 8px 0;
      border-bottom: 1px solid var(--edge-border);
      white-space: nowrap;
    }
    .perf-table td {
      font: var(--text-caption);
      color: var(--edge-text);
      padding: 8px 10px 8px 0;
      border-bottom: 1px solid var(--edge-border);
      white-space: nowrap;
    }
    .perf-table tr:last-child td {
      border-bottom: none;
    }
    .cam-id {
      font-weight: 600;
    }
    .align-right {
      text-align: right;
    }
    .fps-warn {
      color: var(--accent-red);
      font-weight: 700;
    }
    .state-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font: var(--text-caption);
      font-weight: 600;
    }
    .state-running {
      background: rgba(34, 197, 94, 0.15);
      color: var(--accent-green);
    }
    .state-stopped {
      background: rgba(148, 163, 184, 0.15);
      color: var(--edge-muted);
    }
    .state-error, .state-parked {
      background: rgba(239, 68, 68, 0.15);
      color: var(--accent-red);
    }
    .state-starting, .state-retrying {
      background: rgba(234, 179, 8, 0.15);
      color: var(--accent-yellow);
    }
  `,
})
export class CameraPerfTableComponent {
  readonly cameras = input<CameraStatus[]>([]);

  isFpsLow(cam: CameraStatus): boolean {
    if (cam.state !== 'running') return false;
    return cam.fps_current < cam.fps_target * 0.7;
  }

  formatUptime(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
    return `${(seconds / 3600).toFixed(1)}h`;
  }
}
