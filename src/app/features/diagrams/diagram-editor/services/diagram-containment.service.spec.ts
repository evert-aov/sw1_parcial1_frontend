import { describe, expect, it } from 'vitest';
import { DiagramType, UmlClassNode } from '../../../../core/models/diagram.model';
import { DiagramContainmentService } from './diagram-containment.service';

const node = (id: string, x: number, y: number, width: number, height: number): UmlClassNode => ({
  id,
  name: id,
  position: { x, y },
  width,
  height,
  attributes: [],
  methods: [],
});

const getW = (n: UmlClassNode) => n.width;
const getH = (n: UmlClassNode) => n.height ?? 60;

describe('DiagramContainmentService: índice de contención', () => {
  const nodes = [
    node('boundary', 0, 0, 800, 600),
    node('package', 50, 50, 400, 300),
    node('leaf', 100, 100, 80, 60),
    node('outside', 1000, 1000, 80, 60),
  ];

  it('construye el índice padre → hijos directos por geometría', () => {
    const service = new DiagramContainmentService();
    const index = service.buildContainmentIndex(nodes, getW, getH);

    expect(index.get('boundary')).toEqual(expect.arrayContaining(['package', 'leaf']));
    expect(index.get('package')).toEqual(['leaf']);
    expect(index.has('outside')).toBe(false);
  });

  it('resuelve descendientes transitivos desde el índice y coincide con el BFS clásico', () => {
    const service = new DiagramContainmentService();
    const index = service.buildContainmentIndex(nodes, getW, getH);

    const fromIndex = service.getDescendantsFromIndex('boundary', index);
    const fromBfs = service.getDescendantNodeIds('boundary', nodes, getW, getH);

    expect([...fromIndex].sort()).toEqual(['leaf', 'package']);
    expect([...fromIndex].sort()).toEqual([...fromBfs].sort());
  });

  it('startDrag cachea el índice y resetDragState lo libera', () => {
    const service = new DiagramContainmentService();
    service.startDrag(['boundary'], nodes, getW, getH);

    expect([...service.currentDragDescendantIds].sort()).toEqual(['leaf', 'package']);
    expect(service.isDraggingNode).toBe(true);

    service.resetDragState();
    expect(service.currentDragDescendantIds.size).toBe(0);
    expect(service.isDraggingNode).toBe(false);
  });

  it('processMoveNodes arrastra descendientes usando el índice del gesto', () => {
    const service = new DiagramContainmentService();
    const local = nodes.map((n) => ({ ...n, position: { ...n.position } }));
    const sent: string[] = [];

    service.processMoveNodes({
      eventNodes: [{ id: 'package', position: { x: 70, y: 50 } }],
      nodes: local,
      activeDiagramType: DiagramType.PACKAGE,
      getNodeWidth: getW,
      getNodeHeight: getH,
      onStartDrag: () => {},
      sendNodeDrag: (id) => sent.push(id),
    });

    expect(local.find((n) => n.id === 'leaf')!.position).toEqual({ x: 120, y: 100 });
    expect(sent).toEqual(expect.arrayContaining(['package', 'leaf']));
  });
});
