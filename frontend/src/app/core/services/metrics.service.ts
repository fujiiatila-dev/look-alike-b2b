import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  CorrelationPanelData,
  MetricComparison,
  RefineSettings,
  RunComparisonRow
} from '../../shared/models/event-detail.models';

const INITIAL_METRICS: MetricComparison[] = [
  { id: 'iou', label: 'IoU', baseline: 84, refined: 96, format: 'percent', higherIsBetter: true },
  { id: 'delay', label: 'Delay', baseline: 1.2, refined: 0.6, format: 'seconds', higherIsBetter: false },
  {
    id: 'precision',
    label: 'Precision GT',
    baseline: 71,
    refined: 86,
    format: 'percent',
    higherIsBetter: true
  },
  {
    id: 'spam',
    label: 'Spam Fora GT',
    baseline: 2,
    refined: 1,
    format: 'count',
    higherIsBetter: false
  }
];

const INITIAL_RUN_ROWS: RunComparisonRow[] = [
  {
    id: 'row-1',
    runLabel: 'Baseline Detectado Automaticamente',
    timestampLabel: '00:00:07.58, 17:58 - 11:07:59 - 11:08:11',
    detectionsLabel: '3 deteccoes / IoU 7%',
    overlapLabel: '00:00:07',
    delayLabel: '00:07.56'
  },
  {
    id: 'row-2',
    runLabel: 'Refinado Aprovado Humano',
    timestampLabel: '00:00:07.58, 17:56 - 11:07:59 - 11:13:11',
    detectionsLabel: '3 deteccoes / IoU 7%',
    overlapLabel: '00:00:07',
    delayLabel: '00:07.56'
  },
  {
    id: 'row-3',
    runLabel: 'Baseline Detectado Automaticamente',
    timestampLabel: '00:00:43.20, 18:12 - 11:11:04 - 11:11:29',
    detectionsLabel: '2 deteccoes / IoU 6%',
    overlapLabel: '00:00:05',
    delayLabel: '00:08.11'
  },
  {
    id: 'row-4',
    runLabel: 'Refinado Aprovado Humano',
    timestampLabel: '00:00:43.20, 18:12 - 11:11:03 - 11:11:30',
    detectionsLabel: '2 deteccoes / IoU 8%',
    overlapLabel: '00:00:06',
    delayLabel: '00:06.89'
  }
];

@Injectable({
  providedIn: 'root'
})
export class MetricsService {
  private readonly panelSubject = new BehaviorSubject<CorrelationPanelData>(
    this.buildPanelData(INITIAL_METRICS)
  );
  private readonly runRowsSubject = new BehaviorSubject<RunComparisonRow[]>(INITIAL_RUN_ROWS);

  readonly correlationPanel$: Observable<CorrelationPanelData> = this.panelSubject.asObservable();
  readonly runRows$: Observable<RunComparisonRow[]> = this.runRowsSubject.asObservable();

  getCorrelationPanel(_eventId: string): Observable<CorrelationPanelData> {
    return this.correlationPanel$;
  }

  getRunRows(_eventId: string): Observable<RunComparisonRow[]> {
    return this.runRows$;
  }

  applyRefinement(settings: RefineSettings): void {
    const current = this.panelSubject.value;

    const tunedMetrics = current.metrics.map((metric) => {
      if (metric.id === 'delay') {
        const reducedDelay = Math.max(0.3, metric.refined - settings.fps * 0.004);
        return { ...metric, refined: Number(reducedDelay.toFixed(2)) };
      }

      if (metric.id === 'spam') {
        const reducedSpam = Math.max(0, metric.refined - settings.threshold / 150);
        return { ...metric, refined: Number(reducedSpam.toFixed(0)) };
      }

      const confidenceBoost = settings.confidence * (metric.id === 'iou' ? 6 : 4);
      const improved = Math.min(99, metric.refined + confidenceBoost / 10);
      return { ...metric, refined: Number(improved.toFixed(1)) };
    });

    this.panelSubject.next(this.buildPanelData(tunedMetrics));
  }

  private buildPanelData(metrics: MetricComparison[]): CorrelationPanelData {
    const qualityBaseline = 815;
    const qualityRefined = Math.round(
      metrics.reduce((acc, metric) => {
        if (metric.id === 'delay') {
          return acc + (1.6 - metric.refined) * 120;
        }

        if (metric.id === 'spam') {
          return acc + (2.5 - metric.refined) * 35;
        }

        return acc + metric.refined * (metric.id === 'iou' ? 3.1 : 2.4);
      }, 120)
    );

    const qualityDelta = qualityRefined - qualityBaseline;

    return {
      metrics,
      qualityBaseline,
      qualityRefined,
      qualityDeltaLabel: qualityDelta >= 0 ? `+ ${qualityDelta}` : `${qualityDelta}`,
      statusLabel: qualityDelta >= 0 ? 'MELHORADO' : 'INSTAVEL'
    };
  }
}
