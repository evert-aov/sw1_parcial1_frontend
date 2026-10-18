import { createEnvironmentInjector, runInInjectionContext } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CollaborationService } from '../../../../core/services/collaboration.service';
import { DiagramCollaborationCoordinatorService } from './diagram-collaboration-coordinator.service';

describe('DiagramCollaborationCoordinatorService: lote de arrastre por frame', () => {
  let sendNodeDrag: ReturnType<typeof vi.fn>;
  let leaveRoom: ReturnType<typeof vi.fn>;
  let service: DiagramCollaborationCoordinatorService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => setTimeout(cb, 16) as unknown as number);
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));

    sendNodeDrag = vi.fn();
    leaveRoom = vi.fn();
    const injector = createEnvironmentInjector(
      [{ provide: CollaborationService, useValue: { sendNodeDrag, leaveRoom } }],
      null as never,
    );
    service = runInInjectionContext(injector, () => new DiagramCollaborationCoordinatorService());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('acumula posiciones y envía una sola vez por nodo en cada frame', () => {
    service.sendNodeDrag('a', { x: 1, y: 1 });
    service.sendNodeDrag('a', { x: 2, y: 2 });
    service.sendNodeDrag('b', { x: 5, y: 5 });
    expect(sendNodeDrag).not.toHaveBeenCalled();

    vi.advanceTimersByTime(20);

    expect(sendNodeDrag).toHaveBeenCalledTimes(2);
    expect(sendNodeDrag).toHaveBeenCalledWith('a', { x: 2, y: 2 });
    expect(sendNodeDrag).toHaveBeenCalledWith('b', { x: 5, y: 5 });
  });

  it('programa un nuevo lote en el siguiente frame', () => {
    service.sendNodeDrag('a', { x: 1, y: 1 });
    vi.advanceTimersByTime(20);
    service.sendNodeDrag('a', { x: 9, y: 9 });
    vi.advanceTimersByTime(20);

    expect(sendNodeDrag).toHaveBeenCalledTimes(2);
    expect(sendNodeDrag).toHaveBeenLastCalledWith('a', { x: 9, y: 9 });
  });

  it('descarta el lote pendiente al abandonar la sala', () => {
    service.sendNodeDrag('a', { x: 1, y: 1 });
    service.leaveRoom();
    vi.advanceTimersByTime(50);

    expect(sendNodeDrag).not.toHaveBeenCalled();
    expect(leaveRoom).toHaveBeenCalledTimes(1);
  });

  it('no falla ni envía nada cuando CollaborationService no está disponible', () => {
    const standalone = new DiagramCollaborationCoordinatorService();
    expect(() => standalone.sendNodeDrag('a', { x: 1, y: 1 })).not.toThrow();
    expect(standalone.isMultiUserEditing()).toBe(false);
    expect(standalone.setupSubscriptions({} as never)).toEqual([]);
  });
});
