import {
  ChangeDetectionStrategy, Component, inject, signal, OnInit,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { OfficeService } from '../../services/office.service';

@Component({
  selector: 'app-alerts-page',
  standalone: true,
  imports: [DatePipe, MatIconModule, MatButtonModule],
  templateUrl: './alerts-page.component.html',
  styleUrl: './alerts-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertsPageComponent implements OnInit {
  readonly office = inject(OfficeService);
  readonly currentPage = signal(1);
  readonly limit = 50;

  ngOnInit(): void {
    this.office.loadAlerts(this.currentPage(), this.limit);
  }

  loadPage(page: number): void {
    this.currentPage.set(page);
    this.office.loadAlerts(page, this.limit);
  }

  severityClass(severity: string | null): string {
    const map: Record<string, string> = {
      high: 'badge-danger',
      medium: 'badge-warning',
      low: 'badge-info',
    };
    return severity ? (map[severity] ?? 'badge-neutral') : 'badge-neutral';
  }

  severityLabel(severity: string | null): string {
    const map: Record<string, string> = {
      high: 'Alta', medium: 'Media', low: 'Baixa',
    };
    return severity ? (map[severity] ?? severity) : '—';
  }

  evidenceUrl(path: string | null | undefined): string | null {
    return path ? `/api/files/serve/${path}` : null;
  }
}
