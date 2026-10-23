import { Injectable, inject, signal } from '@angular/core';
import {
  UmlClassNode,
  UmlConnection,
  UmlLineStyle,
} from '../../../../../core/models/diagram.model';
import { DiagramAlignmentService, AlignmentDirection, DistributionDirection } from '../spatial-engine/diagram-alignment.service';
import { DiagramSelectionService } from '../state-persistence/diagram-selection.service';
import { DiagramNodeOperationsService } from '../../../../../core/plugins/contracts/diagram-node-operations.service.contract';

export interface ToolbarTransformContext {
  pushSnapshot: () => void;
  nodes: UmlClassNode[];
  connections: UmlConnection[];
  defaultLineStyle: UmlLineStyle;
  markAsUnsaved: () => void;
  updateConnectionEndpoints: () => void;
  redrawCanvas: () => void;
  sendNodeDrag: (id: string, position: { x: number; y: number }) => void;
  sendDiagramSync: (nodes: UmlClassNode[], connections: UmlConnection[], action: string, style?: UmlLineStyle) => void;
}

export interface ToolbarAlignmentContext {
  isReadOnly: boolean;
  selectedNodeIds: Set<string>;
  nodes: UmlClassNode[];
  getNodeWidth: (n: UmlClassNode) => number;
  getNodeHeight: (n: UmlClassNode) => number;
  onApplyTransformation: (modified: UmlClassNode[], action: string) => void;
}

export interface ToolbarColorContext {
  isReadOnly: boolean;
  selectedNodeIds: string[];
  nodes: UmlClassNode[];
  connections: UmlConnection[];
  defaultLineStyle: UmlLineStyle;
  pushSnapshot: () => void;
  setNodes: (nodes: UmlClassNode[]) => void;
  markAsUnsaved: () => void;
  sendDiagramSync: (nodes: UmlClassNode[], connections: UmlConnection[], action: string, style?: UmlLineStyle) => void;
}

@Injectable({
  providedIn: 'root',
})
export class DiagramToolbarService {
  private readonly alignmentService: DiagramAlignmentService;
  private readonly selectionService: DiagramSelectionService;
  private readonly nodeOps: DiagramNodeOperationsService;

  readonly smartGuidesEnabled = signal<boolean>(true);
  readonly isGridVisible = signal<boolean>(false);

  constructor(
    alignmentService?: DiagramAlignmentService,
    selectionService?: DiagramSelectionService,
    nodeOps?: DiagramNodeOperationsService,
  ) {
    let injectedAlignment: DiagramAlignmentService | null = null;
    let injectedSelection: DiagramSelectionService | null = null;
    let injectedNodeOps: DiagramNodeOperationsService | null = null;
    try {
      injectedAlignment = inject(DiagramAlignmentService, { optional: true });
      injectedSelection = inject(DiagramSelectionService, { optional: true });
      injectedNodeOps = inject(DiagramNodeOperationsService, { optional: true });
    } catch {
      // Fuera de contexto DI de Angular
    }

    this.alignmentService = alignmentService ?? injectedAlignment ?? new DiagramAlignmentService();
    this.selectionService = selectionService ?? injectedSelection ?? new DiagramSelectionService();
    this.nodeOps = nodeOps ?? injectedNodeOps!;
  }

  // --- GUÍAS INTELIGENTES ---

  /**
   * Alterna la habilitación de las guías magnéticas inteligentes de alineación espacial.
   */
  toggleSmartGuides(): void {
    this.smartGuidesEnabled.update((val) => !val);
  }

  /**
   * Alterna la visibilidad de la cuadrícula interactiva sobre el lienzo.
   */
  toggleGrid(): void {
    this.isGridVisible.update((val) => !val);
  }

  // --- COLOR SELECCIONADO ---

  /**
   * Obtiene el color efectivo del nodo seleccionado para sincronizar el selector de color de la barra superior.
   * @param selectedNodeId Identificador del nodo seleccionado.
   * @param nodes Lista de nodos del diagrama.
   * @param getDefaultColor Función resolutora del color por defecto según tipo y estereotipo.
   * @returns Código de color hexadecimal o null si no hay nodo seleccionado.
   */
  computeSelectedNodeColor(
    selectedNodeId: string | null,
    nodes: UmlClassNode[],
    getDefaultColor: (type?: string | null, stereotype?: string | null) => string,
  ): string | null {
    if (!selectedNodeId) return null;
    const node = nodes.find((n) => n.id === selectedNodeId);
    return node?.color || getDefaultColor(node?.nodeType, node?.stereotype);
  }

