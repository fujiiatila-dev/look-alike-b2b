import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  SimpleChanges
} from '@angular/core';
import { NgFor } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import {
  CorrelationPanelData,
  MetricComparison
} from '../../../../shared/models/event-detail.models';

interface MetricDisplayModel {
  id: string;
  label: string;
  baselineLabel: string;
  refinedLabel: string;
  baselineProgress: number;
  refinedProgress: number;
}

@Component({
  selector: 'app-correlation-panel',
  standalone: true,
  imports: [NgFor, MatCardModule, MatProgressBarModule],
  templateUrl: './correlation-panel.component.html',
  styleUrl: './correlation-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CorrelationPanelComponent implements OnChanges {
  @Input({ required: true }) panel!: CorrelationPanelData;

  metricRows: MetricDisplayModel[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['panel'] && this.panel) {
      this.metricRows = this.panel.metrics.map((metric) => this.mapMetric(metric));
    }
  }

  trackByMetricId(_index: number, metric: MetricDisplayModel): string {
    return metric.id;
  }

  private mapMetric(metric: MetricComparison): MetricDisplayModel {
    return {
      id: metric.id,
      label: metric.label,
      baselineLabel: this.formatMetric(metric.baseline, metric),
      refinedLabel: this.formatMetric(metric.refined, metric),
      baselineProgress: this.normalizeProgress(metric.baseline, metric),
      refinedProgress: this.normalizeProgress(metric.refined, metric)
    };
  }

  private normalizeProgress(value: number, metric: MetricComparison): number {
    if (metric.format === 'seconds') {
      const clamped = Math.max(0, Math.min(2.5, value));
      return Number(((1 - clamped / 2.5) * 100).toFixed(2));
    }

    if (metric.format === 'count') {
      const clamped = Math.max(0, Math.min(4, value));
      return Number(((1 - clamped / 4) * 100).toFixed(2));
    }

    return Number(Math.max(0, Math.min(100, value)).toFixed(2));
  }

  private formatMetric(value: number, metric: MetricComparison): string {
    if (metric.format === 'seconds') {
      return `${value.toFixed(1)}s`;
    }

    if (metric.format === 'count') {
      return `${Math.round(value)}`;
    }

    return `${Math.round(value)}%`;
  }
}
