import { DiagramType } from '../../../../../core/models/diagram.model';
import { NodeInteractionContext, StageEventsContext } from './services';
import type { DiagramCanvasComponent } from './diagram-canvas.component';
import type { CanvasTransformAdapter } from './diagram-canvas.types';

/**
 * Construye el objeto de compatibilidad `canvas` que expone la API de transformación de coordenadas.
 *
 * @param canvas Instancia del componente DiagramCanvasComponent.
 * @returns Objeto simulador con escala, reseteo y redibujado.
 */
export function createCanvasTransformAdapter(
  canvas: DiagramCanvasComponent,
): CanvasTransformAdapter {
  return {
    get transform() {
      return {
        get scale() {
          const z = canvas.zoomLevel();
          return z ? z / 100 : canvas.getStage() ? canvas.getStage()!.scaleX() : 1;
        },
        set scale(s: number) {
          canvas.setZoom(Math.round(s * 100), false);
        },
        get position() {
          return { x: 0, y: 0 };
        },
        set position(_pos: { x: number; y: number }) {
          // El escenario Konva permanece fijado en el origen (0, 0)
        },
        scaledPosition: { x: 0, y: 0 },
      };
    },
    resetScale: () => canvas.resetView(),
    setScale: (scale: number) => {
      canvas.setZoom(Math.round(scale * 100), false);
    },
    redraw: () => canvas.redraw(),
  };
}

/**
 * Construye el contexto de interacción necesario para conectar eventos sobre los nodos Konva.
 *
 * @param canvas Instancia del componente DiagramCanvasComponent.
 * @returns Contexto NodeInteractionContext configurado.
 */
export function buildNodeInteractionContext(
  canvas: DiagramCanvasComponent,
): NodeInteractionContext {
  return {
    stage: canvas.getStage(),
    nodeLayer: canvas.getNodeLayer(),
    frameLayer: canvas.getFrameLayer(),
    uiLayer: canvas.getUiLayer(),
    nodeGroupsMap: canvas.getNodeGroupsMap(),
    nodes: () => canvas.nodes(),
    connections: () => canvas.connections(),
    activeDiagramType: () => canvas.activeDiagramType(),
    selectedRelationType: () => canvas.selectedRelationType(),
    pendingSourceNodeId: () => canvas.pendingSourceNodeId(),
    setPendingSourceNodeId: (id) => canvas.pendingSourceNodeId.set(id),
    hoveredNodeId: () => canvas.hoveredNodeId(),
    setHoveredNodeId: (id) => canvas.hoveredNodeId.set(id),
    selectedNodeIdsInternal: () => canvas.getSelectedNodeIdsInternal(),
    select: (nodeIds, connIds) => canvas.select(nodeIds, connIds),
    isReadOnly: () => canvas.isReadOnly(),
    smartGuidesEnabled: () => canvas.smartGuidesEnabled(),
    isNodeLockedByOther: (nodeId) => canvas.isNodeLockedByOther(nodeId),
    containmentService: canvas.getContainmentService(),
    relationshipManager: canvas.getRelationshipManager(),
    sequenceActivationService: canvas.getSequenceActivationService(),
    ngZone: canvas.getNgZone(),
    lastLocalMoveTimestamps: canvas.getLastLocalMoveTimestamps(),
    callbacks: {
      onNodeClick: (nodeId, event) => canvas.nodeClick.emit({ nodeId, event }),
      onNodeDblClick: (node, event) => canvas.nodeDblClick.emit({ node, event }),
      onNodeContextMenu: (node, event) => canvas.nodeContextMenu.emit({ node, event }),
      onConnectionClick: (connId, event) => canvas.connectionClick.emit({ connId, event }),
      onConnectionCreated: (event) => canvas.connectionCreated.emit(event),
      onNodePositionChange: (event) => canvas.nodePositionChange.emit(event),
      onNodeSizeChange: (event) => canvas.nodeSizeChange.emit(event),
      onMoveNodes: (event) => canvas.moveNodes.emit(event),
      onSelectionChange: (event) => canvas.selectionChange.emit(event),
      onRenderRelationships: () => canvas.renderRelationshipsOnly(),
      onClearLivePreview: () => canvas.clearLivePreviewLine(),
      onDragStateChange: (isDragging) => {
        canvas.setIsDraggingNode(isDragging);
      },
    },
  };
}

/**
 * Construye el contexto de eventos globales del escenario Konva.
 *
 * @param canvas Instancia del componente DiagramCanvasComponent.
 * @returns Contexto StageEventsContext configurado.
 */
export function buildStageEventsContext(canvas: DiagramCanvasComponent): StageEventsContext {
  return {
    stage: canvas.getStage(),
    bgRect: canvas.getBgRect(),
    uiLayer: canvas.getUiLayer(),
    nodeLayer: canvas.getNodeLayer(),
    relLayer: canvas.getRelLayer(),
    nodeGroupsMap: canvas.getNodeGroupsMap(),
    nodes: () => canvas.nodes(),
    connections: () => canvas.connections(),
    activeDiagramType: () => canvas.activeDiagramType(),
    selectedRelationType: () => canvas.selectedRelationType(),
    pendingSourceNodeId: () => canvas.pendingSourceNodeId(),
    setPendingSourceNodeId: (id) => canvas.pendingSourceNodeId.set(id),
    isReadOnly: () => canvas.isReadOnly(),
    isDraggingNode: () => canvas.getIsDraggingNode(),
    selectedConnIds: () => [...canvas.selectedConnIds(), ...canvas.getSelectedConnIdsInternal()],
    sequenceActivationService: canvas.getSequenceActivationService(),
    relationshipManager: canvas.getRelationshipManager(),
    ngZone: canvas.getNgZone(),
    callbacks: {
      onConnectionClick: (connId, event) => canvas.connectionClick.emit({ connId, event }),
      onConnectionDblClick: (conn, event) => canvas.connectionDblClick.emit({ conn, event }),
      onConnectionContextMenu: (conn, event) => canvas.connectionContextMenu.emit({ conn, event }),
      onCanvasBackgroundClick: (event) => canvas.canvasBackgroundClick.emit(event),
      onCanvasMouseDown: (event) => canvas.canvasMouseDown.emit(event),
      onCanvasMouseMove: (event) => canvas.canvasMouseMove.emit(event),
      onCanvasContextMenu: (payload) => canvas.canvasContextMenu.emit(payload),
      onSelectionChange: (payload) => canvas.selectionChange.emit(payload),
      onSelect: (nodeIds, connIds) => canvas.select(nodeIds, connIds),
      onClearSelection: () => canvas.clearSelection(),
      onLivePreview: (sourceId, x, y) => canvas.drawLiveConnectionPreview(sourceId, x, y),
      onClearLivePreview: () => canvas.clearLivePreviewLine(),
    },
  };
}
