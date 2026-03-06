import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, switchMap } from 'rxjs';
import { User, LoginRequest, LoginResponse, RegisterRequest } from './auth.models';
import { ClientContextService } from '../client/client-context.service';
import { R } from '../../shared/utils/client-routes';

const TOKEN_KEY = 'freedom_ia_token';
const USER_KEY = 'freedom_ia_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly clientCtx = inject(ClientContextService);

  private readonly _currentUser = signal<User | null>(null);
  private readonly _token = signal<string | null>(null);

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => !!this._token());
  readonly isAdmin = computed(() => this._currentUser()?.role === 'admin');

  constructor() {
    this.loadFromStorage();
  }

  login(req: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>('/api/auth/login', req).pipe(
      tap(res => {
        this._token.set(res.access_token);
        this._currentUser.set(res.user);
        localStorage.setItem(TOKEN_KEY, res.access_token);
        localStorage.setItem(USER_KEY, JSON.stringify(res.user));
      }),
      switchMap(res => this.clientCtx.loadContext().pipe(
        tap({ error: () => {} }),
        switchMap(() => [res])
      ))
    );
  }

  logout(): void {
    this._token.set(null);
    this._currentUser.set(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.router.navigate([R.login]);
  }

  register(req: RegisterRequest): Observable<User> {
    return this.http.post<User>('/api/auth/register', req);
  }

  getProfile(): Observable<User> {
    return this.http.get<User>('/api/auth/me').pipe(
      tap(user => this._currentUser.set(user))
    );
  }

  updateProfile(data: { name?: string; password?: string }): Observable<User> {
    return this.http.put<User>('/api/auth/me', data).pipe(
      tap(user => {
        this._currentUser.set(user);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      })
    );
  }

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>('/api/auth/users');
  }

  toggleUserActive(userId: string): Observable<{ user_id: string; is_active: boolean }> {
    return this.http.put<{ user_id: string; is_active: boolean }>(`/api/auth/users/${userId}/toggle`, {});
  }

  deleteUser(userId: string): Observable<{ deleted: boolean; user_id: string }> {
    return this.http.delete<{ deleted: boolean; user_id: string }>(`/api/auth/users/${userId}`);
  }

  getToken(): string | null {
    return this._token();
  }

  private loadFromStorage(): void {
    const token = localStorage.getItem(TOKEN_KEY);
    const userJson = localStorage.getItem(USER_KEY);
    if (token && userJson) {
      try {
        this._token.set(token);
        this._currentUser.set(JSON.parse(userJson));
        // Load client context on page refresh
        this.clientCtx.loadContext().subscribe({ error: () => {} });
      } catch {
        this.logout();
      }
    }
  }
}
