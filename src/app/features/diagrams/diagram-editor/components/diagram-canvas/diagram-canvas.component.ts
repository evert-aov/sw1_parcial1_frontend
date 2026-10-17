import {
  Component,
  Directive,
  AfterViewInit,
  OnDestroy,
  input,
  output,
  signal,
  computed,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
  inject,
  NgZone,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroLockClosed, heroTrash, heroPlus } from '@ng-icons/heroicons/outline';
import Konva from 'konva';

import {
  UmlClassNode,
  UmlConnection,
  UmlRelationshipType,
  UmlLineStyle,
  DiagramType,
} from '../../../../../core/models/diagram.model';
import { RemoteCursor, NodeLock } from '../../../../../core/services/collaboration.service';
import { TranslatePipe, TranslationService } from '../../../../../core/i18n';
import { DropNodePayload } from '../../services/diagram-node-operations.service';
import { getNodeWidth, getNodeHeight } from '../../utils/node-metrics.util';
import { DiagramSequenceActivationService } from '../../services/diagram-sequence-activation.service';
import { isSequenceRelationshipType, findNextAvailableSlot } from './nodes/uml-lifeline-node/uml-lifeline.logic';

import {
  createClassKonvaNode,
  resizeClassKonvaNode,
  createActorKonvaNode,
  resizeActorKonvaNode,
  createUseCaseKonvaNode,
  resizeUseCaseKonvaNode,
  createBoundaryKonvaNode,
  resizeBoundaryKonvaNode,
  createControlKonvaNode,
  resizeControlKonvaNode,
  createEntityKonvaNode,
  resizeEntityKonvaNode,
  createLifelineKonvaNode,
  resizeLifelineKonvaNode,
  createDeploymentKonvaNode,
  resizeDeploymentKonvaNode,
  createUmlRelationshipKonvaGroup,
} from './konva/nodes';
import { toKonvaNode, toKonvaRelationship } from './konva/konva-adapter.util';
import { UmlNode, UmlRelationship } from './konva/models/uml.model';

export interface DiagramCanvasViewState {
  zoom: number;
  scrollLeft: number;
  scrollTop: number;
}

export type DiagramDropPayload = DropNodePayload;

export interface NodeResizeRect {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

// Interfaces de eventos compatibles con el editor
export interface CanvasCreateConnectionEvent {
  fOutputId: string;
  fInputId: string;
  [key: string]: unknown;
}

export interface CanvasReassignConnectionEvent {
  connectionId: string;
  newSourceId?: string;
  newTargetId?: string;
  [key: string]: unknown;
}

export interface CanvasMoveNodesEvent {
  nodeIds: string[];
  [key: string]: unknown;
}

export interface CanvasSelectionChangeEvent {
  nodes: string[];
  connections: string[];
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
  }
}

