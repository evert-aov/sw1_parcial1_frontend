import { DOCUMENT } from '@angular/common';
import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { firstValueFrom, Observable, Subject, Subscription, takeUntil, timeout } from 'rxjs';
import { ConversationRealtimeService } from './conversation-realtime.service';
import { AiAssistantService } from './ai-assistant.service';
import {
  ChatHistory,
  ChatMessage,
  ChatModels,
  ChatScope,
  ChatSubmission,
} from '../../core/plugins/contracts/ai-assistant.service.contract';

interface ScopedSnapshot {
  messages: ChatMessage[];
  hasMore: boolean;
  revision: number;
}

/** Sincroniza por avisos con respaldo periódico, deduplicación y aislamiento entre ámbitos y diagramas. */
@Injectable()
export class ConversationStateService implements OnDestroy {
  private readonly api = inject(AiAssistantService);
  private readonly realtime = inject(ConversationRealtimeService);
  private readonly document = inject(DOCUMENT);
  private notices?: Subscription;
  private inFlight = false;
  private requestedRevision = -1;
  private forceRefresh = false;
  private historyRecovery = false;
  private timerDue = 0;
  private failures = 0;
  private modelFailures = 0;
  /** Suspende consultas en segundo plano y recupera cambios al volver a la pestaña. */
  private readonly visibilityChanged = () => {
    if (this.document.hidden) {
      clearTimeout(this.timer);
      this.timerDue = 0;
    } else {
      this.refresh();
    }
  };
  readonly scope = signal<ChatScope>('group');
  readonly messages = signal<ChatMessage[]>([]);
  readonly models = signal<ChatModels | null>(null);
  readonly connected = signal(false);
  /** Distingue el estado vacío provisional de una primera página confirmada por el servidor. */
  readonly historyLoaded = signal(false);
  readonly sending = signal(false);
  readonly hasMore = signal(false);
  readonly error = signal('');
  private diagramId: string | null = null;
  private generation = 0;
  private scopeGeneration = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private modelsTimer?: ReturnType<typeof setTimeout>;
  private readonly disconnected = new Subject<void>();
  private readonly scopeSwitched = new Subject<void>();
  private destroyed = false;
  private pending?: ChatSubmission;
  private readonly liveMessages = new Map<string, ChatMessage>();
  private revision = -1;
  private cache: Record<ChatScope, ScopedSnapshot> = {
    group: { messages: [], hasMore: false, revision: -1 },
    personal: { messages: [], hasMore: false, revision: -1 },
  };

  /** Conecta una sola vez por diagrama, cancelando las consultas del diagrama anterior. */
  connect(diagramId: string | null, initialScope?: ChatScope): void {
    if (this.destroyed) return;
    if (diagramId === this.diagramId) {
      if (initialScope) this.setScope(initialScope);
      return;
    }
    if (initialScope) this.scope.set(initialScope);
    this.disconnect();
    this.diagramId = diagramId;
    this.cache = {
      group: { messages: [], hasMore: false, revision: -1 },
      personal: { messages: [], hasMore: false, revision: -1 },
    };
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
    this.notices = this.realtime.watch(diagramId).subscribe((notice) => {
      if (generation !== this.generation || notice.kind === 'offline' || notice.kind === 'call_started') return;
      if (notice.kind === 'live') {
        const message = notice.message;
        const confirmed = this.cache.group.messages.find(item => item.id === message.id);
        const previous = this.liveMessages.get(message.id);
        // REST/SSE definitivo prevalece; la autorización asíncrona puede retrasar fragmentos.
        if (confirmed?.streaming === false || (previous && previous.content.length > message.content.length)) return;
        this.liveMessages.set(message.id, message);
        if (this.scope() === 'group') this.merge([message]);
        return;
      }
      if (notice.kind === 'changed' && notice.snapshot) {
        this.acceptSnapshot(notice.snapshot, notice.scope ?? 'group');
        if (notice.revision === undefined || notice.snapshot.revision >= notice.revision) return;
      }
      if (notice.kind === 'changed' && notice.scope && notice.scope !== this.scope()) {
        this.cache[notice.scope].revision = -1;
        return;
      }
      this.refresh(notice.kind === 'changed' ? notice.revision : undefined);
    });
    void this.poll(generation, this.scopeGeneration);
  }

