import { Injectable, NgZone } from '@angular/core';
import Konva from 'konva';
import {
  DiagramType,
  UmlClassNode,
  UmlConnection,
  UmlRelationshipType,
} from '../../../../../../core/models/diagram.model';
import { getNodeHeight, getNodeWidth } from '../../../utils/node-metrics.util';
import { UmlNode } from '../konva/models/uml.model';
import { toKonvaNode } from '../konva/konva-adapter.util';
import {
  createClassKonvaNode,
  resizeClassKonvaNode,
  createActorKonvaNode,
  resizeActorKonvaNode,
  createUseCaseKonvaNode,
  resizeUseCaseKonvaNode,
  createBoundaryKonvaNode,
  resizeBoundaryKonvaNode,
  createControlKonvaNode,
  resizeControlKonvaNode,
  createEntityKonvaNode,
  resizeEntityKonvaNode,
  createLifelineKonvaNode,
  resizeLifelineKonvaNode,
  createDeploymentKonvaNode,
  resizeDeploymentKonvaNode,
  createComponentKonvaNode,
  resizeComponentKonvaNode,
  createPackageKonvaNode,
  resizePackageKonvaNode,
  createPackageLayerKonvaNode,
  resizePackageLayerKonvaNode,
  createActivityKonvaNode,
  resizeActivityKonvaNode,
  createNoteKonvaNode,
  resizeNoteKonvaNode,
} from '../konva/nodes';
import { isSequenceRelationshipType, findNextAvailableSlot } from '../nodes/uml-lifeline-node/uml-lifeline.logic';
import { DiagramContainmentService } from '../../../services/diagram-containment.service';
import { DiagramSequenceActivationService } from '../../../services/diagram-sequence-activation.service';
import { CanvasRelationshipManagerService } from './canvas-relationship-manager.service';

export interface NodeInteractionCallbacks {
  onNodeClick: (nodeId: string, event: MouseEvent) => void;
  onNodeDblClick: (node: UmlClassNode, event: MouseEvent) => void;
  onNodeContextMenu: (node: UmlClassNode, event: MouseEvent) => void;
  onConnectionClick: (connId: string, event: MouseEvent) => void;
  onConnectionCreated: (event: { fOutputId: string; fInputId: string }) => void;
  onNodePositionChange: (event: { node: UmlClassNode; newPosition: { x: number; y: number } }) => void;
  onNodeSizeChange: (event: { node: UmlClassNode; width: number; height?: number; position: { x: number; y: number } }) => void;
  onMoveNodes: (event: { nodes: Array<{ id: string; position: { x: number; y: number } }> }) => void;
  onSelectionChange: (event: { nodeIds: string[]; connectionIds: string[] }) => void;
  onRenderRelationships: () => void;
  onClearLivePreview: () => void;
  onDragStateChange: (isDragging: boolean) => void;
}

export interface NodeInteractionContext {
  stage: Konva.Stage | null;
  nodeLayer: Konva.Layer | null;
  frameLayer: Konva.Layer | null;
  uiLayer: Konva.Layer | null;
  nodeGroupsMap: Map<string, Konva.Group>;
  nodes: () => UmlClassNode[];
  connections: () => UmlConnection[];
  activeDiagramType: () => DiagramType;
  selectedRelationType: () => UmlRelationshipType | null;
  pendingSourceNodeId: () => string | null;
  setPendingSourceNodeId: (id: string | null) => void;
  hoveredNodeId: () => string | null;
  setHoveredNodeId: (id: string | null) => void;
  selectedNodeIdsInternal: () => string[];
  select: (nodeIds: string[], connIds: string[]) => void;
  isReadOnly: () => boolean;
  smartGuidesEnabled: () => boolean;
  isNodeLockedByOther: (nodeId: string) => boolean;
  containmentService: DiagramContainmentService;
  relationshipManager: CanvasRelationshipManagerService;
  sequenceActivationService: DiagramSequenceActivationService;
  ngZone: NgZone;
  lastLocalMoveTimestamps: Map<string, number>;
  callbacks: NodeInteractionCallbacks;
}

export interface StageEventsCallbacks {
  onConnectionClick: (connId: string, event: MouseEvent) => void;
  onConnectionDblClick: (conn: UmlConnection, event: MouseEvent) => void;
  onConnectionContextMenu: (conn: UmlConnection, event: MouseEvent) => void;
  onCanvasBackgroundClick: (event?: MouseEvent) => void;
  onCanvasMouseDown: (event: MouseEvent) => void;
  onCanvasMouseMove: (event: MouseEvent) => void;
  onCanvasContextMenu: (event: { event: MouseEvent; canvasPos: { x: number; y: number } }) => void;
  onSelectionChange: (event: { nodeIds: string[]; connectionIds: string[] }) => void;
  onSelect: (nodeIds: string[], connIds: string[]) => void;
  onClearSelection: () => void;
  onLivePreview: (sourceId: string, x: number, y: number) => void;
  onClearLivePreview: () => void;
}

