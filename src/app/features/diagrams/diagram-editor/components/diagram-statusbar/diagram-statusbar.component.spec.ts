import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { DiagramStatusbarComponent } from './diagram-statusbar.component';

describe('Compact editor status', () => {
  it('reflects selection changes and emits navigation actions without presenting format controls', async () => {
    const fixture = TestBed.createComponent(DiagramStatusbarComponent);
    fixture.componentRef.setInput('selectedCount', 3);
    fixture.componentRef.setInput('zoomLevel', 75);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.selection-count')?.textContent).toContain('3');
    expect(root.querySelector('.zoom-value')?.textContent).toBe('75%');
    expect(root.textContent).not.toMatch(/UTF-8|XML|Routing/);
    const zoomIn = vi.fn();
    const zoomOut = vi.fn();
    const reset = vi.fn();
    fixture.componentInstance.zoomIn.subscribe(zoomIn);
    fixture.componentInstance.zoomOut.subscribe(zoomOut);
    fixture.componentInstance.resetView.subscribe(reset);
    root.querySelectorAll('button').forEach(button => button.click());
    expect(zoomIn).toHaveBeenCalledOnce();
    expect(zoomOut).toHaveBeenCalledOnce();
    expect(reset).toHaveBeenCalledOnce();
    fixture.componentRef.setInput('selectedCount', 0);
    await fixture.whenStable();
    expect(root.querySelector('.selection-count')?.textContent).toContain('0');
    fixture.destroy();
  }, 15000);
});
