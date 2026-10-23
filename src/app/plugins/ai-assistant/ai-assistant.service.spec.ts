import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { firstValueFrom, of } from 'rxjs';
import { AiAssistantService } from './ai-assistant.service';

describe('Group conversation API adapter', () => {
  let service: AiAssistantService;
  let http: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    http = { get: vi.fn(), post: vi.fn() };
    service = Object.create(AiAssistantService.prototype);
    Object.assign(service, { http, baseUrl: '/api/conversations' });
  });

  it('unwraps capabilities from the authenticated product API', async () => {
    const models = { defaultProvider: 'ollama', models: [{ provider: 'ollama', id: 'qwen2.5-coder:14b' }] };
    http.get.mockReturnValue(of({ data: models }));
    expect(await firstValueFrom(service.getAvailableModels())).toEqual(models);
    expect(http.get).toHaveBeenCalledWith('/api/conversations/models');
  });

  it('sends no client author, history or editable diagram snapshot', async () => {
    const submission = { clientMessageId: 'request', content: 'Explain inheritance', provider: 'ollama' as const, askAssistant: true };
    http.post.mockReturnValue(of({ data: { id: 'accepted' } }));
    await firstValueFrom(service.submit('diagram', submission));
    expect(http.post).toHaveBeenCalledWith('/api/conversations/diagram/messages', submission);
    expect(Object.keys(http.post.mock.calls[0][1])).not.toContain('sender');
  });

  it('retrieves private attachment bytes using HttpClient', async () => {
    const blob = new Blob(['audio']);
    http.get.mockReturnValue(of(blob));
    expect(await firstValueFrom(service.attachment('diagram', 'message'))).toBe(blob);
    expect(http.get).toHaveBeenCalledWith('/api/conversations/diagram/messages/message/attachment', { responseType: 'blob' });
  });
});
