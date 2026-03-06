import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  OfficeEventItem,
  OccupancyItem,
  OfficeStats,
  PaginatedOfficeEvents,
  PresenceZoneHighlight,
} from '../../../shared/models/office.models';

@Injectable({ providedIn: 'root' })
export class OfficeService {
  private readonly http = inject(HttpClient);

  readonly occupancy = signal<OccupancyItem[]>([]);
  readonly stats = signal<OfficeStats | null>(null);
  readonly presenceEvents = signal<PaginatedOfficeEvents | null>(null);
  readonly presenceZoneHighlights = signal<PresenceZoneHighlight[]>([]);
  readonly alertEvents = signal<PaginatedOfficeEvents | null>(null);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly presenceHighlightsLoading = signal(false);

  readonly totalPresent = computed(() =>
    this.occupancy().reduce((sum, z) => sum + z.count, 0)
  );
  readonly zonesOverCapacity = computed(() =>
    this.occupancy().filter(z => z.over_capacity).length
  );

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private pollConsumers = 0;

  loadOccupancy(cameraId?: string): void {
    let params = new HttpParams();
    if (cameraId) params = params.set('camera_id', cameraId);
    this.http.get<OccupancyItem[]>('/api/office/occupancy', { params }).subscribe({
      next: data => this.occupancy.set(data),
      error: err => this.error.set(err.error?.detail ?? 'Erro ao carregar ocupação'),
    });
  }

  loadStats(cameraId?: string): void {
    let params = new HttpParams();
    if (cameraId) params = params.set('camera_id', cameraId);
    this.http.get<OfficeStats>('/api/office/events/stats', { params }).subscribe({
      next: data => this.stats.set(data),
      error: err => this.error.set(err.error?.detail ?? 'Erro ao carregar estatísticas'),
    });
  }

  loadPresenceEvents(page = 1, limit = 50, cameraId?: string, zoneId?: string): void {
    let params = new HttpParams()
      .set('page', page)
      .set('limit', limit)
      .set('event_prefix', 'presence.');
    if (cameraId) params = params.set('camera_id', cameraId);
    if (zoneId) params = params.set('zone_id', zoneId);
    this.http.get<PaginatedOfficeEvents>('/api/office/events', { params }).subscribe({
      next: data => this.presenceEvents.set(data),
      error: err => this.error.set(err.error?.detail ?? 'Erro ao carregar presenças'),
    });
  }

  loadPresenceHighlights(limit = 200): void {
    const params = new HttpParams()
      .set('page', 1)
      .set('limit', limit)
      .set('event_type', 'presence.started');

    this.presenceHighlightsLoading.set(true);

    this.http.get<PaginatedOfficeEvents>('/api/office/events', { params }).subscribe({
      next: data => {
        this.presenceZoneHighlights.set(this.buildPresenceZoneHighlights(data.items));
        this.presenceHighlightsLoading.set(false);
      },
      error: err => {
        this.error.set(err.error?.detail ?? 'Erro ao carregar destaques de presença');
        this.presenceHighlightsLoading.set(false);
      },
    });
  }

  loadAlerts(page = 1, limit = 50, cameraId?: string): void {
    let params = new HttpParams()
      .set('page', page)
      .set('limit', limit);
    if (cameraId) params = params.set('camera_id', cameraId);
    this.http.get<PaginatedOfficeEvents>('/api/office/alerts', { params }).subscribe({
      next: data => this.alertEvents.set(data),
      error: err => this.error.set(err.error?.detail ?? 'Erro ao carregar alertas'),
    });
  }

  startPolling(intervalMs = 15000): void {
    this.pollConsumers += 1;
    if (this.pollTimer) {
      return;
    }

    this.loadOccupancy();
    this.loadStats();
    this.loadPresenceHighlights();
    this.pollTimer = setInterval(() => {
      this.loadOccupancy();
      this.loadStats();
      this.loadPresenceHighlights();
    }, intervalMs);
  }

  stopPolling(): void {
    this.pollConsumers = Math.max(0, this.pollConsumers - 1);
    if (this.pollConsumers > 0) {
      return;
    }

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private buildPresenceZoneHighlights(items: OfficeEventItem[]): PresenceZoneHighlight[] {
    const highlights = new Map<string, PresenceZoneHighlight>();

    for (const item of items) {
      const zoneId = item.zone_id?.trim();
      if (!zoneId) continue;

      const current = highlights.get(zoneId);
      if (!current) {
        highlights.set(zoneId, {
          zone_id: zoneId,
          camera_id: item.camera_id,
          entries: 1,
          last_seen: item.timestamp_utc,
        });
        continue;
      }

      current.entries += 1;
      if (item.timestamp_utc > current.last_seen) {
        current.last_seen = item.timestamp_utc;
        current.camera_id = item.camera_id;
      }
    }

    return Array.from(highlights.values())
      .sort((a, b) => b.entries - a.entries || b.last_seen.localeCompare(a.last_seen));
  }
}
