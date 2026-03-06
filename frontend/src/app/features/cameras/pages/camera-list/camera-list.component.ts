import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog } from '@angular/material/dialog';
import { CameraService } from '../../services/camera.service';
import { CameraCardComponent } from '../../components/camera-card/camera-card.component';
import {
  CameraFilterBarComponent,
  CameraFilter,
} from '../../components/camera-filter-bar/camera-filter-bar.component';
import { CameraEditDialogComponent } from '../../components/camera-edit-dialog/camera-edit-dialog.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { CameraStatus } from '../../../../shared/models/camera.models';

export type SortBy = 'default' | 'state' | 'fps' | 'uptime';

@Component({
  selector: 'app-camera-list',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    CameraCardComponent,
    CameraFilterBarComponent,
    EmptyStateComponent,
  ],
  templateUrl: './camera-list.component.html',
  styleUrl: './camera-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CameraListComponent implements OnInit, OnDestroy {
  readonly cameraService = inject(CameraService);
  private readonly dialog = inject(MatDialog);

  readonly activeFilter = signal<CameraFilter>('all');
  readonly searchTerm = signal('');
  readonly sortBy = signal<SortBy>('default');

  readonly filteredCameras = computed(() => {
    let list = this.cameraService.cameras();
    const filter = this.activeFilter();
    const search = this.searchTerm().toLowerCase().trim();
    const sort = this.sortBy();

    // State filter
    switch (filter) {
      case 'running':
        list = list.filter((c) => c.state === 'running');
        break;
      case 'stopped':
        list = list.filter((c) => c.state === 'stopped');
        break;
      case 'error':
        list = list.filter((c) => c.state === 'error' || c.state === 'parked');
        break;
    }

    // Search filter
    if (search) {
      list = list.filter((c) => c.camera_id.toLowerCase().includes(search));
    }

    // Sort
    switch (sort) {
      case 'state':
        list = [...list].sort((a, b) => a.state.localeCompare(b.state));
        break;
      case 'fps':
        list = [...list].sort((a, b) => (b.fps_current ?? 0) - (a.fps_current ?? 0));
        break;
      case 'uptime':
        list = [...list].sort((a, b) => (b.uptime_sec ?? 0) - (a.uptime_sec ?? 0));
        break;
    }

    return list;
  });

  ngOnInit(): void {
    this.cameraService.startLive();
  }

  ngOnDestroy(): void {
    this.cameraService.stopLive();
  }

  onFilterChange(filter: CameraFilter): void {
    this.activeFilter.set(filter);
  }

  onSearchChange(term: string): void {
    this.searchTerm.set(term);
  }

  onSortChange(sort: SortBy): void {
    this.sortBy.set(sort);
  }

  openRegisterDialog(): void {
    const dialogRef = this.dialog.open(CameraEditDialogComponent, {
      panelClass: 'refine-dialog-panel',
      data: { mode: 'create' },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.cameraService.registerCamera(result);
      }
    });
  }

  onStartAll(): void {
    this.cameraService.startAll();
  }

  onStopAll(): void {
    this.cameraService.stopAll();
  }

  onStartCamera(id: string): void {
    this.cameraService.startCamera(id);
  }

  onStopCamera(id: string): void {
    this.cameraService.stopCamera(id);
  }

  onDeleteCamera(id: string): void {
    this.cameraService.deleteCamera(id);
  }

  onRestartCamera(id: string): void {
    this.cameraService.restartCamera(id);
  }

  trackByCameraId(_index: number, camera: CameraStatus): string {
    return camera.camera_id;
  }
}
