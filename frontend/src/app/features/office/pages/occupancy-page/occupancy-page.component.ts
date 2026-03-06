import {
  ChangeDetectionStrategy, Component, inject, OnInit, OnDestroy,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { OfficeService } from '../../services/office.service';
import { OccupancyItem } from '../../../../shared/models/office.models';

@Component({
  selector: 'app-occupancy-page',
  standalone: true,
  imports: [DatePipe, MatIconModule, MatProgressBarModule],
  templateUrl: './occupancy-page.component.html',
  styleUrl: './occupancy-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OccupancyPageComponent implements OnInit, OnDestroy {
  readonly office = inject(OfficeService);
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.office.loadOccupancy();
    this.pollTimer = setInterval(() => this.office.loadOccupancy(), 10000);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  occupancyPercent(zone: OccupancyItem): number {
    if (!zone.capacity) return 0;
    return Math.min(100, (zone.count / zone.capacity) * 100);
  }
}
