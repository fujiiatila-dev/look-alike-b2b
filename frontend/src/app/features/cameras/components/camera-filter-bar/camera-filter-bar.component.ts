import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

export type CameraFilter = 'all' | 'running' | 'stopped' | 'error';

interface FilterPill {
  key: CameraFilter;
  label: string;
}

@Component({
  selector: 'app-camera-filter-bar',
  standalone: true,
  templateUrl: './camera-filter-bar.component.html',
  styleUrl: './camera-filter-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CameraFilterBarComponent {
  readonly totalCount = input(0);
  readonly runningCount = input(0);
  readonly stoppedCount = input(0);
  readonly errorCount = input(0);

  readonly filterChange = output<CameraFilter>();
  readonly active = signal<CameraFilter>('all');

  readonly pills: FilterPill[] = [
    { key: 'all', label: 'Todas' },
    { key: 'running', label: 'Ativas' },
    { key: 'stopped', label: 'Paradas' },
    { key: 'error', label: 'Erro' },
  ];

  getCount(key: CameraFilter): number {
    switch (key) {
      case 'all':
        return this.totalCount();
      case 'running':
        return this.runningCount();
      case 'stopped':
        return this.stoppedCount();
      case 'error':
        return this.errorCount();
    }
  }

  select(key: CameraFilter): void {
    this.active.set(key);
    this.filterChange.emit(key);
  }
}
