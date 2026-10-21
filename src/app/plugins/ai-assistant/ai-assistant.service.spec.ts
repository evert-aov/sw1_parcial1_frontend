import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { AiAssistantService, AvailableModelsResponse, AiResponse } from './ai-assistant.service';

describe('AiAssistantService', () => {
  let service: AiAssistantService;
  let mockHttpClient: any;

  beforeEach(() => {
    mockHttpClient = {
      get: vi.fn(),
      post: vi.fn(),
    };
    service = Object.create(AiAssistantService.prototype);
    (service as any).http = mockHttpClient;
    (service as any).apiUrl = 'http://localhost:3000/api/ai';
  });

  it('debe solicitar la lista de modelos disponibles a /ai/models', () => {
    const mockResponse: AvailableModelsResponse = {
      defaultModel: 'gemini-2.5-flash',
      defaultProvider: 'vertex',
      isOllamaAvailable: false,
      models: [
        {
          id: 'gemini-2.5-flash',
          name: 'Google Gemini 2.5 Flash',
          provider: 'vertex',
          isLocal: false,
        },
      ],
    };

    mockHttpClient.get.mockReturnValue(of(mockResponse));

    service.getAvailableModels().subscribe((res) => {
      expect(res).toEqual(mockResponse);
      expect(res.models.length).toBe(1);
      expect(res.isOllamaAvailable).toBe(false);
    });

    expect(mockHttpClient.get).toHaveBeenCalledWith(expect.stringContaining('/ai/models'));
  });

  it('debe enviar el proveedor y modelo seleccionados al invocar sendTextPrompt', () => {
    const mockAiResponse: AiResponse = {
      success: true,
      action: 'diagram_mutated',
      message: 'Tabla Creada',
      nodes: [],
      connections: [],
      changesSummary: 'Cambio aplicado',
      providerUsed: 'vertex',
      modelUsed: 'gemini-2.5-flash',
    };

    mockHttpClient.post.mockReturnValue(of(mockAiResponse));

    service
      .sendTextPrompt(
        'Crea tabla Factura',
        'diag-123',
        'ROOM-1',
        [],
        [],
        [],
        { provider: 'vertex', model: 'gemini-2.5-flash' },
      )
      .subscribe((res) => {
        expect(res).toEqual(mockAiResponse);
        expect(res.providerUsed).toBe('vertex');
        expect(res.modelUsed).toBe('gemini-2.5-flash');
      });

    expect(mockHttpClient.post).toHaveBeenCalledWith(
      expect.stringContaining('/ai/prompt'),
      expect.objectContaining({
        prompt: 'Crea tabla Factura',
        diagramId: 'diag-123',
        roomCode: 'ROOM-1',
        provider: 'vertex',
        model: 'gemini-2.5-flash',
      }),
    );
  });
});
