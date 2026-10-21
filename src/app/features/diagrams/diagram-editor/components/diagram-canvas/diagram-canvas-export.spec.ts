import type { FCanvasComponent } from '@foblex/flow';
import { describe, expect, it, vi } from 'vitest';
import { DiagramCanvasComponent } from './diagram-canvas.component';

describe('DiagramCanvasComponent export viewport adapter', () => {
  function host() {
    const original = { scale: 1.75, position: { x: 120, y: -80 }, scaledPosition: { x: 210, y: -140 } };
    const transform = structuredClone(original);
    const canvas = {
      transform,
      resetScale: vi.fn(() => { transform.scale = 1; }),
      redraw: vi.fn(),
    };
    const component = Object.create(DiagramCanvasComponent.prototype) as DiagramCanvasComponent;
    component.canvas = canvas as unknown as FCanvasComponent;
    return { component, canvas, original };
  }

  it('normalizes capture coordinates and restores the exact zoom and pan', () => {
    const { component, canvas, original } = host();
    const restore = component.prepareForExport();
    expect(canvas.transform).toEqual({ scale: 1, position: { x: 0, y: 0 }, scaledPosition: { x: 0, y: 0 } });
    restore();
    expect(canvas.transform).toEqual(original);
    expect(canvas.redraw).toHaveBeenCalledTimes(2);
  });

  it('restores the viewport if preparation fails', () => {
    const { component, canvas, original } = host();
    canvas.redraw.mockImplementationOnce(() => { throw new Error('redraw failed'); });
    expect(() => component.prepareForExport()).toThrow('redraw failed');
    expect(canvas.transform).toEqual(original);
  });

  it('provides a no-op restoration callback before the canvas is initialized', () => {
    const { component } = host();
    component.canvas = undefined;
    expect(() => component.prepareForExport()()).not.toThrow();
  });
});
