import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface VideoMeta {
  fps_for_snap: number | null;
  is_vfr_suspected: boolean;
}

export type GtSegmentLabel = 'confirmed' | 'suspect' | 'false_positive' | 'default';
export type GtSegmentLocalStatus = 'active' | 'new' | 'edited' | 'removed';

export interface GtSegment {
  id: string;
  label: GtSegmentLabel;
  start_sec: number;
  end_sec: number;
  created_by?: string;
  localStatus?: GtSegmentLocalStatus;
}

interface TimelineTick {
  sec: number;
  leftPct: number;
  major: boolean;
}

interface DragState {
  mode: 'scrub' | 'segment' | 'resize-left' | 'resize-right';
  startX: number;
  startTime: number;
  segmentId?: string;
  segmentStart?: number;
  segmentEnd?: number;
  moved: boolean;
}

@Component({
  selector: 'app-gt-timeline',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gt-timeline.component.html',
  styleUrl: './gt-timeline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GtTimelineComponent implements OnChanges, OnDestroy {
  @Input() videoEl: HTMLVideoElement | null = null;
  @Input() duration_s = 0;
  @Input() meta: VideoMeta = { fps_for_snap: null, is_vfr_suspected: false };
  @Input() initialSegments: GtSegment[] = [];

  @Output() readonly segmentsChange = new EventEmitter<GtSegment[]>();
  @Output() readonly saveRequested = new EventEmitter<GtSegment>();

  @ViewChild('railRef') railRef?: ElementRef<HTMLDivElement>;

  readonly labelOptions: Array<{ value: GtSegmentLabel; text: string }> = [
    { value: 'confirmed', text: 'Confirmado' },
    { value: 'suspect', text: 'Suspeito' },
    { value: 'false_positive', text: 'Falso positivo' },
    { value: 'default', text: 'Padrao' }
  ];

  segments: GtSegment[] = [];
  selectedId: string | null = null;

  draftStart: number | null = null;
  draftEnd: number | null = null;
  draftLabel: GtSegmentLabel = 'confirmed';

  currentTime = 0;
  playing = false;
  snapEnabled = true;

  private boundVideoEl: HTMLVideoElement | null = null;
  private dragState: DragState | null = null;

  private rvfcId: number | null = null;
  private rafId: number | null = null;
  private usesVideoFrameCallback = false;

  private readonly pointerMoveListener = (event: PointerEvent): void => this.onPointerMove(event);
  private readonly pointerUpListener = (): void => this.onPointerUp();

  private readonly handleVideoPlay = (): void => {
    this.playing = true;
    if (!this.usesVideoFrameCallback) {
      this.startFallbackLoop();
    }
    this.cdr.markForCheck();
  };

  private readonly handleVideoPause = (): void => {
    this.playing = false;
    this.stopFallbackLoop();
    this.syncCurrentTimeFromVideo();
    this.cdr.markForCheck();
  };

  private readonly handleVideoTimeUpdate = (): void => {
    if (!this.usesVideoFrameCallback) {
      this.syncCurrentTimeFromVideo();
      this.cdr.markForCheck();
    }
  };

  constructor(private readonly cdr: ChangeDetectorRef) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialSegments']) {
      this.hydrateSegments(this.initialSegments);
    }

    if (changes['videoEl']) {
      this.bindVideo(this.videoEl);
    }

    if (changes['meta'] && !this.canFrameSnap) {
      this.snapEnabled = false;
    }

    if (changes['duration_s']) {
      this.currentTime = this.clampTime(this.currentTime);
      if (this.boundVideoEl && this.boundVideoEl.currentTime > this.displayDuration) {
        this.boundVideoEl.currentTime = this.displayDuration;
      }
    }
  }

  ngOnDestroy(): void {
    this.unbindVideo();
    this.teardownPointerDrag();
  }

  get canFrameSnap(): boolean {
    return this.meta.fps_for_snap !== null && this.meta.fps_for_snap > 0 && !this.meta.is_vfr_suspected;
  }

  get shouldSnap(): boolean {
    return this.canFrameSnap && this.snapEnabled;
  }

  get fineStep(): number {
    if (this.canFrameSnap && this.meta.fps_for_snap) {
      return 1 / this.meta.fps_for_snap;
    }
    return 0.04;
  }

  get displayDuration(): number {
    const inputDuration = Number.isFinite(this.duration_s) && this.duration_s > 0 ? this.duration_s : 0;
    const videoDuration =
      this.boundVideoEl && Number.isFinite(this.boundVideoEl.duration) && this.boundVideoEl.duration > 0
        ? this.boundVideoEl.duration
        : 0;

    return Math.max(inputDuration, videoDuration, 0.001);
  }

  get playheadLeftPct(): number {
    return (this.currentTime / this.displayDuration) * 100;
  }

  get visibleSegments(): GtSegment[] {
    return this.segments
      .filter((segment) => segment.localStatus !== 'removed')
      .slice()
      .sort((a, b) => a.start_sec - b.start_sec);
  }

  get selectedSegment(): GtSegment | null {
    if (!this.selectedId) {
      return null;
    }
    return this.visibleSegments.find((segment) => segment.id === this.selectedId) ?? null;
  }

  get activeLabel(): GtSegmentLabel {
    return this.selectedSegment?.label ?? this.draftLabel;
  }

  get canAddSegment(): boolean {
    return this.draftStart !== null && this.draftEnd !== null;
  }

  get hasDraftRange(): boolean {
    return this.canAddSegment;
  }

  get draftLeftPct(): number {
    if (!this.hasDraftRange || this.draftStart === null) {
      return 0;
    }
    return (this.clampTime(this.draftStart) / this.displayDuration) * 100;
  }

  get draftWidthPct(): number {
    if (!this.hasDraftRange || this.draftStart === null || this.draftEnd === null) {
      return 0;
    }
    const width = Math.max(0.001, this.draftEnd - this.draftStart);
    return (width / this.displayDuration) * 100;
  }

  get ticks(): TimelineTick[] {
    const duration = this.displayDuration;
    const maxSecond = Math.ceil(duration);
    const majorStep = duration >= 90 ? 10 : 5;
    const list: TimelineTick[] = [];

    for (let sec = 0; sec <= maxSecond; sec += 1) {
      const clampedSec = Math.min(sec, duration);
      list.push({
        sec: clampedSec,
        leftPct: (clampedSec / duration) * 100,
        major: sec % majorStep === 0 || sec === 0 || sec === maxSecond
      });
    }

    if (list.length === 0 || list[list.length - 1].sec < duration) {
      list.push({ sec: duration, leftPct: 100, major: true });
    }

    return list;
  }

  get majorTicks(): TimelineTick[] {
    const majors = this.ticks.filter((tick) => tick.major);
    if (majors.length < 2) {
      return majors;
    }

    const lastIndex = majors.length - 1;
    const last = majors[lastIndex];
    const previous = majors[lastIndex - 1];

    // Evita sobreposicao visual entre o ultimo tick inteiro e o tick final da duracao exata.
    if (last.sec - previous.sec < 1.5) {
      return majors.filter((_, index) => index !== lastIndex - 1);
    }

    return majors;
  }

  @HostListener('window:keydown', ['$event'])
  handleWindowKeydown(event: KeyboardEvent): void {
    if (!this.boundVideoEl) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)) {
      return;
    }

    const key = event.key.toLowerCase();

    if (event.code === 'Space') {
      this.togglePlay();
      event.preventDefault();
      return;
    }

    if (key === 'i') {
      this.markIn();
      event.preventDefault();
      return;
    }

    if (key === 'o') {
      this.markOut();
      event.preventDefault();
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      this.stepBy(direction as 1 | -1, event.shiftKey);
      event.preventDefault();
    }
  }

  trackByTick(index: number): number {
    return index;
  }

  trackBySegment(_index: number, segment: GtSegment): string {
    return segment.id;
  }

  formatTime(sec: number): string {
    return formatTime(sec);
  }

  formatDuration(segment: GtSegment): string {
    return (segment.end_sec - segment.start_sec).toFixed(2);
  }

  labelText(label: GtSegmentLabel): string {
    switch (label) {
      case 'confirmed':
        return 'Confirmado';
      case 'suspect':
        return 'Suspeito';
      case 'false_positive':
        return 'Falso positivo';
      default:
        return 'Padrao';
    }
  }

  segmentCssClass(label: GtSegmentLabel): string {
    switch (label) {
      case 'confirmed':
        return 'segment-confirmed';
      case 'suspect':
        return 'segment-suspect';
      case 'false_positive':
        return 'segment-false-positive';
      default:
        return 'segment-default';
    }
  }

  segmentLeftPct(segment: GtSegment): number {
    return (this.clampTime(segment.start_sec) / this.displayDuration) * 100;
  }

  segmentWidthPct(segment: GtSegment): number {
    const width = Math.max(0.001, segment.end_sec - segment.start_sec);
    return (width / this.displayDuration) * 100;
  }

  togglePlay(): void {
    if (!this.boundVideoEl) {
      return;
    }

    if (this.boundVideoEl.paused) {
      void this.boundVideoEl.play();
      return;
    }

    this.boundVideoEl.pause();
  }

  jumpBy(seconds: number): void {
    this.seekVideo(this.currentTime + seconds);
  }

  stepBy(direction: 1 | -1, halfStep = false): void {
    const step = halfStep ? this.fineStep / 2 : this.fineStep;
    this.seekVideo(this.currentTime + direction * step);
  }

  markIn(): void {
    this.selectedId = null;
    this.draftStart = this.snapIfNeeded(this.currentTime);

    if (this.draftEnd !== null && this.draftEnd <= this.draftStart) {
      this.draftEnd = null;
    }

    this.cdr.markForCheck();
  }

  markOut(): void {
    this.selectedId = null;
    this.draftEnd = this.snapIfNeeded(this.currentTime);

    if (this.draftStart === null) {
      this.draftStart = this.clampTime(this.draftEnd - Math.max(this.fineStep, 0.04));
    }

    if (this.draftStart !== null && this.draftEnd <= this.draftStart) {
      this.draftEnd = this.clampTime(this.draftStart + Math.max(this.fineStep, 0.04));
    }

    this.cdr.markForCheck();
  }

  onLabelChange(rawValue: string): void {
    const nextLabel = this.normalizeLabel(rawValue);
    const selected = this.selectedSegment;

    if (!selected) {
      this.draftLabel = nextLabel;
      return;
    }

    this.segments = this.segments.map((segment): GtSegment => {
      if (segment.id !== selected.id) {
        return segment;
      }

      return {
        ...segment,
        label: nextLabel,
        localStatus: this.getEditedStatus(segment.localStatus)
      };
    });

    this.emitSegments();
    this.cdr.markForCheck();
  }

  toggleSnap(): void {
    if (!this.canFrameSnap) {
      return;
    }
    this.snapEnabled = !this.snapEnabled;
  }

  addSegment(): void {
    if (!this.canAddSegment || this.draftStart === null || this.draftEnd === null) {
      return;
    }

    let start = Math.min(this.draftStart, this.draftEnd);
    let end = Math.max(this.draftStart, this.draftEnd);
    const minDuration = Math.max(this.fineStep, 0.04);

    start = this.snapIfNeeded(start);
    end = this.snapIfNeeded(end);

    if (end - start < minDuration) {
      if (start + minDuration <= this.displayDuration) {
        end = start + minDuration;
      } else {
        start = Math.max(0, end - minDuration);
      }
    }

    if (end <= start) {
      return;
    }

    const newSegment: GtSegment = {
      id: this.generateSegmentId(),
      label: this.draftLabel,
      start_sec: Number(start.toFixed(3)),
      end_sec: Number(end.toFixed(3)),
      created_by: 'human_reviewer',
      localStatus: 'new'
    };

    this.segments = [...this.segments, newSegment].sort((a, b) => a.start_sec - b.start_sec);

    this.emitSegments();
    this.saveRequested.emit(newSegment);

    // Finaliza o segmento atual e prepara o proximo.
    this.selectedId = null;
    this.draftStart = null;
    this.draftEnd = null;

    this.cdr.markForCheck();
  }

  selectSegment(segment: GtSegment): void {
    this.selectedId = segment.id;
    this.draftStart = segment.start_sec;
    this.draftEnd = segment.end_sec;
    this.draftLabel = segment.label;
    this.seekVideo(segment.start_sec, false);
  }

  removeSegment(segmentId: string, event: MouseEvent): void {
    event.stopPropagation();

    this.segments = this.segments.map((segment): GtSegment => {
      if (segment.id !== segmentId) {
        return segment;
      }
      return {
        ...segment,
        localStatus: 'removed'
      };
    });

    if (this.selectedId === segmentId) {
      this.selectedId = null;
    }

    this.emitSegments();
    this.cdr.markForCheck();
  }

  onRailPointerDown(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest('.segment-block') || target.closest('.playhead')) {
      return;
    }

    event.preventDefault();

    const startTime = this.clientXToTime(event.clientX);
    this.seekVideo(startTime, true);

    this.beginPointerDrag({
      mode: 'scrub',
      startX: event.clientX,
      startTime,
      moved: false
    });
  }

  onPlayheadPointerDown(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.beginPointerDrag({
      mode: 'scrub',
      startX: event.clientX,
      startTime: this.currentTime,
      moved: false
    });
  }

  onSegmentPointerDown(event: PointerEvent, segment: GtSegment): void {
    if (event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest('.segment-handle')) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.selectedId = segment.id;

    this.beginPointerDrag({
      mode: 'segment',
      startX: event.clientX,
      startTime: this.currentTime,
      segmentId: segment.id,
      segmentStart: segment.start_sec,
      segmentEnd: segment.end_sec,
      moved: false
    });
  }

  onHandlePointerDown(event: PointerEvent, segment: GtSegment, side: 'left' | 'right'): void {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.selectedId = segment.id;

    this.beginPointerDrag({
      mode: side === 'left' ? 'resize-left' : 'resize-right',
      startX: event.clientX,
      startTime: this.currentTime,
      segmentId: segment.id,
      segmentStart: segment.start_sec,
      segmentEnd: segment.end_sec,
      moved: false
    });
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.dragState || !this.railRef) {
      return;
    }

    const railRect = this.railRef.nativeElement.getBoundingClientRect();
    if (railRect.width <= 0) {
      return;
    }

    const deltaPx = event.clientX - this.dragState.startX;
    const deltaSec = (deltaPx / railRect.width) * this.displayDuration;

    if (this.dragState.mode === 'scrub') {
      const scrubTime = this.clientXToTime(event.clientX);
      this.seekVideo(scrubTime, true);
      this.dragState.moved = true;
      return;
    }

    if (!this.dragState.segmentId || this.dragState.segmentStart === undefined || this.dragState.segmentEnd === undefined) {
      return;
    }

    const minDuration = Math.max(this.fineStep, 0.04);
    const originalDuration = this.dragState.segmentEnd - this.dragState.segmentStart;

    if (this.dragState.mode === 'segment') {
      let nextStart = this.dragState.segmentStart + deltaSec;
      nextStart = clamp(nextStart, 0, this.displayDuration - originalDuration);
      if (this.shouldSnap) {
        nextStart = snapToGrid(nextStart, this.fineStep);
        nextStart = clamp(nextStart, 0, this.displayDuration - originalDuration);
      }

      const nextEnd = nextStart + originalDuration;
      this.patchSegmentTiming(this.dragState.segmentId, nextStart, nextEnd);
      this.dragState.moved = true;
      this.cdr.markForCheck();
      return;
    }

    if (this.dragState.mode === 'resize-left') {
      let nextStart = this.dragState.segmentStart + deltaSec;
      nextStart = clamp(nextStart, 0, this.dragState.segmentEnd - minDuration);
      if (this.shouldSnap) {
        nextStart = snapToGrid(nextStart, this.fineStep);
        nextStart = clamp(nextStart, 0, this.dragState.segmentEnd - minDuration);
      }

      this.patchSegmentTiming(this.dragState.segmentId, nextStart, this.dragState.segmentEnd);
      this.dragState.moved = true;
      this.cdr.markForCheck();
      return;
    }

    if (this.dragState.mode === 'resize-right') {
      let nextEnd = this.dragState.segmentEnd + deltaSec;
      nextEnd = clamp(nextEnd, this.dragState.segmentStart + minDuration, this.displayDuration);
      if (this.shouldSnap) {
        nextEnd = snapToGrid(nextEnd, this.fineStep);
        nextEnd = clamp(nextEnd, this.dragState.segmentStart + minDuration, this.displayDuration);
      }

      this.patchSegmentTiming(this.dragState.segmentId, this.dragState.segmentStart, nextEnd);
      this.dragState.moved = true;
      this.cdr.markForCheck();
    }
  }

  private onPointerUp(): void {
    const shouldEmit = this.dragState?.mode !== 'scrub' && this.dragState?.moved;
    this.teardownPointerDrag();

    if (shouldEmit) {
      this.emitSegments();
    }
  }

  private beginPointerDrag(state: DragState): void {
    this.dragState = state;
    window.addEventListener('pointermove', this.pointerMoveListener);
    window.addEventListener('pointerup', this.pointerUpListener);
    window.addEventListener('pointercancel', this.pointerUpListener);
  }

  private teardownPointerDrag(): void {
    this.dragState = null;
    window.removeEventListener('pointermove', this.pointerMoveListener);
    window.removeEventListener('pointerup', this.pointerUpListener);
    window.removeEventListener('pointercancel', this.pointerUpListener);
  }

  private emitSegments(): void {
    this.segmentsChange.emit(this.segments.map((segment) => ({ ...segment })));
  }

  private bindVideo(video: HTMLVideoElement | null): void {
    if (video === this.boundVideoEl) {
      return;
    }

    this.unbindVideo();

    this.boundVideoEl = video;
    if (!this.boundVideoEl) {
      return;
    }

    this.boundVideoEl.addEventListener('play', this.handleVideoPlay);
    this.boundVideoEl.addEventListener('pause', this.handleVideoPause);
    this.boundVideoEl.addEventListener('timeupdate', this.handleVideoTimeUpdate);
    this.boundVideoEl.addEventListener('seeking', this.handleVideoTimeUpdate);
    this.boundVideoEl.addEventListener('loadedmetadata', this.handleVideoTimeUpdate);
    this.boundVideoEl.addEventListener('ended', this.handleVideoPause);

    this.currentTime = this.clampTime(this.boundVideoEl.currentTime);
    this.playing = !this.boundVideoEl.paused && !this.boundVideoEl.ended;

    this.startSyncLoop();
    this.cdr.markForCheck();
  }

  private unbindVideo(): void {
    this.stopSyncLoop();

    if (!this.boundVideoEl) {
      return;
    }

    this.boundVideoEl.removeEventListener('play', this.handleVideoPlay);
    this.boundVideoEl.removeEventListener('pause', this.handleVideoPause);
    this.boundVideoEl.removeEventListener('timeupdate', this.handleVideoTimeUpdate);
    this.boundVideoEl.removeEventListener('seeking', this.handleVideoTimeUpdate);
    this.boundVideoEl.removeEventListener('loadedmetadata', this.handleVideoTimeUpdate);
    this.boundVideoEl.removeEventListener('ended', this.handleVideoPause);

    this.boundVideoEl = null;
  }

  private startSyncLoop(): void {
    this.stopSyncLoop();

    if (!this.boundVideoEl) {
      return;
    }

    const video = this.boundVideoEl as any;
    const requestVideoFrameCallback = video.requestVideoFrameCallback as
      | ((callback: (now: number, metadata: unknown) => void) => number)
      | undefined;

    if (typeof requestVideoFrameCallback === 'function') {
      this.usesVideoFrameCallback = true;

      const frameLoop = (): void => {
        if (!this.boundVideoEl) {
          return;
        }

        this.syncCurrentTimeFromVideo();
        this.playing = !this.boundVideoEl.paused && !this.boundVideoEl.ended;
        this.cdr.markForCheck();

        this.rvfcId = requestVideoFrameCallback.call(video, frameLoop);
      };

      this.rvfcId = requestVideoFrameCallback.call(video, frameLoop);
      return;
    }

    this.usesVideoFrameCallback = false;
    if (!this.boundVideoEl.paused) {
      this.startFallbackLoop();
    }
  }

  private stopSyncLoop(): void {
    this.stopFallbackLoop();

    if (this.rvfcId !== null && this.boundVideoEl) {
      const cancelVideoFrameCallback = (this.boundVideoEl as any).cancelVideoFrameCallback as
        | ((id: number) => void)
        | undefined;

      if (typeof cancelVideoFrameCallback === 'function') {
        cancelVideoFrameCallback.call(this.boundVideoEl, this.rvfcId);
      }
    }

    this.rvfcId = null;
    this.usesVideoFrameCallback = false;
  }

  private startFallbackLoop(): void {
    if (this.rafId !== null) {
      return;
    }

    const loop = (): void => {
      if (!this.boundVideoEl) {
        this.rafId = null;
        return;
      }

      this.syncCurrentTimeFromVideo();
      this.playing = !this.boundVideoEl.paused && !this.boundVideoEl.ended;
      this.cdr.markForCheck();

      if (this.playing) {
        this.rafId = requestAnimationFrame(loop);
      } else {
        this.rafId = null;
      }
    };

    this.rafId = requestAnimationFrame(loop);
  }

  private stopFallbackLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private seekVideo(timeSec: number, emitVisualSnap = true): void {
    const target = this.snapIfNeeded(timeSec);

    if (this.boundVideoEl) {
      this.boundVideoEl.currentTime = target;
    }

    if (emitVisualSnap || !this.boundVideoEl) {
      this.currentTime = target;
      this.cdr.markForCheck();
    }
  }

  private clientXToTime(clientX: number): number {
    if (!this.railRef) {
      return 0;
    }

    const rect = this.railRef.nativeElement.getBoundingClientRect();
    if (rect.width <= 0) {
      return 0;
    }

    const pct = clamp((clientX - rect.left) / rect.width, 0, 1);
    return pct * this.displayDuration;
  }

  private patchSegmentTiming(segmentId: string, start: number, end: number): void {
    this.segments = this.segments
      .map((segment): GtSegment => {
        if (segment.id !== segmentId) {
          return segment;
        }

        return {
          ...segment,
          start_sec: Number(this.clampTime(start).toFixed(3)),
          end_sec: Number(this.clampTime(end).toFixed(3)),
          localStatus: this.getEditedStatus(segment.localStatus)
        };
      })
      .sort((a, b) => a.start_sec - b.start_sec);
  }

  private hydrateSegments(inputSegments: GtSegment[]): void {
    this.segments = inputSegments
      .map((segment, index) => this.normalizeIncomingSegment(segment, index))
      .sort((a, b) => a.start_sec - b.start_sec);

    if (this.selectedId && !this.segments.some((segment) => segment.id === this.selectedId && segment.localStatus !== 'removed')) {
      this.selectedId = null;
    }

    this.cdr.markForCheck();
  }

  private normalizeIncomingSegment(segment: GtSegment, index: number): GtSegment {
    const start = Number.isFinite(segment.start_sec) ? Number(segment.start_sec) : 0;
    const endCandidate = Number.isFinite(segment.end_sec) ? Number(segment.end_sec) : start + 0.04;
    const end = endCandidate > start ? endCandidate : start + 0.04;

    return {
      id: segment.id || `seg_${index}_${Math.floor(start * 1000)}`,
      label: this.normalizeLabel(segment.label),
      start_sec: Number(start.toFixed(3)),
      end_sec: Number(end.toFixed(3)),
      created_by: segment.created_by,
      localStatus: segment.localStatus ?? 'active'
    };
  }

  private normalizeLabel(raw: string | null | undefined): GtSegmentLabel {
    const value = (raw || '').toString().trim().toLowerCase();

    if (value === 'confirmed') {
      return 'confirmed';
    }

    if (value === 'suspect') {
      return 'suspect';
    }

    if (value === 'false_positive' || value === 'false-positive') {
      return 'false_positive';
    }

    return 'default';
  }

  private getEditedStatus(currentStatus: GtSegmentLocalStatus | undefined): GtSegmentLocalStatus {
    return currentStatus === 'new' ? 'new' : 'edited';
  }

  private clampTime(value: number): number {
    return clamp(value, 0, this.displayDuration);
  }

  private snapIfNeeded(value: number): number {
    const clamped = this.clampTime(value);
    if (!this.shouldSnap) {
      return clamped;
    }

    return clamp(snapToGrid(clamped, this.fineStep), 0, this.displayDuration);
  }

  private syncCurrentTimeFromVideo(): void {
    if (!this.boundVideoEl) {
      return;
    }

    this.currentTime = this.clampTime(this.boundVideoEl.currentTime);
  }

  private generateSegmentId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    return `seg_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function snapToGrid(value: number, grid: number): number {
  if (!Number.isFinite(grid) || grid <= 0) {
    return value;
  }

  return Math.round(value / grid) * grid;
}

export function formatTime(sec: number): string {
  const safe = Number.isFinite(sec) ? Math.max(0, sec) : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = safe - minutes * 60;

  return `${minutes.toString().padStart(2, '0')}:${seconds.toFixed(2).padStart(5, '0')}`;
}