export interface StageEventsContext {
  stage: Konva.Stage | null;
  bgRect: Konva.Rect | null;
  uiLayer: Konva.Layer | null;
  nodeLayer: Konva.Layer | null;
  relLayer: Konva.Layer | null;
  nodeGroupsMap: Map<string, Konva.Group>;
  nodes: () => UmlClassNode[];
  connections: () => UmlConnection[];
  activeDiagramType: () => DiagramType;
  selectedRelationType: () => UmlRelationshipType | null;
  pendingSourceNodeId: () => string | null;
  setPendingSourceNodeId: (id: string | null) => void;
  isReadOnly: () => boolean;
  isDraggingNode: () => boolean;
  selectedConnIds: () => string[];
  sequenceActivationService: DiagramSequenceActivationService;
  relationshipManager: CanvasRelationshipManagerService;
  ngZone: NgZone;
  callbacks: StageEventsCallbacks;
}

/**
 * Servicio encargado de la manipulación interactiva de nodos UML en Konva:
 * guías inteligentes de alineación magnética (Smart Guides), caja de selección múltiple (Marquee),
 * transformador de redimensionamiento fluido (Transformer), ordenamiento de profundidad Z,
 * controladores de arrastre y eventos de interacción con el escenario.
 */
@Injectable({
  providedIn: 'root',
})
export class CanvasNodeInteractionService {
  private guideLinesGroup: Konva.Group | null = null;
  private transformer: Konva.Transformer | null = null;
  private marqueeRect: Konva.Rect | null = null;
  private isMarqueeSelecting = false;
  private marqueeStartPos = { x: 0, y: 0 };
  private onWindowMouseUpHandler?: () => void;

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
   * Instancia el grupo gráfico de Konva según el tipo de nodo UML.
   *
   * @param node Modelo Konva del nodo a crear.
   * @param isSelected Indica si el nodo se encuentra seleccionado.
   * @returns Grupo Konva construido para el nodo.
   */
  buildNodeGroup(node: UmlNode, isSelected: boolean): Konva.Group {
    switch (node.type) {
      case 'class':
        return createClassKonvaNode(node, isSelected);
      case 'actor':
        return createActorKonvaNode(node, isSelected);
      case 'use_case':
        return createUseCaseKonvaNode(node, isSelected);
      case 'boundary':
        return createBoundaryKonvaNode(node, isSelected);
      case 'control':
        return createControlKonvaNode(node, isSelected);
      case 'entity':
        return createEntityKonvaNode(node, isSelected);
      case 'lifeline':
        return createLifelineKonvaNode(node, isSelected);
      case 'deployment_node':
        return createDeploymentKonvaNode(node, isSelected);
      case 'component':
        return createComponentKonvaNode(node, isSelected);
      case 'package':
        return createPackageKonvaNode(node, isSelected);
      case 'package_layer':
        return createPackageLayerKonvaNode(node, isSelected);
      case 'note':
        return createNoteKonvaNode(node, isSelected);
      case 'activity_initial':
      case 'activity_final':
      case 'activity_action':
      case 'activity_decision':
      case 'activity_fork':
        return createActivityKonvaNode(node, isSelected);
      default:
        return createClassKonvaNode(node, isSelected);
    }
  }

  /**
   * Aplica dinámicamente el color personalizado a las figuras internas de un nodo Konva.
   *
   * @param group Grupo Konva que representa al nodo.
   * @param rawNode Modelo de datos del nodo.
   */
  applyLiveGroupColor(group: Konva.Group, rawNode: UmlClassNode): void {
    const color = rawNode.color;
    if (!color) return;

    const bgRect = group.findOne<Konva.Rect>('.bg-rect');
    if (bgRect && bgRect.fill() !== color) {
      bgRect.fill(color);
    }
    const ucEllipse = group.findOne<Konva.Ellipse>('.uc-ellipse');
    if (ucEllipse && ucEllipse.fill() !== color) {
      ucEllipse.fill(color);
    }
    const actorHead = group.findOne<Konva.Circle>('.actor-part');
    if (actorHead && actorHead.fill() !== color) {
      actorHead.fill(color);
    }
    const compBody = group.findOne<Konva.Rect>('.comp-part');
    if (compBody) {
      compBody.fill(color);
    }
    const pkgFolderParts = group.find<Konva.Rect>('.pkg-folder-part');
    pkgFolderParts.forEach((part) => {
      if (part.fill() !== color) part.fill(color);
    });
    const actParts = group.find<Konva.Shape>('.act-part');
    actParts.forEach((part) => {
      if (part instanceof Konva.Rect && part.cornerRadius() === 12) {
        part.fill(color);
      } else if (part instanceof Konva.Line && part.closed()) {
        part.fill(color);
      }
    });
    const lifelineBox = group.findOne<Konva.Rect>('.lifeline-part');
    if (lifelineBox && lifelineBox.fill() !== color) {
      lifelineBox.fill(color);
    }
    const deployBox = group.findOne<Konva.Rect>('.deploy-main');
    if (deployBox && deployBox.fill() !== color) {
      deployBox.fill(color);
    }
    const layerBg = group.findOne<Konva.Rect>('.layer-bg');
    if (layerBg && layerBg.fill() !== color) {
      layerBg.fill(color);
    }
    const notePart = group.findOne<Konva.Shape>('.note-part');
    if (notePart && (notePart as any).fill && (notePart as any).fill() !== color) {
      (notePart as any).fill(color);
    }
  }

