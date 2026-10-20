import { Injectable, inject } from '@angular/core';
import { FMoveNodesEvent } from '@foblex/flow';
import { DiagramType, UmlClassNode } from '../../../../../core/models/diagram.model';
import { calculateCanvasCoordinates, isDragMovement } from '../../utils/canvas-coordinates.util';
import { DiagramContainmentService } from '../spatial-engine/diagram-containment.service';

export interface NodePositionChangeParams {
  node: UmlClassNode;
  newPosition: { x: number; y: number };
  nodes: UmlClassNode[];
  selectedNodeIds: Set<string>;
  selectedNodeId: string | null;
  activeDiagramType: DiagramType;
  getNodeWidth: (n: UmlClassNode) => number;
  getNodeHeight: (n: UmlClassNode) => number;
  onStartDrag: () => void;
  onSelectNode: (id: string) => void;
  sendNodeDrag: (id: string, pos: { x: number; y: number }) => void;
}

export interface MoveNodesParams {
  event: FMoveNodesEvent;
  nodes: UmlClassNode[];
  activeDiagramType: DiagramType;
  getNodeWidth: (n: UmlClassNode) => number;
  getNodeHeight: (n: UmlClassNode) => number;
  onStartDrag: () => void;
  sendNodeDrag: (id: string, pos: { x: number; y: number }) => void;
}

@Injectable({
  providedIn: 'root',
})
export class DiagramCanvasInteractionService {
  private readonly containmentService: DiagramContainmentService;

  canvasMouseDownPos = { x: 0, y: 0 };
  hasMovedDuringPointerDown = false;

  constructor(containmentService?: DiagramContainmentService) {
    if (containmentService) {
      this.containmentService = containmentService;
    } else {
      let injected: DiagramContainmentService | null = null;
      try {
        injected = inject(DiagramContainmentService, { optional: true });
      } catch {
        // Outside Angular DI context
      }
      this.containmentService = injected ?? new DiagramContainmentService();
    }
  }

  handleCanvasMouseDown(event: MouseEvent, closeContextMenu?: () => void): void {
    if (closeContextMenu) closeContextMenu();
    this.canvasMouseDownPos = { x: event.clientX, y: event.clientY };
  }

  handleCanvasBackgroundClick(event: MouseEvent | undefined, onDeselect: () => void): void {
    if (event && isDragMovement(this.canvasMouseDownPos.x, this.canvasMouseDownPos.y, event.clientX, event.clientY)) {
      return;
    }
    onDeselect();
  }

  handleCanvasMouseMove(
    event: MouseEvent,
    exportElement?: HTMLElement | null,
    transform?: { scale?: number; position?: { x: number; y: number } } | null,
    sendCursorPosition?: (x: number, y: number) => void,
  ): { x: number; y: number } | null {
    const coords = calculateCanvasCoordinates(event, exportElement, transform);
    if (!coords) return null;

    if (sendCursorPosition) {
      sendCursorPosition(coords.x, coords.y);
    }
    return coords;
  }

  handleWindowMouseDown(): void {
    this.hasMovedDuringPointerDown = false;
  }

  handleWindowMouseUp(): void {
    this.containmentService.resetDragState();
    setTimeout(() => {
      this.hasMovedDuringPointerDown = false;
    }, 50);
  }

  handleNodePositionChange(params: NodePositionChangeParams): { shouldRedraw: boolean } {
    this.hasMovedDuringPointerDown = true;
    return this.containmentService.processNodePositionChange(params);
  }

  handleMoveNodes(params: MoveNodesParams): { anyMoved: boolean } {
    this.hasMovedDuringPointerDown = true;
    return this.containmentService.processMoveNodes({
      eventNodes: params.event.nodes,
      nodes: params.nodes,
      activeDiagramType: params.activeDiagramType,
      getNodeWidth: params.getNodeWidth,
      getNodeHeight: params.getNodeHeight,
      onStartDrag: params.onStartDrag,
      sendNodeDrag: params.sendNodeDrag,
    });
  }
}
