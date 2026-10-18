import { Injectable } from '@angular/core';
import { DiagramType, UmlClassNode, UmlStereotype } from '../../../../core/models/diagram.model';

export interface ScrollOffset {
  scrollLeft: number;
  scrollTop: number;
}

/** Tipos de nodo que la fábrica sabe construir con un blueprint estático. */
export type FactoryNodeType =
  | 'class'
  | 'component'
  | 'device'
  | 'executionEnvironment'
  | 'boundary_box'
  | 'actor'
  | 'use_case'
  | 'package'
  | 'boundary'
  | 'control'
  | 'entity'
  | 'lifeline'
  | 'note'
  | 'package_layer';

export type ActivityNodeType =
  'activity_initial' | 'activity_final' | 'activity_action' | 'activity_decision' | 'activity_fork';

/** Opciones comunes de creación de un nodo. */
export interface CreateNodeOptions {
  /** Tipo de diagrama activo (afecta nombres, tamaños y colocación). */
  currentType?: DiagramType;
  /** Posición solicitada (punto central del drop); si falta se coloca cerca del scroll actual. */
  position?: { x: number; y: number };
  /** Estereotipo inicial (solo relevante para nodos de clase). */
  stereotype?: UmlStereotype | string | null;
  /** Desplazamiento de scroll del lienzo, usado al colocar sin posición explícita. */
  scroll?: ScrollOffset;
}

interface NodeBuildContext {
  nodes: UmlClassNode[];
  currentType: DiagramType;
  stereotype?: UmlStereotype | string | null;
}

interface NodeSize {
  width: number;
  height?: number;
}

/**
 * Descripción declarativa de cómo se crea un tipo de nodo.
 * Añadir un nuevo tipo consiste en registrar un blueprint en `NODE_BLUEPRINTS`.
 */
interface NodeBlueprint {
  idPrefix: string;
  nodeType: string;
  size: (ctx: NodeBuildContext) => NodeSize;
  /** Desplazamiento desde el punto de drop hasta la esquina superior izquierda del nodo. */
  offset: (ctx: NodeBuildContext, size: NodeSize) => { x: number; y: number };
  name: (count: number, ctx: NodeBuildContext) => string;
  /** Cuenta de nodos existentes usada para numerar el nombre (por defecto, mismo `nodeType`). */
  count?: (ctx: NodeBuildContext) => number;
  /** Campos propios del tipo (color, estereotipo, tamaño custom, activaciones...). */
  extra: (ctx: NodeBuildContext, size: NodeSize, count: number) => Partial<UmlClassNode>;
  /** En diagramas de secuencia, el nodo se alinea en la fila superior tras el último participante. */
  sequenceRow?: { fallbackWidth: number };
}

const customSize = (size: NodeSize): Partial<UmlClassNode> => ({
  customWidth: size.width,
  customHeight: size.height,
  isCustomSize: true,
});

const fixedSize = (width: number, height?: number) => (): NodeSize => ({ width, height });
const fixedOffset = (x: number, y: number) => () => ({ x, y });
const centeredOffset = (_ctx: NodeBuildContext, size: NodeSize) => ({
  x: size.width / 2,
  y: (size.height ?? 0) / 2,
});
const countByType =
  (nodeType: string) =>
  (ctx: NodeBuildContext): number =>
    ctx.nodes.filter((n) => n.nodeType === nodeType).length + 1;

function resolveClassNamePrefix(ctx: NodeBuildContext): string {
  const { stereotype, currentType } = ctx;
  if (stereotype === UmlStereotype.UI || stereotype === 'UI') return 'UI_';
  if (stereotype === UmlStereotype.CONTROLLER_DOT || stereotype === 'Controller.')
    return 'Controller_';
  if (stereotype === UmlStereotype.ENTITY_DOT || stereotype === 'Entity.') return 'Entity_';
  if (currentType === DiagramType.CLASS_ANALYSIS) return 'Clase_';
  return 'Tabla_';
}

function resolveClassStereotype(ctx: NodeBuildContext): UmlStereotype | string | null {
  const initial = (ctx.stereotype as UmlStereotype) || null;
  if (ctx.currentType === DiagramType.CLASS) return null;
  if (initial && (initial as string).toLowerCase() === 'class') return null;
  return initial;
}

function boundaryBoxSize(ctx: NodeBuildContext): NodeSize {
  const large =
    ctx.currentType === DiagramType.LAYERED || ctx.currentType === DiagramType.COMPONENT;
  return large ? { width: 420, height: 220 } : { width: 280, height: 200 };
}

function boundaryBoxName(ctx: NodeBuildContext): string {
  if (ctx.currentType === DiagramType.LAYERED) return 'Capa';
  if (ctx.currentType === DiagramType.COMPONENT) return 'Agrupación';
  return '.';
}

