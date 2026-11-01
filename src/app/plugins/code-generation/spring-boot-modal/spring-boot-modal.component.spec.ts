import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { UmlNodeType } from '../../../core/models/diagram.model';
import { ToastService } from '../../../core/services/toast.service';
import { CodeGeneratorService } from '../code-generator.service';
import { SpringBootModalComponent } from './spring-boot-modal.component';

describe('SpringBootModalComponent floating note exclusion', () => {
  it('excludes floating note nodes and their incident links from Spring Boot & Flutter codegen', () => {
    const codegen = {
      previewFromDiagramId: vi.fn().mockReturnValue(of({ files: [] })),
      downloadZip: vi.fn().mockReturnValue(of(new Blob())),
    };
    TestBed.configureTestingModule({
      imports: [SpringBootModalComponent],
      providers: [
        { provide: CodeGeneratorService, useValue: codegen },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } },
      ],
    });

    const fixture = TestBed.createComponent(SpringBootModalComponent);
    fixture.componentRef.setInput('diagramId', 'diag-1');
    fixture.componentRef.setInput('nodes', [
      {
        id: 'class-1',
        name: 'Cliente',
        nodeType: UmlNodeType.CLASS,
        position: { x: 0, y: 0 },
        attributes: [{ id: 'a1', name: 'nombre', type: 'String', visibility: '-' }],
        methods: [],
      },
      {
        id: 'note-1',
        name: 'Recordatorio interno: validar NIT con contabilidad',
        nodeType: UmlNodeType.NOTE,
        position: { x: 220, y: 0 },
        attributes: [],
        methods: [],
      },
    ]);
    fixture.componentRef.setInput('connections', [
      {
        id: 'conn-note',
        sourceId: 'note-1_right',
        targetId: 'class-1_left',
        type: 'dependency',
      },
    ]);
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    expect(fixture.componentInstance.totalClasses()).toBe(1);
    expect(fixture.componentInstance.totalRelations()).toBe(0);
    expect(codegen.previewFromDiagramId).toHaveBeenCalledOnce();
    const [diagId, payload] = codegen.previewFromDiagramId.mock.calls[0];
    expect(diagId).toBe('diag-1');
    expect(payload.nodes.map((n: { id: string }) => n.id)).toEqual(['class-1']);
    expect(payload.connections).toEqual([]);
    fixture.destroy();
  });
});
