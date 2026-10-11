import {
  Component,
  Directive,
  AfterViewInit,
  input,
  output,
  signal,
  computed,
  ViewChild,
  ElementRef,
  HostListener,
  ChangeDetectorRef,
  inject,
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
  EFCanvasLayer,
} from '@foblex/flow';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroLockClosed, heroTrash, heroPlus, heroCpuChip, heroCube } from '@ng-icons/heroicons/outline';
import {
  UmlClassNode,
  UmlConnection,
  UmlRelationshipType,
  UmlLineStyle,
  DiagramType,
  UmlMessage,
} from '../../../../../core/models/diagram.model';
import { TranslatePipe } from '../../../../../core/i18n';
import { UML_SVG_COMPONENTS, getUmlMarkerConfig, UmlMarkerConfig } from '../uml-svg';
import { UML_WEBGL_COMPONENTS } from '../uml-webgl';
import { calculateClassDynamicWidth } from '../../utils/node-metrics.util';

export interface DiagramCanvasViewState {
  zoom: number;
  scrollLeft: number;
  scrollTop: number;
}

@Directive({
  selector: 'input[appAutofocusInput]',
  standalone: true,
})
export class AutofocusInputDirective implements AfterViewInit {
  private readonly el = inject(ElementRef<HTMLInputElement>);

  ngAfterViewInit(): void {
    const input = this.el.nativeElement;
    const focusAndSelect = () => {
      try {
        input.focus({ preventScroll: true });
        input.select();
      } catch (_) {}
    };
    requestAnimationFrame(focusAndSelect);
    setTimeout(focusAndSelect, 30);
    setTimeout(focusAndSelect, 100);
  }
}

