import { signal } from '@angular/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { DiagramEditorComponent } from './diagram-editor.component';
import { DiagramCanvasComponent } from './components/diagram-canvas/diagram-canvas.component';
import { DiagramType, UmlClassNode, UmlConnection } from '../../../core/models/diagram.model';

const nodes: UmlClassNode[] = [
  { id: 'actor', name: 'Ingeniero Anfitrión', nodeType: 'actor', position: { x: 50, y: 50 }, width: 65, attributes: [], methods: [] },
  { id: 'ui', name: 'UI: ProjectView', nodeType: 'lifeline', position: { x: 250, y: 50 }, width: 110, attributes: [], methods: [] },
  { id: 'controller', name: 'ProjectController', nodeType: 'lifeline', position: { x: 450, y: 50 }, width: 110, attributes: [], methods: [] },
];

function connection(id: string, slot: number, source = 'ui', target = 'controller', type: UmlConnection['type'] = 'sync', sequenceNumber = ''): UmlConnection {
  return {
    id, sourceNodeId: source, targetNodeId: target,
    sourceId: `${source}_slot_${slot}`, targetId: `${target}_slot_${slot}`,
    type, lineStyle: 'straight', messages: [{
      id: `msg_${id}`, sequenceNumber, functionName: 'call', parameters: 'id, data',
      type: type === 'reply' ? 'reply' : 'sync', isReturn: type === 'reply', direction: 'forward',
      orderIndex: 0, positionY: 200 + slot * 35,
    }],
  };
}

