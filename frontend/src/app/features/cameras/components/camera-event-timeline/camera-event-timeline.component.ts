import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

const ZOOM_LEVELS = [1, 1.5, 2.25, 3.5, 5, 7.5, 11, 16] as const;
const TICK_STEPS_MS = [
  1_000,
  2_000,
  5_000,
  10_000,
  15_000,
  30_000,
  60_000,
  120_000,
  300_000,
  600_000,
  900_000,
  1_800_000,
  3_600_000,
] as const;
const MIN_DOMAIN_SPAN_MS = 120_000;
const MIN_VISIBLE_SPAN_MS = 12_000;
const PAN_STEP_RATIO = 0.18;

type TimelineLaneId = 'presence' | 'dwell' | 'alerts' | 'evidence';
type LaneVariant = 'entry' | 'exit' | 'dwell' | 'alert' | 'evidence';

export interface CameraTimelineEvent {
  event_id: string;
  created_at: string;
  type: string;
  track_id: number | null;
  zone_id: string | null;
  identity_id: string | null;
  label: string | null;
  duration_sec: number | null;
  alert_type: string | null;
  severity: string | null;
  alert_message: string | null;
  evidence_path: string | null;
}

interface ResolvedTimelineEvent extends CameraTimelineEvent {
  timeMs: number;
  rangeStartMs: number;
  rangeEndMs: number;
  title: string;
  meta: string;
}

interface TimelineDomain {
  startMs: number;
  endMs: number;
  spanMs: number;
}

interface TimelineTick {
  key: number;
  leftPct: number;
  label: string;
  major: boolean;
}

interface TimelineLaneItem {
  id: string;
  eventId: string;
  leftPct: number;
  widthPct: number;
  title: string;
  subtitle: string;
  icon: string;
  variant: LaneVariant;
  selected: boolean;
}

interface TimelineLane {
  id: TimelineLaneId;
  label: string;
  icon: string;
  caption: string;
  items: TimelineLaneItem[];
}

interface OverviewItem {
  id: string;
  leftPct: number;
  widthPct: number;
  variant: LaneVariant;
  selected: boolean;
}

export interface CameraTimelineSelection {
  activeEventId: string | null;
  highlightedEvidenceEventId: string | null;
  playheadTimeMs: number | null;
  source: 'sync' | 'scrub' | 'clip';
}