  /**
   * Actualiza el trazo visual de selección sobre los nodos en pantalla.
   *
   * @param params Mapa de nodos, IDs seleccionados, nodo origen pendiente y capas Konva.
   */
  updateNodesSelectionAppearance(params: {
    nodeGroupsMap: Map<string, Konva.Group>;
    selectedNodeIds: Set<string>;
    pendingSourceNodeId: string | null;
    frameLayer?: Konva.Layer | null;
    nodeLayer?: Konva.Layer | null;
  }): void {
    const { nodeGroupsMap, selectedNodeIds, pendingSourceNodeId, frameLayer, nodeLayer } = params;

    for (const [id, group] of nodeGroupsMap.entries()) {
      const isSelected = selectedNodeIds.has(id) || id === pendingSourceNodeId;

      const bgRect = group.findOne<Konva.Rect>('.bg-rect');
      if (bgRect) {
        bgRect.stroke(isSelected ? '#059669' : '#78716C');
        bgRect.strokeWidth(isSelected ? 2 : 1.3);
      }

      const ellipse = group.findOne<Konva.Ellipse>('.uc-ellipse');
      if (ellipse) {
        ellipse.stroke(isSelected ? '#059669' : '#78716C');
        ellipse.strokeWidth(isSelected ? 2.2 : 1.6);
      }

      const hitRect = group.findOne<Konva.Rect>('.hit-rect');
      if (hitRect) {
        hitRect.stroke(isSelected ? '#10B981' : 'transparent');
        hitRect.strokeWidth(isSelected ? 1 : 0);
      }
    }
    frameLayer?.batchDraw();
    nodeLayer?.batchDraw();
  }