/** Nodos "BCE" (boundary / control / entity): mismo tamaño y color, cambia el estereotipo. */
function bceBlueprint(
  nodeType: 'boundary' | 'control' | 'entity',
  namePrefix: string,
  stereotype: UmlStereotype,
): NodeBlueprint {
  return {
    idPrefix: nodeType,
    nodeType,
    size: fixedSize(70, 70),
    offset: fixedOffset(35, 35),
    name: (count) => `${namePrefix}_${count}`,
    count: countByType(nodeType),
    extra: () => ({ stereotype, color: '#DDF4F5', attributes: [], methods: [] }),
  };
}

const NODE_BLUEPRINTS: Record<FactoryNodeType, NodeBlueprint> = {
  class: {
    idPrefix: 'class',
    nodeType: 'class',
    size: (ctx) => ({ width: 220, height: ctx.stereotype ? 120 : undefined }),
    offset: (_ctx, size) => ({ x: size.width / 2, y: size.height ? size.height / 2 : 40 }),
    name: (count, ctx) => `${resolveClassNamePrefix(ctx)}${count}`,
    count: (ctx) => ctx.nodes.filter((n) => !n.isAnchor).length + 1,
    extra: (ctx) => ({
      color: '#FDFAF3',
      attributes: [],
      methods: [],
      stereotype: resolveClassStereotype(ctx),
    }),
  },
  component: {
    idPrefix: 'component',
    nodeType: 'component',
    size: fixedSize(190, 70),
    offset: fixedOffset(95, 35),
    name: (count) => `Component_${count}`,
    count: countByType('component'),
    extra: (_ctx, size) => ({ stereotype: 'file', ...customSize(size), color: '#FAF1EC' }),
  },
  device: {
    idPrefix: 'device',
    nodeType: 'device',
    size: fixedSize(230, 140),
    offset: fixedOffset(115, 70),
    name: (count) => `Dispositivo_${count}`,
    count: countByType('device'),
    extra: (_ctx, size) => ({ stereotype: 'device', ...customSize(size), color: '#F3FAF7' }),
  },
  executionEnvironment: {
    idPrefix: 'exec_env',
    nodeType: 'executionEnvironment',
    size: fixedSize(240, 160),
    offset: fixedOffset(120, 80),
    name: (count) => `Servidor_${count}`,
    count: countByType('executionEnvironment'),
    extra: (_ctx, size) => ({
      stereotype: 'executionEnvironment',
      ...customSize(size),
      color: '#CDE5F5',
    }),
  },
  boundary_box: {
    idPrefix: 'boundary_box',
    nodeType: 'boundary_box',
    size: boundaryBoxSize,
    offset: centeredOffset,
    name: (_count, ctx) => boundaryBoxName(ctx),
    extra: (_ctx, size) => ({ stereotype: null, ...customSize(size), color: '#FAF1EC' }),
  },
  actor: {
    idPrefix: 'actor',
    nodeType: 'actor',
    size: fixedSize(65, 95),
    offset: fixedOffset(32, 47),
    name: (count, ctx) =>
      ctx.currentType === DiagramType.SEQUENCE ? `actor_${count}` : `Actor_${count}`,
    count: countByType('actor'),
    extra: () => ({ color: '#FEF2DD', attributes: [], methods: [], activations: [] }),
    sequenceRow: { fallbackWidth: 120 },
  },
  use_case: {
    idPrefix: 'use_case',
    nodeType: 'use_case',
    size: fixedSize(140, 60),
    offset: fixedOffset(70, 30),
    name: (count) => `CasoDeUso_${count}`,
    count: countByType('use_case'),
    extra: () => ({ color: '#E5F2FE' }),
  },
  package: {
    idPrefix: 'package',
    nodeType: 'package',
    size: fixedSize(200, 120),
    offset: fixedOffset(100, 60),
    name: (count) => `Paquete_${count}`,
    count: countByType('package'),
    extra: (_ctx, _size, count) => ({
      color: '#FAF1EC',
      attributes: [{ name: `Contenido Paquete ${count}`, type: 'package' }],
    }),
  },
  boundary: bceBlueprint('boundary', 'Boundary', UmlStereotype.BOUNDARY),
  control: bceBlueprint('control', 'Control', UmlStereotype.CONTROL),
  entity: bceBlueprint('entity', 'Entity', UmlStereotype.ENTITY),
  lifeline: {
    idPrefix: 'lifeline',
    nodeType: 'lifeline',
    size: fixedSize(160, 60),
    offset: fixedOffset(80, 24),
    name: (count, ctx) =>
      ctx.currentType === DiagramType.SEQUENCE ? `lifeline_${count}` : `Objeto_${count}`,
    count: countByType('lifeline'),
    extra: () => ({ color: '#DDF4F5', attributes: [], methods: [], activations: [] }),
    sequenceRow: { fallbackWidth: 140 },
  },
  note: {
    idPrefix: 'note',
    nodeType: 'note',
    size: fixedSize(185, 76),
    offset: fixedOffset(90, 38),
    name: (count) => `Nota descriptiva ${count}...`,
    count: countByType('note'),
    extra: (_ctx, size) => ({ stereotype: 'note', ...customSize(size), color: '#FEF9C3' }),
  },
  package_layer: {
    idPrefix: 'layer',
    nodeType: 'package_layer',
    size: fixedSize(420, 200),
    offset: fixedOffset(210, 100),
    name: (count) => `Capa Arquitectónica ${count}`,
    count: countByType('package_layer'),
    extra: (_ctx, size) => ({ ...customSize(size), color: 'rgba(248, 250, 252, 0.65)' }),
  },
};

