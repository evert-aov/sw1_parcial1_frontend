import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CalculateAdaptiveCurveData,
  CalculateBezierCurveData,
  CalculateSegmentLineData,
  CalculateStraightLineData,
  EFCanvasLayer,
  EFConnectionBehavior,
  EFConnectionConnectableSide,
  EFConnectionType,
  FCanvasComponent,
  FCreateConnectionEvent,
  FEventTrigger,
  FFlowComponent,
  FFlowModule,
  FMoveNodesEvent,
  FReassignConnectionEvent,
  FSelectionChangeEvent,
  FTriggerEvent,
  FZoomDirective,
  F_CONNECTION_BUILDERS,
  isOnFlowBackground,
  primaryButtonEventTrigger,
} from '@foblex/flow';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroChatBubbleLeftRight,
  heroCpuChip,
  heroCube,
  heroFolder,
  heroLockClosed,
  heroPencilSquare,
  heroPlus,
  heroServer,
  heroTrash,
  heroUser,
} from '@ng-icons/heroicons/outline';
import {
  DiagramType,
  sanitizeLineStyle,
  UmlClassNode,
  UmlConnection,
  UmlLineStyle,
  UmlMessage,
  UmlRelationshipType,
} from '../../../../../core/models/diagram.model';
import { NodeLock, RemoteCursor } from '../../../../../core/services/collaboration.service';
import { TranslatePipe, TranslationService } from '../../../../../core/i18n';
import {
  ConnectionMarkerSvgComponent,
  UmlMarkerConfig,
} from '../uml-svg/connection-marker-svg.component';
import { UML_CANVAS_NODE_COMPONENTS } from './nodes';
import { DeploymentColors } from './nodes/uml-deployment-node/uml-deployment-node.component';
import { DiagramCanvasGeometryService } from './services/diagram-canvas-geometry.service';
import { DiagramCanvasDragService } from './services/diagram-canvas-drag.service';
import { DiagramNodeResizeService } from '../../services/diagram-node-resize.service';
import {
  DiagramSequenceActivationService,
  SequenceActivationInterval,
} from '../../services/diagram-sequence-activation.service';
import {
  computeBoardHeight,
  computeBoardWidth,
  getDynamicNodeWidth,
  getNodeHeight,
  getNodeWidth,
} from '../../utils/node-metrics.util';
import { ConnectionCascadeUtil } from '../../utils/connection-cascade.util';

/**
 * Estado exportable de cámara y scroll del lienzo para preservar la vista entre pestañas.
 */
export interface DiagramCanvasViewState {
  zoom: number;
  scrollLeft: number;
  scrollTop: number;
}

/**
 * Lienzo interactivo de diagramación UML 2.5 basado en `@foblex/flow`.
 * Orquesta la representación visual de nodos, relaciones, cursores remotos y bloqueos colaborativos.
 */
@Component({
  selector: 'app-diagram-canvas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FFlowModule,
    NgIconComponent,
    TranslatePipe,
    ConnectionMarkerSvgComponent,
    ...UML_CANVAS_NODE_COMPONENTS,
  ],
  providers: [
    DiagramCanvasGeometryService,
    DiagramCanvasDragService,
    {
      provide: F_CONNECTION_BUILDERS,
      useValue: {
        'tree_horizontal': new CalculateSegmentLineData(),
        'tree_vertical': new CalculateSegmentLineData(),
        'orthogonal': new CalculateSegmentLineData(),
        'curved': new CalculateBezierCurveData(),
        'smooth': new CalculateAdaptiveCurveData(),
      },
    },
    provideIcons({
      heroLockClosed,
      heroPencilSquare,
      heroPlus,
      heroTrash,
      heroFolder,
      heroUser,
      heroChatBubbleLeftRight,
      heroCube,
      heroServer,
      heroCpuChip,
    }),
  ],
  host: {
    '(window:keydown)': 'onWindowKeyDown($event)',
    '(window:keyup)': 'onWindowKeyUp($event)',
    '(window:mouseup)': 'onWindowMouseUp($event)',
  },
  templateUrl: './diagram-canvas.component.html',
  styleUrl: './diagram-canvas.component.css',
})
export class DiagramCanvasComponent {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translationService = inject(TranslationService);
  private readonly geometryService = inject(DiagramCanvasGeometryService);
  private readonly dragService = inject(DiagramCanvasDragService);
  private readonly nodeResizeService = inject(DiagramNodeResizeService);
  private readonly sequenceActivationService = inject(DiagramSequenceActivationService);