  /** Alterna entre chat personal y grupal conservando caché local por pestaña sin reconectar el socket. */
  setScope(nextScope: ChatScope): void {
    if (this.destroyed || nextScope === this.scope()) return;
    const prevScope = this.scope();
    this.cache[prevScope] = {
      messages: this.messages(),
      hasMore: this.hasMore(),
      revision: this.revision,
    };
    this.scopeGeneration++;
    this.sending.set(false);
    this.historyRecovery = false;
    this.scopeSwitched.next();
    clearTimeout(this.timer);
    this.timerDue = 0;
    this.inFlight = false;
    this.historyRecovery = false;
    this.forceRefresh = false;
    this.requestedRevision = -1;
    this.pending = undefined;
    this.error.set('');

    const target = this.cache[nextScope];
    this.scope.set(nextScope);
    this.messages.set(target.messages);
    this.hasMore.set(target.hasMore);
    this.revision = target.revision;
    this.historyLoaded.set(false);

    if (this.diagramId) {
      void this.poll(this.generation, this.scopeGeneration);
    }
  }

  /** Fuerza una sincronización inmediata del ámbito actual (por ejemplo tras aceptar sugerencia proactiva). */
  refreshNow(): void {
    if (!this.diagramId || this.destroyed) return;
    this.revision = -1;
    this.refresh();
  }

  /** Publica conservando la misma clave si la red falla después de aceptar el mensaje. */
  async send(input: Omit<ChatSubmission, 'clientMessageId'>): Promise<boolean> {
    if (!this.diagramId || this.sending()) return false;
    const generation = this.generation;
    const scopeGen = this.scopeGeneration;
    const effectiveScope = input.scope ?? this.scope();
    const scopedInput: Omit<ChatSubmission, 'clientMessageId'> =
      effectiveScope === 'personal' ? { ...input, scope: 'personal' } : input;
    const fingerprint = JSON.stringify(scopedInput);
    const previous = this.pending;
    const matches =
      previous &&
      JSON.stringify({
        content: previous.content,
        provider: previous.provider,
        ...(previous.askAssistant !== undefined ? { askAssistant: previous.askAssistant } : {}),
        ...(previous.scope ? { scope: previous.scope } : {}),
        ...(previous.channel ? { channel: previous.channel } : {}),
        ...(previous.language ? { language: previous.language } : {}),
        ...(previous.attachment ? { attachment: previous.attachment } : {}),
      }) === fingerprint;
    const submission = matches ? previous : { ...scopedInput, clientMessageId: crypto.randomUUID() };
    this.pending = submission;
    this.sending.set(true);
    this.error.set('');
    try {
      const message = await this.request(this.api.submit(this.diagramId, submission), true);
      if (generation !== this.generation || scopeGen !== this.scopeGeneration) return false;
      if (!this.messages().some(existing => existing.id === message.id)) this.merge([message]);
      this.pending = undefined;
      this.refresh();
      return true;
    } catch {
      if (generation === this.generation && scopeGen === this.scopeGeneration) {
        this.error.set('chat.sendFailed');
      }
      return false;
    } finally {
      if (generation === this.generation && scopeGen === this.scopeGeneration) {
        this.sending.set(false);
      }
    }
  }

  /** Recupera mensajes antiguos sin interrumpir la sincronización de los recientes. */
  async loadEarlier(): Promise<void> {
    if (!this.diagramId || !this.messages().length) return;
    const generation = this.generation;
    const scopeGen = this.scopeGeneration;
    const scopeParam = this.scope() === 'personal' ? 'personal' : undefined;
    try {
      const page = await this.request(
        scopeParam
          ? this.api.history(this.diagramId, this.messages()[0].sequence, scopeParam)
          : this.api.history(this.diagramId, this.messages()[0].sequence),
        true,
      );
      if (generation !== this.generation || scopeGen !== this.scopeGeneration) return;
      this.merge(page.messages);
      this.hasMore.set(page.hasMore);
    } catch {
      if (generation === this.generation && scopeGen === this.scopeGeneration) {
        this.error.set('chat.unavailable');
      }
    }
  }

