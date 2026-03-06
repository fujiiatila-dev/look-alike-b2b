import { ChangeDetectionStrategy, Component, signal, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuthService } from '../../core/auth/auth.service';
import { R } from '../../shared/utils/client-routes';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    NgIf, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatIconModule, MatProgressBarModule
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly errorMessage = signal('');
  hidePassword = true;

  readonly loginForm = this.fb.nonNullable.group({
    email: ['admin@freedom-ia.com', [Validators.required, Validators.email]],
    password: ['admin123', [Validators.required, Validators.minLength(4)]]
  });

  constructor() {
    if (this.auth.isAuthenticated()) {
      this.router.navigate([R.dashboard]);
    }
  }

  onSubmit(): void {
    if (this.loginForm.invalid || this.loading()) return;

    this.loading.set(true);
    this.errorMessage.set('');

    this.auth.login(this.loginForm.getRawValue()).subscribe({
      next: () => this.router.navigate([R.dashboard]),
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(err?.error?.detail || 'Erro ao fazer login');
      }
    });
  }
}
