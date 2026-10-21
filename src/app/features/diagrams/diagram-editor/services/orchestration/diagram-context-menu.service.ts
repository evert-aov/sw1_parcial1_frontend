import { Injectable, signal, inject } from '@angular/core';
import { UmlClassNode, UmlConnection } from '../../../../../core/models/diagram.model';
import { DiagramContextMenuState } from '../../components/diagram-context-menu/diagram-context-menu.component';
import { DiagramSelectionService } from '../state-persistence/diagram-selection.service';

@Injectable({
  providedIn: 'root',
})
export class DiagramContextMenuService {
  private selectionService: DiagramSelectionService;

  readonly contextMenu = signal<DiagramContextMenuState | null>(null);

  constructor(selectionService?: DiagramSelectionService) {
    if (selectionService) {
      this.selectionService = selectionService;
    } else {
      let injected: DiagramSelectionService | null = null;
      try {
        injected = inject(DiagramSelectionService, { optional: true });
      } catch {}
      this.selectionService = injected ?? new DiagramSelectionService();
    }
  }

  /**
   * Cierra el menú contextual activo estableciendo su estado en null.
   */
  closeContextMenu(): void {
    this.contextMenu.set(null);
  }

  /**
   * Abre el menú contextual asociado a un nodo UML, posicionándolo dentro de los límites de la ventana.
   * @param data Datos del nodo, evento de ratón y callbacks de selección/coordenadas.
   */
  onNodeContextMenu(data: {
    node: UmlClassNode;
    event: MouseEvent;
    selectOnCanvas?: (nodeIds: string[], connIds: string[]) => void;
    clientToCanvas?: (x: number, y: number) => { x: number; y: number } | undefined;
  }): void {
    const { node, event, selectOnCanvas, clientToCanvas } = data;

    if (!this.selectionService.selectedNodeIds().has(node.id) && this.selectionService.selectedNodeId() !== node.id) {
      if (event.ctrlKey || event.metaKey || event.shiftKey) {
        const current = new Set(this.selectionService.selectedNodeIds());
        current.add(node.id);
        this.selectionService.selectedNodeIds.set(current);
        this.selectionService.selectedNodeId.set(node.id);
        selectOnCanvas?.(Array.from(current), []);
      } else {
        this.selectionService.selectedNodeIds.set(new Set([node.id]));
        this.selectionService.selectedNodeId.set(node.id);
        this.selectionService.selectedConnId.set(null);
        this.selectionService.selectedConnIds.set(new Set());
        selectOnCanvas?.([node.id], []);
      }
    }

    const menuWidth = 240;
    const menuHeight = 350;
    const winW = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const winH = typeof window !== 'undefined' ? window.innerHeight : 768;
    const x = Math.min(event.clientX, Math.max(10, winW - menuWidth - 10));
    const y = Math.min(event.clientY, Math.max(10, winH - menuHeight - 10));

    this.contextMenu.set({
      visible: true,
      x,
      y,
      type: 'node',
      node,
      canvasPos: clientToCanvas?.(event.clientX, event.clientY),
    });
  }

  onConnectionContextMenu(data: {
    conn: UmlConnection;
    event: MouseEvent;
    selectOnCanvas?: (nodeIds: string[], connIds: string[]) => void;
    clientToCanvas?: (x: number, y: number) => { x: number; y: number } | undefined;
  }): void {
    const { conn, event, selectOnCanvas, clientToCanvas } = data;

    this.selectionService.selectedConnIds.set(new Set([conn.id]));
    this.selectionService.selectedConnId.set(conn.id);
    this.selectionService.selectedNodeId.set(null);
    this.selectionService.selectedNodeIds.set(new Set());
    selectOnCanvas?.([], [conn.id]);

    const menuWidth = 240;
    const menuHeight = 280;
    const winW = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const winH = typeof window !== 'undefined' ? window.innerHeight : 768;
    const x = Math.min(event.clientX, Math.max(10, winW - menuWidth - 10));
    const y = Math.min(event.clientY, Math.max(10, winH - menuHeight - 10));

    this.contextMenu.set({
      visible: true,
      x,
      y,
      type: 'connection',
      connection: conn,
      canvasPos: clientToCanvas?.(event.clientX, event.clientY),
    });
  }

  onCanvasContextMenu(data: {
    event: MouseEvent;
    canvasPos: { x: number; y: number };
  }): void {
    const { event, canvasPos } = data;

    const menuWidth = 240;
    const menuHeight = 260;
    const winW = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const winH = typeof window !== 'undefined' ? window.innerHeight : 768;
    const x = Math.min(event.clientX, Math.max(10, winW - menuWidth - 10));
    const y = Math.min(event.clientY, Math.max(10, winH - menuHeight - 10));

    this.contextMenu.set({
      visible: true,
      x,
      y,
      type: 'canvas',
      canvasPos,
    });
  }
}
