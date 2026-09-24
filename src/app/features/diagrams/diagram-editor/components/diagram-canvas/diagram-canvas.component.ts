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
import { heroLockClosed } from '@ng-icons/heroicons/outline';
import { TranslatePipe } from '../../../../../core/i18n';
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
  imports: [CommonModule, FFlowModule, NgIconComponent, TranslatePipe],
  providers: [
    provideIcons({
      heroLockClosed,
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
  readonly activeDiagramType = input<DiagramType>('class');

  // Outputs hacia el contenedor principal
  readonly flowLoaded = output<void>();
  readonly connectionCreated = output<FCreateConnectionEvent>();
  readonly connectionReassigned = output<FReassignConnectionEvent>();
  readonly moveNodes = output<FMoveNodesEvent>();
  readonly selectionChange = output<FSelectionChangeEvent>();
  readonly nodeClick = output<{ nodeId: string; event: MouseEvent }>();
  readonly nodeDblClick = output<{ node: UmlClassNode; event: MouseEvent }>();
  readonly connectionDblClick = output<{ conn: UmlConnection; event: MouseEvent }>();
  readonly deleteNode = output<{ nodeId: string; event: MouseEvent }>();
  readonly tableClick = output<{ nodeId: string; event: MouseEvent }>();
  readonly canvasBackgroundClick = output<MouseEvent | undefined>();
  readonly canvasMouseDown = output<MouseEvent>();
  readonly canvasMouseMove = output<MouseEvent>();
  readonly zoomChange = output<number>();
  readonly viewportScroll = output<Event>();

  readonly zoomLevel = signal<number>(100);

  // Dimensiones dinámicas del tablero Enterprise Architect (mínimo 1500x1000)
  readonly boardWidth = computed(() => {
    let max = 1500;
    for (const node of this.nodes()) {
      if (node.position && node.position.x + 350 > max) {
        max = node.position.x + 350;
      }
    }
    return max;
  });

  readonly boardHeight = computed(() => {
    let max = 1000;
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

  onNodeClick(nodeId: string, event: MouseEvent): void {
    this.nodeClick.emit({ nodeId, event });
  }

  onNodeDblClick(node: UmlClassNode, event: MouseEvent): void {
    this.nodeDblClick.emit({ node, event });
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

  // Helpers de estado visual
  isNodeSelected(nodeId: string): boolean {
    return this.selectedNodeIds().includes(nodeId);
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


  isNodeLockedByOther(nodeId: string): boolean {
    const locks = this.nodeLocks();
    let lock: any;
    if (locks instanceof Map) {
      lock = locks.get(nodeId);
    } else if (locks && typeof locks === 'object') {
      lock = locks[nodeId];
    }
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
