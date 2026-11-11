import { InjectionToken, Signal, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PluginRegistryService } from '../plugin-registry.service';

export type ChatProvider = 'ollama' | 'vertex';
export type ChatVoice = 'marcelo';
export type ChatScope = 'group' | 'personal';
export type ChatChannel = 'chat' | 'call';

export interface ChatAttachment {
  kind: 'image' | 'audio';
  mimeType: string;
  data: string;
  name?: string;
}

export interface ChatSubmission {
  clientMessageId: string;
  content: string;
  provider: ChatProvider;
  askAssistant?: boolean;
  scope?: ChatScope;
  channel?: ChatChannel;
  language?: 'es' | 'en';
  attachment?: ChatAttachment;
}

export interface ChatProposal {
  id: string;
  status: 'pending' | 'applied';
  baseRevision: string;
  summary: string;
  ast: { nodes: unknown[]; connections: unknown[] };
}

export interface ChatMessage {
  id: string;
  sequence: number;
  scope?: ChatScope;
  channel?: ChatChannel;
  sender: { userId?: string; displayName: string; role?: string; kind?: 'assistant' };
  content: string;
  transcription?: string;
  createdAt: string;
  source: 'text' | 'image' | 'audio' | 'assistant';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  provider?: ChatProvider;
  model?: string;
  replyTo?: string;
  replyToUser?: { userId?: string; displayName: string };
  replyToSource?: string;
  replyToChannel?: string;
  speechMode?: 'live';
  streaming?: boolean;
  interrupted?: boolean;
  suggestionTitle?: string;
  intent?: 'mentorship' | 'modeling' | 'hybrid';
  proposal?: ChatProposal;
  attachment?: { mimeType: string; name: string };
}

export interface ChatHistory {
  revision: number;
  messages: ChatMessage[];
  hasMore: boolean;
}

export interface SpeechCue { startMs: number; endMs: number; text: string; }
export interface SpeechPlayback { audioBase64: string; mimeType: string; cues: SpeechCue[]; }

export interface ChatModels {
  defaultProvider: ChatProvider;
  mediaProvider: 'vertex';
  models: { id: string; provider: ChatProvider; available: boolean; inputs: string[]; audioVia?: string }[];
}

export interface SuggestionFinding {
  code?: string;
  ruleId: string;
  severity: 'info' | 'warning';
  title: string;
  detail: string;
  elementIds?: string[];
}

export interface ChatSuggestionRequest {
  clientSuggestionId: string;
  diagramType: string;
  provider?: 'ollama' | 'vertex';
  language?: 'es' | 'en';
  findings: SuggestionFinding[];
}

export interface ProactiveSuggestion {
  id: string;
  diagramId: string;
  title: string;
  summary: string;
  severity: 'info' | 'warning';
  createdAt: string;
}

export interface ChatSuggestionAccept {
  clientSuggestionId: string;
  title: string;
  summary: string;
  language?: 'es' | 'en';
  scope?: ChatScope;
}

export interface CallParticipant {
  socketId: string;
  userId: string;
  displayName: string;
  muted: boolean;
  aiConsent: boolean;
  speaking?: boolean;
}

