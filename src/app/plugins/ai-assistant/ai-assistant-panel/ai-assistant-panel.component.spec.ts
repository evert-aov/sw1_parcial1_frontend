import '@angular/compiler';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { ChatMessage } from '../../../core/plugins/contracts/ai-assistant.service.contract';
import { AiAssistantService } from '../ai-assistant.service';
import { AiAssistantPanelComponent } from './ai-assistant-panel.component';

describe('Assistant panel reactive lifecycle', () => {
  let fixture: ComponentFixture<AiAssistantPanelComponent>;
  const api = {
    history: vi.fn(),
    getAvailableModels: vi.fn(),
    apply: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    api.apply.mockReset();
    api.history.mockReset().mockReturnValue(of({ messages: [], revision: 0, hasMore: false }));
    api.getAvailableModels.mockReset().mockReturnValue(of({ defaultProvider: 'ollama', mediaProvider: 'vertex', models: [] }));
    TestBed.configureTestingModule({
      imports: [AiAssistantPanelComponent],
      providers: [
        { provide: AiAssistantService, useValue: api },
        { provide: AuthService, useValue: { currentUser: signal(null) } },
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
    const connect = vi.spyOn(state, 'connect').mockImplementation(diagramId => {
      // Limita la reproducción del fallo para que la prueba nunca sature la máquina.
      if (++attempts > 2) throw new Error('Repeated panel initialization');
      originalConnect(diagramId);
    });

    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    expect(connect).toHaveBeenCalledTimes(1);
    expect(api.getAvailableModels).toHaveBeenCalledTimes(1);
    expect(api.history).toHaveBeenCalledTimes(1);
  });

  it.each([
    [400, 'chat.invalidProposal'], [422, 'chat.invalidProposal'],
    [403, 'chat.applyForbidden'], [409, 'chat.conflict'], [503, 'chat.applyFailed'],
  ])('shows the correct application error for HTTP %s', async (status, expected) => {
    fixture.componentRef.setInput('canEdit', true);
    fixture.detectChanges();
    await Promise.resolve();
    const panel = fixture.componentInstance;
    const applied = vi.fn();
    panel.proposalApplied.subscribe(applied);
    api.apply.mockReturnValue(throwError(() => ({ status })));
    const message: ChatMessage = { id: 'reply', sequence: 1, sender: { displayName: 'AI' },
      content: 'Proposal', source: 'assistant', status: 'completed', createdAt: '',
      proposal: { id: 'proposal', status: 'pending', baseRevision: 'base', summary: '', ast: { nodes: [], connections: [] } } };
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
    panel.media.attachment.set({ kind: 'image', data: 'aGVsbG8=', mimeType: 'image/png', name: 'example.png' });
    panel.media.recording.set(true);
    panel.state.messages.set([{ id: 'reply', sequence: 1, sender: { displayName: 'Alice' }, content: 'Hello', source: 'text', status: 'completed', createdAt: '' }]);
    panel.state.models.set({ defaultProvider: 'vertex', mediaProvider: 'vertex', models: [] });
    panel.state.error.set('chat.unavailable');
    fixture.detectChanges();

    expect(connect).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
    expect(panel.prompt()).toBe('Work in progress');
    expect(panel.media.attachment()?.name).toBe('example.png');
    expect(panel.media.recording()).toBe(true);
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
    api.getAvailableModels.mockReturnValue(of({ defaultProvider: 'ollama', mediaProvider: 'vertex', models: [
      { id: 'qwen2.5-coder:14b', provider: 'ollama', available: false, inputs: ['text'] },
      { id: 'gemini-2.5-flash', provider: 'vertex', available: true, inputs: ['text', 'image'] },
    ] }));
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
    panel.startResize({ button: 0, clientX: 600, pointerId: 1, currentTarget: handle, preventDefault: vi.fn() } as unknown as PointerEvent);
    panel.resize({ clientX: 500 } as PointerEvent);
    expect(panel.panelWidth()).toBe(520);
    panel.stopResize();
    panel.resize({ clientX: 400 } as PointerEvent);
    expect(panel.panelWidth()).toBe(520);
    panel.resizeWithKeyboard(new KeyboardEvent('keydown', { key: 'Home' }));
    expect(panel.panelWidth()).toBe(420);
    for (let i = 0; i < 20; i++) panel.resizeWithKeyboard(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
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
});
