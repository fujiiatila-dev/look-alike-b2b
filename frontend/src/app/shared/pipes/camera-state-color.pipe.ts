import { Pipe, PipeTransform } from '@angular/core';
import { CameraState } from '../models/camera.models';

const STATE_COLORS: Record<CameraState, string> = {
  running: 'var(--accent-green)',
  starting: 'var(--accent-yellow)',
  stopped: 'var(--edge-muted)',
  error: 'var(--accent-red)',
  retrying: 'var(--accent-yellow)',
  parked: 'var(--edge-muted)',
};

@Pipe({ name: 'cameraStateColor', standalone: true })
export class CameraStateColorPipe implements PipeTransform {
  transform(value: CameraState | string | null | undefined): string {
    if (!value) return 'var(--edge-muted)';
    return STATE_COLORS[value as CameraState] ?? 'var(--edge-muted)';
  }
}
