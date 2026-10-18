import { Injectable } from '@angular/core';
import Konva from 'konva';
import {
  DiagramType,
  UmlClassNode,
} from '../../../../../../core/models/diagram.model';
import { getNodeHeight, getNodeWidth } from '../../../utils/node-metrics.util';
import { UmlNode } from '../konva/models/uml.model';
import {
  resizeClassKonvaNode,
  resizeActorKonvaNode,
  resizeUseCaseKonvaNode,
  resizeBoundaryKonvaNode,
  resizeControlKonvaNode,
  resizeEntityKonvaNode,
  resizeLifelineKonvaNode,
  resizeDeploymentKonvaNode,
  resizeComponentKonvaNode,
  resizePackageKonvaNode,
  resizePackageLayerKonvaNode,
  resizeNoteKonvaNode,
  resizeActivityKonvaNode,
} from '../konva/nodes';

/**
 * Servicio encargado de la manipulación interactiva de nodos UML en Konva:
 * guías inteligentes de alineación magnética (Smart Guides), caja de selección múltiple (Marquee),
 * transformador de redimensionamiento fluido (Transformer) y ordenamiento de profundidad Z.
 */
@Injectable({
  providedIn: 'root',
})
export class CanvasNodeInteractionService {
  private guideLinesGroup: Konva.Group | null = null;
  private transformer: Konva.Transformer | null = null;
  private marqueeRect: Konva.Rect | null = null;

  /**
   * Inicializa y registra en la capa UI los componentes de interacción: guías, transformer y marquee.
   *
   * @param uiLayer Capa Konva de interfaz de usuario donde se registrarán los elementos interactivos.
   * @returns Referencias a los componentes interactivos creados.
   */
  initUiElements(uiLayer: Konva.Layer): {
    guideLinesGroup: Konva.Group;
    transformer: Konva.Transformer;
    marqueeRect: Konva.Rect;
  } {
    this.guideLinesGroup = new Konva.Group({ listening: false, name: 'smart-guidelines-group' });
    uiLayer.add(this.guideLinesGroup);

    this.transformer = new Konva.Transformer({
      rotateEnabled: false,
      ignoreStroke: true,
      padding: 4,
      anchorSize: 9,
      anchorCornerRadius: 2,
      anchorStroke: '#059669',
      anchorFill: '#FFFFFF',
      borderStroke: '#059669',
      borderDash: [4, 4],
      boundBoxFunc: (oldBox, newBox) => {
        if (newBox.width < 80 || newBox.height < 50) {
          return oldBox;
        }
        return newBox;
      },
    });
    uiLayer.add(this.transformer);

    this.marqueeRect = new Konva.Rect({
      name: 'marquee-rect',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      visible: false,
      stroke: '#2563EB',
      strokeWidth: 1.5,
      dash: [4, 4],
      fill: 'rgba(37, 99, 235, 0.12)',
      listening: false,
    });
    uiLayer.add(this.marqueeRect);

    return {
      guideLinesGroup: this.guideLinesGroup,
      transformer: this.transformer,
      marqueeRect: this.marqueeRect,
    };
  }

