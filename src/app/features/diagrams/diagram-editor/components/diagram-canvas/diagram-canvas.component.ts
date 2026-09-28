import {
  Component,
  input,
  output,
  signal,
  computed,
  ViewChild,
  ElementRef,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FFlowModule,
  FFlowComponent,
  FCanvasComponent,
  FZoomDirective,
  FCreateConnectionEvent,
  FReassignConnectionEvent,
  FMoveNodesEvent,
  FSelectionChangeEvent,
  FCanvasChangeEvent,
  FTriggerEvent,
  primaryButtonEventTrigger,
  isOnFlowBackground,
} from '@foblex/flow';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroLockClosed, heroTrash } from '@ng-icons/heroicons/outline';
import {
  UmlClassNode,
  UmlConnection,
  UmlRelationshipType,
  UmlLineStyle,
  DiagramType,
} from '../../../../../core/models/diagram.model';

@Component({
  selector: 'app-diagram-canvas',
  standalone: true,
  imports: [CommonModule, FFlowModule, NgIconComponent],
  host: {
    class: 'flex-1 relative w-full h-full flex flex-col min-h-0 min-w-0 overflow-hidden',
  },
  providers: [
    provideIcons({
      heroLockClosed,
      heroTrash,
    }),
  ],
  templateUrl: './diagram-canvas.component.html',
  styleUrl: './diagram-canvas.component.css',
})
export class DiagramCanvasComponent {
  @ViewChild(FFlowComponent) fFlow?: FFlowComponent;
  @ViewChild(FCanvasComponent) canvas?: FCanvasComponent;
  @ViewChild(FZoomDirective) fZoom?: FZoomDirective;
  @ViewChild('flowContainer') flowContainerRef?: ElementRef<HTMLElement>;
  @ViewChild('boardElement') boardElementRef?: ElementRef<HTMLElement>;

  // Inputs
  readonly nodes = input.required<UmlClassNode[]>();
  readonly connections = input.required<UmlConnection[]>();
  readonly selectedRelationType = input<UmlRelationshipType | null>(null);
  readonly selectedSourceNodeId = input<string | null>(null);
  readonly defaultLineStyle = input<UmlLineStyle>('segment');
  readonly isReadOnly = input<boolean>(false);
  readonly selectedNodeIds = input<string[]>([]);
  readonly selectedConnIds = input<string[]>([]);
  readonly remoteCursors = input<any[]>([]);
  readonly nodeLocks = input<any>({});
  readonly currentUserId = input<string | null>(null);
  readonly diagramId = input<string | null>(null);
  readonly activeDiagramType = input<DiagramType>(DiagramType.CLASS);
  readonly smartGuidesEnabled = input<boolean>(true);

  // Outputs hacia el contenedor principal
  readonly flowLoaded = output<void>();
  readonly connectionCreated = output<FCreateConnectionEvent>();
  readonly connectionReassigned = output<FReassignConnectionEvent>();
  readonly moveNodes = output<FMoveNodesEvent>();
  readonly selectionChange = output<FSelectionChangeEvent>();
  readonly nodePositionChange = output<{ node: UmlClassNode; newPosition: { x: number; y: number } }>();
  readonly nodeSizeChange = output<{ node: UmlClassNode; width: number; height?: number; position: { x: number; y: number } }>();
  readonly nodeClick = output<{ nodeId: string; event: MouseEvent }>();
  readonly nodeDblClick = output<{ node: UmlClassNode; event: MouseEvent }>();
  readonly connectionClick = output<{ connId: string; event: MouseEvent }>();
  readonly connectionDblClick = output<{ conn: UmlConnection; event: MouseEvent }>();
  readonly deleteNode = output<{ nodeId: string; event: MouseEvent }>();
  readonly tableClick = output<{ nodeId: string; event: MouseEvent }>();
  readonly canvasBackgroundClick = output<MouseEvent | undefined>();
  readonly canvasMouseDown = output<MouseEvent>();
  readonly canvasMouseMove = output<MouseEvent>();
  readonly zoomChange = output<number>();
  readonly viewportScroll = output<Event>();
  readonly nodeRename = output<{ nodeId: string; newName: string }>();

  readonly zoomLevel = signal<number>(100);
  readonly hoveredNodeId = signal<string | null>(null);
  readonly renamingNodeId = signal<string | null>(null);

  startRenameNode(nodeId: string): void {
    if (this.isReadOnly() || this.isNodeLockedByOther(nodeId)) return;
    this.renamingNodeId.set(nodeId);
  }

