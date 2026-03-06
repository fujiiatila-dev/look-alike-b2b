import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { NetworkInterfaceIO } from '../../../shared/models/camera.models';

@Component({
  selector: 'app-system-resources-card',
  standalone: true,
  imports: [DecimalPipe, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="resources-card">
      <!-- GPU Section -->
      @if (gpuUtil() !== null) {
        <section class="section">
          <div class="section-header">
            <mat-icon class="section-icon icon-gpu">memory</mat-icon>
            <span class="section-title">GPU</span>
            @if (gpuName()) {
              <span class="section-badge">{{ gpuName() }}</span>
            }
          </div>
          <div class="metric-row">
            <span class="metric-label">VRAM</span>
            <div class="bar-track">
              <div class="bar-fill" [style.width.%]="vramPercent()" [style.background]="vramColor()"></div>
            </div>
            <span class="metric-value">{{ vramUsed() | number:'1.0-0' }} / {{ vramTotal() | number:'1.0-0' }} MB</span>
          </div>
          <div class="kv-row">
            <mat-icon class="kv-icon" [style.color]="tempColor()">thermostat</mat-icon>
            <span class="metric-label">Temperatura</span>
            <span class="metric-value">{{ gpuTemp() | number:'1.0-0' }}°C</span>
          </div>
          <div class="kv-row">
            <mat-icon class="kv-icon">speed</mat-icon>
            <span class="metric-label">Utilização</span>
            <span class="metric-value">{{ gpuUtil() | number:'1.0-0' }}%</span>
          </div>
        </section>
      }

      <!-- RAM Section -->
      <section class="section">
        <div class="section-header">
          <mat-icon class="section-icon icon-ram">developer_board</mat-icon>
          <span class="section-title">Memória RAM</span>
        </div>
        <div class="metric-row">
          <div class="bar-track">
            <div class="bar-fill" [style.width.%]="ramPercent()" [style.background]="ramColor()"></div>
          </div>
          <span class="metric-value">{{ ramUsed() | number:'1.0-0' }} / {{ ramTotal() | number:'1.0-0' }} MB</span>
        </div>
        <div class="kpi-pair">
          <div class="kpi-item">
            <span class="kpi-number">{{ ramPercent() | number:'1.1-1' }}%</span>
            <span class="kpi-label">Utilização</span>
          </div>
          <div class="kpi-item">
            <span class="kpi-number">{{ ramFree() | number:'1.0-0' }}</span>
            <span class="kpi-label">MB Livre</span>
          </div>
        </div>
      </section>

      <!-- Disk Section -->
      <section class="section">
        <div class="section-header">
          <mat-icon class="section-icon icon-disk">storage</mat-icon>
          <span class="section-title">Disco</span>
        </div>
        <div class="metric-row">
          <div class="bar-track">
            <div class="bar-fill" [style.width.%]="diskPercent()" [style.background]="diskColor()"></div>
          </div>
          <span class="metric-value">
            {{ diskUsed() | number:'1.1-1' }} / {{ diskTotal() | number:'1.1-1' }} GB
          </span>
        </div>
        @if (diskIoRead() !== null || diskIoWrite() !== null) {
          <div class="io-pair">
            <div class="kv-row">
              <mat-icon class="kv-icon">arrow_downward</mat-icon>
              <span class="metric-label">Leitura</span>
              <span class="metric-value">{{ (diskIoRead() ?? 0) | number:'1.0-0' }} MB</span>
            </div>
            <div class="kv-row">
              <mat-icon class="kv-icon">arrow_upward</mat-icon>
              <span class="metric-label">Escrita</span>
              <span class="metric-value">{{ (diskIoWrite() ?? 0) | number:'1.0-0' }} MB</span>
            </div>
          </div>
        }
      </section>

      <!-- Network Section -->
      <section class="section section--last">
        <div class="section-header">
          <mat-icon class="section-icon icon-net">lan</mat-icon>
          <span class="section-title">Rede</span>
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
      </section>
    </div>
  `,
  styles: `
    .resources-card {
      background: var(--card-bg);
      border: 1px solid var(--edge-border);
      border-radius: 16px;
      padding: 16px;
      box-shadow: var(--fd-shadow-1);
    }

    /* ── Sections ── */
    .section {
      padding-bottom: 14px;
      margin-bottom: 14px;
      border-bottom: 1px solid var(--edge-border);
    }
    .section--last {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }
    .section-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 10px;
    }
    .section-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .icon-gpu  { color: #a78bfa; }
    .icon-ram  { color: var(--accent-blue); }
    .icon-disk { color: var(--accent-yellow); }
    .icon-net  { color: var(--accent-green); }
    .section-title {
      font: var(--text-body-sm);
      font-weight: 600;
    }
    .section-badge {
      margin-left: auto;
      font: var(--text-caption);
      color: #a78bfa;
      background: rgba(139, 92, 246, 0.1);
      padding: 2px 8px;
      border-radius: 4px;
    }

    /* ── Bars ── */
    .metric-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .bar-track {
      flex: 1;
      height: 7px;
      border-radius: 4px;
      background: var(--edge-bg);
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      border-radius: 4px;
      transition: width var(--fd-transition-base) ease;
    }

    /* ── Key-Value rows ── */
    .kv-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }
    .kv-icon {
      font-size: 15px;
      width: 15px;
      height: 15px;
      color: var(--edge-muted);
    }
    .metric-label {
      flex: 1;
      font: var(--text-caption);
      color: var(--edge-muted);
    }
    .metric-value {
      font: var(--text-caption);
      font-weight: 600;
      color: var(--edge-text);
      white-space: nowrap;
    }

    /* ── KPI pair (RAM) ── */
    .kpi-pair {
      display: flex;
      gap: 1.5rem;
      margin-top: 4px;
    }
    .kpi-item {
      display: flex;
      flex-direction: column;
    }
    .kpi-number {
      font: var(--text-h3);
      color: var(--edge-text);
      line-height: 1.2;
    }
    .kpi-label {
      font: var(--text-caption);
      color: var(--edge-muted);
    }

    /* ── I/O pair (Disk) ── */
    .io-pair {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    /* ── Network table ── */
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
      padding: 3px 6px 6px 0;
      border-bottom: 1px solid var(--edge-border);
    }
    .iface-table td {
      font: var(--text-caption);
      color: var(--edge-text);
      padding: 5px 6px 5px 0;
    }
    .iface-name { font-weight: 600; }
    .align-right { text-align: right; }
  `,
})
export class SystemResourcesCardComponent {
  // GPU
  readonly gpuName = input<string | null>(null);
  readonly gpuUtil = input<number | null>(null);
  readonly gpuTemp = input(0);
  readonly vramUsed = input(0);
  readonly vramTotal = input(1);

  // RAM
  readonly ramUsed = input(0);
  readonly ramTotal = input(1);

  // Disk
  readonly diskUsed = input(0);
  readonly diskTotal = input(1);
  readonly diskIoRead = input<number | null>(null);
  readonly diskIoWrite = input<number | null>(null);

  // Network
  readonly interfaces = input<NetworkInterfaceIO[]>([]);

  // Computed — GPU
  readonly vramPercent = computed(() => {
    const t = this.vramTotal();
    return t > 0 ? (this.vramUsed() / t) * 100 : 0;
  });
  readonly vramColor = computed(() => {
    const p = this.vramPercent();
    if (p >= 90) return 'var(--accent-red)';
    if (p >= 75) return 'var(--accent-yellow)';
    return 'var(--accent-green)';
  });
  readonly tempColor = computed(() => {
    const t = this.gpuTemp();
    if (t >= 85) return 'var(--accent-red)';
    if (t >= 70) return 'var(--accent-yellow)';
    return 'var(--edge-muted)';
  });

  // Computed — RAM
  readonly ramPercent = computed(() => {
    const t = this.ramTotal();
    return t > 0 ? (this.ramUsed() / t) * 100 : 0;
  });
  readonly ramFree = computed(() => Math.max(0, this.ramTotal() - this.ramUsed()));
  readonly ramColor = computed(() => {
    const p = this.ramPercent();
    if (p >= 90) return 'var(--accent-red)';
    if (p >= 80) return 'var(--accent-yellow)';
    return 'var(--accent-green)';
  });

  // Computed — Disk
  readonly diskPercent = computed(() => {
    const t = this.diskTotal();
    return t > 0 ? (this.diskUsed() / t) * 100 : 0;
  });
  readonly diskColor = computed(() => {
    const p = this.diskPercent();
    if (p >= 90) return 'var(--accent-red)';
    if (p >= 80) return 'var(--accent-yellow)';
    return 'var(--accent-blue)';
  });

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }
}
