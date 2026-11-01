import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AiAssistantService as ConversationPort,
  ChatHistory,
  ChatMessage,
  ChatModels,
  ChatScope,
  ChatSubmission,
  ChatSuggestionAccept,
  ChatSuggestionRequest,
  ChatVoice,
  SpeechPlayback,
  ProactiveSuggestion,
} from '../../core/plugins/contracts/ai-assistant.service.contract';

/** Adaptador del API autorizado de NestJS; nunca se conecta directamente a los modelos. */
@Injectable({ providedIn: 'root' })
export class AiAssistantService implements ConversationPort {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/conversations`;

  /** Obtiene capacidades y disponibilidad declarada de los proveedores. */
  getAvailableModels(): Observable<ChatModels> {
    return this.get<ChatModels>('/models');
  }

  /** Recupera los últimos mensajes o una página anterior a una secuencia según ámbito. */
  history(diagramId: string, before?: number, scope?: ChatScope): Observable<ChatHistory> {
    const query = this.buildQuery({
      before: before ? String(before) : undefined,
      scope: scope === 'personal' ? 'personal' : undefined,
    });
    return this.get<ChatHistory>(`/${diagramId}/messages${query}`);
  }

  /** Envía texto o medios con una clave estable para reintentos de red. */
  submit(diagramId: string, message: ChatSubmission): Observable<ChatMessage> {
    return this.post<ChatMessage>(`/${diagramId}/messages`, message);
  }

  /** Reencola un mensaje fallido cuyo autor es el usuario autenticado. */
  retry(diagramId: string, messageId: string, scope?: ChatScope): Observable<ChatMessage> {
    const query = this.buildQuery({ scope: scope === 'personal' ? 'personal' : undefined });
    return this.post<ChatMessage>(`/${diagramId}/messages/${messageId}/retry${query}`, {});
  }

  /** Aplica una propuesta confirmada por el usuario en el servidor autoritativo. */
  apply(diagramId: string, proposalId: string, scope?: ChatScope): Observable<unknown> {
    const query = this.buildQuery({ scope: scope === 'personal' ? 'personal' : undefined });
    return this.post(`/${diagramId}/proposals/${proposalId}/apply${query}`, {});
  }

  /** Recupera el medio con el interceptor JWT habitual y sin URL pública. */
  attachment(diagramId: string, messageId: string, scope?: ChatScope): Observable<Blob> {
    const query = this.buildQuery({ scope: scope === 'personal' ? 'personal' : undefined });
    return this.http.get(`${this.baseUrl}/${diagramId}/messages/${messageId}/attachment${query}`, {
      responseType: 'blob',
    });
  }

  /** Recupera voz de texto persistido a través de NestJS y su autorización habitual. */
  speech(diagramId: string, messageId: string, voice: ChatVoice, scope?: ChatScope): Observable<Blob> {
    const query = this.buildQuery({ scope: scope === 'personal' ? 'personal' : undefined });
    return this.http.post(
      `${this.baseUrl}/${diagramId}/messages/${messageId}/speech${query}`,
      { voice },
      { responseType: 'blob' },
    );
  }

  /** Obtiene audio privado y marcas temporales para subtítulos sincronizados. */
  speechPlayback(diagramId: string, messageId: string, scope?: ChatScope): Observable<SpeechPlayback> {
    const query = this.buildQuery({ scope: scope === 'personal' ? 'personal' : undefined });
    return this.post<SpeechPlayback>(`/${diagramId}/messages/${messageId}/speech-playback${query}`, { voice: 'marcelo' });
  }

  /** Solicita una sugerencia proactiva de Kanon basada en hallazgos locales del diagrama. */
  suggest(
    diagramId: string,
    request: ChatSuggestionRequest,
  ): Observable<{ suggestion: ProactiveSuggestion | null }> {
    return this.post<{ suggestion: ProactiveSuggestion | null }>(`/${diagramId}/suggestions`, request);
  }

  /** Siembra de forma idempotente una sugerencia aceptada en el chat personal del usuario. */
  acceptSuggestion(diagramId: string, request: ChatSuggestionAccept): Observable<ChatMessage> {
    return this.post<ChatMessage>(`/${diagramId}/suggestions/accept`, request);
  }

  /** Construye sufijo query opcional omitiendo parámetros por defecto para preservar rutas limpias. */
  private buildQuery(params: Record<string, string | undefined>): string {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) search.set(key, value);
    });
    const serialized = search.toString();
    return serialized ? `?${serialized}` : '';
  }

  /** Desenvuelve la respuesta estándar del backend para consultas. */
  private get<T>(path: string): Observable<T> {
    return this.http.get<{ data: T }>(this.baseUrl + path).pipe(map((response) => response.data));
  }

  /** Desenvuelve la respuesta estándar del backend para comandos. */
  private post<T>(path: string, body: unknown): Observable<T> {
    return this.http
      .post<{ data: T }>(this.baseUrl + path, body)
      .pipe(map((response) => response.data));
  }
}
