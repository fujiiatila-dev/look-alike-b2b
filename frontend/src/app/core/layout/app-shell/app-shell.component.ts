import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  inject,
  signal,
  computed,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';
import { WebSocketService } from '../../services/websocket.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, MatSidenavModule, SidebarComponent, HeaderComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly wsService = inject(WebSocketService);

  readonly sidenav = viewChild<MatSidenav>('sidenav');

  /** true when viewport is small enough to warrant overlay mode */
  readonly isMobile = signal(typeof window === 'undefined' ? false : window.innerWidth <= 1024);

  /** Sidenav mode: 'side' (push) on desktop, 'over' (overlay) on mobile */
  readonly sidenavMode = computed(() =>
    this.isMobile() ? 'over' : 'side',
  );

  /** Whether sidenav should be open */
  readonly sidenavOpened = computed(() => !this.isMobile());

  constructor() {
    // Establish global WebSocket connection
    this.wsService.connect();

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        // Auto-close overlay on navigation (mobile only)
        if (this.isMobile()) {
          this.sidenav()?.close();
        }
      });
  }

  toggleSidebar(): void {
    this.sidenav()?.toggle();
  }

  @HostListener('window:resize')
  onResize(): void {
    if (typeof window !== 'undefined') {
      this.isMobile.set(window.innerWidth <= 1024);
    }
  }
}