describe('DiagramEditorComponent: estado de mensajes de secuencia', () => {
  let editor: DiagramEditorComponent;
  const recalculate = (conns: UmlConnection[], preserve = false): UmlConnection[] =>
    (editor as any).recalculateSequenceNumbers(conns, preserve);
  const sanitize = (conns: UmlConnection[]): UmlConnection[] =>
    (editor as any).sanitizeClientConnections(conns, nodes);

  beforeEach(() => {
    // Solo lógica de estado: no plantilla, inyección, sockets, HTTP ni lifecycle.
    editor = Object.assign(Object.create(DiagramEditorComponent.prototype), {
      nodes: signal(structuredClone(nodes)), connections: signal<UmlConnection[]>([]),
      activeDiagramType: signal(DiagramType.SEQUENCE), defaultLineStyle: signal('straight'),
    });
  });

  it('usa RGB(221, 244, 245) como color predeterminado de las líneas de vida', () => {
    expect(editor.getDefaultColorForNodeType('lifeline')).toBe('#DDF4F5');
    expect(editor.getDefaultColorForNodeType('actor')).toBe('#FEF2DD');
  });

  it('mantiene altura fija 60 en editor, lienzo y payload, con ancho adaptable al nombre', () => {
    const canvas = Object.create(DiagramCanvasComponent.prototype) as DiagramCanvasComponent;
    const short: UmlClassNode = { ...nodes[1], name: 'UI', height: 48, customHeight: 200, isCustomSize: true, width: 130 };
    const long: UmlClassNode = { ...short, id: 'long', name: 'ServicioDeGestionDeProyectosYParticipantes' };
    for (const component of [editor, canvas]) {
      expect(component.getNodeHeight(short)).toBe(60);
      expect(component.getNodeHeight(long)).toBe(60);
      expect(component.getNodeWidth(long)).toBeGreaterThan(component.getNodeWidth(short));
    }
    editor.nodes.set([short, long]);
    const payload = editor.buildSaveAstPayload();
    expect(payload.nodes.map((node) => node.height)).toEqual([60, 60]);
    expect(payload.nodes[1].width).toBeGreaterThan(payload.nodes[0].width!);
  });

  it('preserva orderIndex y positionY, incluidos ceros, sin invertir retornos dirigidos', () => {
    expect(editor.normalizeUmlMessage({
      id: 'reply', sequenceNumber: '1.2', functionName: 'get(id)',
      type: 'reply', isReturn: true, direction: 'forward', orderIndex: 0, positionY: 0,
    })).toMatchObject({
      sequenceNumber: '1.2', functionName: 'get', parameters: 'id',
      type: 'reply', isReturn: true, direction: 'forward', orderIndex: 0, positionY: 0,
    });
    expect(editor.normalizeUmlMessage({ functionName: 'call', orderIndex: 13, positionY: 655 }))
      .toMatchObject({ orderIndex: 13, positionY: 655 });
    const invalid = editor.normalizeUmlMessage({ orderIndex: NaN, positionY: Infinity });
    expect(invalid.orderIndex).toBeUndefined();
    expect(invalid.positionY).toBeUndefined();
  });

  it('separa dirección de tipo sin romper retornos legacy en enlaces de comunicación', () => {
    expect(editor.normalizeUmlMessage({ functionName: 'result', type: 'reply' }))
      .toMatchObject({ direction: 'reverse', type: 'reply', isReturn: true });
    expect(editor.normalizeUmlMessage({ functionName: 'call', type: 'async', direction: 'reverse' }))
      .toMatchObject({ direction: 'reverse', type: 'async', isReturn: false });
  });

  it('recalcula grupos existentes por actor y asigna índices globales según slots, no el array', () => {
    const conns = [
      connection('last', 3, 'actor', 'ui'), connection('reply', 2, 'ui', 'actor', 'reply'),
      connection('child', 1), connection('start', 0, 'actor', 'ui'),
    ];
    const result = recalculate(conns);
    expect(result.map((c) => c.id)).toEqual(conns.map((c) => c.id));
    expect(result.map((c) => c.messages![0].sequenceNumber)).toEqual(['2', '1.2', '1.1', '1']);
    expect(result.map((c) => c.messages![0].orderIndex)).toEqual([3, 2, 1, 0]);
    expect(result[1].messages![0]).toMatchObject({ direction: 'forward', type: 'reply', isReturn: true, positionY: 270 });
    expect(conns[0].messages![0].sequenceNumber).toBe('');
  });

  it('conserva numeración importada plana o jerárquica al cargar y guardar', () => {
    const conns = [
      connection('first', 0, 'actor', 'ui', 'sync', '1'),
      connection('second', 1, 'ui', 'controller', 'sync', '2'),
      connection('third', 2, 'controller', 'ui', 'reply', '7.3.2'),
    ];
    const result = recalculate(conns, true);
    expect(result.map((c) => c.messages![0].sequenceNumber)).toEqual(['1', '2', '7.3.2']);
    expect(result.map((c) => c.messages![0].orderIndex)).toEqual([0, 1, 2]);
    editor.connections.set(result);
    const payload = editor.buildSaveAstPayload();
    expect(payload.connections.map((c) => c.messages![0].sequenceNumber)).toEqual(['1', '2', '7.3.2']);
    expect(payload.connections.map((c) => c.messages![0].orderIndex)).toEqual([0, 1, 2]);
    expect(payload.connections[2].messages![0]).toMatchObject({ direction: 'forward', isReturn: true, type: 'reply', positionY: 270 });
  });

  it('rellena índices globales al guardar conexiones cuyo metadata falta o está todo en cero', () => {
    const first = connection('first', 0, 'actor', 'ui', 'sync', '1');
    const second = connection('second', 4, 'ui', 'controller', 'sync', '2');
    delete second.messages![0].orderIndex;
    editor.connections.set([second, first]);
    expect(editor.buildSaveAstPayload().connections.map((c) => c.messages![0].orderIndex)).toEqual([1, 0]);
  });

  it('crea mensajes ausentes con tipo/dirección correctos e índice global', () => {
    const conns = [connection('start', 0, 'actor', 'ui'), connection('reply', 1, 'ui', 'actor', 'reply')];
    conns[1].messages = [];
    expect(recalculate(conns)[1].messages![0]).toMatchObject({ orderIndex: 1, type: 'reply', isReturn: true, direction: 'forward', sequenceNumber: '1.1' });
  });

  it('completa el tipo del mensaje desde su conector antes de guardarlo', () => {
    const conns = [connection('async', 0, 'actor', 'ui', 'async'), connection('create', 1, 'ui', 'controller', 'create')];
    for (const c of conns) delete c.messages![0].type;
    editor.connections.set(recalculate(conns));
    expect(editor.buildSaveAstPayload().connections.map((c) => c.messages![0].type)).toEqual(['async', 'create']);
  });

  it('usa orderIndex como fallback sin slots y no renumera diagramas de comunicación', () => {
    const conns = [connection('later', 0), connection('first', 0, 'actor', 'ui')];
    for (const c of conns) { c.sourceId = c.sourceNodeId!; c.targetId = c.targetNodeId!; }
    conns[0].messages![0].orderIndex = 5;
    conns[1].messages![0].orderIndex = 0;
    expect(recalculate(conns).map((c) => c.messages![0].orderIndex)).toEqual([1, 0]);
    editor.activeDiagramType.set(DiagramType.COMMUNICATION);
    expect(recalculate(conns)).toBe(conns);
  });

  it('sanitiza mensajes importados sin perder etiquetas, metadata ni dirección de replies', () => {
    const conns = [
      connection('reply', 2, 'ui', 'actor', 'reply', '1.2'),
      connection('start', 0, 'actor', 'ui', 'sync', '1'),
      connection('child', 1, 'ui', 'controller', 'sync', '1.1'),
    ];
    const result = sanitize(conns);
    expect(result.map((c) => c.id)).toEqual(['start', 'child', 'reply']);
    expect(result.map((c) => c.messages![0].orderIndex)).toEqual([0, 1, 2]);
    expect(result.map((c) => c.messages![0].sequenceNumber)).toEqual(['1', '1.1', '1.2']);
    expect(result[2]).toMatchObject({ sourceNodeId: 'ui', targetNodeId: 'actor', type: 'reply' });
    expect(result[2].messages![0]).toMatchObject({ direction: 'forward', positionY: 270, isReturn: true });
  });

  it('desempaca retornos legacy una sola vez y mantiene índices globales', () => {
    const c = connection('grouped', 0, 'actor', 'ui', 'sync', '1');
    c.messages!.push({ id: 'reply', sequenceNumber: '1.1', functionName: 'result', type: 'reply', direction: 'reverse', isReturn: true });
    const result = sanitize([c]);
    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({ sourceNodeId: 'ui', targetNodeId: 'actor', type: 'reply' });
    expect(result[1].messages![0]).toMatchObject({ direction: 'forward', orderIndex: 1 });
    expect(sanitize(result).map((conn) => [conn.sourceNodeId, conn.targetNodeId]))
      .toEqual([['actor', 'ui'], ['ui', 'actor']]);
  });
});