/** Tamaño y nombre base de cada subtipo de actividad. */
const ACTIVITY_DEFAULTS: Record<ActivityNodeType, { width: number; height: number; name: string }> =
  {
    activity_initial: { width: 44, height: 48, name: 'Initial' },
    activity_final: { width: 44, height: 48, name: 'Final' },
    activity_action: { width: 155, height: 62, name: 'Acción' },
    activity_decision: { width: 65, height: 65, name: 'Decision' },
    activity_fork: { width: 220, height: 14, name: 'Fork/Join' },
  };

function activityBlueprint(subType: string): NodeBlueprint {
  const defaults =
    ACTIVITY_DEFAULTS[subType as ActivityNodeType] ?? ACTIVITY_DEFAULTS.activity_action;
  return {
    idPrefix: subType,
    nodeType: subType,
    size: fixedSize(defaults.width, defaults.height),
    offset: centeredOffset,
    name: (count) => (subType === 'activity_action' ? `Acción_${count}` : defaults.name),
    count: countByType(subType),
    extra: (_ctx, size) => ({ ...customSize(size), attributes: [], methods: [] }),
  };
}

@Injectable({
  providedIn: 'root',
})
export class DiagramNodeFactoryService {
  private calcPos(
    position: { x: number; y: number } | undefined,
    offsetX: number,
    offsetY: number,
    scroll?: ScrollOffset,
  ): { x: number; y: number } {
    const sLeft = scroll?.scrollLeft || 0;
    const sTop = scroll?.scrollTop || 0;
    const posX = position
      ? Math.max(20, Math.round(position.x - offsetX))
      : Math.max(50, Math.round(sLeft + 120 + Math.random() * 60));
    const posY = position
      ? Math.max(20, Math.round(position.y - offsetY))
      : Math.max(50, Math.round(sTop + 80 + Math.random() * 60));
    return { x: posX, y: posY };
  }

  /**
   * Crea un nodo de cualquier tipo soportado a partir de su blueprint declarativo.
   *
   * @param type Tipo de nodo (`FactoryNodeType` o subtipo `activity_*`).
   * @param nodes Nodos actuales del diagrama (para numerar nombres y alinear en secuencia).
   * @param options Posición, tipo de diagrama, estereotipo y scroll.
   * @returns Nodo canónico listo para insertarse en el diagrama.
   */
  createNode(
    type: FactoryNodeType | ActivityNodeType | string,
    nodes: UmlClassNode[],
    options: CreateNodeOptions = {},
  ): UmlClassNode {
    const blueprint = this.resolveBlueprint(type);
    const ctx: NodeBuildContext = {
      nodes,
      currentType: options.currentType ?? DiagramType.CLASS,
      stereotype: options.stereotype,
    };

    const size = blueprint.size(ctx);
    const offset = blueprint.offset(ctx, size);
    const position = this.calcPos(options.position, offset.x, offset.y, options.scroll);

    if (blueprint.sequenceRow && ctx.currentType === DiagramType.SEQUENCE) {
      position.y = 50;
      if (!options.position) {
        position.x = this.nextSequenceColumnX(nodes, blueprint.sequenceRow.fallbackWidth);
      }
    }

    const count = blueprint.count ? blueprint.count(ctx) : 0;
    const node: UmlClassNode = {
      id: `${blueprint.idPrefix}_${Date.now()}`,
      name: blueprint.name(count, ctx),
      nodeType: blueprint.nodeType,
      position,
      width: size.width,
      height: size.height,
      attributes: [],
      methods: [],
      ...blueprint.extra(ctx, size, count),
    };
    return node;
  }

