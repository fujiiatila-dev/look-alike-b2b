import { ChangeDetectionStrategy, Component, EventEmitter, Output, DestroyRef, inject, signal } from '@angular/core';
import { NgIf } from '@angular/common';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../auth/auth.service';
import { ClientContextService } from '../../client/client-context.service';
import { environment } from '../../../../environments/environment';
import { R } from '../../../shared/utils/client-routes';

const ROUTE_TITLES: Record<string, string> = {
  [R.dashboard]:    environment.solutionKind === 'office' ? 'Dashboard — Escritório' : 'Dashboard',
  [R.cameras]:      'Câmeras',
  [R.events]:       'Eventos',
  [R.eventsNew]:    'Nova Ingestão',
  [R.audit]:        'Auditoria',
  [R.profile]:      'Meu Perfil',
  [R.users]:        'Usuários',
  [R.health]:       'Saúde do Sistema',
  [R.diagnostics]:  'Diagnóstico de Hardware',
  [R.ocupacao]:     'Ocupação',
  [R.presenca]:     'Presença',
  [R.alertas]:      'Alertas',
};

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    NgIf, RouterLink,
    MatToolbarModule, MatIconModule, MatButtonModule,
    MatMenuModule, MatDividerModule
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {
  @Output() readonly menuToggle = new EventEmitter<void>();

  readonly auth = inject(AuthService);
  readonly clientCtx = inject(ClientContextService);
  readonly pageTitle = signal('Dashboard');
  readonly R = R;

  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(e => {
        const url = e.urlAfterRedirects || e.url;
        const title = ROUTE_TITLES[url] ?? this.resolveDetailTitle(url);
        this.pageTitle.set(title);
      });
  }

  onMenuToggle(): void {
    this.menuToggle.emit();
  }

  onLogout(): void {
    this.auth.logout();
  }

  private resolveDetailTitle(url: string): string {
    const eventsPrefix = `${R.events}/`;
    if (url.startsWith(eventsPrefix)) {
      const id = url.substring(eventsPrefix.length);
      return `Evento #${id}`;
    }
    const camerasPrefix = `${R.cameras}/`;
    if (url.startsWith(camerasPrefix)) {
      const id = url.substring(camerasPrefix.length);
      return `Câmera ${id}`;
    }
    return 'Freedom-IA';
  }
}
