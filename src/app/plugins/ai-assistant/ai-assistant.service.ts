import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { UmlClassNode, UmlConnection } from '../../core/models/diagram.model';
import { environment } from '../../../environments/environment';

export interface AiModelOption {
  id: string;
  name: string;
  provider: 'vertex';
  isLocal: boolean;
  parameterSize?: string;
  sizeMb?: number;
  description?: string;
}

export interface AvailableModelsResponse {
  defaultModel: string;
  defaultProvider: 'vertex';
  isOllamaAvailable: boolean;
  models: AiModelOption[];
}

export interface AiResponse {
  success: boolean;
  action: string;
  message: string;
  nodes: UmlClassNode[];
  connections: UmlConnection[];
  changesSummary: string;
  providerUsed?: 'vertex';
  modelUsed?: string;
  diagramType?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AiAssistantService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/ai`;

  /**
   * Obtiene la lista de modelos de inteligencia artificial disponibles en el backend.
   * @returns Observable con los modelos soportados y la configuración por defecto.
   */
  getAvailableModels(): Observable<AvailableModelsResponse> {
    return this.http.get<any>(`${this.apiUrl}/models`).pipe(
      map((res) => (res && res.data ? res.data : res) as AvailableModelsResponse),
    );
  }

  /**
   * Envía un prompt textual para generar, editar o reestructurar diagramas mediante IA.
   * @param prompt Instrucción o requerimiento del usuario.
   * @param diagramId Identificador del diagrama actual.
   * @param roomCode Código de la sala colaborativa (opcional).
   * @param currentNodes Nodos existentes en el lienzo.
   * @param currentConnections Conexiones existentes en el lienzo.
   * @param sessionHistory Historial de interacción previo.
   * @param options Configuración de proveedor y modelo de IA.
   * @returns Observable con los nodos y relaciones resultantes o actualizados.
   */
  sendTextPrompt(
    prompt: string,
    diagramId: string,
    roomCode?: string,
    currentNodes: UmlClassNode[] = [],
    currentConnections: UmlConnection[] = [],
    sessionHistory: any[] = [],
    options?: { provider?: string; model?: string; diagramType?: string },
  ): Observable<AiResponse> {
    return this.http.post<any>(`${this.apiUrl}/prompt`, {
      prompt,
      diagramId,
      roomCode,
      currentNodes,
      currentConnections,
      sessionHistory,
      provider: options?.provider || 'vertex',
      model: options?.model || 'gemini-2.5-flash',
      diagramType: options?.diagramType,
    }).pipe(
      map((res) => (res && res.data ? res.data : res) as AiResponse),
    );
  }

  /**
   * Envía una imagen (boceto, foto o diagrama dibujado) junto con un prompt opcional a la IA multimodal.
   * @param imageBase64 Contenido de la imagen en base64.
   * @param mimeType Tipo MIME de la imagen (ej. image/png).
   * @param prompt Instrucción adicional opcional.
   * @param diagramId Identificador del diagrama activo.
   * @param roomCode Código de la sala de colaboración (opcional).
   * @param currentNodes Nodos existentes en el lienzo.
   * @param currentConnections Conexiones existentes en el lienzo.
   * @param sessionHistory Historial de la sesión.
   * @param options Proveedor y modelo seleccionado.
   * @returns Observable con los componentes UML reconocidos y sintetizados.
   */
  sendVisionPrompt(
    imageBase64: string,
    mimeType: string,
    prompt: string | undefined,
    diagramId: string,
    roomCode?: string,
    currentNodes: UmlClassNode[] = [],
    currentConnections: UmlConnection[] = [],
    sessionHistory: any[] = [],
    options?: { provider?: string; model?: string; diagramType?: string },
  ): Observable<AiResponse> {
    return this.http.post<any>(`${this.apiUrl}/vision-diagram`, {
      imageBase64,
      mimeType,
      prompt,
      diagramId,
      roomCode,
      currentNodes,
      currentConnections,
      sessionHistory,
      provider: options?.provider || 'vertex',
      model: options?.model || 'gemini-2.5-flash',
      diagramType: options?.diagramType,
    }).pipe(
      map((res) => (res && res.data ? res.data : res) as AiResponse),
    );
  }

  /**
   * Envía una grabación de audio con comandos de voz para que el asistente de IA procese el diagrama.
   * @param audioBase64 Contenido de audio codificado en base64.
   * @param mimeType Formato de audio (ej. audio/webm).
   * @param prompt Texto transcrito o indicaciones complementarias.
   * @param diagramId Identificador del diagrama actual.
   * @param roomCode Código de la sala colaborativa (opcional).
   * @param currentNodes Nodos actuales en el lienzo.
   * @param currentConnections Conexiones actuales en el lienzo.
   * @param sessionHistory Historial de conversación previo.
   * @param options Proveedor y modelo seleccionado.
   * @returns Observable con el diagrama actualizado tras el comando por voz.
   */
  sendAudioPrompt(
    audioBase64: string,
    mimeType: string,
    prompt: string | undefined,
    diagramId: string,
    roomCode?: string,
    currentNodes: UmlClassNode[] = [],
    currentConnections: UmlConnection[] = [],
    sessionHistory: any[] = [],
    options?: { provider?: string; model?: string; diagramType?: string },
  ): Observable<AiResponse> {
    return this.http.post<any>(`${this.apiUrl}/audio-prompt`, {
      audioBase64,
      mimeType,
      prompt,
      diagramId,
      roomCode,
      currentNodes,
      currentConnections,
      sessionHistory,
      provider: options?.provider || 'vertex',
      model: options?.model || 'gemini-2.5-flash',
      diagramType: options?.diagramType,
    }).pipe(
      map((res) => (res && res.data ? res.data : res) as AiResponse),
    );
  }
}

