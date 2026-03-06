import { Routes } from '@angular/router';
import { AppShellComponent } from './core/layout/app-shell/app-shell.component';
import { authGuard, adminGuard, officeGuard, fspsGuard } from './core/auth/auth.guard';
import { environment } from '../environments/environment';

const prefix = environment.routePrefix;

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: prefix,
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      // Dashboard: solution-aware component (build-time)
      {
        path: 'dashboard',
        loadComponent: () =>
          environment.solutionKind === 'office'
            ? import('./features/office/pages/office-dashboard/office-dashboard.component').then(m => m.OfficeDashboardComponent)
            : import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },

      // Shared
      { path: 'cameras/:id', loadComponent: () => import('./features/cameras/pages/camera-detail/camera-detail.component').then(m => m.CameraDetailComponent) },
      { path: 'cameras', loadComponent: () => import('./features/cameras/pages/camera-list/camera-list.component').then(m => m.CameraListComponent) },
      { path: 'profile', loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent) },
      { path: 'users', canActivate: [adminGuard], loadComponent: () => import('./pages/user-management/user-management.component').then(m => m.UserManagementComponent) },
      { path: 'health', loadComponent: () => import('./features/health/pages/health-dashboard/health-dashboard.component').then(m => m.HealthDashboardComponent) },
      { path: 'diagnostics', loadComponent: () => import('./features/diagnostics/pages/diagnostics-dashboard/diagnostics-dashboard.component').then(m => m.DiagnosticsDashboardComponent) },
      { path: 'lookalike', loadComponent: () => import('./features/lookalike/pages/lookalike-dashboard/lookalike-dashboard.component').then(m => m.LookalikeDashboardComponent) },

      // FSPS-only
      { path: 'events', canActivate: [fspsGuard], loadComponent: () => import('./pages/event-list/event-list.component').then(m => m.EventListComponent) },
      { path: 'events/new', canActivate: [fspsGuard], loadComponent: () => import('./pages/new-event/new-event.component').then(m => m.NewEventComponent) },
      { path: 'events/:id', canActivate: [fspsGuard], loadComponent: () => import('./pages/event-detail/event-detail.component').then(m => m.EventDetailComponent) },
      { path: 'audit', canActivate: [fspsGuard], loadComponent: () => import('./pages/audit-log/audit-log.component').then(m => m.AuditLogComponent) },

      // Office-only
      { path: 'ocupacao', canActivate: [officeGuard], loadComponent: () => import('./features/office/pages/occupancy-page/occupancy-page.component').then(m => m.OccupancyPageComponent) },
      { path: 'presenca', canActivate: [officeGuard], loadComponent: () => import('./features/office/pages/presence-page/presence-page.component').then(m => m.PresencePageComponent) },
      { path: 'alertas', canActivate: [officeGuard], loadComponent: () => import('./features/office/pages/alerts-page/alerts-page.component').then(m => m.AlertsPageComponent) },
    ],
  },

  // Root & wildcard → /${prefix}/dashboard
  { path: '', redirectTo: `${prefix}/dashboard`, pathMatch: 'full' },
  { path: '**', redirectTo: `${prefix}/dashboard` },
];
