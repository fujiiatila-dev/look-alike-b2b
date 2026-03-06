import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';
import { R } from '../../shared/utils/client-routes';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }
  router.navigate([R.login]);
  return false;
};

/** Blocks non-office builds from accessing office-only routes */
export const officeGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (environment.solutionKind === 'office') return true;
  router.navigate([R.dashboard]);
  return false;
};

/** Blocks office builds from accessing FSPS-only routes */
export const fspsGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (environment.solutionKind !== 'office') return true;
  router.navigate([R.dashboard]);
  return false;
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated() && auth.isAdmin()) {
    return true;
  }
  router.navigate([R.dashboard]);
  return false;
};