  private resolveBlueprint(type: string): NodeBlueprint {
    if (type.startsWith('activity_')) return activityBlueprint(type);
    const blueprint = (NODE_BLUEPRINTS as Record<string, NodeBlueprint | undefined>)[type];
    if (!blueprint) {
      throw new Error(`DiagramNodeFactoryService: tipo de nodo no soportado "${type}"`);
    }
    return blueprint;
  }

  /** Calcula la X del siguiente participante (lifeline/actor) en la fila superior de un diagrama de secuencia. */
  private nextSequenceColumnX(nodes: UmlClassNode[], fallbackWidth: number): number {
    const topNodes = nodes.filter(
      (n) => (n.nodeType === 'lifeline' || n.nodeType === 'actor') && !n.isAnchor,
    );
    if (topNodes.length === 0) return 80;
    const maxRight = Math.max(
      ...topNodes.map((n) => (n.position?.x || 0) + (n.width || fallbackWidth)),
    );
    return maxRight + 60;
  }

  createClassNode(
    nodes: UmlClassNode[],
    currentType: DiagramType,
    position?: { x: number; y: number },
    stereotype?: UmlStereotype | string | null,
    scroll?: ScrollOffset,
  ): UmlClassNode {
    return this.createNode('class', nodes, { currentType, position, stereotype, scroll });
  }

  createComponentNode(
    nodes: UmlClassNode[],
    position?: { x: number; y: number },
    scroll?: ScrollOffset,
  ): UmlClassNode {
    return this.createNode('component', nodes, { position, scroll });
  }

  createDeviceNode(
    nodes: UmlClassNode[],
    position?: { x: number; y: number },
    scroll?: ScrollOffset,
  ): UmlClassNode {
    return this.createNode('device', nodes, { position, scroll });
  }

  createExecutionEnvironmentNode(
    nodes: UmlClassNode[],
    position?: { x: number; y: number },
    scroll?: ScrollOffset,
  ): UmlClassNode {
    return this.createNode('executionEnvironment', nodes, { position, scroll });
  }

  createBoundaryBoxNode(
    currentType: DiagramType,
    position?: { x: number; y: number },
    scroll?: ScrollOffset,
  ): UmlClassNode {
    return this.createNode('boundary_box', [], { currentType, position, scroll });
  }

  createActorNode(
    nodes: UmlClassNode[],
    currentType: DiagramType,
    position?: { x: number; y: number },
    scroll?: ScrollOffset,
  ): UmlClassNode {
    return this.createNode('actor', nodes, { currentType, position, scroll });
  }

  createUseCaseNode(
    nodes: UmlClassNode[],
    position?: { x: number; y: number },
    scroll?: ScrollOffset,
  ): UmlClassNode {
    return this.createNode('use_case', nodes, { position, scroll });
  }

  createPackageNode(
    nodes: UmlClassNode[],
    position?: { x: number; y: number },
    scroll?: ScrollOffset,
  ): UmlClassNode {
    return this.createNode('package', nodes, { position, scroll });
  }

  createBoundaryNode(
    nodes: UmlClassNode[],
    position?: { x: number; y: number },
    scroll?: ScrollOffset,
  ): UmlClassNode {
    return this.createNode('boundary', nodes, { position, scroll });
  }

  createControlNode(
    nodes: UmlClassNode[],
    position?: { x: number; y: number },
    scroll?: ScrollOffset,
  ): UmlClassNode {
    return this.createNode('control', nodes, { position, scroll });
  }

  createEntityNode(
    nodes: UmlClassNode[],
    position?: { x: number; y: number },
    scroll?: ScrollOffset,
  ): UmlClassNode {
    return this.createNode('entity', nodes, { position, scroll });
  }

  createLifelineNode(
    nodes: UmlClassNode[],
    currentType: DiagramType,
    position?: { x: number; y: number },
    scroll?: ScrollOffset,
  ): UmlClassNode {
    return this.createNode('lifeline', nodes, { currentType, position, scroll });
  }

  createNoteNode(
    nodes: UmlClassNode[],
    position?: { x: number; y: number },
    scroll?: ScrollOffset,
  ): UmlClassNode {
    return this.createNode('note', nodes, { position, scroll });
  }

  createPackageLayerNode(
    nodes: UmlClassNode[],
    position?: { x: number; y: number },
    scroll?: ScrollOffset,
  ): UmlClassNode {
    return this.createNode('package_layer', nodes, { position, scroll });
  }

  createActivityNode(
    subType: ActivityNodeType | string,
    nodes: UmlClassNode[],
    position?: { x: number; y: number },
    scroll?: ScrollOffset,
  ): UmlClassNode {
    return this.createNode(subType, nodes, { position, scroll });
  }
}
