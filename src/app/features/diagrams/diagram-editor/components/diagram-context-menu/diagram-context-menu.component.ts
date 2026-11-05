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
  heroArrowPath,
} from '@ng-icons/heroicons/outline';
import {
  UmlClassNode,
  UmlConnection,
  UmlLineStyle,
  UML_LINE_STYLES,
  UmlLineStyleItem,
} from '../../../../../core/models/diagram.model';

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
      heroArrowPath,
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

  readonly lineStyles: UmlLineStyleItem[] = UML_LINE_STYLES;

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
  @Output() setAllConnectionsLineStyle = new EventEmitter<UmlLineStyle>();
  @Output() selectAll = new EventEmitter<void>();
  @Output() deselectAll = new EventEmitter<void>();
  @Output() resetView = new EventEmitter<void>();
  @Output() fitView = new EventEmitter<void>();

  /**
   * Cierra el menú contextual emitiendo el evento correspondiente.
   */
  onClose(): void {
    this.close.emit();
  }

  /**
   * Ejecuta la acción de copiar elementos seleccionados y cierra el menú.
   */
  onCopy(): void {
    this.copyNodes.emit();
    this.close.emit();
  }

  /**
   * Ejecuta la acción de cortar elementos seleccionados.
   */
  onCut(): void {
    this.cutNodes.emit();
  }

  /**
   * Duplica los elementos seleccionados en el diagrama.
   */
  onDuplicate(): void {
    this.duplicateNodes.emit();
  }

  /**
   * Pega los elementos del portapapeles en la posición del puntero o centro del visor.
   * @param canvasPos Coordenadas relativas al lienzo (opcional).
   */
  onPaste(canvasPos?: { x: number; y: number }): void {
    this.pasteNodes.emit(canvasPos);
    this.close.emit();
  }

  /**
   * Abre el modal de edición de propiedades para el nodo indicado.
   * @param node Nodo UML a editar.
   */
  onEditNode(node: UmlClassNode): void {
    this.editNode.emit(node);
    this.close.emit();
  }

  /**
   * Inicia el modo de renombrado en línea para el nodo especificado.
   * @param nodeId Identificador del nodo.
   */
  onRenameNode(nodeId: string): void {
    this.renameNode.emit(nodeId);
    this.close.emit();
  }

  /**
   * Aplica un nuevo color de fondo al nodo seleccionado.
   * @param color Código hexadecimal o RGB del color.
   */
  onSetColor(color: string): void {
    this.setNodeColor.emit(color);
    this.close.emit();
  }

  /**
   * Emite la orden de eliminación para los elementos seleccionados.
   */
  onDelete(): void {
    this.deleteSelected.emit();
    this.close.emit();
  }

  /**
   * Abre el editor modal para la relación o conexión seleccionada.
   * @param conn Conexión UML a editar.
   */
  onEditConn(conn: UmlConnection): void {
    this.editConnection.emit(conn);
    this.close.emit();
  }

  /**
   * Invierte el origen y destino de la conexión seleccionada.
   * @param conn Conexión UML a invertir.
   */
  onReverseConn(conn: UmlConnection): void {
    this.reverseConnection.emit(conn);
  }

  /**
   * Cambia el estilo de trazado o routing de la conexión.
   * @param conn Conexión afectada.
   * @param lineStyle Nuevo estilo de línea.
   */
  onSetLineStyle(conn: UmlConnection, lineStyle: UmlLineStyle): void {
    this.setConnectionLineStyle.emit({ connection: conn, lineStyle });
  }

  /**
   * Cambia el estilo de todas las líneas del diagrama al estilo indicado a la vez.
   * @param lineStyle Nuevo estilo para todas las conexiones.
   */
  onSetAllLineStyle(lineStyle: UmlLineStyle): void {
    this.setAllConnectionsLineStyle.emit(lineStyle);
    this.close.emit();
  }

  /**
   * Determina si la conexión actual tiene activo el estilo evaluado.
   * @param conn Conexión evaluada.
   * @param styleId Identificador de estilo a cotejar.
   */
  isActiveLineStyle(conn: UmlConnection | undefined, styleId: UmlLineStyle): boolean {
    if (!conn) return false;
    const current = conn.lineStyle || 'orthogonal_square';
    if (styleId === 'orthogonal_square') {
      return current === 'orthogonal_square' || current === 'segment' || !conn.lineStyle;
    }
    if (styleId === 'orthogonal_rounded') {
      return current === 'orthogonal_rounded' || current === 'adaptive-curve';
    }
    return current === styleId;
  }

  /**
   * Selecciona todos los nodos y elementos del diagrama actual.
   */
  onSelectAll(): void {
    this.selectAll.emit();
    this.close.emit();
  }

  /**
   * Deselecciona todos los elementos en el lienzo.
   */
  onDeselectAll(): void {
    this.deselectAll.emit();
    this.close.emit();
  }

  /**
   * Restablece el zoom al 100% y centra la vista en el origen.
   */
  onResetView(): void {
    this.resetView.emit();
    this.close.emit();
  }

  /**
   * Ajusta el zoom y desplazamiento del lienzo para encuadrar todo el contenido.
   */
  onFitView(): void {
    this.fitView.emit();
    this.close.emit();
  }
}
