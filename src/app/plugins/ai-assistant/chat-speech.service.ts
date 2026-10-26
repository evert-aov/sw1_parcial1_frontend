import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { Subscription, timeout } from 'rxjs';
import { ChatMessage, ChatVoice } from '../../core/plugins/contracts/ai-assistant.service.contract';
import { AiAssistantService } from './ai-assistant.service';

/** Reproducción local y opcional; no altera turnos, mensajes compartidos ni propuestas. */
@Injectable()
export class ChatSpeechService implements OnDestroy {
  private readonly api = inject(AiAssistantService);
  readonly enabled = signal(false);
  readonly voice = signal<ChatVoice>('sofia');
  readonly loading = signal<string | null>(null);
  readonly playing = signal<string | null>(null);
  readonly ready = signal<string | null>(null);
  readonly error = signal('');
  private room: string | null = null;
  private floor = 0;
  private seen = new Set<string>();
  private queue: string[] = [];
  private blocked = false;
  private generation = 0;
  private request?: Subscription;
  private audio?: HTMLAudioElement;
  private url?: string;

  /** Alterna escucha automática desde el momento actual, sin reproducir el historial antiguo. */
  toggle(room: string, messages: ChatMessage[]): void {
    const enabled = !this.enabled();
    this.reset(room);
    this.floor = Math.max(0, ...messages.map(message => message.sequence));
    this.enabled.set(enabled);
  }

  /** Selecciona una voz para este participante y detiene la variante anterior. */
  selectVoice(voice: ChatVoice): void {
    if (voice !== 'sofia' && voice !== 'marcelo') return;
    this.stop();
    this.voice.set(voice);
  }

  /** Encola respuestas nuevas una sola vez; paginar o resincronizar no vuelve a leerlas. */
  observe(messages: ChatMessage[]): void {
    if (!this.enabled()) return;
    for (const message of messages) {
      if (message.sequence <= this.floor || message.source !== 'assistant' || message.status !== 'completed' || this.seen.has(message.id)) continue;
      this.seen.add(message.id);
      if (this.queue.length >= 10) { this.fail('chat.voiceQueueFull'); return; }
      this.queue.push(message.id);
    }
    this.startNext();
  }

  /** Solicita una respuesta puntual incluso con la escucha automática apagada. */
  play(room: string, message: ChatMessage): void {
    if (this.blocked || message.source !== 'assistant' || message.status !== 'completed') return;
    if (room === this.room && this.ready() === message.id && this.audio) {
      this.error.set('');
      this.ready.set(null);
      this.playing.set(message.id);
      this.attemptPlayback(this.audio, message.id, this.generation);
      return;
    }
    this.stop();
    this.room = room;
    this.seen.add(message.id);
    this.queue.push(message.id);
    this.startNext();
  }

  /** Evita escuchar a la IA mientras se captura voz o se reproduce un clip humano. */
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
    this.releaseAudio();
    this.loading.set(null);
    this.playing.set(null);
    this.ready.set(null);
  }

  /** Aísla cada sala y exige activar de nuevo la escucha al abrir otra conversación. */
  reset(room: string | null): void {
    this.stop();
    this.room = room;
    this.enabled.set(false);
    this.error.set('');
    this.seen.clear();
    this.floor = 0;
  }

  /** Libera recursos al desmontar el panel y evita respuestas tardías audibles. */
  ngOnDestroy(): void { this.reset(null); }

  /** Ejecuta una sola descarga/reproducción; las siguientes esperan al fin del audio. */
  private startNext(): void {
    if (this.blocked || this.loading() || this.playing() || this.ready() || !this.room) return;
    const messageId = this.queue.shift();
    if (!messageId) return;
    const generation = this.generation;
    this.error.set('');
    this.loading.set(messageId);
    this.request = this.api.speech(this.room, messageId, this.voice()).pipe(timeout(45000)).subscribe({
      next: blob => {
        if (generation !== this.generation) return;
        this.loading.set(null);
        this.url = URL.createObjectURL(blob);
        const audio = new Audio(this.url);
        this.audio = audio;
        this.playing.set(messageId);
        audio.onended = () => {
          if (generation !== this.generation) return;
          this.releaseAudio();
          this.playing.set(null);
          this.startNext();
        };
        audio.onerror = () => { if (generation === this.generation) this.fail('chat.voiceFailed'); };
        this.attemptPlayback(audio, messageId, generation);
      },
      error: () => { if (generation === this.generation) this.fail('chat.voiceFailed'); },
    });
  }

  /** Conserva el audio bloqueado para reanudarlo dentro del siguiente gesto explícito del usuario. */
  private attemptPlayback(audio: HTMLAudioElement, messageId: string, generation: number): void {
    void audio.play().catch(() => {
      if (generation !== this.generation) return;
      this.playing.set(null);
      this.ready.set(messageId);
      this.enabled.set(false);
      this.queue = [];
      this.error.set('chat.voicePlaybackBlocked');
    });
  }

  /** Detiene automáticamente tras un fallo; el texto sigue disponible y el reintento es explícito. */
  private fail(key: string): void { this.stop(); this.enabled.set(false); this.error.set(key); }

  /** Retira eventos antes de pausar y revoca la URL para no retener audio en memoria. */
  private releaseAudio(): void {
    if (this.audio) {
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
