import { Injectable, inject } from '@angular/core';
import { Observable, Observer } from 'rxjs';
import { Socket, io } from 'socket.io-client';
import { AuthService } from '../../core/services/auth.service';
import { CallParticipant, ChatScope, ChatHistory, ChatMessage } from '../../core/plugins/contracts/ai-assistant.service.contract';
import { environment } from '../../../environments/environment';

export type ConversationNotice =
  | { kind: 'ready' | 'offline' }
  | { kind: 'live'; message: ChatMessage }
  | { kind: 'changed'; revision?: number; scope?: ChatScope; snapshot?: ChatHistory }
  | { kind: 'call_started'; diagramId: string; caller: { userId: string; displayName: string } };

export interface CallSignalMessage {
  diagramId: string;
  fromSocketId: string;
  userId: string;
  displayName: string;
  type: 'offer' | 'answer' | 'ice';
  data: RTCSessionDescriptionInit | RTCIceCandidateInit;
}

export interface AiConsentRequestEvent {
  diagramId: string;
  requestedBy: { userId: string; displayName: string };
}

export interface CallTransportHandle {
  getSocketId(): string | undefined;
  emit(event: string, payload: unknown): void;
  emitWithAck<T>(event: string, payload: unknown): Promise<T>;
  release(): void;
}

export interface CallTransportListener {
  onLive?: (packet: LivePacket) => void;
  onReady?: () => void;
  onParticipants: (participants: CallParticipant[]) => void;
  onSignal: (signal: CallSignalMessage) => void;
  onConsentRequest?: (event: AiConsentRequestEvent) => void;
  onConsentDenied?: (event: { diagramId: string; deniedBy: string }) => void;
  onConsentApproved?: (event: { diagramId: string }) => void;
  onDisconnect: () => void;
}

export interface LivePacket {
  type: 'ready' | 'audio' | 'message' | 'interrupted' | 'turn_complete' | 'error' | 'closed';
  sourceSocketId?: string;
  data?: string;
  sampleRate?: number;
  message?: ChatMessage;
  code?: string;
}

interface DiagramSocketSession {
  socket: Socket;
  refCount: number;
  ready: boolean;
  watchers: Set<Observer<ConversationNotice>>;
  callListeners: Set<CallTransportListener>;
}

/** Transporta avisos del chat y señalización WebRTC por el namespace autenticado `/conversations`. */
@Injectable()
export class ConversationRealtimeService {
  private readonly auth = inject(AuthService);
  private readonly sessions = new Map<string, DiagramSocketSession>();

  /** Abre o reutiliza la suscripción del diagrama y la libera cuando no quedan consumidores activos. */
  watch(diagramId: string): Observable<ConversationNotice> {
    return new Observable((observer) => {
      const session = this.acquireSession(diagramId);
      session.watchers.add(observer);
      if (session.ready && session.socket.connected) {
        observer.next({ kind: 'ready' });
      }
      return () => {
        session.watchers.delete(observer);
        this.releaseSession(diagramId, session);
      };
    });
  }

  /** Adquiere el transporte compartido de `/conversations` para señalización WebRTC de llamada grupal. */
  acquireCallTransport(diagramId: string, listener: CallTransportListener): CallTransportHandle {
    const session = this.acquireSession(diagramId);
    session.callListeners.add(listener);
    if (session.ready && session.socket.connected) {
      queueMicrotask(() => {
        if (session.callListeners.has(listener) && session.ready) listener.onReady?.();
      });
    }
    let released = false;
    return {
      getSocketId: () => session.socket.id,
      emit: (event: string, payload: unknown) => {
        if (session.socket.connected) {
          session.socket.emit(event, payload);
        }
      },
      emitWithAck: <T>(event: string, payload: unknown) =>
        new Promise<T>((resolve, reject) => {
          session.socket.timeout(5000).emit(event, payload, (err: Error | null, response: T) => {
            if (err) reject(err);
            else resolve(response);
          });
        }),
      release: () => {
        if (released) return;
        released = true;
        session.callListeners.delete(listener);
        this.releaseSession(diagramId, session);
      },
    };
  }

