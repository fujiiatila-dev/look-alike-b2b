import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs/operators';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../auth/auth.service';
import { ClientContextService } from '../../client/client-context.service';
import { environment } from '../../../../environments/environment';
import { R } from '../../../shared/utils/client-routes';
import { CameraService } from '../../../features/cameras/services/camera.service';
import { OfficeService } from '../../../features/office/services/office.service';
import { CameraStatus } from '../../../shared/models/camera.models';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';
import { CameraStateColorPipe } from '../../../shared/pipes/camera-state-color.pipe';
import { CameraStateLabelPipe } from '../../../shared/pipes/camera-state-label.pipe';

interface NavigationItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  exact: boolean;
  description?: string;
  expandable?: boolean;
}

const fspsNavItems: NavigationItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', path: R.dashboard, exact: true, description: 'Visão geral' },
  { id: 'lookalike', label: 'Look-alike B2B', icon: 'business', path: R.lookalike, exact: false, description: 'Prospecção Inteligente' },
  { id: 'profile', label: 'Dados da Empresa', icon: 'corporate_fare', path: R.profile, exact: false, description: 'Perfil Corporativo' },
  { id: 'users', label: 'Gestão de Contas', icon: 'manage_accounts', path: R.users, exact: false, description: 'Usuários e Permissões' },
];

const officeNavItems: NavigationItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', path: R.dashboard, exact: true, description: 'Resumo do escritório' },
  { id: 'cameras', label: 'Câmeras', icon: 'videocam', path: R.cameras, exact: false, description: 'Canais monitorados', expandable: true },
  { id: 'occupancy', label: 'Ocupação', icon: 'groups', path: R.ocupacao, exact: false, description: 'Capacidade por zona' },
  { id: 'presence', label: 'Presença', icon: 'badge', path: R.presenca, exact: false, description: 'Entradas por área', expandable: true },
  { id: 'alerts', label: 'Alertas', icon: 'warning', path: R.alertas, exact: false, description: 'Ocorrências críticas' },
];

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    RelativeTimePipe,
    CameraStateColorPipe,
    CameraStateLabelPipe,
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  readonly clientCtx = inject(ClientContextService);
  readonly cameraService = inject(CameraService);
  readonly office = inject(OfficeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  readonly R = R;
  readonly isOffice = environment.solutionKind === 'office';
  readonly brandLink = R.dashboard;
  readonly navigationItems = this.isOffice ? officeNavItems : fspsNavItems;
  readonly currentUrl = signal(this.router.url);
  readonly expandedSections = signal<Record<string, boolean>>({
    cameras: this.isOffice && this.isRouteActive(R.cameras, false),
    presence: this.isOffice && this.isRouteActive(R.presenca, false),
  });

  readonly accountItems: NavigationItem[] = [
    { id: 'profile', label: 'Meu Perfil', icon: 'person', path: R.profile, exact: false, description: 'Conta e acesso' },
  ];

  readonly adminItems: NavigationItem[] = [
    { id: 'users', label: 'Usuários', icon: 'group', path: R.users, exact: false, description: 'Permissões e equipes' },
  ];

  readonly systemItems: NavigationItem[] = [
    { id: 'health', label: 'Saúde do Sistema', icon: 'monitor_heart', path: R.health, exact: false, description: 'Telemetria do edge' },
    { id: 'diagnostics', label: 'Diagnóstico HW', icon: 'memory', path: R.diagnostics, exact: false, description: 'CPU, RAM e GPU' },
  ];

  readonly cameraPreviewItems = computed(() =>
    [...this.cameraService.cameras()]
      .sort((a, b) => {
        const stateDiff = Number(b.state === 'running') - Number(a.state === 'running');
        if (stateDiff !== 0) return stateDiff;
        return a.camera_id.localeCompare(b.camera_id);
      })
      .slice(0, 6)
  );

  readonly presencePreviewItems = computed(() => this.office.presenceZoneHighlights().slice(0, 5));

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(event => {
        const nextUrl = event.urlAfterRedirects || event.url;
        this.currentUrl.set(nextUrl);

        if (this.isRouteActive(R.cameras, false)) {
          this.setSectionExpanded('cameras', true);
        }

        if (this.isRouteActive(R.presenca, false)) {
          this.setSectionExpanded('presence', true);
        }
      });
  }

  ngOnInit(): void {
    if (!this.isOffice) {
      return;
    }

    this.cameraService.startLive();
    this.office.startPolling(15000);
  }

  ngOnDestroy(): void {
    if (!this.isOffice) {
      return;
    }

    this.cameraService.stopLive();
    this.office.stopPolling();
  }

  isItemActive(item: NavigationItem): boolean {
    return this.isRouteActive(item.path, item.exact);
  }

  isSectionExpanded(sectionId: string): boolean {
    return !!this.expandedSections()[sectionId];
  }

  onExpandableItemClick(item: NavigationItem): void {
    const isOpen = this.isSectionExpanded(item.id);
    const isActive = this.isItemActive(item);

    this.router.navigateByUrl(item.path);
    this.setSectionExpanded(item.id, !isOpen || !isActive);

    if (item.id === 'presence') {
      this.office.loadPresenceHighlights();
    }
  }

  itemBadge(itemId: string): string | null {
    if (!this.isOffice) {
      return null;
    }

    switch (itemId) {
      case 'cameras':
        return `${this.cameraService.runningCount()}/${this.cameraService.cameras().length || 0}`;
      case 'occupancy':
        return `${this.office.totalPresent()}`;
      case 'alerts':
        return `${this.office.stats()?.cameras_over_capacity ?? 0}`;
      default:
        return null;
    }
  }

  cameraMetric(camera: CameraStatus): string {
    if (camera.state === 'running') {
      return `${camera.fps_current.toFixed(1)} fps`;
    }

    if (camera.state === 'starting' || camera.state === 'retrying') {
      return 'Aguardando stream';
    }

    return 'Sem sinal';
  }

  private setSectionExpanded(sectionId: string, expanded: boolean): void {
    this.expandedSections.update(current => ({
      ...current,
      [sectionId]: expanded,
    }));
  }

  private isRouteActive(path: string, exact: boolean): boolean {
    const url = this.currentUrl();
    if (exact) {
      return url === path;
    }

    return url === path || url.startsWith(`${path}/`) || url.startsWith(`${path}?`);
  }
}
