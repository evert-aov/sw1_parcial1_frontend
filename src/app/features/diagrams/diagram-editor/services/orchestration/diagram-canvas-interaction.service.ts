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

  /**
   * Registra el inicio de interacción de ratón sobre el lienzo y cierra menús contextuales.
   * @param event Evento de ratón (mousedown).
   * @param closeContextMenu Callback para cerrar el menú contextual activo.
   */
  handleCanvasMouseDown(event: MouseEvent, closeContextMenu?: () => void): void {
    if (closeContextMenu) closeContextMenu();
    this.canvasMouseDownPos = { x: event.clientX, y: event.clientY };
  }

  /**
   * Maneja el clic en el fondo del lienzo, deseleccionando elementos si no hubo arrastre.
   * @param event Evento de ratón (click).
   * @param onDeselect Callback para limpiar la selección activa.
   */
  handleCanvasBackgroundClick(event: MouseEvent | undefined, onDeselect: () => void): void {
    if (event && isDragMovement(this.canvasMouseDownPos.x, this.canvasMouseDownPos.y, event.clientX, event.clientY)) {
      return;
    }
    onDeselect();
  }

  /**
   * Procesa el movimiento del ratón sobre el lienzo, calculando coordenadas virtuales y emitiendo cursor remoto.
   * @param event Evento de ratón (mousemove).
   * @param exportElement Elemento HTML contenedor del lienzo.
   * @param transform Transformación actual (escala y posición de cámara).
   * @param sendCursorPosition Callback para emitir posición de cursor a pares colaborativos.
   * @returns Coordenadas calculadas en el lienzo o null.
   */
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

  /**
   * Manejador global de mousedown en la ventana para resetear banderas de desplazamiento.
   */
  handleWindowMouseDown(): void {
    this.hasMovedDuringPointerDown = false;
  }

  /**
   * Manejador global de mouseup en la ventana para finalizar arrastres y limpiar contención.
   */
  handleWindowMouseUp(): void {
    this.containmentService.resetDragState();
    setTimeout(() => {
      this.hasMovedDuringPointerDown = false;
    }, 50);
  }

  /**
   * Procesa el cambio de posición de un nodo individual durante la interacción de arrastre.
   * @param params Parámetros de cambio de posición y callbacks.
   * @returns Indicador de si se requiere redibujar.
   */
  handleNodePositionChange(params: NodePositionChangeParams): { shouldRedraw: boolean } {
    this.hasMovedDuringPointerDown = true;
    return this.containmentService.processNodePositionChange(params);
  }

  /**
   * Procesa el movimiento en lote de múltiples nodos emitido por Foblex Flow.
   * @param params Parámetros del evento de movimiento múltiple.
   * @returns Indicador de si algún nodo cambió de posición efectivamente.
   */
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