@Component({
  selector: 'app-camera-event-timeline',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  templateUrl: './camera-event-timeline.component.html',
  styleUrl: './camera-event-timeline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CameraEventTimelineComponent implements OnChanges, OnDestroy {
  @Input() events: CameraTimelineEvent[] = [];

  @Output() readonly evidenceOpen = new EventEmitter<string>();
  @Output() readonly selectionChange = new EventEmitter<CameraTimelineSelection>();

  @ViewChild('overviewRef') overviewRef?: ElementRef<HTMLDivElement>;
  @ViewChild('scrubRef') scrubRef?: ElementRef<HTMLDivElement>;

  readonly zoomLevels = ZOOM_LEVELS;
  readonly zoomIndex = signal(3);
  readonly panRatio = signal(1);
  readonly selectedEventId = signal<string | null>(null);
  readonly playheadTimeMs = signal<number | null>(null);
  readonly resolvedEvents = signal<ResolvedTimelineEvent[]>([]);

  readonly hasEvents = computed(() => this.resolvedEvents().length > 0);

  readonly domain = computed<TimelineDomain | null>(() => buildTimelineDomain(this.resolvedEvents()));

  readonly zoomFactor = computed(() => this.zoomLevels[this.zoomIndex()] ?? this.zoomLevels[0]);

  readonly visibleSpanMs = computed(() => {
    const domain = this.domain();
    if (!domain) {
      return 0;
    }
    return visibleSpanFor(domain.spanMs, this.zoomFactor());
  });

  readonly visibleStartMs = computed(() => {
    const domain = this.domain();
    if (!domain) {
      return 0;
    }
    const visibleSpan = this.visibleSpanMs();
    const maxOffset = Math.max(0, domain.spanMs - visibleSpan);
    return domain.startMs + maxOffset * this.panRatio();
  });

  readonly visibleEndMs = computed(() => this.visibleStartMs() + this.visibleSpanMs());

  readonly selectedEvent = computed<ResolvedTimelineEvent | null>(() => {
    const selectedId = this.selectedEventId();
    const events = this.resolvedEvents();
    if (!events.length) {
      return null;
    }
    if (!selectedId) {
      return pickInitialEvent(events);
    }
    return events.find((event) => event.event_id === selectedId) ?? pickInitialEvent(events);
  });

  readonly activeTimeMs = computed(() => {
    return this.playheadTimeMs() ?? this.selectedEvent()?.timeMs ?? this.domain()?.endMs ?? null;
  });

  readonly highlightedEvidenceEvent = computed<ResolvedTimelineEvent | null>(() => {
    return pickNearestEvidenceEvent(this.resolvedEvents(), this.activeTimeMs());
  });

  readonly playheadLeftPct = computed(() => {
    const activeTime = this.activeTimeMs();
    const visibleSpan = this.visibleSpanMs();
    if (activeTime == null || visibleSpan <= 0) {
      return 100;
    }
    return clampPct(((activeTime - this.visibleStartMs()) / visibleSpan) * 100);
  });

  readonly ticks = computed(() => buildTicks(this.visibleStartMs(), this.visibleEndMs()));

  readonly lanes = computed<TimelineLane[]>(() => {
    const events = this.resolvedEvents();
    const visibleStart = this.visibleStartMs();
    const visibleEnd = this.visibleEndMs();
    const selectedId = this.selectedEventId();

    return [
      {
        id: 'presence',
        label: 'Entrada / Saída',
        icon: 'login',
        caption: 'batidas de passagem',
        items: buildLaneItems('presence', events, visibleStart, visibleEnd, selectedId),
      },
      {
        id: 'dwell',
        label: 'Permanência',
        icon: 'timeline',
        caption: 'segmentos de ocupação',
        items: buildLaneItems('dwell', events, visibleStart, visibleEnd, selectedId),
      },
      {
        id: 'alerts',
        label: 'Alertas',
        icon: 'warning',
        caption: 'regras acionadas',
        items: buildLaneItems('alerts', events, visibleStart, visibleEnd, selectedId),
      },
      {
        id: 'evidence',
        label: 'Snapshots',
        icon: 'movie',
        caption: 'evidências anexadas',
        items: buildLaneItems('evidence', events, visibleStart, visibleEnd, selectedId),
      },
    ];
  });

  readonly overviewItems = computed<OverviewItem[]>(() => {
    const domain = this.domain();
    if (!domain) {
      return [];
    }

    return this.resolvedEvents().flatMap((event) => {
      const variants = laneVariantsForOverview(event);
      return variants.map((variant) => {
        const { startMs, endMs } = renderWindowForVariant(event, variant);
        return {
          id: `${variant}-${event.event_id}`,
          leftPct: clampPct(((startMs - domain.startMs) / domain.spanMs) * 100),
          widthPct: Math.max(0.4, ((Math.max(endMs - startMs, 1_000) / domain.spanMs) * 100)),
          variant,
          selected: this.selectedEventId() === event.event_id,
        };
      });
    });
  });

  readonly visibleEvidence = computed<ResolvedTimelineEvent[]>(() => {
    const centerMs = this.activeTimeMs() ?? this.visibleEndMs();
    return this.resolvedEvents()
      .filter(
        (event) =>
          !!event.evidence_path && event.timeMs >= this.visibleStartMs() && event.timeMs <= this.visibleEndMs()
      )
      .sort((a, b) => Math.abs(a.timeMs - centerMs) - Math.abs(b.timeMs - centerMs))
      .slice(0, 5);
  });

  readonly overviewWindowLeftPct = computed(() => {
    const domain = this.domain();
    if (!domain) {
      return 0;
    }
    return clampPct(((this.visibleStartMs() - domain.startMs) / domain.spanMs) * 100);
  });

  readonly overviewWindowWidthPct = computed(() => {
    const domain = this.domain();
    if (!domain || domain.spanMs <= 0) {
      return 100;
    }
    return clampPct(Math.max(10, (this.visibleSpanMs() / domain.spanMs) * 100));
  });

  private dragMode: 'overview' | 'playhead' | null = null;

  private readonly pointerMoveListener = (event: PointerEvent): void => this.onPointerMove(event);
  private readonly pointerUpListener = (): void => this.onPointerUp();

  ngOnChanges(_changes: SimpleChanges): void {
    const resolved = resolveTimelineEvents(this.events);
    this.resolvedEvents.set(resolved);

    const currentSelection = this.selectedEventId();
    const selectionStillExists = !!resolved.find((event) => event.event_id === currentSelection);

    if (!selectionStillExists) {
      const nextSelection = pickInitialEvent(resolved)?.event_id ?? null;
      this.selectedEventId.set(nextSelection);
    }

    const selected = this.selectedEvent();
    if (selected) {
      const currentPlayhead = this.playheadTimeMs();
      if (currentPlayhead == null || !isTimeInsideDomain(currentPlayhead, buildTimelineDomain(resolved))) {
        this.playheadTimeMs.set(selected.timeMs);
      }
      this.centerOnTime(selected.timeMs, 0.72);
    }

    this.emitSelection('sync');
  }

  ngOnDestroy(): void {
    this.detachPointerListeners();
  }

  zoomIn(): void {
    this.adjustZoom(1, this.activeTimeMs() ?? this.visibleEndMs(), 0.72);
  }

  zoomOut(): void {
    this.adjustZoom(-1, this.activeTimeMs() ?? this.visibleEndMs(), 0.72);
  }

  panLeft(): void {
    this.shiftWindow(-1);
  }

  panRight(): void {
    this.shiftWindow(1);
  }

  onZoomInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const nextIndex = Number(target.value);
    if (Number.isNaN(nextIndex)) {
      return;
    }

    const anchorTime = this.activeTimeMs() ?? this.visibleEndMs();
    this.setZoomIndex(nextIndex, anchorTime, 0.72);
  }

  onTimelineWheel(event: WheelEvent): void {
    if (!this.hasEvents()) {
      return;
    }

    event.preventDefault();

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const anchorRatio = clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0.08, 0.92);
    const anchorTime = this.visibleStartMs() + this.visibleSpanMs() * anchorRatio;

    if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      this.shiftWindow(event.deltaX > 0 || event.deltaY > 0 ? 1 : -1);
      return;
    }

    this.adjustZoom(event.deltaY < 0 ? 1 : -1, anchorTime, anchorRatio);
  }

  onOverviewPointerDown(event: PointerEvent): void {
    if (!this.hasEvents()) {
      return;
    }

    event.preventDefault();
    this.dragMode = 'overview';
    this.updatePanFromOverviewPointer(event);
    window.addEventListener('pointermove', this.pointerMoveListener);
    window.addEventListener('pointerup', this.pointerUpListener);
  }

  onScrubPointerDown(event: PointerEvent): void {
    if (!this.hasEvents()) {
      return;
    }

    event.preventDefault();
    this.dragMode = 'playhead';
    this.updatePlayheadFromPointer(event, 'scrub');
    window.addEventListener('pointermove', this.pointerMoveListener);
    window.addEventListener('pointerup', this.pointerUpListener);
  }

  onPlayheadPointerDown(event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragMode = 'playhead';
    this.updatePlayheadFromPointer(event, 'scrub');
    window.addEventListener('pointermove', this.pointerMoveListener);
    window.addEventListener('pointerup', this.pointerUpListener);
  }

  selectEvent(eventId: string): void {
    const selected = this.resolvedEvents().find((event) => event.event_id === eventId);
    if (!selected) {
      return;
    }
    this.selectedEventId.set(eventId);
    this.playheadTimeMs.set(selected.timeMs);
    this.centerOnTime(selected.timeMs, 0.72);
    this.emitSelection('clip');
  }

  openEvidence(path: string | null | undefined): void {
    if (!path) {
      return;
    }
    this.evidenceOpen.emit(path);
  }

  evidenceUrl(path: string | null | undefined): string | null {
    return path ? `/api/files/serve/${path}` : null;
  }

  eventTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'presence.started': 'Entrada',
      'presence.updated': 'Permanência',
      'presence.ended': 'Saída',
      'alert.raised': 'Alerta',
    };
    return labels[type] ?? type;
  }

  formatSpan(ms: number): string {
    if (ms <= 0) {
      return '0s';
    }

    const totalSeconds = Math.round(ms / 1_000);
    if (totalSeconds < 60) {
      return `${totalSeconds}s`;
    }
    const totalMinutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (totalMinutes < 60) {
      return seconds > 0 ? `${totalMinutes}m ${seconds}s` : `${totalMinutes}m`;
    }
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  formatAbsoluteTime(ms: number): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(ms);
  }

  formatAxisRange(startMs: number, endMs: number): string {
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    return `${formatter.format(startMs)} - ${formatter.format(endMs)}`;
  }

  formatPlayheadTime(ms: number | null): string {
    if (ms == null) {
      return '—';
    }
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(ms);
  }

  trackByLane(_index: number, lane: TimelineLane): string {
    return lane.id;
  }

  trackByLaneItem(_index: number, item: TimelineLaneItem): string {
    return item.id;
  }

  trackByTick(_index: number, tick: TimelineTick): number {
    return tick.key;
  }

  trackByOverviewItem(_index: number, item: OverviewItem): string {
    return item.id;
  }

  trackByEvidence(_index: number, event: ResolvedTimelineEvent): string {
    return event.event_id;
  }

  private setZoomIndex(nextIndex: number, anchorTime: number, anchorRatio: number): void {
    const clampedIndex = clamp(Math.round(nextIndex), 0, this.zoomLevels.length - 1);
    this.zoomIndex.set(clampedIndex);
    this.setWindowStart(anchorTime - visibleSpanFor(this.domain()?.spanMs ?? 0, this.zoomLevels[clampedIndex]) * anchorRatio);
  }

  private adjustZoom(delta: number, anchorTime: number, anchorRatio: number): void {
    const nextIndex = this.zoomIndex() + delta;
    this.setZoomIndex(nextIndex, anchorTime, anchorRatio);
  }

  private shiftWindow(direction: -1 | 1): void {
    const currentStart = this.visibleStartMs();
    const shiftAmount = this.visibleSpanMs() * PAN_STEP_RATIO * direction;
    this.setWindowStart(currentStart + shiftAmount);
  }

  private centerOnTime(timeMs: number, anchorRatio = 0.5): void {
    const visibleSpan = this.visibleSpanMs();
    if (!visibleSpan) {
      return;
    }
    this.setWindowStart(timeMs - visibleSpan * anchorRatio);
  }

  private setWindowStart(startMs: number): void {
    const domain = this.domain();
    if (!domain) {
      return;
    }

    const visibleSpan = this.visibleSpanMs();
    const maxStart = Math.max(domain.startMs, domain.endMs - visibleSpan);
    const clampedStart = clamp(startMs, domain.startMs, maxStart);
    const offset = clampedStart - domain.startMs;
    const maxOffset = Math.max(1, domain.spanMs - visibleSpan);
    this.panRatio.set(clamp(offset / maxOffset, 0, 1));
  }

  private updatePanFromOverviewPointer(event: PointerEvent): void {
    const overviewEl = this.overviewRef?.nativeElement;
    const domain = this.domain();
    if (!overviewEl || !domain) {
      return;
    }

    const rect = overviewEl.getBoundingClientRect();
    const ratio = clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
    const targetTime = domain.startMs + domain.spanMs * ratio;
    this.centerOnTime(targetTime, 0.5);
  }

  private updatePlayheadFromPointer(
    event: PointerEvent,
    source: CameraTimelineSelection['source']
  ): void {
    const scrubEl = this.scrubRef?.nativeElement;
    const domain = this.domain();
    if (!scrubEl || !domain) {
      return;
    }

    const rect = scrubEl.getBoundingClientRect();
    const ratio = clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
    const targetTime = this.visibleStartMs() + this.visibleSpanMs() * ratio;
    const clampedTime = clamp(targetTime, domain.startMs, domain.endMs);

    this.playheadTimeMs.set(clampedTime);
    this.selectedEventId.set(pickNearestEvent(this.resolvedEvents(), clampedTime)?.event_id ?? null);
    this.emitSelection(source);
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.dragMode) {
      return;
    }
    if (this.dragMode === 'overview') {
      this.updatePanFromOverviewPointer(event);
      return;
    }
    this.updatePlayheadFromPointer(event, 'scrub');
  }

  private onPointerUp(): void {
    this.dragMode = null;
    this.detachPointerListeners();
  }

  private detachPointerListeners(): void {
    window.removeEventListener('pointermove', this.pointerMoveListener);
    window.removeEventListener('pointerup', this.pointerUpListener);
  }

  private emitSelection(source: CameraTimelineSelection['source']): void {
    this.selectionChange.emit({
      activeEventId: this.selectedEvent()?.event_id ?? null,
      highlightedEvidenceEventId: this.highlightedEvidenceEvent()?.event_id ?? null,
      playheadTimeMs: this.activeTimeMs(),
      source,
    });
  }
}

