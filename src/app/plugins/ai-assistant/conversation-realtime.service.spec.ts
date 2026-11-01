import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../core/services/auth.service';
import { ConversationNotice, ConversationRealtimeService } from './conversation-realtime.service';

const mocked = vi.hoisted(() => ({ io: vi.fn() }));
vi.mock('socket.io-client', () => ({ io: mocked.io }));

describe('Conversation socket transport', () => {
  let service: ConversationRealtimeService;
  let handlers: Record<string, (...args: unknown[]) => void>;
  let socket: { id: string; connected: boolean; on: ReturnType<typeof vi.fn>; timeout: ReturnType<typeof vi.fn>;
    emit: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; removeAllListeners: ReturnType<typeof vi.fn> };
  const token = signal('jwt-current');
  beforeEach(() => {
    handlers = {};
    socket = { id: 'connection', connected: true,
      on: vi.fn((event: string, callback: (...args: unknown[]) => void) => { handlers[event] = callback; }),
      timeout: vi.fn(), emit: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), removeAllListeners: vi.fn() };
    socket.timeout.mockReturnValue(socket);
    mocked.io.mockReset().mockReturnValue(socket);
    TestBed.configureTestingModule({ providers: [ConversationRealtimeService, { provide: AuthService, useValue: { token } }] });
    service = TestBed.inject(ConversationRealtimeService);
  });
  afterEach(() => TestBed.resetTestingModule());

  it('authenticates the subscription and restores it after reconnecting', () => {
    const received: ConversationNotice[] = [];
    const subscription = service.watch('room').subscribe(value => received.push(value));
    expect(mocked.io.mock.calls[0][0]).toMatch(/\/conversations$/);
    const auth = vi.fn();
    mocked.io.mock.calls[0][1].auth(auth);
    expect(auth).toHaveBeenCalledWith({ token: 'jwt-current' });
    handlers['connect']();
    expect(socket.emit).toHaveBeenCalledWith('watch_conversation', { diagramId: 'room' }, expect.any(Function));
    socket.emit.mock.calls[0][2](null, { success: true });
    expect(received).toEqual([{ kind: 'ready' }]);
    handlers['disconnect']();
    socket.id = 'reconnected';
    handlers['connect']();
    socket.emit.mock.calls[1][2](null, { success: true });
    expect(received.at(-1)).toEqual({ kind: 'ready' });
    subscription.unsubscribe();
    expect(socket.removeAllListeners).toHaveBeenCalledOnce();
    expect(socket.disconnect).toHaveBeenCalledOnce();
  });

  it('delivers snapshots unchanged and defers ready until the call handle exists', async () => {
    const received: ConversationNotice[] = [];
    const subscription = service.watch('room').subscribe(value => received.push(value));
    handlers['connect']();
    socket.emit.mock.calls[0][2](null, { success: true });
    const onReady = vi.fn();
    const handle = service.acquireCallTransport('room', { onReady, onParticipants: vi.fn(),
      onSignal: vi.fn(), onDisconnect: vi.fn() });
    expect(onReady).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(onReady).toHaveBeenCalledOnce();
    const snapshot = { revision: 3, messages: [], hasMore: false };
    handlers['conversation_changed']({ diagramId: 'room', scope: 'group', revision: 3, snapshot });
    expect(received.at(-1)).toEqual({ kind: 'changed', scope: 'group', revision: 3, snapshot });
    handle.release();
    subscription.unsubscribe();
  });

  it('filters another room and malformed revisions while accepting reset notices', () => {
    const received: ConversationNotice[] = [];
    const subscription = service.watch('room').subscribe(value => received.push(value));
    handlers['conversation_changed']({ diagramId: 'other', revision: 3 });
    handlers['conversation_changed']({ diagramId: 'room', revision: -1 });
    handlers['conversation_changed'](null);
    handlers['conversation_changed']({ diagramId: 'room', revision: 3 });
    handlers['conversation_changed']({ diagramId: 'room' });
    expect(received).toEqual([{ kind: 'changed', revision: 3 }, { kind: 'changed', revision: undefined }]);
    subscription.unsubscribe();
  });

  it('stops on rejected authorization and ignores stale connection acknowledgments', () => {
    const received: ConversationNotice[] = [];
    const subscription = service.watch('room').subscribe(value => received.push(value));
    handlers['connect']();
    const oldAcknowledgment = socket.emit.mock.calls[0][2];
    socket.id = 'reconnected';
    oldAcknowledgment(null, { success: true });
    expect(received).toEqual([]);
    handlers['connect']();
    socket.emit.mock.calls[1][2](null, { success: false });
    expect(received).toEqual([{ kind: 'offline' }]);
    expect(socket.disconnect).toHaveBeenCalledOnce();
    subscription.unsubscribe();
  });
});
