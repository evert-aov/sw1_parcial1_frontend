import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { Subscription, timeout } from 'rxjs';
import {
  ChatMessage,
  ChatScope,
} from '../../core/plugins/contracts/ai-assistant.service.contract';
import { AiAssistantService } from './ai-assistant.service';
import { alignSpeechText } from './speech-text-progress';

export interface SelectiveSpeechContext {
  inCall: boolean;
  currentUserId: string | null;
}

interface QueuedSpeechItem {
  room: string;
  messageId: string;
  content: string;
  scope?: ChatScope;
}

/**
 * Síntesis local selectiva de Kanon: reproduce automáticamente solo si el usuario está en la llamada
 * grupal activa o si formuló ese turno mediante una nota de voz, manteniendo reproducción manual por mensaje.
 */
@Injectable({ providedIn: 'root' })
export class ChatSpeechService implements OnDestroy {
  private readonly api = inject(AiAssistantService);
  readonly voice = signal<'marcelo'>('marcelo').asReadonly();
  readonly muted = signal(false);
  /** Prefijos visibles únicamente mientras una respuesta nueva espera o reproduce audio. */
  private readonly revealedText = signal<Record<string, string>>({});
  readonly loading = signal<string | null>(null);
  readonly playing = signal<string | null>(null);
  readonly ready = signal<string | null>(null);
  readonly error = signal('');

  private room: string | null = null;
  private readyScope?: ChatScope;
  private readonly floors = new Map<string, number>();
  private readonly seen = new Set<string>();
  private queue: QueuedSpeechItem[] = [];
  private blocked = false;
  private autoMuted = false;
  private generation = 0;
  private request?: Subscription;
  private audio?: HTMLAudioElement;
  private url?: string;

  /** Registra el piso de secuencia inicial de un ámbito para no reproducir historial antiguo. */
  primeFloor(room: string, messages: ChatMessage[], scope: ChatScope = 'group'): void {
    const key = this.floorKey(room, scope);
    const maxSeq = Math.max(0, ...messages.map((message) => message.sequence));
    const prev = this.floors.get(key);
    this.floors.set(key, prev === undefined ? maxSeq : Math.max(prev, maxSeq));
    this.room = room;
    this.autoMuted = false;
  }

  /** Silencia inmediatamente la salida; al reactivar no reproduce mensajes recibidos durante el silencio. */
  toggleMuted(): void {
    this.muted.update(value => !value);
    this.autoMuted = false;
    this.error.set('');
    if (this.muted()) this.stop();
  }

  /**
   * Evalúa mensajes entrantes y encola automáticamente respuestas nuevas de Kanon únicamente
   * cuando el participante está en llamada grupal o cuando originó el turno por audio.
   */
  observe(
    room: string | null,
    messages: ChatMessage[],
    context: SelectiveSpeechContext,
    scope: ChatScope = 'group',
  ): void {
    if (!room) return;
    this.room = room;
    const key = this.floorKey(room, scope);
    const floor = this.floors.get(key);
    if (floor === undefined) {
      this.primeFloor(room, messages, scope);
      return;
    }

    for (const message of messages) {
      if (
        message.sequence <= floor ||
        message.source !== 'assistant' ||
        message.speechMode === 'live' ||
        message.status !== 'completed' ||
        this.seen.has(message.id)
      ) {
        continue;
      }
      this.seen.add(message.id);
      if (this.muted() || this.autoMuted || !this.shouldAutoSpeak(message, context, scope)) {
        continue;
      }
      if (this.queue.length >= 10) {
        this.fail('chat.voiceQueueFull');
        return;
      }
      this.queue.push({
        room,
        messageId: message.id,
        content: message.content,
        scope: scope === 'personal' ? 'personal' : undefined,
      });
    }
    this.revealedText.update(current => {
      const pending = { ...current };
      for (const item of this.queue) pending[item.messageId] ??= '';
      return pending;
    });
    this.floors.set(key, Math.max(floor, ...messages.map((m) => m.sequence)));
    this.startNext();
  }

  /** Devuelve el prefijo hablado; historial, mensajes sin audio y fallos conservan el texto completo. */
  displayedContent(message: ChatMessage): string {
    return this.revealedText()[message.id] ?? message.content;
  }

  /** Completa la burbuja sin modificar el mensaje persistido ni su formato Markdown. */
  private revealComplete(messageId: string): void {
    this.revealedText.update(current => {
      const next = { ...current };
      delete next[messageId];
      return next;
    });
  }

  /** Solicita escuchar manualmente cualquier respuesta completada de Kanon. */
  play(room: string, message: ChatMessage, scope?: ChatScope): void {
    if (this.blocked || this.muted() || message.source !== 'assistant' || message.status !== 'completed') return;
    const normalizedScope = scope === 'personal' ? 'personal' : undefined;
    if (
      room === this.room &&
      this.ready() === message.id &&
      this.readyScope === normalizedScope &&
      this.audio
    ) {
      this.error.set('');
      this.autoMuted = false;
      this.ready.set(null);
      this.playing.set(message.id);
      this.attemptPlayback(this.audio, message.id, normalizedScope, this.generation);
      return;
    }
    this.stop();
    this.autoMuted = false;
    this.room = room;
    this.seen.add(message.id);
    this.queue.push({ room, messageId: message.id, content: message.content, scope: normalizedScope });
    this.startNext();
  }

