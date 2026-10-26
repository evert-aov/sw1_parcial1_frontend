import { DOCUMENT } from '@angular/common';
import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { firstValueFrom, Observable, Subject, Subscription, takeUntil, timeout } from 'rxjs';
import { ConversationRealtimeService } from './conversation-realtime.service';
import { AiAssistantService } from './ai-assistant.service';
import { ChatMessage, ChatModels, ChatSubmission } from '../../core/plugins/contracts/ai-assistant.service.contract';

/** Sincroniza por avisos con respaldo periódico, deduplicación y aislamiento entre diagramas. */
@Injectable()
export class ConversationStateService implements OnDestroy {
  private readonly api = inject(AiAssistantService);
  private readonly realtime = inject(ConversationRealtimeService);
  private readonly document = inject(DOCUMENT);
  private notices?: Subscription;
  private inFlight = false;
  private requestedRevision = -1;
  private forceRefresh = false;
  private timerDue = 0;
  private failures = 0;
  private modelFailures = 0;
  /** Suspende consultas en segundo plano y recupera cambios al volver a la pestaña. */
  private readonly visibilityChanged = () => {
    if (this.document.hidden) { clearTimeout(this.timer); this.timerDue = 0; }
    else this.refresh();
  };
  readonly messages = signal<ChatMessage[]>([]);
  readonly models = signal<ChatModels | null>(null);
  readonly connected = signal(false);
  readonly sending = signal(false);
  readonly hasMore = signal(false);
  readonly error = signal('');
  private diagramId: string | null = null;
  private generation = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private modelsTimer?: ReturnType<typeof setTimeout>;
  private readonly disconnected = new Subject<void>();
  private destroyed = false;
  private pending?: ChatSubmission;
  private revision = -1;

  /** Conecta una sola vez por sala, cancelando las consultas de la sala anterior. */
  connect(diagramId: string | null): void {
    if (this.destroyed || diagramId === this.diagramId) return;
    this.disconnect();
    this.diagramId = diagramId;
    this.messages.set([]);
    this.hasMore.set(false);
    this.error.set('');
    this.pending = undefined;
    this.revision = -1;
    this.models.set(null);
    if (!diagramId) return;
    const generation = this.generation;
    void this.loadModels(generation);
    this.document.addEventListener('visibilitychange', this.visibilityChanged);
    this.notices = this.realtime.watch(diagramId).subscribe(notice => {
      if (generation !== this.generation || notice.kind === 'offline') return;
      this.refresh(notice.kind === 'changed' ? notice.revision : undefined);
    });
    void this.poll(generation);
  }

  /** Publica conservando la misma clave si la red falla después de aceptar el mensaje. */
  async send(input: Omit<ChatSubmission, 'clientMessageId'>): Promise<boolean> {
    if (!this.diagramId || this.sending()) return false;
    const generation = this.generation;
    const fingerprint = JSON.stringify(input);
    const previous = this.pending;
    const matches = previous && JSON.stringify({ content: previous.content, provider: previous.provider, askAssistant: previous.askAssistant, ...(previous.attachment ? { attachment: previous.attachment } : {}) }) === fingerprint;
    const submission = matches ? previous : { ...input, clientMessageId: crypto.randomUUID() };
    this.pending = submission;
    this.sending.set(true);
    this.error.set('');
    try {
      const message = await this.request(this.api.submit(this.diagramId, submission));
      if (generation !== this.generation) return false;
      this.merge([message]);
      this.pending = undefined;
      this.refresh();
      return true;
    } catch { if (generation === this.generation) this.error.set('chat.sendFailed'); return false; }
    finally { if (generation === this.generation) this.sending.set(false); }
  }

  /** Recupera mensajes antiguos sin interrumpir la sincronización de los recientes. */
  async loadEarlier(): Promise<void> {
    if (!this.diagramId || !this.messages().length) return;
    const generation = this.generation;
    try {
      const page = await this.request(this.api.history(this.diagramId, this.messages()[0].sequence));
      if (generation !== this.generation) return;
      this.merge(page.messages);
      this.hasMore.set(page.hasMore);
    } catch { if (generation === this.generation) this.error.set('chat.unavailable'); }
  }

  /** Solicita reintento explícito de una generación fallida. */
  async retry(messageId: string): Promise<void> {
    if (!this.diagramId) return;
    const generation = this.generation;
    try {
      const message = await this.request(this.api.retry(this.diagramId, messageId));
      if (generation === this.generation) { this.merge([message]); this.refresh(); }
    } catch { if (generation === this.generation) this.error.set('chat.sendFailed'); }
  }

