import { Injectable, inject } from '@angular/core';
import { DiagramType, UmlClassNode, UmlConnection } from '../../../../core/models/diagram.model';
import { NodePluginRegistryService } from '../../../../core/plugins/node-plugin-registry.service';
@Injectable({ providedIn: 'root' })
export class NodeMetricsService {
  private readonly registry = inject(NodePluginRegistryService);

  /**
   * Obtiene el ancho geométrico de un nodo consultando su plugin o valores custom/default.
   * @param node Nodo UML.
   * @returns Ancho en píxeles.
   */
  getNodeWidth(node: UmlClassNode): number {
    return node.isAnchor
      ? 0
      : (this.registry.forNode(node)?.geometry.width(node) ??
          node.customWidth ??
          node.width ??
          120);
  }

  /**
   * Obtiene la altura geométrica de un nodo consultando su plugin o valores custom/default.
   * @param node Nodo UML.
   * @returns Altura en píxeles.
   */
  getNodeHeight(node: UmlClassNode): number {
    return node.isAnchor
      ? 0
      : (this.registry.forNode(node)?.geometry.height(node) ??
          node.customHeight ??
          node.height ??
          60);
  }

  /**
   * Calcula el ancho dinámico de un nodo en base al contenido textual de sus miembros.
   * @param node Nodo UML.
   * @returns Ancho dinámico calculado en píxeles.
   */
  getDynamicNodeWidth(node: UmlClassNode): number {
    return node.isAnchor
      ? 0
      : (this.registry.forNode(node)?.geometry.dynamicWidth(node) ?? node.width ?? 120);
  }

  /**
   * Resuelve el color de fondo por defecto asignado a un tipo de nodo o estereotipo.
   * @param nodeType Tipo de nodo.
   * @param stereotype Estereotipo asociado (opcional).
   * @returns Código de color hexadecimal representativo.
   */
  getDefaultColorForNodeType(nodeType?: string | null, stereotype?: string | null): string {
    const node = { nodeType: nodeType ?? undefined, stereotype };
    const plugin = this.registry.forNode(node);
    return plugin?.resolveColor?.(node) ?? plugin?.defaultColor ?? '#FDFAF3';
  }
}

/**
 * Calcula el ancho total requerido para el tablero en base a la posición de los nodos y margen de trabajo.
 * @param nodes Lista de nodos en el diagrama.
 * @param connections Lista de conexiones (opcional).
 * @param activeDiagramType Tipo de diagrama activo (opcional).
 * @param minWidth Ancho mínimo base.
 * @returns Ancho final en píxeles.
 */
export function computeBoardWidth(
  nodes: UmlClassNode[],
  connections: UmlConnection[] = [],
  activeDiagramType?: DiagramType,
  minWidth = 2400,
): number {
  let max = minWidth;
  for (const node of nodes) {
    if (node.position) {
      const nodeW = node.customWidth ?? node.width ?? 350;
      const right = node.position.x + nodeW + 500;
      if (right > max) {
        max = right;
      }
    }
  }
  return max;
}

/**
 * Calcula la altura total requerida para el tablero en base a la posición de los nodos,
 * slots de secuencia y margen de trabajo inferior dinámico.
 * @param nodes Lista de nodos en el diagrama.
 * @param connections Lista de conexiones del diagrama.
 * @param activeDiagramType Tipo de diagrama activo.
 * @param minHeight Altura mínima base.
 * @returns Altura final en píxeles.
 */
export function computeBoardHeight(
  nodes: UmlClassNode[],
  connections: UmlConnection[] = [],
  activeDiagramType?: DiagramType,
  minHeight = 1600,
): number {
  let max = minHeight;

  // 1. Evaluar posiciones y dimensiones de todos los nodos regulares
  for (const node of nodes) {
    if (node.position) {
      const nodeH = node.customHeight ?? node.height ?? 350;
      const bottom = node.position.y + nodeH + 500;
      if (bottom > max) {
        max = bottom;
      }
    }
  }

  // 2. Evaluar extensión vertical para diagramas de secuencia (líneas de vida y mensajes)
  const isSequence =
    activeDiagramType === DiagramType.SEQUENCE ||
    connections.some((c) => Boolean(c.sourceId?.includes('_slot_') || c.targetId?.includes('_slot_')));

  if (isSequence) {
    let maxSlot = -1;
    for (const c of connections) {
      const sMatch = c.sourceId?.match(/_slot_(\d+)$/);
      if (sMatch) maxSlot = Math.max(maxSlot, parseInt(sMatch[1], 10));
      const tMatch = c.targetId?.match(/_slot_(\d+)$/);
      if (tMatch) maxSlot = Math.max(maxSlot, parseInt(tMatch[1], 10));
    }

    // Asegurar holgura de al menos 15 slots vacíos después del último mensaje para seguir dibujando
    const slotCount = Math.max(25, maxSlot + 1 + 15);
    // Cada slot se ubica en 210 + slot * 50; sumamos 800px adicionales de margen de lienzo
    const sequenceBottom = 210 + slotCount * 50 + 800;
    if (sequenceBottom > max) {
      max = sequenceBottom;
    }
  }

  return max;
}