function resolveTimelineEvents(events: CameraTimelineEvent[]): ResolvedTimelineEvent[] {
  return events
    .map((event) => {
      const timeMs = Date.parse(event.created_at);
      if (!Number.isFinite(timeMs)) {
        return null;
      }

      const durationMs = Math.max(0, (event.duration_sec ?? 0) * 1_000);
      let rangeStartMs = timeMs;
      let rangeEndMs = timeMs;

      if ((event.type === 'presence.updated' || event.type === 'presence.ended') && durationMs > 0) {
        rangeStartMs = timeMs - durationMs;
        rangeEndMs = timeMs;
      } else if (event.type === 'alert.raised') {
        rangeStartMs = timeMs - 2_000;
        rangeEndMs = timeMs + 6_000;
      } else if (event.type === 'presence.started') {
        rangeStartMs = timeMs - 1_000;
        rangeEndMs = timeMs + 4_000;
      } else {
        rangeStartMs = timeMs - 1_000;
        rangeEndMs = timeMs + 1_000;
      }

      return {
        ...event,
        timeMs,
        rangeStartMs,
        rangeEndMs,
        title: buildEventTitle(event),
        meta: buildEventMeta(event),
      } satisfies ResolvedTimelineEvent;
    })
    .filter((event): event is ResolvedTimelineEvent => !!event)
    .sort((a, b) => a.timeMs - b.timeMs);
}

