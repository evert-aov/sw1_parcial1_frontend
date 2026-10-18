import { Injectable, signal } from '@angular/core';
import Konva from 'konva';
import { UmlClassNode } from '../../../../../../core/models/diagram.model';

export interface DiagramCanvasViewState {
  zoom: number;
  scrollLeft: number;
  scrollTop: number;
}

export interface FocusPoint {
  clientX: number;
  clientY: number;
}

/**
 * Servicio encargado de la gestión de la cámara, transformaciones de coordenadas,
 * paneo, encuadre automático y zoom adaptativo del lienzo del diagrama.
 */
@Injectable({
  providedIn: 'root',
})
export class CanvasViewportManagerService {
  /** Nivel de zoom actual en porcentaje (mínimo 15%, máximo 125%) */
  readonly zoomLevel = signal<number>(100);

  private pendingWheelZoom: { nextZoom: number; focusPoint: FocusPoint } | null = null;
  private wheelAnimFrameId: number | null = null;

  /**
   * Ajusta el nivel de zoom a un porcentaje específico con soporte de enfoque en el cursor.
   *
   * @param targetPct Porcentaje de zoom objetivo (se delimita entre 15% y 125%).
   * @param container Elemento contenedor que tiene scroll (flowContainer).
   * @param autoAdjustScroll Indica si el desplazamiento (scroll) debe ajustarse automáticamente hacia el punto focal.
   * @param focusPoint Coordenadas del cursor en pantalla hacia donde se debe enfocar la vista.
   * @param diagramId Identificador del diagrama activo para persistir la vista en sessionStorage.
   * @param onDimensionsUpdate Callback invocado para sincronizar las dimensiones del escenario Konva.
   * @returns Nuevo nivel de zoom aplicado en porcentaje.
   */
  setZoom(params: {
    targetPct: number;
    container?: HTMLElement | null;
    autoAdjustScroll?: boolean;
    focusPoint?: FocusPoint;
    diagramId?: string | null;
    persistToStorage?: boolean;
    onDimensionsUpdate?: () => void;
  }): number {
    const { targetPct, container, autoAdjustScroll = true, focusPoint, diagramId, persistToStorage = true, onDimensionsUpdate } = params;
    const clamped = Math.max(15, Math.min(125, Math.round(targetPct)));
    const oldZoom = this.zoomLevel();

    if (oldZoom === clamped && !onDimensionsUpdate) {
      return clamped;
    }

    const oldScale = oldZoom / 100;
    const newScale = clamped / 100;

    let contentFocusX = 0;
    let contentFocusY = 0;
    let viewFocusX = 0;
    let viewFocusY = 0;

    if (container && autoAdjustScroll) {
      const rect = container.getBoundingClientRect();
      if (focusPoint) {
        viewFocusX = focusPoint.clientX - rect.left;
        viewFocusY = focusPoint.clientY - rect.top;
      } else {
        viewFocusX = container.clientWidth / 2;
        viewFocusY = container.clientHeight / 2;
      }
      contentFocusX = (container.scrollLeft + viewFocusX) / oldScale;
      contentFocusY = (container.scrollTop + viewFocusY) / oldScale;
    }

    this.zoomLevel.set(clamped);
    onDimensionsUpdate?.();

    if (persistToStorage && diagramId) {
      try {
        const raw = sessionStorage.getItem(`diagram_view_state_${diagramId}`);
        const current = raw ? JSON.parse(raw) : { scrollLeft: 0, scrollTop: 0 };
        sessionStorage.setItem(
          `diagram_view_state_${diagramId}`,
          JSON.stringify({ ...current, zoom: clamped }),
        );
      } catch (_) {}
    }

    if (container && autoAdjustScroll) {
      requestAnimationFrame(() => {
        const newScrollLeft = Math.max(0, Math.round(contentFocusX * newScale - viewFocusX));
        const newScrollTop = Math.max(0, Math.round(contentFocusY * newScale - viewFocusY));
        container.scrollLeft = newScrollLeft;
        container.scrollTop = newScrollTop;
      });
    }

    return clamped;
  }

  /**
   * Incrementa el zoom en pasos de 10% (o 25% si supera el 100%), hasta el límite máximo de 125%.
   *
   * @param container Elemento contenedor que tiene scroll.
   * @param diagramId Identificador del diagrama activo.
   * @param onDimensionsUpdate Callback para actualizar Konva.
   * @returns Nuevo nivel de zoom alcanzado.
   */
  zoomIn(container?: HTMLElement | null, diagramId?: string | null, onDimensionsUpdate?: () => void): number {
    const current = this.zoomLevel();
    const next = current < 100 ? current + 10 : Math.min(125, current + 25);
    return this.setZoom({ targetPct: next, container, autoAdjustScroll: true, diagramId, onDimensionsUpdate });
  }

