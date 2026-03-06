import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { NgxChartsModule, LegendPosition, Color, ScaleType } from '@swimlane/ngx-charts';
import { SystemGaugeComponent } from '../../../health/components/system-gauge/system-gauge.component';
import { CpuDetailCardComponent } from '../../components/cpu-detail-card.component';
import { SystemResourcesCardComponent } from '../../components/system-resources-card.component';
import { CameraPerfTableComponent } from '../../components/camera-perf-table.component';
import { DiagnosticsService } from '../../services/diagnostics.service';

@Component({
  selector: 'app-diagnostics-dashboard',
  standalone: true,
  imports: [
    DecimalPipe,
    MatIconModule,
    NgxChartsModule,
    SystemGaugeComponent,
    CpuDetailCardComponent,
    SystemResourcesCardComponent,
    CameraPerfTableComponent,
  ],
  templateUrl: './diagnostics-dashboard.component.html',
  styleUrl: './diagnostics-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiagnosticsDashboardComponent implements OnInit, OnDestroy {
  readonly diag = inject(DiagnosticsService);

  readonly legendBelow = LegendPosition.Below;

  readonly chartLineScheme: Color = {
    name: 'CpuGpu',
    selectable: false,
    group: ScaleType.Ordinal,
    domain: ['#3b82f6', '#8b5cf6'],
  };

  readonly chartNetScheme: Color = {
    name: 'Network',
    selectable: false,
    group: ScaleType.Ordinal,
    domain: ['#22c55e', '#ef4444'],
  };

  ngOnInit(): void {
    this.diag.startLive();
  }

  ngOnDestroy(): void {
    this.diag.stopLive();
  }
}
