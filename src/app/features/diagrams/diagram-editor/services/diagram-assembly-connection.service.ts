import { Injectable } from '@angular/core';
import { UmlClassNode, UmlConnection } from '../../../../core/models/diagram.model';

@Injectable({ providedIn: 'root' })
export class DiagramAssemblyConnectionService {
  /**
   * Resuelve el lado de conexión del nodo ('top' | 'right' | 'bottom' | 'left') según el ID del conector o defaultSide.
   */
  getConnSide(
    connectorId: string | undefined,
    defaultSide: 'top' | 'right' | 'bottom' | 'left' = 'right',
  ): 'top' | 'right' | 'bottom' | 'left' {
    if (!connectorId) return defaultSide;
    if (connectorId.endsWith('_top')) return 'top';
    if (connectorId.endsWith('_right')) return 'right';
    if (connectorId.endsWith('_bottom')) return 'bottom';
    if (connectorId.endsWith('_left')) return 'left';
    return defaultSide;
  }

  /**
   * Obtiene las coordenadas absolutas {x, y} en el lienzo del punto de conexión especificado.
   */
  getConnectorPoint(
    node: UmlClassNode,
    side: string,
    nodeWidth: number,
    nodeHeight?: number | null,
  ): { x: number; y: number } {
    const w = node.isAnchor ? 0 : (nodeWidth || 200);
    const h = nodeHeight || 60;
    const bottomExtra =
      node.nodeType === 'actor' ||
      node.nodeType === 'boundary' ||
      node.nodeType === 'control' ||
      node.nodeType === 'entity'
        ? 38 + Math.max(0, node.labelOffset?.y || 0)
        : 0;
    switch (side) {
      case 'left':
        return { x: node.position.x, y: node.position.y + h / 2 };
      case 'right':
        return { x: node.position.x + w, y: node.position.y + h / 2 };
      case 'top':
        return { x: node.position.x + w / 2, y: node.position.y };
      case 'bottom':
        return { x: node.position.x + w / 2, y: node.position.y + h + bottomExtra };
      default:
        return { x: node.position.x + w / 2, y: node.position.y + h / 2 };
    }
  }

  /**
   * Calcula el ángulo en grados (0 a 360) para orientar el símbolo Ball-and-Socket tangencialmente a la línea.
   */
  getAssemblyAngle(
    conn: UmlConnection,
    nodes: UmlClassNode[],
    container?: HTMLElement | null,
    getNodeWidth?: (node: UmlClassNode) => number,
    getNodeHeight?: (node: UmlClassNode) => number | null,
  ): number {
    try {
      if (container) {
        const pathEl = container.querySelector(
          `[data-connection-id="${conn.id}"] path[f-connection-path]`,
        ) as SVGPathElement | null;
        if (pathEl && typeof pathEl.getTotalLength === 'function') {
          const len = pathEl.getTotalLength();
          if (len > 0) {
            const p1 = pathEl.getPointAtLength(Math.max(0, len * 0.5 - 2));
            const p2 = pathEl.getPointAtLength(Math.min(len, len * 0.5 + 2));
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            if (dx !== 0 || dy !== 0) {
              return Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
            }
          }
        }
      }
    } catch (_) {}

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const sId = conn.sourceNodeId || conn.sourceId.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
    const tId = conn.targetNodeId || conn.targetId.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
    const sNode = nodeMap.get(sId);
    const tNode = nodeMap.get(tId);
    if (!sNode || !tNode) return 0;

    const sWidth = getNodeWidth ? getNodeWidth(sNode) : sNode.width || 200;
    const sHeight = getNodeHeight ? getNodeHeight(sNode) || 60 : sNode.height || 60;
    const tWidth = getNodeWidth ? getNodeWidth(tNode) : tNode.width || 200;
    const tHeight = getNodeHeight ? getNodeHeight(tNode) || 60 : tNode.height || 60;

    const sCenter = { x: sNode.position.x + sWidth / 2, y: sNode.position.y + sHeight / 2 };
    const tCenter = { x: tNode.position.x + tWidth / 2, y: tNode.position.y + tHeight / 2 };

    const dx = tCenter.x - sCenter.x;
    const dy = tCenter.y - sCenter.y;
    return Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
  }
}
