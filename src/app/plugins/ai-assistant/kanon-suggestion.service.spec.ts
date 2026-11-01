import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { TranslationService } from '../../core/i18n/index';
import { AiAssistantService } from './ai-assistant.service';
import { KanonSuggestionService } from './kanon-suggestion.service';

describe('KanonSuggestionService hybrid proactive engine', () => {
  let service: KanonSuggestionService;
  const api = {
    suggest: vi.fn(),
    acceptSuggestion: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    api.suggest.mockReset();
    api.acceptSuggestion.mockReset().mockReturnValue(of({ id: 'seeded-1' }));
    TestBed.configureTestingModule({
      providers: [
        KanonSuggestionService,
        { provide: AiAssistantService, useValue: api },
        { provide: TranslationService, useValue: { currentLang: () => 'es' } },
      ],
    });
    service = TestBed.inject(KanonSuggestionService);
  });

  afterEach(() => {
    service.ngOnDestroy();
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('ignores node movements and floating notes, and triggers on real N:M structural issues', async () => {
    const student = {
      id: 'n1',
      name: 'Estudiante',
      nodeType: 'class',
      position: { x: 10, y: 10 },
      attributes: [{ name: 'id', type: 'Long' }],
    };
    const course = {
      id: 'n2',
      name: 'Curso',
      nodeType: 'class',
      position: { x: 250, y: 10 },
      attributes: [{ name: 'id', type: 'Long' }],
    };

    // Foto inicial (baseline) al abrir el diagrama
    service.observeSnapshot('diag-1', 'CLASS', [student, course], []);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(api.suggest).not.toHaveBeenCalled();

    // Solo mover coordenadas o agregar una nota flotante NO dispara sugerencia
    service.observeSnapshot(
      'diag-1',
      'CLASS',
      [
        { ...student, position: { x: 500, y: 400 } },
        course,
        { id: 'note-1', name: 'Revisar mañana con el equipo', nodeType: 'note', position: { x: 80, y: 80 } },
      ],
      [{ id: 'c-note', sourceId: 'note-1', targetId: 'n1', type: 'dependency' }],
    );
    await vi.advanceTimersByTimeAsync(20_000);
    expect(api.suggest).not.toHaveBeenCalled();

    // Modelar una relación muchos-a-muchos directa N:M dispara sugerencia tras el debounce de 15 s
    api.suggest.mockReturnValue(
      of({
        suggestion: {
          id: 'sug-1',
          diagramId: 'diag-1',
          title: 'Tabla intermedia recomendada',
          summary: 'Conviene modelar Inscripcion entre Estudiante y Curso.',
          severity: 'warning',
          createdAt: new Date().toISOString(),
        },
      }),
    );

    service.observeSnapshot(
      'diag-1',
      'CLASS',
      [student, course],
      [
        {
          id: 'c1',
          type: 'association',
          sourceId: 'n1',
          targetId: 'n2',
          sourceMultiplicity: '0..*',
          targetMultiplicity: '1..*',
        },
      ],
    );

    await vi.advanceTimersByTimeAsync(14_999);
    expect(api.suggest).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(api.suggest).toHaveBeenCalledOnce();
    expect(service.activeSuggestion()?.title).toBe('Tabla intermedia recomendada');

    // Al pulsar "Continuar en el chat", siembra la sugerencia en el chat personal y limpia la tarjeta
    const acceptedDiagram = await service.acceptCurrentSuggestion();
    expect(acceptedDiagram).toBe('diag-1');
    expect(service.activeSuggestion()).toBeNull();
    expect(api.acceptSuggestion).toHaveBeenCalledWith(
      'diag-1',
      expect.objectContaining({
        clientSuggestionId: 'sug-1',
        title: 'Tabla intermedia recomendada',
        language: 'es',
        scope: 'personal',
      }),
    );
  });

  it('does NOT trigger N:M suggestion when an association class or intermediate bridge already exists', async () => {
    const pedido = {
      id: 'n_pedido',
      name: 'Pedido',
      nodeType: 'class',
      position: { x: 50, y: 100 },
      attributes: [{ name: 'id', type: 'Long' }],
    };
    const producto = {
      id: 'n_producto',
      name: 'Producto',
      nodeType: 'class',
      position: { x: 450, y: 100 },
      attributes: [{ name: 'id', type: 'Long' }],
    };
    const detallePedido = {
      id: 'n_detalle',
      name: 'DetallePedido',
      nodeType: 'class',
      position: { x: 250, y: 250 },
      attributes: [{ name: 'cantidad', type: 'Integer' }],
      assocMainConnId: 'c_main',
    };
    const anchor = {
      id: 'anchor_1',
      name: '',
      isAnchor: true,
      position: { x: 250, y: 100 },
      attributes: [],
      methods: [],
    };

    // Baseline
    service.observeSnapshot('diag-2', 'CLASS', [pedido, producto], []);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(api.suggest).not.toHaveBeenCalled();

    // Snapshot con clase de asociación ya vinculada (ancla + assocMainConnId + conexión discontinua)
    service.observeSnapshot(
      'diag-2',
      'CLASS',
      [pedido, producto, detallePedido, anchor],
      [
        {
          id: 'c_main',
          type: 'association',
          sourceId: 'n_pedido',
          targetId: 'n_producto',
          sourceMultiplicity: '*',
          targetMultiplicity: '*',
          assocAnchorNodeId: 'anchor_1',
        },
        {
          id: 'c_dashed',
          type: 'association_class',
          sourceId: 'anchor_1',
          targetId: 'n_detalle',
        },
      ],
    );

    await vi.advanceTimersByTimeAsync(30_000);
    expect(api.suggest).not.toHaveBeenCalled();
  });
});