  /** Evita escuchar a Kanon mientras se graba un clip o se reproduce un audio humano. */
  setBlocked(blocked: boolean): void {
    if (blocked === this.blocked) return;
    this.blocked = blocked;
    if (blocked) this.stop();
    else this.startNext();
  }

  /** Cancela petición, reproducción y cola; libera el recurso binario local. */
  stop(): void {
    this.generation++;
    this.request?.unsubscribe();
    this.request = undefined;
    this.queue = [];
    this.revealedText.set({});
    this.releaseAudio();
    this.loading.set(null);
    this.playing.set(null);
    this.ready.set(null);
    this.readyScope = undefined;
  }

  /** Aísla cada diagrama y limpia las marcas de reproducción al cambiar de sala. */
  reset(room: string | null): void {
    this.stop();
    this.room = room;
    this.autoMuted = false;
    this.error.set('');
    this.seen.clear();
    this.floors.clear();
  }

  /** Libera recursos al destruir el servicio. */
  ngOnDestroy(): void {
    this.reset(null);
  }

  /** Regla estricta del Requisito 6: llamada activa o autor de consulta por audio. */
  private shouldAutoSpeak(
    message: ChatMessage,
    context: SelectiveSpeechContext,
    scope: ChatScope,
  ): boolean {
    if (context.inCall && scope === 'group') return true;
    if (message.replyToSource !== 'audio') return false;
    if (scope === 'personal' || message.scope === 'personal') return true;
    return !!context.currentUserId && message.replyToUser?.userId === context.currentUserId;
  }

  /** Separa los pisos de reproducción por diagrama y ámbito. */
  private floorKey(room: string, scope: ChatScope): string {
    return `${room}:${scope}`;
  }

  /** Ejecuta una sola descarga/reproducción; las siguientes esperan al fin del audio. */
  private startNext(): void {
    if (this.muted() || this.blocked || this.loading() || this.playing() || this.ready()) return;
    const item = this.queue.shift();
    if (!item) return;
    const generation = this.generation;
    this.room = item.room;
    this.error.set('');
    this.loading.set(item.messageId);
    const speechObs = item.scope
      ? this.api.speechPlayback(item.room, item.messageId, item.scope)
      : this.api.speechPlayback(item.room, item.messageId);

    this.request = speechObs.pipe(timeout(45000)).subscribe({
      next: (packet) => {
        if (generation !== this.generation) return;
        this.loading.set(null);
        const bytes = Uint8Array.from(atob(packet.audioBase64), character => character.charCodeAt(0));
        this.url = URL.createObjectURL(new Blob([bytes], { type: packet.mimeType }));
        const boundaries = alignSpeechText(item.content, packet.cues);
        if (!boundaries.length) this.revealComplete(item.messageId);
        const audio = new Audio(this.url);
        this.audio = audio;
        audio.ontimeupdate = () => {
          if (generation !== this.generation) return;
          const position = audio.currentTime * 1000;
          const offset = boundaries.filter(boundary => boundary.startMs <= position).at(-1)?.endOffset ?? 0;
          this.revealedText.update(current => {
            const previous = current[item.messageId];
            if (previous === undefined || previous.length >= offset) return current;
            return { ...current, [item.messageId]: item.content.slice(0, offset) };
          });
        };
        this.playing.set(item.messageId);
        audio.onended = () => {
          if (generation !== this.generation) return;
          this.revealComplete(item.messageId);
          this.releaseAudio();
          this.playing.set(null);
          this.startNext();
        };
        audio.onerror = () => {
          if (generation === this.generation) this.fail('chat.voiceFailed');
        };
        this.attemptPlayback(audio, item.messageId, item.scope, generation);
      },
      error: () => {
        if (generation === this.generation) this.fail('chat.voiceFailed');
      },
    });
  }

  /** Conserva el audio bloqueado por autoplay del navegador para reanudarlo en el siguiente clic. */
  private attemptPlayback(
    audio: HTMLAudioElement,
    messageId: string,
    scope: ChatScope | undefined,
    generation: number,
  ): void {
    void audio.play().catch(() => {
      if (generation !== this.generation) return;
      this.playing.set(null);
      this.ready.set(messageId);
      this.readyScope = scope;
      this.autoMuted = true;
      this.queue = [];
      this.revealedText.set({});
      this.error.set('chat.voicePlaybackBlocked');
    });
  }

  /** Detiene cola automática tras un fallo; el texto permanece intacto y se puede reintentar manualmente. */
  private fail(key: string): void {
    this.stop();
    this.autoMuted = true;
    this.error.set(key);
  }

  /** Retira eventos antes de pausar y revoca la URL para no retener audio en memoria. */
  private releaseAudio(): void {
    if (this.audio) {
      this.audio.ontimeupdate = null;
      this.audio.onended = null;
      this.audio.onerror = null;
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio = undefined;
    }
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = undefined;
  }
}
