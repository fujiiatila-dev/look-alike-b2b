import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-event-detail',
  standalone: true,
  imports: [],
  templateUrl: './event-detail.html',
  styleUrl: './event-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventDetail {

}
