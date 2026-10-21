import { Injectable, signal, computed } from '@angular/core';
import { FSelectionChangeEvent } from '@foblex/flow';
import { UmlClassNode, UmlConnection, UmlRelationshipType } from '../../../../../core/models/diagram.model';

@Injectable({
  providedIn: 'root',
})
export class DiagramSelectionService {
  readonly selectedNodeId = signal<string | null>(null);
  readonly selectedNodeIds = signal<Set<string>>(new Set());

  readonly selectedNodeIdsList = computed(() => {
    const set = this.selectedNodeIds();
    const single = this.selectedNodeId();
    const result = new Set(set);
    if (single) result.add(single);
    return Array.from(result);
  });

  readonly selectedConnId = signal<string | null>(null);
  readonly selectedConnIds = signal<Set<string>>(new Set());

  readonly selectedConnIdsList = computed(() => {
    const set = this.selectedConnIds();
    const single = this.selectedConnId();
    const result = new Set(set);
    if (single) result.add(single);
    return Array.from(result);
  });

  lastSelectionChangeTime = 0;
  hasMovedDuringPointerDown = false;

  /**
   * Limpia toda la selección activa de nodos y conexiones en el lienzo.
   */
  clearSelection(): void {
    this.selectedNodeId.set(null);
    this.selectedNodeIds.set(new Set());
    this.selectedConnId.set(null);
    this.selectedConnIds.set(new Set());
  }

  /**
   * Verifica si un nodo específico forma parte de la selección activa.
   * @param nodeId Identificador del nodo a consultar.
   * @returns Verdadero si está seleccionado.
   */
  isNodeSelected(nodeId: string): boolean {
    return this.selectedNodeIds().has(nodeId) || this.selectedNodeId() === nodeId;
  }

  /**
   * Verifica si una conexión específica está seleccionada actualmente.
   * @param connId Identificador de la conexión.
   * @returns Verdadero si la conexión está seleccionada.
   */
  isConnectionSelected(connId: string): boolean {
    return this.selectedConnIds().has(connId) || this.selectedConnId() === connId;
  }

  /**
   * Determina si hay múltiples nodos seleccionados simultáneamente.
   * @returns Verdadero si la cantidad de nodos seleccionados es mayor a 1.
   */
  hasMultipleSelected(): boolean {
    return this.selectedNodeIds().size > 1;
  }

  /**
   * Selecciona exclusivamente un único nodo, descartando conexiones y otros nodos seleccionados.
   * @param nodeId Identificador del nodo a seleccionar o null para deseleccionar.
   */
  selectSingleNode(nodeId: string | null): void {
    this.selectedNodeId.set(nodeId);
    this.selectedNodeIds.set(nodeId ? new Set([nodeId]) : new Set());
    this.selectedConnId.set(null);
    this.selectedConnIds.set(new Set());
  }

  /**
   * Selecciona exclusivamente una única conexión, descartando nodos seleccionados.
   * @param connId Identificador de la conexión o null.
   */
  selectSingleConnection(connId: string | null): void {
    this.selectedConnId.set(connId);
    this.selectedConnIds.set(connId ? new Set([connId]) : new Set());
    this.selectedNodeId.set(null);
    this.selectedNodeIds.set(new Set());
  }

  /**
   * Establece un conjunto arbitrario de nodos como seleccionados, definiendo un nodo principal.
   * @param nodeIds Lista de identificadores de nodos.
   * @param primaryId Identificador del nodo principal en la selección (opcional).
   */
  setNodeSelection(nodeIds: string[], primaryId?: string): void {
    this.selectedNodeIds.set(new Set(nodeIds));
    this.selectedNodeId.set(primaryId || (nodeIds.length > 0 ? nodeIds[0] : null));
    this.selectedConnId.set(null);
    this.selectedConnIds.set(new Set());
  }

  /**
   * Maneja el evento de cambio de selección nativo emitido por Foblex Flow.
   * @param event Evento de selección con arreglos de nodeIds y connectionIds.
   * @param nodes Colección de nodos existentes para filtrar anclas.
   * @param connections Colección de conexiones existentes.
   * @param selectedRelationType Tipo de relación en curso o null.
   */
  onSelectionChange(
    event: FSelectionChangeEvent,
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    selectedRelationType: UmlRelationshipType | null,
  ): void {
    if (selectedRelationType !== null) return;
    this.lastSelectionChangeTime = Date.now();

    const classNodeIds = (event.nodeIds || []).filter((id) => {
      const node = nodes.find((n) => n.id === id);
      return node && !node.isAnchor;
    });

    const connIds = (event.connectionIds || []).filter((id) => {
      return connections.some((c) => c.id === id);
    });

    if (classNodeIds.length > 0) {
      this.selectedNodeIds.set(new Set(classNodeIds));
      if (!this.selectedNodeId() || !classNodeIds.includes(this.selectedNodeId()!)) {
        this.selectedNodeId.set(classNodeIds[0]);
      }
    } else {
      this.selectedNodeIds.set(new Set());
      this.selectedNodeId.set(null);
    }

    if (connIds.length > 0) {
      this.selectedConnIds.set(new Set(connIds));
      if (!this.selectedConnId() || !connIds.includes(this.selectedConnId()!)) {
        this.selectedConnId.set(connIds[0]);
      }
    } else {
      this.selectedConnIds.set(new Set());
      this.selectedConnId.set(null);
    }
  }

