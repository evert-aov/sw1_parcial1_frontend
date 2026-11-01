import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { of, Subject, throwError } from 'rxjs';
import { ChatMessage, SpeechPlayback } from '../../core/plugins/contracts/ai-assistant.service.contract';
import { AiAssistantService } from './ai-assistant.service';
import { ChatSpeechService } from './chat-speech.service';

/** Construye una respuesta mínima de Kanon para probar reproducción selectiva y manual. */
function reply(
  sequence: number,
  overrides: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    id: `reply-${sequence}`,
    sequence,
    sender: { displayName: 'Kanon' },
    content: '**Ada**, aquí tienes el análisis.',
    source: 'assistant',
    status: 'completed',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('Selective Kanon speech playback', () => {
  let service: ChatSpeechService;
  let audios: HTMLAudioElement[];
  const speech = vi.fn();
  const play = vi.fn();
  const pause = vi.fn();
  const revoke = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    audios = [];
    speech.mockReset().mockReturnValue(of({ audioBase64: btoa('mpeg'), mimeType: 'audio/mpeg', cues: [] }));
    play.mockReset().mockResolvedValue(undefined);
    pause.mockReset();
    revoke.mockReset();
    vi.stubGlobal(
      'Audio',
      class {
        onended: (() => void) | null = null;
        onerror: (() => void) | null = null;
        play = play;
        pause = pause;
        removeAttribute = vi.fn();
        /** Registra instancias del reproductor doble para completar turnos de forma determinista. */
        constructor() {
          audios.push(this as unknown as HTMLAudioElement);
        }
      },
    );
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revoke);
    TestBed.configureTestingModule({
      providers: [ChatSpeechService, { provide: AiAssistantService, useValue: { speechPlayback: speech } }],
    });
    service = TestBed.inject(ChatSpeechService);
    service.reset('room');
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('defaults to the fixed male voice and discards automatic speech while muted', () => {
    expect(service.voice()).toBe('marcelo');
    expect(service.muted()).toBe(false);
    service.toggleMuted();
    service.observe('room', [reply(1)], { inCall: true, currentUserId: 'u1' });
    expect(speech).not.toHaveBeenCalled();
    service.toggleMuted();
    service.observe('room', [reply(1)], { inCall: true, currentUserId: 'u1' });
    expect(speech).not.toHaveBeenCalled();
    service.observe('room', [reply(2)], { inCall: true, currentUserId: 'u1' });
    expect(speech).toHaveBeenCalledOnce();
    service.toggleMuted();
    expect(pause).toHaveBeenCalledOnce();
    expect(service.playing()).toBeNull();
  });

  it('reveals the response in its own bubble as the audio clock advances', () => {
    const message = reply(2, { content: '**Hola Ada.** Seguimos.' });
    const download = new Subject<SpeechPlayback>();
    speech.mockReturnValue(download);
    service.primeFloor('room', []);
    service.observe('room', [message], { inCall: true, currentUserId: 'u1' });
    expect(service.displayedContent(message)).toBe('');
    download.next({ audioBase64: btoa('mpeg'), mimeType: 'audio/mpeg',
      cues: [{ startMs: 500, endMs: 1200, text: 'Hola Ada.' }, { startMs: 1500, endMs: 2500, text: 'Seguimos.' }] });
    expect(service.displayedContent(message)).toBe('');
    audios[0].currentTime = .6;
    audios[0].ontimeupdate?.(new Event('timeupdate'));
    expect(service.displayedContent(message)).toBe('**Hola');
    audios[0].currentTime = 1.3;
    audios[0].ontimeupdate?.(new Event('timeupdate'));
    expect(service.displayedContent(message)).toBe('**Hola Ada');
    audios[0].currentTime = .6;
    audios[0].ontimeupdate?.(new Event('timeupdate'));
    expect(service.displayedContent(message)).toBe('**Hola Ada');
    audios[0].onended?.(new Event('ended'));
    expect(service.displayedContent(message)).toBe(message.content);
    expect(message.content).toBe('**Hola Ada.** Seguimos.');
    expect(audios[0].ontimeupdate).toBeNull();
  });

  it('never autoplays the first confirmed history, regardless of timestamps', () => {
    const historical = [reply(1, { createdAt: '' }), reply(2), reply(3, { createdAt: '2099-01-01' })];
    service.observe('room', historical, { inCall: true, currentUserId: 'u1' });
    expect(speech).not.toHaveBeenCalled();
    service.observe('room', [...historical, reply(4)], { inCall: true, currentUserId: 'u1' });
    expect(speech).toHaveBeenCalledOnce();
    service.reset('room');
    service.observe('room', [...historical, reply(4)], { inCall: true, currentUserId: 'u1' });
    expect(speech).toHaveBeenCalledOnce();
    service.observe('room', [reply(5)], { inCall: true, currentUserId: 'u1' }, 'personal');
    expect(speech).toHaveBeenCalledOnce();
  });

  it('reveals queued text on mute, missing cues, failed playback and blocked autoplay', async () => {
    const first = reply(1);
    const second = reply(2);
    const download = new Subject<SpeechPlayback>();
    speech.mockReturnValue(download);
    service.primeFloor('room', []);
    service.observe('room', [first, second], { inCall: true, currentUserId: 'u1' });
    expect(service.displayedContent(second)).toBe('');
    service.toggleMuted();
    expect(service.displayedContent(first)).toBe(first.content);
    expect(service.displayedContent(second)).toBe(second.content);
    service.toggleMuted();
    service.observe('room', [reply(3)], { inCall: true, currentUserId: 'u1' });
    download.error(new Error('unavailable'));
    expect(service.displayedContent(reply(3))).toBe(reply(3).content);

    service.reset('room');
    service.primeFloor('room', []);
    speech.mockReturnValue(of({ audioBase64: btoa('mpeg'), mimeType: 'audio/mpeg', cues: [] }));
    service.observe('room', [first], { inCall: true, currentUserId: 'u1' });
    expect(service.displayedContent(first)).toBe(first.content);
    service.stop();
    play.mockRejectedValueOnce(new Error('NotAllowedError'));
    speech.mockReturnValue(of({ audioBase64: btoa('mpeg'), mimeType: 'audio/mpeg',
      cues: [{ startMs: 0, endMs: 2000, text: 'Ada aquí tienes el análisis' }] }));
    service.observe('room', [second], { inCall: true, currentUserId: 'u1' });
    await Promise.resolve();
    expect(service.ready()).toBe(second.id);
    expect(service.displayedContent(second)).toBe(second.content);
  });

  it('skips automatic speech for plain text replies outside a call, and speaks for active call or audio queries', () => {
    service.primeFloor('room', [reply(1)], 'group');

    // Respuesta a un mensaje de texto fuera de llamada -> NO se reproduce automáticamente
    service.observe(
      'room',
      [
        reply(1),
        reply(2, { replyToSource: 'text', replyToUser: { userId: 'u1', displayName: 'Ada' } }),
      ],
      { inCall: false, currentUserId: 'u1' },
      'group',
    );
    expect(speech).not.toHaveBeenCalled();

    // Respuesta a una nota de voz de otro usuario fuera de llamada -> NO se reproduce para u1
    service.observe(
      'room',
      [
        reply(2, { replyToSource: 'text' }),
        reply(3, { replyToSource: 'audio', replyToUser: { userId: 'u2', displayName: 'Bob' } }),
      ],
      { inCall: false, currentUserId: 'u1' },
      'group',
    );
    expect(speech).not.toHaveBeenCalled();

    // Respuesta a una nota de voz del propio usuario u1 -> SÍ se reproduce automáticamente
    service.observe(
      'room',
      [reply(4, { replyToSource: 'audio', replyToUser: { userId: 'u1', displayName: 'Ada' } })],
      { inCall: false, currentUserId: 'u1' },
      'group',
    );
    expect(speech).toHaveBeenCalledTimes(1);
    expect(speech).toHaveBeenCalledWith('room', 'reply-4');
    audios[0].onended?.(new Event('ended'));

    // Dentro de la llamada grupal -> cualquier respuesta nueva de Kanon se reproduce automáticamente
    service.observe(
      'room',
      [reply(5, { replyToSource: 'text' }), reply(6, { replyToSource: 'audio' })],
      { inCall: true, currentUserId: 'u1' },
      'group',
    );
    expect(speech).toHaveBeenCalledTimes(2);
    expect(speech).toHaveBeenLastCalledWith('room', 'reply-5');
    audios[1].onended?.(new Event('ended'));
    expect(speech).toHaveBeenCalledTimes(3);
    expect(speech).toHaveBeenLastCalledWith('room', 'reply-6');
    audios[2].onended?.(new Event('ended'));
    expect(revoke).toHaveBeenCalledTimes(3);
  });

  it('passes personal scope when auto-playing or manually listening in personal chat', () => {
    service.primeFloor('room', [], 'personal');
    service.observe(
      'room',
      [reply(1, { scope: 'personal', replyToSource: 'audio' })],
      { inCall: false, currentUserId: 'u1' },
      'personal',
    );
    expect(speech).toHaveBeenCalledWith('room', 'reply-1', 'personal');
  });

  it('cancels pending downloads on stop, mute and room change', () => {
    const download = new Subject<SpeechPlayback>();
    speech.mockReturnValue(download);
    service.play('room', reply(1));
    expect(download.observed).toBe(true);
    service.toggleMuted();
    expect(download.observed).toBe(false);
    download.next({ audioBase64: btoa('stale'), mimeType: 'audio/mpeg', cues: [] });
    expect(play).not.toHaveBeenCalled();
    service.toggleMuted();
    service.play('room', reply(1));
    expect(speech).toHaveBeenLastCalledWith('room', 'reply-1');
    service.reset('another-room');
    expect(download.observed).toBe(false);
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
    const message = reply(1, { replyToSource: 'audio' });
    service.primeFloor('room', []);
    service.observe('room', [message], { inCall: true, currentUserId: 'u1' }, 'group');
    expect(service.error()).toBe('chat.voiceFailed');
    service.observe('room', [message], { inCall: true, currentUserId: 'u1' }, 'group');
    expect(speech).toHaveBeenCalledTimes(1);
    expect(message.status).toBe('completed');

    play.mockRejectedValueOnce(new Error('NotAllowedError'));
    service.play('room', message);
    await Promise.resolve();
    expect(service.error()).toBe('chat.voicePlaybackBlocked');
    expect(service.playing()).toBeNull();
    expect(service.ready()).toBe(message.id);
    service.play('room', message);
    await Promise.resolve();
    expect(speech).toHaveBeenCalledTimes(2);
    expect(service.ready()).toBeNull();
    expect(service.playing()).toBe(message.id);
    expect(service.error()).toBe('');
  });

  it('times out a stalled download and cancels requests on destruction', async () => {
    const download = new Subject<SpeechPlayback>();
    speech.mockReturnValue(download);
    service.play('room', reply(1));
    await vi.advanceTimersByTimeAsync(45001);
    expect(download.observed).toBe(false);
    expect(service.error()).toBe('chat.voiceFailed');
    service.play('room', reply(2));
    service.ngOnDestroy();
    expect(download.observed).toBe(false);
  });
  it('never synthesizes an already spoken native Live reply', () => {
    service.primeFloor('room', []);
    service.observe('room', [reply(1, { speechMode: 'live' })], { inCall: true, currentUserId: 'u1' });
    expect(speech).not.toHaveBeenCalled();
  });

});
