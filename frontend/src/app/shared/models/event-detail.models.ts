export type DetectionSeverity = 'medium' | 'high';

export interface TimeWindow {
  id: string;
  startSec: number;
  endSec: number;
  label?: string;
}

export interface DetectionWindow extends TimeWindow {
  severity: DetectionSeverity;
}

export interface VideoThumbnail {
  id: string;
  atSec: number;
  active?: boolean;
}

export interface EventDetailData {
  eventId: string;
  statusLabel: string;
  sourceFile: string;
  detectedAt: string;
  gtLabel: string;
  gtRangeLabel: string;
  alertTag: string;
  durationSec: number;
  currentTimeSec: number;
  videoUrl: string;
  thumbnails: VideoThumbnail[];
  gtWindows: TimeWindow[];
  detectionsBaseline: DetectionWindow[];
  detectionsRefined: DetectionWindow[];
}

export type MetricFormat = 'percent' | 'seconds' | 'count';

export interface MetricComparison {
  id: 'iou' | 'delay' | 'precision' | 'spam';
  label: string;
  baseline: number;
  refined: number;
  format: MetricFormat;
  higherIsBetter: boolean;
}

export interface CorrelationPanelData {
  metrics: MetricComparison[];
  qualityBaseline: number;
  qualityRefined: number;
  qualityDeltaLabel: string;
  statusLabel: string;
}

export interface RunComparisonRow {
  id: string;
  runLabel: string;
  timestampLabel: string;
  detectionsLabel: string;
  overlapLabel: string;
  delayLabel: string;
}

export interface RefineSettings {
  confidence: number;
  fps: number;
  threshold: number;
}
