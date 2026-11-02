import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of, Subject, throwError } from 'rxjs';
import { QeaImportDialogComponent } from './qea-import-dialog.component';
import { XmiService } from '../../core/plugins/contracts/xmi.service.contract';
import { DiagramService } from '../../core/services/diagram.service';

describe('QEA import dialog', () => {
  const exchange = { previewQea: vi.fn(), importQea: vi.fn() };
  const catalog = { loadDiagramsByProject: vi.fn() };
  beforeEach(() => {
    vi.clearAllMocks();
    exchange.previewQea.mockReturnValue(
      of([{ id: 1, name: 'Class', supported: true, warnings: [] }]),
    );
    exchange.importQea.mockReturnValue(of([{ id: 'new', name: 'Class' }]));
    catalog.loadDiagramsByProject.mockReturnValue(of([]));
    TestBed.configureTestingModule({
      providers: [
        { provide: XmiService, useValue: exchange },
        { provide: DiagramService, useValue: catalog },
      ],
    });
  });
  /** Crea el diálogo con un archivo seleccionado como en el navegador. */
  async function setup() {
    const fixture = TestBed.createComponent(QeaImportDialogComponent);
    fixture.componentRef.setInput('projectId', 'project');
    const component = fixture.componentInstance;
    await component.selectFile({
      target: { files: [new File(['sqlite'], 'project.qea')] },
    } as unknown as Event);
    return component;
  }
  it('requires explicit selection and refreshes the catalog without opening a diagram', async () => {
    const component = await setup();
    expect(component.selected()).toEqual([]);
    await component.confirm();
    expect(exchange.importQea).not.toHaveBeenCalled();
    component.toggle(1);
    await component.confirm();
    expect(exchange.importQea).toHaveBeenCalledWith(expect.any(File), 'project', [1]);
    expect(catalog.loadDiagramsByProject).toHaveBeenCalledWith('project');
    expect(component.imported()).toBe(true);
  });
  it('prevents duplicate submits while pending and after success', async () => {
    const response = new Subject<{ id: string; name: string }[]>();
    exchange.importQea.mockReturnValue(response);
    const component = await setup();
    component.toggle(1);
    const pending = component.confirm();
    await component.confirm();
    expect(component.busy()).toBe(true);
    expect(exchange.importQea).toHaveBeenCalledTimes(1);
    response.next([]);
    response.complete();
    await pending;
    await component.confirm();
    expect(exchange.importQea).toHaveBeenCalledTimes(1);
  });
  it('keeps successful imports locked when refreshing the explorer fails', async () => {
    catalog.loadDiagramsByProject.mockReturnValue(throwError(() => new Error('offline')));
    const component = await setup();
    component.toggle(1);
    await component.confirm();
    await component.confirm();
    expect(component.imported()).toBe(true);
    expect(component.error()).toBe('offline');
    expect(exchange.importQea).toHaveBeenCalledTimes(1);
  });
  it('shows server errors and cannot import failed previews', async () => {
    exchange.previewQea.mockReturnValue(throwError(() => ({ error: { message: 'Invalid QEA' } })));
    const component = await setup();
    component.toggle(1);
    await component.confirm();
    expect(component.error()).toBe('Invalid QEA');
    expect(exchange.importQea).not.toHaveBeenCalled();
  });
  it('supports drag and drop, file size formatting and clearing selection', async () => {
    const fixture = TestBed.createComponent(QeaImportDialogComponent);
    fixture.componentRef.setInput('projectId', 'project');
    const component = fixture.componentInstance;

    // Test drag over & leave
    const dragEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as DragEvent;
    component.onDragOver(dragEvent);
    expect(component.isDragging()).toBe(true);

    component.onDragLeave(dragEvent);
    expect(component.isDragging()).toBe(false);

    // Test drop with a file
    const dropEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      dataTransfer: { files: [new File(['fake content with some length'], 'model.qea')] },
    } as unknown as DragEvent;
    await component.onDrop(dropEvent);

    expect(component.selectedFile()?.name).toBe('model.qea');
    expect(component.formattedFileSize()).toContain('B');
    expect(component.diagrams().length).toBe(1);

    // Test diagram type styling helper
    expect(component.getDiagramTypeStyle('Class').text).toContain('blue');
    expect(component.getDiagramTypeStyle('Sequence').text).toContain('purple');
    expect(component.getDiagramTypeStyle('Communication').text).toContain('amber');
    expect(component.getDiagramTypeStyle('UseCase').text).toContain('emerald');

    // Test clearing file
    const mockInput = { value: 'model.qea' } as HTMLInputElement;
    component.clearFile(mockInput);
    expect(component.selectedFile()).toBeNull();
    expect(component.diagrams()).toEqual([]);
    expect(mockInput.value).toBe('');
  });
  it('dismisses modal on backdrop click and closes safely', async () => {
    const fixture = TestBed.createComponent(QeaImportDialogComponent);
    fixture.componentRef.setInput('projectId', 'project');
    const component = fixture.componentInstance;
    const closedSpy = vi.fn();
    component.closed.subscribe(closedSpy);

    const dialogEl = fixture.nativeElement.querySelector('dialog');
    component.onBackdropClick({ target: dialogEl } as unknown as MouseEvent);
    expect(closedSpy).toHaveBeenCalledTimes(1);
  });
});