  /**
   * Conecta los controladores de eventos interactivos (arrastre individual, selección múltiple, contención, redimensión) a un grupo Konva.
   *
   * @param group Grupo Konva del nodo.
   * @param origNode Modelo original del nodo.
   * @param ctx Contexto con referencias al escenario, capas, señales y callbacks.
   */
  attachNodeInteractions(group: Konva.Group, origNode: UmlClassNode, ctx: NodeInteractionContext): void {
    const isLocked = ctx.isNodeLockedByOther(origNode.id);
    const canDrag = !ctx.isReadOnly() && !isLocked && ctx.selectedRelationType() === null;
    group.draggable(canDrag);

    group.on('mouseenter', (e: Konva.KonvaEventObject<MouseEvent>) => {
      ctx.setHoveredNodeId(origNode.id);
      if (!ctx.isReadOnly() && !ctx.isNodeLockedByOther(origNode.id)) {
        ctx.stage?.container().style.setProperty('cursor', ctx.selectedRelationType() ? 'crosshair' : 'move');
      }

      const mouseEvt = e.evt;
      if (mouseEvt && mouseEvt.buttons === 1 && !ctx.selectedRelationType()) {
        if (!this.isContainerNode(origNode) && !ctx.selectedNodeIdsInternal().includes(origNode.id)) {
          const updated = [...ctx.selectedNodeIdsInternal(), origNode.id];
          ctx.ngZone.run(() => {
            ctx.select(updated, []);
            ctx.callbacks.onSelectionChange({ nodeIds: updated, connectionIds: [] });
          });
        }
      }
    });

    group.on('mouseleave', () => {
      if (ctx.hoveredNodeId() === origNode.id) {
        ctx.setHoveredNodeId(null);
      }
      ctx.stage?.container().style.setProperty('cursor', 'default');
    });

    group.on('mousedown touchstart', (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;

      if (this.isContainerNode(origNode) && !ctx.selectedRelationType()) {
        const mouseEvt = e.evt;
        if (mouseEvt && (mouseEvt.button === 0 || mouseEvt.button === undefined)) {
          const pointer = ctx.stage?.getPointerPosition();
          if (pointer) {
            const transform = ctx.stage?.getAbsoluteTransform().copy().invert();
            const canvasPos = transform ? transform.point(pointer) : pointer;
            const nearConn = ctx.relationshipManager.findClosestRelationshipAtCanvasPoint({
              canvasX: Math.round(canvasPos.x),
              canvasY: Math.round(canvasPos.y),
              nodes: ctx.nodes(),
              connections: ctx.connections(),
              nodeGroupsMap: ctx.nodeGroupsMap,
              activeDiagramType: ctx.activeDiagramType(),
              sequenceActivationService: ctx.sequenceActivationService,
              maxDistancePx: 28,
            });
            if (nearConn) {
              ctx.ngZone.run(() => {
                ctx.select([], [nearConn.id]);
                ctx.callbacks.onConnectionClick(nearConn.id, mouseEvt);
              });
              return;
            }
          }
        }
      }

      const activeRelType = ctx.selectedRelationType();
      if (activeRelType) {
        const targetNode = this.resolveTargetNodeAtPointer(origNode, ctx.stage, ctx.nodes(), ctx.nodeGroupsMap);
        ctx.ngZone.run(() => {
          const pendingSrc = ctx.pendingSourceNodeId();
          if (!pendingSrc) {
            ctx.setPendingSourceNodeId(targetNode.id);
          } else if (pendingSrc !== targetNode.id) {
            const isSeq =
              ctx.activeDiagramType() === DiagramType.SEQUENCE ||
              isSequenceRelationshipType(activeRelType);
            if (isSeq) {
              const nextSlot = findNextAvailableSlot(ctx.connections());
              ctx.callbacks.onConnectionCreated({
                fOutputId: `${pendingSrc}_slot_${nextSlot}`,
                fInputId: `${targetNode.id}_slot_${nextSlot}`,
              });
            } else {
              ctx.callbacks.onConnectionCreated({
                fOutputId: pendingSrc,
                fInputId: targetNode.id,
              });
            }
            ctx.setPendingSourceNodeId(null);
            ctx.callbacks.onClearLivePreview();
          }
        });
        return;
      }

      const mouseEvt = e.evt;
      if (mouseEvt && (mouseEvt.button === 0 || mouseEvt.button === undefined)) {
        const isAlreadySelected = ctx.selectedNodeIdsInternal().includes(origNode.id);
        ctx.ngZone.run(() => {
          if (!isAlreadySelected) {
            if (mouseEvt.shiftKey || mouseEvt.ctrlKey) {
              const updated = [...ctx.selectedNodeIdsInternal(), origNode.id];
              ctx.select(updated, []);
              ctx.callbacks.onSelectionChange({ nodeIds: updated, connectionIds: [] });
            } else {
              ctx.select([origNode.id], []);
              ctx.callbacks.onSelectionChange({ nodeIds: [origNode.id], connectionIds: [] });
              ctx.callbacks.onNodeClick(origNode.id, mouseEvt);
            }
          } else {
            if (mouseEvt.shiftKey || mouseEvt.ctrlKey) {
              const updated = ctx.selectedNodeIdsInternal().filter((id) => id !== origNode.id);
              ctx.select(updated, []);
              ctx.callbacks.onSelectionChange({ nodeIds: updated, connectionIds: [] });
            }
          }
        });
      }
    });

    group.on('click tap', (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (ctx.selectedRelationType()) return;
      e.cancelBubble = true;

      const mouseEvt = e.evt;
      if (mouseEvt && !mouseEvt.shiftKey && !mouseEvt.ctrlKey && ctx.selectedNodeIdsInternal().length > 1) {
        ctx.ngZone.run(() => {
          ctx.select([origNode.id], []);
          ctx.callbacks.onSelectionChange({ nodeIds: [origNode.id], connectionIds: [] });
          ctx.callbacks.onNodeClick(origNode.id, mouseEvt);
        });
      } else {
        ctx.ngZone.run(() => {
          ctx.callbacks.onNodeClick(origNode.id, mouseEvt);
        });
      }
    });

    group.on('dblclick dbltap', (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      ctx.ngZone.run(() => {
        ctx.callbacks.onNodeDblClick(origNode, e.evt);
      });
    });

    group.on('contextmenu', (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.evt.preventDefault();
      e.cancelBubble = true;
      ctx.ngZone.run(() => {
        ctx.callbacks.onNodeContextMenu(origNode, e.evt);
      });
    });

    let dragStartPos = { x: Math.round(group.x()), y: Math.round(group.y()) };
    const siblingStartPositions = new Map<string, { x: number; y: number }>();

    group.on('dragstart', () => {
      ctx.callbacks.onDragStateChange(true);
      ctx.lastLocalMoveTimestamps.set(origNode.id, Date.now());

      if (this.isContainerNode(origNode)) {
        group.moveToBottom();
      } else {
        group.moveToTop();
      }
      this.enforceZOrdering(ctx.nodeLayer, ctx.frameLayer, ctx.nodeGroupsMap, ctx.nodes());

      dragStartPos = { x: Math.round(group.x()), y: Math.round(group.y()) };
      siblingStartPositions.clear();

      if (!ctx.selectedNodeIdsInternal().includes(origNode.id)) {
        ctx.select([origNode.id], []);
        ctx.callbacks.onSelectionChange({ nodeIds: [origNode.id], connectionIds: [] });
      }

      if (this.transformer) {
        this.transformer.nodes([]);
        ctx.uiLayer?.batchDraw();
      }

      for (const id of ctx.selectedNodeIdsInternal()) {
        const otherG = ctx.nodeGroupsMap.get(id);
        if (otherG) {
          siblingStartPositions.set(id, { x: Math.round(otherG.x()), y: Math.round(otherG.y()) });
        }
      }

      const currentNodes = ctx.nodes().map((n) => {
        const g = ctx.nodeGroupsMap.get(n.id);
        return {
          ...n,
          position: g ? { x: Math.round(g.x()), y: Math.round(g.y()) } : { ...n.position },
        };
      });

      const getW = (n: UmlClassNode) => ctx.nodeGroupsMap.get(n.id)?.width() || getNodeWidth(n);
      const getH = (n: UmlClassNode) => ctx.nodeGroupsMap.get(n.id)?.height() || getNodeHeight(n);

      const rootsToTrace = ctx.selectedNodeIdsInternal().length > 0 ? ctx.selectedNodeIdsInternal() : [origNode.id];
      const descendants = ctx.containmentService.collectDescendantsForRoots(
        rootsToTrace,
        currentNodes,
        getW,
        getH
      );

      for (const descId of descendants) {
        if (!siblingStartPositions.has(descId)) {
          const descG = ctx.nodeGroupsMap.get(descId);
          if (descG) {
            siblingStartPositions.set(descId, { x: Math.round(descG.x()), y: Math.round(descG.y()) });
          }
        }
      }
    });

    group.on('dragmove', () => {
      ctx.callbacks.onDragStateChange(true);
      ctx.lastLocalMoveTimestamps.set(origNode.id, Date.now());

      if (ctx.activeDiagramType() === DiagramType.SEQUENCE || origNode.nodeType === 'lifeline') {
        group.y(origNode.position ? origNode.position.y : 30);
      }

      let rawX = Math.max(10, Math.round(group.x()));
      let rawY = Math.max(10, Math.round(group.y()));

      if (ctx.smartGuidesEnabled()) {
        const ignoredIds = new Set<string>();
        ignoredIds.add(origNode.id);
        if (siblingStartPositions.size > 0) {
          for (const sId of siblingStartPositions.keys()) {
            ignoredIds.add(sId);
          }
        }
        const snapped = this.calculateAndDrawSmartGuides({
          draggedId: origNode.id,
          currentX: rawX,
          currentY: rawY,
          width: group.width() || getNodeWidth(origNode),
          height: group.height() || getNodeHeight(origNode) || 100,
          ignoredIds,
          nodes: ctx.nodes(),
          nodeGroupsMap: ctx.nodeGroupsMap,
          activeDiagramType: ctx.activeDiagramType(),
          uiLayer: ctx.uiLayer,
        });
        rawX = snapped.x;
        rawY = snapped.y;
      } else {
        this.clearSmartGuides(ctx.uiLayer);
      }

      const curX = rawX;
      const curY = rawY;
      group.x(curX);
      group.y(curY);
      const dx = curX - dragStartPos.x;
      const dy = curY - dragStartPos.y;

      const currentNode = ctx.nodes().find((n) => n.id === origNode.id) || origNode;
      currentNode.position = { x: curX, y: curY };
      origNode.position = { x: curX, y: curY };

      if (siblingStartPositions.size > 1 && siblingStartPositions.has(origNode.id)) {
        for (const [id, start] of siblingStartPositions.entries()) {
          if (id !== origNode.id) {
            const otherG = ctx.nodeGroupsMap.get(id);
            const otherNode = ctx.nodes().find((n) => n.id === id);
            if (otherG && otherNode) {
              const targetX = Math.max(10, Math.round(start.x + dx));
              const targetY =
                ctx.activeDiagramType() === DiagramType.SEQUENCE || otherNode.nodeType === 'lifeline'
                  ? (otherNode.position ? otherNode.position.y : 30)
                  : Math.max(10, Math.round(start.y + dy));
              otherG.position({ x: targetX, y: targetY });
              otherNode.position = { x: targetX, y: targetY };
              ctx.lastLocalMoveTimestamps.set(id, Date.now());
            }
          }
        }
        ctx.frameLayer?.batchDraw();
        ctx.nodeLayer?.batchDraw();
      }

      if (siblingStartPositions.size <= 1) {
        ctx.callbacks.onNodePositionChange({ node: currentNode, newPosition: { x: curX, y: curY } });
      }
      ctx.callbacks.onRenderRelationships();
    });

    group.on('dragend', () => {
      this.clearSmartGuides(ctx.uiLayer);
      ctx.lastLocalMoveTimestamps.set(origNode.id, Date.now());

      if (ctx.activeDiagramType() === DiagramType.SEQUENCE || origNode.nodeType === 'lifeline') {
        group.y(origNode.position ? origNode.position.y : 30);
      }
      const finalX = Math.max(10, Math.round(group.x()));
      const finalY = Math.max(10, Math.round(group.y()));
      group.x(finalX);
      group.y(finalY);
      const newPosition = { x: finalX, y: finalY };

      const currentNode = ctx.nodes().find((n) => n.id === origNode.id) || origNode;
      currentNode.position = newPosition;
      origNode.position = newPosition;

      if (siblingStartPositions.size > 1 && siblingStartPositions.has(origNode.id)) {
        const movedPayload: Array<{ id: string; position: { x: number; y: number } }> = [];
        for (const [id] of siblingStartPositions.entries()) {
          const otherG = ctx.nodeGroupsMap.get(id);
          const otherNode = ctx.nodes().find((n) => n.id === id) || (id === origNode.id ? origNode : null);
          if (otherG && otherNode) {
            const targetPos = {
              x: Math.max(10, Math.round(otherG.x())),
              y: Math.max(10, Math.round(otherG.y())),
            };
            otherG.position(targetPos);
            otherNode.position = targetPos;
            ctx.lastLocalMoveTimestamps.set(id, Date.now());
            movedPayload.push({ id, position: targetPos });
          }
        }

        ctx.ngZone.run(() => {
          ctx.callbacks.onMoveNodes({ nodes: movedPayload });
          this.syncTransformer({
            selectedNodeIds: ctx.selectedNodeIdsInternal(),
            nodeGroupsMap: ctx.nodeGroupsMap,
            isReadOnly: ctx.isReadOnly(),
            uiLayer: ctx.uiLayer,
          });
          this.enforceZOrdering(ctx.nodeLayer, ctx.frameLayer, ctx.nodeGroupsMap, ctx.nodes());
          setTimeout(() => {
            ctx.callbacks.onDragStateChange(false);
          }, 50);
        });
      } else {
        ctx.ngZone.run(() => {
          ctx.callbacks.onNodePositionChange({ node: currentNode, newPosition });
          this.syncTransformer({
            selectedNodeIds: ctx.selectedNodeIdsInternal(),
            nodeGroupsMap: ctx.nodeGroupsMap,
            isReadOnly: ctx.isReadOnly(),
            uiLayer: ctx.uiLayer,
          });
          this.enforceZOrdering(ctx.nodeLayer, ctx.frameLayer, ctx.nodeGroupsMap, ctx.nodes());
          setTimeout(() => {
            ctx.callbacks.onDragStateChange(false);
          }, 50);
        });
      }
      ctx.frameLayer?.batchDraw();
      ctx.nodeLayer?.batchDraw();
      ctx.callbacks.onRenderRelationships();
    });

    group.on('transformstart', () => {
      ctx.callbacks.onDragStateChange(true);
      ctx.lastLocalMoveTimestamps.set(origNode.id, Date.now());
    });

    group.on('transform', () => {
      ctx.lastLocalMoveTimestamps.set(origNode.id, Date.now());
      const sX = group.scaleX();
      const sY = group.scaleY();
      const nextW = Math.max(80, Math.round(group.width() * sX));
      const nextH = Math.max(50, Math.round(group.height() * sY));

      group.scaleX(1);
      group.scaleY(1);

      this.applyFluidNodeResize(
        group,
        toKonvaNode(
          origNode,
          ctx.activeDiagramType(),
          ctx.connections(),
          ctx.sequenceActivationService
        ),
        nextW,
        nextH
      );

      const actualW = Math.round(group.width());
      const actualH = Math.round(group.height());

      const currentNode = ctx.nodes().find((n) => n.id === origNode.id) || origNode;
      currentNode.width = actualW;
      currentNode.height = actualH;
      currentNode.customWidth = actualW;
      currentNode.customHeight = actualH;
      currentNode.isCustomSize = true;
      currentNode.position = { x: Math.round(group.x()), y: Math.round(group.y()) };

      origNode.width = actualW;
      origNode.height = actualH;
      origNode.customWidth = actualW;
      origNode.customHeight = actualH;
      origNode.isCustomSize = true;
      origNode.position = { x: Math.round(group.x()), y: Math.round(group.y()) };

      ctx.nodeLayer?.batchDraw();
      ctx.frameLayer?.batchDraw();
      ctx.callbacks.onRenderRelationships();
    });

    group.on('transformend', () => {
      ctx.lastLocalMoveTimestamps.set(origNode.id, Date.now());
      const width = Math.round(group.width());
      const height = Math.round(group.height());
      const position = { x: Math.round(group.x()), y: Math.round(group.y()) };

      const currentNode = ctx.nodes().find((n) => n.id === origNode.id) || origNode;
      currentNode.width = width;
      currentNode.height = height;
      currentNode.customWidth = width;
      currentNode.customHeight = height;
      currentNode.isCustomSize = true;
      currentNode.position = position;

      origNode.width = width;
      origNode.height = height;
      origNode.customWidth = width;
      origNode.customHeight = height;
      origNode.isCustomSize = true;
      origNode.position = position;

      ctx.ngZone.run(() => {
        ctx.callbacks.onNodeSizeChange({ node: currentNode, width, height, position });
        this.syncTransformer({
          selectedNodeIds: ctx.selectedNodeIdsInternal(),
          nodeGroupsMap: ctx.nodeGroupsMap,
          isReadOnly: ctx.isReadOnly(),
          uiLayer: ctx.uiLayer,
        });
        this.enforceZOrdering(ctx.nodeLayer, ctx.frameLayer, ctx.nodeGroupsMap, ctx.nodes());
        setTimeout(() => {
          ctx.callbacks.onDragStateChange(false);
        }, 50);
      });
    });
  }

