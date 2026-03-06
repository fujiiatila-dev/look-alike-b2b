import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { NgIf, NgFor, KeyValuePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuthService } from '../../core/auth/auth.service';
import { R } from '../../shared/utils/client-routes';

interface DashboardStats {
  total_events: number;
  manual_events: number;
  auto_events: number;
  total_exports: number;
  by_status: Record<string, number>;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [NgIf, NgFor, KeyValuePipe, RouterLink, MatIconModule, MatProgressBarModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit {
  private readonly http = inject(HttpClient);
  readonly auth = inject(AuthService);
  readonly R = R;

  readonly stats = signal<DashboardStats | null>(null);
  readonly loading = signal(true);

  ngOnInit(): void {
    this.http.get<DashboardStats>('/api/events/stats').subscribe({
      next: data => {
        this.stats.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  statusLabel(key: string): string {
    const labels: Record<string, string> = {
      created: 'Criado',
      annotated: 'Anotado',
      blurring: 'Processando',
      blurred: 'Anonimizado',
      exporting: 'Exportando',
      exported: 'Exportado',
      failed: 'Falha',
      reprocessing: 'Reprocessando'
    };
    return labels[key] || key;
  }

  statusClass(key: string): string {
    const map: Record<string, string> = {
      created: 'badge-neutral',
      annotated: 'badge-info',
      blurred: 'badge-success',
      exported: 'badge-success',
      failed: 'badge-danger',
      blurring: 'badge-warning',
      exporting: 'badge-warning',
      reprocessing: 'badge-warning'
    };
    return map[key] || 'badge-neutral';
  }
}
