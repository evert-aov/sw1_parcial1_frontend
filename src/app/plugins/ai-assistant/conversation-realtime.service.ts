import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { io } from 'socket.io-client';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

export type ConversationNotice = { kind: 'ready' | 'offline' } | { kind: 'changed'; revision?: number };

/** Transporta avisos del chat por un namespace autenticado del servidor Socket.IO existente. */
@Injectable()
export class ConversationRealtimeService {
  private readonly auth = inject(AuthService);

  /** Abre una suscripción por panel y la libera al cerrar o cambiar de diagrama. */
  watch(diagramId: string): Observable<ConversationNotice> {
    return new Observable(observer => {
      const url = new URL(environment.socketUrl);
      url.pathname = '/conversations';
      const socket = io(url.toString(), {
        autoConnect: false, transports: ['websocket', 'polling'], reconnection: true,
        reconnectionDelay: 1000, reconnectionDelayMax: 30_000,
        auth: callback => callback({ token: this.auth.token() }),
      });
      socket.on('connect', () => {
        const connectionId = socket.id;
        socket.timeout(5000).emit('watch_conversation', { diagramId }, (error: Error | null, result?: { success: boolean }) => {
          if (observer.closed || !socket.connected || socket.id !== connectionId) return;
          if (error || !result?.success) {
            observer.next({ kind: 'offline' });
            socket.disconnect();
            return;
          }
          observer.next({ kind: 'ready' });
        });
      });
      socket.on('conversation_changed', (data: { diagramId?: string; revision?: number } | null) => {
        if (data?.diagramId !== diagramId) return;
        if (data.revision !== undefined && (!Number.isSafeInteger(data.revision) || data.revision < 0)) return;
        observer.next({ kind: 'changed', revision: data.revision });
      });
      socket.on('conversation_unavailable', () => {
        observer.next({ kind: 'offline' });
        socket.disconnect();
      });
      socket.on('disconnect', () => observer.next({ kind: 'offline' }));
      socket.on('connect_error', () => observer.next({ kind: 'offline' }));
      socket.connect();
      return () => {
        socket.removeAllListeners();
        socket.disconnect();
      };
    });
  }
}