@Component({
  selector: 'app-diagram-canvas',
  standalone: true,
  imports: [CommonModule, FFlowModule, NgIconComponent, AutofocusInputDirective, TranslatePipe, ...UML_SVG_COMPONENTS, ...UML_WEBGL_COMPONENTS],
  host: {
    class: 'flex-1 relative w-full h-full flex flex-col min-h-0 min-w-0 overflow-hidden',
  },
  providers: [
    provideIcons({
      heroLockClosed,
      heroTrash,
      heroPlus,
      heroCpuChip,
      heroCube,
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

  private readonly cdr = inject(ChangeDetectorRef);

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
  readonly nodeLabelOffsetChange = output<{ node: UmlClassNode; offset: { x: number; y: number } }>();
  readonly sequenceMessageMove = output<{ connectionId: string; targetSlot: number }>();
  readonly nodeDropped = output<{ payload: any; position: { x: number; y: number } }>();
  readonly nodeContextMenu = output<{ node: UmlClassNode; event: MouseEvent }>();
  readonly connectionContextMenu = output<{ conn: UmlConnection; event: MouseEvent }>();
  readonly canvasContextMenu = output<{ event: MouseEvent; canvasPos: { x: number; y: number } }>();

  readonly zoomLevel = signal<number>(100);
  readonly canvasLayers: EFCanvasLayer[] = [
    EFCanvasLayer.GROUPS,
    EFCanvasLayer.NODES,
    EFCanvasLayer.CONNECTIONS,
  ];
  readonly isDragOverCanvas = signal<boolean>(false);
  readonly hoveredNodeId = signal<string | null>(null);
  readonly renamingNodeId = signal<string | null>(null);
  readonly isDraggingLabel = signal<boolean>(false);
  readonly draggingLabelNodeId = signal<string | null>(null);

  readonly isDraggingSeqMessage = signal<boolean>(false);
  readonly draggingSeqMessageConnId = signal<string | null>(null);
  readonly draggingSeqMessageDeltaY = signal<number>(0);
  readonly draggingSeqMessageTargetSlot = signal<number>(0);

  getLabelTransform(node: UmlClassNode): string {
    const ox = node.labelOffset?.x || 0;
    const oy = node.labelOffset?.y || 0;
    return `translate(calc(-50% + ${ox}px), calc(6px + ${oy}px))`;
  }

  getBottomConnectorOffset(node: UmlClassNode): number {
    if (
      node.nodeType === 'actor' ||
      node.nodeType === 'boundary' ||
      node.nodeType === 'control' ||
      node.nodeType === 'entity'
    ) {
      const oy = Math.max(0, node.labelOffset?.y || 0);
      return -44 - oy;
    }
    return -6;
  }

  hasLabelOffset(node: UmlClassNode): boolean {
    return !!node.labelOffset && (Math.abs(node.labelOffset.x) > 1 || Math.abs(node.labelOffset.y) > 1);
  }

  resetLabelOffset(node: UmlClassNode, event: MouseEvent): void {
    event.stopPropagation();
    if (this.isReadOnly() || this.isNodeLockedByOther(node.id)) return;
    node.labelOffset = { x: 0, y: 0 };
    this.cdr.detectChanges();
    this.nodeLabelOffsetChange.emit({ node, offset: { x: 0, y: 0 } });
  }

  onLabelDblClick(node: UmlClassNode, event: MouseEvent): void {
    event.stopPropagation();
    if (this.isReadOnly() || this.isNodeLockedByOther(node.id)) return;
    this.startRenameNode(node.id);
  }

  onLabelPointerDown(node: UmlClassNode, event: PointerEvent): void {
    if (this.renamingNodeId() === node.id) return;
    if (event.button !== 0) return;
    if (this.isReadOnly() || this.isNodeLockedByOther(node.id)) return;

    // Detener propagación para evitar arrastre del nodo completo por Foblex
    event.stopPropagation();

    const targetEl = event.currentTarget as HTMLElement | null;
    if (targetEl && targetEl.setPointerCapture) {
      try {
        targetEl.setPointerCapture(event.pointerId);
      } catch (_) {}
    }

    const startX = event.clientX;
    const startY = event.clientY;
    const scale = this.canvas?.transform?.scale || (this.zoomLevel() ? this.zoomLevel() / 100 : 1) || 1;
    const initialOffsetX = node.labelOffset?.x || 0;
    const initialOffsetY = node.labelOffset?.y || 0;

    let hasMoved = false;
    let animationFrameId: number | null = null;
    let latestE: PointerEvent | null = null;

    const applyMove = () => {
      if (!latestE) return;
      const dx = (latestE.clientX - startX) / scale;
      const dy = (latestE.clientY - startY) / scale;

      if (!hasMoved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        hasMoved = true;
        this.isDraggingLabel.set(true);
        this.draggingLabelNodeId.set(node.id);
      }

      if (hasMoved) {
        node.labelOffset = {
          x: Math.round(initialOffsetX + dx),
          y: Math.round(initialOffsetY + dy),
        };
        this.cdr.detectChanges();
      }
      animationFrameId = null;
    };

    const onPointerMove = (e: PointerEvent) => {
      latestE = e;
      if (!animationFrameId) {
        animationFrameId = requestAnimationFrame(applyMove);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      if (targetEl && targetEl.releasePointerCapture) {
        try {
          targetEl.releasePointerCapture(event.pointerId);
        } catch (_) {}
      }
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      this.isDraggingLabel.set(false);
      this.draggingLabelNodeId.set(null);

      if (hasMoved && latestE) {
        applyMove();
        this.nodeLabelOffsetChange.emit({
          node,
          offset: node.labelOffset || { x: 0, y: 0 },
        });
      } else if (!hasMoved) {
        this.onNodeClick(node.id, e);
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }

  startRenameNode(nodeId: string): void {
    if (this.isReadOnly() || this.isNodeLockedByOther(nodeId)) return;
    this.renamingNodeId.set(nodeId);
    this.cdr.detectChanges();

    const doFocus = () => {
      const board = this.boardElementRef?.nativeElement || document;
      const input = (board.querySelector(`[data-rename-node-id="${nodeId}"]`) as HTMLInputElement | null)
        || (board.querySelector('.uml-rename-input') as HTMLInputElement | null)
        || (document.querySelector(`[data-rename-node-id="${nodeId}"]`) as HTMLInputElement | null);
      if (input) {
        try {
          input.focus({ preventScroll: true });
          input.select();
        } catch (_) {}
      }
    };

    requestAnimationFrame(doFocus);
    setTimeout(doFocus, 30);
    setTimeout(doFocus, 100);
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
      if (node.position) {
        const w = node.width || 350;
        if (node.position.x + w + 350 > max) {
          max = node.position.x + w + 350;
        }
      }
    }
    return max;
  });

  readonly boardHeight = computed(() => {
    let max = 1400;
    for (const node of this.nodes()) {
      if (node.position) {
        const h = node.height || (node.nodeType === 'lifeline' ? 600 : 350);
        if (node.position.y + h + 350 > max) {
          max = node.position.y + h + 350;
        }
      }
    }
    return max;
  });

  readonly scaledBoardWidth = computed(() => {
    const scale = Math.max(0.2, this.zoomLevel() / 100);
    return Math.round(this.boardWidth() * scale);
  });

  readonly scaledBoardHeight = computed(() => {
    const scale = Math.max(0.2, this.zoomLevel() / 100);
    return Math.round(this.boardHeight() * scale);
  });

  // Triggers Foblex Flow
  readonly canvasMoveTrigger = () => false;
  readonly canvasWheelTrigger = () => false;
  readonly dblClickZoomTrigger = () => false;
  readonly selectionAreaTrigger = (event: FTriggerEvent) =>
    primaryButtonEventTrigger(event) && isOnFlowBackground(event);
  readonly multiSelectTrigger = (event: FTriggerEvent) =>
    (event as MouseEvent).ctrlKey || (event as MouseEvent).metaKey || (event as MouseEvent).shiftKey;

  onFlowLoaded(): void {
    this.flowLoaded.emit();
    if (this.canvas) {
      const scale = this.zoomLevel() / 100;
      this.canvas.setScale(scale, { x: 0, y: 0 });
      if (this.canvas.transform) {
        this.canvas.transform.position = { x: 0, y: 0 };
        this.canvas.transform.scaledPosition = { x: 0, y: 0 };
        this.canvas.redraw();
      }
    }
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
    if (this.activeDiagramType() === DiagramType.SEQUENCE || node.nodeType === 'lifeline') {
      newPosition = { x: Math.round(newPosition.x), y: 50 };
      node.position = { x: newPosition.x, y: 50 };
    }
    this.nodePositionChange.emit({ node, newPosition });
  }

  onNodeClick(nodeId: string, event: MouseEvent): void {
    if ((event as any)._nodeClickHandled) return;
    (event as any)._nodeClickHandled = true;
    this.nodeClick.emit({ nodeId, event });
  }

  onNodeDblClick(node: UmlClassNode, event: MouseEvent): void {
    this.nodeDblClick.emit({ node, event });
  }

  onNodeContextMenu(node: UmlClassNode, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.nodeContextMenu.emit({ node, event });
  }

  onConnectionContextMenu(conn: UmlConnection, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.connectionContextMenu.emit({ conn, event });
  }

  onCanvasContextMenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const target = event.target as HTMLElement | SVGElement | null;
    // Si el clic derecho fue sobre un nodo o elemento interno del nodo
    if (target?.closest?.('[fNode], .f-node, .uml-class-node')) {
      const nodeEl = target.closest('[fNode], .f-node, .uml-class-node');
      const fNodeId = nodeEl?.getAttribute('fnodeid') || nodeEl?.getAttribute('data-node-id') || nodeEl?.id;
      const node = this.nodes().find((n) => n.id === fNodeId);
      if (node) {
        this.nodeContextMenu.emit({ node, event });
        return;
      }
    }

    // Si el clic derecho fue sobre una relación o marcador
    if (target && this.isValidConnectionTarget(target)) {
      const connId = this.findConnectionIdFromEventTarget(target);
      if (connId) {
        const conn = this.connections().find((c) => c.id === connId);
        if (conn) {
          this.connectionContextMenu.emit({ conn, event });
          return;
        }
      }
    }

    const canvasPos = this.clientToCanvasCoordinates(event.clientX, event.clientY);
    this.canvasContextMenu.emit({ event, canvasPos });
  }

  private lastConnClickTime = 0;
  private lastConnClickId: string | null = null;
  private lastConnPointerDownTime = 0;
  private lastConnPointerDownId: string | null = null;
  private lastConnPointerDownPos = { x: 0, y: 0 };
  private lastModalOpenTime = 0;

  onConnectionPointerDown(connId: string, event: PointerEvent | MouseEvent): void {
    if ((event as any)._connPointerHandled) return;
    (event as any)._connPointerHandled = true;

    if (event.button !== 0) return; // Solo botón principal (izquierdo)
    if (!this.isValidConnectionTarget(event.target)) return;

    const now = Date.now();
    const timeDiff = now - this.lastConnPointerDownTime;
    const dist = Math.hypot(
      event.clientX - this.lastConnPointerDownPos.x,
      event.clientY - this.lastConnPointerDownPos.y
    );

    // Doble pulsación rápida en la misma relación (dentro de tolerancia de 12px)
    if (this.lastConnPointerDownId === connId && timeDiff < 450 && dist < 12) {
      this.lastConnPointerDownTime = 0;
      this.lastConnPointerDownId = null;
      const conn = this.connections().find((c) => c.id === connId);
      if (conn) {
        event.stopPropagation();
        event.preventDefault();
        this.onConnectionDblClick(conn, event);
        return;
      }
    }

    this.lastConnPointerDownTime = now;
    this.lastConnPointerDownId = connId;
    this.lastConnPointerDownPos = { x: event.clientX, y: event.clientY };
  }

  onFlowPointerDown(event: PointerEvent | MouseEvent): void {
    if ((event as any)._connPointerHandled) return;
    if (event.button !== 0) return;

    const target = event.target as HTMLElement | SVGElement | null;
    if (!target) return;

    if (!this.isValidConnectionTarget(target)) {
      return;
    }

    const connId = this.findConnectionIdFromEventTarget(target);
    if (connId) {
      this.onConnectionPointerDown(connId, event);
    }
  }

  onConnectionClick(connId: string, event: MouseEvent): void {
    if ((event as any)._connHandled) return;
    (event as any)._connHandled = true;

    if (!this.isValidConnectionTarget(event?.target)) return;

    const now = Date.now();
    const timeDiff = now - this.lastConnClickTime;
    if (this.lastConnClickId === connId && timeDiff < 450) {
      // Doble clic detectado directamente por cadencia de clics
      this.lastConnClickTime = 0;
      this.lastConnClickId = null;
      const conn = this.connections().find((c) => c.id === connId);
      if (conn) {
        if (event) {
          event.stopPropagation();
          event.preventDefault();
        }
        this.onConnectionDblClick(conn, event);
        return;
      }
    }
    this.lastConnClickTime = now;
    this.lastConnClickId = connId;
    this.connectionClick.emit({ connId, event });
  }

  onConnectionDblClick(conn: UmlConnection, event?: MouseEvent | PointerEvent): void {
    if (event && !this.isValidConnectionTarget(event.target)) return;

    const now = Date.now();
    if (now - this.lastModalOpenTime < 450) {
      return; // Prevenir apertura duplicada si tanto la cadencia como el evento nativo se disparan
    }
    this.lastModalOpenTime = now;
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.connectionDblClick.emit({ conn, event: event as MouseEvent });
  }

  onFlowClick(event: MouseEvent): void {
    if ((event as any)._connHandled) return;
    const target = event.target as HTMLElement | SVGElement | null;
    if (!target) return;

    if (!this.isValidConnectionTarget(target)) {
      return;
    }

    const connId = this.findConnectionIdFromEventTarget(target);
    if (connId) {
      this.onConnectionClick(connId, event);
    }
  }

  onFlowDblClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | SVGElement | null;
    if (!target) return;

    if (!this.isValidConnectionTarget(target)) {
      return;
    }

    const connId = this.findConnectionIdFromEventTarget(target);
    if (connId) {
      const conn = this.connections().find((c) => c.id === connId);
      if (conn) {
        event.stopPropagation();
        event.preventDefault();
        this.onConnectionDblClick(conn, event);
      }
    }
  }

  private isValidConnectionTarget(target: EventTarget | null): boolean {
    if (!target || !(target instanceof Element)) return false;

    // Si el target está dentro de un nodo o control de nodo, no es la conexión
    if (target.closest?.('[fNode], [fNodeDragHandle], .f-node, .uml-class-node')) {
      return false;
    }

    // Si el target es directamente el contenedor de conexión, svg o defs (espacio vacío de la esquina), descartar
    const tagName = target.tagName ? target.tagName.toLowerCase() : '';
    if (
      tagName === 'f-connection' ||
      tagName === 'svg' ||
      tagName === 'defs' ||
      tagName === 'g' ||
      target.classList.contains('f-connection') ||
      target.classList.contains('f-connection-group')
    ) {
      return false;
    }

    // Debe ser un trazo interactivo (path de selección de 40px o path visible), marcador o badge/etiqueta
    const isStrokeOrMarker =
      tagName === 'path' ||
      tagName === 'polygon' ||
      tagName === 'polyline' ||
      tagName === 'circle' ||
      tagName === 'line';

    const isContentBadge = !!target.closest?.(
      '[fConnectionContent], [fconnectioncontent], .f-connection-content, .uml-multiplicity-badge, .uml-relation-name-badge, .uml-message-badge, [fMarker], [fmarker]'
    );

    const isDragHandle = !!target.closest?.(
      '[f-connection-drag-handle-start], [f-connection-drag-handle-end], .f-connection-drag-handle'
    );

    return isStrokeOrMarker || isContentBadge || isDragHandle;
  }

  private findConnectionIdFromEventTarget(target: HTMLElement | SVGElement): string | null {
    if (!target || !this.isValidConnectionTarget(target)) return null;

    // 1. Si target está dentro de un nodo, ignorar
    if (target.closest?.('[fNode], [fNodeDragHandle], .f-node, .uml-class-node')) {
      return null;
    }

    // 2. Búsqueda directa con closest hacia el contenedor f-connection
    const connEl = target.closest?.('f-connection, [data-connection-id], .f-connection');
    if (connEl) {
      const dataId = connEl.getAttribute('data-connection-id');
      if (dataId && this.connections().some((c) => c.id === dataId)) {
        return dataId;
      }
      const rawId = connEl.getAttribute('id') || connEl.getAttribute('fconnectionid') || (connEl as any).id || '';
      for (const c of this.connections()) {
        if (c.id === rawId || rawId === `_${c.id}` || rawId.endsWith(c.id)) {
          return c.id;
        }
      }
    }

    // 3. Inspección manual ascendente de la jerarquía DOM / SVG
    let curr: Element | null = target;
    while (curr && curr !== document.body) {
      const tagName = curr.tagName ? curr.tagName.toLowerCase() : '';
      if (tagName === 'f-connection' || curr.classList.contains('f-connection')) {
        const dataId = curr.getAttribute('data-connection-id');
        if (dataId && this.connections().some((c) => c.id === dataId)) {
          return dataId;
        }
        const rawId = curr.getAttribute('id') || curr.getAttribute('fconnectionid') || (curr as any).id || '';
        for (const c of this.connections()) {
          if (c.id === rawId || rawId === `_${c.id}` || rawId.endsWith(c.id)) {
            return c.id;
          }
        }
      }

      const idAttr = curr.getAttribute('id') || '';
      if (idAttr) {
        for (const c of this.connections()) {
          if (idAttr.includes(c.id) || (c.id.length > 3 && idAttr.includes(c.id.substring(1)))) {
            return c.id;
          }
        }
      }

      curr = curr.parentElement || (curr.parentNode as Element | null);
    }
    return null;
  }

  isGroupInitiator(conn: UmlConnection): boolean {
    const seqNum = conn.messages?.[0]?.sequenceNumber?.trim() || '';
    return /^\d+$/.test(seqNum);
  }

  getGroupMemberCount(conn: UmlConnection): number {
    const seqNum = conn.messages?.[0]?.sequenceNumber?.trim() || '';
    if (!/^\d+$/.test(seqNum)) return 1;
    const groupPrefix = `${seqNum}.`;
    let count = 1;
    for (const c of this.connections()) {
      if (c.id === conn.id) continue;
      const s = c.messages?.[0]?.sequenceNumber?.trim() || '';
      if (s.startsWith(groupPrefix)) {
        count++;
      }
    }
    return count;
  }

  getSequenceMessageTransform(conn: UmlConnection): string {
    if (!this.isDraggingSeqMessage()) return '';
    const dragId = this.draggingSeqMessageConnId();
    if (dragId === conn.id) {
      return `translateY(${this.draggingSeqMessageDeltaY()}px)`;
    }
    // Si se está arrastrando el iniciador de un grupo, sus hijos también se mueven visualmente en tiempo real
    if (dragId) {
      const draggingConn = this.connections().find((c) => c.id === dragId);
      if (draggingConn && this.isGroupInitiator(draggingConn)) {
        const rootSeq = draggingConn.messages?.[0]?.sequenceNumber?.trim() || '';
        const connSeq = conn.messages?.[0]?.sequenceNumber?.trim() || '';
        if (connSeq.startsWith(`${rootSeq}.`)) {
          return `translateY(${this.draggingSeqMessageDeltaY()}px)`;
        }
      }
    }
    return '';
  }

  onSequenceMessagePointerDown(conn: UmlConnection, event: PointerEvent): void {
    if (event.button !== 0) return;
    if (this.isReadOnly()) return;
    if (!this.isSequenceConnection(conn)) return;

    const sNode = conn.sourceNodeId || conn.sourceId?.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
    const tNode = conn.targetNodeId || conn.targetId?.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
    if (this.isNodeLockedByOther(sNode) || this.isNodeLockedByOther(tNode)) return;

    event.stopPropagation();

    const targetEl = event.currentTarget as HTMLElement | null;
    if (targetEl && targetEl.setPointerCapture) {
      try {
        targetEl.setPointerCapture(event.pointerId);
      } catch (_) {}
    }

    const startY = event.clientY;
    const scale = this.canvas?.transform?.scale || (this.zoomLevel() ? this.zoomLevel() / 100 : 1) || 1;

    const sMatch = conn.sourceId?.match(/_slot_(\d+)$/);
    const initialSlot = sMatch ? parseInt(sMatch[1], 10) : 0;

    let hasMoved = false;
    let latestTargetSlot = initialSlot;

    const onPointerMove = (moveEv: PointerEvent) => {
      const rawDy = (moveEv.clientY - startY) / scale;

      if (!hasMoved && Math.abs(rawDy) > 4) {
        hasMoved = true;
        this.isDraggingSeqMessage.set(true);
        this.draggingSeqMessageConnId.set(conn.id);
      }

      if (hasMoved) {
        this.draggingSeqMessageDeltaY.set(rawDy);
        const slotOffset = Math.round(rawDy / 50);
        latestTargetSlot = Math.max(0, initialSlot + slotOffset);
        this.draggingSeqMessageTargetSlot.set(latestTargetSlot);
      }
    };

    const onPointerUp = (upEv: PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      if (targetEl && targetEl.releasePointerCapture) {
        try {
          targetEl.releasePointerCapture(upEv.pointerId);
        } catch (_) {}
      }

      const moved = hasMoved;
      const finalSlot = latestTargetSlot;

      this.isDraggingSeqMessage.set(false);
      this.draggingSeqMessageConnId.set(null);
      this.draggingSeqMessageDeltaY.set(0);

      if (moved && finalSlot !== initialSlot) {
        this.sequenceMessageMove.emit({
          connectionId: conn.id,
          targetSlot: finalSlot,
        });
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
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

  onCanvasDragOver(event: DragEvent): void {
    if (this.isReadOnly()) return;
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    if (!this.isDragOverCanvas()) {
      this.isDragOverCanvas.set(true);
    }
  }

  onCanvasDragLeave(event: DragEvent): void {
    const container = this.flowContainerRef?.nativeElement;
    const related = event.relatedTarget as Node | null;
    if (!container || !container.contains(related)) {
      this.isDragOverCanvas.set(false);
    }
  }

  onCanvasDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOverCanvas.set(false);
    if (this.isReadOnly()) return;

    const raw = event.dataTransfer?.getData('application/json');
    if (!raw) return;

    try {
      const payload = JSON.parse(raw);
      const position = this.clientToCanvasCoordinates(event.clientX, event.clientY);
      this.nodeDropped.emit({ payload, position });
    } catch (err) {
      console.error('Error parsing dropped payload:', err);
    }
  }

  clientToCanvasCoordinates(clientX: number, clientY: number): { x: number; y: number } {
    const container = this.flowContainerRef?.nativeElement;
    const scale = this.canvas?.transform?.scale || (this.zoomLevel() ? this.zoomLevel() / 100 : 1) || 1;
    if (!container) {
      return { x: Math.max(20, Math.round(clientX)), y: Math.max(20, Math.round(clientY)) };
    }
    const rect = container.getBoundingClientRect();
    const viewX = clientX - rect.left;
    const viewY = clientY - rect.top;
    const canvasX = Math.round((container.scrollLeft + viewX) / scale);
    const canvasY = Math.round((container.scrollTop + viewY) / scale);
    return { x: Math.max(20, canvasX), y: Math.max(20, canvasY) };
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
      try {
        const raw = sessionStorage.getItem(`diagram_view_state_${dId}`);
        const current = raw ? JSON.parse(raw) : { zoom: this.zoomLevel() };
        sessionStorage.setItem(
          `diagram_view_state_${dId}`,
          JSON.stringify({ ...current, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop }),
        );
      } catch (_) {}
    }
  }

  onContainerWheel(event: WheelEvent): void {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      event.stopPropagation();
      const delta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
      if (Math.abs(delta) < 1) return;
      const zoomStep = Math.abs(delta) > 50 ? 15 : 5;
      const direction = delta < 0 ? 1 : -1;
      const nextZoom = this.zoomLevel() + direction * zoomStep;
      this.setZoom(nextZoom, true, { clientX: event.clientX, clientY: event.clientY });
    }
  }

  onCanvasChange(event?: FCanvasChangeEvent): void {
    if (this.canvas?.transform) {
      if (this.canvas.transform.scaledPosition.x !== 0 || this.canvas.transform.scaledPosition.y !== 0) {
        this.canvas.transform.scaledPosition = { x: 0, y: 0 };
        this.canvas.transform.position = { x: 0, y: 0 };
        this.canvas.redraw();
      }
    }
    if (event?.scale != null) {
      const pct = Math.round(event.scale * 100);
      if (pct !== this.zoomLevel()) {
        this.zoomLevel.set(pct);
        this.zoomChange.emit(pct);
      }
    }
  }

  syncZoomFromCanvas(): void {
    if (this.canvas?.transform?.scale != null) {
      const pct = Math.round(this.canvas.transform.scale * 100);
      if (pct !== this.zoomLevel()) {
        this.zoomLevel.set(pct);
        this.zoomChange.emit(pct);
      }
    }
  }

  setZoom(targetPct: number, autoAdjustScroll = true, focusPoint?: { clientX: number; clientY: number }): void {
    const clamped = Math.max(25, Math.min(300, Math.round(targetPct)));
    const oldZoom = this.zoomLevel();
    if (oldZoom === clamped && this.canvas?.transform?.scale === clamped / 100) {
      return;
    }

    const container = this.flowContainerRef?.nativeElement;
    const oldScale = oldZoom / 100;
    const newScale = clamped / 100;

    let contentFocusX = 0;
    let contentFocusY = 0;
    let viewFocusX = 0;
    let viewFocusY = 0;

    if (container && autoAdjustScroll) {
      const rect = container.getBoundingClientRect();
      if (focusPoint) {
        viewFocusX = focusPoint.clientX - rect.left;
        viewFocusY = focusPoint.clientY - rect.top;
      } else {
        viewFocusX = container.clientWidth / 2;
        viewFocusY = container.clientHeight / 2;
      }
      contentFocusX = (container.scrollLeft + viewFocusX) / oldScale;
      contentFocusY = (container.scrollTop + viewFocusY) / oldScale;
    }

    this.zoomLevel.set(clamped);

    if (this.canvas) {
      this.canvas.setScale(newScale, { x: 0, y: 0 });
      if (this.canvas.transform) {
        this.canvas.transform.position = { x: 0, y: 0 };
        this.canvas.transform.scaledPosition = { x: 0, y: 0 };
        this.canvas.redraw();
      }
    }

    this.zoomChange.emit(clamped);

    const dId = this.diagramId();
    if (dId) {
      try {
        const raw = sessionStorage.getItem(`diagram_view_state_${dId}`);
        const current = raw ? JSON.parse(raw) : { scrollLeft: 0, scrollTop: 0 };
        sessionStorage.setItem(
          `diagram_view_state_${dId}`,
          JSON.stringify({ ...current, zoom: clamped }),
        );
      } catch (_) {}
    }

    if (container && autoAdjustScroll) {
      requestAnimationFrame(() => {
        const newScrollLeft = Math.max(0, Math.round(contentFocusX * newScale - viewFocusX));
        const newScrollTop = Math.max(0, Math.round(contentFocusY * newScale - viewFocusY));
        container.scrollLeft = newScrollLeft;
        container.scrollTop = newScrollTop;
      });
    }
  }

  zoomIn(): void {
    const current = this.zoomLevel();
    const next = current < 100 ? current + 10 : current + 25;
    this.setZoom(next, true);
  }

  zoomOut(): void {
    const current = this.zoomLevel();
    const next = current <= 100 ? current - 10 : current - 25;
    this.setZoom(next, true);
  }

  resetView(): void {
    this.setZoom(100, false);
    this.centerViewportOnBoard();
  }

  fitView(): void {
    const container = this.flowContainerRef?.nativeElement;
    const nodes = this.nodes();
    if (!container || nodes.length === 0) {
      this.resetView();
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of nodes) {
      if (!node.position) continue;
      const nx = node.position.x;
      const ny = node.position.y;
      const nw = node.width || (node.nodeType === 'actor' ? 65 : 220);
      const nh = node.height || (node.nodeType === 'lifeline' ? 600 : 120);

      if (nx < minX) minX = nx;
      if (ny < minY) minY = ny;
      if (nx + nw > maxX) maxX = nx + nw;
      if (ny + nh > maxY) maxY = ny + nh;
    }

    if (!isFinite(minX) || !isFinite(maxX)) {
      this.resetView();
      return;
    }

    const padding = 60;
    const diagramWidth = Math.max(100, maxX - minX + padding * 2);
    const diagramHeight = Math.max(100, maxY - minY + padding * 2);

    const availableWidth = container.clientWidth || 1000;
    const availableHeight = container.clientHeight || 700;

    const scaleX = availableWidth / diagramWidth;
    const scaleY = availableHeight / diagramHeight;
    const targetScale = Math.min(1.25, Math.max(0.3, Math.min(scaleX, scaleY)));
    const targetZoom = Math.round(targetScale * 100);

    this.setZoom(targetZoom, false);

    requestAnimationFrame(() => {
      container.scrollLeft = Math.max(0, Math.round(minX * targetScale - padding * targetScale));
      container.scrollTop = Math.max(0, Math.round(minY * targetScale - padding * targetScale));
    });
  }

  getViewState(): DiagramCanvasViewState {
    const el = this.flowContainerRef?.nativeElement;
    return {
      zoom: this.zoomLevel(),
      scrollLeft: el?.scrollLeft || 0,
      scrollTop: el?.scrollTop || 0,
    };
  }

  applyViewState(state: DiagramCanvasViewState): void {
    this.setZoom(state.zoom, false);
    const el = this.flowContainerRef?.nativeElement;
    if (el) {
      requestAnimationFrame(() => {
        el.scrollLeft = Math.max(0, state.scrollLeft);
        el.scrollTop = Math.max(0, state.scrollTop);
      });
    }
  }

  restoreViewportScroll(diagramId: string | null): void {
    if (!diagramId) return;
    const viewStateRaw = sessionStorage.getItem(`diagram_view_state_${diagramId}`);
    if (viewStateRaw) {
      try {
        const state = JSON.parse(viewStateRaw);
        if (state && typeof state.zoom === 'number') {
          this.applyViewState(state);
          return;
        }
      } catch (_) {}
    }
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
    this.cdr.detectChanges();
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

  // Ancho dinámico adaptativo para elementos UML según su contenido (atributos, métodos, nombre)
  getDynamicNodeWidth(node: UmlClassNode): number {
    if (node.isAnchor) return 0;
    if (node.nodeType === 'actor') {
      return 65;
    }
    if (node.nodeType === 'lifeline') {
      const nameLen = (node.name || '').length;
      return Math.max(160, Math.round(nameLen * 8.5 + 44));
    }
    if (node.nodeType === 'use_case') {
      const nameLen = (node.name || '').length;
      return Math.min(260, Math.max(140, Math.round(nameLen * 7.5 + 40)));
    }
    if (node.nodeType === 'package') {
      const tabTitle = this.getPackageTabTitle(node);
      const bodyText = this.getPackageBodyText(node);
      const maxLen = Math.max(tabTitle.length, bodyText.length);
      return Math.max(180, Math.round(maxLen * 7.5 + 40));
    }
    if (node.nodeType === 'boundary' || node.nodeType === 'control' || node.nodeType === 'entity') {
      return 70;
    }
    return calculateClassDynamicWidth(node);
  }

  // Ancho efectivo del nodo:
  // - Para clases UML: la función principal y base es el cálculo dinámico según atributos y métodos (no se achica por debajo del contenido).
  // - Para casos de uso, actores y paquetes: permite redimensionar a dimensiones más reducidas adaptando el contenido.
  getNodeWidth(node: UmlClassNode): number {
    if (node.isAnchor) return 0;
    if (node.nodeType === 'use_case') {
      const dynamicW = this.getDynamicNodeWidth(node);
      const manualW = (node.isCustomSize && (node.customWidth || node.width)) ? (node.customWidth || node.width || 0) : (node.customWidth || 0);
      return Math.max(dynamicW, manualW || 0);
    }
    if (node.nodeType === 'actor') {
      const manualW = node.customWidth || (node.isCustomSize ? (node.width || 0) : 0);
      if (manualW && manualW > 0) {
        return Math.max(50, manualW);
      }
      return 65;
    }
    if (node.nodeType === 'lifeline') {
      const manualW = node.customWidth || node.width || 0;
      return Math.max(this.getDynamicNodeWidth(node), manualW);
    }
    if (node.nodeType === 'package') {
      const manualW = node.customWidth || (node.isCustomSize ? (node.width || 0) : 0) || node.width;
      if (manualW && manualW > 0) {
        return Math.max(120, manualW);
      }
      return this.getDynamicNodeWidth(node);
    }
    if (node.nodeType === 'boundary' || node.nodeType === 'control' || node.nodeType === 'entity') {
      const manualW = node.customWidth || (node.isCustomSize ? (node.width || 0) : 0);
      if (manualW && manualW > 0) {
        return Math.max(50, manualW);
      }
      return 70;
    }
    if (node.nodeType === 'component') {
      const manualW = node.customWidth || (node.isCustomSize ? (node.width || 0) : 0) || node.width;
      if (manualW && manualW > 0) {
        return Math.max(140, manualW);
      }
      const nameLen = (node.name || '').length;
      return Math.max(180, Math.round(nameLen * 8.5 + 50));
    }
    if (node.nodeType === 'device' || node.nodeType === 'node' || node.nodeType === 'executionEnvironment') {
      const manualW = node.customWidth || (node.isCustomSize ? (node.width || 0) : 0) || node.width;
      if (manualW && manualW > 0) {
        return Math.max(160, manualW);
      }
      const nameLen = (node.name || '').length;
      return Math.max(230, Math.round(nameLen * 8.5 + 50));
    }
    if (node.nodeType === 'boundary_box') {
      const manualW = node.customWidth || (node.isCustomSize ? (node.width || 0) : 0) || node.width;
      if (manualW && manualW > 0) {
        return Math.max(120, manualW);
      }
      return 280;
    }
    const dynamicW = this.getDynamicNodeWidth(node);
    const manualW = (node.isCustomSize && node.customWidth) ? node.customWidth : 0;
    return Math.max(dynamicW, manualW);
  }

  // Alto dinámico adaptativo para elementos UML según su tipo y contenido
  getNodeHeight(node: UmlClassNode): number | null {
    if (node.isAnchor) return 0;
    if (node.nodeType === 'lifeline') return 60;
    if (node.customHeight && node.customHeight > 0) {
      return node.customHeight;
    }
    if (node.isCustomSize && node.height && node.height > 0) {
      return node.height;
    }

    if (node.nodeType === 'actor') {
      return node.customHeight || (node.isCustomSize ? node.height : null) || node.height || 95;
    }
    if (node.nodeType === 'package') {
      return node.customHeight || node.height || 120;
    }
    if (node.nodeType === 'boundary_box') {
      return node.customHeight || (node.isCustomSize ? node.height : null) || node.height || 200;
    }
    if (node.nodeType === 'component') {
      return node.customHeight || (node.isCustomSize ? node.height : null) || node.height || 70;
    }
    if (node.nodeType === 'device' || node.nodeType === 'node' || node.nodeType === 'executionEnvironment') {
      return node.customHeight || (node.isCustomSize ? node.height : null) || node.height || (node.nodeType === 'executionEnvironment' ? 160 : 140);
    }
    if (node.nodeType === 'boundary' || node.nodeType === 'control' || node.nodeType === 'entity') {
      return node.customHeight || (node.isCustomSize ? node.height : null) || node.height || 70;
    }
    if (node.nodeType === 'use_case') {
      const manualH = (node.isCustomSize && (node.customHeight || node.height)) ? (node.customHeight || node.height || 0) : (node.customHeight || 0);
      const w = this.getNodeWidth(node);
      const nameLen = (node.name || '').length;
      const usableWidth = Math.max(50, w - 24);
      const charsPerLine = Math.max(8, Math.floor(usableWidth / 6.8));
      const lines = Math.max(1, Math.ceil(nameLen / charsPerLine));
      const dynamicH = Math.max(60, 45 + (lines - 1) * 18);
      return Math.max(dynamicH, manualH || 0);
    }
    // Para clases UML sin redimensión manual: el alto es 100% dinámico según el contenido
    return null;
  }

  getPackageTabTitle(node: UmlClassNode): string {
    if (!node.name) return 'Paquete';
    const lines = node.name.split('\n');
    return lines[0].trim() || 'Paquete';
  }

  getPackageBodyText(node: UmlClassNode): string {
    if (node.attributes && node.attributes.length > 0 && node.attributes[0]?.name) {
      return node.attributes[0].name;
    }
    if (node.name && node.name.includes('\n')) {
      const parts = node.name.split('\n');
      return parts.slice(1).join('\n').trim();
    }
    return '';
  }

  getNodeSize(node: UmlClassNode): { width: number; height: number } | undefined {
    if (node.isAnchor) return undefined;
    const h = this.getNodeHeight(node);
    if (!h) return undefined;
    return {
      width: this.getNodeWidth(node),
      height: h,
    };
  }

  onNodeSizeChange(node: UmlClassNode, rect: any): void {
    if (node.isAnchor || this.isReadOnly() || this.isNodeLockedByOther(node.id)) return;
    if (!rect) return;
    let minW = 120;
    let minH = 60;
    if (node.nodeType === 'actor') {
      minW = 50;
      minH = 65;
    } else if (node.nodeType === 'use_case') {
      minW = 80;
      minH = 45;
    } else if (node.nodeType === 'package' || node.nodeType === 'boundary_box') {
      minW = 120;
      minH = 70;
    } else if (node.nodeType === 'boundary' || node.nodeType === 'control' || node.nodeType === 'entity') {
      minW = 50;
      minH = 50;
    } else {
      minW = Math.max(90, this.getDynamicNodeWidth(node));
    }
    const width = Math.max(minW, Math.round(rect.width));
    const height = Math.max(minH, Math.round(rect.height));
    const position = {
      x: typeof rect.x === 'number' ? Math.round(rect.x) : node.position.x,
      y: typeof rect.y === 'number' ? Math.round(rect.y) : node.position.y,
    };
    node.customWidth = width;
    node.customHeight = height;
    node.isCustomSize = true;
    node.width = width;
    node.height = height;
    node.position = position;
    this.nodeSizeChange.emit({ node, width, height, position });
  }

  // Redimensión manual suave en tiempo real (60 FPS) mediante puntero en manejadores
  onResizeHandlePointerDown(node: UmlClassNode, handleType: string, event: PointerEvent): void {
    if (this.isReadOnly() || this.isNodeLockedByOther(node.id)) return;
    event.preventDefault();
    event.stopPropagation();

    const targetEl = event.currentTarget as HTMLElement | null;
    if (targetEl && targetEl.setPointerCapture) {
      try {
        targetEl.setPointerCapture(event.pointerId);
      } catch (_) {}
    }

    const startX = event.clientX;
    const startY = event.clientY;
    const scale = this.canvas?.transform?.scale || (this.zoomLevel() ? this.zoomLevel() / 100 : 1) || 1;

    // Medir las dimensiones reales actuales renderizadas para garantizar continuidad milimétrica (sin saltos bruscos)
    const hostEl = (event.currentTarget as HTMLElement).closest('.f-node') as HTMLElement | null;
    const hostRect = hostEl ? hostEl.getBoundingClientRect() : null;
    const initialW = hostRect ? Math.round(hostRect.width / scale) : this.getNodeWidth(node);
    const initialH = hostRect ? Math.round(hostRect.height / scale) : (this.getNodeHeight(node) || node.height || 60);
    const initialPosX = node.position ? node.position.x : 0;
    const initialPosY = node.position ? node.position.y : 0;

    let minW = 120;
    let minH = 60;
    if (node.nodeType === 'actor') {
      minW = 50;
      minH = 65;
    } else if (node.nodeType === 'use_case') {
      minW = 80;
      minH = 45;
    } else if (node.nodeType === 'package' || node.nodeType === 'boundary_box') {
      minW = 120;
      minH = 70;
    } else if (node.nodeType === 'boundary' || node.nodeType === 'control' || node.nodeType === 'entity') {
      minW = 50;
      minH = 50;
    } else if (node.nodeType === 'component') {
      minW = 140;
      minH = 50;
    } else if (node.nodeType === 'device' || node.nodeType === 'node' || node.nodeType === 'executionEnvironment') {
      minW = 160;
      minH = 90;
    } else {
      minW = Math.max(90, this.getDynamicNodeWidth(node));
    }

    let animationFrameId: number | null = null;
    let latestE: PointerEvent | null = null;

    const applyResize = () => {
      if (!latestE) return;
      const dx = (latestE.clientX - startX) / scale;
      const dy = (latestE.clientY - startY) / scale;

      let nextW = initialW;
      let nextH = initialH;
      let nextX = initialPosX;
      let nextY = initialPosY;

      if (handleType.includes('right')) {
        nextW = initialW + dx;
      } else if (handleType.includes('left')) {
        nextW = initialW - dx;
      }

      if (handleType.includes('bottom')) {
        nextH = initialH + dy;
      } else if (handleType.includes('top')) {
        nextH = initialH - dy;
      }

      const clampedW = Math.max(minW, Math.round(nextW));
      const clampedH = Math.max(minH, Math.round(nextH));

      if (handleType.includes('left')) {
        nextX = Math.round(initialPosX + (initialW - clampedW));
      }
      if (handleType.includes('top')) {
        nextY = Math.round(initialPosY + (initialH - clampedH));
      }

      node.customWidth = clampedW;
      node.customHeight = clampedH;
      node.isCustomSize = true;
      node.width = clampedW;
      node.height = clampedH;
      node.position = { x: nextX, y: nextY };

      this.cdr.detectChanges();
      this.fFlow?.redraw();
      animationFrameId = null;
    };

    const onPointerMove = (e: PointerEvent) => {
      latestE = e;
      if (!animationFrameId) {
        animationFrameId = requestAnimationFrame(applyResize);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      if (targetEl && targetEl.releasePointerCapture) {
        try {
          targetEl.releasePointerCapture(event.pointerId);
        } catch (_) {}
      }
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      if (latestE) {
        applyResize();
      }

      this.nodeSizeChange.emit({
        node,
        width: node.customWidth || node.width || initialW,
        height: node.customHeight || node.height || initialH,
        position: node.position,
      });
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }

  // Helpers de estado visual
  shouldShowMultiplicity(conn: UmlConnection): boolean {
    if (
      this.activeDiagramType() === DiagramType.USE_CASE ||
      this.activeDiagramType() === DiagramType.PACKAGE ||
      this.activeDiagramType() === DiagramType.LAYERED ||
      this.activeDiagramType() === DiagramType.COMPONENT ||
      this.activeDiagramType() === DiagramType.COMMUNICATION ||
      this.activeDiagramType() === DiagramType.SEQUENCE ||
      ['sync', 'reply', 'async', 'create', 'self'].includes(conn.type as any)
    ) return false;
    if (
      conn.type === 'generalization' ||
      conn.type === 'realization' ||
      conn.type === 'assembly' ||
      conn.type === 'include' ||
      conn.type === 'extend' ||
      conn.type === 'import' ||
      conn.type === 'access' ||
      conn.type === 'merge' ||
      conn.type === 'trace' ||
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
    if (sNode && (sNode.nodeType === 'actor' || sNode.nodeType === 'use_case' || sNode.nodeType === 'package' || sNode.nodeType === 'boundary_box')) return false;
    if (tNode && (tNode.nodeType === 'actor' || tNode.nodeType === 'use_case' || tNode.nodeType === 'package' || tNode.nodeType === 'boundary_box')) return false;
    return true;
  }

  isNodeSelected(nodeId: string): boolean {
    return this.selectedNodeIds().includes(nodeId);
  }

  isNodeInsideParent(child: UmlClassNode, parent: UmlClassNode): boolean {
    if (child.id === parent.id || child.isAnchor || parent.isAnchor) return false;
    const parentW = this.getNodeWidth(parent);
    const parentH = this.getNodeHeight(parent) || 60;
    const childW = this.getNodeWidth(child);
    const childH = this.getNodeHeight(child) || 60;

    const parentArea = parentW * parentH;
    const childArea = childW * childH;
    if (parentArea <= childArea * 1.05) return false;

    const childCenterX = child.position.x + childW / 2;
    const childCenterY = child.position.y + childH / 2;

    return (
      childCenterX >= parent.position.x - 5 &&
      childCenterX <= parent.position.x + parentW + 5 &&
      childCenterY >= parent.position.y - 5 &&
      childCenterY <= parent.position.y + parentH + 5
    );
  }

  getNodeParentId(node: UmlClassNode): string | null {
    if (node.isAnchor || this.activeDiagramType() === DiagramType.SEQUENCE) return null;
    let bestParent: UmlClassNode | null = null;
    let minArea = Infinity;

    for (const candidate of this.nodes()) {
      if (candidate.id === node.id || candidate.isAnchor) continue;
      if (this.isNodeInsideParent(node, candidate)) {
        const area = this.getNodeArea(candidate);
        if (area < minArea) {
          minArea = area;
          bestParent = candidate;
        }
      }
    }

    return bestParent ? bestParent.id : null;
  }

  isNodeOrAncestorSelected(node: UmlClassNode): boolean {
    if (this.isNodeSelected(node.id)) return true;
    const all = this.nodes();
    for (const p of all) {
      if (this.isNodeInsideParent(node, p) && this.isNodeSelected(p.id)) {
        return true;
      }
    }
    return false;
  }

  getNodeArea(node: UmlClassNode): number {
    if (node.isAnchor) return 0;
    return this.getNodeWidth(node) * (this.getNodeHeight(node) || 60);
  }

  // Rango base de z-index calculado dinámicamente según área efectiva y tipo de nodo:
  // Los contenedores (boundary_box, package) se mantienen al fondo y los componentes/clases al frente (top).
  getNodeBaseRank(node: UmlClassNode): number {
    if (node.isAnchor) return 0;
    const isBgContainer = (n: UmlClassNode) => n.nodeType === 'boundary_box' || n.nodeType === 'package';
    const myIsBg = isBgContainer(node);
    const myArea = this.getNodeArea(node);
    let rank = 1;
    for (const other of this.nodes()) {
      if (other.id === node.id || other.isAnchor) continue;
      const otherIsBg = isBgContainer(other);
      if (myIsBg && !otherIsBg) {
        // Los contenedores de fondo siempre van por detrás de elementos regulares (componentes, clases, etc.)
        continue;
      }
      if (!myIsBg && otherIsBg) {
        // Elementos regulares siempre van por delante de contenedores de fondo
        rank++;
        continue;
      }
      const otherArea = this.getNodeArea(other);
      if (otherArea > myArea) {
        rank++;
      } else if (otherArea === myArea && other.id.localeCompare(node.id) < 0) {
        rank++;
      }
    }
    return Math.min(25, rank);
  }

  getNodeZIndex(node: UmlClassNode): number {
    if (node.isAnchor) return 0;
    const baseRank = this.getNodeBaseRank(node);
    if (this.isNodeOrAncestorSelected(node)) {
      return 30 + baseRank;
    }
    return baseRank;
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

  getMarkerConfig(connType: UmlRelationshipType | string | null | undefined, isStartDiamond: boolean = false): UmlMarkerConfig {
    return getUmlMarkerConfig(connType, isStartDiamond);
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

  getConnectorPoint(node: UmlClassNode, side: string): { x: number; y: number } {
    const w = node.isAnchor ? 0 : this.getNodeWidth(node);
    const h = this.getNodeHeight(node) || 60;
    const bottomExtra =
      node.nodeType === 'actor' ||
      node.nodeType === 'boundary' ||
      node.nodeType === 'control' ||
      node.nodeType === 'entity'
        ? 38 + Math.max(0, node.labelOffset?.y || 0)
        : 0;
    switch (side) {
      case 'left':
        return { x: node.position.x, y: node.position.y + h / 2 };
      case 'right':
        return { x: node.position.x + w, y: node.position.y + h / 2 };
      case 'top':
        return { x: node.position.x + w / 2, y: node.position.y };
      case 'bottom':
        return { x: node.position.x + w / 2, y: node.position.y + h + bottomExtra };
      default:
        return { x: node.position.x + w / 2, y: node.position.y + h / 2 };
    }
  }

  getAssemblyAngle(conn: UmlConnection): number {
    try {
      const container = this.flowContainerRef?.nativeElement;
      if (container) {
        const pathEl = container.querySelector(
          `[data-connection-id="${conn.id}"] path[f-connection-path]`,
        ) as SVGPathElement | null;
        if (pathEl && typeof pathEl.getTotalLength === 'function') {
          const len = pathEl.getTotalLength();
          if (len > 0) {
            const p1 = pathEl.getPointAtLength(Math.max(0, len * 0.5 - 2));
            const p2 = pathEl.getPointAtLength(Math.min(len, len * 0.5 + 2));
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            if (dx !== 0 || dy !== 0) {
              return Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
            }
          }
        }
      }
    } catch (_) {}

    const nodeMap = new Map(this.nodes().map((n) => [n.id, n]));
    const sId = conn.sourceNodeId || conn.sourceId.replace(/_(top|right|bottom|left|slot_\d+)$/, '');
    const tId = conn.targetNodeId || conn.targetId.replace(/_(top|right|bottom|left|slot_\d+)$/, '');
    const sNode = nodeMap.get(sId);
    const tNode = nodeMap.get(tId);
    if (!sNode || !tNode) return 0;

    const sWidth = this.getNodeWidth(sNode);
    const sHeight = this.getNodeHeight(sNode) || 60;
    const tWidth = this.getNodeWidth(tNode);
    const tHeight = this.getNodeHeight(tNode) || 60;

    const sCenter = { x: sNode.position.x + sWidth / 2, y: sNode.position.y + sHeight / 2 };
    const tCenter = { x: tNode.position.x + tWidth / 2, y: tNode.position.y + tHeight / 2 };

    const dx = tCenter.x - sCenter.x;
    const dy = tCenter.y - sCenter.y;
    return Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
  }

  hasForwardMessages(conn: UmlConnection): boolean {
    return !!conn.messages && conn.messages.some((m) => m.direction !== 'reverse');
  }

  hasReverseMessages(conn: UmlConnection): boolean {
    return !!conn.messages && conn.messages.some((m) => m.direction === 'reverse');
  }

  getForwardMessages(conn: UmlConnection): UmlMessage[] {
    return (conn.messages || [])
      .filter((m) => m.direction !== 'reverse')
      .slice()
      .sort((a, b) => this.compareSequenceNumbers(a.sequenceNumber, b.sequenceNumber));
  }

  getReverseMessages(conn: UmlConnection): UmlMessage[] {
    return (conn.messages || [])
      .filter((m) => m.direction === 'reverse')
      .slice()
      .sort((a, b) => this.compareSequenceNumbers(a.sequenceNumber, b.sequenceNumber));
  }

  compareSequenceNumbers(seqA?: string, seqB?: string): number {
    if (!seqA && !seqB) return 0;
    if (!seqA) return 1;
    if (!seqB) return -1;
    const partsA = seqA.trim().split('.').map((p) => parseInt(p, 10));
    const partsB = seqB.trim().split('.').map((p) => parseInt(p, 10));
    const len = Math.max(partsA.length, partsB.length);
    for (let i = 0; i < len; i++) {
      const valA = isNaN(partsA[i]) ? 0 : partsA[i];
      const valB = isNaN(partsB[i]) ? 0 : partsB[i];
      if (valA !== valB) {
        return valA - valB;
      }
    }
    return (seqA || '').localeCompare(seqB || '');
  }

  readonly communicationGroupPalette: string[] = [
    '#241C18', // 1: Negro Carbón
    '#8B0000', // 2: Guindo / Rojo Carmín Oscuro (como en EA)
    '#15803D', // 3: Verde Bosque (como en EA)
    '#1D4ED8', // 4: Azul Real
    '#7C3AED', // 5: Violeta Púrpura
    '#C2410C', // 6: Naranja Óxido
    '#0E7490', // 7: Cian Océano
    '#BE185D', // 8: Rosa / Magenta
    '#4D7C0F', // 9: Verde Oliva
    '#4338CA', // 10: Índigo Profundo
  ];

  getCommMessageColor(msg: UmlMessage): string {
    const match = (msg.sequenceNumber || '').trim().match(/^(\d+)/);
    const g = match ? parseInt(match[1], 10) : 1;
    const groupColor = this.communicationGroupPalette[(Math.max(1, g) - 1) % this.communicationGroupPalette.length];

    if (!msg.color || msg.color === '#241C18' || msg.color === '#000000') {
      return groupColor;
    }
    return msg.color;
  }

  getMaxSequenceSlotUsed(): number {
    let maxSlot = -1;
    for (const c of this.connections()) {
      if (!c.sourceId && !c.targetId) continue;
      const sMatch = c.sourceId?.match(/_slot_(\d+)$/);
      if (sMatch) {
        maxSlot = Math.max(maxSlot, parseInt(sMatch[1], 10));
      }
      const tMatch = c.targetId?.match(/_slot_(\d+)$/);
      if (tMatch) {
        maxSlot = Math.max(maxSlot, parseInt(tMatch[1], 10));
      }
    }
    return maxSlot;
  }

  isSequenceSlotOccupied(slot: number): boolean {
    return this.connections().some((c) => {
      if (!this.isSequenceConnection(c)) return false;
      const sMatch = c.sourceId?.match(/_slot_(\d+)$/);
      const tMatch = c.targetId?.match(/_slot_(\d+)$/);
      return (
        (sMatch && parseInt(sMatch[1], 10) === slot) ||
        (tMatch && parseInt(tMatch[1], 10) === slot)
      );
    });
  }

  // Slots interactivos para líneas de vida en diagrama de secuencia (puntos de anclaje cada 50px)
  get sequenceSlots(): number[] {
    const maxSlot = this.getMaxSequenceSlotUsed();
    // Inicia con un tamaño reducido (4 slots: 0, 1, 2, 3) y crece dinámicamente con 3 slots libres adicionales debajo del último mensaje
    const count = Math.max(4, maxSlot + 1 + 3);
    return Array.from({ length: count }, (_, i) => i);
  }

  getLifelineLength(node?: UmlClassNode): number {
    const maxSlot = this.getMaxSequenceSlotUsed();
    const count = Math.max(4, maxSlot + 1 + 3);
    const nodeHeaderHeight = node?.nodeType === 'actor' ? 95 : 60;
    // La línea discontinua se extiende 40px más allá del último slot disponible
    const targetBottom = 160 + (count - 1) * 50 + 40;
    const minLength = node?.nodeType === 'actor' ? 80 : 120;
    return Math.max(minLength, targetBottom - nodeHeaderHeight);
  }

  getSlotTop(node: UmlClassNode, slot: number): number {
    return 160 + slot * 50;
  }

  getNodeActivations(node: UmlClassNode): { id: string; top: number; height: number }[] {
    if (this.activeDiagramType() !== DiagramType.SEQUENCE && node.nodeType !== 'lifeline') {
      return [];
    }

    const headerHeight = node.nodeType === 'actor' ? 95 : 60;

    interface ParsedSeqConn {
      conn: UmlConnection;
      slot: number;
      sourceId: string;
      targetId: string;
      isReply: boolean;
      groupKey: string;
      seqNum: string;
    }

    const allSeqConns: ParsedSeqConn[] = [];

    for (const c of this.connections()) {
      if (!this.isSequenceConnection(c)) continue;

      const baseSrc = c.sourceNodeId || c.sourceId?.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
      const baseTgt = c.targetNodeId || c.targetId?.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
      if (!baseSrc || !baseTgt) continue;

      const sMatch = c.sourceId?.match(/_slot_(\d+)$/);
      const tMatch = c.targetId?.match(/_slot_(\d+)$/);
      const slot = sMatch ? parseInt(sMatch[1], 10) : (tMatch ? parseInt(tMatch[1], 10) : 0);
      const isReply = this.isReplyConnection(c);

      let seqNum = '';
      if (c.messages && c.messages.length > 0 && c.messages[0].sequenceNumber) {
        seqNum = c.messages[0].sequenceNumber.trim();
      } else if (c.name) {
        seqNum = c.name.trim();
      }

      let groupKey = '';
      const dotMatch = seqNum.match(/^(\d+)(?:\.|$)/);
      if (dotMatch) {
        groupKey = dotMatch[1];
      }

      allSeqConns.push({
        conn: c,
        slot,
        sourceId: baseSrc,
        targetId: baseTgt,
        isReply,
        groupKey,
        seqNum,
      });
    }

    if (allSeqConns.length === 0) {
      if (node.activations && node.activations.length > 0) {
        return node.activations.map((a, i) => ({
          id: a.id || `act_manual_${i}`,
          top: a.startY ?? a.top ?? 40,
          height: a.height ?? 60,
        }));
      }
      return [];
    }

    allSeqConns.sort((a, b) => a.slot - b.slot);

    interface Interaction {
      id: string;
      initiatorId: string;
      conns: ParsedSeqConn[];
    }

    const interactions: Interaction[] = [];
    const keyedGroups = new Map<string, ParsedSeqConn[]>();
    const unkeyedConns: ParsedSeqConn[] = [];

    for (const sc of allSeqConns) {
      if (sc.groupKey) {
        if (!keyedGroups.has(sc.groupKey)) {
          keyedGroups.set(sc.groupKey, []);
        }
        keyedGroups.get(sc.groupKey)!.push(sc);
      } else {
        unkeyedConns.push(sc);
      }
    }

    for (const [key, grp] of keyedGroups.entries()) {
      grp.sort((a, b) => a.slot - b.slot);
      interactions.push({
        id: `keyed_${key}`,
        initiatorId: grp[0].sourceId,
        conns: grp,
      });
    }

    if (unkeyedConns.length > 0) {
      let currentInter: Interaction | null = null;
      let replySeenToInitiator = false;

      for (const sc of unkeyedConns) {
        const isNewInitiatorCall = currentInter && (
          replySeenToInitiator ||
          (sc.sourceId === currentInter.initiatorId && sc.slot - currentInter.conns[currentInter.conns.length - 1].slot >= 2) ||
          (sc.sourceId !== currentInter.initiatorId && !currentInter.conns.some(prev => prev.targetId === sc.sourceId || prev.sourceId === sc.sourceId))
        );

        if (!currentInter || isNewInitiatorCall) {
          if (currentInter) {
            interactions.push(currentInter);
          }
          currentInter = {
            id: `unkeyed_${sc.slot}`,
            initiatorId: sc.sourceId,
            conns: [sc],
          };
          replySeenToInitiator = sc.isReply && sc.targetId === sc.sourceId;
        } else {
          currentInter.conns.push(sc);
          if (sc.isReply && sc.targetId === currentInter.initiatorId) {
            replySeenToInitiator = true;
          }
        }
      }

      if (currentInter) {
        interactions.push(currentInter);
      }
    }

    const intervals: { id: string; minSlot: number; maxSlot: number }[] = [];

    for (const inter of interactions) {
      const conns = inter.conns;
      const interMinSlot = Math.min(...conns.map(c => c.slot));
      const interMaxSlot = Math.max(...conns.map(c => c.slot));

      const isActorInitiator = node.nodeType === 'actor' && node.id === inter.initiatorId;

      if (isActorInitiator) {
        // SOLO EN EL ACTOR: la barra de activación es una sola y continua en toda la interacción
        const startSlot = interMinSlot;
        const replyToInitiator = conns.find(
          c => c.isReply && c.targetId === node.id && c.slot > startSlot
        );
        const endSlot = replyToInitiator ? replyToInitiator.slot : interMaxSlot;

        intervals.push({
          id: `act_${node.id}_${inter.id}_${startSlot}_${endSlot}`,
          minSlot: startSlot,
          maxSlot: endSlot,
        });
      } else {
        // EN LOS DEMÁS ELEMENTOS (View, Controller, etc.):
        // Como en EA, cada llamada entrante tiene su propia activación independiente.
        // Por más que estén en slots contiguos, NO se genera un junte entre llamadas separadas.
        const myConns = conns.filter(c => c.sourceId === node.id || c.targetId === node.id);
        if (myConns.length === 0) {
          continue;
        }

        const incomingCalls = conns.filter(c => c.targetId === node.id && !c.isReply);
        const effectiveIncoming = incomingCalls.length > 0 ? incomingCalls : conns.filter(c => c.targetId === node.id);

        if (effectiveIncoming.length > 0) {
          const sortedIncoming = [...effectiveIncoming].sort((a, b) => a.slot - b.slot);

          for (let i = 0; i < sortedIncoming.length; i++) {
            const inc = sortedIncoming[i];
            const incSlot = inc.slot;
            const nextIncSlot = i + 1 < sortedIncoming.length ? sortedIncoming[i + 1].slot : Infinity;

            // Salidas o respuestas de este nodo generadas a partir de esta llamada (antes de la siguiente llamada entrante)
            const myOutgoing = conns.filter(
              c => c.sourceId === node.id && c.slot >= incSlot && c.slot < nextIncSlot
            );

            let endSlot = incSlot;
            if (myOutgoing.length > 0) {
              endSlot = Math.max(...myOutgoing.map(c => c.slot));
            }

            intervals.push({
              id: `act_${node.id}_${inter.id}_${incSlot}_${endSlot}`,
              minSlot: incSlot,
              maxSlot: endSlot,
            });
          }
        }

        // Si hay llamadas salientes no cubiertas por llamadas entrantes
        const orphanOutgoing = conns.filter(
          c => c.sourceId === node.id && !intervals.some(inv => c.slot >= inv.minSlot && c.slot <= inv.maxSlot)
        );
        for (const out of orphanOutgoing) {
          intervals.push({
            id: `act_${node.id}_${inter.id}_${out.slot}_${out.slot}`,
            minSlot: out.slot,
            maxSlot: out.slot,
          });
        }
      }
    }

    intervals.sort((a, b) => a.minSlot - b.minSlot);

    // Merge overlapping intervals (only if they actually overlap in slots: minSlot <= prev.maxSlot)
    // Non-overlapping slots (even if adjacent: minSlot > prev.maxSlot) remain separate!
    const mergedIntervals: { id: string; minSlot: number; maxSlot: number }[] = [];
    for (const inv of intervals) {
      if (mergedIntervals.length === 0) {
        mergedIntervals.push({ ...inv });
      } else {
        const prev = mergedIntervals[mergedIntervals.length - 1];
        if (inv.minSlot <= prev.maxSlot) {
          prev.maxSlot = Math.max(prev.maxSlot, inv.maxSlot);
          prev.id = `${prev.id}_${inv.maxSlot}`;
        } else {
          mergedIntervals.push({ ...inv });
        }
      }
    }

    return mergedIntervals.map((inv) => {
      const slotYStart = 160 + inv.minSlot * 50 - headerHeight;
      const slotYEnd = 160 + inv.maxSlot * 50 - headerHeight;
      const top = Math.max(0, slotYStart - 4);
      const height = slotYEnd - slotYStart + 22;
      return {
        id: inv.id,
        top,
        height,
      };
    });
  }

  getSequenceConnColor(conn: UmlConnection): string {
    if (conn.messages && conn.messages.length > 0 && conn.messages[0].color) {
      return conn.messages[0].color;
    }
    const seqNum = conn.messages?.[0]?.sequenceNumber || conn.name || '';
    const match = seqNum.trim().match(/^(\d+)(?:\.|$)/);
    const palette = [
      '#0284C7', '#7C3AED', '#059669', '#D97706',
      '#DC2626', '#0891B2', '#4F46E5', '#C026D3'
    ];
    if (match) {
      const g = parseInt(match[1], 10);
      return palette[(Math.max(1, g) - 1) % palette.length];
    }
    return '#0284C7';
  }

  isSequenceConnection(conn: UmlConnection): boolean {
    if (this.activeDiagramType() === DiagramType.COMMUNICATION) {
      return false;
    }
    return (
      this.activeDiagramType() === DiagramType.SEQUENCE ||
      ['sync', 'reply', 'async', 'create', 'self'].includes(conn.type as any)
    );
  }

  isReplyConnection(conn: UmlConnection): boolean {
    return conn.type === 'reply' || (!!conn.messages && conn.messages.some((m) => m.isReturn));
  }

  formatLifelineName(name?: string): string {
    if (!name || !name.trim()) return '';
    return name;
  }

  getDeploymentTopPoints(node: UmlClassNode): string {
    const w = this.getNodeWidth(node);
    const d = 14;
    return `0,${d} ${d},0 ${w},0 ${w - d},${d}`;
  }

  getDeploymentRightPoints(node: UmlClassNode): string {
    const w = this.getNodeWidth(node);
    const h = this.getNodeHeight(node) || (node.nodeType === 'executionEnvironment' ? 160 : 140);
    const d = 14;
    return `${w - d},${d} ${w},0 ${w},${h - d} ${w - d},${h}`;
  }

  getDeploymentFrontWidth(node: UmlClassNode): number {
    return Math.max(80, this.getNodeWidth(node) - 14);
  }

  getDeploymentFrontHeight(node: UmlClassNode): number {
    const h = this.getNodeHeight(node) || (node.nodeType === 'executionEnvironment' ? 160 : 140);
    return Math.max(60, h - 14);
  }

  getDeploymentColors(node: UmlClassNode): { front: string; top: string; right: string; border: string } {
    const isDevice = node.nodeType === 'device' || node.stereotype === 'device';
    const isExec = node.nodeType === 'executionEnvironment' || node.stereotype === 'executionEnvironment';

    let front = node.color;
    if (!front || ((front === '#FFFDDD' || front === '#FDFAF3') && (isDevice || isExec || node.nodeType === 'node'))) {
      if (isDevice) {
        front = '#F3FAF7';
      } else if (isExec) {
        front = '#CDE5F5';
      } else {
        front = '#F3FAF7';
      }
    }

    if (isDevice || front === '#F3FAF7' || front === '#FFFDF8' || front === '#FFF9F2' || front === '#FFFFFF') {
      return {
        front,
        top: '#FFFFFF',
        right: '#E8DFD3',
        border: '#333333',
      };
    }

    if (front === '#CDE5F5' || front === '#CDE6F7' || front === '#D2E8F9' || front === '#C6E2F7') {
      return {
        front,
        top: '#E4F2FD',
        right: '#AFD4EE',
        border: '#1E3A5F',
      };
    }

    return {
      front,
      top: this.adjustBrightness(front, 20),
      right: this.adjustBrightness(front, -20),
      border: '#241C18',
    };
  }

  private adjustBrightness(col: string, percent: number): string {
    if (!col || !col.startsWith('#') || (col.length !== 7 && col.length !== 4)) {
      return col || '#CDE6F7';
    }
    let hex = col.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    const num = parseInt(hex, 16);
    let r = (num >> 16) + Math.round(255 * (percent / 100));
    let g = ((num >> 8) & 0x00ff) + Math.round(255 * (percent / 100));
    let b = (num & 0x0000ff) + Math.round(255 * (percent / 100));
    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }
}
