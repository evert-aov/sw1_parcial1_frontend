import { Injectable } from '@angular/core';
import Konva from 'konva';
import { UmlClassNode } from '../../../../../../core/models/diagram.model';
import { NodeLock } from '../../../../../../core/services/collaboration.service';
import { getNodeHeight, getNodeWidth } from '../../../utils/node-metrics.util';

/**
 * Servicio encargado de la renderización colaborativa (cursores remotos, bloqueos de nodos)
 * y de la exportación vectorial optimizada de alta resolución con la API nativa de Konva.
 */
@Injectable({
  providedIn: 'root',
})
export class CanvasCollabExportService {
  /**
   * Obtiene la información de bloqueo concurrencial de un nodo según el mapa de locks.
   *
   * @param nodeId Identificador del nodo a consultar.
   * @param nodeLocks Mapa o registro de bloqueos activos en la sala.
   * @returns Datos del bloqueo NodeLock o null si el nodo está libre.
   */
  getNodeLock(
    nodeId: string,
    nodeLocks: Map<string, NodeLock> | Record<string, NodeLock>,
  ): NodeLock | null {
    if (nodeLocks instanceof Map) {
      return nodeLocks.get(nodeId) ?? null;
    } else if (nodeLocks && typeof nodeLocks === 'object') {
      return (nodeLocks as Record<string, NodeLock>)[nodeId] ?? null;
    }
    return null;
  }

  /**
   * Determina si un nodo está bloqueado actualmente por otro usuario concurrente.
   *
   * @param nodeId Identificador del nodo a consultar.
   * @param nodeLocks Mapa o registro de bloqueos activos.
   * @param currentUserId Identificador del usuario local activo en la sesión.
   * @returns True si el nodo está bloqueado por otro usuario distinto al actual.
   */
  isNodeLockedByOther(
    nodeId: string,
    nodeLocks: Map<string, NodeLock> | Record<string, NodeLock>,
    currentUserId: string | null,
  ): boolean {
    const lock = this.getNodeLock(nodeId, nodeLocks);
    if (!lock) return false;
    return lock.userId !== currentUserId;
  }

  /**
   * Exporta el contenido vectorial del lienzo Konva a un HTMLCanvasElement optimizado,
   * calculando el bounding box envolvente de todos los nodos y relaciones en coordenadas absolutas del modelo (escala 1x),
   * ocultando temporalmente la rejilla, marquesina de selección y transformer,
   * y renderizando a alta resolución (pixelRatio: 2 por defecto para nitidez Retina).
   *
   * @param params Opciones con stage, capas, nodos, transformer, grid, padding y pixelRatio.
   * @returns Canvas HTMLCanvasElement recortado al contenido o null si no hay nodos reales.
   */
  exportContentCanvas(params: {
    stage: Konva.Stage | null;
    nodes: UmlClassNode[];
    nodeGroupsMap: Map<string, Konva.Group>;
    relLayer: Konva.Layer | null;
    uiLayer: Konva.Layer | null;
    gridGroup: Konva.Group | null;
    bgRect: Konva.Rect | null;
    transformer: Konva.Transformer | null;
    pixelRatio?: number;
    padding?: number;
  }): HTMLCanvasElement | null {
    const { stage, nodes, nodeGroupsMap, relLayer, uiLayer, gridGroup, bgRect, transformer, pixelRatio = 2, padding = 40 } = params;
    if (!stage) return null;

    const validNodes = nodes.filter((n) => !n.isAnchor);
    if (validNodes.length === 0) {
      return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const rawNode of nodes) {
      const group = nodeGroupsMap.get(rawNode.id);
      const x = group ? group.x() : rawNode.position.x;
      const y = group ? group.y() : rawNode.position.y;
      const w = group?.width() || getNodeWidth(rawNode) || 200;
      const h = group?.height() || getNodeHeight(rawNode) || 80;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    }

    if (relLayer && relLayer.children.length > 0) {
      try {
        const relRect = relLayer.getClientRect({ skipTransform: true });
        if (Number.isFinite(relRect.x) && Number.isFinite(relRect.width) && relRect.width > 0 && relRect.width < 50000) {
          minX = Math.min(minX, relRect.x);
          minY = Math.min(minY, relRect.y);
          maxX = Math.max(maxX, relRect.x + relRect.width);
          maxY = Math.max(maxY, relRect.y + relRect.height);
        }
      } catch {
        // Fallback a coordenadas de nodos
      }
    }

    const cropX = Math.floor(minX - padding);
    const cropY = Math.floor(minY - padding);
    const cropW = Math.max(120, Math.ceil(maxX - minX + padding * 2));
    const cropH = Math.max(80, Math.ceil(maxY - minY + padding * 2));

    const prevScale = { x: stage.scaleX(), y: stage.scaleY() };
    const prevPos = { x: stage.x(), y: stage.y() };
    const prevGridVisible = gridGroup ? gridGroup.visible() : true;
    const prevUiVisible = uiLayer ? uiLayer.visible() : true;
    const prevBgColor = bgRect ? (bgRect.fill() as string) : '#FAF9F5';
    const prevTransformerNodes = transformer ? [...transformer.nodes()] : [];

    try {
      if (transformer) {
        transformer.nodes([]);
      }
      if (uiLayer) {
        uiLayer.visible(false);
      }
      if (gridGroup) {
        gridGroup.visible(false);
      }
      if (bgRect) {
        bgRect.fill('#FFFFFF');
      }

      stage.scale({ x: 1, y: 1 });
      stage.position({ x: 0, y: 0 });

      const contentCanvas = stage.toCanvas({
        x: cropX,
        y: cropY,
        width: cropW,
        height: cropH,
        pixelRatio,
      });

      return contentCanvas;
    } finally {
      stage.scale(prevScale);
      stage.position(prevPos);
      if (gridGroup) {
        gridGroup.visible(prevGridVisible);
      }
      if (uiLayer) {
        uiLayer.visible(prevUiVisible);
      }
      if (bgRect) {
        bgRect.fill(prevBgColor);
      }
      if (transformer && prevTransformerNodes.length > 0) {
        transformer.nodes(prevTransformerNodes);
      }
      stage.batchDraw();
    }
  }
}