function buildTimelineDomain(events: ResolvedTimelineEvent[]): TimelineDomain | null {
  if (!events.length) {
    return null;
  }

  const rawStart = Math.min(...events.map((event) => event.rangeStartMs));
  const rawEnd = Math.max(...events.map((event) => event.rangeEndMs));
  const rawSpan = Math.max(1_000, rawEnd - rawStart);
  const paddedSpan = Math.max(Math.round(rawSpan * 1.18), MIN_DOMAIN_SPAN_MS);
  const midpoint = rawStart + rawSpan / 2;

  return {
    startMs: midpoint - paddedSpan / 2,
    endMs: midpoint + paddedSpan / 2,
    spanMs: paddedSpan,
  };
}

function visibleSpanFor(domainSpanMs: number, zoomFactor: number): number {
  if (domainSpanMs <= 0) {
    return 0;
  }
  return Math.min(domainSpanMs, Math.max(MIN_VISIBLE_SPAN_MS, domainSpanMs / zoomFactor));
}

function buildTicks(startMs: number, endMs: number): TimelineTick[] {
  const spanMs = Math.max(1, endMs - startMs);
  const majorStep = TICK_STEPS_MS.find((step) => spanMs / step <= 9) ?? TICK_STEPS_MS[TICK_STEPS_MS.length - 1];
  const minorStep = buildMinorStep(majorStep);
  const firstTick = Math.floor(startMs / minorStep) * minorStep;
  const ticks: TimelineTick[] = [];

  for (let tickMs = firstTick; tickMs <= endMs + minorStep; tickMs += minorStep) {
    const leftPct = ((tickMs - startMs) / spanMs) * 100;
    if (leftPct < 0 || leftPct > 100) {
      continue;
    }

    const major = Math.abs(tickMs / majorStep - Math.round(tickMs / majorStep)) < 0.001;
    ticks.push({
      key: tickMs,
      leftPct,
      label: major ? formatAxisTick(tickMs, spanMs) : '',
      major,
    });
  }

  return ticks;
}

