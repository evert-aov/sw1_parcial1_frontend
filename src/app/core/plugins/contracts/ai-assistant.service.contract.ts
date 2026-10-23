import { InjectionToken, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PluginRegistryService } from '../plugin-registry.service';

export type ChatProvider = 'ollama' | 'vertex';
export interface ChatAttachment { kind: 'image' | 'audio'; mimeType: string; data: string; name?: string }
export interface ChatSubmission { clientMessageId: string; content: string; provider: ChatProvider; askAssistant: boolean; attachment?: ChatAttachment }
export interface ChatProposal { id: string; status: 'pending' | 'applied'; baseRevision: string; summary: string; ast: { nodes: unknown[]; connections: unknown[] } }
export interface ChatMessage {
  id: string;
  sequence: number;
  sender: { userId?: string; displayName: string; role?: string; kind?: 'assistant' };
  content: string;
  createdAt: string;
  source: 'text' | 'image' | 'audio' | 'assistant';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  provider?: ChatProvider;
  model?: string;
  replyTo?: string;
  intent?: 'mentorship' | 'modeling' | 'hybrid';
  proposal?: ChatProposal;
  attachment?: { mimeType: string; name: string };
}
export interface ChatHistory { revision: number; messages: ChatMessage[]; hasMore: boolean }
export interface ChatModels {
  defaultProvider: ChatProvider;
  mediaProvider: 'vertex';
  models: { id: string; provider: ChatProvider; available: boolean; inputs: string[]; mediaVia?: string }[];
}

/** Puerto de conversación; el núcleo desconoce HTTP, prompts y proveedores concretos. */
export interface AiAssistantService {
  /** Descubre capacidades configuradas del microservicio. */
  getAvailableModels(): Observable<ChatModels>;
  /** Recupera historial compartido y paginado. */
  history(diagramId: string, before?: number): Observable<ChatHistory>;
  /** Envía una intervención idempotente sin identidad confiada al navegador. */
  submit(diagramId: string, message: ChatSubmission): Observable<ChatMessage>;
  /** Reintenta un turno fallido sin duplicar el mensaje. */
  retry(diagramId: string, messageId: string): Observable<ChatMessage>;
  /** Solicita aplicación explícita con permisos y revisión validados por NestJS. */
  apply(diagramId: string, proposalId: string): Observable<unknown>;
  /** Descarga un adjunto mediante la sesión autenticada. */
  attachment(diagramId: string, messageId: string): Observable<Blob>;
}
export const AiAssistantService: InjectionToken<AiAssistantService> = new InjectionToken<AiAssistantService>('AiAssistantService', {
  providedIn: 'root', factory: () => inject(PluginRegistryService).resolve(AiAssistantService),
});