  /**
   * Limpia las líneas magnéticas de la capa UI y solicita actualización visual.
   *
   * @param uiLayer Capa UI de Konva.
   * @param guideLinesGroup Grupo opcional de líneas guía si difiere de la instancia interna.
   */
  clearSmartGuides(uiLayer?: Konva.Layer | null, guideLinesGroup?: Konva.Group | null): void {
    const group = guideLinesGroup || this.guideLinesGroup;
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
   * @returns Coordenadas finales { x, y } ajustadas magnéticamente si hubo alineación.
   */
  calculateAndDrawSmartGuides(params: {
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
  }): { x: number; y: number } {
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

      const xOptions: Array<{ snappedX: number; guideX: number; diff: number }> = [
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
        const yOptions: Array<{ snappedY: number; guideY: number; diff: number }> = [
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
      const vLine = new Konva.Line({
        points: [bestSnapX.guideX, minY, bestSnapX.guideX, maxY],
        stroke: '#0ea5e9',
        strokeWidth: 1.5,
        strokeScaleEnabled: false,
        dash: [5, 4],
        listening: false,
        perfectDrawEnabled: false,
      });
      guideGroup.add(vLine);
    }

    if (bestSnapY) {
      const minX = Math.min(finalX, bestSnapY.minX) - 30;
      const maxX = Math.max(finalX + width, bestSnapY.maxX) + 30;
      const hLine = new Konva.Line({
        points: [minX, bestSnapY.guideY, maxX, bestSnapY.guideY],
        stroke: '#0ea5e9',
        strokeWidth: 1.5,
        strokeScaleEnabled: false,
        dash: [5, 4],
        listening: false,
        perfectDrawEnabled: false,
      });
      guideGroup.add(hLine);
    }

    uiLayer?.batchDraw();

    return { x: finalX, y: finalY };
  }

  /**
   * Sincroniza las cajas de control del Konva.Transformer con los nodos seleccionados.
   *
   * @param params Nodos seleccionados, mapa de grupos Konva, permisos de sólo lectura y capa UI.
   */
  syncTransformer(params: {
    selectedNodeIds: string[];
    nodeGroupsMap: Map<string, Konva.Group>;
    isReadOnly: boolean;
    uiLayer?: Konva.Layer | null;
  }): void {
    const { selectedNodeIds, nodeGroupsMap, isReadOnly, uiLayer } = params;
    if (!this.transformer || !uiLayer) return;

    if (selectedNodeIds.length === 0 || isReadOnly) {
      this.transformer.nodes([]);
      uiLayer.batchDraw();
      return;
    }

    const groups: Konva.Group[] = [];
    for (const id of selectedNodeIds) {
      const g = nodeGroupsMap.get(id);
      if (g) groups.push(g);
    }

    this.transformer.nodes(groups);
    this.transformer.forceUpdate();
    uiLayer.batchDraw();
  }

  /**
   * Determina si un nodo actúa como contenedor estructural de fondo (ej: paquete, recuadro de capas o límite).
   *
   * @param node Nodo UML a evaluar.
   * @returns True si el nodo es un contenedor estructural.
   */
  isContainerNode(node?: UmlClassNode | UmlNode | null): boolean {
    if (!node) return false;
    const n = node as any;
    const t = (n.nodeType || n.type || '').toLowerCase();
    const id = (n.id || '').toLowerCase();
    return (
      t === 'boundary_box' ||
      t === 'package_layer' ||
      t === 'package' ||
      t === 'device' ||
      t === 'executionenvironment' ||
      t === 'execution_environment' ||
      t === 'exec_env' ||
      t === 'deployment_node' ||
      t === 'node' ||
      t === 'subsystem' ||
      id.startsWith('boundary_box_') ||
      id.startsWith('bbox_') ||
      id.startsWith('package_')
    );
  }

  /**
   * Obtiene el peso de ordenamiento de profundidad Z para un nodo.
   *
   * @param node Nodo UML a evaluar.
   * @returns Peso numérico en el eje Z (0: fondo absoluto, 100: tope).
   */
  getNodeZWeight(node: UmlClassNode | UmlNode): number {
    const n = node as any;
    const t = (n.nodeType || n.type || '').toLowerCase();
    const id = (n.id || '').toLowerCase();
    if (t === 'boundary_box' || t === 'package_layer' || id.startsWith('boundary_box_') || id.startsWith('bbox_')) {
      return 0;
    }
    if (t === 'package' || id.startsWith('package_')) {
      return 1;
    }
    if (
      t === 'device' ||
      t === 'executionenvironment' ||
      t === 'execution_environment' ||
      t === 'exec_env' ||
      t === 'deployment_node' ||
      t === 'node' ||
      t === 'subsystem'
    ) {
      return 2;
    }
    if (t === 'component' || t === 'artifact') {
      return 100;
    }
    return 10;
  }

  /**
   * Asegura que los contenedores de fondo y los componentes mantengan el orden Z correcto.
   *
   * @param nodeLayer Capa Konva de nodos estándar.
   * @param frameLayer Capa Konva de contenedores estructurales de fondo.
   * @param nodeGroupsMap Mapa de grupos Konva por ID de nodo.
   * @param nodes Lista de nodos del diagrama.
   */
  enforceZOrdering(
    nodeLayer: Konva.Layer | null,
    frameLayer: Konva.Layer | null,
    nodeGroupsMap: Map<string, Konva.Group>,
    nodes: UmlClassNode[],
  ): void {
    if (!nodeLayer || !frameLayer) return;

    for (const [id, grp] of nodeGroupsMap.entries()) {
      const n = nodes.find((x) => x.id === id);
      if (!n || !this.isContainerNode(n)) continue;
      const w = this.getNodeZWeight(n);
      if (w === 0) {
        grp.moveToBottom();
      }
    }

    for (const [id, grp] of nodeGroupsMap.entries()) {
      const n = nodes.find((x) => x.id === id);
      if (!n || this.isContainerNode(n)) continue;
      const t = (n?.nodeType || '').toLowerCase();
      if (t === 'component' || t === 'artifact') {
        grp.moveToTop();
      }
    }
  }

  /**
   * Resuelve el nodo destino real considerando la contención geométrica interna.
   *
   * @param clickedNode Nodo sobre el cual se hizo clic.
   * @param stage Escenario Konva.Stage.
   * @param nodes Lista de nodos del diagrama.
   * @param nodeGroupsMap Mapa de grupos Konva.
   * @returns El nodo hijo contenido si el clic apuntaba a su interior, o clickedNode.
   */
  resolveTargetNodeAtPointer(
    clickedNode: UmlClassNode,
    stage: Konva.Stage | null,
    nodes: UmlClassNode[],
    nodeGroupsMap: Map<string, Konva.Group>,
  ): UmlClassNode {
    if (!this.isContainerNode(clickedNode)) {
      return clickedNode;
    }

    const pointer = stage?.getPointerPosition();
    if (!pointer) return clickedNode;

    const transform = stage?.getAbsoluteTransform().copy().invert();
    const canvasPos = transform ? transform.point(pointer) : pointer;
    const px = Math.round(canvasPos.x);
    const py = Math.round(canvasPos.y);

    const candidates = nodes.filter((n) => {
      if (n.id === clickedNode.id || n.isAnchor) return false;
      const group = nodeGroupsMap.get(n.id);
      const nx = group ? group.x() : n.position?.x ?? 0;
      const ny = group ? group.y() : n.position?.y ?? 0;
      const nw = group ? group.width() : n.width || 200;
      const nh = group ? group.height() : n.height || 100;
      return px >= nx && px <= nx + nw && py >= ny && py <= ny + nh;
    });

    if (candidates.length > 0) {
      candidates.sort((a, b) => this.getNodeZWeight(b) - this.getNodeZWeight(a));
      return candidates[0];
    }

    return clickedNode;
  }

  /**
   * Redimensiona dinámicamente los elementos visuales internos de un nodo Konva según su tipo UML.
   *
   * @param group Grupo Konva del nodo a redimensionar.
   * @param node Modelo Konva del nodo con sus datos y configuración.
   * @param newW Nuevo ancho en píxeles.
   * @param newH Nuevo alto en píxeles.
   */
  applyFluidNodeResize(
    group: Konva.Group,
    node: UmlNode,
    newW: number,
    newH: number
  ): void {
    switch (node.type) {
      case 'class':
        resizeClassKonvaNode(group, newW, newH, node);
        break;
      case 'actor':
        resizeActorKonvaNode(group, newW, newH, node.name, true);
        break;
      case 'use_case':
        resizeUseCaseKonvaNode(group, newW, newH);
        break;
      case 'boundary':
        resizeBoundaryKonvaNode(group, newW, newH, node.name, node.fill || '#E0F2F1', true);
        break;
      case 'control':
        resizeControlKonvaNode(group, newW, newH, node.name, node.fill || '#E0F2F1', true);
        break;
      case 'entity':
        resizeEntityKonvaNode(group, newW, newH, node.name, node.fill || '#E0F2F1', true);
        break;
      case 'lifeline':
        resizeLifelineKonvaNode(group, node, newW, newH, true);
        break;
      case 'deployment_node':
        resizeDeploymentKonvaNode(group, node, newW, newH, true);
        break;
      case 'component':
        resizeComponentKonvaNode(group, node, newW, newH, true);
        break;
      case 'package':
        resizePackageKonvaNode(group, node, newW, newH, true);
        break;
      case 'package_layer':
        resizePackageLayerKonvaNode(group, node, newW, newH, true);
        break;
      case 'note':
        resizeNoteKonvaNode(group, node, newW, newH, true);
        break;
      case 'activity_initial':
      case 'activity_final':
      case 'activity_action':
      case 'activity_decision':
      case 'activity_fork':
        resizeActivityKonvaNode(group, node, newW, newH, true);
        break;
    }
  }

  /**
   * Libera referencias a componentes interactivos.
   */
  destroy(): void {
    if (this.guideLinesGroup) {
      this.guideLinesGroup.destroy();
      this.guideLinesGroup = null;
    }
    if (this.transformer) {
      this.transformer.destroy();
      this.transformer = null;
    }
    if (this.marqueeRect) {
      this.marqueeRect.destroy();
      this.marqueeRect = null;
    }
  }
}
