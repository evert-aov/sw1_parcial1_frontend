import { Injectable, inject, signal } from '@angular/core';
import {
  UmlClassNode,
  UmlConnection,
  UmlLineStyle,
} from '../../../../../core/models/diagram.model';
import { DiagramAlignmentService, AlignmentDirection, DistributionDirection } from '../spatial-engine/diagram-alignment.service';
import { DiagramSelectionService } from '../state-persistence/diagram-selection.service';
import { DiagramNodeOperationsService } from '../uml-domain/diagram-node-operations.service';

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
    this.nodeOps = nodeOps ?? injectedNodeOps ?? new DiagramNodeOperationsService();
  }

  // --- GUÍAS INTELIGENTES ---

  toggleSmartGuides(): void {
    this.smartGuidesEnabled.update((val) => !val);
  }

  // --- COLOR SELECCIONADO ---

  computeSelectedNodeColor(
    selectedNodeId: string | null,
    nodes: UmlClassNode[],
    getDefaultColor: (type?: string | null, stereotype?: string | null) => string,
  ): string | null {
    if (!selectedNodeId) return null;
    const node = nodes.find((n) => n.id === selectedNodeId);
    return node?.color || getDefaultColor(node?.nodeType, node?.stereotype);
  }

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
