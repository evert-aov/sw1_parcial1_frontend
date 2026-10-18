import { Injectable } from '@angular/core';
import Konva from 'konva';
import { DiagramType, UmlClassNode } from '../../../../../../core/models/diagram.model';
import { getNodeHeight, getNodeWidth } from '../../../utils/node-metrics.util';

export interface SmartGuidesParams {
  draggedId: string;
  currentX: number;
  currentY: number;
  width: number;
  height: number;
  ignoredIds: Set<string>;
  nodes: UmlClassNode[];
  nodeGroupsMap: Map<string, Konva.Group>;
  activeDiagramType: DiagramType;
  uiLayer?: Konva.Layer | null;
  guideLinesGroup?: Konva.Group | null;
}

/**
 * Servicio especializado en el cálculo de alineación magnética (Smart Guides) y dibujado de guías visuales.
 */
@Injectable({
  providedIn: 'root',
})
export class CanvasSmartGuidesService {
  private guideLinesGroup: Konva.Group | null = null;

  /**
   * Inicializa el grupo contenedor de líneas guía dentro de la capa UI.
   *
   * @param uiLayer Capa Konva de interfaz de usuario.
   * @returns Grupo Konva creado para las guías magnéticas.
   */
  initGuideLinesGroup(uiLayer: Konva.Layer): Konva.Group {
    if (this.guideLinesGroup) {
      this.guideLinesGroup.destroy();
    }
    this.guideLinesGroup = new Konva.Group({ listening: false, name: 'smart-guidelines-group' });
    uiLayer.add(this.guideLinesGroup);
    return this.guideLinesGroup;
  }

  /**
   * Limpia las líneas magnéticas visibles en pantalla.
   *
   * @param uiLayer Capa UI de Konva.
   * @param overrideGroup Grupo opcional si difiere de la instancia interna.
   */
  clearSmartGuides(uiLayer?: Konva.Layer | null, overrideGroup?: Konva.Group | null): void {
    const group = overrideGroup || this.guideLinesGroup;
    if (!group) return;
    if (group.children.length > 0) {
      group.destroyChildren();
      uiLayer?.batchDraw();
    }
  }

