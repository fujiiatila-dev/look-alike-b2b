import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { WebSocketService, WsMessage } from '../../../../core/services/websocket.service';
import { CameraStatus } from '../../../../shared/models/camera.models';
import { OfficeEventItem, PaginatedOfficeEvents } from '../../../../shared/models/office.models';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { CameraStateColorPipe } from '../../../../shared/pipes/camera-state-color.pipe';
import { CameraStateLabelPipe } from '../../../../shared/pipes/camera-state-label.pipe';
import { UptimePipe } from '../../../../shared/pipes/uptime.pipe';
import { R } from '../../../../shared/utils/client-routes';
import { CameraEditDialogComponent } from '../../components/camera-edit-dialog/camera-edit-dialog.component';
import {
  CameraEventTimelineComponent,
  CameraTimelineSelection,
} from '../../components/camera-event-timeline/camera-event-timeline.component';
import { CameraService } from '../../services/camera.service';

interface CameraEventRow {
  event_id: string;
  camera_id: string;
  created_at: string;
  type: string;
  status: string;
  track_id: number | null;
  zone_id: string | null;
  identity_id: string | null;
  label: string | null;
  duration_sec: number | null;
  alert_type: string | null;
  severity: string | null;
  alert_message: string | null;
  evidence_path: string | null;
  risk_score: number | null;
}

