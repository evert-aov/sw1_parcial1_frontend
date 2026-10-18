import { describe, expect, it } from 'vitest';
import { DiagramAstNormalizerService, RawServerNode } from './diagram-ast-normalizer.service';

describe('DiagramAstNormalizerService', () => {
  const service = new DiagramAstNormalizerService();

  describe('resolveNodeType', () => {
    it('respeta un tipo declarado distinto de class', () => {
      expect(service.resolveNodeType('actor_1', 'component')).toBe('component');
    });

    it('infiere el tipo por prefijo de ID cuando el tipo es class o falta', () => {
      expect(service.resolveNodeType('actor_9', 'class')).toBe('actor');
      expect(service.resolveNodeType('use_case_2', undefined)).toBe('use_case');
      expect(service.resolveNodeType('boundary_box_1', 'class')).toBe('boundary_box');
      expect(service.resolveNodeType('boundary_3', 'class')).toBe('boundary');
      expect(service.resolveNodeType('exec_env_1', 'class')).toBe('executionEnvironment');
      expect(service.resolveNodeType('exec_7', 'class')).toBe('executionEnvironment');
    });

    it('usa el contexto de diagrama como último recurso', () => {
      expect(service.resolveNodeType('x', 'class', { isSequence: true })).toBe('lifeline');
      expect(service.resolveNodeType('x', undefined, { isPackageDiagram: true })).toBe('package');
      expect(service.resolveNodeType('x', undefined)).toBe('class');
    });
  });

  describe('identificadores de conector', () => {
    it('extrae el nodo base sin sufijos de lado ni de ranura', () => {
      expect(service.extractBaseNodeId('node_1_right')).toBe('node_1');
      expect(service.extractBaseNodeId('node_1_slot_3')).toBe('node_1_slot_3');
      expect(service.extractBaseNodeId('node_1_slot_3', { stripSlot: true })).toBe('node_1');
      expect(service.extractBaseNodeId(undefined)).toBe('');
    });

    it('prioriza los IDs explícitos de la conexión', () => {
      expect(
        service.resolveConnectionNodeIds({
          sourceNodeId: 'a',
          targetNodeId: undefined,
          sourceId: 'zzz_left',
          targetId: 'b_top',
        }),
      ).toEqual({ sourceNodeId: 'a', targetNodeId: 'b' });
    });
  });

  it('resuelve posiciones planas o anidadas', () => {
    expect(service.resolveNodePosition({ position: { x: 1, y: 2 } }, { x: 9, y: 9 })).toEqual({ x: 1, y: 2 });
    expect(service.resolveNodePosition({ positionX: 5, positionY: 6 }, { x: 9, y: 9 })).toEqual({ x: 5, y: 6 });
    expect(service.resolveNodePosition({}, { x: 9, y: 8 })).toEqual({ x: 9, y: 8 });
  });

  describe('normalizeNodes', () => {
    const raw = (partial: Partial<RawServerNode> & { id: string }): RawServerNode => ({
      name: 'N',
      positionX: 10,
      positionY: 20,
      ...partial,
    });

    it('aplica tamaños por defecto y marca tamaño explícito en componentes', () => {
      const [node] = service.normalizeNodes([raw({ id: 'component_1', nodeType: 'class' })]);
      expect(node.nodeType).toBe('component');
      expect(node.width).toBe(190);
      expect(node.height).toBe(70);
      expect(node.isCustomSize).toBe(true);
      expect(node.position).toEqual({ x: 10, y: 20 });
    });

    it('fuerza lifeline con altura 60 en diagramas de secuencia', () => {
      const [node] = service.normalizeNodes([raw({ id: 'n1', height: 300 })], { diagramType: 'sequence' });
      expect(node.nodeType).toBe('lifeline');
      expect(node.height).toBe(60);
      expect(node.width).toBe(140);
    });

    it('renombra boundary_box vacío a "." y delega color y tipos en los callbacks', () => {
      const [box] = service.normalizeNodes([raw({ id: 'boundary_box_1', name: '  ', nodeType: 'boundary_box' })], {
        getDefaultColor: () => '#ABCDEF',
      });
      expect(box.name).toBe('.');
      expect(box.color).toBe('#ABCDEF');

      const [cls] = service.normalizeNodes(
        [raw({ id: 'c1', attributes: [{ name: 'id', type: 'uuid' }], methods: [{ name: 'm', parameters: '', returnType: 'x' }] })],
        { normalizeDataType: () => 'UUID', normalizeReturnType: () => 'void' },
      );
      expect(cls.attributes[0]).toMatchObject({ type: 'UUID', nullable: true, unique: false, length: 255 });
      expect(cls.methods[0].returnType).toBe('void');
    });
  });

  it('normalizeConnections limpia multiplicidades en diagramas de secuencia', () => {
    const conn = {
      id: 'c',
      sourceNodeId: 'a',
      targetNodeId: 'b',
      sourceId: 'a_right',
      targetId: 'b_left',
      type: 'association',
      sourceMultiplicity: '1',
      targetMultiplicity: '*',
    };
    expect(service.normalizeConnections([conn], true)[0]).toMatchObject({
      sourceMultiplicity: '',
      targetMultiplicity: '',
      lineStyle: 'segment',
    });
    expect(service.normalizeConnections([conn], false)[0]).toMatchObject({
      sourceMultiplicity: '1',
      targetMultiplicity: '*',
    });
  });
});
