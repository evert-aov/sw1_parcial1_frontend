import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { of, Subject, throwError } from 'rxjs';
import { ConversationStateService } from './conversation-state.service';
import { AiAssistantService } from './ai-assistant.service';
import { ChatHistory, ChatMessage, ChatModels } from '../../core/plugins/contracts/ai-assistant.service.contract';

/** Crea un mensaje canónico mínimo para comprobar orden, autoría y estados. */
function message(id: string, sequence: number): ChatMessage {
  return { id, sequence, sender: { displayName: 'Alice' }, content: id, createdAt: '', source: 'text', status: 'completed' };
}

describe('Conversation state recovery', () => {
  const api = { history: vi.fn(), getAvailableModels: vi.fn(), submit: vi.fn(), retry: vi.fn() };
  let state: ConversationStateService;
  beforeEach(() => {
    vi.useFakeTimers();
    Object.values(api).forEach(mock => mock.mockReset());
    api.history.mockReturnValue(of({ messages: [], revision: 0, hasMore: false }));
    api.getAvailableModels.mockReturnValue(of({ defaultProvider: 'ollama', mediaProvider: 'vertex', models: [] }));
    TestBed.configureTestingModule({ providers: [ConversationStateService, { provide: AiAssistantService, useValue: api }] });
    state = TestBed.inject(ConversationStateService);
  });
  afterEach(() => { state.ngOnDestroy(); TestBed.resetTestingModule(); vi.useRealTimers(); });

  it('does not query an unsaved diagram or reconnect the same active room', async () => {
    state.connect(null);
    expect(api.history).not.toHaveBeenCalled();
    expect(api.getAvailableModels).not.toHaveBeenCalled();
    state.connect('diagram');
    state.connect('diagram');
    await Promise.resolve();
    state.connect('diagram');
    expect(api.history).toHaveBeenCalledTimes(1);
    expect(api.getAvailableModels).toHaveBeenCalledTimes(1);
  });

  it('keeps one slow catalog request while history continues polling', async () => {
    const models = new Subject<ChatModels>();
    api.getAvailableModels.mockReturnValue(models);
    state.connect('diagram');
    await vi.advanceTimersByTimeAsync(4500);
    expect(api.history).toHaveBeenCalledTimes(4);
    expect(api.getAvailableModels).toHaveBeenCalledTimes(1);
    expect(state.connected()).toBe(true);
    models.next({ defaultProvider: 'ollama', mediaProvider: 'vertex', models: [] });
    await vi.advanceTimersByTimeAsync(6000);
    expect(api.getAvailableModels).toHaveBeenCalledTimes(1);
  });

  it('waits four seconds after a 503 and stops retries on destruction', async () => {
    api.history.mockReturnValue(throwError(() => ({ status: 503 })));
    api.getAvailableModels.mockReturnValue(throwError(() => ({ status: 503 })));
    state.connect('diagram');
    await vi.advanceTimersByTimeAsync(3999);
    expect(api.history).toHaveBeenCalledTimes(1);
    expect(api.getAvailableModels).toHaveBeenCalledTimes(1);
    expect(state.connected()).toBe(false);
    expect(state.error()).toBe('chat.unavailable');
    await vi.advanceTimersByTimeAsync(1);
    expect(api.history).toHaveBeenCalledTimes(2);
    expect(api.getAvailableModels).toHaveBeenCalledTimes(2);
    state.ngOnDestroy();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(api.history).toHaveBeenCalledTimes(2);
    expect(api.getAvailableModels).toHaveBeenCalledTimes(2);
  });

  it('recovers the catalog independently and keeps it after success', async () => {
    api.getAvailableModels.mockReturnValueOnce(throwError(() => ({ status: 503 })));
    state.connect('diagram');
    await vi.advanceTimersByTimeAsync(3999);
    expect(state.connected()).toBe(true);
    expect(state.models()).toBeNull();
    expect(api.getAvailableModels).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(state.models()?.defaultProvider).toBe('ollama');
    expect(state.error()).toBe('');
    await vi.advanceTimersByTimeAsync(12_000);
    expect(api.getAvailableModels).toHaveBeenCalledTimes(2);
  });

  it('unsubscribes pending requests on room changes and destruction', async () => {
    const oldHistory = new Subject<ChatHistory>();
    const oldModels = new Subject<ChatModels>();
    const newHistory = new Subject<ChatHistory>();
    const newModels = new Subject<ChatModels>();
    api.history.mockReturnValueOnce(oldHistory).mockReturnValue(newHistory);
    api.getAvailableModels.mockReturnValueOnce(oldModels).mockReturnValue(newModels);
    state.connect('old');
    expect(oldHistory.observed && oldModels.observed).toBe(true);
    state.connect('new');
    expect(oldHistory.observed || oldModels.observed).toBe(false);
    expect(newHistory.observed && newModels.observed).toBe(true);
    oldModels.next({ defaultProvider: 'vertex', mediaProvider: 'vertex', models: [] });
    await Promise.resolve();
    expect(state.models()).toBeNull();
    state.ngOnDestroy();
    expect(newHistory.observed || newModels.observed).toBe(false);
    state.connect('later');
    await vi.advanceTimersByTimeAsync(30_000);
    expect(api.history).toHaveBeenCalledTimes(2);
    expect(api.getAvailableModels).toHaveBeenCalledTimes(2);
  });

  it('bounds hung requests before scheduling a delayed retry', async () => {
    const history = new Subject<ChatHistory>();
    const models = new Subject<ChatModels>();
    api.history.mockReturnValue(history);
    api.getAvailableModels.mockReturnValue(models);
    state.connect('diagram');
    await vi.advanceTimersByTimeAsync(19_999);
    expect(api.history).toHaveBeenCalledTimes(1);
    expect(api.getAvailableModels).toHaveBeenCalledTimes(1);
    expect(history.observed && models.observed).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(history.observed || models.observed).toBe(false);
    await vi.advanceTimersByTimeAsync(3999);
    expect(api.history).toHaveBeenCalledTimes(1);
    expect(api.getAvailableModels).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(api.history).toHaveBeenCalledTimes(2);
    expect(api.getAvailableModels).toHaveBeenCalledTimes(2);
  });

  it('ignores a delayed history response from another diagram', async () => {
    const oldHistory = new Subject<ChatHistory>();
    api.history.mockReturnValueOnce(oldHistory).mockReturnValueOnce(of({ messages: [message('new', 1)], revision: 1, hasMore: false }));
    state.connect('old');
    state.connect('new');
    await Promise.resolve();
    oldHistory.next({ messages: [message('old', 1)], revision: 1, hasMore: false });
    await Promise.resolve();
    expect(state.messages().map(item => item.id)).toEqual(['new']);
  });

  it('reuses the request identifier after an ambiguous network failure', async () => {
    state.connect('diagram');
    const input = { content: 'Hello', provider: 'ollama' as const, askAssistant: false };
    api.submit.mockReturnValueOnce(throwError(() => new Error('network'))).mockReturnValueOnce(of(message('saved', 1)));
    expect(await state.send(input)).toBe(false);
    expect(await state.send(input)).toBe(true);
    expect(api.submit.mock.calls[0][1].clientMessageId).toBe(api.submit.mock.calls[1][1].clientMessageId);
    expect(state.messages()).toHaveLength(1);
  });

  it('merges confirmed messages in server order without duplicates', async () => {
    api.history.mockReturnValue(of({ messages: [message('second', 2), message('first', 1)], revision: 1, hasMore: false }));
    state.connect('diagram');
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1500);
    expect(state.messages().map(item => item.id)).toEqual(['first', 'second']);
  });
});

describe('Conversation recovery after a long disconnect', () => {
  it('fills the gap between the displayed history and the latest page', async () => {
    const api = { history: vi.fn(), getAvailableModels: vi.fn().mockReturnValue(of({ defaultProvider: 'ollama', mediaProvider: 'vertex', models: [] })) };
    api.history.mockReturnValueOnce(of({ revision: 1, messages: [message('first', 1)], hasMore: false }))
      .mockReturnValueOnce(of({ revision: 3, messages: [message('third', 3)], hasMore: true }))
      .mockReturnValueOnce(of({ revision: 3, messages: [message('first', 1), message('second', 2)], hasMore: false }));
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [ConversationStateService, { provide: AiAssistantService, useValue: api }] });
    const state = TestBed.inject(ConversationStateService);
    try {
      state.connect('diagram');
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(1500);
      expect(state.messages().map(item => item.sequence)).toEqual([1, 2, 3]);
      expect(api.history).toHaveBeenLastCalledWith('diagram', 3);
    } finally { state.ngOnDestroy(); TestBed.resetTestingModule(); vi.useRealTimers(); }
  });
});