  /** Solicita reintento explícito de una generación fallida en el ámbito activo. */
  async retry(messageId: string): Promise<void> {
    if (!this.diagramId) return;
    const generation = this.generation;
    const scopeGen = this.scopeGeneration;
    const scopeParam = this.scope() === 'personal' ? 'personal' : undefined;
    try {
      const message = await this.request(
        scopeParam ? this.api.retry(this.diagramId, messageId, scopeParam) : this.api.retry(this.diagramId, messageId),
        true,
      );
      if (generation === this.generation && scopeGen === this.scopeGeneration) {
        this.merge([message]);
        this.refresh();
      }
    } catch {
      if (generation === this.generation && scopeGen === this.scopeGeneration) {
        this.error.set('chat.sendFailed');
      }
    }
  }

  /** Cancela peticiones y temporizadores sin permitir que se reactive un panel destruido. */
  ngOnDestroy(): void {
    this.destroyed = true;
    this.disconnect();
    this.scopeSwitched.complete();
    this.disconnected.complete();
  }

  /** Invalida respuestas antes de cancelar las suscripciones HTTP y ambos temporizadores. */
  private disconnect(): void {
    this.liveMessages.clear();
    this.generation++;
    this.scopeGeneration++;
    this.notices?.unsubscribe();
    this.notices = undefined;
    this.document.removeEventListener('visibilitychange', this.visibilityChanged);
    this.inFlight = false;
    this.historyRecovery = false;
    this.forceRefresh = false;
    this.requestedRevision = -1;
    this.timerDue = 0;
    this.failures = 0;
    this.modelFailures = 0;
    clearTimeout(this.timer);
    clearTimeout(this.modelsTimer);
    this.diagramId = null;
    this.scopeSwitched.next();
    this.disconnected.next();
    this.connected.set(false);
    this.historyLoaded.set(false);
    this.sending.set(false);
  }