  /** Crea o incrementa la referencia del socket autenticado asociado a un diagrama concreto. */
  private acquireSession(diagramId: string): DiagramSocketSession {
    const existing = this.sessions.get(diagramId);
    if (existing) {
      existing.refCount++;
      return existing;
    }

    const url = new URL(environment.socketUrl);
    url.pathname = '/conversations';
    const socket = io(url.toString(), {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30_000,
      auth: (callback) => callback({ token: this.auth.token() }),
    });

    const session: DiagramSocketSession = {
      socket,
      refCount: 1,
      ready: false,
      watchers: new Set(),
      callListeners: new Set(),
    };
    this.sessions.set(diagramId, session);

    socket.on('connect', () => {
      const connectionId = socket.id;
      socket
        .timeout(5000)
        .emit('watch_conversation', { diagramId }, (error: Error | null, result?: { success: boolean }) => {
          if (this.sessions.get(diagramId) !== session || !socket.connected || socket.id !== connectionId) {
            return;
          }
          const isSuccess = Boolean(result?.success ?? (result as { data?: { success?: boolean } })?.data?.success);
          if (error || !isSuccess) {
            session.ready = false;
            session.watchers.forEach((watcher) => watcher.next({ kind: 'offline' }));
            session.callListeners.forEach((listener) => listener.onDisconnect());
            socket.disconnect();
            return;
          }
          session.ready = true;
          session.watchers.forEach((watcher) => watcher.next({ kind: 'ready' }));
          session.callListeners.forEach((listener) => listener.onReady?.());
        });
    });

    socket.on(
      'conversation_changed',
      (data: { diagramId?: string; revision?: number; scope?: ChatScope; snapshot?: ChatHistory } | null) => {
        if (data?.diagramId !== diagramId) return;
        if (data.revision !== undefined && (!Number.isSafeInteger(data.revision) || data.revision < 0)) {
          return;
        }
        const notice: ConversationNotice = {
          kind: 'changed',
          revision: data.revision,
          ...(data.snapshot && Number.isSafeInteger(data.snapshot.revision) &&
            Array.isArray(data.snapshot.messages) && typeof data.snapshot.hasMore === 'boolean'
            ? { snapshot: data.snapshot } : {}),
          ...(data.scope === 'personal' || data.scope === 'group' ? { scope: data.scope } : {}),
        };
        session.watchers.forEach((watcher) => watcher.next(notice));
      },
    );

    socket.on(
      'call_participants',
      (data: { diagramId?: string; participants?: CallParticipant[] } | null) => {
        if (data?.diagramId !== diagramId || !Array.isArray(data.participants)) return;
        session.callListeners.forEach((listener) => listener.onParticipants(data.participants!));
      },
    );

    socket.on('call_signal', (data: CallSignalMessage | null) => {
      if (!data || data.diagramId !== diagramId || !data.fromSocketId) return;
      session.callListeners.forEach((listener) => listener.onSignal(data));
    });

    socket.on('call_started', (data: { diagramId?: string; caller?: { userId: string; displayName: string } } | null) => {
      if (!data || data.diagramId !== diagramId || !data.caller) return;
      session.watchers.forEach((watcher) =>
        watcher.next({ kind: 'call_started', diagramId: data.diagramId!, caller: data.caller! }),
      );
    });

    socket.on('call_ai_consent_request', (data: { diagramId?: string; requestedBy?: { userId: string; displayName: string } } | null) => {
      if (!data || data.diagramId !== diagramId || !data.requestedBy) return;
      session.callListeners.forEach((listener) =>
        listener.onConsentRequest?.({ diagramId: data.diagramId!, requestedBy: data.requestedBy! }),
      );
    });

    socket.on('call_ai_consent_denied', (data: { diagramId?: string; deniedBy?: string } | null) => {
      if (!data || data.diagramId !== diagramId) return;
      session.callListeners.forEach((listener) =>
        listener.onConsentDenied?.({ diagramId: data.diagramId!, deniedBy: data.deniedBy || '' }),
      );
    });

    socket.on('call_ai_consent_approved', (data: { diagramId?: string } | null) => {
      if (!data || data.diagramId !== diagramId) return;
      session.callListeners.forEach((listener) =>
        listener.onConsentApproved?.({ diagramId: data.diagramId! }),
      );
    });

    socket.on('live_event', (data: LivePacket & { diagramId?: string }) => {
      if (!data || data.diagramId !== diagramId) return;
      if (data.type === 'message' && data.message?.speechMode === 'live'
        && typeof data.message.id === 'string' && typeof data.message.content === 'string'
        && data.message.content.length <= 32000 && Number.isSafeInteger(data.message.sequence)) {
        session.watchers.forEach(watcher => watcher.next({ kind: 'live', message: data.message! }));
      }
      session.callListeners.forEach(listener => listener.onLive?.(data));
    });

    socket.on('conversation_unavailable', () => {
      session.ready = false;
      session.watchers.forEach((watcher) => watcher.next({ kind: 'offline' }));
      session.callListeners.forEach((listener) => listener.onDisconnect());
      socket.disconnect();
    });

    socket.on('disconnect', () => {
      session.ready = false;
      session.watchers.forEach((watcher) => watcher.next({ kind: 'offline' }));
      session.callListeners.forEach((listener) => listener.onDisconnect());
    });

    socket.on('connect_error', () => {
      session.ready = false;
      session.watchers.forEach((watcher) => watcher.next({ kind: 'offline' }));
    });

    socket.connect();
    return session;
  }

  /** Decrementa el contador de consumidores y cierra el socket cuando queda sin suscriptores. */
  private releaseSession(diagramId: string, session: DiagramSocketSession): void {
    session.refCount--;
    if (session.refCount > 0) return;
    if (this.sessions.get(diagramId) === session) {
      this.sessions.delete(diagramId);
    }
    session.socket.removeAllListeners();
    session.socket.disconnect();
  }
}