function buildMinorStep(majorStep: number): number {
  if (majorStep <= 10_000) {
    return Math.round(majorStep / 5);
  }
  if (majorStep <= 60_000) {
    return Math.round(majorStep / 3);
  }
  if (majorStep <= 300_000) {
    return Math.round(majorStep / 4);
  }
  return Math.round(majorStep / 3);
}

function buildLaneItems(
  laneId: TimelineLaneId,
  events: ResolvedTimelineEvent[],
  visibleStartMs: number,
  visibleEndMs: number,
  selectedId: string | null
): TimelineLaneItem[] {
  const visibleSpan = Math.max(1, visibleEndMs - visibleStartMs);

  return events
    .filter((event) => matchesLane(laneId, event))
    .map((event) => {
      const variant = laneVariantFor(laneId, event);
      const { startMs, endMs } = renderWindowForVariant(event, variant);
      const clippedStart = Math.max(startMs, visibleStartMs);
      const clippedEnd = Math.min(endMs, visibleEndMs);

      if (clippedStart > visibleEndMs || clippedEnd < visibleStartMs) {
        return null;
      }

      const leftPct = ((clippedStart - visibleStartMs) / visibleSpan) * 100;
      const widthPct = Math.max(0.8, ((Math.max(clippedEnd - clippedStart, 500) / visibleSpan) * 100));

      return {
        id: `${laneId}-${event.event_id}`,
        eventId: event.event_id,
        leftPct: clampPct(leftPct),
        widthPct,
        title: event.title,
        subtitle: event.meta,
        icon: iconForVariant(variant),
        variant,
        selected: selectedId === event.event_id,
      } satisfies TimelineLaneItem;
    })
    .filter((item): item is TimelineLaneItem => !!item);
}

