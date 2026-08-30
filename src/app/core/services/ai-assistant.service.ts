import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UmlClassNode, UmlConnection } from '../models/diagram.model';
import { environment } from '../../../environments/environment';

export interface AiResponse {
  success: boolean;
  action: string;
  message: string;
  nodes: UmlClassNode[];
  connections: UmlConnection[];
  changesSummary: string;
}

@Injectable({
  providedIn: 'root',
})
export class AiAssistantService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/ai`;

  sendTextPrompt(
    prompt: string,
    diagramId: string,
    roomCode?: string,
    currentNodes: UmlClassNode[] = [],
    currentConnections: UmlConnection[] = [],
    sessionHistory: any[] = [],
  ): Observable<AiResponse> {
    return this.http.post<AiResponse>(`${this.apiUrl}/prompt`, {
      prompt,
      diagramId,
      roomCode,
      currentNodes,
      currentConnections,
      sessionHistory,
    });
  }

  sendVisionPrompt(
    imageBase64: string,
    mimeType: string,
    prompt: string | undefined,
    diagramId: string,
    roomCode?: string,
    currentNodes: UmlClassNode[] = [],
    currentConnections: UmlConnection[] = [],
    sessionHistory: any[] = [],
  ): Observable<AiResponse> {
    return this.http.post<AiResponse>(`${this.apiUrl}/vision-diagram`, {
      imageBase64,
      mimeType,
      prompt,
      diagramId,
      roomCode,
      currentNodes,
      currentConnections,
      sessionHistory,
    });
  }
}
