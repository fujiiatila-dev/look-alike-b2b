import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ApiService, AnnotationResponse, EventResponse, VideoMetadataResponse } from '../../services/api.service';
import {
  GtSegment,
  GtSegmentLabel,
  GtTimelineComponent,
  VideoMeta
} from './components/gt-timeline/gt-timeline.component';
import { VideoPlayerComponent } from './components/video-player/video-player.component';

interface EventMetricRow {
  metric_id: string;
  run_type: string;
  overlap_ratio: number;
  delay_frames: number;
  precision_window: number;
  recall_window: number;
  spam_outside_gt: number;
  score_final: number;
  conf_used: number;
  fps_used: number;
  threshold_used: number;
  created_at: string;
}

enum RiskFactorCode {
  RESTRICTED_ZONE = 'RESTRICTED_ZONE',
  SUSPICIOUS_SEQUENCE = 'SUSPICIOUS_SEQUENCE:HIGH_VALUE_NO_CHECKOUT',
  ZONE_MULTIPLIER = 'ZONE_MULTIPLIER:HIGH_VALUE_2x',
  SLOW_IN_HIGH_VALUE = 'SLOW_IN_HIGH_VALUE'
}

const RISK_FACTOR_LABELS_PT_BR: Record<RiskFactorCode, string> = {
  [RiskFactorCode.RESTRICTED_ZONE]: 'Zona restrita',
  [RiskFactorCode.SUSPICIOUS_SEQUENCE]: 'Alto valor -> saida sem passar no caixa',
  [RiskFactorCode.ZONE_MULTIPLIER]: 'Zona de alto valor (peso 2x)',
  [RiskFactorCode.SLOW_IN_HIGH_VALUE]: 'Movimento lento em area de alto valor'
};

const ZONE_LABELS_PT_BR: Record<string, string> = {
  high_value_rack: 'Prateleira de alto valor',
  main_floor: 'Area principal',
  checkout: 'Caixa',
  entrance_exit: 'Entrada/Saida',
  frame: 'Quadro completo',
  default_full_frame: 'Quadro completo'
};

