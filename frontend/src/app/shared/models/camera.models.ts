export type CameraState = 'stopped' | 'starting' | 'running' | 'error' | 'retrying' | 'parked';

export type SourceType = 'rtsp' | 'file';

export interface CameraConfig {
  camera_id: string;
  source: string;
  source_type: SourceType;
  backend: string;
  enabled: boolean;
  fps_target: number;
  yolo_model: string;
  conf_threshold: number;
  iou_threshold: number;
  alert_threshold: number;
  hysteresis_frames: number;
  cooldown_frames: number;
  zone_config_path: string | null;
  half: boolean;
  device: string;
}

export interface CameraStatus {
  camera_id: string;
  state: CameraState;
  backend: string;
  fps_current: number;
  fps_target: number;
  detect_ms_avg: number;
  tracks_active: number;
  events_total: number;
  evidence_queue_depth: number;
  last_frame_at: string | null;
  error_message: string | null;
  retry_count: number;
  uptime_sec: number;
  started_at: string | null;
}

export interface NetworkInterfaceIO {
  name: string;
  bytes_sent: number;
  bytes_recv: number;
}

export interface HealthReport {
  edge_id: string;
  timestamp_utc: string;
  uptime_hours: number;
  cpu_percent: number;
  per_cpu_percent: number[];
  cpu_freq_mhz: number | null;
  process_count: number | null;
  ram_used_mb: number;
  ram_total_mb: number;
  gpu_util_percent: number | null;
  gpu_temp_celsius: number | null;
  gpu_name: string | null;
  gpu_driver_version: string | null;
  vram_used_mb: number | null;
  vram_total_mb: number | null;
  disk_used_gb: number;
  disk_total_gb: number;
  disk_io_read_mb: number | null;
  disk_io_write_mb: number | null;
  network_interfaces: NetworkInterfaceIO[];
  net_bytes_sent_total: number;
  net_bytes_recv_total: number;
  cameras: CameraStatus[];
  model_version: string;
  config_version: string;
}

export interface ClientProfile {
  client_id: string;
  client_name: string;
  store_name: string;
  card_variant: 'full' | 'compact' | 'minimal';
  logo_url: string | null;
  features: ClientFeatures;
  pipeline_defaults?: {
    backend: string;
    yolo_model: string;
    fps_target: number;
    conf_threshold: number;
  };
  alerts?: {
    risk_score_min: number;
    cpu_warn_percent: number;
    gpu_temp_warn_celsius: number;
    vram_warn_percent: number;
  };
}

export interface ClientFeatures {
  live_preview: boolean;
  gpu_dashboard: boolean;
  export_audit: boolean;
  multi_backend: boolean;
  alert_sound: boolean;
}