  /**
   * Reduce el zoom en pasos de 10% (o 25% si es superior a 100%), hasta el límite mínimo de 15%.
   *
   * @param container Elemento contenedor que tiene scroll.
   * @param diagramId Identificador del diagrama activo.
   * @param onDimensionsUpdate Callback para actualizar Konva.
   * @returns Nuevo nivel de zoom alcanzado.
   */
  zoomOut(container?: HTMLElement | null, diagramId?: string | null, onDimensionsUpdate?: () => void): number {
    const current = this.zoomLevel();
    const next = current <= 100 ? current - 10 : current - 25;
    return this.setZoom({ targetPct: next, container, autoAdjustScroll: true, diagramId, onDimensionsUpdate });
  }

  /**
   * Restablece la vista al zoom predeterminado del 100% y centra el tablero.
   *
   * @param container Elemento contenedor con scroll.
   * @param diagramId Identificador del diagrama activo.
   * @param onDimensionsUpdate Callback para actualizar Konva.
   */
  resetView(container?: HTMLElement | null, diagramId?: string | null, onDimensionsUpdate?: () => void): void {
    this.setZoom({ targetPct: 100, container, autoAdjustScroll: false, diagramId, onDimensionsUpdate });
    this.centerViewportOnBoard(container);
  }

  /**
   * Ajusta automáticamente el zoom y desplazamiento para encuadrar todos los nodos visibles en pantalla.
   *
   * @param container Elemento contenedor con scroll.
   * @param nodes Lista de nodos del diagrama a encuadrar.
   * @param diagramId Identificador del diagrama activo.
   * @param onDimensionsUpdate Callback para actualizar Konva.
   */
  fitView(
    container: HTMLElement | null | undefined,
    nodes: UmlClassNode[],
    diagramId?: string | null,
    onDimensionsUpdate?: () => void,
  ): void {
    const realNodes = nodes.filter((n) => !n.isAnchor);
    if (!container || realNodes.length === 0) {
      this.resetView(container, diagramId, onDimensionsUpdate);
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of realNodes) {
      if (!node.position) continue;
      const nx = node.position.x;
      const ny = node.position.y;
      const nw = node.width || (node.nodeType === 'actor' ? 65 : 220);
      const nh = node.height || (node.nodeType === 'lifeline' ? 600 : 120);

      if (nx < minX) minX = nx;
      if (ny < minY) minY = ny;
      if (nx + nw > maxX) maxX = nx + nw;
      if (ny + nh > maxY) maxY = ny + nh;
    }

    if (!isFinite(minX) || !isFinite(maxX)) {
      this.resetView(container, diagramId, onDimensionsUpdate);
      return;
    }

    const padding = 60;
    const diagramWidth = Math.max(100, maxX - minX + padding * 2);
    const diagramHeight = Math.max(100, maxY - minY + padding * 2);

    const availableWidth = container.clientWidth || 800;
    const availableHeight = container.clientHeight || 600;

    const scaleX = availableWidth / diagramWidth;
    const scaleY = availableHeight / diagramHeight;
    const targetScale = Math.min(1.25, Math.max(0.2, Math.min(scaleX, scaleY)));
    const targetZoom = Math.round(targetScale * 100);

    this.setZoom({ targetPct: targetZoom, container, autoAdjustScroll: false, diagramId, onDimensionsUpdate });

    requestAnimationFrame(() => {
      container.scrollLeft = Math.max(0, Math.round(minX * targetScale - padding * targetScale));
      container.scrollTop = Math.max(0, Math.round(minY * targetScale - padding * targetScale));
    });
  }

  /**
   * Centra el viewport en la posición inicial (0, 0) del lienzo.
   *
   * @param container Elemento contenedor con scroll.
   */
  centerViewportOnBoard(container?: HTMLElement | null): void {
    if (!container) return;
    container.scrollLeft = 0;
    container.scrollTop = 0;
  }