@Component({
  selector: 'app-event-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatProgressBarModule,
    MatSnackBarModule,
    VideoPlayerComponent,
    GtTimelineComponent
  ],
  templateUrl: './event-detail.component.html',
  styleUrl: './event-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventDetailComponent implements OnInit {

  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);

  loading = true;
  errorMessage = '';
  event: EventResponse | null = null;
  metrics: EventMetricRow[] = [];
  videoMeta: VideoMetadataResponse | null = null;
  timelineMeta: VideoMeta = { fps_for_snap: null, is_vfr_suspected: true };
  gtSegments: GtSegment[] = [];
  selectedEvidencePath: string | null = null;
  evidenceExpanded = false;
  readonly EVIDENCE_PREVIEW_LIMIT = 8;

  annotating = false;
  reprocessing = false;
  blurring = false;
  exporting = false;

  readonly annotationForm = this.formBuilder.nonNullable.group({
    label: ['Confirmed', [Validators.required]],
    start_sec: [0, [Validators.required, Validators.min(0)]],
    end_sec: [1, [Validators.required, Validators.min(0)]],
    created_by: ['human_reviewer', [Validators.required]]
  });

  readonly refineForm = this.formBuilder.nonNullable.group({
    conf: [0.55, [Validators.required, Validators.min(0.1), Validators.max(0.99)]],
    fps: [10, [Validators.required, Validators.min(1), Validators.max(30)]],
    alert_threshold: [40, [Validators.required, Validators.min(1), Validators.max(200)]]
  });

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const eventId = params.get('id');
      if (!eventId) {
        this.loading = false;
        this.errorMessage = 'Event ID ausente na rota.';
        this.cdr.markForCheck();
        return;
      }

      this.loadEvent(eventId);
    });
  }

  get videoUrl(): string {
    if (!this.event) {
      return '';
    }

    const selectedPath = this.event.redacted_clip_path || this.event.clip_path;
    return this.toServeUrl(selectedPath);
  }

  get evidencePaths(): string[] {
    return this.event?.evidence_paths ?? [];
  }

  get visibleEvidencePaths(): string[] {
    if (this.evidenceExpanded || this.evidencePaths.length <= this.EVIDENCE_PREVIEW_LIMIT) {
      return this.evidencePaths;
    }
    return this.evidencePaths.slice(0, this.EVIDENCE_PREVIEW_LIMIT);
  }

  get hiddenEvidenceCount(): number {
    return Math.max(0, this.evidencePaths.length - this.EVIDENCE_PREVIEW_LIMIT);
  }

  toggleEvidenceExpand(): void {
    this.evidenceExpanded = !this.evidenceExpanded;
  }

  get riskFactors(): string[] {
    return this.event?.risk_factors ?? [];
  }

  get zoneHistory(): string[] {
    return this.event?.zone_history ?? [];
  }

  get latestMetric(): EventMetricRow | null {
    if (this.metrics.length === 0) {
      return null;
    }
    return this.metrics[this.metrics.length - 1];
  }

  get selectedEvidenceName(): string {
    return this.selectedEvidencePath ? this.evidenceFileName(this.selectedEvidencePath) : '';
  }

  get timelineDurationSec(): number {
    if (this.videoMeta && this.videoMeta.duration_s > 0) {
      return this.videoMeta.duration_s;
    }

    // Fallback logic
    const notes = this.parsedNotes;
    const clipStart = typeof notes?.['clip_abs_start_sec'] === 'number' ? notes['clip_abs_start_sec'] : 0;
    const clipEnd = typeof notes?.['clip_abs_end_sec'] === 'number' ? notes['clip_abs_end_sec'] : 0;

    if (clipEnd > clipStart) {
      return clipEnd - clipStart;
    }

    const maxAnnEnd = Math.max(...(this.event?.annotations.map((ann) => ann.end_sec) ?? [0]));
    return Math.max(1, maxAnnEnd + 1);
  }

  get parsedNotes(): Record<string, any> | null {
    if (!this.event?.notes) {
      return null;
    }

    try {
      const parsed = JSON.parse(this.event.notes);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  loadEvent(eventId: string): void {
    this.loading = true;
    this.errorMessage = '';

    this.api
      .getEvent(eventId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (eventData) => {
          this.event = eventData;
          this.loading = false;
          this.gtSegments = this.mapAnnotationsToSegments(eventData.annotations);
          this.selectedEvidencePath = null;

          const latestAnn = eventData.annotations[eventData.annotations.length - 1];
          if (latestAnn) {
            this.annotationForm.patchValue({
              label: latestAnn.label,
              start_sec: Number(latestAnn.start_sec),
              end_sec: Number(latestAnn.end_sec)
            });
          }

          this.loadMetrics(eventId);

          if (eventData.source_video || eventData.source_path) {
            const path = eventData.source_video ? eventData.source_video : eventData.source_path.split('/').pop() || '';
            this.loadVideoMeta(path);
          }

          this.cdr.markForCheck();
        },
        error: (err) => {
          this.loading = false;
          this.errorMessage = err?.error?.detail || 'Falha ao carregar evento.';
          this.cdr.markForCheck();
        }
      });
  }

  loadVideoMeta(path: string): void {
    // Basic path extraction, handling both absolute paths and simple filenames
    const relativePath = path.includes('/') ? path.substring(path.indexOf('data_v1') > -1 ? path.indexOf('data_v1') + 8 : path.lastIndexOf('/') + 1) : path;

    // Simple heuristic for UCF-Crime
    const safePath = `shoplifting/${relativePath.replace('shoplifting/', '')}`;

    this.api.getVideoMeta(safePath).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (meta) => {
        this.videoMeta = meta;
        this.timelineMeta = {
          fps_for_snap: meta.fps_for_snap,
          is_vfr_suspected: meta.is_vfr_suspected
        };
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.warn('Metadata falhou, usando fallbacks', err);
        // TODO: quando endpoint de meta estiver indisponivel, manter fallback local no frontend.
        this.videoMeta = null;
        this.timelineMeta = {
          fps_for_snap: null,
          is_vfr_suspected: true
        };
        this.cdr.markForCheck();
      }
    });
  }

  loadMetrics(eventId: string): void {
    this.api
      .getEventMetrics(eventId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (metrics) => {
          this.metrics = (metrics as EventMetricRow[]).slice().sort((a, b) =>
            a.created_at.localeCompare(b.created_at)
          );
          this.cdr.markForCheck();
        },
        error: () => {
          this.metrics = [];
          this.cdr.markForCheck();
        }
      });
  }

  openAnnotateModal(): void {
    this.saveAnnotation();
  }

  saveAnnotation(): void {
    if (!this.event || this.annotationForm.invalid || this.annotating) {
      return;
    }

    const payload = this.annotationForm.getRawValue();
    const startSec = Number(payload.start_sec);
    const endSec = Number(payload.end_sec);

    if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec <= startSec) {
      this.errorMessage = 'Intervalo GT invalido: end_sec deve ser maior que start_sec.';
      this.cdr.markForCheck();
      return;
    }

    this.annotating = true;
    this.errorMessage = '';

    this.api
      .annotateEvent(this.event.event_id, payload.label, startSec, endSec, payload.created_by)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updatedEvent) => {
          this.event = {
            ...updatedEvent,
            status: 'annotated'
          };
          this.gtSegments = this.mapAnnotationsToSegments(updatedEvent.annotations);
          this.annotating = false;
          this.snackBar.open('GT Salvo com sucesso!', 'OK', { duration: 3000 });
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.annotating = false;
          this.errorMessage = err?.error?.detail || 'Erro ao salvar GT.';
          this.snackBar.open(this.errorMessage, 'Fechar', { duration: 5000 });
          this.cdr.markForCheck();
        }
      });
  }

  runReprocess(): void {
    if (!this.event || this.refineForm.invalid || this.reprocessing) {
      return;
    }

    const params = this.refineForm.getRawValue();
    this.reprocessing = true;
    this.errorMessage = '';

    this.api
      .reprocessEvent(this.event.event_id, params)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.reprocessing = false;
          setTimeout(() => {
            this.loadEvent(this.event!.event_id);
          }, 1500);
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.reprocessing = false;
          this.errorMessage = err?.error?.detail || 'Erro ao iniciar reprocessamento.';
          this.cdr.markForCheck();
        }
      });
  }

  triggerBlur(): void {
    if (!this.event || this.blurring) {
      return;
    }

    this.blurring = true;
    this.api
      .triggerBlur(this.event.event_id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          if (this.event) {
            this.event = { ...this.event, status: 'blurring' };
          }
          this.blurring = false;
          this.snackBar.open('Blur LGPD iniciado com sucesso!', 'OK', { duration: 3000 });
          setTimeout(() => this.loadEvent(this.event!.event_id), 2000);
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.blurring = false;
          this.errorMessage = err?.error?.detail || 'Erro ao iniciar blur.';
          this.snackBar.open(this.errorMessage, 'Fechar', { duration: 5000 });
          this.cdr.markForCheck();
        }
      });
  }

  triggerExport(): void {
    if (!this.event || this.exporting) {
      return;
    }

    this.exporting = true;
    this.api
      .triggerExport(this.event.event_id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          if (this.event) {
            this.event = { ...this.event, status: 'exporting' };
          }
          this.exporting = false;
          this.snackBar.open('Pacote de evidencias Exportado!', 'OK', { duration: 3000 });
          setTimeout(() => this.loadEvent(this.event!.event_id), 1000);
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.exporting = false;
          this.errorMessage = err?.error?.detail || 'Erro ao exportar pacote LGPD.';
          this.snackBar.open(this.errorMessage, 'Fechar', { duration: 5000 });
          this.cdr.markForCheck();
        }
      });
  }

  metricBarValue(metric: EventMetricRow): number {
    return Math.max(0, Math.min(100, metric.overlap_ratio * 100));
  }

  translateRiskFactor(factor: string): string {
    if (!factor) {
      return factor;
    }

    const staticLabel = RISK_FACTOR_LABELS_PT_BR[factor as RiskFactorCode];
    if (staticLabel) {
      return staticLabel;
    }

    const loiteringMatch = /^LOITERING:(.+)$/i.exec(factor);
    if (loiteringMatch) {
      const zoneId = loiteringMatch[1].trim();
      return `Permanencia excessiva: ${this.translateZoneLabel(zoneId)}`;
    }

    const pacingMatch = /^PACING:(\d+)_reversals$/i.exec(factor);
    if (pacingMatch) {
      const reversals = Number(pacingMatch[1]);
      const suffix = reversals === 1 ? 'inversao' : 'inversoes';
      return `Vai e volta suspeito: ${reversals} ${suffix}`;
    }

    return factor;
  }

  translateZoneLabel(zoneId: string): string {
    if (!zoneId) {
      return zoneId;
    }

    const normalized = zoneId.trim().toLowerCase();
    const mapped = ZONE_LABELS_PT_BR[normalized];
    if (mapped) {
      return mapped;
    }

    return this.toTitleCase(zoneId);
  }

  statusClass(status?: string): string {
    const normalized = (status || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `status-${normalized}`;
  }

  riskClass(score?: number): string {
    if (score === undefined || score === null || !Number.isFinite(score)) {
      return 'risk-neutral';
    }

    const normalized = score > 1 ? score / 100 : score;

    if (normalized >= 0.85) {
      return 'risk-critical';
    }
    if (normalized >= 0.65) {
      return 'risk-high';
    }
    if (normalized >= 0.4) {
      return 'risk-medium';
    }
    return 'risk-low';
  }

  toPercent(value?: number): number {
    if (value === undefined || value === null || !Number.isFinite(value)) {
      return 0;
    }

    const normalized = value > 1 ? value / 100 : value;
    return Math.max(0, Math.min(100, normalized * 100));
  }

  delayBarValue(delayFrames: number): number {
    if (!Number.isFinite(delayFrames)) {
      return 0;
    }

    const threshold = Number(this.refineForm.controls.alert_threshold.value) || 40;
    return Math.max(0, Math.min(100, (delayFrames / Math.max(1, threshold)) * 100));
  }

  spamBarValue(spamOutsideGt: number): number {
    if (!Number.isFinite(spamOutsideGt)) {
      return 0;
    }

    const cap = 10;
    return Math.max(0, Math.min(100, (spamOutsideGt / cap) * 100));
  }

  onSegmentsChange(segments: GtSegment[]): void {
    this.gtSegments = segments.slice();
    this.cdr.markForCheck();
  }

  onSaveSegmentRequested(segment: GtSegment): void {
    // TODO: integrar endpoint para salvar multiplos segmentos GT quando backend estiver pronto.
    console.log('[TODO][GT] Salvar segmento', {
      event_id: this.event?.event_id,
      label: this.mapSegmentLabelToApiLabel(segment.label),
      start_sec: segment.start_sec,
      end_sec: segment.end_sec
    });
  }

  openEvidence(path: string): void {
    if (!path) {
      return;
    }
    this.selectedEvidencePath = path;
    this.cdr.markForCheck();
  }

  closeEvidence(): void {
    this.selectedEvidencePath = null;
    this.cdr.markForCheck();
  }

  onEvidenceBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeEvidence();
    }
  }

  evidenceFileName(path: string): string {
    const chunks = path.split('/');
    return chunks[chunks.length - 1] || path;
  }

  @HostListener('window:keydown.escape')
  handleEscapeForEvidence(): void {
    if (this.selectedEvidencePath) {
      this.closeEvidence();
    }
  }

  toServeUrl(path?: string): string {
    if (!path) {
      return '';
    }

    const safePath = path
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');

    return `/api/files/serve/${safePath}`;
  }

  trackByEvidence(_index: number, evidencePath: string): string {
    return evidencePath;
  }

  trackByMetric(_index: number, metric: EventMetricRow): string {
    return metric.metric_id;
  }

  private toTitleCase(value: string): string {
    return value
      .replace(/[_-]+/g, ' ')
      .trim()
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private mapAnnotationsToSegments(annotations: AnnotationResponse[]): GtSegment[] {
    return annotations.map((annotation, index): GtSegment => ({
      id: annotation.annotation_id || `ann_${index}_${Math.floor(annotation.start_sec * 1000)}`,
      label: this.mapApiLabelToSegmentLabel(annotation.label),
      start_sec: Number(annotation.start_sec),
      end_sec: Number(annotation.end_sec),
      created_by: annotation.created_by,
      localStatus: 'active'
    }));
  }

  private mapApiLabelToSegmentLabel(label: string): GtSegmentLabel {
    const normalized = label.trim().toLowerCase();

    if (normalized === 'confirmed') {
      return 'confirmed';
    }

    if (normalized === 'suspect') {
      return 'suspect';
    }

    if (normalized === 'false_positive') {
      return 'false_positive';
    }

    return 'default';
  }

  private mapSegmentLabelToApiLabel(label: GtSegmentLabel): string {
    if (label === 'confirmed') {
      return 'Confirmed';
    }

    if (label === 'suspect') {
      return 'Suspect';
    }

    if (label === 'false_positive') {
      return 'False_Positive';
    }

    return 'Confirmed';
  }
}