  readonly eConnectionBehavior = EFConnectionBehavior;
  readonly eConnectionType = EFConnectionType;
  readonly eConnectableSide = EFConnectionConnectableSide;
  readonly DiagramType = DiagramType;

  @ViewChild('flowContainer') flowContainerRef?: ElementRef<HTMLElement>;
  @ViewChild('boardElement') boardElementRef?: ElementRef<HTMLElement>;
  @ViewChild(FFlowComponent) flow?: FFlowComponent;
  @ViewChild(FCanvasComponent) canvas?: FCanvasComponent;
  @ViewChild(FZoomDirective) zoomDirective?: FZoomDirective;

  readonly nodes = input<UmlClassNode[]>([]);
  readonly connections = input<UmlConnection[]>([]);
  readonly selectedRelationType = input<UmlRelationshipType | null>(null);
  readonly selectedSourceNodeId = input<string | null>(null);
  readonly defaultLineStyle = input<UmlLineStyle>('segment');
  readonly isReadOnly = input<boolean>(false);
  readonly selectedNodeIds = input<string[]>([]);
  readonly selectedConnIds = input<string[]>([]);
  readonly remoteCursors = input<RemoteCursor[]>([]);
  readonly nodeLocks = input<Map<string, NodeLock>>(new Map());
  readonly currentUserId = input<string | null>(null);
  readonly diagramId = input<string | null>(null);
  readonly activeDiagramType = input<DiagramType>(DiagramType.CLASS);
  readonly smartGuidesEnabled = input<boolean>(true);

  readonly flowLoaded = output<void>();
  readonly connectionCreated = output<FCreateConnectionEvent>();
  readonly connectionReassigned = output<FReassignConnectionEvent>();
  readonly moveNodes = output<FMoveNodesEvent>();
  readonly selectionChange = output<FSelectionChangeEvent>();
  readonly nodePositionChange = output<{ node: UmlClassNode; newPosition: { x: number; y: number } }>();
  readonly nodeSizeChange = output<{ node: UmlClassNode; width: number; height: number; position: { x: number; y: number } }>();
  readonly nodeClick = output<{ nodeId: string; event: MouseEvent }>();
  readonly nodeDblClick = output<{ node: UmlClassNode; event: MouseEvent }>();
  readonly connectionClick = output<{ connId: string; event: MouseEvent }>();
  readonly connectionDblClick = output<{ conn: UmlConnection; event: MouseEvent }>();
  readonly deleteNode = output<{ nodeId: string; event: MouseEvent }>();
  readonly tableClick = output<{ nodeId: string; event: MouseEvent }>();
  readonly canvasBackgroundClick = output<MouseEvent>();
  readonly canvasMouseDown = output<MouseEvent>();
  readonly canvasMouseMove = output<MouseEvent>();
  readonly zoomChange = output<number>();
  readonly viewportScroll = output<Event>();
  readonly nodeRename = output<{ nodeId: string; newName: string }>();
  readonly nodeLabelOffsetChange = output<{ node: UmlClassNode; offset: { x: number; y: number } }>();
  readonly sequenceMessageMove = output<{ connectionId: string; targetSlot: number }>();
  readonly nodeDropped = output<{ type: string; payload: any; position: { x: number; y: number } }>();
  readonly nodeContextMenu = output<{ node: UmlClassNode; event: MouseEvent }>();
  readonly connectionContextMenu = output<{ conn: UmlConnection; event: MouseEvent }>();
  readonly canvasContextMenu = output<{ event: MouseEvent; canvasPos: { x: number; y: number } }>();

  readonly zoomLevel = signal<number>(100);
  readonly isDragOverCanvas = signal<boolean>(false);
  readonly hoveredNodeId = signal<string | null>(null);
  readonly renamingNodeId = signal<string | null>(null);
  readonly isDraggingLabel = signal<boolean>(false);
  readonly draggingLabelNodeId = signal<string | null>(null);
  readonly isDraggingSeqMessage = signal<boolean>(false);
  readonly draggingSeqMessageConnId = signal<string | null>(null);
  readonly draggingSeqMessageDeltaY = signal<number>(0);
  readonly draggingSeqMessageTargetSlot = signal<number>(0);
  readonly isSpacePressed = signal<boolean>(false);

