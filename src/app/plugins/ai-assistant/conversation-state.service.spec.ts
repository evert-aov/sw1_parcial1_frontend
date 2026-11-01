import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NEVER, of, Subject, throwError } from 'rxjs';
import { ConversationRealtimeService, ConversationNotice } from './conversation-realtime.service';
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
  let notices: Subject<ConversationNotice>;
  beforeEach(() => {
    vi.useFakeTimers();
    notices = new Subject<ConversationNotice>();
    Object.values(api).forEach(mock => mock.mockReset());
    api.history.mockReturnValue(of({ messages: [], revision: 0, hasMore: false }));
    api.getAvailableModels.mockReturnValue(of({ defaultProvider: 'ollama', mediaProvider: 'vertex', models: [] }));
    TestBed.configureTestingModule({ providers: [ConversationStateService, { provide: AiAssistantService, useValue: api },
      { provide: ConversationRealtimeService, useValue: { watch: () => notices } } ] });
    state = TestBed.inject(ConversationStateService);
  });
  afterEach(() => { state.ngOnDestroy(); TestBed.resetTestingModule(); vi.useRealTimers(); });

  it('applies pushed snapshots immediately in a hidden tab without another HTTP read', async () => {
    state.connect('diagram');
    await Promise.resolve();
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    try {
      document.dispatchEvent(new Event('visibilitychange'));
      notices.next({ kind: 'changed', scope: 'group', revision: 3,
        snapshot: { revision: 3, messages: [message('instant', 1)], hasMore: false } });
      expect(state.messages()[0].id).toBe('instant');
      expect(api.history).toHaveBeenCalledTimes(1);
    } finally { hidden.mockRestore(); }
  });

  it('keeps a newer socket snapshot when an older HTTP response arrives', async () => {
    const pending = new Subject<ChatHistory>();
    api.history.mockReturnValueOnce(pending);
    state.connect('diagram');
    notices.next({ kind: 'changed', scope: 'group', revision: 5,
      snapshot: { revision: 5, messages: [message('new', 1)], hasMore: false } });
    pending.next({ revision: 1, messages: [message('old', 1)], hasMore: false });
    await Promise.resolve();
    expect(state.messages().map(item => item.id)).toEqual(['new']);
    notices.next({ kind: 'changed', scope: 'personal', revision: 8,
      snapshot: { revision: 8, messages: [message('private', 1)], hasMore: false } });
    expect(state.messages().map(item => item.id)).toEqual(['new']);
    state.setScope('personal');
    expect(state.messages().map(item => item.id)).toEqual(['private']);
  });

  it('does not downgrade a pushed message when the submit acknowledgement arrives late', async () => {
    state.connect('diagram');
    await Promise.resolve();
    const pending = new Subject<ChatMessage>();
    api.submit.mockReturnValue(pending);
    const sending = state.send({ content: 'hello', provider: 'vertex' });
    notices.next({ kind: 'changed', scope: 'group', revision: 5,
      snapshot: { revision: 5, messages: [message('same', 1)], hasMore: false } });
    pending.next({ ...message('same', 1), status: 'queued' });
    await sending;
    expect(state.messages()[0].status).toBe('completed');
  });

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

  it('loads the catalog once and waits thirty seconds for the history safety check', async () => {
    const models = new Subject<ChatModels>();
    api.getAvailableModels.mockReturnValue(models);
    state.connect('diagram');
    await vi.advanceTimersByTimeAsync(4500);
    expect(api.history).toHaveBeenCalledTimes(1);
    expect(api.getAvailableModels).toHaveBeenCalledTimes(1);
    expect(state.connected()).toBe(true);
    models.next({ defaultProvider: 'ollama', mediaProvider: 'vertex', models: [] });
    await vi.advanceTimersByTimeAsync(6000);
    expect(api.getAvailableModels).toHaveBeenCalledTimes(1);
  });

  it('refreshes on changes and coalesces duplicate or stale revisions', async () => {
    state.connect('diagram');
    await Promise.resolve();
    api.history.mockReturnValue(of({ messages: [message('new', 1)], revision: 5, hasMore: false }));
    notices.next({ kind: 'changed', revision: 5 });
    notices.next({ kind: 'changed', revision: 5 });
    await vi.advanceTimersByTimeAsync(150);
    expect(api.history).toHaveBeenCalledTimes(2);
    notices.next({ kind: 'changed', revision: 4 });
    notices.next({ kind: 'changed', revision: 5 });
    await vi.advanceTimersByTimeAsync(29_999);
    expect(api.history).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(api.history).toHaveBeenCalledTimes(3);
  });

  it('keeps a single request in flight and recovers a change that arrives during it', async () => {
    const pending = new Subject<ChatHistory>();
    api.history.mockReturnValueOnce(pending).mockReturnValue(of({ messages: [], revision: 2, hasMore: false }));
    state.connect('diagram');
    notices.next({ kind: 'changed', revision: 2 });
    await vi.advanceTimersByTimeAsync(500);
    expect(api.history).toHaveBeenCalledTimes(1);
    pending.next({ messages: [], revision: 1, hasMore: false });
    await vi.advanceTimersByTimeAsync(150);
    expect(api.history).toHaveBeenCalledTimes(2);
  });

  it('resynchronizes after reconnect and unsubscribes notifications when closed', async () => {
    state.connect('diagram');
    await Promise.resolve();
    notices.next({ kind: 'ready' });
    await vi.advanceTimersByTimeAsync(150);
    expect(api.history).toHaveBeenCalledTimes(2);
    expect(notices.observed).toBe(true);
    state.connect(null);
    expect(notices.observed).toBe(false);
    notices.next({ kind: 'changed', revision: 9 });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(api.history).toHaveBeenCalledTimes(2);
  });

  it('pauses history in a hidden tab and recovers missed changes when visible', async () => {
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    try {
      state.connect('diagram');
      await Promise.resolve();
      hidden.mockReturnValue(true);
      document.dispatchEvent(new Event('visibilitychange'));
      notices.next({ kind: 'changed', revision: 4 });
      await vi.advanceTimersByTimeAsync(90_000);
      expect(api.history).toHaveBeenCalledTimes(1);
      hidden.mockReturnValue(false);
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(150);
      expect(api.history).toHaveBeenCalledTimes(2);
    } finally { hidden.mockRestore(); }
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
    await vi.advanceTimersByTimeAsync(30_000);
    expect(state.messages().map(item => item.id)).toEqual(['first', 'second']);
  });
  it('arms history only after a confirmed page and resets readiness on scope changes', async () => {
    const pending = new Subject<ChatHistory>();
    api.history.mockReturnValueOnce(pending);
    state.connect('diagram');
    expect(state.historyLoaded()).toBe(false);
    notices.next({ kind: 'changed', scope: 'group', revision: 5,
      snapshot: { revision: 5, messages: [], hasMore: false } });
    expect(state.historyLoaded()).toBe(true);
    pending.next({ revision: 1, messages: [], hasMore: false });
    await Promise.resolve();
    state.setScope('personal');
    expect(state.historyLoaded()).toBe(false);
    await Promise.resolve();
    expect(state.historyLoaded()).toBe(true);
    state.setScope('group');
    expect(state.historyLoaded()).toBe(false);
    await Promise.resolve();
    expect(state.historyLoaded()).toBe(true);
    state.connect(null);
    expect(state.historyLoaded()).toBe(false);
  });

  it('keeps live text over intermediate snapshots and accepts the durable final reply', async () => {
    state.connect('diagram');
    await Promise.resolve();
    const live = { ...message('native', 2), source: 'assistant' as const, speechMode: 'live' as const, streaming: true, content: 'Hola Ada' };
    notices.next({ kind: 'live', message: live });
    notices.next({ kind: 'live', message: { ...live, content: 'Hola' } });
    expect(state.messages()[0].content).toBe('Hola Ada');
    notices.next({ kind: 'changed', scope: 'group', revision: 2,
      snapshot: { revision: 2, messages: [{ ...live, content: '' }], hasMore: false } });
    expect(state.messages()[0].content).toBe('Hola Ada');
    notices.next({ kind: 'changed', scope: 'group', revision: 3,
      snapshot: { revision: 3, messages: [{ ...live, content: 'Hola Ada, listo.', streaming: false }], hasMore: false } });
    expect(state.messages()[0].content).toBe('Hola Ada, listo.');
    notices.next({ kind: 'live', message: live });
    expect(state.messages()[0].content).toBe('Hola Ada, listo.');
    expect(state.messages()[0].streaming).toBe(false);
  });

});

describe('Conversation recovery after a long disconnect', () => {
  it('fills the gap between the displayed history and the latest page', async () => {
    const api = { history: vi.fn(), getAvailableModels: vi.fn().mockReturnValue(of({ defaultProvider: 'ollama', mediaProvider: 'vertex', models: [] })) };
    api.history.mockReturnValueOnce(of({ revision: 1, messages: [message('first', 1)], hasMore: false }))
      .mockReturnValueOnce(of({ revision: 3, messages: [message('third', 3)], hasMore: true }))
      .mockReturnValueOnce(of({ revision: 3, messages: [message('first', 1), message('second', 2)], hasMore: false }));
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [ConversationStateService, { provide: AiAssistantService, useValue: api },
      { provide: ConversationRealtimeService, useValue: { watch: () => NEVER } } ] });
    const state = TestBed.inject(ConversationStateService);
    try {
      state.connect('diagram');
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(30_000);
      expect(state.messages().map(item => item.sequence)).toEqual([1, 2, 3]);
      expect(api.history).toHaveBeenLastCalledWith('diagram', 3);
    } finally { state.ngOnDestroy(); TestBed.resetTestingModule(); vi.useRealTimers(); }
  });


});
