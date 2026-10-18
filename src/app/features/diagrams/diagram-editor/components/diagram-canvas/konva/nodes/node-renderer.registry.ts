import Konva from 'konva';
import { UmlNode, UmlNodeType } from '../models/uml.model';
import { createClassKonvaNode, resizeClassKonvaNode } from './class.node';
import { createActorKonvaNode, resizeActorKonvaNode } from './actor.node';
import { createUseCaseKonvaNode, resizeUseCaseKonvaNode } from './use_case.node';
import { createBoundaryKonvaNode, resizeBoundaryKonvaNode } from './boundary.node';
import { createControlKonvaNode, resizeControlKonvaNode } from './control.node';
import { createEntityKonvaNode, resizeEntityKonvaNode } from './entity.node';
import { createLifelineKonvaNode, resizeLifelineKonvaNode } from './lifeline.node';
import { createDeploymentKonvaNode, resizeDeploymentKonvaNode } from './deployment.node';
import { createComponentKonvaNode, resizeComponentKonvaNode } from './component.node';
import { createPackageKonvaNode, resizePackageKonvaNode } from './package.node';
import { createPackageLayerKonvaNode, resizePackageLayerKonvaNode } from './package_layer.node';
import { createActivityKonvaNode, resizeActivityKonvaNode } from './activity.node';
import { createNoteKonvaNode, resizeNoteKonvaNode } from './note.node';

/**
 * Estrategia de renderizado Konva de un tipo de nodo UML.
 */
export interface NodeRenderer {
  /** Construye el grupo Konva inicial del nodo. */
  create(node: UmlNode, isSelected: boolean): Konva.Group;
  /** Redimensiona de forma fluida las figuras internas del grupo ya creado. */
  resize(group: Konva.Group, node: UmlNode, width: number, height: number, isSelected: boolean): void;
}

const DEFAULT_CONTAINER_FILL = '#E0F2F1';

const ACTIVITY_RENDERER: NodeRenderer = {
  create: createActivityKonvaNode,
  resize: (group, node, w, h, isSelected) => resizeActivityKonvaNode(group, node, w, h, isSelected),
};

/**
 * Registro declarativo (Strategy + Registry): añadir un nuevo tipo de nodo UML consiste en
 * registrar una única entrada aquí. `Record<UmlNodeType, ...>` obliga a cubrir todos los tipos.
 */
export const NODE_RENDERER_REGISTRY: Record<UmlNodeType, NodeRenderer> = {
  class: {
    create: createClassKonvaNode,
    resize: (group, node, w, h) => resizeClassKonvaNode(group, w, h, node),
  },
  actor: {
    create: createActorKonvaNode,
    resize: (group, node, w, h, isSelected) => resizeActorKonvaNode(group, w, h, node.name, isSelected),
  },
  use_case: {
    create: createUseCaseKonvaNode,
    resize: (group, _node, w, h) => resizeUseCaseKonvaNode(group, w, h),
  },
  boundary: {
    create: createBoundaryKonvaNode,
    resize: (group, node, w, h, isSelected) =>
      resizeBoundaryKonvaNode(group, w, h, node.name, node.fill || DEFAULT_CONTAINER_FILL, isSelected),
  },
  control: {
    create: createControlKonvaNode,
    resize: (group, node, w, h, isSelected) =>
      resizeControlKonvaNode(group, w, h, node.name, node.fill || DEFAULT_CONTAINER_FILL, isSelected),
  },
  entity: {
    create: createEntityKonvaNode,
    resize: (group, node, w, h, isSelected) =>
      resizeEntityKonvaNode(group, w, h, node.name, node.fill || DEFAULT_CONTAINER_FILL, isSelected),
  },
  lifeline: {
    create: createLifelineKonvaNode,
    resize: (group, node, w, h, isSelected) => resizeLifelineKonvaNode(group, node, w, h, isSelected),
  },
  deployment_node: {
    create: createDeploymentKonvaNode,
    resize: (group, node, w, h, isSelected) => resizeDeploymentKonvaNode(group, node, w, h, isSelected),
  },
  component: {
    create: createComponentKonvaNode,
    resize: (group, node, w, h, isSelected) => resizeComponentKonvaNode(group, node, w, h, isSelected),
  },
  package: {
    create: createPackageKonvaNode,
    resize: (group, node, w, h, isSelected) => resizePackageKonvaNode(group, node, w, h, isSelected),
  },
  package_layer: {
    create: createPackageLayerKonvaNode,
    resize: (group, node, w, h, isSelected) => resizePackageLayerKonvaNode(group, node, w, h, isSelected),
  },
  note: {
    create: createNoteKonvaNode,
    resize: (group, node, w, h, isSelected) => resizeNoteKonvaNode(group, node, w, h, isSelected),
  },
  activity_initial: ACTIVITY_RENDERER,
  activity_final: ACTIVITY_RENDERER,
  activity_action: ACTIVITY_RENDERER,
  activity_decision: ACTIVITY_RENDERER,
  activity_fork: ACTIVITY_RENDERER,
};

/**
 * Resuelve el renderer de un tipo; los tipos desconocidos usan el renderer de clase (comportamiento histórico).
 */
export function resolveNodeRenderer(type: string): NodeRenderer {
  return (NODE_RENDERER_REGISTRY as Record<string, NodeRenderer | undefined>)[type] ?? NODE_RENDERER_REGISTRY.class;
}

/** Indica si existe un renderer registrado explícitamente para el tipo. */
export function hasNodeRenderer(type: string): boolean {
  return type in NODE_RENDERER_REGISTRY;
}
