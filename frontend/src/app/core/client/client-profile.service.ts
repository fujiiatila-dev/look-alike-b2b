import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ClientProfile, ClientFeatures } from '../../shared/models/camera.models';

@Injectable({ providedIn: 'root' })
export class ClientProfileService {
  private readonly http = inject(HttpClient);

  readonly profile = signal<ClientProfile | null>(null);

  readonly cardVariant = computed(() => this.profile()?.card_variant ?? 'full');

  readonly features = computed<ClientFeatures>(
    () =>
      this.profile()?.features ?? {
        live_preview: false,
        gpu_dashboard: true,
        export_audit: true,
        multi_backend: false,
        alert_sound: false,
      }
  );

  loadProfile(): void {
    this.http.get<ClientProfile>('/api/config/client-profile').subscribe({
      next: (data) => this.profile.set(data),
      error: () => {
        // Use defaults on error
      },
    });
  }
}
