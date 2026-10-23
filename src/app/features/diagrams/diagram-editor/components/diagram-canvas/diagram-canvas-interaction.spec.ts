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
});
