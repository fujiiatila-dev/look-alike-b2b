import { environment } from '../../../environments/environment';

const P = `/${environment.routePrefix}`;

export const R = {
  // Shared
  dashboard: `${P}/dashboard`,
  cameras: `${P}/cameras`,
  camera: (id: string) => `${P}/cameras/${id}`,
  profile: `${P}/profile`,
  users: `${P}/users`,
  health: `${P}/health`,
  diagnostics: `${P}/diagnostics`,
  lookalike: `${P}/lookalike`,

  // FSPS-only
  events: `${P}/events`,
  eventsNew: `${P}/events/new`,
  event: (id: string) => `${P}/events/${id}`,
  audit: `${P}/audit`,

  // Office-only
  ocupacao: `${P}/ocupacao`,
  presenca: `${P}/presenca`,
  alertas: `${P}/alertas`,

  // Auth (no prefix)
  login: '/login',
} as const;
