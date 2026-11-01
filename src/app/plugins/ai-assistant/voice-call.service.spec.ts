import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslationService } from '../../core/i18n';
import { AiAssistantService } from './ai-assistant.service';
import { ChatSpeechService } from './chat-speech.service';
import { ConversationNotice, ConversationRealtimeService, LivePacket } from './conversation-realtime.service';
import { LiveAudioService } from './live-audio.service';
import { VoiceCallService } from './voice-call.service';

/** Verifica consentimiento, controles locales y consumo push sin dispositivos ni servidores reales. */
describe('Kanon call controls', () => {
  const track = { enabled: true, stop: vi.fn() };
  const api = { history: vi.fn(), submit: vi.fn() };
  const transport = { getSocketId: () => 'z', emit: vi.fn(), emitWithAck: vi.fn(), release: vi.fn() };
  const speech = { muted: signal(false), playing: signal<string | null>(null), primeFloor: vi.fn(), observe: vi.fn() };
  let notices: Subject<ConversationNotice>;
  let service: VoiceCallService;
  let getUserMedia: ReturnType<typeof vi.fn>;
  let liveListener: { onLive?: (packet: LivePacket) => void };
  let liveAudio: { capture: ReturnType<typeof vi.fn>; stopCapture: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    notices = new Subject();
    api.history.mockReset().mockReturnValue(of({ revision: 0, messages: [], hasMore: false }));
    speech.observe.mockReset();
    speech.primeFloor.mockReset();
    speech.muted.set(false);
    speech.playing.set(null);
    track.enabled = true;
    track.stop.mockReset();
    transport.emit.mockReset();
    transport.release.mockReset();
    liveAudio = { capture: vi.fn().mockResolvedValue(undefined), stopCapture: vi.fn() };
    getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [track], getAudioTracks: () => [track] });
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    vi.stubGlobal('AudioContext', undefined);
    TestBed.configureTestingModule({ providers: [VoiceCallService,
      { provide: AiAssistantService, useValue: api },
      { provide: ChatSpeechService, useValue: speech },
      { provide: LiveAudioService, useValue: { ...liveAudio, prepare: vi.fn().mockResolvedValue(undefined), setMuted: vi.fn(), close: vi.fn(), interrupt: vi.fn(), playing: signal(false) } },
      { provide: AuthService, useValue: { currentUser: () => ({ id: 'user' }) } },
      { provide: ToastService, useValue: { info: vi.fn(), success: vi.fn(), warning: vi.fn() } },
      { provide: TranslationService, useValue: { currentLang: () => 'es', t: vi.fn().mockReturnValue('Toast') } },
      { provide: ConversationRealtimeService, useValue: {
        watch: () => notices, acquireCallTransport: (_room: string, listener: typeof liveListener) => {
          liveListener = listener;
          return transport;
        },
      } },
    ] });
    service = TestBed.inject(VoiceCallService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('requires joining, starts unmuted and disables the actual audio track on mute', async () => {
    expect(getUserMedia).not.toHaveBeenCalled();
    service.promptJoin('room');
    expect(getUserMedia).not.toHaveBeenCalled();
    await service.confirmJoin(true);
    expect(service.inCall()).toBe(true);
    expect(service.muted()).toBe(false);
    expect(speech.muted()).toBe(false);
    service.toggleMute();
    expect(track.enabled).toBe(false);
    expect(service.muted()).toBe(true);
    expect(transport.emit).toHaveBeenCalledWith('call_update_state', { diagramId: 'room', muted: true, aiConsent: true });
    service.toggleMute();
    expect(track.enabled).toBe(true);
    service.leaveCall();
    expect(track.stop).toHaveBeenCalledOnce();
    expect(transport.release).toHaveBeenCalledOnce();
    expect(notices.observed).toBe(false);
  });

  it('uses pushed group messages without re-reading history and ignores private revisions', async () => {
    service.promptJoin('room');
    await service.confirmJoin(true);
    notices.next({ kind: 'changed', scope: 'group', revision: 2,
      snapshot: { revision: 2, messages: [], hasMore: false } });
    expect(api.history).toHaveBeenCalledTimes(1);
    expect(speech.observe).toHaveBeenCalledTimes(2);
    notices.next({ kind: 'live', message: { id: 'live', sequence: 3, content: 'Hello',
      source: 'assistant', sender: { kind: 'assistant', displayName: 'Kanon' },
      status: 'completed', createdAt: '', speechMode: 'live', streaming: true } });
    expect(api.history).toHaveBeenCalledTimes(1);
    expect(speech.observe).toHaveBeenCalledTimes(2);
    notices.next({ kind: 'changed', scope: 'personal', revision: 3,
      snapshot: { revision: 3, messages: [], hasMore: false } });
    expect(speech.observe).toHaveBeenCalledTimes(2);
    service.leaveCall();
    await vi.advanceTimersByTimeAsync(60000);
    expect(api.history).toHaveBeenCalledTimes(1);
  });

  it('only sends native audio after readiness and stops forwarding on mute or revocation', async () => {
    service.promptJoin('room');
    await service.confirmJoin(true);
    expect(liveAudio.capture).not.toHaveBeenCalled();
    liveListener.onLive?.({ type: 'ready' });
    expect(liveAudio.capture).toHaveBeenCalledOnce();
    const send = liveAudio.capture.mock.calls[0][1] as (data: string) => void;
    send('AAA=');
    expect(transport.emit).toHaveBeenCalledWith('live_audio', { data: 'AAA=' });
    service.toggleMute();
    transport.emit.mockClear();
    send('AAA=');
    expect(transport.emit).not.toHaveBeenCalled();
    service.toggleMute();
    service.toggleAiConsent();
    expect(liveAudio.stopCapture).toHaveBeenCalled();
    expect(transport.emit).toHaveBeenCalledWith('live_stop', {});
    transport.emit.mockClear();
    send('AAA=');
    liveListener.onLive?.({ type: 'ready' });
    expect(liveAudio.capture).toHaveBeenCalledOnce();
    expect(transport.emit).not.toHaveBeenCalled();
  });
});
