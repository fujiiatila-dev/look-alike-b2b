import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Inject,
  OnInit,
  inject
} from '@angular/core';
import { ReactiveFormsModule, NonNullableFormBuilder, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, filter, map } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSliderModule } from '@angular/material/slider';
import { MatButtonModule } from '@angular/material/button';
import { RefineSettings } from '../../../../shared/models/event-detail.models';

export interface RefineModalData {
  initialSettings: RefineSettings;
}

@Component({
  selector: 'app-refine-modal',
  standalone: true,
  imports: [ReactiveFormsModule, MatDialogModule, MatSliderModule, MatButtonModule],
  templateUrl: './refine-modal.component.html',
  styleUrl: './refine-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RefineModalComponent implements OnInit {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  private readonly submitClicks$ = new Subject<void>();

  readonly form = this.formBuilder.group({
    confidence: [0.55, [Validators.required, Validators.min(0.1), Validators.max(0.99)]],
    fps: [5, [Validators.required, Validators.min(1), Validators.max(30)]],
    threshold: [50, [Validators.required, Validators.min(10), Validators.max(150)]]
  });

  constructor(
    private readonly dialogRef: MatDialogRef<RefineModalComponent, RefineSettings>,
    @Inject(MAT_DIALOG_DATA) public readonly data: RefineModalData
  ) {}

  ngOnInit(): void {
    this.form.patchValue(this.data.initialSettings);

    this.submitClicks$
      .pipe(
        debounceTime(220),
        filter(() => this.form.valid),
        map(() => this.form.getRawValue()),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((settings) => this.dialogRef.close(settings));
  }

  close(): void {
    this.dialogRef.close();
  }

  queueSubmit(): void {
    this.submitClicks$.next();
  }
}
