import { UmlClassNode } from '../../../core/models/diagram.model';

export const COMPONENT_DEFAULT_WIDTH = 200;
export const COMPONENT_DEFAULT_HEIGHT = 90;

/**
 * Determina si el nodo es de tipo componente o subsistema
 */
export function isComponentNode(nodeType?: string): boolean {
  return nodeType === 'component' || nodeType === 'subsystem';
}

/**
 * Normaliza las dimensiones de un nodo de componente respetando límites mínimos
 */
export function getComponentDimensions(node: UmlClassNode): { width: number; height: number } {
  return {
    width: Math.max(COMPONENT_DEFAULT_WIDTH, node.width || COMPONENT_DEFAULT_WIDTH),
    height: Math.max(COMPONENT_DEFAULT_HEIGHT, node.height || COMPONENT_DEFAULT_HEIGHT),
  };
}