  /**
   * Procesa eventos de rueda del ratón (Ctrl+Wheel / Meta+Wheel) de forma acumulativa y suave con RAF.
   *
   * @param event Evento WheelEvent del navegador.
   * @param container Elemento contenedor con scroll.
   * @param diagramId Identificador del diagrama activo.
   * @param onDimensionsUpdate Callback para actualizar el lienzo Konva.
   */
  handleContainerWheel(
    event: WheelEvent,
    container: HTMLElement | null | undefined,
    diagramId: string | null | undefined,
    onDimensionsUpdate: () => void,
  ): void {
    if (!(event.ctrlKey || event.metaKey)) return;

    event.preventDefault();
    event.stopPropagation();
    const delta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
    if (Math.abs(delta) < 1) return;

    const zoomStep = Math.abs(delta) > 50 ? 15 : 5;
    const direction = delta < 0 ? 1 : -1;

    const baseZoom = this.pendingWheelZoom ? this.pendingWheelZoom.nextZoom : this.zoomLevel();
    const nextZoom = Math.max(15, Math.min(125, baseZoom + direction * zoomStep));

    this.pendingWheelZoom = {
      nextZoom,
      focusPoint: { clientX: event.clientX, clientY: event.clientY },
    };

    if (this.wheelAnimFrameId === null) {
      this.wheelAnimFrameId = requestAnimationFrame(() => {
        this.wheelAnimFrameId = null;
        if (this.pendingWheelZoom) {
          const { nextZoom: targetZoom, focusPoint } = this.pendingWheelZoom;
          this.pendingWheelZoom = null;
          this.setZoom({
            targetPct: targetZoom,
            container,
            autoAdjustScroll: true,
            focusPoint,
            diagramId,
            onDimensionsUpdate,
          });
        }
      });
    }
  }

  /**
   * Convierte coordenadas cliente de la pantalla del navegador a coordenadas absolutas del lienzo UML.
   *
   * @param clientX Coordenada horizontal del cursor en pantalla.
   * @param clientY Coordenada vertical del cursor en pantalla.
   * @param stageContainer Elemento contenedor del lienzo Konva.
   * @returns Coordenadas relativas desescaladas dentro del lienzo.
   */
  clientToCanvasCoordinates(
    clientX: number,
    clientY: number,
    stageContainer?: HTMLElement | null,
  ): { x: number; y: number } {
    const scale = Math.max(0.15, this.zoomLevel() / 100);
    if (!stageContainer) return { x: clientX, y: clientY };
    const rect = stageContainer.getBoundingClientRect();
    const x = (clientX - rect.left) / scale;
    const y = (clientY - rect.top) / scale;
    return {
      x: Math.max(10, Math.round(x)),
      y: Math.max(10, Math.round(y)),
    };
  }

  /**
   * Calcula la posición horizontal en pantalla de un cursor según la coordenada del lienzo y el zoom activo.
   *
   * @param canvasX Coordenada X dentro del lienzo.
   * @returns Coordenada X proyectada en la pantalla.
   */
  getCursorScreenX(canvasX: number): number {
    return Math.round(canvasX * (this.zoomLevel() / 100));
  }

  /**
   * Calcula la posición vertical en pantalla de un cursor según la coordenada del lienzo y el zoom activo.
   *
   * @param canvasY Coordenada Y dentro del lienzo.
   * @returns Coordenada Y proyectada en la pantalla.
   */
  getCursorScreenY(canvasY: number): number {
    return Math.round(canvasY * (this.zoomLevel() / 100));
  }

  /**
   * Obtiene una captura del estado del viewport (zoom y posición de desplazamiento).
   *
   * @param container Elemento contenedor con scroll.
   * @returns Snapshot con zoom y posición de scroll.
   */
  getViewState(container?: HTMLElement | null): DiagramCanvasViewState {
    return {
      zoom: this.zoomLevel(),
      scrollLeft: container?.scrollLeft || 0,
      scrollTop: container?.scrollTop || 0,
    };
  }

  /**
   * Aplica un estado de viewport guardado previamente (zoom y posición de desplazamiento).
   *
   * @param state Estado guardado que contiene zoom y scroll.
   * @param container Elemento contenedor con scroll.
   * @param onDimensionsUpdate Callback para actualizar Konva.
   */
  applyViewState(
    state: DiagramCanvasViewState,
    container?: HTMLElement | null,
    onDimensionsUpdate?: () => void,
  ): void {
    this.setZoom({ targetPct: state.zoom, container, autoAdjustScroll: false, persistToStorage: false, onDimensionsUpdate });
    if (container) {
      requestAnimationFrame(() => {
        container.scrollLeft = Math.max(0, state.scrollLeft);
        container.scrollTop = Math.max(0, state.scrollTop);
      });
    }
  }