  readonly canvasLayers: EFCanvasLayer[] = [EFCanvasLayer.GROUPS, EFCanvasLayer.NODES, EFCanvasLayer.CONNECTIONS];

  readonly sequenceSlots = Array.from({ length: 25 }, (_, i) => i);
  readonly isSequenceSlotOccupiedFn = (slot: number): boolean =>
    this.sequenceActivationService.isSequenceSlotOccupied(slot, this.connections(), this.activeDiagramType());
  readonly getSlotTopFn = (slot: number, node?: UmlClassNode): number =>
    160 + slot * 50 - (node?.nodeType === 'actor' ? 95 : 60);

  readonly scaledBoardWidth = computed(() => Math.round(computeBoardWidth(this.nodes()) * (this.zoomLevel() / 100)));
  readonly scaledBoardHeight = computed(() => Math.round(computeBoardHeight(this.nodes()) * (this.zoomLevel() / 100)));
  readonly hasNoRealNodes = computed(() => !this.nodes().some((n) => !n.isAnchor));
  readonly canvasEmptyStateMessage = computed(() =>
    this.translationService.translate(this.geometryService.getEmptyStateMessageKey(this.activeDiagramType())),
  );

  readonly isPanning = signal<boolean>(false);
  private panStart = { x: 0, y: 0, scrollLeft: 0, scrollTop: 0 };

  readonly canvasMoveTrigger: FEventTrigger = () => false;
  readonly multiSelectTrigger: FEventTrigger = (event: FTriggerEvent) =>
    event.ctrlKey || event.metaKey || event.shiftKey;
  readonly canvasWheelTrigger: FEventTrigger = () => false;
  readonly dblClickZoomTrigger: FEventTrigger = () => false;
  readonly selectionAreaTrigger: FEventTrigger = (event: FTriggerEvent) => {
    if (this.selectedRelationType() !== null || this.isReadOnly() || this.isSpacePressed() || this.isPanning()) {
      return false;
    }
    return primaryButtonEventTrigger(event) && isOnFlowBackground(event);
  };

  // --- DELEGACIÓN GEOMÉTRICA Y VISUAL ---

  getNodeWidth(node: UmlClassNode): number { return getNodeWidth(node); }
  getNodeHeight(node: UmlClassNode): number { return getNodeHeight(node); }
  getNodeSize(node: UmlClassNode): { width: number; height: number } { return this.geometryService.getNodeSize(node); }
  getNodeZIndex(node: UmlClassNode): number { return this.geometryService.getNodeZIndex(node, this.isNodeSelected(node.id)); }
  getBottomConnectorOffset(node: UmlClassNode): number { return this.geometryService.getBottomConnectorOffset(node); }
  getMarkerConfig(relationType: UmlRelationshipType | string | null | undefined, isStartDiamond = false): UmlMarkerConfig {
    return this.geometryService.getMarkerConfig(relationType, isStartDiamond);
  }
  isDiamondAtStart(conn: UmlConnection): boolean { return this.geometryService.isDiamondAtStart(conn); }
  isSequenceConnection(conn: UmlConnection): boolean { return this.geometryService.isSequenceConnection(conn, this.activeDiagramType()); }
  isRecursiveConn(conn: UmlConnection): boolean { return this.geometryService.isRecursiveConn(conn); }
  isFloatingConn(conn: UmlConnection): boolean { return this.geometryService.isFloatingConn(conn); }
  isReplyConnection(conn: UmlConnection): boolean { return this.sequenceActivationService.isReplyConnection(conn); }
  getConnSide(connectorId: string | undefined, defaultSide: 'top' | 'right' | 'bottom' | 'left' = 'right'): 'top' | 'right' | 'bottom' | 'left' {
    return this.geometryService.getConnSide(connectorId, defaultSide);
  }

  getConnectionType(conn: UmlConnection): 'segment' | 'straight' | 'bezier' | 'adaptive-curve' {
    if (this.isSequenceConnection(conn) && !this.isRecursiveConn(conn)) {
      return 'straight';
    }
    return sanitizeLineStyle(conn?.lineStyle, this.defaultLineStyle() || 'segment');
  }

  getConnectionBehavior(conn: UmlConnection): 'floating' | 'fixed' {
    if (this.isRecursiveConn(conn)) return 'fixed';
    return this.isFloatingConn(conn) ? 'floating' : 'fixed';
  }

