import { Injectable, OnDestroy, Signal, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslationService } from '../../core/i18n/index';
import {
  AiAssistantCoordinator as AiAssistantCoordinatorContract,
  CallParticipant,
  ChatScope,
  ProactiveSuggestion,
} from '../../core/plugins/contracts/ai-assistant.service.contract';
import { ConversationRealtimeService } from './conversation-realtime.service';
import { KanonSuggestionService } from './kanon-suggestion.service';
import { VoiceCallService } from './voice-call.service';

/**
 * Implementación interna del coordinador reactivo de Kanon expuesta al Core mediante su token de contrato.
 */
@Injectable()
export class AiAssistantCoordinatorService implements AiAssistantCoordinatorContract, OnDestroy {
  private readonly suggestions = inject(KanonSuggestionService);
  private readonly voiceCall = inject(VoiceCallService);
  private readonly realtime = inject(ConversationRealtimeService);
  private readonly auth = inject(AuthService, { optional: true });
  private readonly toast = inject(ToastService, { optional: true });
  private readonly i18n = inject(TranslationService, { optional: true });
  private currentDiagramId: string | null = null;
  private callWatcher?: Subscription;

  readonly requestedScope = signal<ChatScope | null>(null);
  readonly openRequests = signal(0);
  readonly hasMultipleCollaborators = signal<boolean>(false);
  readonly noteInsertionRequest = signal<ProactiveSuggestion | null>(null);

  get activeSuggestion(): Signal<ProactiveSuggestion | null> {
    return this.suggestions.activeSuggestion;
  }

  get suggestionsMuted(): Signal<boolean> {
    return this.suggestions.muted;
  }

  get inCall(): Signal<boolean> {
    return this.voiceCall.inCall;
  }

  get callParticipants(): Signal<CallParticipant[]> {
    return this.voiceCall.participants;
  }

  get activeCallDiagramId(): Signal<string | null> {
    return this.voiceCall.activeDiagramId;
  }

  /** Solicita al editor abrir el panel lateral de Kanon en la pestaña indicada. */
  requestOpenPanel(scope: ChatScope): void {
    this.requestedScope.set(scope);
    this.openRequests.update((count) => count + 1);
  }

  /** Reenvía el snapshot estructural del diagrama al motor de sugerencias proactivas y vigila llamadas entrantes. */
  observeDiagramSnapshot(
    diagramId: string | null,
    diagramType: string,
    nodes: readonly unknown[],
    connections: readonly unknown[],
  ): void {
    if (this.currentDiagramId !== diagramId) {
      this.currentDiagramId = diagramId;
      this.callWatcher?.unsubscribe();
      this.callWatcher = undefined;
      if (diagramId) {
        this.callWatcher = this.realtime.watch(diagramId).subscribe((notice) => {
          if (notice.kind === 'call_started') {
            const myId = this.auth?.currentUser()?.id;
            if (notice.caller.userId !== myId) {
              const text = this.i18n?.t('chat.callStartedToast', { name: notice.caller.displayName }) ||
                `${notice.caller.displayName} inició una llamada grupal en el diagrama.`;
              this.toast?.info(text);
            }
          }
        });
      }
    }
    this.suggestions.observeSnapshot(diagramId, diagramType, nodes, connections);
  }

  /** Cancela la suscripción a eventos de llamadas del diagrama. */
  ngOnDestroy(): void {
    this.callWatcher?.unsubscribe();
    this.callWatcher = undefined;
  }

  /** Descarta la notificación flotante activa. */
  dismissSuggestion(): void {
    this.suggestions.dismiss();
  }

  /** Silencia o reactiva sugerencias proactivas durante la sesión. */
  setSuggestionsMuted(muted: boolean): void {
    this.suggestions.setMuted(muted);
  }

  /** Informa si el proyecto actual tiene más de un colaborador para ajustar ámbitos y visibilidad. */
  setHasMultipleCollaborators(hasMultiple: boolean): void {
    this.hasMultipleCollaborators.set(hasMultiple);
  }

  /** Solicita insertar la sugerencia autónoma activa (o proporcionada) como nota flotante morada en el lienzo. */
  requestAddSuggestionAsNote(suggestion?: ProactiveSuggestion): void {
    const target = suggestion || this.suggestions.activeSuggestion();
    if (target) {
      this.noteInsertionRequest.set(target);
      this.dismissSuggestion();
    }
  }

  /** Limpia la solicitud de inserción de nota tras ser procesada por el editor. */
  clearNoteInsertionRequest(): void {
    this.noteInsertionRequest.set(null);
  }

  /** Siembra la sugerencia aceptada en el chat personal o grupal y abre el panel de Kanon. */
  async continueSuggestionInChat(scope: ChatScope = 'personal'): Promise<void> {
    const targetScope: ChatScope = this.hasMultipleCollaborators() ? scope : 'personal';
    await this.suggestions.acceptCurrentSuggestion(targetScope);
    this.requestOpenPanel(targetScope);
  }

  /** Abre el modal de consentimiento individual y une al usuario a la llamada grupal. */
  requestJoinCall(diagramId: string): void {
    this.voiceCall.promptJoin(diagramId);
  }
}
