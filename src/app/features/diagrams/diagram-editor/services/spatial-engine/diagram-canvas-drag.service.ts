import { ChangeDetectorRef, ElementRef, Injectable } from '@angular/core';
import { FCanvasComponent, FZoomDirective } from '@foblex/flow';
import { UmlClassNode, UmlConnection } from '../../../../../core/models/diagram.model';
import { DiagramCanvasViewState } from '../../components/diagram-canvas/diagram-canvas.component';
import { getNodeHeight, getNodeWidth } from '../../utils/node-metrics.util';

/**
 * Servicio de interacción de arrastre local y cámara para el lienzo:
 * - Arrastre de etiquetas de nodos (`labelOffset`).
 * - Arrastre vertical por slots de mensajes en Diagramas de Secuencia.
 * - Control de zoom, encuadre (`fitView`), scroll y coordenadas de drop en lienzo.
 */
@Injectable({
  providedIn: 'root',
})
export class DiagramCanvasDragService {
  /**
   * Inicia una sesión de arrastre para la etiqueta libre de un nodo.
   *
   * @param node Nodo UML cuya etiqueta se desplaza.
   * @param event Evento de puntero inicial.
   * @param scale Escala actual del lienzo.
   * @param cdr Detector de cambios para actualizar la vista a 60 FPS.
   * @param onStart Callback al iniciar el arrastre.
   * @param onEnd Callback al finalizar con el offset resultante.
   */
  startNodeLabelDrag(
    node: UmlClassNode,
    event: PointerEvent | MouseEvent,
    scale: number,
    cdr: ChangeDetectorRef,
    onStart: (nodeId: string) => void,
    onEnd: (node: UmlClassNode, finalOffset: { x: number; y: number }) => void,
  ): void {
    event.stopPropagation();
    event.preventDefault();

    onStart(node.id);
    const startX = event.clientX;
    const startY = event.clientY;
    const initialOffsetX = node.labelOffset?.x ?? 0;
    const initialOffsetY = node.labelOffset?.y ?? 0;
    const effectiveScale = scale || 1;

    const onPointerMove = (moveEvent: PointerEvent | MouseEvent) => {
      const dx = (moveEvent.clientX - startX) / effectiveScale;
      const dy = (moveEvent.clientY - startY) / effectiveScale;
      node.labelOffset = {
        x: Math.round(initialOffsetX + dx),
        y: Math.round(initialOffsetY + dy),
      };
      cdr.markForCheck();
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      onEnd(node, node.labelOffset || { x: 0, y: 0 });
      cdr.markForCheck();
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  /**
   * Inicia el arrastre vertical de un mensaje en un diagrama de secuencia.
   *
   * @param conn Conexión de secuencia arrastrada.
   * @param event Evento de puntero inicial.
   * @param scale Escala actual del lienzo.
   * @param cdr Detector de cambios.
   * @param onStart Callback al iniciar el arrastre con el slot original.
   * @param onMove Callback en cada movimiento con el delta vertical y slot objetivo.
   * @param onEnd Callback al soltar con el slot destino si hubo cambio.
   */
  startSequenceMessageDrag(
    conn: UmlConnection,
    event: PointerEvent | MouseEvent,
    scale: number,
    cdr: ChangeDetectorRef,
    onStart: (connId: string, startSlot: number) => void,
    onMove: (deltaY: number, targetSlot: number) => void,
    onEnd: (result: { connectionId: string; targetSlot: number } | null) => void,
  ): void {
    event.stopPropagation();

    const slotMatch = conn.sourceId?.match(/_slot_(\d+)$/) || conn.targetId?.match(/_slot_(\d+)$/);
    const initialSlot = slotMatch ? parseInt(slotMatch[1], 10) : 0;
    const startClientY = event.clientY;
    const effectiveScale = scale || 1;
    let currentTargetSlot = initialSlot;
    let hasMoved = false;

    const onPointerMove = (moveEvent: PointerEvent | MouseEvent) => {
      const dy = (moveEvent.clientY - startClientY) / effectiveScale;
      if (!hasMoved && Math.abs(dy) > 4) {
        hasMoved = true;
        onStart(conn.id, initialSlot);
      }
      if (!hasMoved) return;

      const slotDelta = Math.round(dy / 50);
      currentTargetSlot = Math.max(0, initialSlot + slotDelta);
      onMove(dy, currentTargetSlot);
      cdr.markForCheck();
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      if (hasMoved && currentTargetSlot !== initialSlot) {
        onEnd({ connectionId: conn.id, targetSlot: currentTargetSlot });
      } else {
        onEnd(null);
      }
      cdr.markForCheck();
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  /**
   * Convierte coordenadas de cliente (`clientX`, `clientY`) al sistema de coordenadas del lienzo.
   *
   * @param clientX Coordenada X de ventana.
   * @param clientY Coordenada Y de ventana.
   * @param boardEl Elemento DOM del tablero.
   * @param scale Escala actual del lienzo.
   * @returns Coordenadas `{ x, y }` en el lienzo.
   */
  clientToCanvasPosition(
    clientX: number,
    clientY: number,
    boardEl: HTMLElement | undefined,
    scale: number,
  ): { x: number; y: number } {
    if (!boardEl || !Number.isFinite(clientX) || !Number.isFinite(clientY)) {
      return { x: 150, y: 120 };
    }
    const rect = boardEl.getBoundingClientRect();
    const effectiveScale = scale && Number.isFinite(scale) && scale > 0 ? scale : 1;
    const rawX = Math.round((clientX - rect.left) / effectiveScale);
    const rawY = Math.round((clientY - rect.top) / effectiveScale);
    return {
      x: Math.max(20, Number.isFinite(rawX) ? rawX : 150),
      y: Math.max(20, Number.isFinite(rawY) ? rawY : 120),
    };
  }

  /**
   * Extrae el payload y coordenadas de lienzo al soltar un elemento desde el Toolbox o Explorador.
   *
   * @param event Evento `DragEvent` del navegador.
   * @param boardEl Elemento DOM del tablero.
   * @param scale Escala actual del lienzo.
   * @returns Objeto con tipo, payload y posición de caída, o `null` si es inválido.
   */
  parseCanvasDropEvent(
    event: DragEvent,
    boardEl: HTMLElement | undefined,
    scale: number,
  ): { type: string; payload: any; position: { x: number; y: number } } | null {
    const rawJson =
      event.dataTransfer?.getData('application/uml-node') ||
      event.dataTransfer?.getData('application/json') ||
      event.dataTransfer?.getData('text/plain');
    if (!rawJson) return null;
    const position = this.clientToCanvasPosition(event.clientX, event.clientY, boardEl, scale);
    try {
      const parsed = JSON.parse(rawJson);
      const nodeType = parsed.nodeType || (parsed.type !== 'toolbox_node' && parsed.type !== 'explorer_node' ? parsed.type : 'class');
      return {
        type: nodeType,
        payload: parsed,
        position,
      };
    } catch {
      const textType = rawJson.trim();
      return {
        type: textType || 'class',
        payload: { type: 'toolbox_node', nodeType: textType },
        position,
      };
    }
  }

  /**
   * Aplica un nivel de zoom porcentual sobre la directiva `fZoom` o transformación del lienzo.
   *
   * @param targetZoom Porcentaje de zoom deseado (25..200).
   * @param canvas Instancia de `FCanvasComponent`.
   * @param zoomDirective Instancia de `FZoomDirective`.
   * @param setZoom Signal setter del zoom.
   * @param emitZoom Callback para emitir el nuevo zoom.
   */
  applyZoomLevel(
    targetZoom: number,
    canvas: FCanvasComponent | undefined,
    zoomDirective: FZoomDirective | undefined,
    setZoom: (z: number) => void,
    emitZoom: (z: number) => void,
  ): void {
    const clamped = Math.min(200, Math.max(25, Math.round(targetZoom)));
    const scale = clamped / 100;
    setZoom(clamped);
    if (canvas) {
      canvas.setScale(scale);
      canvas.redraw();
    }
    emitZoom(clamped);
  }

  /**
   * Encuadra automáticamente todos los nodos visibles dentro del contenedor del lienzo.
   *
   * @param nodes Lista de nodos del diagrama.
   * @param containerEl Contenedor con scroll del viewport.
   * @param applyZoom Callback para aplicar el zoom calculado.
   */
  fitNodesInViewport(
    nodes: UmlClassNode[],
    containerEl: HTMLElement | undefined,
    applyZoom: (zoom: number) => void,
  ): void {
    const realNodes = nodes.filter((n) => !n.isAnchor);
    if (realNodes.length === 0 || !containerEl) {
      applyZoom(100);
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const n of realNodes) {
      const x = n.position?.x || 0;
      const y = n.position?.y || 0;
      const w = getNodeWidth(n);
      const h = getNodeHeight(n);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + w > maxX) maxX = x + w;
      if (y + h > maxY) maxY = y + h;
    }

    const contentW = Math.max(200, maxX - minX + 160);
    const contentH = Math.max(200, maxY - minY + 160);
    const viewW = containerEl.clientWidth || 1000;
    const viewH = containerEl.clientHeight || 700;

    const scaleX = viewW / contentW;
    const scaleY = viewH / contentH;
    const optimalZoom = Math.min(100, Math.max(40, Math.floor(Math.min(scaleX, scaleY) * 100)));

    applyZoom(optimalZoom);
    requestAnimationFrame(() => {
      const scale = optimalZoom / 100;
      containerEl.scrollLeft = Math.max(0, minX * scale - 60);
      containerEl.scrollTop = Math.max(0, minY * scale - 60);
    });
  }

  /**
   * Aplica un estado de vista (`zoom`, `scrollLeft`, `scrollTop`) al contenedor del lienzo.
   *
   * @param state Estado de vista a restaurar.
   * @param containerEl Contenedor DOM del viewport.
   * @param applyZoom Callback para aplicar el porcentaje de zoom.
   */
  applyViewState(
    state: DiagramCanvasViewState,
    containerEl: HTMLElement | undefined,
    applyZoom: (zoom: number) => void,
  ): void {
    if (!state) return;
    applyZoom(state.zoom || 100);
    requestAnimationFrame(() => {
      if (containerEl) {
        containerEl.scrollLeft = state.scrollLeft || 0;
        containerEl.scrollTop = state.scrollTop || 0;
      }
    });
  }
}
