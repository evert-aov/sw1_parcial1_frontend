import { Injectable, signal, computed } from '@angular/core';
import { UmlClassNode, UmlConnection, UmlLineStyle } from '../../../../core/models/diagram.model';

export interface DiagramHistorySnapshot {
  nodes: UmlClassNode[];
  connections: UmlConnection[];
  defaultLineStyle: UmlLineStyle;
}

/**
 * Historial de deshacer/rehacer. Se provee a nivel de `DiagramEditorComponent` (no en `root`),
 * por lo que cada editor tiene sus propias pilas y undo/redo no puede restaurar snapshots ajenos.
 */
@Injectable()
export class DiagramHistoryService {
  private historyUndoStack: DiagramHistorySnapshot[] = [];
  private historyRedoStack: DiagramHistorySnapshot[] = [];
  private readonly maxHistoryLength = 40;

  readonly undoCount = signal<number>(0);
  readonly redoCount = signal<number>(0);

  readonly canUndo = computed(() => this.undoCount() > 0);
  readonly canRedo = computed(() => this.redoCount() > 0);

  /**
   * Clona un snapshot inmutable del estado actual.
   */
  cloneSnapshot(
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    defaultLineStyle: UmlLineStyle,
  ): DiagramHistorySnapshot {
    return {
      nodes: JSON.parse(JSON.stringify(nodes)),
      connections: JSON.parse(JSON.stringify(connections)),
      defaultLineStyle,
    };
  }

  /**
   * Guarda el estado actual en la pila de deshacer y limpia la pila de rehacer.
   */
  pushSnapshot(snapshot: DiagramHistorySnapshot): void {
    this.historyUndoStack.push(snapshot);
    if (this.historyUndoStack.length > this.maxHistoryLength) {
      this.historyUndoStack.shift();
    }
    this.historyRedoStack = [];
    this.undoCount.set(this.historyUndoStack.length);
    this.redoCount.set(0);
  }

  /**
   * Deshace el último cambio y guarda el estado actual en la pila de rehacer.
   */
  undo(currentSnapshot: DiagramHistorySnapshot): DiagramHistorySnapshot | null {
    if (this.historyUndoStack.length === 0) return null;

    this.historyRedoStack.push(currentSnapshot);
    const prevSnapshot = this.historyUndoStack.pop()!;

    this.undoCount.set(this.historyUndoStack.length);
    this.redoCount.set(this.historyRedoStack.length);

    return prevSnapshot;
  }

  /**
   * Rehace el último cambio deshecho y guarda el estado actual en la pila de deshacer.
   */
  redo(currentSnapshot: DiagramHistorySnapshot): DiagramHistorySnapshot | null {
    if (this.historyRedoStack.length === 0) return null;

    this.historyUndoStack.push(currentSnapshot);
    const nextSnapshot = this.historyRedoStack.pop()!;

    this.undoCount.set(this.historyUndoStack.length);
    this.redoCount.set(this.historyRedoStack.length);

    return nextSnapshot;
  }

  /**
   * Limpia el historial completo (al cambiar de diagrama).
   */
  clear(): void {
    this.historyUndoStack = [];
    this.historyRedoStack = [];
    this.undoCount.set(0);
    this.redoCount.set(0);
  }
}
