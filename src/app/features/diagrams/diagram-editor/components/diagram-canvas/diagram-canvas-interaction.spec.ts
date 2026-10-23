import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FDraggableDirective, FSelectionChangeEvent } from '@foblex/flow';
import { describe, expect, it, vi } from 'vitest';
import { DiagramCanvasComponent } from './diagram-canvas.component';

describe('Canvas interaction suspension', () => {
  it('blocks focus, pointer gestures, selection and space panning until interaction resumes', async () => {
    const fixture = TestBed.createComponent(DiagramCanvasComponent);
    const canvas = fixture.componentInstance;
    const selection = vi.fn();
    canvas.selectionChange.subscribe(selection);
    fixture.componentRef.setInput('interactionDisabled', true);
    await fixture.whenStable();

    const draggable = fixture.debugElement.query(By.directive(FDraggableDirective))
      .injector.get(FDraggableDirective);
    expect(fixture.nativeElement.hasAttribute('inert')).toBe(true);
    expect(draggable.disabled).toBe(true);
    const event = new FSelectionChangeEvent(['node-1'], [], ['connection-1']);
    canvas.onSelectionChange(event);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    expect(selection).not.toHaveBeenCalled();
    expect(canvas.isSpacePressed()).toBe(false);

    fixture.componentRef.setInput('interactionDisabled', false);
    await fixture.whenStable();
    expect(fixture.nativeElement.hasAttribute('inert')).toBe(false);
    expect(draggable.disabled).toBe(false);
    canvas.onSelectionChange(event);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    expect(selection).toHaveBeenCalledWith(event);
    expect(canvas.isSpacePressed()).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    fixture.destroy();
  });

  it('alterna la visibilidad de la cuadrícula f-background según isGridVisible', async () => {
    const fixture = TestBed.createComponent(DiagramCanvasComponent);
    fixture.componentRef.setInput('isGridVisible', false);
    await fixture.whenStable();
    const bgElement = fixture.nativeElement.querySelector('f-background');
    expect(bgElement).not.toBeNull();
    expect(bgElement?.classList.contains('canvas-grid-hidden')).toBe(true);

    fixture.componentRef.setInput('isGridVisible', true);
    await fixture.whenStable();
    expect(bgElement?.classList.contains('canvas-grid-hidden')).toBe(false);
    expect(fixture.nativeElement.querySelector('f-background rect')).not.toBeNull();
    fixture.destroy();
  });

  it('mantiene f-magnetic-lines y f-magnetic-rects en el DOM y alterna su threshold y display según smartGuidesEnabled', async () => {
    const fixture = TestBed.createComponent(DiagramCanvasComponent);
    fixture.componentRef.setInput('smartGuidesEnabled', true);
    await fixture.whenStable();

    const linesEl = fixture.nativeElement.querySelector('f-magnetic-lines');
    const rectsEl = fixture.nativeElement.querySelector('f-magnetic-rects');
    expect(linesEl).not.toBeNull();
    expect(rectsEl).not.toBeNull();
    expect(linesEl?.style.display).not.toBe('none');
    expect(rectsEl?.style.display).not.toBe('none');

    // Desactivar guías inteligentes
    fixture.componentRef.setInput('smartGuidesEnabled', false);
    await fixture.whenStable();

    // Deben seguir presentes en el DOM para preservar el renderer singleton de Foblex Flow
    const linesElAfterOff = fixture.nativeElement.querySelector('f-magnetic-lines');
    const rectsElAfterOff = fixture.nativeElement.querySelector('f-magnetic-rects');
    expect(linesElAfterOff).toBe(linesEl);
    expect(rectsElAfterOff).toBe(rectsEl);
    expect(linesElAfterOff?.style.display).toBe('none');
    expect(rectsElAfterOff?.style.display).toBe('none');

    // Reactivar guías inteligentes sin recrear los elementos del DOM
    fixture.componentRef.setInput('smartGuidesEnabled', true);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('f-magnetic-lines')).toBe(linesEl);
    expect(fixture.nativeElement.querySelector('f-magnetic-rects')).toBe(rectsEl);
    expect(linesEl?.style.display).not.toBe('none');
    expect(rectsEl?.style.display).not.toBe('none');

    fixture.destroy();
  });
});