function matchesLane(laneId: TimelineLaneId, event: ResolvedTimelineEvent): boolean {
  switch (laneId) {
    case 'presence':
      return event.type === 'presence.started' || event.type === 'presence.ended';
    case 'dwell':
      return (event.type === 'presence.updated' || event.type === 'presence.ended') && (event.duration_sec ?? 0) > 0;
    case 'alerts':
      return event.type === 'alert.raised';
    case 'evidence':
      return !!event.evidence_path;
    default:
      return false;
  }
}

function laneVariantFor(laneId: TimelineLaneId, event: ResolvedTimelineEvent): LaneVariant {
  if (laneId === 'evidence') {
    return 'evidence';
  }
  if (laneId === 'alerts') {
    return 'alert';
  }
  if (laneId === 'dwell') {
    return 'dwell';
  }
  return event.type === 'presence.ended' ? 'exit' : 'entry';
}

function renderWindowForVariant(
  event: ResolvedTimelineEvent,
  variant: LaneVariant
): { startMs: number; endMs: number } {
  if (variant === 'dwell') {
    return { startMs: event.rangeStartMs, endMs: event.rangeEndMs };
  }
  if (variant === 'alert') {
    return { startMs: event.timeMs - 2_000, endMs: event.timeMs + 6_000 };
  }
  if (variant === 'evidence') {
    return { startMs: event.timeMs - 1_200, endMs: event.timeMs + 1_200 };
  }
  if (variant === 'exit') {
    return { startMs: event.timeMs - 2_000, endMs: event.timeMs + 3_000 };
  }
  return { startMs: event.timeMs - 1_500, endMs: event.timeMs + 3_500 };
}

