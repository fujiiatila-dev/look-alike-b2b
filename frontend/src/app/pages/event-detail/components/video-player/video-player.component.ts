import { ChangeDetectionStrategy, Component, ElementRef, Input, ViewChild } from '@angular/core';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-video-player',
  standalone: true,
  imports: [NgIf],
  templateUrl: './video-player.component.html',
  styleUrl: './video-player.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoPlayerComponent {
  @Input() videoUrl = '';

  @ViewChild('videoRef') videoRef?: ElementRef<HTMLVideoElement>;

  get videoEl(): HTMLVideoElement | null {
    return this.videoRef?.nativeElement ?? null;
  }
}
