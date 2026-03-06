import {
  ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { OfficeService } from '../../services/office.service';
import { R } from '../../../../shared/utils/client-routes';
import { OccupancyItem } from '../../../../shared/models/office.models';
import { RelativeTimePipe } from '../../../../shared/pipes/relative-time.pipe';

@Component({
  selector: 'app-office-dashboard',
  standalone: true,
  imports: [RouterLink, MatIconModule, MatProgressBarModule, RelativeTimePipe],
  templateUrl: './office-dashboard.component.html',
  styleUrl: './office-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfficeDashboardComponent implements OnInit, OnDestroy {
  readonly office = inject(OfficeService);
  readonly R = R;
  readonly topZones = computed(() =>
    [...this.office.occupancy()]
      .sort((a, b) => b.count - a.count || a.zone_id.localeCompare(b.zone_id))
      .slice(0, 6)
  );
  readonly presenceHighlights = computed(() => this.office.presenceZoneHighlights().slice(0, 5));

  ngOnInit(): void {
    this.office.startPolling(15000);
  }

  ngOnDestroy(): void {
    this.office.stopPolling();
  }

  occupancyPercent(zone: OccupancyItem): number {
    if (!zone.capacity) {
      return 0;
    }

    return Math.min(100, (zone.count / zone.capacity) * 100);
  }
}
