import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AiAssistantService as ConversationPort, ChatHistory, ChatMessage, ChatModels, ChatSubmission } from '../../core/plugins/contracts/ai-assistant.service.contract';

/** Adaptador del API autorizado de NestJS; nunca se conecta directamente a los modelos. */
@Injectable({ providedIn: 'root' })
export class AiAssistantService implements ConversationPort {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/conversations`;

  /** Obtiene capacidades y disponibilidad declarada de los proveedores. */
  getAvailableModels(): Observable<ChatModels> { return this.get<ChatModels>('/models'); }

  /** Recupera los últimos mensajes o una página anterior a una secuencia. */
  history(diagramId: string, before?: number): Observable<ChatHistory> {
    return this.get<ChatHistory>(`/${diagramId}/messages${before ? `?before=${before}` : ''}`);
  }

  /** Envía texto o medios con una clave estable para reintentos de red. */
  submit(diagramId: string, message: ChatSubmission): Observable<ChatMessage> {
    return this.post<ChatMessage>(`/${diagramId}/messages`, message);
  }

  /** Reencola un mensaje fallido cuyo autor es el usuario autenticado. */
  retry(diagramId: string, messageId: string): Observable<ChatMessage> {
    return this.post<ChatMessage>(`/${diagramId}/messages/${messageId}/retry`, {});
  }

  /** Aplica una propuesta confirmada por el usuario en el servidor autoritativo. */
  apply(diagramId: string, proposalId: string): Observable<unknown> {
    return this.post(`/${diagramId}/proposals/${proposalId}/apply`, {});
  }

  /** Recupera el medio con el interceptor JWT habitual y sin URL pública. */
  attachment(diagramId: string, messageId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${diagramId}/messages/${messageId}/attachment`, { responseType: 'blob' });
  }

  /** Desenvuelve la respuesta estándar del backend para consultas. */
  private get<T>(path: string): Observable<T> { return this.http.get<{ data: T }>(this.baseUrl + path).pipe(map(response => response.data)); }

  /** Desenvuelve la respuesta estándar del backend para comandos. */
  private post<T>(path: string, body: unknown): Observable<T> { return this.http.post<{ data: T }>(this.baseUrl + path, body).pipe(map(response => response.data)); }
}