@Component({
  selector: 'app-camera-detail',
  standalone: true,
  imports: [
    DecimalPipe,
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatTableModule,
    MatTooltipModule,
    StatusBadgeComponent,
    CameraEventTimelineComponent,
    CameraStateColorPipe,
    CameraStateLabelPipe,
    UptimePipe,
  ],
  templateUrl: './camera-detail.component.html',
  styleUrl: './camera-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CameraDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cameraService = inject(CameraService);
  private readonly ws = inject(WebSocketService);

  readonly R = R;

  readonly cameraId = signal('');
  readonly camera = signal<CameraStatus | null>(null);
  readonly events = signal<CameraEventRow[]>([]);
  readonly eventsTotal = signal(0);
  readonly eventsPageSize = signal(20);
  readonly eventsPageIndex = signal(0);
  readonly searchTerm = signal('');
  readonly timelineExpanded = signal(true);
  readonly eventsExpanded = signal(true);
  readonly timelineFocusedEventId = signal<string | null>(null);
  readonly timelineFocusedEvidenceEventId = signal<string | null>(null);
  readonly timelinePlayheadTimeMs = signal<number | null>(null);
  readonly videoFrame = viewChild<ElementRef>('videoFrame');
  readonly isFullscreen = signal(false);
  readonly eventColumns = ['status', 'type', 'details', 'evidence', 'created_at'];

  readonly isOfficeCamera = computed(() => this.camera()?.backend === 'office');
  readonly isRunning = computed(() => this.camera()?.state === 'running');
  readonly isStopped = computed(() => this.camera()?.state === 'stopped');
  readonly isRestartable = computed(() => {
    const state = this.camera()?.state;
    return state === 'error' || state === 'parked' || state === 'retrying';
  });
  readonly isLive = computed(() => !!this.liveFrameUrl());

  readonly snapshotUrl = computed(() => {
    const cam = this.camera();
    if (!cam || (cam.state === 'stopped' && !cam.last_frame_at)) {
      return null;
    }
    const cacheBuster = cam.last_frame_at || Date.now();
    return `/api/cameras/${cam.camera_id}/snapshot?w=960&t=${cacheBuster}`;
  });
  readonly displayUrl = computed(() => this.liveFrameUrl() ?? this.snapshotUrl());

  readonly uniquePersons = computed(() => {
    const ids = new Set(this.events().map((event) => event.track_id).filter((id) => id != null));
    return ids.size;
  });

  readonly evidenceCount = computed(
    () => this.events().filter((event) => !!event.evidence_path).length
  );

  readonly alertCount = computed(
    () => this.events().filter((event) => event.type === 'alert.raised').length
  );

  readonly presenceCount = computed(
    () => this.events().filter((event) => event.type.startsWith('presence.')).length
  );

  readonly filteredEvents = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) {
      return this.events();
    }
    return this.events().filter((event) => this.eventSearchText(event).includes(term));
  });

  readonly latestEvidenceEvent = computed(
    () => this.events().find((event) => !!event.evidence_path) ?? null
  );

  readonly focusedTimelineEvent = computed(() => {
    const eventId = this.timelineFocusedEventId();
    return eventId ? this.events().find((event) => event.event_id === eventId) ?? null : null;
  });

  readonly focusedTimelineEvidenceEvent = computed(() => {
    const eventId = this.timelineFocusedEvidenceEventId();
    return eventId ? this.events().find((event) => event.event_id === eventId) ?? null : null;
  });

  readonly displayEvidenceEvent = computed(
    () => this.focusedTimelineEvidenceEvent() ?? this.latestEvidenceEvent()
  );

  readonly evidenceCardTitle = computed(() =>
    this.focusedTimelineEvidenceEvent() ? 'Evidência em foco' : 'Última evidência'
  );

  readonly timelineSummary = computed(() => {
    const active = this.focusedTimelineEvent() ?? this.displayEvidenceEvent();
    if (!active) {
      return 'Aguardando eventos persistidos';
    }
    return `${this.eventTypeLabel(active.type)} · ${this.formatCompactTimestamp(active.created_at)}`;
  });

  readonly eventsSummary = computed(() => {
    const filtered = this.filteredEvents().length;
    return `${filtered} itens · ${this.alertCount()} alertas · ${this.evidenceCount()} snapshots`;
  });

  readonly latestPresenceUpdate = computed(
    () => this.events().find((event) => event.type === 'presence.updated') ?? null
  );

  snapshotError = false;
  readonly liveFrameUrl = signal<string | null>(null);

  private eventsPollTimer: ReturnType<typeof setInterval> | null = null;
  private wsSub: Subscription | null = null;
  private frameSub: Subscription | null = null;

  ngOnInit(): void {
    this.cameraId.set(this.route.snapshot.paramMap.get('id') || '');
    this.loadCamera();

    this.wsSub = this.ws.messages$
      ?.pipe(filter((msg: WsMessage) => msg.type === 'camera_list'))
      .subscribe({
        next: (msg) => {
          const statuses = msg.payload as CameraStatus[];
          const camera = statuses.find((item) => item.camera_id === this.cameraId());
          if (camera) {
            this.camera.set(camera);
          }
        },
      });

    this.eventsPollTimer = setInterval(() => this.loadEvents(), 10_000);
    this.startFrameStream();

    this.destroyRef.onDestroy(() => this.cleanup());
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  onEventsPage(event: PageEvent): void {
    this.eventsPageIndex.set(event.pageIndex);
    this.eventsPageSize.set(event.pageSize);
    this.loadEvents();
  }

  toggleTimelineExpanded(): void {
    this.timelineExpanded.update((value) => !value);
  }

  toggleEventsExpanded(): void {
    this.eventsExpanded.update((value) => !value);
  }

  onTimelineSelection(selection: CameraTimelineSelection): void {
    this.timelineFocusedEventId.set(selection.activeEventId);
    this.timelineFocusedEvidenceEventId.set(selection.highlightedEvidenceEventId);
    this.timelinePlayheadTimeMs.set(selection.playheadTimeMs);
  }

  onStart(): void {
    this.cameraService.startCamera(this.cameraId());
    setTimeout(() => this.loadCamera(), 1000);
  }

  onStop(): void {
    this.cameraService.stopCamera(this.cameraId());
    setTimeout(() => this.loadCamera(), 1000);
  }

  onRestart(): void {
    this.cameraService.restartCamera(this.cameraId());
    setTimeout(() => this.loadCamera(), 1000);
  }

  onEdit(): void {
    const camera = this.camera();
    if (!camera) {
      return;
    }

    this.http.get<CameraStatus>(`/api/cameras/${this.cameraId()}`).subscribe({
      next: (status) => {
        const dialogRef = this.dialog.open(CameraEditDialogComponent, {
          panelClass: 'refine-dialog-panel',
          data: { mode: 'edit', config: status },
        });

        dialogRef.afterClosed().subscribe((result) => {
          if (!result) {
            return;
          }
          this.cameraService.updateCamera(this.cameraId(), result);
          setTimeout(() => this.loadCamera(), 1000);
        });
      },
    });
  }

  onSnapshotLoad(): void {
    this.snapshotError = false;
  }

  onSnapshotError(): void {
    this.snapshotError = true;
  }

  onExportCsv(): void {
    const rows = this.filteredEvents();
    if (!rows.length) {
      return;
    }

    const headers = [
      'status',
      'type',
      'zone_id',
      'track_id',
      'label',
      'duration_sec',
      'alert_type',
      'severity',
      'evidence_path',
      'created_at',
    ];
    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        headers
          .map((header) => this.csvValue(this.csvField(row, header)))
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `events_${this.cameraId()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  onReportFalsePositive(): void {
    // TODO: implement false positive reporting workflow
  }

  onToggleFullscreen(): void {
    const element = this.videoFrame()?.nativeElement;
    if (!element) {
      return;
    }

    if (!document.fullscreenElement) {
      element.requestFullscreen().then(() => this.isFullscreen.set(true));
      return;
    }

    document.exitFullscreen().then(() => this.isFullscreen.set(false));
  }

  openEvidence(path: string | null | undefined): void {
    const url = this.evidenceUrl(path);
    if (!url) {
      return;
    }
    window.open(url, '_blank', 'noopener');
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

  eventTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      'presence.started': 'login',
      'presence.updated': 'schedule',
      'presence.ended': 'logout',
      'alert.raised': 'warning',
    };
    return icons[type] ?? 'bolt';
  }

  eventStatusLabel(event: CameraEventRow): string {
    if (event.type === 'alert.raised') {
      return 'Alerta';
    }
    if (event.type === 'presence.updated') {
      return 'Permanencia';
    }
    if (event.type === 'presence.started') {
      return 'Entrada';
    }
    if (event.type === 'presence.ended') {
      return 'Saida';
    }
    return event.status === 'alert' ? 'Alerta' : 'Evento';
  }

  eventStatusClass(event: CameraEventRow): string {
    if (event.type === 'alert.raised') {
      return 'chip-alert';
    }
    if (event.type === 'presence.updated') {
      return 'chip-presence';
    }
    if (event.type === 'presence.started') {
      return 'chip-entry';
    }
    return 'chip-neutral';
  }

  detailTitle(event: CameraEventRow): string {
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
    return 'Sem detalhe adicional';
  }

  detailMeta(event: CameraEventRow): string {
    const parts: string[] = [];
    if (event.track_id != null) {
      parts.push(`Track ${event.track_id}`);
    }
    if (event.identity_id) {
      parts.push(event.identity_id);
    }
    if (event.duration_sec != null && event.duration_sec > 0) {
      parts.push(this.formatDuration(event.duration_sec));
    }
    if (event.severity) {
      parts.push(`Sev. ${event.severity}`);
    }
    if (event.risk_score != null) {
      parts.push(`Risco ${event.risk_score}`);
    }
    return parts.join(' · ') || 'Sem metadados adicionais';
  }

  evidenceUrl(path: string | null | undefined): string | null {
    return path ? `/api/files/serve/${path}` : null;
  }

  formatDuration(durationSec: number | null | undefined): string {
    if (!durationSec) {
      return '—';
    }
    if (durationSec < 60) {
      return `${Math.round(durationSec)}s`;
    }
    const minutes = Math.floor(durationSec / 60);
    const seconds = Math.round(durationSec % 60);
    return `${minutes}m ${seconds}s`;
  }

  formatCompactTimestamp(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }

    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  private loadCamera(): void {
    const id = this.cameraId();
    if (!id) {
      return;
    }

    this.http.get<CameraStatus>(`/api/cameras/${id}`).subscribe({
      next: (data) => {
        this.camera.set(data);
        this.eventsTotal.set(data.events_total);
        this.loadEvents();
      },
    });
  }

  private loadEvents(): void {
    const id = this.cameraId();
    if (!id) {
      return;
    }

    if (this.isOfficeCamera()) {
      let params = new HttpParams()
        .set('page', this.eventsPageIndex() + 1)
        .set('limit', this.eventsPageSize())
        .set('camera_id', id);
      this.http.get<PaginatedOfficeEvents>('/api/office/events', { params }).subscribe({
        next: (data) => {
          this.events.set(data.items.map((item) => this.mapOfficeEvent(item)));
          this.eventsTotal.set(data.total);
        },
      });
      return;
    }

    const limit = this.eventsPageSize();
    const offset = this.eventsPageIndex() * limit;
    this.http
      .get<CameraEventRow[]>(`/api/cameras/${id}/events?limit=${limit}&offset=${offset}`)
      .subscribe({
        next: (data) => {
          this.events.set(data);
          this.eventsTotal.set(this.camera()?.events_total ?? data.length);
        },
      });
  }

  private mapOfficeEvent(item: OfficeEventItem): CameraEventRow {
    return {
      event_id: item.event_id,
      camera_id: item.camera_id,
      created_at: item.timestamp_utc,
      type: item.event_type,
      status: item.event_type === 'alert.raised' ? 'alert' : 'info',
      track_id: item.track_id,
      zone_id: item.zone_id,
      identity_id: item.identity_id,
      label: item.label,
      duration_sec: item.duration_sec,
      alert_type: item.alert_type,
      severity: item.severity,
      alert_message: item.alert_message,
      evidence_path: item.evidence_path,
      risk_score: null,
    };
  }

  private eventSearchText(event: CameraEventRow): string {
    return [
      event.type,
      event.zone_id,
      event.label,
      event.identity_id,
      event.alert_type,
      event.alert_message,
      event.severity,
      event.track_id,
      event.created_at,
    ]
      .filter((value) => value != null)
      .join(' ')
      .toLowerCase();
  }

  private csvValue(value: unknown): string {
    const normalized = String(value ?? '').replace(/"/g, '""');
    return `"${normalized}"`;
  }

  private csvField(row: CameraEventRow, header: string): unknown {
    return (row as unknown as Record<string, unknown>)[header];
  }

  private startFrameStream(): void {
    const id = this.cameraId();
    if (!id) {
      return;
    }

    this.frameSub = this.ws.openFrameStream(id).subscribe({
      next: (url) => this.liveFrameUrl.set(url),
      complete: () => {
        this.liveFrameUrl.set(null);
        this.frameSub = null;
      },
      error: () => {
        this.liveFrameUrl.set(null);
        this.frameSub = null;
      },
    });
  }

  private cleanup(): void {
    if (this.eventsPollTimer) {
      clearInterval(this.eventsPollTimer);
      this.eventsPollTimer = null;
    }
    this.wsSub?.unsubscribe();
    this.wsSub = null;
    this.frameSub?.unsubscribe();
    this.frameSub = null;
  }
}