  /** Acota la espera a veinte segundos y aborta la suscripción al cambiar sala o ámbito. */
  private request<T>(source: Observable<T>, cancelOnScopeSwitch = false): Promise<T> {
    const piped = cancelOnScopeSwitch
      ? source.pipe(timeout({ first: 20_000 }), takeUntil(this.disconnected), takeUntil(this.scopeSwitched))
      : source.pipe(timeout({ first: 20_000 }), takeUntil(this.disconnected));
    return firstValueFrom(piped);
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
      this.modelsTimer = setTimeout(
        () => void this.loadModels(generation),
        Math.min(4000 * 2 ** this.modelFailures++, 60_000),
      );
    }
  }

  /** Agrupa revisiones duplicadas y recuerda avisos que llegan durante una consulta activa. */
  private refresh(revision?: number): void {
    if (!this.diagramId || this.destroyed) return;
    if (revision !== undefined) {
      if (revision <= this.revision) return;
      this.requestedRevision = Math.max(this.requestedRevision, revision);
    } else {
      this.forceRefresh = true;
    }
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
    const scopeGen = this.scopeGeneration;
    this.timer = setTimeout(() => {
      this.timerDue = 0;
      void this.poll(generation, scopeGen);
    }, delay);
  }

  /** Recupera cambios sin solapamientos y comprueba el historial cada treinta segundos como respaldo. */
  private async poll(generation: number, scopeGen: number): Promise<void> {
    if (
      !this.diagramId ||
      generation !== this.generation ||
      scopeGen !== this.scopeGeneration ||
      this.inFlight ||
      this.document.hidden
    ) {
      return;
    }
    this.inFlight = true;
    this.forceRefresh = false;
    this.requestedRevision = -1;
    let succeeded = false;
    const scopeParam = this.scope() === 'personal' ? 'personal' : undefined;
    try {
      const page = await this.request(
        scopeParam ? this.api.history(this.diagramId, undefined, scopeParam) : this.api.history(this.diagramId),
        true,
      );
      if (generation !== this.generation || scopeGen !== this.scopeGeneration) return;
      if (!this.messages().length) this.hasMore.set(page.hasMore);
      if (page.revision > this.revision || this.historyRecovery) {
        const earliestVisible = this.messages()[0]?.sequence;
        const updates = [...page.messages];
        let cursor = page;
        while (
          earliestVisible &&
          cursor.hasMore &&
          cursor.messages.length &&
          cursor.messages[0].sequence > earliestVisible
        ) {
          cursor = await this.request(
            scopeParam
              ? this.api.history(this.diagramId, cursor.messages[0].sequence, scopeParam)
              : this.api.history(this.diagramId, cursor.messages[0].sequence),
            true,
          );
          if (generation !== this.generation || scopeGen !== this.scopeGeneration) return;
          updates.push(...cursor.messages);
        }
        if (page.revision >= this.revision) {
          this.historyRecovery = false;
          this.revision = page.revision;
          this.merge(updates);
        }
      }
      this.connected.set(true);
      this.historyLoaded.set(true);
      this.failures = 0;
      succeeded = true;
    } catch {
      if (generation === this.generation && scopeGen === this.scopeGeneration) {
        this.connected.set(false);
      }
    } finally {
      if (generation === this.generation && scopeGen === this.scopeGeneration) {
        this.inFlight = false;
        const delay = succeeded
          ? this.forceRefresh || this.requestedRevision > this.revision
            ? 150
            : 30_000
          : Math.min(4000 * 2 ** this.failures++, 60_000);
        this.schedule(delay);
      }
    }
  }

  /** Aplica el push sin temporizadores, incluso en segundo plano; descarta revisiones antiguas por ámbito. */
  private acceptSnapshot(page: ChatHistory, scope: ChatScope): void {
    const current = this.cache[scope];
    const revision = scope === this.scope() ? this.revision : current.revision;
    if (page.revision <= revision) return;
    const messages = new Map(current.messages.map(message => [message.id, message]));
    page.messages.forEach(message => messages.set(message.id, this.withLiveText(message)));
    const ordered = [...messages.values()].sort((left, right) => left.sequence - right.sequence);
    const snapshot = { messages: ordered, revision: page.revision,
      hasMore: current.messages.length ? current.hasMore : page.hasMore };
    this.cache[scope] = snapshot;
    if (scope !== this.scope()) return;
    this.revision = snapshot.revision;
    this.messages.set(ordered);
    this.hasMore.set(snapshot.hasMore);
    this.connected.set(true);
    this.historyLoaded.set(true);
    this.failures = 0;
    // Las páginas antiguas se reconcilian después de mostrar los mensajes recientes.
    if (page.hasMore && current.messages.length && page.messages[0]?.sequence > current.messages[0].sequence) {
      this.historyRecovery = true;
      this.refresh();
    }
  }

  /** Fusiona por ID canónico y ordena por secuencia del servidor, nunca por reloj local. */
  private merge(incoming: ChatMessage[]): void {
    const messages = new Map(this.messages().map((message) => [message.id, message]));
    incoming.forEach((message) => messages.set(message.id, this.withLiveText(message)));
    const ordered = [...messages.values()].sort((left, right) => left.sequence - right.sequence);
    this.messages.set(ordered);
    this.cache[this.scope()] = {
      messages: ordered,
      hasMore: this.hasMore(),
      revision: this.revision,
    };
  }

  /** Conserva el texto incremental ante snapshots intermedios; la confirmación durable prevalece. */
  private withLiveText(message: ChatMessage): ChatMessage {
    if (!message.streaming) {
      this.liveMessages.delete(message.id);
      return message;
    }
    return this.liveMessages.get(message.id) ?? message;
  }
}