/** Puerto de conversación; el núcleo desconoce HTTP, prompts y proveedores concretos. */
export interface AiAssistantService {
  /** Descubre capacidades configuradas del microservicio. */
  getAvailableModels(): Observable<ChatModels>;
  /** Recupera historial paginado del ámbito solicitado (grupal o personal). */
  history(diagramId: string, before?: number, scope?: ChatScope): Observable<ChatHistory>;
  /** Envía una intervención idempotente sin identidad confiada al navegador. */
  submit(diagramId: string, message: ChatSubmission): Observable<ChatMessage>;
  /** Reintenta un turno fallido sin duplicar el mensaje. */
  retry(diagramId: string, messageId: string, scope?: ChatScope): Observable<ChatMessage>;
  /** Solicita aplicación explícita con permisos y revisión validados por NestJS. */
  apply(diagramId: string, proposalId: string, scope?: ChatScope): Observable<unknown>;
  /** Descarga un adjunto mediante la sesión autenticada. */
  attachment(diagramId: string, messageId: string, scope?: ChatScope): Observable<Blob>;
  /** Sintetiza una respuesta existente; devuelve audio privado sin crear otro turno. */
  speech(diagramId: string, messageId: string, voice: ChatVoice, scope?: ChatScope): Observable<Blob>;
  /** Descarga audio y marcas temporales de la voz fija de Kanon. */
  speechPlayback(diagramId: string, messageId: string, scope?: ChatScope): Observable<SpeechPlayback>;
  /** Solicita una sugerencia autónoma de Kanon sin alterar el historial de conversación. */
  suggest?(diagramId: string, request: ChatSuggestionRequest): Observable<{ suggestion: ProactiveSuggestion | null }>;
  /** Acepta una sugerencia autónoma sembrándola en el chat personal para continuar la charla. */
  acceptSuggestion?(diagramId: string, request: ChatSuggestionAccept): Observable<ChatMessage>;
}

export const AiAssistantService: InjectionToken<AiAssistantService> = new InjectionToken<AiAssistantService>(
  'AiAssistantService',
  {
    providedIn: 'root',
    factory: () => inject(PluginRegistryService).resolve(AiAssistantService),
  },
);

/** Contrato reactivo de coordinación entre el editor, el lanzador flotante y Kanon. */
export interface AiAssistantCoordinator {
  readonly requestedScope: Signal<ChatScope | null>;
  readonly openRequests: Signal<number>;
  readonly activeSuggestion: Signal<ProactiveSuggestion | null>;
  readonly suggestionsMuted: Signal<boolean>;
  readonly inCall: Signal<boolean>;
  readonly callParticipants: Signal<CallParticipant[]>;
  readonly activeCallDiagramId: Signal<string | null>;
  readonly hasMultipleCollaborators: Signal<boolean>;
  readonly noteInsertionRequest: Signal<ProactiveSuggestion | null>;

  /** Informa si el proyecto actual tiene más de un colaborador para ajustar ámbitos y visibilidad. */
  setHasMultipleCollaborators(hasMultiple: boolean): void;
  /** Solicita insertar la sugerencia autónoma activa (o proporcionada) como nota flotante morada en el lienzo. */
  requestAddSuggestionAsNote(suggestion?: ProactiveSuggestion): void;
  /** Limpia la solicitud de inserción de nota tras ser procesada por el editor. */
  clearNoteInsertionRequest(): void;

  /** Solicita abrir el panel lateral de Kanon enfocando la pestaña indicada. */
  requestOpenPanel(scope: ChatScope): void;
  /** Recibe instantáneas estructurales del diagrama activo para evaluar sugerencias autónomas. */
  observeDiagramSnapshot(
    diagramId: string | null,
    diagramType: string,
    nodes: readonly unknown[],
    connections: readonly unknown[],
  ): void;
  /** Descarta la sugerencia proactiva actual sin abrir el chat. */
  dismissSuggestion(): void;
  /** Silencia o reactiva las sugerencias proactivas durante la sesión actual. */
  setSuggestionsMuted(muted: boolean): void;
  /** Siembra la sugerencia activa en el chat (personal o grupal) de Kanon y abre el panel. */
  continueSuggestionInChat(scope?: ChatScope): Promise<void>;
  /** Solicita iniciar o unirse a la llamada de voz grupal del diagrama indicado. */
  requestJoinCall(diagramId: string): void;
}

export const AiAssistantCoordinator: InjectionToken<AiAssistantCoordinator> =
  new InjectionToken<AiAssistantCoordinator>('AiAssistantCoordinator', {
    providedIn: 'root',
    factory: () => inject(PluginRegistryService).resolve(AiAssistantCoordinator),
  });
