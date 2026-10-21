import { TestBed } from '@angular/core/testing';
import { DiagramConnectionLayoutService } from './diagram-connection-layout.service';
import { DiagramType, UmlClassNode, UmlConnection, sanitizeLineStyle } from '../../../../../core/models/diagram.model';
import { ConnectionCascadeUtil } from '../../utils/connection-cascade.util';

describe('DiagramConnectionLayoutService & Adaptive Multi-Point Snapping', () => {
  let service: DiagramConnectionLayoutService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DiagramConnectionLayoutService],
    });
    service = TestBed.inject(DiagramConnectionLayoutService);
  });

  const createNode = (id: string, x: number, y: number, width = 200, height = 100): UmlClassNode => ({
    id,
    name: id,
    position: { x, y },
    width,
    height,
    attributes: [],
    methods: [],
  });

  describe('12-Point Perimeter Contact Point Calculation (getConnectorPoint)', () => {
    const node = createNode('NodeA', 100, 200, 200, 100);
    // Node bounds: left=100, right=300, top=200, bottom=300, width=200, height=100

    it('calcula correctamente los 3 puntos del borde superior (top_start, top, top_end)', () => {
      expect(service.getConnectorPoint(node, 'top_start')).toEqual({ x: 150, y: 200 }); // 25%
      expect(service.getConnectorPoint(node, 'top')).toEqual({ x: 200, y: 200 });       // 50%
      expect(service.getConnectorPoint(node, 'top_end')).toEqual({ x: 250, y: 200 });   // 75%
    });

    it('calcula correctamente los 3 puntos del borde inferior (bottom_start, bottom, bottom_end)', () => {
      expect(service.getConnectorPoint(node, 'bottom_start')).toEqual({ x: 150, y: 300 });
      expect(service.getConnectorPoint(node, 'bottom')).toEqual({ x: 200, y: 300 });
      expect(service.getConnectorPoint(node, 'bottom_end')).toEqual({ x: 250, y: 300 });
    });

    it('calcula correctamente los 3 puntos del borde izquierdo (left_start, left, left_end)', () => {
      expect(service.getConnectorPoint(node, 'left_start')).toEqual({ x: 100, y: 225 }); // 25%
      expect(service.getConnectorPoint(node, 'left')).toEqual({ x: 100, y: 250 });       // 50%
      expect(service.getConnectorPoint(node, 'left_end')).toEqual({ x: 100, y: 275 });   // 75%
    });

    it('calcula correctamente los 3 puntos del borde derecho (right_start, right, right_end)', () => {
      expect(service.getConnectorPoint(node, 'right_start')).toEqual({ x: 300, y: 225 });
      expect(service.getConnectorPoint(node, 'right')).toEqual({ x: 300, y: 250 });
      expect(service.getConnectorPoint(node, 'right_end')).toEqual({ x: 300, y: 275 });
    });
  });

  describe('Enterprise Architect Adaptive Connector Selection (getOptimalConnectorId)', () => {
    it('selecciona borde derecho a izquierdo en nodos horizontalmente alineados', () => {
      const nodeA = createNode('A', 100, 200, 160, 80);
      const nodeB = createNode('B', 400, 200, 160, 80); // exactamente a la derecha

      const opt = service.getOptimalConnectorId(nodeA, nodeB);
      expect(opt.sourceId).toBe('A_right');
      expect(opt.targetId).toBe('B_left');
    });

    it('selecciona borde inferior a superior en nodos verticalmente alineados', () => {
      const nodeA = createNode('A', 200, 100, 160, 80);
      const nodeB = createNode('A_Child', 200, 400, 160, 80); // exactamente debajo

      const opt = service.getOptimalConnectorId(nodeA, nodeB);
      expect(opt.sourceId).toBe('A_bottom');
      expect(opt.targetId).toBe('A_Child_top');
    });

    it('distribuye relaciones paralelas entre los 12 puertos sin colisionar', () => {
      const nodeA = createNode('A', 100, 200, 160, 80);
      const nodeB = createNode('B', 400, 200, 160, 80);

      // 2 relaciones paralelas entre A y B
      const conn0 = service.getOptimalConnectorId(nodeA, nodeB, undefined, undefined, 0, 2);
      const conn1 = service.getOptimalConnectorId(nodeA, nodeB, undefined, undefined, 1, 2);

      expect(conn0.sourceId).not.toBe(conn1.sourceId);
      expect(conn0.targetId).not.toBe(conn1.targetId);
      expect(conn0.sourceId).toBe('A_right_start');
      expect(conn1.sourceId).toBe('A_right_end');
      expect(conn0.targetId).toBe('B_left_start');
      expect(conn1.targetId).toBe('B_left_end');
    });
  });

  describe('ConnectionCascadeUtil Base ID Resolution', () => {
    it('extrae el ID base de nodos con puertos compuestos (_top_start, _bottom_end, _slot_4)', () => {
      expect(ConnectionCascadeUtil.extractBaseNodeId('node_123_top_start')).toBe('node_123');
      expect(ConnectionCascadeUtil.extractBaseNodeId('node_abc_bottom_end')).toBe('node_abc');
      expect(ConnectionCascadeUtil.extractBaseNodeId('user_node_left')).toBe('user_node');
      expect(ConnectionCascadeUtil.extractBaseNodeId('order_slot_3')).toBe('order');
      expect(ConnectionCascadeUtil.extractBaseNodeId('plain_node_id')).toBe('plain_node_id');
      expect(ConnectionCascadeUtil.extractBaseNodeId(undefined)).toBe('');
    });
  });

  describe('Line Style Normalization (sanitizeLineStyle)', () => {
    it('normaliza alias legados a los estilos estandarizados de Konva/Flow', () => {
      expect(sanitizeLineStyle('segment')).toBe('orthogonal_square');
      expect(sanitizeLineStyle('adaptive-curve')).toBe('orthogonal_rounded');
      expect(sanitizeLineStyle('direct')).toBe('straight');
      expect(sanitizeLineStyle('orthogonal_square')).toBe('orthogonal_square');
      expect(sanitizeLineStyle('orthogonal_rounded')).toBe('orthogonal_rounded');
      expect(sanitizeLineStyle('tree_vertical')).toBe('tree_vertical');
      expect(sanitizeLineStyle('tree_horizontal')).toBe('tree_horizontal');
      expect(sanitizeLineStyle('lateral_vertical')).toBe('lateral_vertical');
      expect(sanitizeLineStyle('lateral_horizontal')).toBe('lateral_horizontal');
      expect(sanitizeLineStyle(undefined)).toBe('orthogonal_square');
    });
  });

  describe('Recalculate Connection Endpoints', () => {
    it('recalcula automáticamente conexiones existentes para adaptarse a cambios posicionales', () => {
      const nodeA = createNode('A', 100, 200, 160, 80);
      const nodeB = createNode('B', 400, 200, 160, 80);
      const conns: UmlConnection[] = [
        {
          id: 'c1',
          sourceId: 'A_top',
          targetId: 'B_bottom',
          sourceNodeId: 'A',
          targetNodeId: 'B',
          type: 'association',
        },
      ];

      const getWidth = (n: UmlClassNode) => n.width || 160;
      const getHeight = (n: UmlClassNode) => n.height || 80;

      const result = service.recalculateConnectionEndpoints(
        [nodeA, nodeB],
        conns,
        DiagramType.CLASS,
        'orthogonal_square',
        getWidth,
        getHeight,
      );
      expect(result.updatedConnections[0].sourceId).toBe('A_right');
      expect(result.updatedConnections[0].targetId).toBe('B_left');
    });
  });
});
