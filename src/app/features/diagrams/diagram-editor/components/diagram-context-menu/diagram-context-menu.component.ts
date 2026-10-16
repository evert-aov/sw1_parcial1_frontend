import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroDocumentDuplicate,
  heroScissors,
  heroSquare2Stack,
  heroClipboardDocument,
  heroPencilSquare,
  heroDocumentText,
  heroSwatch,
  heroTrash,
  heroArrowsRightLeft,
  heroCheck,
  heroSquares2x2,
  heroCursorArrowRays,
  heroMagnifyingGlassPlus,
  heroArrowsPointingOut,
} from '@ng-icons/heroicons/outline';
import { UmlClassNode, UmlConnection, UmlLineStyle } from '../../../../../core/models/diagram.model';

export interface DiagramContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  type: 'node' | 'connection' | 'canvas';
  node?: UmlClassNode;
  connection?: UmlConnection;
  canvasPos?: { x: number; y: number };
}

@Component({
  standalone: true,
  selector: 'app-diagram-context-menu',
  imports: [CommonModule, NgIconComponent],
  viewProviders: [
    provideIcons({
      heroDocumentDuplicate,
      heroScissors,
      heroSquare2Stack,
      heroClipboardDocument,
      heroPencilSquare,
      heroDocumentText,
      heroSwatch,
      heroTrash,
      heroArrowsRightLeft,
      heroCheck,
      heroSquares2x2,
      heroCursorArrowRays,
      heroMagnifyingGlassPlus,
      heroArrowsPointingOut,
    }),
  ],
  templateUrl: './diagram-context-menu.component.html',
})
export class DiagramContextMenuComponent {
  @Input() menu: DiagramContextMenuState | null = null;
  @Input() selectedNodeIdsCount = 0;
  @Input() selectedConnIdsCount = 0;
  @Input() activeDiagramType = 'class';
  @Input() hasClipboard = false;
  @Input() zoomLevel = 100;

  @Output() close = new EventEmitter<void>();
  @Output() copyNodes = new EventEmitter<void>();
  @Output() cutNodes = new EventEmitter<void>();
  @Output() duplicateNodes = new EventEmitter<void>();
  @Output() pasteNodes = new EventEmitter<{ x: number; y: number } | undefined>();
  @Output() editNode = new EventEmitter<UmlClassNode>();
  @Output() renameNode = new EventEmitter<string>();
  @Output() setNodeColor = new EventEmitter<string>();
  @Output() deleteSelected = new EventEmitter<void>();
  @Output() editConnection = new EventEmitter<UmlConnection>();
  @Output() reverseConnection = new EventEmitter<UmlConnection>();
  @Output() setConnectionLineStyle = new EventEmitter<{ connection: UmlConnection; lineStyle: UmlLineStyle }>();
  @Output() selectAll = new EventEmitter<void>();
  @Output() deselectAll = new EventEmitter<void>();
  @Output() resetView = new EventEmitter<void>();
  @Output() fitView = new EventEmitter<void>();

  onClose(): void {
    this.close.emit();
  }

  onCopy(): void {
    this.copyNodes.emit();
    this.close.emit();
  }

  onCut(): void {
    this.cutNodes.emit();
  }

  onDuplicate(): void {
    this.duplicateNodes.emit();
  }

  onPaste(canvasPos?: { x: number; y: number }): void {
    this.pasteNodes.emit(canvasPos);
    this.close.emit();
  }

  onEditNode(node: UmlClassNode): void {
    this.editNode.emit(node);
    this.close.emit();
  }

  onRenameNode(nodeId: string): void {
    this.renameNode.emit(nodeId);
    this.close.emit();
  }

  onSetColor(color: string): void {
    this.setNodeColor.emit(color);
    this.close.emit();
  }

  onDelete(): void {
    this.deleteSelected.emit();
    this.close.emit();
  }

  onEditConn(conn: UmlConnection): void {
    this.editConnection.emit(conn);
    this.close.emit();
  }

  onReverseConn(conn: UmlConnection): void {
    this.reverseConnection.emit(conn);
  }

  onSetLineStyle(conn: UmlConnection, lineStyle: UmlLineStyle): void {
    this.setConnectionLineStyle.emit({ connection: conn, lineStyle });
  }

  onSelectAll(): void {
    this.selectAll.emit();
    this.close.emit();
  }

  onDeselectAll(): void {
    this.deselectAll.emit();
    this.close.emit();
  }

  onResetView(): void {
    this.resetView.emit();
    this.close.emit();
  }

  onFitView(): void {
    this.fitView.emit();
    this.close.emit();
  }
}
