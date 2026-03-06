import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  SimpleChanges
} from '@angular/core';
import { NgClass, NgFor } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { DetectionWindow, TimeWindow } from '../../../../shared/models/event-detail.models';

interface TimelineSegment {
  id: string;
  leftPct: number;
  widthPct: number;
  cssClass: string;
}

@Component({
  selector: 'app-detection-timeline',
  standalone: true,
  imports: [NgFor, NgClass, MatCardModule],
  templateUrl: './detection-timeline.component.html',
  styleUrl: './detection-timeline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DetectionTimelineComponent implements OnChanges {
  @Input() gtWindows: TimeWindow[] = [];
  @Input() detectionsBaseline: DetectionWindow[] = [];
  @Input() detectionsRefined: DetectionWindow[] = [];
  @Input() duration = 1;
  @Input() currentTime = 0;

  gtSegments: TimelineSegment[] = [];
  baselineSegments: TimelineSegment[] = [];
  refinedSegments: TimelineSegment[] = [];
  cursorLeftPct = 0;

  readonly tickMarks = Array.from({ length: 13 }, (_, index) => index);

  ngOnChanges(_changes: SimpleChanges): void {
    this.gtSegments = this.buildSegments(this.gtWindows, 'gt');
    this.baselineSegments = this.buildSegments(this.detectionsBaseline, 'baseline');
    this.refinedSegments = this.buildSegments(this.detectionsRefined, 'refined');
    this.cursorLeftPct = this.toPercentage(this.currentTime);
  }

  trackBySegmentId(_index: number, segment: TimelineSegment): string {
    return segment.id;
  }

  trackByTick(_index: number, tick: number): number {
    return tick;
  }

  formatClock(totalSeconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(safeSeconds / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (safeSeconds % 60).toString().padStart(2, '0');

    return `${minutes}:${seconds}`;
  }

  private buildSegments(
    windows: TimeWindow[] | DetectionWindow[],
    variant: 'gt' | 'baseline' | 'refined'
  ): TimelineSegment[] {
    return windows.map((window) => {
      const severityClass =
        'severity' in window && window.severity === 'high' ? 'segment--high' : 'segment--medium';

      return {
        id: window.id,
        leftPct: this.toPercentage(window.startSec),
        widthPct: Math.max(0.7, this.toPercentage(window.endSec - window.startSec)),
        cssClass: `segment--${variant} ${severityClass}`
      };
    });
  }

  private toPercentage(seconds: number): number {
    if (!this.duration || this.duration <= 0) {
      return 0;
    }

    return Number(((seconds / this.duration) * 100).toFixed(3));
  }
}
