import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { of, Subject, throwError } from 'rxjs';
import { ChatMessage } from '../../core/plugins/contracts/ai-assistant.service.contract';
import { AiAssistantService } from './ai-assistant.service';
import { ChatSpeechService } from './chat-speech.service';

/** Construye una respuesta mínima del contrato para probar reproducción sin inferencia. */
function reply(sequence: number): ChatMessage {
  return { id: `reply-${sequence}`, sequence, sender: { displayName: 'AI' }, content: 'Hello', source: 'assistant', status: 'completed', createdAt: '' };
}

describe('Participant speech playback', () => {
  let service: ChatSpeechService;
  let audios: HTMLAudioElement[];
  const speech = vi.fn();
  const play = vi.fn();
  const pause = vi.fn();
  const revoke = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    audios = [];
    speech.mockReset().mockReturnValue(of(new Blob(['mpeg'])));
    play.mockReset().mockResolvedValue(undefined);
    pause.mockReset();
    revoke.mockReset();
    vi.stubGlobal('Audio', class {
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      play = play;
      pause = pause;
      removeAttribute = vi.fn();
      /** Registra instancias del reproductor doble para completar turnos de forma determinista. */
      constructor() { audios.push(this as unknown as HTMLAudioElement); }
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revoke);
    TestBed.configureTestingModule({ providers: [ChatSpeechService, { provide: AiAssistantService, useValue: { speech } }] });
    service = TestBed.inject(ChatSpeechService);
    service.reset('room');
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('does not read history or human messages and serializes each new reply exactly once', () => {
    service.toggle('room', [reply(1)]);
    service.observe([reply(1), { ...reply(2), source: 'text' }, reply(3), reply(4)]);
    expect(speech).toHaveBeenCalledTimes(1);
    expect(speech).toHaveBeenCalledWith('room', 'reply-3', 'sofia');
    service.observe([reply(1), reply(3), reply(4)]);
    audios[0].onended?.(new Event('ended'));
    expect(speech).toHaveBeenCalledTimes(2);
    expect(speech).toHaveBeenLastCalledWith('room', 'reply-4', 'sofia');
    audios[1].onended?.(new Event('ended'));
    service.observe([reply(0), reply(1), reply(3), reply(4)]);
    expect(speech).toHaveBeenCalledTimes(2);
    expect(revoke).toHaveBeenCalledTimes(2);
  });

  it('cancels pending downloads on stop, voice change and room change', () => {
    const download = new Subject<Blob>();
    speech.mockReturnValue(download);
    service.play('room', reply(1));
    expect(download.observed).toBe(true);
    service.selectVoice('marcelo');
    expect(download.observed).toBe(false);
    download.next(new Blob(['stale']));
    expect(play).not.toHaveBeenCalled();
    service.play('room', reply(1));
    expect(speech).toHaveBeenLastCalledWith('room', 'reply-1', 'marcelo');
    service.reset('another-room');
    expect(download.observed).toBe(false);
    expect(service.enabled()).toBe(false);
  });

  it('stops audio before recording and blocks manual playback until the microphone is released', () => {
    service.play('room', reply(1));
    service.setBlocked(true);
    expect(pause).toHaveBeenCalledOnce();
    service.play('room', reply(2));
    expect(speech).toHaveBeenCalledTimes(1);
    service.setBlocked(false);
    service.play('room', reply(2));
    expect(speech).toHaveBeenCalledTimes(2);
  });

  it('leaves text intact and disables automatic retries after provider or browser failure', async () => {
    speech.mockReturnValueOnce(throwError(() => ({ status: 503 })));
    service.toggle('room', []);
    const message = reply(1);
    service.observe([message]);
    expect(service.error()).toBe('chat.voiceFailed');
    service.observe([message]);
    expect(speech).toHaveBeenCalledTimes(1);
    expect(message.status).toBe('completed');
    play.mockRejectedValueOnce(new Error('NotAllowedError'));
    service.play('room', message);
    await Promise.resolve();
    expect(service.error()).toBe('chat.voicePlaybackBlocked');
    expect(service.playing()).toBeNull();
    expect(service.enabled()).toBe(false);
    expect(service.ready()).toBe(message.id);
    service.play('room', message);
    await Promise.resolve();
    expect(speech).toHaveBeenCalledTimes(2);
    expect(service.ready()).toBeNull();
    expect(service.playing()).toBe(message.id);
    expect(service.error()).toBe('');
  });

  it('times out a stalled download and cancels requests on destruction', async () => {
    const download = new Subject<Blob>();
    speech.mockReturnValue(download);
    service.play('room', reply(1));
    await vi.advanceTimersByTimeAsync(45001);
    expect(download.observed).toBe(false);
    expect(service.error()).toBe('chat.voiceFailed');
    service.play('room', reply(2));
    service.ngOnDestroy();
    expect(download.observed).toBe(false);
  });
});
