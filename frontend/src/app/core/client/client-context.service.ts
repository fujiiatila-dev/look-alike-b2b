import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface WhoamiResponse {
  sub: string;
  role: string;
  client_id: string;
  solution_kind: string;
  display_name: string;
}

@Injectable({ providedIn: 'root' })
export class ClientContextService {
  private readonly http = inject(HttpClient);

  readonly context = signal<WhoamiResponse | null>(null);

  loadContext(): Observable<WhoamiResponse> {
    return this.http.get<WhoamiResponse>('/api/auth/whoami').pipe(
      tap(ctx => this.context.set(ctx))
    );
  }
}