function laneVariantsForOverview(event: ResolvedTimelineEvent): LaneVariant[] {
  const variants: LaneVariant[] = [];
  if (event.type === 'presence.started') {
    variants.push('entry');
  }
  if (event.type === 'presence.ended') {
    variants.push('exit');
  }
  if ((event.type === 'presence.updated' || event.type === 'presence.ended') && (event.duration_sec ?? 0) > 0) {
    variants.push('dwell');
  }
  if (event.type === 'alert.raised') {
    variants.push('alert');
  }
  if (event.evidence_path) {
    variants.push('evidence');
  }
  return variants;
}

function pickInitialEvent(events: ResolvedTimelineEvent[]): ResolvedTimelineEvent | null {
  if (!events.length) {
    return null;
  }
  return events.filter((event) => !!event.evidence_path).at(-1) ?? events.at(-1) ?? null;
}

function pickNearestEvent(
  events: ResolvedTimelineEvent[],
  timeMs: number | null
): ResolvedTimelineEvent | null {
  if (!events.length || timeMs == null) {
    return null;
  }

  return events.reduce((closest, current) => {
    if (!closest) {
      return current;
    }
    return Math.abs(current.timeMs - timeMs) < Math.abs(closest.timeMs - timeMs) ? current : closest;
  }, null as ResolvedTimelineEvent | null);
}

function pickNearestEvidenceEvent(
  events: ResolvedTimelineEvent[],
  timeMs: number | null
): ResolvedTimelineEvent | null {
  return pickNearestEvent(
    events.filter((event) => !!event.evidence_path),
    timeMs
  );
}

function buildEventTitle(event: CameraTimelineEvent): string {
  if (event.alert_message) {
    return event.alert_message;
  }
  if (event.zone_id && event.label) {
    return `${event.zone_id} · ${event.label}`;
  }
  if (event.zone_id) {
    return event.zone_id;
  }
  if (event.label) {
    return event.label;
  }
  if (event.alert_type) {
    return event.alert_type;
  }
  return 'Evento sem detalhe adicional';
}

function buildEventMeta(event: CameraTimelineEvent): string {
  const parts: string[] = [];
  if (event.track_id != null) {
    parts.push(`Track ${event.track_id}`);
  }
  if (event.identity_id) {
    parts.push(event.identity_id);
  }
  if (event.duration_sec != null && event.duration_sec > 0) {
    parts.push(`${Math.round(event.duration_sec)}s`);
  }
  if (event.severity) {
    parts.push(`Sev. ${event.severity}`);
  }
  return parts.join(' · ') || 'Sem metadados';
}

function formatAxisTick(timestampMs: number, spanMs: number): string {
  const includeSeconds = spanMs <= 15 * 60 * 1_000;
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
  }).format(timestampMs);
}

function iconForVariant(variant: LaneVariant): string {
  const icons: Record<LaneVariant, string> = {
    entry: 'north_east',
    exit: 'south_east',
    dwell: 'schedule',
    alert: 'notification_important',
    evidence: 'image',
  };
  return icons[variant];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampPct(value: number): number {
  return clamp(value, 0, 100);
}

function isTimeInsideDomain(timeMs: number, domain: TimelineDomain | null): boolean {
  if (!domain) {
    return false;
  }
  return timeMs >= domain.startMs && timeMs <= domain.endMs;
}
