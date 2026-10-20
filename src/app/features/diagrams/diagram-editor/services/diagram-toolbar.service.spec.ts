import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DiagramToolbarService } from './diagram-toolbar.service';
import { DiagramAlignmentService } from './diagram-alignment.service';
import { UmlClassNode } from '../../../../core/models/diagram.model';

describe('DiagramToolbarService', () => {
  let service: DiagramToolbarService;
  let mockAlignmentService: any;
  let mockSelectionService: any;
  let mockNodeOps: any;

  beforeEach(() => {
    mockAlignmentService = {
      alignNodes: vi.fn().mockReturnValue([{ id: 'n1', position: { x: 10, y: 10 } }]),
      distributeNodes: vi.fn().mockReturnValue([{ id: 'n1', position: { x: 20, y: 20 } }]),
      snapToGrid: vi.fn().mockReturnValue([{ id: 'n1', position: { x: 40, y: 40 } }]),
      applyForceDirectedLayout: vi.fn().mockReturnValue([
        { id: 'n1', position: { x: 100, y: 80 } },
        { id: 'n2', position: { x: 420, y: 80 } },
      ]),
    };
    mockSelectionService = {
      selectAllClasses: vi.fn(),
    };
    mockNodeOps = {
      updateNodesColor: vi.fn().mockReturnValue({
        anyChanged: true,
        updatedNodes: [{ id: 'n1', color: '#BAE6FD' }],
      }),
    };

    service = new DiagramToolbarService(
      mockAlignmentService,
      mockSelectionService,
      mockNodeOps,
    );
  });

  describe('smartGuides', () => {
    it('inicia activado en true y toggleSmartGuides invierte su valor', () => {
      expect(service.smartGuidesEnabled()).toBe(true);
      service.toggleSmartGuides();
      expect(service.smartGuidesEnabled()).toBe(false);
      service.toggleSmartGuides();
      expect(service.smartGuidesEnabled()).toBe(true);
    });
  });

  describe('computeSelectedNodeColor', () => {
    it('retorna null si no hay nodo seleccionado', () => {
      const color = service.computeSelectedNodeColor(null, [], () => '#FDFAF3');
      expect(color).toBeNull();
    });

    it('retorna color propio del nodo si existe', () => {
      const nodes: UmlClassNode[] = [
        { id: 'c1', name: 'User', color: '#123456', attributes: [], methods: [] } as any,
      ];
      const color = service.computeSelectedNodeColor('c1', nodes, () => '#FDFAF3');
      expect(color).toBe('#123456');
    });

    it('retorna color por defecto si el nodo no tiene color propio', () => {
      const nodes: UmlClassNode[] = [
        { id: 'c1', name: 'User', attributes: [], methods: [] } as any,
      ];
      const color = service.computeSelectedNodeColor('c1', nodes, () => '#DDF4F5');
      expect(color).toBe('#DDF4F5');
    });
  });

  describe('applySelectedNodeColor', () => {
    it('no aplica cambios si está en modo solo lectura o la selección está vacía', () => {
      const pushSnapshot = vi.fn();
      service.applySelectedNodeColor('#FF0000', {
        isReadOnly: true,
        selectedNodeIds: ['c1'],
        nodes: [],
        connections: [],
        defaultLineStyle: 'segment',
        pushSnapshot,
        setNodes: vi.fn(),
        markAsUnsaved: vi.fn(),
        sendDiagramSync: vi.fn(),
      });
      expect(pushSnapshot).not.toHaveBeenCalled();
    });

    it('aplica cambios, genera snapshot y emite sincronización cuando es válido', () => {
      const pushSnapshot = vi.fn();
      const setNodes = vi.fn();
      const markAsUnsaved = vi.fn();
      const sendDiagramSync = vi.fn();

      service.applySelectedNodeColor('#BAE6FD', {
        isReadOnly: false,
        selectedNodeIds: ['n1'],
        nodes: [{ id: 'n1', name: 'User' } as any],
        connections: [],
        defaultLineStyle: 'segment',
        pushSnapshot,
        setNodes,
        markAsUnsaved,
        sendDiagramSync,
      });

      expect(pushSnapshot).toHaveBeenCalled();
      expect(setNodes).toHaveBeenCalledWith([{ id: 'n1', color: '#BAE6FD' }]);
      expect(markAsUnsaved).toHaveBeenCalled();
      expect(sendDiagramSync).toHaveBeenCalled();
    });
  });

  describe('alineación y distribución', () => {
    it('ignora alineación si hay menos de 2 nodos seleccionados', () => {
      const onApply = vi.fn();
      service.alignNodes('left', {
        isReadOnly: false,
        selectedNodeIds: new Set(['n1']),
        nodes: [],
        getNodeWidth: () => 100,
        getNodeHeight: () => 50,
        onApplyTransformation: onApply,
      });
      expect(onApply).not.toHaveBeenCalled();
    });

    it('ejecuta alineación cuando hay 2 o más nodos', () => {
      const onApply = vi.fn();
      service.alignNodes('left', {
        isReadOnly: false,
        selectedNodeIds: new Set(['n1', 'n2']),
        nodes: [],
        getNodeWidth: () => 100,
        getNodeHeight: () => 50,
        onApplyTransformation: onApply,
      });
      expect(onApply).toHaveBeenCalledWith([{ id: 'n1', position: { x: 10, y: 10 } }], 'align_nodes');
    });

    it('ignora distribución si hay menos de 3 nodos seleccionados', () => {
      const onApply = vi.fn();
      service.distributeNodes('horizontal', {
        isReadOnly: false,
        selectedNodeIds: new Set(['n1', 'n2']),
        nodes: [],
        getNodeWidth: () => 100,
        getNodeHeight: () => 50,
        onApplyTransformation: onApply,
      });
      expect(onApply).not.toHaveBeenCalled();
    });

    it('ejecuta distribución cuando hay 3 o más nodos', () => {
      const onApply = vi.fn();
      service.distributeNodes('horizontal', {
        isReadOnly: false,
        selectedNodeIds: new Set(['n1', 'n2', 'n3']),
        nodes: [],
        getNodeWidth: () => 100,
        getNodeHeight: () => 50,
        onApplyTransformation: onApply,
      });
      expect(onApply).toHaveBeenCalledWith([{ id: 'n1', position: { x: 20, y: 20 } }], 'distribute_nodes');
    });

    it('ejecuta snapSelectedToGrid correctamente', () => {
      const onApply = vi.fn();
      service.snapSelectedToGrid({
        isReadOnly: false,
        selectedNodeIds: new Set(['n1']),
        nodes: [],
        getNodeWidth: () => 100,
        getNodeHeight: () => 50,
        onApplyTransformation: onApply,
      });
      expect(onApply).toHaveBeenCalledWith([{ id: 'n1', position: { x: 40, y: 40 } }], 'snap_grid');
    });

    it('ejecuta autoLayoutNodes y garantiza separación sin solapamientos con DiagramAlignmentService real', () => {
      const realAlignment = new DiagramAlignmentService();
      const stackedNodes: UmlClassNode[] = [
        { id: 'n1', name: 'Usuario', position: { x: 200, y: 200 }, attributes: [], methods: [] } as any,
        { id: 'n2', name: 'Pedido', position: { x: 200, y: 200 }, attributes: [], methods: [] } as any,
        { id: 'n3', name: 'Producto', position: { x: 200, y: 200 }, attributes: [], methods: [] } as any,
      ];
      const conns: any[] = [
        { id: 'c1', sourceId: 'n1_right', targetId: 'n2_left', sourceNodeId: 'n1', targetNodeId: 'n2', type: 'association' },
        { id: 'c2', sourceId: 'n2_right', targetId: 'n3_left', sourceNodeId: 'n2', targetNodeId: 'n3', type: 'composition' },
      ];
      const laidOut = realAlignment.applyForceDirectedLayout(
        stackedNodes,
        conns,
        () => 220,
        () => 140,
      );
      expect(laidOut.length).toBe(3);

      // Verificar que ningún par de nodos se solape tras el algoritmo Force-Directed
      for (let i = 0; i < laidOut.length; i++) {
        for (let j = i + 1; j < laidOut.length; j++) {
          const a = laidOut[i];
          const b = laidOut[j];
          const overlapX = a.position.x < b.position.x + 220 && a.position.x + 220 > b.position.x;
          const overlapY = a.position.y < b.position.y + 140 && a.position.y + 140 > b.position.y;
          expect(overlapX && overlapY).toBe(false);
        }
      }
    });
  });

  describe('selección', () => {
    it('delega selectAllClasses al selectionService', () => {
      const selectFn = vi.fn();
      service.selectAllClasses([], null, selectFn);
      expect(mockSelectionService.selectAllClasses).toHaveBeenCalledWith([], null, selectFn);
    });
  });
});
