import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiagramType } from '../../../../core/models/diagram.model';
import { DiagramAiSyncService, PostMutationCallbacks } from './diagram-ai-sync.service';
import { DiagramConnectionLayoutService } from './diagram-connection-layout.service';

describe('DiagramAiSyncService: redibujado cancelable y mutación tipada', () => {
  let service: DiagramAiSyncService;
  let callbacks: Required<PostMutationCallbacks>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => setTimeout(cb, 16) as unknown as number);
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
    service = new DiagramAiSyncService(new DiagramConnectionLayoutService());
    callbacks = {
      updateEndpoints: vi.fn(),
      resetCanvas: vi.fn(),
      fitView: vi.fn(),
      redrawCanvas: vi.fn(),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('ejecuta las tres fases en orden cuando no se cancela', () => {
    service.schedulePostMutationRedraw(callbacks);
    vi.advanceTimersByTime(16);
    expect(callbacks.updateEndpoints).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(16);
    expect(callbacks.resetCanvas).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(80);
    expect(callbacks.fitView).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(80);
    expect(callbacks.redrawCanvas).toHaveBeenCalledTimes(1);
  });

  it('no ejecuta fases pendientes tras abortar con AbortSignal', () => {
    const controller = new AbortController();
    service.schedulePostMutationRedraw(callbacks, controller.signal);
    vi.advanceTimersByTime(32);
    expect(callbacks.resetCanvas).toHaveBeenCalledTimes(1);

    controller.abort();
    vi.advanceTimersByTime(500);

    expect(callbacks.fitView).not.toHaveBeenCalled();
    expect(callbacks.redrawCanvas).not.toHaveBeenCalled();
  });

  it('la función retornada cancela toda la cadena', () => {
    const cancel = service.schedulePostMutationRedraw(callbacks);
    cancel();
    vi.advanceTimersByTime(500);

    expect(callbacks.updateEndpoints).not.toHaveBeenCalled();
    expect(callbacks.redrawCanvas).not.toHaveBeenCalled();
  });

  it('processAiMutation acepta nodos parciales y coordenadas planas sin any', () => {
    const { cleanNodes } = service.processAiMutation({
      targetNodes: [{ id: 'actor_1', name: 'Cliente', positionX: 40, positionY: 60 }],
      targetConns: [],
      activeDiagramType: DiagramType.USE_CASE,
      defaultLineStyle: 'straight',
      getDefaultColorForNodeType: () => '#FFFFFF',
      getOptimalConnectorId: (s, t) => ({ sourceId: `${s.id}_right`, targetId: `${t.id}_left` }),
      getConnectorPoint: (n) => ({ x: n.position.x, y: n.position.y }),
      recalculateSequenceNumbers: (c) => c,
    });

    expect(cleanNodes).toHaveLength(1);
    expect(cleanNodes[0].nodeType).toBe('actor');
    expect(cleanNodes[0].position).toEqual({ x: 40, y: 60 });
  });
});