  /**
   * Conecta los controladores de eventos globales del escenario Konva (selección por recuadro marquee, clics magnéticos y menú contextual).
   *
   * @param ctx Contexto del escenario con referencias y callbacks correspondientes.
   * @returns Función de limpieza para desvincular observadores de ventana.
   */
  bindStageEvents(ctx: StageEventsContext): () => void {
    if (!ctx.stage) return () => {};

    ctx.stage.on('mousedown touchstart', (e: Konva.KonvaEventObject<MouseEvent>) => {
      const isTargetStage = e.target === ctx.stage || e.target === ctx.bgRect;

      if (isTargetStage) {
        const pointer = ctx.stage?.getPointerPosition() || { x: 0, y: 0 };
        const transform = ctx.stage?.getAbsoluteTransform().copy().invert();
        const canvasPos = transform ? transform.point(pointer) : pointer;
        const canvasX = Math.round(canvasPos.x);
        const canvasY = Math.round(canvasPos.y);

        const nearConn = ctx.relationshipManager.findClosestRelationshipAtCanvasPoint({
          canvasX,
          canvasY,
          nodes: ctx.nodes(),
          connections: ctx.connections(),
          nodeGroupsMap: ctx.nodeGroupsMap,
          activeDiagramType: ctx.activeDiagramType(),
          sequenceActivationService: ctx.sequenceActivationService,
          maxDistancePx: 28,
        });
        if (nearConn) {
          ctx.ngZone.run(() => {
            ctx.callbacks.onSelect([], [nearConn.id]);
            ctx.callbacks.onConnectionClick(nearConn.id, e.evt);
          });
          return;
        }

        const mouseEvt = e.evt;
        const isLeftClick = mouseEvt.button === 0 || mouseEvt.button === undefined;

        if (isLeftClick && !ctx.selectedRelationType() && !ctx.isReadOnly()) {
          this.isMarqueeSelecting = true;
          this.marqueeStartPos = { x: canvasX, y: canvasY };
          if (this.marqueeRect) {
            this.marqueeRect.position({ x: canvasX, y: canvasY });
            this.marqueeRect.size({ width: 0, height: 0 });
            this.marqueeRect.visible(false);
          }
          if (!mouseEvt.shiftKey && !mouseEvt.ctrlKey) {
            ctx.ngZone.run(() => {
              ctx.callbacks.onClearSelection();
            });
          }
        }

        ctx.ngZone.run(() => {
          ctx.setPendingSourceNodeId(null);
          ctx.callbacks.onClearLivePreview();
          if (!this.isMarqueeSelecting) {
            ctx.callbacks.onClearSelection();
          }
          ctx.callbacks.onCanvasBackgroundClick(e.evt);
          ctx.callbacks.onCanvasMouseDown(e.evt);
        });
      }
    });

    ctx.stage.on('dblclick dbltap', (e: Konva.KonvaEventObject<MouseEvent>) => {
      const isTargetStage = e.target === ctx.stage || e.target === ctx.bgRect;
      if (isTargetStage) {
        const pointer = ctx.stage?.getPointerPosition() || { x: 0, y: 0 };
        const transform = ctx.stage?.getAbsoluteTransform().copy().invert();
        const canvasPos = transform ? transform.point(pointer) : pointer;
        const canvasX = Math.round(canvasPos.x);
        const canvasY = Math.round(canvasPos.y);

        const nearConn = ctx.relationshipManager.findClosestRelationshipAtCanvasPoint({
          canvasX,
          canvasY,
          nodes: ctx.nodes(),
          connections: ctx.connections(),
          nodeGroupsMap: ctx.nodeGroupsMap,
          activeDiagramType: ctx.activeDiagramType(),
          sequenceActivationService: ctx.sequenceActivationService,
          maxDistancePx: 28,
        });
        if (nearConn) {
          ctx.ngZone.run(() => {
            ctx.callbacks.onConnectionDblClick(nearConn, e.evt);
          });
        }
      }
    });

    ctx.stage.on('contextmenu', (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.evt.preventDefault();
      const isTargetStage = e.target === ctx.stage || e.target === ctx.bgRect;
      if (isTargetStage) {
        const pointer = ctx.stage?.getPointerPosition() || { x: 0, y: 0 };
        const transform = ctx.stage?.getAbsoluteTransform().copy().invert();
        const canvasPos = transform ? transform.point(pointer) : pointer;
        const canvasX = Math.round(canvasPos.x);
        const canvasY = Math.round(canvasPos.y);

        const nearConn = ctx.relationshipManager.findClosestRelationshipAtCanvasPoint({
          canvasX,
          canvasY,
          nodes: ctx.nodes(),
          connections: ctx.connections(),
          nodeGroupsMap: ctx.nodeGroupsMap,
          activeDiagramType: ctx.activeDiagramType(),
          sequenceActivationService: ctx.sequenceActivationService,
          maxDistancePx: 28,
        });
        if (nearConn) {
          ctx.ngZone.run(() => {
            ctx.callbacks.onSelect([], [nearConn.id]);
            ctx.callbacks.onConnectionContextMenu(nearConn, e.evt);
          });
          return;
        }

        ctx.ngZone.run(() => {
          ctx.callbacks.onCanvasContextMenu({
            event: e.evt,
            canvasPos: { x: Math.round(canvasPos.x), y: Math.round(canvasPos.y) },
          });
        });
      }
    });

    ctx.stage.on('mousemove touchmove', (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!ctx.stage) return;

      const pointer = ctx.stage.getPointerPosition() || { x: 0, y: 0 };
      const transform = ctx.stage.getAbsoluteTransform().copy().invert();
      const canvasPos = transform ? transform.point(pointer) : pointer;
      const canvasX = Math.round(canvasPos.x);
      const canvasY = Math.round(canvasPos.y);

      if (this.isMarqueeSelecting && this.marqueeRect) {
        const x = Math.min(this.marqueeStartPos.x, canvasX);
        const y = Math.min(this.marqueeStartPos.y, canvasY);
        const w = Math.abs(canvasX - this.marqueeStartPos.x);
        const h = Math.abs(canvasY - this.marqueeStartPos.y);

        this.marqueeRect.position({ x, y });
        this.marqueeRect.size({ width: w, height: h });
        this.marqueeRect.visible(w > 3 || h > 3);

        const intersectingIds: string[] = [];
        for (const [id, group] of ctx.nodeGroupsMap.entries()) {
          const gx = group.x();
          const gy = group.y();
          const gw = group.width() || 180;
          const gh = group.height() || 100;

          if (gx < x + w && gx + gw > x && gy < y + h && gy + gh > y) {
            intersectingIds.push(id);
          }
        }

        ctx.ngZone.run(() => {
          ctx.callbacks.onSelect(intersectingIds, []);
          ctx.callbacks.onSelectionChange({ nodeIds: intersectingIds, connectionIds: [] });
        });
        ctx.uiLayer?.batchDraw();
      }

      const pendingSrcId = ctx.pendingSourceNodeId();
      if (pendingSrcId) {
        ctx.callbacks.onLivePreview(pendingSrcId, canvasPos.x, canvasPos.y);
      } else if (!ctx.isDraggingNode() && !this.isMarqueeSelecting) {
        const isOverNode = e.target?.getLayer() === ctx.nodeLayer;
        if (!isOverNode && !ctx.selectedRelationType()) {
          const nearConn = ctx.relationshipManager.findClosestRelationshipAtCanvasPoint({
            canvasX,
            canvasY,
            nodes: ctx.nodes(),
            connections: ctx.connections(),
            nodeGroupsMap: ctx.nodeGroupsMap,
            activeDiagramType: ctx.activeDiagramType(),
            sequenceActivationService: ctx.sequenceActivationService,
            maxDistancePx: 28,
          });
          ctx.relationshipManager.setHoveredRelationship(nearConn?.id ?? null, new Set(ctx.selectedConnIds()), ctx.relLayer);
          if (ctx.stage.container()) {
            ctx.stage.container().style.cursor = nearConn ? 'pointer' : 'default';
          }
        } else {
          ctx.relationshipManager.setHoveredRelationship(null, new Set(ctx.selectedConnIds()), ctx.relLayer);
          if (ctx.stage.container()) {
            ctx.stage.container().style.cursor = 'default';
          }
        }
      }

      ctx.callbacks.onCanvasMouseMove(e.evt);
    });