  /**
   * Aplica un color de fondo a los nodos actualmente seleccionados y emite la sincronización colaborativa.
   * @param color Nuevo color hexadecimal o null para restaurar el color por defecto.
   * @param context Contexto de ejecución con colecciones de nodos, conexiones y callbacks de historial.
   */
  applySelectedNodeColor(color: string | null, context: ToolbarColorContext): void {
    if (context.isReadOnly || context.selectedNodeIds.length === 0) return;

    const { anyChanged, updatedNodes } = this.nodeOps.updateNodesColor(context.nodes, context.selectedNodeIds, color);
    if (!anyChanged) return;

    context.pushSnapshot();
    context.setNodes(updatedNodes);
    context.markAsUnsaved();
    context.sendDiagramSync(updatedNodes, context.connections, 'update_class', context.defaultLineStyle);
  }

  // --- ALINEACIÓN Y DISTRIBUCIÓN ---

  /**
   * Aplica una transformación de posición en bloque a los nodos modificados (alineación o distribución),
   * registrando el snapshot en el historial y sincronizando los cambios con la sala colaborativa.
   * @param modified Nodos modificados con nuevas posiciones espaciales.
   * @param action Nombre semántico de la acción ejecutada.
   * @param context Contexto de la barra de herramientas.
   */
  applyNodesTransformation(modified: UmlClassNode[], action: string, context: ToolbarTransformContext): void {
    if (modified.length === 0) return;
    context.pushSnapshot();
    for (const n of modified) {
      context.sendNodeDrag(n.id, n.position);
    }
    context.markAsUnsaved();
    context.updateConnectionEndpoints();
    context.redrawCanvas();
    context.sendDiagramSync(context.nodes, context.connections, action, context.defaultLineStyle);
  }

  /**
   * Alinea los nodos seleccionados en la dirección indicada (arriba, abajo, izquierda, derecha, etc.).
   * @param direction Dirección de alineación.
   * @param context Contexto de transformación y colecciones de elementos.
   */
  alignNodes(direction: AlignmentDirection, context: ToolbarAlignmentContext): void {
    if (context.isReadOnly || context.selectedNodeIds.size < 2) return;
    const modified = this.alignmentService.alignNodes(
      context.nodes,
      context.selectedNodeIds,
      direction,
      context.getNodeWidth,
      context.getNodeHeight,
    );
    context.onApplyTransformation(modified, 'align_nodes');
  }

  /**
   * Distribuye equitativamente el espacio entre 3 o más nodos seleccionados de forma horizontal o vertical.
   * @param direction Eje de distribución ('horizontal' o 'vertical').
   * @param context Contexto de alineación.
   */
  distributeNodes(direction: DistributionDirection, context: ToolbarAlignmentContext): void {
    if (context.isReadOnly || context.selectedNodeIds.size < 3) return;
    const modified = this.alignmentService.distributeNodes(
      context.nodes,
      context.selectedNodeIds,
      direction,
      context.getNodeWidth,
      context.getNodeHeight,
    );
    context.onApplyTransformation(modified, 'distribute_nodes');
  }

  /**
   * Ajusta las coordenadas de los nodos seleccionados para alinearse a la cuadrícula fija (grid).
   * @param context Contexto de alineación.
   * @param gridSize Tamaño del paso de rejilla en píxeles (por defecto 20).
   */
  snapSelectedToGrid(context: ToolbarAlignmentContext, gridSize = 20): void {
    if (context.isReadOnly) return;
    const modified = this.alignmentService.snapToGrid(context.nodes, context.selectedNodeIds, gridSize);
    context.onApplyTransformation(modified, 'snap_grid');
  }

  // --- SELECCIÓN ---

  selectAllClasses(
    nodes: UmlClassNode[],
    selectedRelationType: any,
    selectOnCanvas: (ids: string[]) => void,
  ): void {
    this.selectionService.selectAllClasses(nodes, selectedRelationType, selectOnCanvas);
  }
}