  /** Cancela peticiones y temporizadores sin permitir que se reactive un panel destruido. */
  ngOnDestroy(): void {
    this.destroyed = true;
    this.disconnect();
    this.disconnected.complete();
  }

  /** Invalida respuestas antes de cancelar las suscripciones HTTP y ambos temporizadores. */
  private disconnect(): void {
    this.generation++;
    this.notices?.unsubscribe();
    this.notices = undefined;
    this.document.removeEventListener('visibilitychange', this.visibilityChanged);
    this.inFlight = false;
    this.forceRefresh = false;
    this.requestedRevision = -1;
    this.timerDue = 0;
    this.failures = 0;
    this.modelFailures = 0;
    clearTimeout(this.timer);
    clearTimeout(this.modelsTimer);
    this.diagramId = null;
    this.disconnected.next();
    this.connected.set(false);
    this.sending.set(false);
  }

  /** Acota la espera a veinte segundos y aborta la suscripción al cambiar o cerrar la sala. */
  private request<T>(source: Observable<T>): Promise<T> {
    return firstValueFrom(source.pipe(timeout({ first: 20_000 }), takeUntil(this.disconnected)));
  }

  /** Consulta el catálogo una vez; tras un fallo espera cuatro segundos sin bloquear el historial. */
  private async loadModels(generation: number): Promise<void> {
    if (!this.diagramId || generation !== this.generation) return;
    try {
      const models = await this.request(this.api.getAvailableModels());
      if (generation !== this.generation) return;
      this.models.set(models);
      this.modelFailures = 0;
      if (this.error() === 'chat.unavailable') this.error.set('');
    } catch {
      if (generation !== this.generation) return;
      this.error.set('chat.unavailable');
      this.modelsTimer = setTimeout(() => void this.loadModels(generation), Math.min(4000 * 2 ** this.modelFailures++, 60_000));
    }
  }

  /** Agrupa revisiones duplicadas y recuerda avisos que llegan durante una consulta activa. */
  private refresh(revision?: number): void {
    if (!this.diagramId || this.destroyed) return;
    if (revision !== undefined) {
      if (revision <= this.revision) return;
      this.requestedRevision = Math.max(this.requestedRevision, revision);
    } else this.forceRefresh = true;
    if (!this.inFlight) this.schedule(150);
  }

  /** Programa el próximo acceso sin postergar avisos existentes ni consultar una pestaña oculta. */
  private schedule(delay: number): void {
    if (!this.diagramId || this.destroyed || this.document.hidden) return;
    const due = Date.now() + delay;
    if (this.timerDue && this.timerDue <= due) return;
    clearTimeout(this.timer);
    this.timerDue = due;
    const generation = this.generation;
    this.timer = setTimeout(() => { this.timerDue = 0; void this.poll(generation); }, delay);
  }

  /** Recupera cambios sin solapamientos y comprueba el historial cada treinta segundos como respaldo. */
  private async poll(generation: number): Promise<void> {
    if (!this.diagramId || generation !== this.generation || this.inFlight || this.document.hidden) return;
    this.inFlight = true;
    this.forceRefresh = false;
    this.requestedRevision = -1;
    let succeeded = false;
    try {
      const page = await this.request(this.api.history(this.diagramId));
      if (generation !== this.generation) return;
      if (!this.messages().length) this.hasMore.set(page.hasMore);
      if (page.revision !== this.revision) {
        const earliestVisible = this.messages()[0]?.sequence;
        const updates = [...page.messages];
        let cursor = page;
        while (earliestVisible && cursor.hasMore && cursor.messages.length && cursor.messages[0].sequence > earliestVisible) {
          cursor = await this.request(this.api.history(this.diagramId, cursor.messages[0].sequence));
          if (generation !== this.generation) return;
          updates.push(...cursor.messages);
        }
        this.merge(updates);
        this.revision = page.revision;
      }
      this.connected.set(true);
      this.failures = 0;
      succeeded = true;
    } catch { if (generation === this.generation) this.connected.set(false); }
    finally {
      if (generation === this.generation) {
        this.inFlight = false;
        const delay = succeeded
          ? (this.forceRefresh || this.requestedRevision > this.revision ? 150 : 30_000)
          : Math.min(4000 * 2 ** this.failures++, 60_000);
        this.schedule(delay);
      }
    }
  }

  /** Fusiona por ID canónico y ordena por secuencia del servidor, nunca por reloj local. */
  private merge(incoming: ChatMessage[]): void {
    const messages = new Map(this.messages().map(message => [message.id, message]));
    incoming.forEach(message => messages.set(message.id, message));
    this.messages.set([...messages.values()].sort((left, right) => left.sequence - right.sequence));
  }
}
