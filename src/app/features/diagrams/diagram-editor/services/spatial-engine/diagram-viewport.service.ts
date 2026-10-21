import { Injectable, signal } from '@angular/core';
import {
  DiagramCanvasComponent,
  DiagramCanvasViewState,
} from '../../components/diagram-canvas/diagram-canvas.component';

@Injectable({
  providedIn: 'root',
})
export class DiagramViewportService {
  readonly zoomLevel = signal<number>(100);
  private readonly diagramViewStates = new Map<string, DiagramCanvasViewState>();

  /**
   * Guarda el estado de visualización (zoom, scroll) para un diagrama particular en memoria y sessionStorage.
   */
  saveDiagramViewState(diagramId: string, state?: Partial<DiagramCanvasViewState>): void {
    if (!diagramId) return;
    const current = this.getDiagramViewState(diagramId);
    const updated: DiagramCanvasViewState = {
      zoom: state?.zoom !== undefined ? state.zoom : current.zoom,
      scrollLeft: state?.scrollLeft !== undefined ? state.scrollLeft : current.scrollLeft,
      scrollTop: state?.scrollTop !== undefined ? state.scrollTop : current.scrollTop,
    };
    this.diagramViewStates.set(diagramId, updated);
    try {
      sessionStorage.setItem(`diagram_view_state_${diagramId}`, JSON.stringify(updated));
    } catch (_) {}
  }

  /**
   * Recupera el estado de vista de un diagrama desde memoria o sessionStorage.
   */
  getDiagramViewState(diagramId: string): DiagramCanvasViewState {
    if (this.diagramViewStates.has(diagramId)) {
      return this.diagramViewStates.get(diagramId)!;
    }
    try {
      const raw = sessionStorage.getItem(`diagram_view_state_${diagramId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.zoom === 'number') {
          this.diagramViewStates.set(diagramId, parsed);
          return parsed;
        }
      }
    } catch (_) {}
    return { zoom: 100, scrollLeft: 0, scrollTop: 0 };
  }

  /**
   * Elimina el estado de visualización guardado en memoria y sessionStorage.
   */
  deleteDiagramViewState(diagramId: string): void {
    if (!diagramId) return;
    this.diagramViewStates.delete(diagramId);
    try {
      sessionStorage.removeItem(`diagram_view_state_${diagramId}`);
      sessionStorage.removeItem(`diagram_scroll_${diagramId}`);
    } catch (_) {}
  }

  /**
   * Actualiza el zoom reactivo y persiste en el diagrama activo.
   */
  onZoomChanged(zoom: number, currentDiagramId: string | null): void {
    this.zoomLevel.set(zoom);
    if (currentDiagramId) {
      this.saveDiagramViewState(currentDiagramId, { zoom });
    }
  }

  /**
   * Maneja el scroll del viewport para persistir la posición de visualización.
   */
  onViewportScroll(event: Event, currentDiagramId: string | null): void {
    const el = event.target as HTMLElement;
    if (!el || !currentDiagramId) return;

    this.saveDiagramViewState(currentDiagramId, {
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
    });
    try {
      sessionStorage.setItem(
        `diagram_scroll_${currentDiagramId}`,
        JSON.stringify({ left: el.scrollLeft, top: el.scrollTop }),
      );
    } catch (_) {}
  }

  /**
   * Sincroniza la señal reactiva de zoom con el nivel de escala actual del lienzo Foblex.
   * @param diagramCanvas Referencia al componente del lienzo.
   */
  syncZoomFromCanvas(diagramCanvas?: DiagramCanvasComponent): void {
    diagramCanvas?.syncZoomFromCanvas();
  }

  /**
   * Incrementa el nivel de zoom en el lienzo activo.
   * @param diagramCanvas Referencia al componente del lienzo.
   */
  zoomIn(diagramCanvas?: DiagramCanvasComponent): void {
    diagramCanvas?.zoomIn();
  }

  /**
   * Reduce el nivel de zoom en el lienzo activo.
   * @param diagramCanvas Referencia al componente del lienzo.
   */
  zoomOut(diagramCanvas?: DiagramCanvasComponent): void {
    diagramCanvas?.zoomOut();
  }

  /**
   * Restaura la posición previa de scroll horizontal y vertical en el contenedor del lienzo.
   * @param diagramCanvas Referencia al componente del lienzo.
   * @param diagramId Identificador del diagrama a restaurar.
   */
  restoreViewportScroll(diagramCanvas: DiagramCanvasComponent | undefined, diagramId: string | null): void {
    diagramCanvas?.restoreViewportScroll(diagramId);
  }

  /**
   * Centra el viewport del lienzo sobre el centro geométrico del tablero.
   * @param diagramCanvas Referencia al componente del lienzo.
   */
  centerViewportOnBoard(diagramCanvas?: DiagramCanvasComponent): void {
    diagramCanvas?.centerViewportOnBoard();
  }

  /**
   * Restablece el zoom al 100% y devuelve la vista a su posición de origen.
   * @param diagramCanvas Referencia al componente del lienzo.
   */
  resetView(diagramCanvas?: DiagramCanvasComponent): void {
    diagramCanvas?.resetView();
  }

  /**
   * Ajusta automáticamente el zoom y posición para encuadrar todos los nodos en pantalla.
   * @param diagramCanvas Referencia al componente del lienzo.
   */
  fitView(diagramCanvas?: DiagramCanvasComponent): void {
    diagramCanvas?.fitView();
  }

  /**
   * Restaura el estado visual completo de un diagrama (zoom, posición y conexiones) asegurando doble ciclo de render.
   * @param diagramCanvas Referencia al componente del lienzo.
   * @param diagramId Identificador del diagrama cuyo estado se restaura.
   * @param onUpdateEndpoints Función callback para recalcular los extremos de conexión Foblex.
   */
  restoreCanvasViewState(diagramCanvas: DiagramCanvasComponent | undefined, diagramId: string, onUpdateEndpoints: () => void): void {
    requestAnimationFrame(() => {
      onUpdateEndpoints();
      requestAnimationFrame(() => {
        onUpdateEndpoints();
        diagramCanvas?.clearSelection();
        diagramCanvas?.reset();
        const targetState = this.getDiagramViewState(diagramId);
        this.zoomLevel.set(targetState.zoom);
        diagramCanvas?.applyViewState(targetState);
      });
    });
  }
}
