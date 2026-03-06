import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { NgIf, NgFor, SlicePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { AuthService } from '../../core/auth/auth.service';
import { User } from '../../core/auth/auth.models';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [
    NgIf, NgFor, SlicePipe, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule,
    MatIconModule, MatSnackBarModule, MatSlideToggleModule
  ],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserManagementComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);

  readonly users = signal<User[]>([]);
  readonly loading = signal(true);
  readonly creating = signal(false);

  readonly registerForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(4)]],
    role: ['analyst', Validators.required]
  });

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.auth.getUsers().subscribe({
      next: users => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onRegister(): void {
    if (this.registerForm.invalid || this.creating()) return;

    this.creating.set(true);
    this.auth.register(this.registerForm.getRawValue()).subscribe({
      next: () => {
        this.creating.set(false);
        this.snackBar.open('Usuario criado com sucesso', 'OK', { duration: 3000 });
        this.registerForm.reset({ name: '', email: '', password: '', role: 'analyst' });
        this.loadUsers();
      },
      error: (err) => {
        this.creating.set(false);
        this.snackBar.open(err?.error?.detail || 'Erro ao criar usuario', 'OK', { duration: 3000 });
      }
    });
  }

  toggleActive(user: User): void {
    this.auth.toggleUserActive(user.user_id).subscribe({
      next: (res) => {
        const updated = this.users().map(u =>
          u.user_id === user.user_id ? { ...u, is_active: res.is_active } : u
        );
        this.users.set(updated);
        this.snackBar.open(
          res.is_active ? 'Usuario ativado' : 'Usuario desativado',
          'OK', { duration: 2000 }
        );
      },
      error: () => this.snackBar.open('Erro ao alterar status', 'OK', { duration: 3000 })
    });
  }

  onDelete(user: User): void {
    if (!confirm(`Tem certeza que deseja excluir o usuario "${user.name}"? Esta acao nao pode ser desfeita.`)) {
      return;
    }
    this.auth.deleteUser(user.user_id).subscribe({
      next: () => {
        this.users.set(this.users().filter(u => u.user_id !== user.user_id));
        this.snackBar.open('Usuario excluido com sucesso', 'OK', { duration: 3000 });
      },
      error: (err) => {
        this.snackBar.open(err?.error?.detail || 'Erro ao excluir usuario', 'OK', { duration: 3000 });
      }
    });
  }

  isSelf(user: User): boolean {
    return user.user_id === this.auth.currentUser()?.user_id;
  }
}
