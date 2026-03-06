import {
  ChangeDetectionStrategy, Component, OnInit, computed, inject, signal,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { OfficeService } from '../../services/office.service';
import { RelativeTimePipe } from '../../../../shared/pipes/relative-time.pipe';

@Component({
  selector: 'app-presence-page',
  standalone: true,
  imports: [DatePipe, DecimalPipe, MatIconModule, MatButtonModule, RelativeTimePipe],
  templateUrl: './presence-page.component.html',
  styleUrl: './presence-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PresencePageComponent implements OnInit {
  readonly office = inject(OfficeService);
  readonly currentPage = signal(1);
  readonly limit = 50;
  readonly topZones = computed(() => this.office.presenceZoneHighlights().slice(0, 5));

  ngOnInit(): void {
    this.office.loadPresenceEvents(this.currentPage(), this.limit);
    this.office.loadPresenceHighlights();
  }

  loadPage(page: number): void {
    this.currentPage.set(page);
    this.office.loadPresenceEvents(page, this.limit);
  }

  eventTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'presence.started': 'Entrada',
      'presence.updated': 'Permanencia',
      'presence.ended': 'Saida',
      'alert.raised': 'Alerta',
    };
    return labels[type] ?? type;
  }

  eventTypeClass(type: string): string {
    const map: Record<string, string> = {
      'presence.started': 'badge-success',
      'presence.updated': 'badge-info',
      'presence.ended': 'badge-neutral',
      'alert.raised': 'badge-danger',
    };
    return map[type] ?? 'badge-neutral';
  }

  evidenceUrl(path: string | null | undefined): string | null {
    return path ? `/api/files/serve/${path}` : null;
  }
}
