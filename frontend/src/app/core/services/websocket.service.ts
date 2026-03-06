import { Injectable, NgZone, signal, inject, DestroyRef, OnDestroy } from '@angular/core';
import { Observable, Subject, timer, EMPTY, Subscription } from 'rxjs';
import { retry, switchMap, tap, takeUntil, share } from 'rxjs/operators';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';

export type WsConnectionState = 'disconnected' | 'connecting' | 'connected';

export interface WsMessage {
  type: string;
  ts: string;
  payload: any;
  cameraId?: string;
}

@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  /** Reactive connection state */
  readonly connectionState = signal<WsConnectionState>('disconnected');

  private ws$: WebSocketSubject<WsMessage> | null = null;
  private messages$$: Subject<WsMessage> | null = null;
  private destroy$ = new Subject<void>();
  private reconnectSub: Subscription | null = null;

  /** Shared observable of all JSON messages from the multiplexed WS */
  messages$!: Observable<WsMessage>;

  connect(): void {
    if (this.ws$) return;

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}/api/ws/cameras`;

    this.messages$$ = new Subject<WsMessage>();
    this.messages$ = this.messages$$.asObservable().pipe(share());

    this.zone.runOutsideAngular(() => {
      this._connect(url);
    });

    this.destroyRef.onDestroy(() => this.disconnect());
  }

  disconnect(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.reconnectSub?.unsubscribe();
    this.reconnectSub = null;
    if (this.ws$) {
      this.ws$.complete();
      this.ws$ = null;
    }
    this.messages$$?.complete();
    this.messages$$ = null;
    this.connectionState.set('disconnected');
  }

  /**
   * Open a binary WebSocket for live JPEG frames of a specific camera.
   * Returns an Observable that emits blob: URLs for each frame.
   * Caller must unsubscribe to close the connection.
   */
  openFrameStream(cameraId: string): Observable<string> {
    return new Observable<string>((observer) => {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${location.host}/api/ws/cameras/${cameraId}/stream`;

      let socket: WebSocket | null = null;
      let prevBlobUrl: string | null = null;

      this.zone.runOutsideAngular(() => {
        socket = new WebSocket(url);
        socket.binaryType = 'arraybuffer';

        socket.onmessage = (event) => {
          // Revoke previous blob URL to prevent memory leaks
          if (prevBlobUrl) {
            URL.revokeObjectURL(prevBlobUrl);
          }
          const blob = new Blob([event.data], { type: 'image/jpeg' });
          const blobUrl = URL.createObjectURL(blob);
          prevBlobUrl = blobUrl;
          this.zone.run(() => observer.next(blobUrl));
        };

        socket.onerror = () => {
          this.zone.run(() => observer.error(new Error('Frame stream error')));
        };

        socket.onclose = () => {
          this.zone.run(() => observer.complete());
        };
      });

      // Teardown: close socket and revoke last blob URL
      return () => {
        if (prevBlobUrl) {
          URL.revokeObjectURL(prevBlobUrl);
          prevBlobUrl = null;
        }
        if (socket) {
          socket.close();
          socket = null;
        }
      };
    });
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  // ---------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------

  private _connect(url: string): void {
    this.connectionState.set('connecting');

    this.ws$ = webSocket<WsMessage>({
      url,
      openObserver: {
        next: () => {
          this.zone.run(() => this.connectionState.set('connected'));
        },
      },
      closeObserver: {
        next: () => {
          this.zone.run(() => this.connectionState.set('disconnected'));
        },
      },
    });

    let attempt = 0;

    this.reconnectSub = this.ws$
      .pipe(
        tap({
          next: (msg) => {
            attempt = 0; // reset on successful message
            // Auto-respond to server ping
            if (msg.type === 'ping') {
              this.ws$?.next({ type: 'pong', ts: new Date().toISOString(), payload: {} });
              return;
            }
            this.zone.run(() => this.messages$$?.next(msg));
          },
          error: () => {
            this.zone.run(() => this.connectionState.set('disconnected'));
          },
        }),
        retry({
          delay: () => {
            attempt = Math.min(attempt + 1, 10);
            const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
            this.zone.run(() => this.connectionState.set('connecting'));
            return timer(delayMs);
          },
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }
}
