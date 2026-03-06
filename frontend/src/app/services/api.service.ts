import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AnnotationResponse {
    annotation_id: string;
    event_id: string;
    label: string;
    start_sec: number;
    end_sec: number;
    created_at: string;
    created_by: string;
}

export interface InboxFile {
    filename: string;
    size: number;
    modified: number;
}

export interface VideoMetadataResponse {
    duration_s: number;
    avg_fps: number;
    r_fps: number;
    is_vfr_suspected: boolean;
    fps_for_snap: number | null;
}

export interface EventListItem {
    event_id: string;
    type: string;
    created_at: string;
    status: string;
    notes?: string;
    source_path: string;
    clip_path: string;
    redacted_clip_path?: string;
    best_label?: string;
    fsps_event_id?: string;
    camera_id?: string;
    risk_score?: number;
}

export interface PaginatedEvents {
    items: EventListItem[];
    total: number;
    page: number;
    limit: number;
}

export interface EventResponse {
    event_id: string;
    type: string;
    created_at: string;
    status: string;
    notes?: string;
    source_path: string;
    clip_path: string;
    redacted_clip_path?: string;
    annotations: AnnotationResponse[];
    fsps_event_id?: string;
    camera_id?: string;
    source_video?: string;
    track_id?: number;
    timestamp_utc?: string;
    risk_score?: number;
    risk_factors?: string[];
    zone_history?: string[];
    time_in_zone_sec?: Record<string, number>;
    evidence_paths?: string[];
    evidence_hashes?: Record<string, string>;
}

@Injectable({
    providedIn: 'root'
})
export class ApiService {

    constructor(private http: HttpClient) { }

    getEvents(page = 1, limit = 50, type?: string, search?: string, sort?: string): Observable<PaginatedEvents> {
        let params = `?page=${page}&limit=${limit}`;
        if (type) params += `&type=${type}`;
        if (search) params += `&search=${encodeURIComponent(search)}`;
        if (sort) params += `&sort=${sort}`;
        return this.http.get<PaginatedEvents>(`/api/events${params}`);
    }

    getEvent(id: string): Observable<EventResponse> {
        return this.http.get<EventResponse>(`/api/events/${id}`);
    }

    getInboxFiles(): Observable<InboxFile[]> {
        return this.http.get<InboxFile[]>('/api/files/inbox');
    }

    getVideoMeta(path: string): Observable<VideoMetadataResponse> {
        return this.http.get<VideoMetadataResponse>(`/api/video/meta?path=${encodeURIComponent(path)}`);
    }

    createManualEvent(filename: string): Observable<EventResponse> {
        return this.http.post<EventResponse>('/api/events/manual', { filename });
    }

    annotateEvent(
        eventId: string,
        label: string,
        start_sec: number,
        end_sec: number,
        created_by?: string
    ): Observable<EventResponse> {
        return this.http.post<EventResponse>(`/api/events/${eventId}/annotate`, {
            label, start_sec, end_sec, created_by
        });
    }

    triggerBlur(eventId: string): Observable<any> {
        return this.http.post(`/api/events/${eventId}/blur`, {});
    }

    triggerExport(eventId: string): Observable<any> {
        return this.http.post(`/api/events/${eventId}/export`, {});
    }

    getExports(): Observable<any[]> {
        return this.http.get<any[]>('/api/events/list/exports');
    }

    getEventMetrics(eventId: string): Observable<any[]> {
        return this.http.get<any[]>(`/api/events/${eventId}/metrics`);
    }

    reprocessEvent(eventId: string, params: { conf: number, fps: number, alert_threshold: number }): Observable<any> {
        return this.http.post(`/api/events/${eventId}/reprocess`, params);
    }
}
