import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

export interface CameraEditDialogData {
  mode: 'create' | 'edit';
  config?: any;
}

@Component({
  selector: 'app-camera-edit-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatExpansionModule,
    MatSlideToggleModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ isEditMode ? 'Editar Câmera' : 'Nova Câmera' }}</h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <!-- Basic fields (always visible) -->
        <mat-form-field appearance="outline">
          <mat-label>ID da Câmera</mat-label>
          <input matInput formControlName="camera_id" placeholder="cam_entrada_01" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Fonte (URL / arquivo)</mat-label>
          <input matInput formControlName="source" placeholder="rtsp://..." />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Tipo de Fonte</mat-label>
          <mat-select formControlName="source_type">
            <mat-option value="rtsp">RTSP</mat-option>
            <mat-option value="file">Arquivo</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>FPS Alvo</mat-label>
          <input matInput type="number" formControlName="fps_target" />
        </mat-form-field>

        <!-- Advanced fields -->
        <mat-expansion-panel class="advanced-panel">
          <mat-expansion-panel-header>
            <mat-panel-title>Configurações Avançadas</mat-panel-title>
          </mat-expansion-panel-header>

          <div class="advanced-fields">
            <mat-form-field appearance="outline">
              <mat-label>Backend</mat-label>
              <mat-select formControlName="backend">
                <mat-option value="fsps">FSPS</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Modelo YOLO</mat-label>
              <input matInput formControlName="yolo_model" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Conf Threshold (0-1)</mat-label>
              <input matInput type="number" formControlName="conf_threshold" step="0.05" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>IoU Threshold (0-1)</mat-label>
              <input matInput type="number" formControlName="iou_threshold" step="0.05" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Alert Threshold</mat-label>
              <input matInput type="number" formControlName="alert_threshold" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Hysteresis Frames</mat-label>
              <input matInput type="number" formControlName="hysteresis_frames" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Cooldown Frames</mat-label>
              <input matInput type="number" formControlName="cooldown_frames" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Device</mat-label>
              <mat-select formControlName="device">
                <mat-option value="cuda">CUDA</mat-option>
                <mat-option value="cpu">CPU</mat-option>
                <mat-option value="auto">Auto</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-slide-toggle formControlName="half">FP16 (Half Precision)</mat-slide-toggle>
          </div>
        </mat-expansion-panel>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="form.invalid"
        (click)="onSubmit()">
        {{ isEditMode ? 'Salvar' : 'Registrar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .dialog-form {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      min-width: 400px;
    }

    .advanced-panel {
      margin-top: 0.5rem;
    }

    .advanced-fields {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding-top: 0.5rem;
    }
  `,
})
export class CameraEditDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<CameraEditDialogComponent>);
  private readonly data = inject<CameraEditDialogData>(MAT_DIALOG_DATA, { optional: true });

  readonly isEditMode = this.data?.mode === 'edit';

  readonly form = this.fb.nonNullable.group({
    camera_id: [
      { value: this.data?.config?.camera_id || '', disabled: this.isEditMode },
      Validators.required,
    ],
    source: [this.data?.config?.source || '', Validators.required],
    source_type: [
      (this.data?.config?.source_type || 'rtsp') as 'rtsp' | 'file',
      Validators.required,
    ],
    fps_target: [
      this.data?.config?.fps_target ?? 10,
      [Validators.required, Validators.min(1), Validators.max(60)],
    ],
    backend: [this.data?.config?.backend || 'fsps'],
    yolo_model: [this.data?.config?.yolo_model || 'yolov8n.pt'],
    conf_threshold: [
      this.data?.config?.conf_threshold ?? 0.35,
      [Validators.min(0), Validators.max(1)],
    ],
    iou_threshold: [
      this.data?.config?.iou_threshold ?? 0.45,
      [Validators.min(0), Validators.max(1)],
    ],
    alert_threshold: [this.data?.config?.alert_threshold ?? 45],
    hysteresis_frames: [this.data?.config?.hysteresis_frames ?? 10, Validators.min(0)],
    cooldown_frames: [this.data?.config?.cooldown_frames ?? 60, Validators.min(0)],
    device: [this.data?.config?.device || 'cuda'],
    half: [this.data?.config?.half ?? true],
  });

  onSubmit(): void {
    if (this.form.valid) {
      this.dialogRef.close(this.form.getRawValue());
    }
  }
}