  getConnectionOutputSide(conn: UmlConnection): 'default' | 'top' | 'right' | 'bottom' | 'left' {
    if (this.isRecursiveConn(conn)) {
      return this.getConnSide(conn.sourceId, 'top');
    }
    if (this.isFloatingConn(conn)) {
      return 'default';
    }
    return this.getConnSide(conn.sourceId, 'right');
  }

  getConnectionInputSide(conn: UmlConnection): 'default' | 'top' | 'right' | 'bottom' | 'left' {
    if (this.isRecursiveConn(conn)) {
      return this.getConnSide(conn.targetId, 'right');
    }
    if (this.isFloatingConn(conn)) {
      return 'default';
    }
    return this.getConnSide(conn.targetId, 'left');
  }
  getAssemblyAngle(conn: UmlConnection): number {
    return this.geometryService.getAssemblyAngle(conn, this.nodes(), this.boardElementRef?.nativeElement);
  }
  shouldShowMultiplicity(conn: UmlConnection): boolean {
    return this.geometryService.shouldShowMultiplicity(conn, this.activeDiagramType());
  }
  getSequenceConnColor(conn: UmlConnection): string { return this.geometryService.getSequenceConnColor(conn); }
  getSequenceMessageTransform(conn: UmlConnection): string {
    return this.geometryService.getSequenceMessageTransform(
      conn,
      this.isDraggingSeqMessage(),
      this.draggingSeqMessageConnId(),
      this.draggingSeqMessageDeltaY(),
    );
  }
  isGroupInitiator(conn: UmlConnection): boolean { return this.geometryService.isGroupInitiator(conn); }
  getGroupMemberCount(conn: UmlConnection): number { return this.geometryService.getGroupMemberCount(conn, this.connections()); }
  hasForwardMessages(conn: UmlConnection): boolean { return this.geometryService.hasForwardMessages(conn); }
  getForwardMessages(conn: UmlConnection): UmlMessage[] { return this.geometryService.getForwardMessages(conn); }
  hasReverseMessages(conn: UmlConnection): boolean { return this.geometryService.hasReverseMessages(conn); }
  getReverseMessages(conn: UmlConnection): UmlMessage[] { return this.geometryService.getReverseMessages(conn); }
  getCommMessageColor(msg: UmlMessage): string { return this.geometryService.getCommMessageColor(msg); }
  isDeploymentNode(node: UmlClassNode): boolean { return this.geometryService.isDeploymentNode(node); }
  getDeploymentHeight(node: UmlClassNode): number { return this.geometryService.getDeploymentHeight(node); }
  getDeploymentFrontWidth(node: UmlClassNode): number { return this.geometryService.getDeploymentFrontWidth(node); }
  getDeploymentFrontHeight(node: UmlClassNode): number { return this.geometryService.getDeploymentFrontHeight(node); }
  getDeploymentColors(node: UmlClassNode): DeploymentColors { return this.geometryService.getDeploymentColors(node); }
  getPackageTabTitle(node: UmlClassNode): string { return this.geometryService.getPackageTabTitle(node); }
  getPackageBodyText(node: UmlClassNode): string { return this.geometryService.getPackageBodyText(node); }
  getLabelTransform(node: UmlClassNode): string { return this.geometryService.getLabelTransform(node); }
  hasLabelOffset(node: UmlClassNode): boolean { return this.geometryService.hasLabelOffset(node); }
  getLifelineLength(node: UmlClassNode): number { return this.sequenceActivationService.getLifelineLength(node, this.connections()); }
  getNodeActivations(node: UmlClassNode): SequenceActivationInterval[] {
    return this.sequenceActivationService.getNodeActivations(node, this.connections(), this.activeDiagramType());
  }

  // --- SELECCIÓN Y BLOQUEOS COLABORATIVOS ---