  commitNodeRename(nodeId: string, newName: string): void {
    if (this.renamingNodeId() !== nodeId) return;
    this.renamingNodeId.set(null);
    const trimmed = (newName || '').trim();
    const node = this.nodes().find((n) => n.id === nodeId);
    if (node && trimmed && trimmed !== node.name) {
      this.nodeRename.emit({ nodeId, newName: trimmed });
    }
  }

  cancelNodeRename(): void {
    this.renamingNodeId.set(null);
  }

  onNodeMouseLeave(nodeId: string): void {
    if (this.hoveredNodeId() === nodeId) {
      this.hoveredNodeId.set(null);
    }
  }

  // Dimensiones dinámicas del tablero Enterprise Architect (mínimo 2200x1400 para garantizar scroll bidireccional fluido en pantallas 1080p y superiores)
  readonly boardWidth = computed(() => {
    let max = 2200;
    for (const node of this.nodes()) {
      if (node.position && node.position.x + 350 > max) {
        max = node.position.x + 350;
      }
    }
    return max;
  });

  readonly boardHeight = computed(() => {
    let max = 1400;
    for (const node of this.nodes()) {
      if (node.position && node.position.y + 350 > max) {
        max = node.position.y + 350;
      }
    }
    return max;
  });

  // Triggers Foblex Flow
  readonly canvasMoveTrigger = () => false;
  readonly zoomWheelTrigger = (e: any): boolean =>
    (e instanceof WheelEvent || (e && 'ctrlKey' in e)) && (e.ctrlKey || e.metaKey);
  readonly dblClickZoomTrigger = () => false;
  readonly selectionAreaTrigger = (event: FTriggerEvent) =>
    primaryButtonEventTrigger(event) && isOnFlowBackground(event);

  onFlowLoaded(): void {
    this.flowLoaded.emit();
    this.syncZoomFromCanvas();
    requestAnimationFrame(() => {
      this.restoreViewportScroll(this.diagramId());
    });
  }

  onConnectionCreated(event: FCreateConnectionEvent): void {
    this.connectionCreated.emit(event);
  }

  onConnectionReassigned(event: FReassignConnectionEvent): void {
    this.connectionReassigned.emit(event);
  }

  onMoveNodes(event: FMoveNodesEvent): void {
    this.moveNodes.emit(event);
  }

  onSelectionChange(event: FSelectionChangeEvent): void {
    this.selectionChange.emit(event);
  }

  onNodePositionChange(node: UmlClassNode, newPosition: { x: number; y: number }): void {
    this.nodePositionChange.emit({ node, newPosition });
  }

  onNodeClick(nodeId: string, event: MouseEvent): void {
    this.nodeClick.emit({ nodeId, event });
  }

  onNodeDblClick(node: UmlClassNode, event: MouseEvent): void {
    this.nodeDblClick.emit({ node, event });
  }

  onConnectionClick(connId: string, event: MouseEvent): void {
    this.connectionClick.emit({ connId, event });
  }

  onConnectionDblClick(conn: UmlConnection, event: MouseEvent): void {
    this.connectionDblClick.emit({ conn, event });
  }

  onDeleteNode(nodeId: string, event: MouseEvent): void {
    this.deleteNode.emit({ nodeId, event });
  }

  onTableClick(nodeId: string, event: MouseEvent): void {
    this.tableClick.emit({ nodeId, event });
  }

  onCanvasMouseDown(event: MouseEvent): void {
    this.canvasMouseDown.emit(event);
  }

  onCanvasMouseMove(event: MouseEvent): void {
    this.canvasMouseMove.emit(event);
  }

  onCanvasBackgroundClick(event?: MouseEvent): void {
    this.canvasBackgroundClick.emit(event);
  }

  onViewportScroll(event: Event): void {
    this.viewportScroll.emit(event);
    const el = this.flowContainerRef?.nativeElement;
    const dId = this.diagramId();
    if (el && dId) {
      sessionStorage.setItem(
        `diagram_scroll_${dId}`,
        JSON.stringify({ left: el.scrollLeft, top: el.scrollTop }),
      );
    }
  }

  onCanvasChange(event?: FCanvasChangeEvent): void {
    if (event?.scale != null) {
      const pct = Math.round(event.scale * 100);
      this.zoomLevel.set(pct);
      this.zoomChange.emit(pct);
    }
  }

  syncZoomFromCanvas(): void {
    if (this.canvas?.transform?.scale != null) {
      const pct = Math.round(this.canvas.transform.scale * 100);
      this.zoomLevel.set(pct);
      this.zoomChange.emit(pct);
    }
  }

