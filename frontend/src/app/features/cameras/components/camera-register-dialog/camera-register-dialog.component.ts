import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-camera-register-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Nova Câmera</h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
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
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="form.invalid"
        (click)="onSubmit()">
        Registrar
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .dialog-form {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      min-width: 360px;
    }
  `,
})
export class CameraRegisterDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<CameraRegisterDialogComponent>);

  readonly form = this.fb.nonNullable.group({
    camera_id: ['', Validators.required],
    source: ['', Validators.required],
    source_type: ['rtsp' as 'rtsp' | 'file', Validators.required],
    fps_target: [10, [Validators.required, Validators.min(1), Validators.max(60)]],
  });

  onSubmit(): void {
    if (this.form.valid) {
      this.dialogRef.close(this.form.getRawValue());
    }
  }
}