  getNodeLock(nodeId: string): NodeLock | undefined { return this.nodeLocks()?.get(nodeId); }
  isNodeLockedByOther(nodeId: string): boolean {
    const lock = this.getNodeLock(nodeId);
    return !!lock && lock.userId !== this.currentUserId();
  }
  isNodeSelected(nodeId: string): boolean { return this.selectedNodeIds().includes(nodeId); }
  isConnectionSelected(connId: string): boolean {
    if (this.selectedConnIds().includes(connId)) return true;
    const primaryNode = this.selectedNodeIds().length === 1 ? this.selectedNodeIds()[0] : null;
    return ConnectionCascadeUtil.isConnectionSelected(connId, this.connections(), primaryNode);
  }
  isConnectionDimmed(connId: string): boolean {
    const ids = this.selectedNodeIds();
    return ConnectionCascadeUtil.isConnectionDimmed(connId, this.connections(), ids[0] || null, ids.length > 1);
  }
  isNeighborNode(nodeId: string): boolean {
    const ids = this.selectedNodeIds();
    return ConnectionCascadeUtil.isNeighborNode(nodeId, this.connections(), ids[0] || null, ids.length > 1);
  }

  // --- MANEJADORES DE EVENTOS DE NODOS Y CONEXIONES ---

  onFlowLoaded(): void { this.flowLoaded.emit(); }
  onConnectionCreated(event: FCreateConnectionEvent): void { this.connectionCreated.emit(event); }
  onConnectionReassigned(event: FReassignConnectionEvent): void { this.connectionReassigned.emit(event); }
  onMoveNodes(event: FMoveNodesEvent): void { this.moveNodes.emit(event); }
  onSelectionChange(event: FSelectionChangeEvent): void { this.selectionChange.emit(event); }
  onViewportScroll(event: Event): void { this.viewportScroll.emit(event); }
  onCanvasMouseDown(event: MouseEvent): void {
    if (event.button === 1 || (this.isSpacePressed() && event.button === 0)) {
      const container = this.flowContainerRef?.nativeElement;
      if (container) {
        this.isPanning.set(true);
        this.panStart = {
          x: event.clientX,
          y: event.clientY,
          scrollLeft: container.scrollLeft,
          scrollTop: container.scrollTop,
        };
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }
    this.canvasMouseDown.emit(event);
  }
  onCanvasMouseMove(event: MouseEvent): void {
    if (this.isPanning()) {
      const container = this.flowContainerRef?.nativeElement;
      if (container) {
        const dx = event.clientX - this.panStart.x;
        const dy = event.clientY - this.panStart.y;
        container.scrollLeft = this.panStart.scrollLeft - dx;
        container.scrollTop = this.panStart.scrollTop - dy;
        return;
      }
    }
    this.canvasMouseMove.emit(event);
  }
  onCanvasBackgroundClick(event: MouseEvent): void { this.canvasBackgroundClick.emit(event); }
  onFlowPointerDown(_event: PointerEvent): void {}
  onFlowClick(_event: MouseEvent): void {}
  onFlowDblClick(_event: MouseEvent): void {}

  onCanvasChange(event?: { scale?: number }): void {
    if (event?.scale != null) {
      const nextZoom = Math.round(event.scale * 100);
      if (nextZoom !== this.zoomLevel()) {
        this.zoomLevel.set(nextZoom);
        this.zoomChange.emit(nextZoom);
      }
    }
  }

  onNodeSizeChange(_node: UmlClassNode, _rect: unknown): void {}
  onNodePositionChange(node: UmlClassNode, newPosition: { x: number; y: number }): void {
    this.nodePositionChange.emit({ node, newPosition });
  }
  onNodeMouseLeave(nodeId: string): void {
    if (this.hoveredNodeId() === nodeId) this.hoveredNodeId.set(null);
  }
  onNodeClick(nodeId: string, event: MouseEvent): void {
    if (this.isDraggingLabel()) return;
    this.nodeClick.emit({ nodeId, event });
  }
  onNodeDblClick(node: UmlClassNode, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.isReadOnly() && !this.isNodeLockedByOther(node.id)) {
      this.nodeDblClick.emit({ node, event });
    }
  }
  onNodeContextMenu(node: UmlClassNode, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.nodeContextMenu.emit({ node, event });
  }
  onDeleteNode(nodeId: string, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.isReadOnly() && !this.isNodeLockedByOther(nodeId)) {
      this.deleteNode.emit({ nodeId, event });
    }
  }
  onTableClick(nodeId: string, event: MouseEvent): void {
    this.tableClick.emit({ nodeId, event });
  }
  onConnectionPointerDown(_connId: string, event: PointerEvent): void {
    event.stopPropagation();
  }
  onConnectionClick(connId: string, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.isDraggingSeqMessage()) {
      this.connectionClick.emit({ connId, event });
    }
  }
  onConnectionDblClick(conn: UmlConnection, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.isReadOnly()) {
      this.connectionDblClick.emit({ conn, event });
    }
  }
  onConnectionContextMenu(conn: UmlConnection, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.connectionContextMenu.emit({ conn, event });
  }
  onCanvasContextMenu(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target?.closest('[fNode]') || target?.closest('.f-connection')) return;
    event.preventDefault();
    const canvasPos = this.clientToCanvasPosition(event.clientX, event.clientY);
    this.canvasContextMenu.emit({ event, canvasPos });
  }

  // --- RENOMBRADO EN LÍNEA, REDIMENSIONAMIENTO Y ARRASTRE ---

  startRenameNode(nodeId: string): void {
    if (this.isReadOnly() || this.isNodeLockedByOther(nodeId)) return;
    this.renamingNodeId.set(nodeId);
    this.cdr.markForCheck();
  }

  onLabelDblClick(node: UmlClassNode, event: MouseEvent): void {
    event.stopPropagation();
    this.startRenameNode(node.id);
  }

  commitNodeRename(nodeId: string, newName: string): void {
    this.renamingNodeId.set(null);
    const trimmed = newName.trim();
    if (trimmed) this.nodeRename.emit({ nodeId, newName: trimmed });
  }

  cancelNodeRename(): void {
    this.renamingNodeId.set(null);
  }

  resetLabelOffset(node: UmlClassNode, event: MouseEvent): void {
    event.stopPropagation();
    if (this.isReadOnly()) return;
    node.labelOffset = { x: 0, y: 0 };
    this.nodeLabelOffsetChange.emit({ node, offset: { x: 0, y: 0 } });
  }

  onLabelPointerDown(node: UmlClassNode, event: PointerEvent): void {
    if (this.isReadOnly() || this.isNodeLockedByOther(node.id)) return;
    const scale = this.canvas?.transform?.scale || this.zoomLevel() / 100 || 1;
    this.dragService.startNodeLabelDrag(
      node,
      event,
      scale,
      this.cdr,
      (id) => {
        this.isDraggingLabel.set(true);
        this.draggingLabelNodeId.set(id);
      },
      (updatedNode, offset) => {
        this.nodeLabelOffsetChange.emit({ node: updatedNode, offset });
        setTimeout(() => {
          this.isDraggingLabel.set(false);
          this.draggingLabelNodeId.set(null);
        }, 50);
      },
    );
  }

  onResizeHandlePointerDown(node: UmlClassNode, handleType: string, event: PointerEvent): void {
    if (this.isReadOnly() || this.isNodeLockedByOther(node.id)) return;
    const scale = this.canvas?.transform?.scale || this.zoomLevel() / 100 || 1;
    this.nodeResizeService.startResize({
      event,
      node,
      handleType,
      scale,
      initialWidth: getNodeWidth(node),
      initialHeight: getNodeHeight(node),
      dynamicNodeWidthFn: (n) => getDynamicNodeWidth(n),
      cdr: this.cdr,
      onRedraw: () => this.flow?.redraw(),
      onComplete: (result) => this.nodeSizeChange.emit(result),
    });
  }

  onSequenceMessagePointerDown(conn: UmlConnection, event: PointerEvent): void {
    if (this.isReadOnly()) return;
    const scale = this.canvas?.transform?.scale || this.zoomLevel() / 100 || 1;
    this.dragService.startSequenceMessageDrag(
      conn,
      event,
      scale,
      this.cdr,
      (connId, startSlot) => {
        this.isDraggingSeqMessage.set(true);
        this.draggingSeqMessageConnId.set(connId);
        this.draggingSeqMessageTargetSlot.set(startSlot);
        this.draggingSeqMessageDeltaY.set(0);
      },
      (deltaY, targetSlot) => {
        this.draggingSeqMessageDeltaY.set(deltaY);
        this.draggingSeqMessageTargetSlot.set(targetSlot);
      },
      (result) => {
        this.isDraggingSeqMessage.set(false);
        this.draggingSeqMessageConnId.set(null);
        this.draggingSeqMessageDeltaY.set(0);
        if (result) this.sequenceMessageMove.emit(result);
      },
    );
  }

  // --- DRAG & DROP EXTERNO Y CONTROL DE CÁMARA ---

  onCanvasDragOver(event: DragEvent): void {
    if (this.isReadOnly()) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    if (!this.isDragOverCanvas()) this.isDragOverCanvas.set(true);
  }

  onCanvasDragLeave(event: DragEvent): void {
    const related = event.relatedTarget as Node | null;
    const container = this.flowContainerRef?.nativeElement;
    if (container && related && container.contains(related)) return;
    this.isDragOverCanvas.set(false);
  }

  onCanvasDrop(event: DragEvent): void {
    this.isDragOverCanvas.set(false);
    if (this.isReadOnly()) return;
    event.preventDefault();
    const scale = this.canvas?.transform?.scale || this.zoomLevel() / 100 || 1;
    const parsed = this.dragService.parseCanvasDropEvent(event, this.boardElementRef?.nativeElement, scale);
    if (parsed) this.nodeDropped.emit(parsed);
  }

  clientToCanvasPosition(clientX: number, clientY: number): { x: number; y: number } {
    const scale = this.canvas?.transform?.scale || this.zoomLevel() / 100 || 1;
    return this.dragService.clientToCanvasPosition(clientX, clientY, this.boardElementRef?.nativeElement, scale);
  }

  onContainerWheel(event: WheelEvent): void {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const delta = event.deltaY < 0 ? 10 : -10;
    this.setZoomPercent(this.zoomLevel() + delta);
  }

  setZoomPercent(targetZoom: number): void {
    this.dragService.applyZoomLevel(
      targetZoom,
      this.canvas,
      this.zoomDirective,
      (z) => this.zoomLevel.set(z),
      (z) => this.zoomChange.emit(z),
    );
  }

  syncZoomFromCanvas(): void {
    const scale = this.canvas?.transform?.scale || 1;
    const pct = Math.round(scale * 100);
    this.zoomLevel.set(pct);
    this.zoomChange.emit(pct);
  }

  zoomIn(): void { this.setZoomPercent(this.zoomLevel() + 10); }
  zoomOut(): void { this.setZoomPercent(this.zoomLevel() - 10); }
  resetView(): void {
    this.setZoomPercent(100);
    this.centerViewportOnBoard();
  }
  fitView(): void {
    this.dragService.fitNodesInViewport(
      this.nodes(),
      this.flowContainerRef?.nativeElement,
      (z) => this.setZoomPercent(z),
    );
  }
  centerViewportOnBoard(): void {
    const el = this.flowContainerRef?.nativeElement;
    if (el) {
      el.scrollLeft = 0;
      el.scrollTop = 0;
    }
  }
  restoreViewportScroll(diagramId: string | null): void {
    if (!diagramId) return;
    try {
      const raw = sessionStorage.getItem(`diagram_scroll_${diagramId}`);
      if (raw && this.flowContainerRef?.nativeElement) {
        const parsed = JSON.parse(raw);
        this.flowContainerRef.nativeElement.scrollLeft = parsed.left || 0;
        this.flowContainerRef.nativeElement.scrollTop = parsed.top || 0;
      }
    } catch {}
  }
  applyViewState(state: DiagramCanvasViewState): void {
    this.dragService.applyViewState(state, this.flowContainerRef?.nativeElement, (z) => this.setZoomPercent(z));
  }
  redraw(): void {
    this.flow?.redraw();
    this.canvas?.redraw();
    this.cdr.markForCheck();
  }
  reset(): void {
    this.flow?.reset();
    this.cdr.markForCheck();
  }
  select(nodeIds: string[], connectionIds: string[] = []): void {
    this.flow?.select(nodeIds, connectionIds);
  }
  clearSelection(): void { this.flow?.clearSelection(); }
  getExportElement(): HTMLElement | undefined {
    const board = this.boardElementRef?.nativeElement;
    if (!board) return undefined;
    return (board.querySelector('f-flow') as HTMLElement) || board;
  }

  onWindowKeyDown(event: KeyboardEvent): void {
    const tag = (document.activeElement?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    if (event.code === 'Space' && !this.isSpacePressed()) this.isSpacePressed.set(true);
  }

  onWindowKeyUp(event: KeyboardEvent): void {
    if (event.code === 'Space') this.isSpacePressed.set(false);
  }

  onWindowMouseUp(_event?: MouseEvent): void {
    if (this.isPanning()) {
      this.isPanning.set(false);
    }
  }
}
