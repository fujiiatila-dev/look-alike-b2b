import { Pipe, PipeTransform } from '@angular/core';
import { CameraState } from '../models/camera.models';

const STATE_LABELS: Record<CameraState, string> = {
  running: 'Ativa',
  starting: 'Iniciando',
  stopped: 'Parada',
  error: 'Erro',
  retrying: 'Reconectando',
  parked: 'Estacionada',
};

@Pipe({ name: 'cameraStateLabel', standalone: true })
export class CameraStateLabelPipe implements PipeTransform {
  transform(value: CameraState | string | null | undefined): string {
    if (!value) return '--';
    return STATE_LABELS[value as CameraState] ?? value;
  }
}
