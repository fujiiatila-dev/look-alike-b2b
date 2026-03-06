import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [],
  templateUrl: './audit-log.html',
  styleUrl: './audit-log.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditLog {

}