    const finishMarquee = () => {
      if (this.isMarqueeSelecting) {
        this.isMarqueeSelecting = false;
        if (this.marqueeRect) {
          this.marqueeRect.visible(false);
          ctx.uiLayer?.batchDraw();
        }
      }
    };
    ctx.stage.on('mouseup touchend', finishMarquee);
    this.onWindowMouseUpHandler = finishMarquee;
    if (typeof window !== 'undefined') {
      window.addEventListener('mouseup', finishMarquee);
    }

    return () => {
      if (this.onWindowMouseUpHandler && typeof window !== 'undefined') {
        window.removeEventListener('mouseup', this.onWindowMouseUpHandler);
        this.onWindowMouseUpHandler = undefined;
      }
    };
  }

  /**
   * Reconstruye y renderiza todo el conjunto de nodos dentro de las capas frameLayer y nodeLayer.
   *
   * @param params Configuración completa con capas, nodos, selección y callbacks.
   */
  renderFullDiagram(params: {
    frameLayer: Konva.Layer | null;
    nodeLayer: Konva.Layer | null;
    uiLayer: Konva.Layer | null;
    nodeGroupsMap: Map<string, Konva.Group>;
    nodes: UmlClassNode[];
    connections: UmlConnection[];
    selectedNodeIds: string[];
    selectedNodeIdsInternal: string[];
    pendingSourceNodeId: string | null;
    activeDiagramType: DiagramType;
    sequenceActivationService: DiagramSequenceActivationService;
    isReadOnly: boolean;
    nodeInteractionContext: NodeInteractionContext;
  }): void {
    const {
      frameLayer,
      nodeLayer,
      uiLayer,
      nodeGroupsMap,
      nodes,
      connections,
      selectedNodeIds,
      selectedNodeIdsInternal,
      pendingSourceNodeId,
      activeDiagramType,
      sequenceActivationService,
      isReadOnly,
      nodeInteractionContext,
    } = params;

    if (!nodeLayer || !frameLayer) return;

    frameLayer.destroyChildren();
    nodeLayer.destroyChildren();
    nodeGroupsMap.clear();

    const currentNodes = nodes.filter((n) => !n.isAnchor);
    currentNodes.sort((a, b) => this.getNodeZWeight(a) - this.getNodeZWeight(b));

    const selectedIds = new Set([...selectedNodeIds, ...selectedNodeIdsInternal]);

    for (const rawNode of currentNodes) {
      const isSelected = selectedIds.has(rawNode.id) || rawNode.id === pendingSourceNodeId;
      const kNode = toKonvaNode(rawNode, activeDiagramType, connections, sequenceActivationService);
      const group = this.buildNodeGroup(kNode, isSelected);

      this.attachNodeInteractions(group, rawNode, nodeInteractionContext);
      nodeGroupsMap.set(rawNode.id, group);

      if (this.isContainerNode(rawNode)) {
        frameLayer.add(group);
      } else {
        nodeLayer.add(group);
      }
    }

    this.enforceZOrdering(nodeLayer, frameLayer, nodeGroupsMap, nodes);
    this.syncTransformer({
      selectedNodeIds: [...selectedNodeIds, ...selectedNodeIdsInternal],
      nodeGroupsMap,
      isReadOnly,
      uiLayer,
    });
    frameLayer.batchDraw();
    nodeLayer.batchDraw();
    uiLayer?.batchDraw();
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
   * Libera referencias a componentes interactivos y observadores.
   */
  destroy(): void {
    if (this.onWindowMouseUpHandler && typeof window !== 'undefined') {
      window.removeEventListener('mouseup', this.onWindowMouseUpHandler);
      this.onWindowMouseUpHandler = undefined;
    }
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
