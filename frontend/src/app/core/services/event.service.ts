import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { EventDetailData, RefineSettings } from '../../shared/models/event-detail.models';

const INITIAL_EVENT_DETAIL: EventDetailData = {
  eventId: '462130',
  statusLabel: 'Detectado automaticamente',
  sourceFile: '2026-04-26_shop_cam1.mp4',
  detectedAt: '26/04/2026, 11:27:51',
  gtLabel: 'GT (2j sem nome)',
  gtRangeLabel: '26/04/2026, 11:27:58 - 11:28:14',
  alertTag: 'AT 72%',
  durationSec: 164,
  currentTimeSec: 14.56,
  videoUrl: '',
  thumbnails: [
    { id: 'thumb-0', atSec: 0 },
    { id: 'thumb-1', atSec: 3 },
    { id: 'thumb-2', atSec: 8 },
    { id: 'thumb-3', atSec: 14, active: true },
    { id: 'thumb-4', atSec: 24 },
    { id: 'thumb-5', atSec: 38 },
    { id: 'thumb-6', atSec: 52 },
    { id: 'thumb-7', atSec: 70 }
  ],
  gtWindows: [
    { id: 'gt-1', startSec: 7.58, endSec: 17.4 },
    { id: 'gt-2', startSec: 43.2, endSec: 47.8 }
  ],
  detectionsBaseline: [
    { id: 'base-1', startSec: 7.1, endSec: 16.2, severity: 'medium' },
    { id: 'base-2', startSec: 16.2, endSec: 18.9, severity: 'high' },
    { id: 'base-3', startSec: 42.5, endSec: 46.5, severity: 'high' }
  ],
  detectionsRefined: [
    { id: 'ref-1', startSec: 7.5, endSec: 17.2, severity: 'medium' },
    { id: 'ref-2', startSec: 17.2, endSec: 17.9, severity: 'high' },
    { id: 'ref-3', startSec: 43.1, endSec: 47.4, severity: 'high' }
  ]
};

@Injectable({
  providedIn: 'root'
})
export class EventService {
  private readonly detailSubject = new BehaviorSubject<EventDetailData>(INITIAL_EVENT_DETAIL);

  readonly eventDetail$: Observable<EventDetailData> = this.detailSubject.asObservable();

  getEventDetail(_eventId: string): Observable<EventDetailData> {
    return this.eventDetail$;
  }

  updateCurrentTime(currentTimeSec: number): void {
    const current = this.detailSubject.value;
    if (current.currentTimeSec === currentTimeSec) {
      return;
    }

    this.detailSubject.next({
      ...current,
      currentTimeSec,
      thumbnails: current.thumbnails.map((thumb) => ({
        ...thumb,
        active: Math.abs(thumb.atSec - currentTimeSec) < 3
      }))
    });
  }

  applyRefinement(settings: RefineSettings): void {
    const current = this.detailSubject.value;
    const confidenceFactor = Math.min(Math.max(settings.confidence, 0.2), 0.95);
    const thresholdFactor = Math.min(Math.max(settings.threshold, 10), 90) / 100;
    const shift = (1 - confidenceFactor) * 0.5;

    const refinedWindows = current.detectionsRefined.map((window, index) => {
      const dynamicCorrection = shift * (index % 2 === 0 ? 0.6 : 0.3) + thresholdFactor * 0.2;
      return {
        ...window,
        startSec: Math.max(0, Number((window.startSec + dynamicCorrection).toFixed(2))),
        endSec: Math.min(current.durationSec, Number((window.endSec + dynamicCorrection).toFixed(2)))
      };
    });

    this.detailSubject.next({
      ...current,
      detectionsRefined: refinedWindows
    });
  }
}
