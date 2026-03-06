export interface OfficeEventItem {
  office_event_row_id: number | null;
  event_id: string;
  event_type: string;
  camera_id: string;
  track_id: number | null;
  zone_id: string | null;
  identity_id: string | null;
  label: string | null;
  duration_sec: number | null;
  alert_type: string | null;
  severity: string | null;
  alert_message: string | null;
  evidence_path: string | null;
  timestamp_utc: string;
  persisted_at: string;
}

export interface PaginatedOfficeEvents {
  items: OfficeEventItem[];
  total: number;
  page: number;
  limit: number;
}

export interface OccupancyItem {
  camera_id: string;
  zone_id: string;
  count: number;
  capacity: number;
  over_capacity: boolean;
  last_updated: string;
}

export interface OfficeStats {
  total_events: number;
  by_type: Record<string, number>;
  by_camera: Record<string, number>;
  cameras_over_capacity: number;
}

export interface PresenceZoneHighlight {
  zone_id: string;
  camera_id: string;
  entries: number;
  last_seen: string;
}
