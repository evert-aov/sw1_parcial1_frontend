import '@angular/compiler';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createEnvironmentInjector, EnvironmentInjector, runInInjectionContext, signal } from '@angular/core';
import { DiagramCanvasComponent } from './diagram-canvas.component';
import { DiagramType, UmlClassNode } from '../../../../../core/models/diagram.model';

describe('DiagramCanvasComponent: Guías inteligentes y snap magnético', () => {
  let component: DiagramCanvasComponent;
  let injector: EnvironmentInjector;
  const originalGetContext = HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(4) }),
      putImageData: vi.fn(),
      createImageData: vi.fn(),
      setTransform: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 0 }),
    }) as any;

    injector = createEnvironmentInjector([], null as any);
    runInInjectionContext(injector, () => {
      component = Object.assign(Object.create(DiagramCanvasComponent.prototype), {
        smartGuidesEnabled: signal(true),
        activeDiagramType: signal(DiagramType.CLASS),
        nodes: signal<UmlClassNode[]>([]),
        zoomLevel: signal(100),
        nodeGroupsMap: new Map(),
      });
    });
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it('permite limpiar las guías magnéticas de forma segura con clearSmartGuides', () => {
    const destroyChildrenSpy = vi.fn();
    const batchDrawSpy = vi.fn();
    (component as any).guideLinesGroup = {
      children: [{}],
      destroyChildren: destroyChildrenSpy,
    };
    (component as any).uiLayer = {
      batchDraw: batchDrawSpy,
    };

    component.clearSmartGuides();

    expect(destroyChildrenSpy).toHaveBeenCalled();
    expect(batchDrawSpy).toHaveBeenCalled();
  });

  it('calcula y ajusta la posición en X mediante guías magnéticas si está dentro del umbral (<= 8px)', () => {
    const targetGroup = {
      x: () => 200,
      y: () => 100,
      width: () => 150,
      height: () => 80,
      visible: () => true,
    };
    (component as any).nodeGroupsMap.set('target-1', targetGroup);
    (component as any).stage = {};
    const addLineSpy = vi.fn();
    (component as any).guideLinesGroup = {
      children: [],
      destroyChildren: vi.fn(),
      add: addLineSpy,
    };
    (component as any).uiLayer = { batchDraw: vi.fn() };

    (component as any).nodes = signal<UmlClassNode[]>([
      { id: 'target-1', name: 'Target', position: { x: 200, y: 100 }, width: 150, height: 80, attributes: [], methods: [] },
      { id: 'dragged-1', name: 'Dragged', position: { x: 205, y: 300 }, width: 150, height: 80, attributes: [], methods: [] },
    ]);

    // Arrastrado cerca en X (205 vs 200 => diff = 5 <= 8px)
    const result = (component as any).calculateAndDrawSmartGuides(
      'dragged-1',
      205,
      300,
      150,
      80,
      new Set(['dragged-1'])
    );

    expect(result.x).toBe(200); // Snapped a 200
    expect(addLineSpy).toHaveBeenCalled();
  });

  it('no modifica la posición si la distancia supera el umbral magnético (> 8px)', () => {
    const targetGroup = {
      x: () => 200,
      y: () => 100,
      width: () => 150,
      height: () => 80,
      visible: () => true,
    };
    (component as any).nodeGroupsMap.set('target-1', targetGroup);
    (component as any).stage = {};
    const addLineSpy = vi.fn();
    (component as any).guideLinesGroup = {
      children: [],
      destroyChildren: vi.fn(),
      add: addLineSpy,
    };
    (component as any).uiLayer = { batchDraw: vi.fn() };

    (component as any).nodes = signal<UmlClassNode[]>([
      { id: 'target-1', name: 'Target', position: { x: 200, y: 100 }, width: 150, height: 80, attributes: [], methods: [] },
    ]);

    // Arrastrado lejos en X (230 vs 200 => diff = 30 > 8px)
    const result = (component as any).calculateAndDrawSmartGuides(
      'dragged-1',
      230,
      300,
      150,
      80,
      new Set(['dragged-1'])
    );

    expect(result.x).toBe(230); // Sin snap
    expect(result.y).toBe(300);
    expect(addLineSpy).not.toHaveBeenCalled();
  });
});
