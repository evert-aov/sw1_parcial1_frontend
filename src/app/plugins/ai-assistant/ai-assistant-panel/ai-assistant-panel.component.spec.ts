import '@angular/compiler';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NEVER, of, Subject, throwError } from 'rxjs';
import { ConversationRealtimeService } from '../conversation-realtime.service';
import { AuthService } from '../../../core/services/auth.service';
import { ChatMessage } from '../../../core/plugins/contracts/ai-assistant.service.contract';
import { AiAssistantService } from '../ai-assistant.service';
import { VoiceCallService } from '../voice-call.service';
import { AiAssistantPanelComponent } from './ai-assistant-panel.component';

describe('Assistant panel reactive lifecycle & Kanon dual chats', () => {
  let fixture: ComponentFixture<AiAssistantPanelComponent>;
  const currentUser = signal<{ id: string; fullName: string; email: string } | null>({
    id: 'u1',
    fullName: 'Ada Lovelace',
    email: 'ada@uagrm.edu.bo',
  });
  const api = {
    history: vi.fn(),
    getAvailableModels: vi.fn(),
    submit: vi.fn(),
    apply: vi.fn(),
    speechPlayback: vi.fn(),
    attachment: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    currentUser.set({ id: 'u1', fullName: 'Ada Lovelace', email: 'ada@uagrm.edu.bo' });
    api.submit.mockReset();
    api.apply.mockReset();
    api.speechPlayback.mockReset().mockReturnValue(new Subject<Blob>());
    api.attachment.mockReset().mockReturnValue(of(new Blob(['audio'], { type: 'audio/webm' })));
    api.history.mockReset().mockReturnValue(of({ messages: [], revision: 0, hasMore: false }));
    api.getAvailableModels
      .mockReset()
      .mockReturnValue(of({ defaultProvider: 'ollama', mediaProvider: 'vertex', models: [] }));
    TestBed.configureTestingModule({
      imports: [AiAssistantPanelComponent],
      providers: [
        { provide: AiAssistantService, useValue: api },
        { provide: ConversationRealtimeService, useValue: { watch: () => NEVER } },
        { provide: AuthService, useValue: { currentUser } },
      ],
    });
    fixture = TestBed.createComponent(AiAssistantPanelComponent);
    fixture.componentRef.setInput('diagramId', 'diagram');
    fixture.componentRef.setInput('isOpen', true);
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('opens once and remains stable after responses without a reactive request loop', async () => {
    const state = fixture.componentInstance.state;
    const originalConnect = state.connect.bind(state);
    let attempts = 0;
    const connect = vi.spyOn(state, 'connect').mockImplementation((diagramId) => {
      if (++attempts > 2) throw new Error('Repeated panel initialization');
      originalConnect(diagramId);
    });

    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    expect(connect).toHaveBeenCalledTimes(1);
    expect(api.getAvailableModels).toHaveBeenCalledTimes(1);
    expect(api.history).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('[data-testid="group-greeting"]')?.textContent).toContain('Ada');
  });

  it('switches between Group and Personal tabs per diagram and scopes history & proposals', async () => {
    fixture.componentRef.setInput('canEdit', true);
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    const panel = fixture.componentInstance;
    expect(panel.state.scope()).toBe('group');
    expect(api.history).toHaveBeenLastCalledWith('diagram');

    fixture.nativeElement.querySelector('[data-testid="tab-personal"]').click();
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    expect(panel.state.scope()).toBe('personal');
    expect(api.history).toHaveBeenLastCalledWith('diagram', undefined, 'personal');
    expect(fixture.nativeElement.querySelector('[data-testid="personal-greeting"]')).not.toBeNull();

    api.apply.mockReturnValue(of({ applied: true }));
    const personalProposal: ChatMessage = {
      id: 'reply-p',
      sequence: 1,
      sender: { displayName: 'Kanon' },
      content: '**Ada**, revisa esta propuesta.',
      source: 'assistant',
      status: 'completed',
      createdAt: '',
      proposal: {
        id: 'prop-1',
        status: 'pending',
        baseRevision: 'base',
        summary: 'AddOrder',
        ast: { nodes: [], connections: [] },
      },
    };
    await panel.apply(personalProposal);
    expect(api.apply).toHaveBeenCalledWith('diagram', 'prop-1', 'personal');
  });

  it.each([
    [400, 'chat.invalidProposal'],
    [422, 'chat.invalidProposal'],
    [403, 'chat.applyForbidden'],
    [409, 'chat.conflict'],
    [503, 'chat.applyFailed'],
  ])('shows the correct application error for HTTP %s', async (status, expected) => {
    fixture.componentRef.setInput('canEdit', true);
    fixture.detectChanges();
    await Promise.resolve();
    const panel = fixture.componentInstance;
    const applied = vi.fn();
    panel.proposalApplied.subscribe(applied);
    api.apply.mockReturnValue(throwError(() => ({ status })));
    const message: ChatMessage = {
      id: 'reply',
      sequence: 1,
      sender: { displayName: 'Kanon' },
      content: 'Proposal',
      source: 'assistant',
      status: 'completed',
      createdAt: '',
      proposal: {
        id: 'proposal',
        status: 'pending',
        baseRevision: 'base',
        summary: '',
        ast: { nodes: [], connections: [] },
      },
    };
    await panel.apply(message);
    fixture.detectChanges();
    expect(panel.error()).toBe(expected);
    expect(panel.applying()).toBeNull();
    expect(applied).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('preserves the draft and media when conversation signals change', async () => {
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
    const panel = fixture.componentInstance;
    const connect = vi.spyOn(panel.state, 'connect');
    const reset = vi.spyOn(panel.media, 'reset');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    panel.prompt.set('Work in progress');
    panel.assets.set({ picture: 'blob:preview' });
    panel.media.attachment.set({
      kind: 'image',
      data: 'aGVsbG8=',
      mimeType: 'image/png',
      name: 'example.png',
    });
    panel.media.recording.set(true);
    panel.state.messages.set([
      {
        id: 'reply',
        sequence: 1,
        sender: { displayName: 'Alice' },
        content: 'Hello',
        source: 'text',
        status: 'completed',
        createdAt: '',
      },
    ]);
    panel.state.models.set({ defaultProvider: 'vertex', mediaProvider: 'vertex', models: [] });
    panel.state.error.set('chat.unavailable');
    fixture.detectChanges();

    expect(connect).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
    expect(panel.prompt()).toBe('Work in progress');
    expect(panel.media.attachment()?.name).toBe('example.png');
    expect(panel.media.recording()).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-testid="gemini-voice-bar"]')).not.toBeNull();
    expect(panel.assets()).toEqual({ picture: 'blob:preview' });
    expect(revoke).not.toHaveBeenCalled();

    fixture.componentRef.setInput('diagramId', 'another-diagram');
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
    expect(connect).toHaveBeenCalledExactlyOnceWith('another-diagram');
    expect(reset).toHaveBeenCalledTimes(1);
    expect(panel.prompt()).toBe('');
    expect(panel.media.attachment()).toBeNull();
    expect(panel.media.recording()).toBe(false);
    expect(panel.assets()).toEqual({});
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:preview');
    expect(api.getAvailableModels).toHaveBeenCalledTimes(2);
  });

  it('inserts @Kanon mention in Group chat, renders italic audio/call transcripts and recipient badge', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:audio-clip');
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
    const panel = fixture.componentInstance;

    fixture.nativeElement.querySelector('[data-testid="mention-kanon-chip"]').click();
    fixture.detectChanges();
    expect(panel.prompt()).toBe('@Kanon ');
    expect(panel.hasKanonMention()).toBe(true);

    panel.state.messages.set([
      {
        id: 'voice-1',
        sequence: 1,
        sender: { userId: 'u1', displayName: 'Ada' },
        content: 'Kanon agrega Factura',
        transcription: 'Kanon agrega Factura',
        source: 'audio',
        status: 'completed',
        createdAt: new Date().toISOString(),
        attachment: { mimeType: 'audio/webm', name: 'voice-clip' },
      },
      {
        id: 'call-1',
        sequence: 2,
        sender: { userId: 'u2', displayName: 'Bob' },
        content: 'revisemos la cardinalidad',
        transcription: 'revisemos la cardinalidad',
        source: 'audio',
        channel: 'call',
        status: 'completed',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'kanon-1',
        sequence: 3,
        sender: { displayName: 'Kanon' },
        content: '**Ada**, enseguida propongo Factura.',
        source: 'assistant',
        status: 'completed',
        replyToSource: 'audio',
        replyToUser: { userId: 'u1', displayName: 'Ada' },
        createdAt: new Date().toISOString(),
      },
    ]);
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="audio-transcription"]')?.textContent?.trim()).toBe(
      'Kanon agrega Factura',
    );
    expect(fixture.nativeElement.querySelector('audio.audio-player')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="call-badge"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="call-transcript"]')?.textContent?.trim()).toBe(
      'revisemos la cardinalidad',
    );
    expect(fixture.nativeElement.querySelector('[data-testid="reply-recipient"]')?.textContent).toContain('Ada');
    // Como replyToSource === 'audio' y pertenece a u1, Kanon reproduce audio selectivo automáticamente
    expect(api.speechPlayback).toHaveBeenCalledWith('diagram', 'kanon-1');
  });

  it('expands and restores without reconnecting or losing the draft', async () => {
    fixture.detectChanges();
    await Promise.resolve();
    const panel = fixture.componentInstance;
    panel.prompt.set('Keep this draft');
    const connect = vi.spyOn(panel.state, 'connect');
    fixture.nativeElement.querySelector('[data-testid="expand-chat"]').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.classList.contains('panel-expanded')).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="separator"]')).toBeNull();
    panel.onEscape(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(panel.expanded()).toBe(false);
    expect(panel.prompt()).toBe('Keep this draft');
    expect(connect).not.toHaveBeenCalled();
  });

  it('selects an available model from the composer and refuses unavailable providers', async () => {
    api.getAvailableModels.mockReturnValue(
      of({
        defaultProvider: 'ollama',
        mediaProvider: 'vertex',
        models: [
          { id: 'qwen2.5-coder:14b', provider: 'ollama', available: false, inputs: ['text'] },
          { id: 'gemini-2.5-flash', provider: 'vertex', available: true, inputs: ['text', 'image'] },
        ],
      }),
    );
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
    const panel = fixture.componentInstance;
    fixture.nativeElement.querySelector('[data-menu-trigger="models"]').click();
    fixture.detectChanges();
    const options = fixture.nativeElement.querySelectorAll('.model-option');
    expect(options[0].disabled).toBe(true);
    options[1].click();
    fixture.detectChanges();
    expect(panel.provider()).toBe('vertex');
    expect(panel.menu()).toBeNull();
    panel.selectProvider('ollama');
    expect(panel.provider()).toBe('vertex');
    expect(api.getAvailableModels).toHaveBeenCalledTimes(1);
  });

  it('opens image selection from plus and closes menus with Escape or an outside pointer', async () => {
    fixture.detectChanges();
    await Promise.resolve();
    const panel = fixture.componentInstance;
    const imageInput = fixture.nativeElement.querySelector('input[type="file"]');
    const chooseFile = vi.spyOn(imageInput, 'click').mockImplementation(() => {});
    fixture.nativeElement.querySelector('[data-menu-trigger="attachments"]').click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('#chat-attachments button').click();
    expect(chooseFile).toHaveBeenCalledTimes(1);
    expect(panel.menu()).toBeNull();
    panel.toggleMenu('models');
    panel.onEscape(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(panel.menu()).toBeNull();
    panel.toggleMenu('attachments');
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(panel.menu()).toBeNull();
  });

  it('resizes with pointer capture and keyboard without crossing its minimum width', () => {
    fixture.detectChanges();
    const panel = fixture.componentInstance;
    const handle = fixture.nativeElement.querySelector('[role="separator"]');
    handle.setPointerCapture = vi.fn();
    panel.startResize({
      button: 0,
      clientX: 600,
      pointerId: 1,
      currentTarget: handle,
      preventDefault: vi.fn(),
    } as unknown as PointerEvent);
    panel.resize({ clientX: 500 } as PointerEvent);
    expect(panel.panelWidth()).toBe(520);
    panel.stopResize();
    panel.resize({ clientX: 400 } as PointerEvent);
    expect(panel.panelWidth()).toBe(520);
    panel.resizeWithKeyboard(new KeyboardEvent('keydown', { key: 'Home' }));
    expect(panel.panelWidth()).toBe(420);
    for (let i = 0; i < 20; i++) {
      panel.resizeWithKeyboard(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    }
    expect(panel.panelWidth()).toBe(320);
  });

  it('reserves the visible left dock when widening the conversation', () => {
    fixture.detectChanges();
    const panel = fixture.componentInstance;
    const parent = fixture.nativeElement.parentElement as HTMLElement;
    Object.defineProperty(parent, 'clientWidth', { configurable: true, value: 1000 });
    const dock = document.createElement('aside');
    dock.style.flexGrow = '0';
    parent.appendChild(dock);
    vi.spyOn(dock, 'getBoundingClientRect').mockReturnValue({ width: 280 } as DOMRect);
    panel.toggleWidth();
    expect(panel.panelWidth()).toBe(560);
    dock.remove();
    Reflect.deleteProperty(parent, 'clientWidth');
  });

  it('toggles speaker output locally and does not auto-play text replies outside a call', async () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    const panel = fixture.componentInstance;
    const connect = vi.spyOn(panel.state, 'connect');
    const root: HTMLElement = fixture.nativeElement;
    const toggle = root.querySelector<HTMLButtonElement>('[data-testid="speaker-toggle"]')!;
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    toggle.click();
    fixture.detectChanges();
    expect(panel.speech.muted()).toBe(true);
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    toggle.click();
    fixture.detectChanges();
    expect(panel.speech.muted()).toBe(false);
    expect(root.querySelector('.voice-menu')).toBeNull();
    expect(panel.speech.voice()).toBe('marcelo');
    panel.state.messages.set([
      {
        id: 'reply',
        sequence: 1,
        content: 'Hello',
        source: 'assistant',
        status: 'completed',
        replyToSource: 'text',
        sender: { displayName: 'Kanon' },
        createdAt: new Date().toISOString(),
      },
    ]);
    fixture.detectChanges();
    expect(api.speechPlayback).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
    expect(api.getAvailableModels).toHaveBeenCalledTimes(1);
    fixture.componentRef.setInput('diagramId', 'another-diagram');
    fixture.detectChanges();
    expect(panel.speech.loading()).toBeNull();
  });

  it('renders an unavailable service without repeatedly initializing the panel', async () => {
    api.history.mockReturnValue(throwError(() => ({ status: 503 })));
    api.getAvailableModels.mockReturnValue(throwError(() => ({ status: 503 })));
    const connect = vi.spyOn(fixture.componentInstance.state, 'connect');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(3999);
    fixture.detectChanges();
    expect(connect).toHaveBeenCalledTimes(1);
    expect(api.getAvailableModels).toHaveBeenCalledTimes(1);
    expect(api.history).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    fixture.destroy();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(api.getAvailableModels).toHaveBeenCalledTimes(1);
    expect(api.history).toHaveBeenCalledTimes(1);
  });
  it('waits for confirmed history before arming speech and hides replay controls', async () => {
    const history = new Subject<{ messages: ChatMessage[]; revision: number; hasMore: boolean }>();
    api.history.mockReturnValue(history);
    fixture.detectChanges();
    const panel = fixture.componentInstance;
    expect(panel.state.historyLoaded()).toBe(false);
    const oldReply: ChatMessage = {
      id: 'old-answer', sequence: 9, source: 'assistant', status: 'completed',
      sender: { displayName: 'Kanon' }, content: 'Old response', createdAt: '2026-01-01',
      replyToSource: 'audio', replyToUser: { userId: 'u1', displayName: 'Ada' },
    };
    history.next({ messages: [oldReply], revision: 9, hasMore: false });
    await Promise.resolve();
    fixture.detectChanges();
    expect(panel.state.historyLoaded()).toBe(true);
    expect(api.speechPlayback).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Old response');
    expect(fixture.nativeElement.querySelector('[data-testid="speech-caption"]')).toBeNull();
    expect([...fixture.nativeElement.querySelectorAll('button')].some((button: unknown) =>
      /Listen to reply|Escuchar respuesta/.test((button as HTMLButtonElement).textContent ?? ''))).toBe(false);

    const newReply = { ...oldReply, id: 'new-answer', sequence: 10, content: 'New response' };
    panel.state.messages.set([oldReply, newReply]);
    fixture.detectChanges();
    expect(api.speechPlayback).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).not.toContain('New response');
    panel.speech.toggleMuted();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('New response');

    fixture.componentRef.setInput('isOpen', false);
    fixture.detectChanges();
    panel.speech.toggleMuted();
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    expect(api.speechPlayback).toHaveBeenCalledOnce();
    panel.playSpeech(oldReply);
    expect(api.speechPlayback).toHaveBeenCalledTimes(2);
  });

  it('renders personal call waveform bar and live action buttons with proper styles and handlers', () => {
    const mockVoiceCall = {
      inCall: signal(true),
      activeDiagramId: signal('diagram'),
      callScope: signal<'personal' | 'group'>('personal'),
      muted: signal(false),
      toggleMute: vi.fn(),
      leaveCall: vi.fn(),
      localSpeaking: signal(true),
      callLevels: signal([20, 40, 60]),
      liveAudio: { playing: signal(false) },
      liveConnected: signal(true),
      joining: signal(false),
      participants: signal([]),
      error: signal<string | null>(null),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AiAssistantPanelComponent],
      providers: [
        { provide: AiAssistantService, useValue: api },
        { provide: ConversationRealtimeService, useValue: { watch: () => NEVER } },
        { provide: AuthService, useValue: { currentUser } },
        { provide: VoiceCallService, useValue: mockVoiceCall },
      ],
    });
    const callFixture = TestBed.createComponent(AiAssistantPanelComponent);
    callFixture.componentRef.setInput('diagramId', 'diagram');
    callFixture.componentRef.setInput('isOpen', true);
    callFixture.detectChanges();

    const waveform = callFixture.nativeElement.querySelector('[data-testid="personal-call-waveform"]');
    expect(waveform).not.toBeNull();

    const liveButtons = waveform.querySelectorAll('.call-live-btn');
    expect(liveButtons.length).toBe(2);

    const muteBtn = liveButtons[0] as HTMLButtonElement;
    expect(muteBtn.classList.contains('call-live-btn')).toBe(true);
    expect(muteBtn.textContent).toMatch(/Silenciar|Mute/);
    muteBtn.click();
    expect(mockVoiceCall.toggleMute).toHaveBeenCalledOnce();

    const hangupBtn = liveButtons[1] as HTMLButtonElement;
    expect(hangupBtn.classList.contains('hangup')).toBe(true);
    expect(hangupBtn.textContent).toMatch(/Colgar|Hang up/);
    hangupBtn.click();
    expect(mockVoiceCall.leaveCall).toHaveBeenCalledOnce();

    callFixture.destroy();
  });
});
