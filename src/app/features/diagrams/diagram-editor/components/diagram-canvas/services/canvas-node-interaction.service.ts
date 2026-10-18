import { Injectable, NgZone, inject } from '@angular/core';
import Konva from 'konva';
import {
  DiagramType,
  UmlClassNode,
  UmlConnection,
  UmlRelationshipType,
} from '../../../../../../core/models/diagram.model';
import { getNodeHeight, getNodeWidth } from '../../../utils/node-metrics.util';
import { toKonvaNode } from '../konva/konva-adapter.util';
import {
  isSequenceRelationshipType,
  findNextAvailableSlot,
} from '../nodes/uml-lifeline-node/uml-lifeline.logic';
import { DiagramContainmentService } from '../../../services/diagram-containment.service';
import { DiagramSequenceActivationService } from '../../../services/diagram-sequence-activation.service';
import { CanvasRelationshipManagerService } from './canvas-relationship-manager.service';
import { CanvasSmartGuidesService, SmartGuidesParams } from './canvas-smart-guides.service';
import { CanvasNodeRenderingService } from './canvas-node-rendering.service';
import {
  CanvasStageEventsService,
  StageEventsCallbacks,
  StageEventsContext,
} from './canvas-stage-events.service';

export type { StageEventsCallbacks, StageEventsContext };

/**
 * Callbacks emitidos por los controladores interactivos de nodos individuales.
 */
export interface NodeInteractionCallbacks {
  onNodeClick: (nodeId: string, event: MouseEvent) => void;
  onNodeDblClick: (node: UmlClassNode, event: MouseEvent) => void;
  onNodeContextMenu: (node: UmlClassNode, event: MouseEvent) => void;
  onConnectionClick: (connId: string, event: MouseEvent) => void;
  onConnectionCreated: (event: { fOutputId: string; fInputId: string }) => void;
  onNodePositionChange: (event: {
    node: UmlClassNode;
    newPosition: { x: number; y: number };
  }) => void;
  onNodeSizeChange: (event: {
    node: UmlClassNode;
    width: number;
    height?: number;
    position: { x: number; y: number };
  }) => void;
  onMoveNodes: (event: {
    nodes: Array<{ id: string; position: { x: number; y: number } }>;
  }) => void;
  onSelectionChange: (event: { nodeIds: string[]; connectionIds: string[] }) => void;
  onRenderRelationships: () => void;
  onClearLivePreview: () => void;
  onDragStateChange: (isDragging: boolean) => void;
}

/**
 * Contexto operativo para conectar eventos e interactividad sobre los nodos Konva.
 */
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

/**
 * Servicio encargado de la manipulación interactiva de nodos UML en Konva:
 * transformador de redimensión (Konva.Transformer), controladores de arrastre y eventos del escenario.
 */
@Injectable({
  providedIn: 'root',
})
export class CanvasNodeInteractionService {
  readonly smartGuides: CanvasSmartGuidesService;
  readonly nodeRendering: CanvasNodeRenderingService;
  readonly stageEvents: CanvasStageEventsService;

  private transformer: Konva.Transformer | null = null;

  constructor() {
    let sg: CanvasSmartGuidesService | null = null;
    let nr: CanvasNodeRenderingService | null = null;
    let se: CanvasStageEventsService | null = null;
    try {
      sg = inject(CanvasSmartGuidesService, { optional: true });
      nr = inject(CanvasNodeRenderingService, { optional: true });
      se = inject(CanvasStageEventsService, { optional: true });
    } catch (_) {}
    this.smartGuides = sg ?? new CanvasSmartGuidesService();
    this.nodeRendering = nr ?? new CanvasNodeRenderingService();
    this.stageEvents = se ?? new CanvasStageEventsService();
  }

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
    const guideLinesGroup = this.smartGuides.initGuideLinesGroup(uiLayer);
    const marqueeRect = this.stageEvents.initMarqueeRect(uiLayer);

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

