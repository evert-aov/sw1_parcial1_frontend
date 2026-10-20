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

describe('computeAdaptiveOrthogonalPath (Enterprise Architect Adaptive Routing)', () => {
  it('genera una línea recta horizontal de 1 segmento cuando los nodos se solapan verticalmente (EA Image 3)', async () => {
    const { computeAdaptiveOrthogonalPath } = await import('./uml-relationship.renderer');
    const pedido: UmlNode = { id: 'pedido', type: 'class', name: 'Pedido', x: 80, y: 100, width: 200, height: 140 };
    const producto: UmlNode = { id: 'producto', type: 'class', name: 'Producto', x: 420, y: 110, width: 200, height: 130 };

    const pts = computeAdaptiveOrthogonalPath(pedido, producto);
    expect(pts.length).toBe(2);
    expect(pts[0].y).toBe(pts[1].y);
    expect(pts[0].x).toBeGreaterThan(pedido.x + pedido.width);
    expect(pts[1].x).toBeLessThan(producto.x);
  });

  it('genera un codo en L de 2 segmentos (salida inferior -> entrada izquierda) cuando el destino está abajo a la derecha (EA Image 2)', async () => {
    const { computeAdaptiveOrthogonalPath } = await import('./uml-relationship.renderer');
    const pedido: UmlNode = { id: 'pedido', type: 'class', name: 'Pedido', x: 60, y: 50, width: 220, height: 150 };
    const producto: UmlNode = { id: 'producto', type: 'class', name: 'Producto', x: 400, y: 240, width: 220, height: 150 };

    const pts = computeAdaptiveOrthogonalPath(pedido, producto);
    expect(pts.length).toBe(3);
    // Segmento 1 vertical hacia abajo desde el borde inferior de Pedido
    expect(pts[0].x).toBe(pts[1].x);
    expect(pts[1].y).toBeGreaterThan(pts[0].y);
    // Segmento 2 horizontal hacia la derecha entrando al borde izquierdo de Producto
    expect(pts[1].y).toBe(pts[2].y);
    expect(pts[2].x).toBeGreaterThan(pts[1].x);
  });

  it('genera un codo en L de 2 segmentos (salida superior -> entrada izquierda) cuando el destino está arriba a la derecha (EA Image 4)', async () => {
    const { computeAdaptiveOrthogonalPath } = await import('./uml-relationship.renderer');
    const pedido: UmlNode = { id: 'pedido', type: 'class', name: 'Pedido', x: 60, y: 240, width: 220, height: 150 };
    const producto: UmlNode = { id: 'producto', type: 'class', name: 'Producto', x: 380, y: 50, width: 220, height: 150 };

    const pts = computeAdaptiveOrthogonalPath(pedido, producto);
    expect(pts.length).toBe(3);
    // Segmento 1 vertical hacia arriba desde el borde superior de Pedido
    expect(pts[0].x).toBe(pts[1].x);
    expect(pts[1].y).toBeLessThan(pts[0].y);
    // Segmento 2 horizontal hacia la derecha entrando al borde izquierdo de Producto
    expect(pts[1].y).toBe(pts[2].y);
    expect(pts[2].x).toBeGreaterThan(pts[1].x);
  });
});