  /**
   * Selecciona todos los nodos UML reales del diagrama excluyendo nodos ancla de asociación.
   * @param nodes Colección de nodos a seleccionar.
   * @param selectedRelationType Tipo de relación en curso de dibujo o null.
   * @param selectOnCanvas Callback para reflejar la selección en el lienzo Foblex.
   */
  selectAllClasses(
    nodes: UmlClassNode[],
    selectedRelationType: UmlRelationshipType | null,
    selectOnCanvas?: (nodeIds: string[]) => void,
  ): void {
    if (selectedRelationType !== null) return;
    const nonAnchorNodes = nodes.filter((n) => !n.isAnchor);
    if (nonAnchorNodes.length === 0) return;
    const allIds = nonAnchorNodes.map((n) => n.id);
    this.selectedNodeIds.set(new Set(allIds));
    this.selectedNodeId.set(nonAnchorNodes[0]?.id || null);
    selectOnCanvas?.(allIds);
  }

  /**
   * Maneja el clic sobre una conexión UML, soportando selección acumulativa con Shift o Ctrl.
   * @param connId Identificador de la conexión clickeada.
   * @param event Evento de ratón del usuario.
   * @param selectedRelationType Tipo de relación activa o null.
   * @param selectOnCanvas Callback para actualizar la selección en el lienzo Foblex.
   */
  onConnectionSelect(
    connId: string,
    event: MouseEvent,
    selectedRelationType: UmlRelationshipType | null,
    selectOnCanvas?: (nodeIds: string[], connIds: string[]) => void,
  ): void {
    if (selectedRelationType !== null) return;
    event.stopPropagation();

    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      const current = new Set(this.selectedConnIds());
      if (current.has(connId)) {
        current.delete(connId);
      } else {
        current.add(connId);
      }
      this.selectedConnIds.set(current);
      const remaining = Array.from(current);
      this.selectedConnId.set(remaining.length > 0 ? remaining[remaining.length - 1] : null);
      selectOnCanvas?.(Array.from(this.selectedNodeIds()), remaining);
    } else {
      this.selectedNodeIds.set(new Set());
      this.selectedNodeId.set(null);
      this.selectedConnIds.set(new Set([connId]));
      this.selectedConnId.set(connId);
      selectOnCanvas?.([], [connId]);
    }
  }

  /**
   * Maneja el clic sobre un nodo UML, soportando selección múltiple y preservación de arrastre en grupo.
   * @param nodeId Identificador del nodo interactuado.
   * @param event Evento de ratón.
   * @param selectedRelationType Tipo de relación en curso o null.
   * @param hasMovedDuringPointerDown Indicador de si el puntero se desplazó durante mousedown.
   * @param selectOnCanvas Callback para seleccionar en el lienzo visual Foblex.
   * @param clearCanvasSelection Callback para vaciar la selección visual Foblex.
   */
  onNodeSelect(
    nodeId: string,
    event: MouseEvent,
    selectedRelationType: UmlRelationshipType | null,
    hasMovedDuringPointerDown: boolean = this.hasMovedDuringPointerDown,
    selectOnCanvas?: (nodeIds: string[], connIds: string[]) => void,
    clearCanvasSelection?: () => void,
  ): void {
    if (selectedRelationType !== null) return;
    event.stopPropagation();

    const isModifier = event.ctrlKey || event.metaKey || event.shiftKey;
    const fSelectionRecent = Date.now() - this.lastSelectionChangeTime < 300;

    if (isModifier) {
      if (fSelectionRecent) {
        if (!this.selectedNodeId() || !this.selectedNodeIds().has(this.selectedNodeId()!)) {
          const first = Array.from(this.selectedNodeIds())[0] || null;
          this.selectedNodeId.set(first);
        }
        return;
      }

      const current = new Set(this.selectedNodeIds());
      if (this.selectedNodeId() && !current.has(this.selectedNodeId()!)) {
        current.add(this.selectedNodeId()!);
      }
      if (current.has(nodeId)) {
        current.delete(nodeId);
        const remaining = Array.from(current);
        this.selectedNodeId.set(remaining.length > 0 ? remaining[remaining.length - 1] : null);
      } else {
        current.add(nodeId);
        this.selectedNodeId.set(nodeId);
      }
      this.selectedNodeIds.set(current);
      const ids = Array.from(current);
      if (ids.length > 0) {
        selectOnCanvas?.(ids, []);
      } else {
        clearCanvasSelection?.();
      }
      return;
    }

    if (hasMovedDuringPointerDown && this.selectedNodeIds().has(nodeId) && this.selectedNodeIds().size > 1) {
      return;
    }

    this.selectedNodeIds.set(new Set([nodeId]));
    this.selectedNodeId.set(nodeId);
    this.selectedConnId.set(null);
    this.selectedConnIds.set(new Set());
    selectOnCanvas?.([nodeId], []);
  }
}
