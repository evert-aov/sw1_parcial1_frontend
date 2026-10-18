import Konva from 'konva';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { UmlNode, UmlNodeType } from '../models/uml.model';
import { getNodeZWeight, isContainerNode } from '../node-classification.util';
import {
  hasNodeRenderer,
  NODE_RENDERER_REGISTRY,
  resolveNodeRenderer,
} from './node-renderer.registry';

const makeNode = (type: UmlNodeType): UmlNode => ({
  id: `${type}_1`,
  type,
  name: 'Demo',
  x: 0,
  y: 0,
  width: 200,
  height: 120,
});

/** Contexto 2D simulado: jsdom no implementa canvas y Konva.Text necesita medir texto. */
function createFakeContext(): CanvasRenderingContext2D {
  const state: Record<string, unknown> = {};
  return new Proxy(state, {
    get: (target, prop: string) => {
      if (prop === 'measureText') return (text: string) => ({ width: text.length * 7 });
      if (prop === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (prop in target) return target[prop];
      return () => undefined;
    },
    set: (target, prop: string, value) => {
      target[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

describe('NODE_RENDERER_REGISTRY', () => {
  const types = Object.keys(NODE_RENDERER_REGISTRY) as UmlNodeType[];
  const originalGetContext = HTMLCanvasElement.prototype.getContext;

  beforeAll(() => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() =>
      createFakeContext(),
    ) as unknown as typeof originalGetContext;
  });

  afterAll(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it('registra un renderer para cada tipo de nodo UML', () => {
    expect(types.length).toBeGreaterThanOrEqual(17);
    for (const type of types) expect(hasNodeRenderer(type)).toBe(true);
  });

  it('usa el renderer de clase para tipos desconocidos', () => {
    expect(resolveNodeRenderer('inexistente')).toBe(NODE_RENDERER_REGISTRY.class);
    expect(hasNodeRenderer('inexistente')).toBe(false);
  });

  it.each(types)('crea y redimensiona "%s" sin recrear el subárbol', (type) => {
    const renderer = resolveNodeRenderer(type);
    const node = makeNode(type);
    const group = renderer.create(node, false);
    expect(group).toBeInstanceOf(Konva.Group);

    const before = new Set(group.getChildren().map((c) => c._id));
    renderer.resize(group, node, 260, 150, true);
    const after = group.getChildren().map((c) => c._id);

    expect(group.width()).toBeGreaterThanOrEqual(1);
    // Todos los hijos previos siguen vivos: no se destruyó ni recreó el subárbol.
    for (const id of before) expect(after).toContain(id);
  });
});

describe('node-classification.util', () => {
  it('identifica contenedores por tipo o por prefijo de ID', () => {
    expect(isContainerNode({ ...makeNode('package') })).toBe(true);
    expect(
      isContainerNode({
        id: 'bbox_1',
        name: 'x',
        position: { x: 0, y: 0 },
        width: 1,
        attributes: [],
        methods: [],
      }),
    ).toBe(true);
    expect(isContainerNode(makeNode('actor'))).toBe(false);
    expect(isContainerNode(null)).toBe(false);
  });

  it('calcula el peso Z: fondo < paquete < despliegue < normal < componente', () => {
    const base = { name: 'x', position: { x: 0, y: 0 }, width: 1, attributes: [], methods: [] };
    expect(getNodeZWeight({ ...base, id: 'a', nodeType: 'boundary_box' })).toBe(0);
    expect(getNodeZWeight({ ...base, id: 'a', nodeType: 'package' })).toBe(1);
    expect(getNodeZWeight({ ...base, id: 'a', nodeType: 'device' })).toBe(2);
    expect(getNodeZWeight({ ...base, id: 'a', nodeType: 'class' })).toBe(10);
    expect(getNodeZWeight({ ...base, id: 'a', nodeType: 'component' })).toBe(100);
  });
});