@Component({
  selector: 'app-diagram-canvas',
  standalone: true,
  imports: [CommonModule, NgIconComponent, TranslatePipe],
  host: {
    class: 'flex-1 relative w-full h-full flex flex-col min-h-0 min-w-0 overflow-hidden',
  },
  providers: [
    provideIcons({
      heroLockClosed,
      heroTrash,
      heroPlus,
    }),
  ],
  templateUrl: './diagram-canvas.component.html',
  styleUrl: './diagram-canvas.component.css',
})
export class DiagramCanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('stageContainer', { static: false })
  stageContainerRef?: ElementRef<HTMLDivElement>;

  @ViewChild('flowContainer', { static: false })
  flowContainerRef?: ElementRef<HTMLElement>;

  private readonly ngZone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translationService = inject(TranslationService);
  private readonly sequenceActivationService = inject(DiagramSequenceActivationService);

  // Inputs del lienzo
  readonly nodes = input.required<UmlClassNode[]>();
  readonly connections = input.required<UmlConnection[]>();
  readonly selectedRelationType = input<UmlRelationshipType | null>(null);
  readonly selectedSourceNodeId = input<string | null>(null);
  readonly defaultLineStyle = input<UmlLineStyle>('segment');
  readonly isReadOnly = input<boolean>(false);
  readonly selectedNodeIds = input<string[]>([]);
  readonly selectedConnIds = input<string[]>([]);
  readonly remoteCursors = input<RemoteCursor[]>([]);
  readonly nodeLocks = input<Map<string, NodeLock> | Record<string, NodeLock>>({});
  readonly currentUserId = input<string | null>(null);
  readonly diagramId = input<string | null>(null);
  readonly activeDiagramType = input<DiagramType>(DiagramType.CLASS);
  readonly smartGuidesEnabled = input<boolean>(true);

  // Outputs hacia el contenedor principal (DiagramEditorComponent)
  readonly flowLoaded = output<void>();
  readonly connectionCreated = output<any>();
  readonly connectionReassigned = output<any>();
  readonly moveNodes = output<any>();
  readonly selectionChange = output<any>();
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
  readonly nodeDropped = output<{ payload: DiagramDropPayload; position: { x: number; y: number } }>();
  readonly nodeContextMenu = output<{ node: UmlClassNode; event: MouseEvent }>();
  readonly connectionContextMenu = output<{ conn: UmlConnection; event: MouseEvent }>();
  readonly canvasContextMenu = output<{ event: MouseEvent; canvasPos: { x: number; y: number } }>();

  // Estado interno del lienzo
  readonly zoomLevel = signal<number>(100);
  readonly isDragOverCanvas = signal<boolean>(false);
  readonly hoveredNodeId = signal<string | null>(null);
  readonly renamingNodeId = signal<string | null>(null);
  readonly pendingSourceNodeId = signal<string | null>(null);

  // Konva Engine References
  private stage: Konva.Stage | null = null;
  private bgLayer: Konva.Layer | null = null;
  private relLayer: Konva.Layer | null = null;
  private nodeLayer: Konva.Layer | null = null;
  private uiLayer: Konva.Layer | null = null;
  private transformer: Konva.Transformer | null = null;
  private gridGroup: Konva.Group | null = null;
  private bgRect: Konva.Rect | null = null;
  private previewLineGroup: Konva.Group | null = null;

  private nodeGroupsMap = new Map<string, Konva.Group>();
  private relAnimLoop: Konva.Animation | null = null;
  private flowPhase = 0;
  private resizeObserver?: ResizeObserver;

  // Selección interna
  private readonly selectedNodeIdsInternal = signal<string[]>([]);
  private readonly selectedConnIdsInternal = signal<string[]>([]);

  /** Computed: true cuando no hay nodos reales en el diagrama */
  readonly hasNoRealNodes = computed(() => !this.nodes().some((n) => !n.isAnchor));

  /** Computed: mensaje contextual del empty state */
  readonly canvasEmptyStateMessage = computed(() => {
    const type = this.activeDiagramType();
    const key = `editor.canvas.emptyState.${type}`;
    const msg = this.translationService.translate(key);
    return msg !== key ? msg : this.translationService.translate('editor.canvas.emptyState.class');
  });

  constructor() {
    // Sincronizar automáticamente el renderizado cuando los signals cambian
    effect(() => {
      // Registrar dependencias de reactividad
      const nodes = this.nodes();
      const connections = this.connections();
      const selectedIds = this.selectedNodeIds();
      const selectedConns = this.selectedConnIds();
      const relType = this.selectedRelationType();

      if (this.stage && this.nodeLayer) {
        this.renderFullDiagram();
      }
    });
  }

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;

    setTimeout(() => {
      this.initKonvaStage();
      this.flowLoaded.emit();
    }, 40);
  }

  ngOnDestroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.relAnimLoop) {
      this.relAnimLoop.stop();
      this.relAnimLoop = null;
    }
    if (this.stage) {
      this.stage.destroy();
      this.stage = null;
    }
  }

  private initKonvaStage(): void {
    const container = this.stageContainerRef?.nativeElement;
    if (!container) return;

    const width = container.clientWidth || 1050;
    const height = container.clientHeight || 700;

    this.ngZone.runOutsideAngular(() => {
      this.stage = new Konva.Stage({
        container,
        width,
        height,
        draggable: false,
      });

      this.bgLayer = new Konva.Layer({ listening: false });
      this.relLayer = new Konva.Layer();
      this.nodeLayer = new Konva.Layer();
      this.uiLayer = new Konva.Layer();

      this.bgRect = new Konva.Rect({
        x: -10000,
        y: -10000,
        width: 20000,
        height: 20000,
        fill: '#FAF9F5',
        listening: false,
      });
      this.bgLayer.add(this.bgRect);

      this.gridGroup = new Konva.Group({ listening: false });
      this.bgLayer.add(this.gridGroup);

      this.previewLineGroup = new Konva.Group({ listening: false });
      this.uiLayer.add(this.previewLineGroup);

      // Transformer para redimensionamiento fluido de nodos
      this.transformer = new Konva.Transformer({
        rotateEnabled: false,
        ignoreStroke: true,
        padding: 4,
        anchorSize: 9,
        anchorCornerRadius: 2,
        anchorStroke: '#059669',
        anchorFill: '#FFFFFF',
        borderStroke: '#059669',
        borderDash: [4, 4],
        boundBoxFunc: (oldBox, newBox) => {
          if (newBox.width < 80 || newBox.height < 50) {
            return oldBox;
          }
          return newBox;
        },
      });
      this.uiLayer.add(this.transformer);

      this.stage.add(this.bgLayer);
      this.stage.add(this.relLayer);
      this.stage.add(this.nodeLayer);
      this.stage.add(this.uiLayer);

      this.drawGrid();
      this.renderFullDiagram();
      this.startRelationshipAnimationLoop();
      this.bindStageEvents();

      // Observador de redimensionamiento del contenedor
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width: newW, height: newH } = entry.contentRect;
          if (this.stage && newW > 0 && newH > 0) {
            this.stage.width(newW);
            this.stage.height(newH);
            this.stage.batchDraw();
          }
        }
      });
      this.resizeObserver.observe(container);
    });
  }

  private startRelationshipAnimationLoop(): void {
    if (!this.relLayer) return;

    this.relAnimLoop = new Konva.Animation((frame) => {
      if (!frame) return;
      this.flowPhase = (frame.time * 0.03) % 360;
      this.renderRelationshipsOnly();
    }, this.relLayer);

    this.relAnimLoop.start();
  }

  private bindStageEvents(): void {
    if (!this.stage) return;

    let isPanning = false;
    let panStart = { x: 0, y: 0 };
    let stageStartPos = { x: 0, y: 0 };

    this.stage.on('mousedown touchstart', (e) => {
      const isTargetStage = e.target === this.stage || e.target === this.bgRect;

      if (isTargetStage) {
        // Iniciar panning si se hace clic en el fondo
        isPanning = true;
        const pointer = this.stage?.getPointerPosition() || { x: 0, y: 0 };
        panStart = { ...pointer };
        stageStartPos = { x: this.stage?.x() || 0, y: this.stage?.y() || 0 };

        this.ngZone.run(() => {
          this.pendingSourceNodeId.set(null);
          this.clearLivePreviewLine();
          this.clearSelection();
          this.canvasBackgroundClick.emit(e.evt as MouseEvent);
        });
      }
    });

    this.stage.on('mousemove touchmove', (e) => {
      if (!this.stage) return;

      const pointer = this.stage.getPointerPosition() || { x: 0, y: 0 };

      if (isPanning) {
        const dx = pointer.x - panStart.x;
        const dy = pointer.y - panStart.y;
        this.stage.position({
          x: stageStartPos.x + dx,
          y: stageStartPos.y + dy,
        });
        this.stage.batchDraw();
        return;
      }

      // Previsualización de línea en modo conexión
      const pendingSrcId = this.pendingSourceNodeId();
      if (pendingSrcId) {
        const transform = this.stage.getAbsoluteTransform().copy().invert();
        const canvasPos = transform.point(pointer);
        this.drawLiveConnectionPreview(pendingSrcId, canvasPos.x, canvasPos.y);
      }

      this.canvasMouseMove.emit(e.evt as MouseEvent);
    });

    this.stage.on('mouseup touchend', () => {
      isPanning = false;
    });

    // Zoom suave con rueda de ratón centrado en el cursor
    this.stage.on('wheel', (e) => {
      e.evt.preventDefault();
      if (!this.stage) return;

      const scaleBy = 1.08;
      const oldScale = this.stage.scaleX();
      const pointer = this.stage.getPointerPosition();
      if (!pointer) return;

      const mousePointTo = {
        x: (pointer.x - this.stage.x()) / oldScale,
        y: (pointer.y - this.stage.y()) / oldScale,
      };

      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const newScale = Math.min(2.5, Math.max(0.3, direction > 0 ? oldScale * scaleBy : oldScale / scaleBy));

      this.stage.scale({ x: newScale, y: newScale });
      this.stage.position({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      });
      this.stage.batchDraw();

      this.ngZone.run(() => {
        const pct = Math.round(newScale * 100);
        this.zoomLevel.set(pct);
        this.zoomChange.emit(pct);
      });
    });
  }

  private drawGrid(): void {
    if (!this.gridGroup || !this.bgLayer) return;
    this.gridGroup.destroyChildren();

    const step = 28;
    const range = 5000;
    for (let i = -range; i <= range; i += step) {
      const isMajor = i % (step * 4) === 0;
      this.gridGroup.add(
        new Konva.Line({
          points: [i, -range, i, range],
          stroke: isMajor ? 'rgba(120, 113, 108, 0.15)' : 'rgba(120, 113, 108, 0.05)',
          strokeWidth: 1,
          listening: false,
        })
      );
      this.gridGroup.add(
        new Konva.Line({
          points: [-range, i, range, i],
          stroke: isMajor ? 'rgba(120, 113, 108, 0.15)' : 'rgba(120, 113, 108, 0.05)',
          strokeWidth: 1,
          listening: false,
        })
      );
    }
    this.bgLayer.batchDraw();
  }

  private drawLiveConnectionPreview(sourceId: string, cursorX: number, cursorY: number): void {
    if (!this.previewLineGroup || !this.uiLayer) return;
    const srcNode = this.nodes().find((n) => n.id === sourceId);
    if (!srcNode) return;

    this.previewLineGroup.destroyChildren();

    const isSeq = this.activeDiagramType() === DiagramType.SEQUENCE;
    const startX = srcNode.position.x + (srcNode.width || 120) / 2;
    const startY = isSeq ? cursorY : srcNode.position.y + (srcNode.height || 100) / 2;

    const previewArrow = new Konva.Arrow({
      points: [startX, startY, cursorX, cursorY],
      stroke: '#059669',
      fill: '#059669',
      strokeWidth: 2,
      dash: [6, 4],
      pointerLength: 10,
      pointerWidth: 8,
      listening: false,
    });

    const originCircle = new Konva.Circle({
      x: startX,
      y: startY,
      radius: 5,
      fill: '#059669',
      listening: false,
    });

    this.previewLineGroup.add(originCircle, previewArrow);
    this.uiLayer.batchDraw();
  }

  private clearLivePreviewLine(): void {
    if (!this.previewLineGroup || !this.uiLayer) return;
    this.previewLineGroup.destroyChildren();
    this.uiLayer.batchDraw();
  }

  renderFullDiagram(): void {
    if (!this.nodeLayer || !this.relLayer) return;

    this.nodeLayer.destroyChildren();
    this.nodeGroupsMap.clear();

    const currentNodes = this.nodes().filter((n) => !n.isAnchor);
    const selectedIds = new Set([...this.selectedNodeIds(), ...this.selectedNodeIdsInternal()]);
    const pendingSrcId = this.pendingSourceNodeId();

    for (const rawNode of currentNodes) {
      const isSelected = selectedIds.has(rawNode.id) || rawNode.id === pendingSrcId;
      const kNode = toKonvaNode(
        rawNode,
        this.activeDiagramType(),
        this.connections(),
        this.sequenceActivationService
      );
      const group = this.buildNodeGroup(kNode, isSelected);

      this.attachNodeInteractions(group, rawNode);
      this.nodeGroupsMap.set(rawNode.id, group);
      this.nodeLayer.add(group);
    }

    this.renderRelationshipsOnly();
    this.syncTransformer();
    this.nodeLayer.batchDraw();
    this.uiLayer?.batchDraw();
  }

  private renderRelationshipsOnly(): void {
    if (!this.relLayer) return;
    this.relLayer.destroyChildren();

    const nodeMap = new Map<string, UmlNode>();
    for (const rawNode of this.nodes()) {
      if (!rawNode.isAnchor) {
        nodeMap.set(
          rawNode.id,
          toKonvaNode(
            rawNode,
            this.activeDiagramType(),
            this.connections(),
            this.sequenceActivationService
          )
        );
      }
    }

    const selectedConnIds = new Set([...this.selectedConnIds(), ...this.selectedConnIdsInternal()]);
    const isSequenceDiag = this.activeDiagramType() === DiagramType.SEQUENCE;

    for (const rawConn of this.connections()) {
      const kRel = toKonvaRelationship(rawConn, this.activeDiagramType());
      const src = nodeMap.get(kRel.sourceId);
      const tgt = nodeMap.get(kRel.targetId);
      if (!src || !tgt) continue;

      const isSelected = selectedConnIds.has(rawConn.id);
      const relGroup = createUmlRelationshipKonvaGroup(
        kRel,
        src,
        tgt,
        isSelected,
        1,
        this.flowPhase
      );

      // Si es un mensaje de secuencia, permitir moverlo verticalmente entre slots
      const isSeqConn = isSequenceDiag || ['sync_message', 'return_message'].includes(kRel.type);
      if (isSeqConn && !this.isReadOnly()) {
        relGroup.draggable(true);
        relGroup.dragBoundFunc((pos) => ({
          x: relGroup.absolutePosition().x,
          y: pos.y,
        }));

        relGroup.on('dragend', () => {
          const deltaY = relGroup.y();
          relGroup.y(0);
          const origY = kRel.yOffset || 160;
          const finalY = origY + deltaY;
          const targetSlot = Math.max(0, Math.round((finalY - 160) / 50));

          this.ngZone.run(() => {
            this.sequenceMessageMove.emit({
              connectionId: rawConn.id,
              targetSlot,
            });
          });
        });
      }

      relGroup.on('mousedown touchstart', (e) => {
        e.cancelBubble = true;
        this.ngZone.run(() => {
          this.connectionClick.emit({ connId: rawConn.id, event: e.evt as MouseEvent });
        });
      });

      relGroup.on('dblclick dbltap', (e) => {
        e.cancelBubble = true;
        this.ngZone.run(() => {
          this.connectionDblClick.emit({ conn: rawConn, event: e.evt as MouseEvent });
        });
      });

      relGroup.on('contextmenu', (e) => {
        e.evt.preventDefault();
        e.cancelBubble = true;
        this.ngZone.run(() => {
          this.connectionContextMenu.emit({ conn: rawConn, event: e.evt as MouseEvent });
        });
      });

      this.relLayer.add(relGroup);
    }

    this.relLayer.batchDraw();
  }

  private buildNodeGroup(node: UmlNode, isSelected: boolean): Konva.Group {
    switch (node.type) {
      case 'class':
        return createClassKonvaNode(node, isSelected);
      case 'actor':
        return createActorKonvaNode(node, isSelected);
      case 'use_case':
        return createUseCaseKonvaNode(node, isSelected);
      case 'boundary':
        return createBoundaryKonvaNode(node, isSelected);
      case 'control':
        return createControlKonvaNode(node, isSelected);
      case 'entity':
        return createEntityKonvaNode(node, isSelected);
      case 'lifeline':
        return createLifelineKonvaNode(node, isSelected);
      case 'deployment_node':
        return createDeploymentKonvaNode(node, isSelected);
      default:
        return createClassKonvaNode(node, isSelected);
    }
  }

  private attachNodeInteractions(group: Konva.Group, origNode: UmlClassNode): void {
    const isLocked = this.isNodeLockedByOther(origNode.id);
    const canDrag = !this.isReadOnly() && !isLocked && this.selectedRelationType() === null;
    group.draggable(canDrag);

    group.on('mouseenter', () => {
      this.hoveredNodeId.set(origNode.id);
    });

    group.on('mouseleave', () => {
      if (this.hoveredNodeId() === origNode.id) {
        this.hoveredNodeId.set(null);
      }
    });

    group.on('mousedown touchstart', (e) => {
      e.cancelBubble = true;

      // Si hay una relación seleccionada en la barra de herramientas, crear conexión de A -> B
      const activeRelType = this.selectedRelationType();
      if (activeRelType) {
        this.ngZone.run(() => {
          const pendingSrc = this.pendingSourceNodeId();
          if (!pendingSrc) {
            this.pendingSourceNodeId.set(origNode.id);
          } else if (pendingSrc !== origNode.id) {
            const isSeq =
              this.activeDiagramType() === DiagramType.SEQUENCE ||
              isSequenceRelationshipType(activeRelType);
            if (isSeq) {
              const nextSlot = findNextAvailableSlot(this.connections());
              this.connectionCreated.emit({
                fOutputId: `${pendingSrc}_slot_${nextSlot}`,
                fInputId: `${origNode.id}_slot_${nextSlot}`,
              });
            } else {
              this.connectionCreated.emit({
                fOutputId: pendingSrc,
                fInputId: origNode.id,
              });
            }
            this.pendingSourceNodeId.set(null);
            this.clearLivePreviewLine();
          }
        });
        return;
      }

      this.ngZone.run(() => {
        this.nodeClick.emit({ nodeId: origNode.id, event: e.evt as MouseEvent });
      });
    });

    group.on('dblclick dbltap', (e) => {
      e.cancelBubble = true;
      this.ngZone.run(() => {
        this.nodeDblClick.emit({ node: origNode, event: e.evt as MouseEvent });
      });
    });

    group.on('contextmenu', (e) => {
      e.evt.preventDefault();
      e.cancelBubble = true;
      this.ngZone.run(() => {
        this.nodeContextMenu.emit({ node: origNode, event: e.evt as MouseEvent });
      });
    });

    // Control de arrastre robusto individual y sincronizado (multi-selección y secuencial)
    let dragStartPos = { x: Math.round(group.x()), y: Math.round(group.y()) };
    const siblingStartPositions = new Map<string, { x: number; y: number }>();

    group.on('dragstart', (e) => {
      dragStartPos = { x: Math.round(group.x()), y: Math.round(group.y()) };
      siblingStartPositions.clear();

      if (!this.selectedNodeIds().includes(origNode.id)) {
        this.ngZone.run(() => {
          this.nodeClick.emit({ nodeId: origNode.id, event: e.evt as MouseEvent });
        });
      }

      for (const id of this.selectedNodeIds()) {
        const otherG = this.nodeGroupsMap.get(id);
        if (otherG) {
          siblingStartPositions.set(id, { x: Math.round(otherG.x()), y: Math.round(otherG.y()) });
        }
      }
    });

    // Actualización de líneas en vivo durante el arrastre
    group.on('dragmove', () => {
      // En diagramas de secuencia, la línea de vida solo se mueve horizontalmente en X
      if (this.activeDiagramType() === DiagramType.SEQUENCE || origNode.nodeType === 'lifeline') {
        group.y(origNode.position ? origNode.position.y : 30);
      }

      const curX = Math.round(group.x());
      const curY = Math.round(group.y());
      const dx = curX - dragStartPos.x;
      const dy = curY - dragStartPos.y;

      origNode.position = { x: curX, y: curY };

      // Mover los demás nodos seleccionados de manera coordinada
      if (siblingStartPositions.size > 1 && siblingStartPositions.has(origNode.id)) {
        for (const [id, start] of siblingStartPositions.entries()) {
          if (id !== origNode.id) {
            const otherG = this.nodeGroupsMap.get(id);
            const otherNode = this.nodes().find((n) => n.id === id);
            if (otherG && otherNode) {
              const targetX = Math.round(start.x + dx);
              const targetY =
                this.activeDiagramType() === DiagramType.SEQUENCE || otherNode.nodeType === 'lifeline'
                  ? (otherNode.position ? otherNode.position.y : 30)
                  : Math.round(start.y + dy);
              otherG.position({ x: targetX, y: targetY });
              otherNode.position = { x: targetX, y: targetY };
            }
          }
        }
      }

      // Propagar posición al editor para WebSockets y sincronización reactiva en tiempo real
      this.ngZone.run(() => {
        this.nodePositionChange.emit({ node: origNode, newPosition: { x: curX, y: curY } });
      });

      this.renderRelationshipsOnly();
    });

    group.on('dragend', () => {
      if (this.activeDiagramType() === DiagramType.SEQUENCE || origNode.nodeType === 'lifeline') {
        group.y(origNode.position ? origNode.position.y : 30);
      }
      const finalX = Math.round(group.x());
      const finalY = Math.round(group.y());
      const newPosition = { x: finalX, y: finalY };
      origNode.position = newPosition;

      this.ngZone.run(() => {
        this.nodePositionChange.emit({ node: origNode, newPosition });
        this.syncTransformer();
      });
    });

    // Redimensión fluida de nodo mediante Transformer
    group.on('transform', () => {
      const sX = group.scaleX();
      const sY = group.scaleY();
      const nextW = Math.max(80, Math.round(group.width() * sX));
      const nextH = Math.max(50, Math.round(group.height() * sY));

      group.scaleX(1);
      group.scaleY(1);

      this.applyFluidNodeResize(
        group,
        toKonvaNode(
          origNode,
          this.activeDiagramType(),
          this.connections(),
          this.sequenceActivationService
        ),
        nextW,
        nextH
      );

      origNode.width = nextW;
      origNode.height = nextH;
      origNode.customWidth = nextW;
      origNode.customHeight = nextH;
      origNode.isCustomSize = true;
      origNode.position = { x: Math.round(group.x()), y: Math.round(group.y()) };

      this.renderRelationshipsOnly();
    });

    group.on('transformend', () => {
      const width = Math.round(group.width());
      const height = Math.round(group.height());
      const position = { x: Math.round(group.x()), y: Math.round(group.y()) };

      this.ngZone.run(() => {
        this.nodeSizeChange.emit({ node: origNode, width, height, position });
        this.renderFullDiagram();
      });
    });
  }

  private applyFluidNodeResize(
    group: Konva.Group,
    node: UmlNode,
    newW: number,
    newH: number
  ): void {
    switch (node.type) {
      case 'class':
        resizeClassKonvaNode(group, newW, newH);
        break;
      case 'actor':
        resizeActorKonvaNode(group, newW, newH, node.name, true);
        break;
      case 'use_case':
        resizeUseCaseKonvaNode(group, newW, newH);
        break;
      case 'boundary':
        resizeBoundaryKonvaNode(group, newW, newH, node.name, node.fill || '#E0F2F1', true);
        break;
      case 'control':
        resizeControlKonvaNode(group, newW, newH, node.name, node.fill || '#E0F2F1', true);
        break;
      case 'entity':
        resizeEntityKonvaNode(group, newW, newH, node.name, node.fill || '#E0F2F1', true);
        break;
      case 'lifeline':
        resizeLifelineKonvaNode(group, node, newW, newH, true);
        break;
      case 'deployment_node':
        resizeDeploymentKonvaNode(group, node, newW, newH, true);
        break;
    }
  }

  private syncTransformer(): void {
    if (!this.transformer || !this.uiLayer) return;

    const selectedIds = this.selectedNodeIds();
    if (selectedIds.length === 0 || this.isReadOnly()) {
      this.transformer.nodes([]);
      this.uiLayer.batchDraw();
      return;
    }

    const groups: Konva.Group[] = [];
    for (const id of selectedIds) {
      const g = this.nodeGroupsMap.get(id);
      if (g) groups.push(g);
    }

    this.transformer.nodes(groups);
    this.uiLayer.batchDraw();
  }

  // Métodos de compatibilidad y control público del Canvas

  redraw(): void {
    if (this.stage) {
      this.renderFullDiagram();
      this.stage.batchDraw();
    }
  }

  reset(): void {
    this.resetView();
  }

  resetView(): void {
    if (!this.stage) return;
    this.stage.scale({ x: 1, y: 1 });
    this.stage.position({ x: 0, y: 0 });
    this.zoomLevel.set(100);
    this.zoomChange.emit(100);
    this.stage.batchDraw();
  }

  fitView(): void {
    if (!this.stage || this.nodes().length === 0) {
      this.resetView();
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of this.nodes()) {
      if (n.isAnchor) continue;
      const x = n.position.x;
      const y = n.position.y;
      const w = n.width || 180;
      const h = n.height || 100;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    }

    if (!isFinite(minX)) {
      this.resetView();
      return;
    }

    const container = this.stage.container();
    const cW = container.clientWidth || 800;
    const cH = container.clientHeight || 600;
    const padding = 60;
    const contentW = maxX - minX + padding * 2;
    const contentH = maxY - minY + padding * 2;
    const scale = Math.min(2, Math.max(0.3, Math.min(cW / contentW, cH / contentH)));

    this.stage.scale({ x: scale, y: scale });
    this.stage.position({
      x: (cW - (maxX - minX) * scale) / 2 - minX * scale,
      y: (cH - (maxY - minY) * scale) / 2 - minY * scale,
    });

    const pct = Math.round(scale * 100);
    this.zoomLevel.set(pct);
    this.zoomChange.emit(pct);
    this.stage.batchDraw();
  }

  zoomIn(): void {
    if (!this.stage) return;
    const newScale = Math.min(2.5, this.stage.scaleX() * 1.15);
    this.applyZoom(newScale);
  }

  zoomOut(): void {
    if (!this.stage) return;
    const newScale = Math.max(0.25, this.stage.scaleX() / 1.15);
    this.applyZoom(newScale);
  }

  setZoom(pct: number): void {
    this.applyZoom(pct / 100);
  }

  syncZoomFromCanvas(): void {
    // Sincronización pasiva
  }

  restoreViewportScroll(diagramId: string | null): void {
    // Restauración de scroll
  }

  centerViewportOnBoard(): void {
    this.fitView();
  }

  private applyZoom(scale: number): void {
    if (!this.stage) return;
    const container = this.stage.container();
    const center = {
      x: (container.clientWidth || 800) / 2,
      y: (container.clientHeight || 600) / 2,
    };
    const oldScale = this.stage.scaleX();
    const mousePointTo = {
      x: (center.x - this.stage.x()) / oldScale,
      y: (center.y - this.stage.y()) / oldScale,
    };

    this.stage.scale({ x: scale, y: scale });
    this.stage.position({
      x: center.x - mousePointTo.x * scale,
      y: center.y - mousePointTo.y * scale,
    });

    const pct = Math.round(scale * 100);
    this.zoomLevel.set(pct);
    this.zoomChange.emit(pct);
    this.stage.batchDraw();
  }

  select(nodeIds: string[], connIds: string[]): void {
    this.selectedNodeIdsInternal.set(nodeIds);
    this.selectedConnIdsInternal.set(connIds);
    this.syncTransformer();
    this.renderFullDiagram();
  }

  clearSelection(): void {
    this.selectedNodeIdsInternal.set([]);
    this.selectedConnIdsInternal.set([]);
    this.pendingSourceNodeId.set(null);
    this.clearLivePreviewLine();
    if (this.transformer) {
      this.transformer.nodes([]);
      this.uiLayer?.batchDraw();
    }
    this.renderFullDiagram();
  }

  startRenameNode(nodeId: string): void {
    this.renamingNodeId.set(nodeId);
  }

  getViewState(): DiagramCanvasViewState {
    return {
      zoom: this.zoomLevel(),
      scrollLeft: this.stage ? -Math.round(this.stage.x()) : 0,
      scrollTop: this.stage ? -Math.round(this.stage.y()) : 0,
    };
  }

  applyViewState(state: DiagramCanvasViewState): void {
    if (!this.stage) return;
    const scale = (state.zoom || 100) / 100;
    this.stage.scale({ x: scale, y: scale });
    this.stage.position({ x: -(state.scrollLeft || 0), y: -(state.scrollTop || 0) });
    this.zoomLevel.set(state.zoom || 100);
    this.stage.batchDraw();
  }

  getExportElement(): HTMLElement | undefined {
    return this.stageContainerRef?.nativeElement;
  }

  get canvas(): any {
    const self = this;
    return {
      get transform() {
        return {
          get scale() {
            return self.zoomLevel() ? self.zoomLevel() / 100 : (self.stage ? self.stage.scaleX() : 1);
          },
          set scale(s: number) {
            if (self.stage) {
              self.stage.scale({ x: s, y: s });
              self.stage.batchDraw();
            }
          },
          get position() {
            return { x: self.stage ? self.stage.x() : 0, y: self.stage ? self.stage.y() : 0 };
          },
          set position(pos: { x: number; y: number }) {
            if (self.stage) {
              self.stage.position(pos);
              self.stage.batchDraw();
            }
          },
          scaledPosition: { x: 0, y: 0 },
        };
      },
      resetScale: () => this.resetView(),
      setScale: (scale: number, _origin?: { x: number; y: number }) => {
        if (this.stage) {
          this.stage.scale({ x: scale, y: scale });
          this.stage.batchDraw();
        }
      },
      redraw: () => this.redraw(),
    };
  }

  getNodeWidth(node: UmlClassNode): number {
    return getNodeWidth(node);
  }

  getNodeHeight(node: UmlClassNode): number | null {
    return getNodeHeight(node);
  }

  clientToCanvasCoordinates(clientX: number, clientY: number): { x: number; y: number } {
    if (!this.stage) return { x: clientX, y: clientY };
    const containerRect = this.stage.container().getBoundingClientRect();
    const stagePointer = {
      x: clientX - containerRect.left,
      y: clientY - containerRect.top,
    };
    const transform = this.stage.getAbsoluteTransform().copy().invert();
    const pos = transform.point(stagePointer);
    return {
      x: Math.round(pos.x),
      y: Math.round(pos.y),
    };
  }

  // Helpers de posición de cursores remotos en pantalla
  getCursorScreenX(canvasX: number): number {
    if (!this.stage) return canvasX;
    return canvasX * this.stage.scaleX() + this.stage.x();
  }

  getCursorScreenY(canvasY: number): number {
    if (!this.stage) return canvasY;
    return canvasY * this.stage.scaleY() + this.stage.y();
  }

  getNodeLock(nodeId: string): NodeLock | null {
    const locks = this.nodeLocks();
    if (locks instanceof Map) {
      return locks.get(nodeId) ?? null;
    } else if (locks && typeof locks === 'object') {
      return (locks as Record<string, NodeLock>)[nodeId] ?? null;
    }
    return null;
  }

  isNodeLockedByOther(nodeId: string): boolean {
    const lock = this.getNodeLock(nodeId);
    const myId = this.currentUserId();
    return !!lock && lock.userId !== myId;
  }

  // Manejadores de eventos del contenedor HTML
  onCanvasMouseDown(event: MouseEvent): void {
    this.canvasMouseDown.emit(event);
  }

  onCanvasMouseMove(event: MouseEvent): void {
    this.canvasMouseMove.emit(event);
  }

  onCanvasBackgroundClick(event?: MouseEvent): void {
    this.canvasBackgroundClick.emit(event);
  }

  onCanvasContextMenu(event: MouseEvent): void {
    event.preventDefault();
    const canvasPos = this.clientToCanvasCoordinates(event.clientX, event.clientY);
    this.canvasContextMenu.emit({ event, canvasPos });
  }

  onCanvasDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    this.isDragOverCanvas.set(true);
  }

  onCanvasDragLeave(event: DragEvent): void {
    this.isDragOverCanvas.set(false);
  }

  onCanvasDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOverCanvas.set(false);

    const raw = event.dataTransfer?.getData('application/json');
    if (!raw) return;

    try {
      const payload = JSON.parse(raw) as DiagramDropPayload;
      const position = this.clientToCanvasCoordinates(event.clientX, event.clientY);
      this.nodeDropped.emit({ payload, position });
    } catch (err) {
      console.error('Error parseando payload soltado en canvas Konva:', err);
    }
  }
}
