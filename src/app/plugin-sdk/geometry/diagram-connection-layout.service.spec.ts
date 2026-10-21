import { provideEditorPlugins } from '../../composition/editor-plugins';
import { TestBed } from '@angular/core/testing';
import { DiagramConnectionLayoutService } from './diagram-connection-layout.service';
import { DiagramType, UmlClassNode, UmlConnection, sanitizeLineStyle } from '../../core/models/diagram.model';

describe('DiagramConnectionLayoutService & Adaptive Multi-Point Snapping', () => {
  let service: DiagramConnectionLayoutService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideEditorPlugins(),DiagramConnectionLayoutService],
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

    it('adapta el punto de conexión de la clase de asociación al borde inferior cuando está ubicada encima del ancla', () => {
      // roles y users en y=300
      const rolesNode = createNode('roles', 100, 300, 200, 80);
      const usersNode = createNode('users', 500, 300, 200, 80);
      const anchorNode: UmlClassNode = {
        id: 'anchor_1',
        name: '',
        position: { x: 400, y: 340 },
        width: 0,
        height: 0,
        attributes: [],
        methods: [],
        isAnchor: true,
      };
      // Clase de asociación roles_users ubicada ARRIBA de las tablas y del ancla (y=100)
      const assocClassNode = createNode('roles_users', 300, 100, 200, 80);

      const mainConn: UmlConnection = {
        id: 'conn_main',
        sourceId: 'roles_right',
        targetId: 'users_left',
        sourceNodeId: 'roles',
        targetNodeId: 'users',
        type: 'association',
        assocAnchorNodeId: 'anchor_1',
      };

      const dashedConn: UmlConnection = {
        id: 'conn_dashed',
        sourceId: 'anchor_1',
        targetId: 'roles_users_top', // Inicialmente fijado en top
        sourceNodeId: 'anchor_1',
        targetNodeId: 'roles_users',
        type: 'association_class',
        lineStyle: 'straight',
      };

      const getWidth = (n: UmlClassNode) => n.width || 200;
      const getHeight = (n: UmlClassNode) => n.height || 80;

      const result = service.recalculateConnectionEndpoints(
        [rolesNode, usersNode, anchorNode, assocClassNode],
        [mainConn, dashedConn],
        DiagramType.CLASS,
        'orthogonal_square',
        getWidth,
        getHeight,
      );

      const updatedDashed = result.updatedConnections.find((c) => c.id === 'conn_dashed');
      expect(updatedDashed).toBeDefined();
      expect(updatedDashed?.sourceId).toBe('anchor_1');
      // Debe conectarse al borde inferior (_bottom) ya que el ancla está abajo de la clase de asociación
      expect(updatedDashed?.targetId).toMatch(/^roles_users_bottom/);
    });

    it('adapta el punto de conexión de la clase de asociación al borde superior cuando está ubicada debajo del ancla', () => {
      const rolesNode = createNode('roles', 100, 200, 200, 80);
      const usersNode = createNode('users', 500, 200, 200, 80);
      const anchorNode: UmlClassNode = {
        id: 'anchor_1',
        name: '',
        position: { x: 400, y: 240 },
        width: 0,
        height: 0,
        attributes: [],
        methods: [],
        isAnchor: true,
      };
      // Clase de asociación ubicada ABAJO (y=400)
      const assocClassNode = createNode('roles_users', 300, 400, 200, 80);

      const mainConn: UmlConnection = {
        id: 'conn_main',
        sourceId: 'roles_right',
        targetId: 'users_left',
        sourceNodeId: 'roles',
        targetNodeId: 'users',
        type: 'association',
        assocAnchorNodeId: 'anchor_1',
      };

      const dashedConn: UmlConnection = {
        id: 'conn_dashed',
        sourceId: 'anchor_1',
        targetId: 'roles_users_bottom',
        sourceNodeId: 'anchor_1',
        targetNodeId: 'roles_users',
        type: 'association_class',
        lineStyle: 'straight',
      };

      const getWidth = (n: UmlClassNode) => n.width || 200;
      const getHeight = (n: UmlClassNode) => n.height || 80;

      const result = service.recalculateConnectionEndpoints(
        [rolesNode, usersNode, anchorNode, assocClassNode],
        [mainConn, dashedConn],
        DiagramType.CLASS,
        'orthogonal_square',
        getWidth,
        getHeight,
      );

      const updatedDashed = result.updatedConnections.find((c) => c.id === 'conn_dashed');
      expect(updatedDashed?.targetId).toMatch(/^roles_users_top/);
    });
  });

  describe('Adaptive Port Toward Point & Anchor Non-Recursion (RangeError Prevention)', () => {
    it('no entra en recursión infinita cuando uno o ambos nodos son anclas', () => {
      const anchorNode: UmlClassNode = {
        id: 'anchor_node',
        name: '',
        position: { x: 300, y: 300 },
        width: 0,
        height: 0,
        attributes: [],
        methods: [],
        isAnchor: true,
      };
      const classNode = createNode('ClassNode', 300, 100, 200, 80);

      // No debe lanzar RangeError: Maximum call stack size exceeded
      expect(() => {
        const result1 = service.getOptimalConnectorId(anchorNode, classNode);
        expect(result1.sourceId).toBe('anchor_node');
        expect(result1.targetId).toMatch(/^ClassNode_bottom/);

        const result2 = service.getOptimalConnectorId(classNode, anchorNode);
        expect(result2.sourceId).toMatch(/^ClassNode_bottom/);
        expect(result2.targetId).toBe('anchor_node');

        const result3 = service.getOptimalConnectorId(anchorNode, anchorNode);
        expect(result3.sourceId).toBe('anchor_node');
        expect(result3.targetId).toBe('anchor_node');
      }).not.toThrow();
    });

    it('calcula los conectores correctos hacia puntos en las 4 direcciones cardinales', () => {
      const node = createNode('Box', 200, 200, 200, 100);
      // Box bounds: left=200, right=400, top=200, bottom=300, center=(300, 250)

      // Punto abajo -> _bottom
      expect(service.getOptimalPortTowardPoint(node, { x: 300, y: 450 })).toBe('Box_bottom');
      // Punto arriba -> _top
      expect(service.getOptimalPortTowardPoint(node, { x: 300, y: 50 })).toBe('Box_top');
      // Punto izquierda -> _left
      expect(service.getOptimalPortTowardPoint(node, { x: 50, y: 250 })).toBe('Box_left');
      // Punto derecha -> _right
      expect(service.getOptimalPortTowardPoint(node, { x: 550, y: 250 })).toBe('Box_right');
    });
  });
});
