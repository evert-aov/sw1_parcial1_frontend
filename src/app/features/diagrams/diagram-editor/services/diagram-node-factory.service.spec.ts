import { describe, expect, it } from 'vitest';
import { DiagramType, UmlClassNode, UmlStereotype } from '../../../../core/models/diagram.model';
import { DiagramNodeFactoryService } from './diagram-node-factory.service';

describe('DiagramNodeFactoryService: createNode unificado', () => {
  const factory = new DiagramNodeFactoryService();
  const at = { x: 400, y: 300 };

  it('crea una clase centrada en la posición con prefijo por estereotipo', () => {
    const node = factory.createNode('class', [], {
      currentType: DiagramType.CLASS_ANALYSIS,
      position: at,
      stereotype: UmlStereotype.UI,
    });
    expect(node).toMatchObject({
      nodeType: 'class',
      name: 'UI_1',
      width: 220,
      height: 120,
      stereotype: 'UI',
      position: { x: 290, y: 240 },
    });
  });

  it('descarta el estereotipo en diagramas de clase puros', () => {
    const node = factory.createClassNode([], DiagramType.CLASS, at, UmlStereotype.UI);
    expect(node.stereotype).toBeNull();
  });

  it('numera nombres según los nodos existentes del mismo tipo', () => {
    const existing = [factory.createNode('use_case', [], { position: at })];
    const next = factory.createNode('use_case', existing, { position: at });
    expect(next.name).toBe('CasoDeUso_2');
    expect(next.color).toBe('#E5F2FE');
  });

  it('los métodos legados delegan en createNode con el mismo resultado', () => {
    const legacy = factory.createComponentNode([], at);
    const unified = factory.createNode('component', [], { position: at });
    expect({ ...legacy, id: '' }).toEqual({ ...unified, id: '' });
    expect(legacy).toMatchObject({ width: 190, height: 70, isCustomSize: true, stereotype: 'file' });
  });

  it('coloca actores y lifelines en la fila superior de un diagrama de secuencia', () => {
    const first = factory.createLifelineNode([], DiagramType.SEQUENCE);
    expect(first.position).toMatchObject({ x: 80, y: 50 });
    expect(first.name).toBe('lifeline_1');

    const placed: UmlClassNode[] = [{ ...first, position: { x: 80, y: 50 }, width: 160 }];
    const actor = factory.createActorNode(placed, DiagramType.SEQUENCE);
    expect(actor.position).toMatchObject({ x: 300, y: 50 });
    expect(actor.name).toBe('actor_1');
  });

  it('ajusta el tamaño de boundary_box según el tipo de diagrama', () => {
    expect(factory.createBoundaryBoxNode(DiagramType.LAYERED, at)).toMatchObject({ width: 420, height: 220, name: 'Capa' });
    expect(factory.createBoundaryBoxNode(DiagramType.USE_CASE, at)).toMatchObject({ width: 280, height: 200, name: '.' });
  });

  it('crea nodos de actividad con tamaños y nombres propios', () => {
    expect(factory.createActivityNode('activity_fork', [], at)).toMatchObject({ width: 220, height: 14, name: 'Fork/Join' });
    const action = factory.createActivityNode('activity_action', [], at);
    expect(action).toMatchObject({ width: 155, height: 62, name: 'Acción_1', nodeType: 'activity_action' });
  });

  it('lanza un error claro para tipos no soportados', () => {
    expect(() => factory.createNode('desconocido', [])).toThrow(/no soportado/);
  });
});