  zoomIn(): void {
    this.fZoom?.zoomIn();
    requestAnimationFrame(() => {
      this.syncZoomFromCanvas();
    });
  }

  zoomOut(): void {
    this.fZoom?.zoomOut();
    requestAnimationFrame(() => {
      this.syncZoomFromCanvas();
    });
  }

  resetView(): void {
    if (this.canvas) {
      this.canvas.resetScale();
      if (this.canvas.transform) {
        this.canvas.transform.position = { x: 0, y: 0 };
        this.canvas.transform.scaledPosition = { x: 0, y: 0 };
        this.canvas.redraw();
      }
    } else if (this.fZoom) {
      this.fZoom.reset();
    }
    this.zoomLevel.set(100);
    this.zoomChange.emit(100);
    this.centerViewportOnBoard();
    requestAnimationFrame(() => {
      this.syncZoomFromCanvas();
    });
  }

  fitView(): void {
    this.resetView();
  }

  restoreViewportScroll(diagramId: string | null): void {
    if (!diagramId) return;
    const saved = sessionStorage.getItem(`diagram_scroll_${diagramId}`);
    if (saved && this.flowContainerRef?.nativeElement) {
      try {
        const { left, top } = JSON.parse(saved);
        this.flowContainerRef.nativeElement.scrollLeft = left;
        this.flowContainerRef.nativeElement.scrollTop = top;
        return;
      } catch (_) {}
    }
    this.centerViewportOnBoard();
  }

  centerViewportOnBoard(): void {
    const el = this.flowContainerRef?.nativeElement;
    if (!el) return;
    el.scrollLeft = 0;
    el.scrollTop = 0;
  }

  redraw(): void {
    this.fFlow?.redraw();
    this.canvas?.redraw();
  }

  reset(): void {
    this.fFlow?.reset();
    this.fFlow?.redraw();
    this.canvas?.redraw();
  }

  select(nodeIds: string[], connIds: string[] = []): void {
    this.fFlow?.select(nodeIds, connIds);
  }

  clearSelection(): void {
    this.fFlow?.clearSelection();
  }

  getExportElement(): HTMLElement | undefined {
    return this.boardElementRef?.nativeElement || this.flowContainerRef?.nativeElement;
  }

  // Ancho dinámico adaptativo para elementos UML según su tipo y contenido
  getNodeWidth(node: UmlClassNode): number {
    if (node.isAnchor) return 0;
    if (node.width && node.width > 0) {
      return node.width;
    }
    if (node.nodeType === 'actor') {
      return 90;
    }
    if (node.nodeType === 'use_case') {
      const nameLen = (node.name || '').length;
      return Math.max(160, Math.round(nameLen * 7.5 + 50));
    }
    const CHAR_W = 7.2;
    let maxLen = (node.name || '').length + 3;
    for (const attr of node.attributes || []) {
      const len = 2 + (attr.name || '').length + 2 + (attr.type || '').length;
      if (len > maxLen) maxLen = len;
    }
    for (const m of node.methods || []) {
      const len = 2 + (m.name || '').length + 1 + (m.parameters || '').length + 3 + (m.returnType || 'void').length;
      if (len > maxLen) maxLen = len;
    }
    const computed = Math.round(maxLen * CHAR_W + 28);
    return Math.max(130, computed);
  }

  // Alto dinámico adaptativo para elementos UML según su tipo y contenido
  getNodeHeight(node: UmlClassNode): number {
    if (node.isAnchor) return 0;
    if (node.height && node.height > 0) {
      return node.height;
    }
    if (node.nodeType === 'actor') {
      return 110;
    }
    if (node.nodeType === 'use_case') {
      return 75;
    }
    // Para clases UML: cabecera (~34px) + cuerpo de atributos + métodos
    const headerH = 34;
    const attrsCount = (node.attributes || []).length;
    const methodsCount = (node.methods || []).length;
    const attrsH = attrsCount > 0 ? attrsCount * 20 + 12 : 28;
    const methodsH = methodsCount > 0 ? methodsCount * 20 + 12 : 0;
    return headerH + attrsH + methodsH;
  }

  getNodeSize(node: UmlClassNode): { width: number; height: number } | undefined {
    if (node.isAnchor) return undefined;
    return {
      width: this.getNodeWidth(node),
      height: this.getNodeHeight(node),
    };
  }