  /**
   * Calcula el snap magnético con los nodos vecinos (umbral 8px) y dibuja las líneas guía visuales.
   *
   * @param params Coordenadas del nodo arrastrado, dimensiones, nodos de referencia y grupos Konva.
   * @returns Coordenadas finales { x, y } con ajuste magnético si hubo alineación.
   */
  calculateAndDrawSmartGuides(params: SmartGuidesParams): { x: number; y: number } {
    const { draggedId, currentX, currentY, width, height, ignoredIds, nodes, nodeGroupsMap, activeDiagramType, uiLayer } = params;
    const guideGroup = params.guideLinesGroup || this.guideLinesGroup;
    if (!guideGroup) {
      return { x: currentX, y: currentY };
    }

    const SNAP_THRESHOLD = 8;
    const isSequence = activeDiagramType === DiagramType.SEQUENCE;

    const dragLeft = currentX;
    const dragCenterX = currentX + width / 2;
    const dragRight = currentX + width;
    const dragTop = currentY;
    const dragCenterY = currentY + height / 2;
    const dragBottom = currentY + height;

    interface SnapCandidateX {
      snappedX: number;
      guideX: number;
      diff: number;
      minY: number;
      maxY: number;
    }

    interface SnapCandidateY {
      snappedY: number;
      guideY: number;
      diff: number;
      minX: number;
      maxX: number;
    }

    let bestSnapX: SnapCandidateX | null = null;
    let bestSnapY: SnapCandidateY | null = null;

    for (const other of nodes) {
      if (other.isAnchor || other.id === draggedId || ignoredIds.has(other.id)) {
        continue;
      }

      const g = nodeGroupsMap.get(other.id);
      if (!g || !g.visible()) continue;

      const tX = Math.round(g.x());
      const tY = Math.round(g.y());
      const tW = g.width() || getNodeWidth(other);
      const tH = g.height() || getNodeHeight(other) || 100;

      const targetLeft = tX;
      const targetCenterX = tX + tW / 2;
      const targetRight = tX + tW;
      const targetTop = tY;
      const targetCenterY = tY + tH / 2;
      const targetBottom = tY + tH;

      const xOptions = [
        { snappedX: targetLeft, guideX: targetLeft, diff: Math.abs(dragLeft - targetLeft) },
        { snappedX: targetCenterX, guideX: targetCenterX, diff: Math.abs(dragLeft - targetCenterX) },
        { snappedX: targetRight, guideX: targetRight, diff: Math.abs(dragLeft - targetRight) },
        { snappedX: targetCenterX - width / 2, guideX: targetCenterX, diff: Math.abs(dragCenterX - targetCenterX) },
        { snappedX: targetLeft - width / 2, guideX: targetLeft, diff: Math.abs(dragCenterX - targetLeft) },
        { snappedX: targetRight - width / 2, guideX: targetRight, diff: Math.abs(dragCenterX - targetRight) },
        { snappedX: targetRight - width, guideX: targetRight, diff: Math.abs(dragRight - targetRight) },
        { snappedX: targetCenterX - width, guideX: targetCenterX, diff: Math.abs(dragRight - targetCenterX) },
        { snappedX: targetLeft - width, guideX: targetLeft, diff: Math.abs(dragRight - targetLeft) },
      ];

      for (const opt of xOptions) {
        if (opt.diff <= SNAP_THRESHOLD) {
          if (!bestSnapX || opt.diff < bestSnapX.diff) {
            bestSnapX = {
              snappedX: Math.round(opt.snappedX),
              guideX: Math.round(opt.guideX),
              diff: opt.diff,
              minY: targetTop,
              maxY: targetBottom,
            };
          } else if (bestSnapX && Math.abs(bestSnapX.guideX - Math.round(opt.guideX)) < 1) {
            bestSnapX.minY = Math.min(bestSnapX.minY, targetTop);
            bestSnapX.maxY = Math.max(bestSnapX.maxY, targetBottom);
          }
        }
      }

      if (!isSequence && other.nodeType !== 'lifeline') {
        const yOptions = [
          { snappedY: targetTop, guideY: targetTop, diff: Math.abs(dragTop - targetTop) },
          { snappedY: targetCenterY, guideY: targetCenterY, diff: Math.abs(dragTop - targetCenterY) },
          { snappedY: targetBottom, guideY: targetBottom, diff: Math.abs(dragTop - targetBottom) },
          { snappedY: targetCenterY - height / 2, guideY: targetCenterY, diff: Math.abs(dragCenterY - targetCenterY) },
          { snappedY: targetTop - height / 2, guideY: targetTop, diff: Math.abs(dragCenterY - targetTop) },
          { snappedY: targetBottom - height / 2, guideY: targetBottom, diff: Math.abs(dragCenterY - targetBottom) },
          { snappedY: targetBottom - height, guideY: targetBottom, diff: Math.abs(dragBottom - targetBottom) },
          { snappedY: targetCenterY - height, guideY: targetCenterY, diff: Math.abs(dragBottom - targetCenterY) },
          { snappedY: targetTop - height, guideY: targetTop, diff: Math.abs(dragBottom - targetTop) },
        ];

        for (const opt of yOptions) {
          if (opt.diff <= SNAP_THRESHOLD) {
            if (!bestSnapY || opt.diff < bestSnapY.diff) {
              bestSnapY = {
                snappedY: Math.round(opt.snappedY),
                guideY: Math.round(opt.guideY),
                diff: opt.diff,
                minX: targetLeft,
                maxX: targetRight,
              };
            } else if (bestSnapY && Math.abs(bestSnapY.guideY - Math.round(opt.guideY)) < 1) {
              bestSnapY.minX = Math.min(bestSnapY.minX, targetLeft);
              bestSnapY.maxX = Math.max(bestSnapY.maxX, targetRight);
            }
          }
        }
      }
    }

    const finalX = bestSnapX ? bestSnapX.snappedX : currentX;
    const finalY = bestSnapY ? bestSnapY.snappedY : currentY;

    guideGroup.destroyChildren();

    if (bestSnapX) {
      const minY = Math.min(finalY, bestSnapX.minY) - 30;
      const maxY = Math.max(finalY + height, bestSnapX.maxY) + 30;
      guideGroup.add(
        new Konva.Line({
          points: [bestSnapX.guideX, minY, bestSnapX.guideX, maxY],
          stroke: '#0ea5e9',
          strokeWidth: 1.5,
          strokeScaleEnabled: false,
          dash: [5, 4],
          listening: false,
          perfectDrawEnabled: false,
        })
      );
    }

    if (bestSnapY) {
      const minX = Math.min(finalX, bestSnapY.minX) - 30;
      const maxX = Math.max(finalX + width, bestSnapY.maxX) + 30;
      guideGroup.add(
        new Konva.Line({
          points: [minX, bestSnapY.guideY, maxX, bestSnapY.guideY],
          stroke: '#0ea5e9',
          strokeWidth: 1.5,
          strokeScaleEnabled: false,
          dash: [5, 4],
          listening: false,
          perfectDrawEnabled: false,
        })
      );
    }

    uiLayer?.batchDraw();
    return { x: finalX, y: finalY };
  }

  /**
   * Destruye el grupo de líneas guía y libera recursos.
   */
  destroy(): void {
    if (this.guideLinesGroup) {
      this.guideLinesGroup.destroy();
      this.guideLinesGroup = null;
    }
  }
}