  /**
   * Restaura el desplazamiento de la vista desde sessionStorage o centrado por defecto.
   *
   * @param diagramId Identificador del diagrama a restaurar.
   * @param container Elemento contenedor con scroll.
   * @param onDimensionsUpdate Callback para actualizar Konva.
   */
  restoreViewportScroll(
    diagramId: string | null,
    container?: HTMLElement | null,
    onDimensionsUpdate?: () => void,
  ): void {
    if (!diagramId) return;
    const viewStateRaw = sessionStorage.getItem(`diagram_view_state_${diagramId}`);
    if (viewStateRaw) {
      try {
        const state = JSON.parse(viewStateRaw);
        if (state && typeof state.zoom === 'number') {
          this.applyViewState(state, container, onDimensionsUpdate);
          return;
        }
      } catch (_) {}
    }
    const saved = sessionStorage.getItem(`diagram_scroll_${diagramId}`);
    if (saved && container) {
      try {
        const { left, top } = JSON.parse(saved);
        container.scrollLeft = left;
        container.scrollTop = top;
        return;
      } catch (_) {}
    }
    this.centerViewportOnBoard(container);
  }

  /**
   * Persiste la posición actual de desplazamiento del viewport en sessionStorage.
   *
   * @param diagramId Identificador del diagrama activo.
   * @param container Elemento contenedor con scroll.
   */
  persistViewportScroll(diagramId: string | null, container?: HTMLElement | null): void {
    if (!container || !diagramId) return;
    sessionStorage.setItem(
      `diagram_scroll_${diagramId}`,
      JSON.stringify({ left: container.scrollLeft, top: container.scrollTop }),
    );
    try {
      const raw = sessionStorage.getItem(`diagram_view_state_${diagramId}`);
      const current = raw ? JSON.parse(raw) : { zoom: this.zoomLevel() };
      sessionStorage.setItem(
        `diagram_view_state_${diagramId}`,
        JSON.stringify({ ...current, scrollLeft: container.scrollLeft, scrollTop: container.scrollTop }),
      );
    } catch (_) {}
  }

  /**
   * Sincroniza la señal zoomLevel a partir de la escala actual del escenario Konva.

   *
   * @param stage Escenario Konva.Stage.
   * @param onZoomChange Callback que notifica el nuevo nivel de zoom en porcentaje.
   */
  syncZoomFromCanvas(stage: Konva.Stage | null, onZoomChange?: (z: number) => void): void {
    if (stage) {
      const pct = Math.round(stage.scaleX() * 100);
      if (pct !== this.zoomLevel()) {
        this.zoomLevel.set(pct);
        onZoomChange?.(pct);
      }
    }
  }

  /**
   * Gestiona el zoom interactivo suave mediante la rueda del ratón (Ctrl/Meta + Wheel).
   *
   * @param event Evento WheelEvent de la rueda del ratón.
   * @param container Elemento contenedor con scroll.
   * @param diagramId Identificador del diagrama activo.
   * @param onDimensionsUpdate Callback para actualizar el escenario Konva.
   * @param onZoomChange Callback para emitir el nuevo porcentaje de zoom.
   */
  handleWheelZoom(
    event: WheelEvent,
    container: HTMLElement | null | undefined,
    diagramId: string | null,
    onDimensionsUpdate?: () => void,
    onZoomChange?: (z: number) => void
  ): void {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      event.stopPropagation();
      const delta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
      if (Math.abs(delta) < 1) return;

      const zoomStep = Math.abs(delta) > 50 ? 15 : 5;
      const direction = delta < 0 ? 1 : -1;

      const baseZoom = this.pendingWheelZoom ? this.pendingWheelZoom.nextZoom : this.zoomLevel();
      const nextZoom = Math.max(15, Math.min(125, baseZoom + direction * zoomStep));

      this.pendingWheelZoom = {
        nextZoom,
        focusPoint: { clientX: event.clientX, clientY: event.clientY },
      };

      if (this.wheelAnimFrameId === null) {
        this.wheelAnimFrameId = requestAnimationFrame(() => {
          this.wheelAnimFrameId = null;
          if (this.pendingWheelZoom) {
            const { nextZoom: targetZoom, focusPoint } = this.pendingWheelZoom;
            this.pendingWheelZoom = null;
            const clamped = this.setZoom({
              targetPct: targetZoom,
              container,
              autoAdjustScroll: true,
              focusPoint,
              diagramId,
              onDimensionsUpdate,
            });
            onZoomChange?.(clamped);
          }
        });
      }
    }
  }

  /**
   * Limpia animaciones pendientes de zoom y cancela el frame de solicitud de rueda.
   */
  destroy(): void {
    if (this.wheelAnimFrameId !== null) {
      cancelAnimationFrame(this.wheelAnimFrameId);
      this.wheelAnimFrameId = null;
    }
    this.pendingWheelZoom = null;
  }
}
