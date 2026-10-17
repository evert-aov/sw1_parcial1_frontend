import { UmlClassNode } from '../../../../../../../core/models/diagram.model';

/**
 * Determina si el nodo es un Actor UML
 */
export function isActorNode(node?: UmlClassNode | null): boolean {
  return node?.nodeType === 'actor';
}

/**
 * Calcula el desplazamiento vertical extra inferior de un actor (para su etiqueta de texto)
 */
export function getActorBottomExtra(node: UmlClassNode): number {
  if (node.nodeType === 'actor') {
    return 38 + Math.max(0, node.labelOffset?.y || 0);
  }
  return 0;
}
