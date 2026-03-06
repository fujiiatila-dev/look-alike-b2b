import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgIf, SlicePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    NgIf, SlicePipe, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatIconModule, MatSnackBarModule
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileComponent {
  readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);

  readonly saving = signal(false);
  readonly user = this.auth.currentUser;

  readonly profileForm = this.fb.nonNullable.group({
    name: [this.auth.currentUser()?.name || '', Validators.required],
    password: [''],
    passwordConfirm: ['']
  });

  save(): void {
    if (this.profileForm.invalid || this.saving()) return;

    const { name, password, passwordConfirm } = this.profileForm.getRawValue();
    if (password && password !== passwordConfirm) {
      this.snackBar.open('As senhas nao coincidem', 'OK', { duration: 3000 });
      return;
    }

    this.saving.set(true);
    const payload: { name?: string; password?: string } = {};
    if (name) payload.name = name;
    if (password) payload.password = password;

    this.auth.updateProfile(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackBar.open('Perfil atualizado com sucesso', 'OK', { duration: 3000 });
        this.profileForm.patchValue({ password: '', passwordConfirm: '' });
      },
      error: () => {
        this.saving.set(false);
        this.snackBar.open('Erro ao atualizar perfil', 'OK', { duration: 3000 });
      }
    });
  }
}
