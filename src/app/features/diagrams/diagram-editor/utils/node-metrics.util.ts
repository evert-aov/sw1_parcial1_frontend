import { Injectable, inject } from '@angular/core';
import { UmlClassNode } from '../../../../core/models/diagram.model';
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
 * Calcula el ancho total requerido para el tablero en base a la posición de los nodos.
 * @param nodes Lista de nodos en el diagrama.
 * @param minWidth Ancho mínimo base.
 * @returns Ancho final en píxeles.
 */
export function computeBoardWidth(nodes: UmlClassNode[], minWidth = 2200): number {
  let max = minWidth;
  for (const node of nodes) {
    if (node.position && node.position.x + 350 > max) {
      max = node.position.x + 350;
    }
  }
  return max;
}

/**
 * Calcula la altura total requerida para el tablero en base a la posición de los nodos.
 * @param nodes Lista de nodos en el diagrama.
 * @param minHeight Altura mínima base.
 * @returns Altura final en píxeles.
 */
export function computeBoardHeight(nodes: UmlClassNode[], minHeight = 1400): number {
  let max = minHeight;
  for (const node of nodes) {
    if (node.position && node.position.y + 350 > max) {
      max = node.position.y + 350;
    }
  }
  return max;
}