    return {
      guideLinesGroup,
      transformer: this.transformer,
      marqueeRect,
    };
  }

  /**
   * Limpia las líneas magnéticas visibles en pantalla.
   *
   * @param uiLayer Capa UI de Konva.
   * @param guideLinesGroup Grupo opcional de líneas guía.
   */
  clearSmartGuides(uiLayer?: Konva.Layer | null, guideLinesGroup?: Konva.Group | null): void {
    this.smartGuides.clearSmartGuides(uiLayer, guideLinesGroup);
  }

  /**
   * Calcula el snap magnético con los nodos vecinos (umbral 8px) y dibuja las líneas guía visuales.
   *
   * @param params Coordenadas del nodo arrastrado, dimensiones, nodos de referencia y grupos Konva.
   * @returns Coordenadas finales { x, y } con ajuste magnético si hubo alineación.
   */
  calculateAndDrawSmartGuides(params: SmartGuidesParams): { x: number; y: number } {
    return this.smartGuides.calculateAndDrawSmartGuides(params);
  }

  /**
   * Obtiene el `Konva.Transformer` activo (usado, p. ej., para ocultarlo durante la exportación).
   *
   * @returns El transformer o `null` si la capa UI aún no fue inicializada.
   */
  getTransformer(): Konva.Transformer | null {
    return this.transformer;
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
   * Conecta los controladores de eventos interactivos (ratón, arrastre coordinado y redimensión fluida) a un grupo Konva.
   *
   * @param group Grupo Konva del nodo.
   * @param origNode Modelo original del nodo.
   * @param ctx Contexto con referencias al escenario, capas, señales y callbacks.
   */
  attachNodeInteractions(
    group: Konva.Group,
    origNode: UmlClassNode,
    ctx: NodeInteractionContext,
  ): void {
    const isLocked = ctx.isNodeLockedByOther(origNode.id);
    const canDrag = !ctx.isReadOnly() && !isLocked && ctx.selectedRelationType() === null;
    group.draggable(canDrag);

    this.bindNodeMouseEvents(group, origNode, ctx);
    this.bindNodeDragEvents(group, origNode, ctx);
    this.bindNodeTransformEvents(group, origNode, ctx);
  }

  /**
   * Enlaza eventos de puntero (hover, selección, clics y menú contextual) sobre el nodo.
   *
   * @param group Grupo Konva del nodo.
   * @param origNode Modelo del nodo.
   * @param ctx Contexto de interacción.
   */
  private bindNodeMouseEvents(
    group: Konva.Group,
    origNode: UmlClassNode,
    ctx: NodeInteractionContext,
  ): void {
    group.on('mouseenter', (e: Konva.KonvaEventObject<MouseEvent>) => {
      ctx.setHoveredNodeId(origNode.id);
      if (!ctx.isReadOnly() && !ctx.isNodeLockedByOther(origNode.id)) {
        ctx.stage
          ?.container()
          .style.setProperty('cursor', ctx.selectedRelationType() ? 'crosshair' : 'move');
      }

      const mouseEvt = e.evt;
      if (mouseEvt && mouseEvt.buttons === 1 && !ctx.selectedRelationType()) {
        if (
          !this.nodeRendering.isContainerNode(origNode) &&
          !ctx.selectedNodeIdsInternal().includes(origNode.id)
        ) {
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

      if (this.nodeRendering.isContainerNode(origNode) && !ctx.selectedRelationType()) {
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
        const targetNode = this.nodeRendering.resolveTargetNodeAtPointer(
          origNode,
          ctx.stage,
          ctx.nodes(),
          ctx.nodeGroupsMap,
        );
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
      if (
        mouseEvt &&
        !mouseEvt.shiftKey &&
        !mouseEvt.ctrlKey &&
        ctx.selectedNodeIdsInternal().length > 1
      ) {
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
  }

  /**
   * Enlaza eventos de arrastre coordinado, guías inteligentes y ajuste magnético sobre el nodo.
   *
   * @param group Grupo Konva del nodo.
   * @param origNode Modelo del nodo.
   * @param ctx Contexto de interacción.
   */
  private bindNodeDragEvents(
    group: Konva.Group,
    origNode: UmlClassNode,
    ctx: NodeInteractionContext,
  ): void {
    let dragStartPos = { x: Math.round(group.x()), y: Math.round(group.y()) };
    const siblingStartPositions = new Map<string, { x: number; y: number }>();

    group.on('dragstart', () => {
      ctx.callbacks.onDragStateChange(true);
      ctx.lastLocalMoveTimestamps.set(origNode.id, Date.now());

      if (this.nodeRendering.isContainerNode(origNode)) {
        group.moveToBottom();
      } else {
        group.moveToTop();
      }
      this.nodeRendering.enforceZOrdering(
        ctx.nodeLayer,
        ctx.frameLayer,
        ctx.nodeGroupsMap,
        ctx.nodes(),
      );

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

      const rootsToTrace =
        ctx.selectedNodeIdsInternal().length > 0 ? ctx.selectedNodeIdsInternal() : [origNode.id];
      const descendants = ctx.containmentService.collectDescendantsForRoots(
        rootsToTrace,
        currentNodes,
        getW,
        getH,
      );

      for (const descId of descendants) {
        if (!siblingStartPositions.has(descId)) {
          const descG = ctx.nodeGroupsMap.get(descId);
          if (descG) {
            siblingStartPositions.set(descId, {
              x: Math.round(descG.x()),
              y: Math.round(descG.y()),
            });
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
                ctx.activeDiagramType() === DiagramType.SEQUENCE ||
                otherNode.nodeType === 'lifeline'
                  ? otherNode.position
                    ? otherNode.position.y
                    : 30
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
        ctx.callbacks.onNodePositionChange({
          node: currentNode,
          newPosition: { x: curX, y: curY },
        });
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
          const otherNode =
            ctx.nodes().find((n) => n.id === id) || (id === origNode.id ? origNode : null);
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
          this.nodeRendering.enforceZOrdering(
            ctx.nodeLayer,
            ctx.frameLayer,
            ctx.nodeGroupsMap,
            ctx.nodes(),
          );
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
          this.nodeRendering.enforceZOrdering(
            ctx.nodeLayer,
            ctx.frameLayer,
            ctx.nodeGroupsMap,
            ctx.nodes(),
          );
          setTimeout(() => {
            ctx.callbacks.onDragStateChange(false);
          }, 50);
        });
      }
      ctx.frameLayer?.batchDraw();
      ctx.nodeLayer?.batchDraw();
      ctx.callbacks.onRenderRelationships();
    });
  }

  /**
   * Enlaza eventos de redimensión fluida (transformstart, transform y transformend) sobre el nodo.
   *
   * @param group Grupo Konva del nodo.
   * @param origNode Modelo del nodo.
   * @param ctx Contexto de interacción.
   */
  private bindNodeTransformEvents(
    group: Konva.Group,
    origNode: UmlClassNode,
    ctx: NodeInteractionContext,
  ): void {
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

      this.nodeRendering.applyFluidNodeResize(
        group,
        toKonvaNode(
          origNode,
          ctx.activeDiagramType(),
          ctx.connections(),
          ctx.sequenceActivationService,
        ),
        nextW,
        nextH,
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
        this.nodeRendering.enforceZOrdering(
          ctx.nodeLayer,
          ctx.frameLayer,
          ctx.nodeGroupsMap,
          ctx.nodes(),
        );
        setTimeout(() => {
          ctx.callbacks.onDragStateChange(false);
        }, 50);
      });
    });
  }

  /**
   * Conecta los controladores de eventos globales del escenario Konva delegando en CanvasStageEventsService.
   *
   * @param ctx Contexto del escenario con referencias y callbacks correspondientes.
   * @returns Función de limpieza para desvincular observadores de ventana.
   */
  bindStageEvents(ctx: StageEventsContext): () => void {
    return this.stageEvents.bindStageEvents(ctx);
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
    currentNodes.sort(
      (a, b) => this.nodeRendering.getNodeZWeight(a) - this.nodeRendering.getNodeZWeight(b),
    );

    const selectedIds = new Set([...selectedNodeIds, ...selectedNodeIdsInternal]);

    for (const rawNode of currentNodes) {
      const isSelected = selectedIds.has(rawNode.id) || rawNode.id === pendingSourceNodeId;
      const kNode = toKonvaNode(rawNode, activeDiagramType, connections, sequenceActivationService);
      const group = this.nodeRendering.buildNodeGroup(kNode, isSelected);

      this.attachNodeInteractions(group, rawNode, nodeInteractionContext);
      nodeGroupsMap.set(rawNode.id, group);

      if (this.nodeRendering.isContainerNode(rawNode)) {
        frameLayer.add(group);
      } else {
        nodeLayer.add(group);
      }
    }

    this.nodeRendering.enforceZOrdering(nodeLayer, frameLayer, nodeGroupsMap, nodes);
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
   * Sincroniza rápidamente posiciones y colores de nodos evitando recreación de DOM virtual.
   *
   * @param nodes Lista actual de nodos.
   * @param nodeGroupsMap Mapa de grupos Konva por ID.
   * @param lastLocalMoveTimestamps Registro de marcas temporales de movimiento local.
   */
  syncNodePositionsAndColors(
    nodes: UmlClassNode[],
    nodeGroupsMap: Map<string, Konva.Group>,
    lastLocalMoveTimestamps: Map<string, number>,
  ): void {
    const now = Date.now();
    // Poda marcas obsoletas (nodos eliminados o movimientos fuera de la ventana de supresión)
    // para que el mapa no crezca indefinidamente durante sesiones largas.
    for (const [id, ts] of lastLocalMoveTimestamps) {
      if (!nodeGroupsMap.has(id) || now - ts > 5000) lastLocalMoveTimestamps.delete(id);
    }
    for (const rawNode of nodes) {
      const group = nodeGroupsMap.get(rawNode.id);
      if (!group) continue;

      const lastMove = lastLocalMoveTimestamps.get(rawNode.id) || 0;
      if (group.isDragging() || now - lastMove < 400) {
        rawNode.position = { x: Math.round(group.x()), y: Math.round(group.y()) };
        continue;
      }

      if (
        Math.round(group.x()) !== rawNode.position.x ||
        Math.round(group.y()) !== rawNode.position.y
      ) {
        group.position({ x: rawNode.position.x, y: rawNode.position.y });
      }
      this.nodeRendering.applyLiveGroupColor(group, rawNode);
    }
  }

  /**
   * Actualiza el color de cabecera y borde de un grupo Konva sin reconstruir el árbol de nodos.
   *
   * @param group Grupo Konva a recolorear.
   * @param node Modelo de nodo con el color actualizado.
   */
  applyLiveGroupColor(group: Konva.Group, node: UmlClassNode): void {
    this.nodeRendering.applyLiveGroupColor(group, node);
  }

  /**
   * Actualiza la apariencia visual de selección en los nodos registrados.
   *
   * @param params Configuración con el mapa de grupos, identificadores seleccionados y capas.
   */
  updateNodesSelectionAppearance(params: {
    nodeGroupsMap: Map<string, Konva.Group>;
    selectedNodeIds: Set<string>;
    pendingSourceNodeId: string | null;
    frameLayer: Konva.Layer | null;
    nodeLayer: Konva.Layer | null;
  }): void {
    this.nodeRendering.updateNodesSelectionAppearance(params);
  }

  /**
   * Libera referencias a componentes interactivos y observadores.
   */
  destroy(): void {
    this.stageEvents.destroy();
    this.smartGuides.destroy();
    if (this.transformer) {
      this.transformer.destroy();
      this.transformer = null;
    }
  }
}