  onNodeSizeChange(node: UmlClassNode, rect: any): void {
    if (node.isAnchor || this.isReadOnly() || this.isNodeLockedByOther(node.id)) return;
    if (!rect) return;
    const minW = node.nodeType === 'actor' ? 60 : (node.nodeType === 'use_case' ? 100 : 120);
    const minH = node.nodeType === 'actor' ? 80 : (node.nodeType === 'use_case' ? 50 : 60);
    const width = Math.max(minW, Math.round(rect.width));
    const height = Math.max(minH, Math.round(rect.height));
    const position = {
      x: typeof rect.x === 'number' ? Math.round(rect.x) : node.position.x,
      y: typeof rect.y === 'number' ? Math.round(rect.y) : node.position.y,
    };
    node.width = width;
    node.height = height;
    node.position = position;
    this.nodeSizeChange.emit({ node, width, height, position });
  }

  // Helpers de estado visual
  shouldShowMultiplicity(conn: UmlConnection): boolean {
    if (this.activeDiagramType() === DiagramType.USE_CASE) return false;
    if (
      conn.type === 'generalization' ||
      conn.type === 'realization' ||
      conn.type === 'include' ||
      conn.type === 'extend' ||
      conn.type === 'association_class' ||
      !!conn.assocAnchorNodeId
    ) {
      return false;
    }
    const sourceBase = conn.sourceNodeId || conn.sourceId.replace(/_(top|bottom|left|right)$/, '');
    const targetBase = conn.targetNodeId || conn.targetId.replace(/_(top|bottom|left|right)$/, '');
    const nodeMap = new Map(this.nodes().map((n) => [n.id, n]));
    const sNode = nodeMap.get(sourceBase);
    const tNode = nodeMap.get(targetBase);
    if (sNode && (sNode.nodeType === 'actor' || sNode.nodeType === 'use_case')) return false;
    if (tNode && (tNode.nodeType === 'actor' || tNode.nodeType === 'use_case')) return false;
    return true;
  }

  isNodeSelected(nodeId: string): boolean {
    return this.selectedNodeIds().includes(nodeId);
  }

  hasMultipleSelected(): boolean {
    return this.selectedNodeIds().length > 1;
  }

  isConnectionSelected(connId: string): boolean {
    return this.selectedConnIds().includes(connId);
  }

  isConnectionDimmed(connId: string): boolean {
    const selNodes = this.selectedNodeIds();
    if (selNodes.length === 0) return false;
    const conn = this.connections().find((c) => c.id === connId);
    if (!conn) return false;
    const sId = conn.sourceNodeId || conn.sourceId.replace(/_(top|right|bottom|left)$/, '');
    const tId = conn.targetNodeId || conn.targetId.replace(/_(top|right|bottom|left)$/, '');
    return !selNodes.includes(sId) && !selNodes.includes(tId);
  }

  isNeighborNode(nodeId: string): boolean {
    const selNodes = this.selectedNodeIds();
    if (selNodes.length === 0 || selNodes.includes(nodeId)) return false;
    return this.connections().some((c) => {
      const sId = c.sourceNodeId || c.sourceId.replace(/_(top|right|bottom|left)$/, '');
      const tId = c.targetNodeId || c.targetId.replace(/_(top|right|bottom|left)$/, '');
      return (selNodes.includes(sId) && tId === nodeId) || (selNodes.includes(tId) && sId === nodeId);
    });
  }

  getNodeLock(nodeId: string): any {
    const locks = this.nodeLocks();
    if (locks instanceof Map) {
      return locks.get(nodeId);
    } else if (locks && typeof locks === 'object') {
      return locks[nodeId];
    }
    return null;
  }

  isNodeLockedByOther(nodeId: string): boolean {
    const lock = this.getNodeLock(nodeId);
    const myId = this.currentUserId();
    return !!lock && lock.userId !== myId;
  }

  isDiamondAtStart(conn: UmlConnection): boolean {
    return conn.type === 'composition' || conn.type === 'aggregation';
  }

  isRecursiveConn(conn: UmlConnection): boolean {
    const sId = conn.sourceNodeId || conn.sourceId.replace(/_(top|right|bottom|left)$/, '');
    const tId = conn.targetNodeId || conn.targetId.replace(/_(top|right|bottom|left)$/, '');
    return sId === tId;
  }

  getConnSide(
    connectorId: string | undefined,
    defaultSide: 'top' | 'right' | 'bottom' | 'left' = 'top',
  ): 'top' | 'right' | 'bottom' | 'left' {
    if (!connectorId) return defaultSide;
    if (connectorId.endsWith('_top')) return 'top';
    if (connectorId.endsWith('_right')) return 'right';
    if (connectorId.endsWith('_bottom')) return 'bottom';
    if (connectorId.endsWith('_left')) return 'left';
    return defaultSide;
  }
}
