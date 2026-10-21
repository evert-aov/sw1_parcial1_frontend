import { InjectionToken, inject } from '@angular/core';
import { PluginRegistryService } from '../plugin-registry.service';
import { Observable } from 'rxjs';
import { UmlClassNode, UmlConnection } from '../../models/diagram.model';
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
export interface AiAssistantService {
  getAvailableModels(): Observable<AvailableModelsResponse>;
  sendTextPrompt(
    prompt: string,
    diagramId: string,
    roomCode?: string,
    currentNodes?: UmlClassNode[],
    currentConnections?: UmlConnection[],
    sessionHistory?: any[],
    options?: {
      provider?: string;
      model?: string;
      diagramType?: string;
    },
  ): Observable<AiResponse>;
  sendVisionPrompt(
    imageBase64: string,
    mimeType: string,
    prompt: string | undefined,
    diagramId: string,
    roomCode?: string,
    currentNodes?: UmlClassNode[],
    currentConnections?: UmlConnection[],
    sessionHistory?: any[],
    options?: {
      provider?: string;
      model?: string;
      diagramType?: string;
    },
  ): Observable<AiResponse>;
  sendAudioPrompt(
    audioBase64: string,
    mimeType: string,
    prompt: string | undefined,
    diagramId: string,
    roomCode?: string,
    currentNodes?: UmlClassNode[],
    currentConnections?: UmlConnection[],
    sessionHistory?: any[],
    options?: {
      provider?: string;
      model?: string;
      diagramType?: string;
    },
  ): Observable<AiResponse>;
}
export const AiAssistantService: InjectionToken<AiAssistantService> =
  new InjectionToken<AiAssistantService>('AiAssistantService', {
    providedIn: 'root',
    factory: () => inject(PluginRegistryService).resolve(AiAssistantService),
  });
