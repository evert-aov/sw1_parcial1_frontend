import { Injectable } from '@angular/core';

export interface DiagramHotkeysActions {
  isReadOnly: () => boolean;
  isModalOpen?: () => boolean;
  undo: () => void;
  redo: () => void;
  save: () => void;
  toggleToolbox: () => void;
  toggleAi: () => void;
  copy: () => void;
  cut: () => void;
  paste: () => void;
  duplicate: () => void;
  selectAll: () => void;
  deleteSelected: () => void;
  escape: () => void;
  hasContextMenu: () => boolean;
  closeContextMenu: () => void;
  getRenameTargetNodeId: () => string | null;
  startRenameNode: (nodeId: string) => void;
}

@Injectable({
  providedIn: 'root',
})
export class DiagramHotkeysService {
  /**
   * Procesa los eventos de teclado de ventana respetando campos de texto activos
   * y despachando las acciones correspondientes del editor.
   */
  handleKeyDown(event: KeyboardEvent, actions: DiagramHotkeysActions): void {
    if (actions.isModalOpen?.()) {
      if (event.key === 'Escape') {
        if (actions.hasContextMenu()) {
          actions.closeContextMenu();
          event.preventDefault();
          return;
        }
        actions.escape();
        event.preventDefault();
        return;
      }
      // Cuando hay un modal abierto, bloqueamos totalmente los atajos del lienzo
      // (evita que presionar Supr / Delete o atajos eliminen o alteren nodos detrás)
      return;
    }

    const activeTag = (document.activeElement?.tagName || '').toLowerCase();
    const isInputActive = activeTag === 'input' || activeTag === 'textarea';

    if (event.key === 'Escape') {
      if (actions.hasContextMenu()) {
        actions.closeContextMenu();
        event.preventDefault();
        return;
      }
      actions.escape();
      return;
    }

    if (isInputActive) {
      return;
    }

    const isCtrlOrMeta = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    if (isCtrlOrMeta && !event.shiftKey && key === 'z') {
      event.preventDefault();
      actions.undo();
    } else if (isCtrlOrMeta && (key === 'y' || (event.shiftKey && key === 'z'))) {
      event.preventDefault();
      actions.redo();
    } else if (isCtrlOrMeta && key === 's') {
      event.preventDefault();
      if (!actions.isReadOnly()) {
        actions.save();
      }
    } else if (isCtrlOrMeta && key === 'b') {
      event.preventDefault();
      actions.toggleToolbox();
    } else if (isCtrlOrMeta && key === 'i') {
      event.preventDefault();
      actions.toggleAi();
    } else if (isCtrlOrMeta && key === 'c') {
      event.preventDefault();
      actions.copy();
    } else if (isCtrlOrMeta && key === 'x') {
      event.preventDefault();
      actions.cut();
    } else if (isCtrlOrMeta && key === 'v') {
      event.preventDefault();
      actions.paste();
    } else if (isCtrlOrMeta && key === 'd') {
      event.preventDefault();
      actions.duplicate();
    } else if (isCtrlOrMeta && key === 'a') {
      event.preventDefault();
      actions.selectAll();
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      if (!actions.isReadOnly()) {
        event.preventDefault();
        actions.deleteSelected();
      }
    } else if (event.key === 'F2') {
      if (!event.defaultPrevented) {
        const targetId = actions.getRenameTargetNodeId();
        if (targetId && !actions.isReadOnly()) {
          event.preventDefault();
          actions.startRenameNode(targetId);
        }
      }
    }
  }
}
