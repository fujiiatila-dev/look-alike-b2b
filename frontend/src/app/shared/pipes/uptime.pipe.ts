import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'uptime', standalone: true })
export class UptimePipe implements PipeTransform {
  transform(seconds: number | null | undefined): string {
    if (seconds == null || seconds <= 0) return '-';

    const s = Math.floor(seconds);
    if (s < 60) return `${s}s`;

    const m = Math.floor(s / 60);
    if (m < 60) return `${m}min ${s % 60}s`;

    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ${m % 60}min`;

    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ${h % 24}h`;

    const w = Math.floor(d / 7);
    return `${w}sem ${d % 7}d`;
  }
}
