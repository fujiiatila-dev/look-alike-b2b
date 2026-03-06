import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-new-event',
  standalone: true,
  imports: [],
  templateUrl: './new-event.html',
  styleUrl: './new-event.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewEvent {

}
