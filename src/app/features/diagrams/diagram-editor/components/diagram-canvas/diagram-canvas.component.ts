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
  ChangeDetectionStrategy,
  inject,
  NgZone,
  effect,
  untracked,
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
import {
  getNodeWidth,
  getNodeHeight,
  computeBoardWidth,
  computeBoardHeight,
} from '../../utils/node-metrics.util';
import { DiagramSequenceActivationService } from '../../services/diagram-sequence-activation.service';
import { DiagramContainmentService } from '../../services/diagram-containment.service';

import {
  CanvasStageManagerService,
  CanvasViewportManagerService,
  CanvasRelationshipManagerService,
  CanvasNodeInteractionService,
  CanvasCollabExportService,
  DiagramCanvasViewState,
  NodeInteractionContext,
} from './services';

export type { DiagramCanvasViewState };
export type DiagramDropPayload = DropNodePayload;

export interface NodeResizeRect {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

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

/**
 * Componente principal del lienzo nodal UML (DiagramCanvasComponent).
 *
 * Actúa como orquestador desacoplado delegando todas sus áreas funcionales en 5 servicios especializados:
 * - `CanvasStageManagerService`: Escenario Konva, cuantización por bloques (Bucket Sizing 512px) y grid.
 * - `CanvasViewportManagerService`: Cámara, zoom adaptativo (15%-125%), scroll suave y punto focal.
 * - `CanvasRelationshipManagerService`: Conexiones, animación a 60 FPS, previsualización y proximidad magnética.
 * - `CanvasNodeInteractionService`: Manipulación de nodos, arrastre coordinado, guías inteligentes y transformer.
 * - `CanvasCollabExportService`: Bloqueos concurrentes, cursores y exportación vectorial nativa de alta resolución.
 */
@Component({
  selector: 'app-diagram-canvas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
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

  @ViewChild('boardElement', { static: false })
  boardElementRef?: ElementRef<HTMLDivElement>;

  @ViewChild('flowContainer', { static: false })
  flowContainerRef?: ElementRef<HTMLElement>;

  private readonly ngZone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translationService = inject(TranslationService);
  private readonly sequenceActivationService = inject(DiagramSequenceActivationService);
  private readonly containmentService = inject(DiagramContainmentService);

  // Servicios especializados desacoplados
  private readonly stageManager = inject(CanvasStageManagerService);
  private readonly viewportManager = inject(CanvasViewportManagerService);
  private readonly relationshipManager = inject(CanvasRelationshipManagerService);
  private readonly nodeInteraction = inject(CanvasNodeInteractionService);
  private readonly collabExport = inject(CanvasCollabExportService);

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
  readonly showGrid = input<boolean>(false);

  // Outputs hacia el editor principal
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

  // Señales reactivas internas
  readonly zoomLevel = this.viewportManager.zoomLevel;
  readonly isDragOverCanvas = signal<boolean>(false);
  readonly hoveredNodeId = signal<string | null>(null);
  readonly renamingNodeId = signal<string | null>(null);
  readonly pendingSourceNodeId = signal<string | null>(null);

  // Referencias a capas de Konva y mapas de elementos
  private stage: Konva.Stage | null = null;
  private bgLayer: Konva.Layer | null = null;
  private frameLayer: Konva.Layer | null = null;
  private relLayer: Konva.Layer | null = null;
  private nodeLayer: Konva.Layer | null = null;
  private uiLayer: Konva.Layer | null = null;
  private gridGroup: Konva.Group | null = null;
  private bgRect: Konva.Rect | null = null;
  private guideLinesGroup: Konva.Group | null = null;

  private readonly nodeGroupsMap = new Map<string, Konva.Group>();
  private readonly selectedNodeIdsInternal = signal<string[]>([]);
  private readonly selectedConnIdsInternal = signal<string[]>([]);
  private isDraggingNode = false;
  private lastRenderedSignature = '';
  private readonly lastLocalMoveTimestamps = new Map<string, number>();
  private stageEventsCleanup?: () => void;

  /** Computed: true cuando no hay nodos reales en el diagrama */
  readonly hasNoRealNodes = computed(() => !this.nodes().some((n) => !n.isAnchor));

  /** Computed: mensaje contextual del empty state */
  readonly canvasEmptyStateMessage = computed(() => {
    const type = this.activeDiagramType();
    const key = `editor.canvas.emptyState.${type}`;
    const msg = this.translationService.translate(key);
    return msg !== key ? msg : this.translationService.translate('editor.canvas.emptyState.class');
  });

  // Dimensiones dinámicas del tablero Enterprise Architect (mínimo 2200x1400)
  readonly boardWidth = computed(() => computeBoardWidth(this.nodes(), 2200));
  readonly boardHeight = computed(() => computeBoardHeight(this.nodes(), 1400));

  readonly scaledBoardWidth = computed(() => {
    const scale = Math.max(0.2, this.zoomLevel() / 100);
    return Math.round(this.boardWidth() * scale);
  });

  readonly scaledBoardHeight = computed(() => {
    const scale = Math.max(0.2, this.zoomLevel() / 100);
    return Math.round(this.boardHeight() * scale);
  });

  constructor() {
    // 1. Sincronizar estructura de nodos y conexiones
    effect(() => {
      const nodes = this.nodes();
      this.connections();
      this.activeDiagramType();

      if (!this.stage || !this.nodeLayer) return;
      if (this.isDraggingNode) return;

      const currentSig = this.computeStructureSignature();
      if (currentSig !== this.lastRenderedSignature) {
        this.lastRenderedSignature = currentSig;
        this.renderFullDiagram(false);
      } else {
        const now = Date.now();
        for (const rawNode of nodes) {
          const group = this.nodeGroupsMap.get(rawNode.id);
          if (!group) continue;

          const lastMove = this.lastLocalMoveTimestamps.get(rawNode.id) || 0;
          if (group.isDragging() || now - lastMove < 400) {
            rawNode.position = { x: Math.round(group.x()), y: Math.round(group.y()) };
            continue;
          }

          if (Math.round(group.x()) !== rawNode.position.x || Math.round(group.y()) !== rawNode.position.y) {
            group.position({ x: rawNode.position.x, y: rawNode.position.y });
          }
          this.nodeInteraction.applyLiveGroupColor(group, rawNode);
        }
        this.renderRelationshipsOnly();
        this.syncTransformer();
        this.frameLayer?.batchDraw();
        this.nodeLayer?.batchDraw();
        this.stage.batchDraw();
      }
    });

    // 2. Sincronizar selección visual
    effect(() => {
      this.selectedNodeIds();
      this.selectedConnIds();

      if (!this.stage || !this.nodeLayer) return;
      if (this.isDraggingNode) return;

      this.syncTransformer();
      this.renderRelationshipsOnly();
      const selectedIds = new Set([...this.selectedNodeIds(), ...this.selectedNodeIdsInternal()]);
      this.nodeInteraction.updateNodesSelectionAppearance({
        nodeGroupsMap: this.nodeGroupsMap,
        selectedNodeIds: selectedIds,
        pendingSourceNodeId: this.pendingSourceNodeId(),
        frameLayer: this.frameLayer,
        nodeLayer: this.nodeLayer,
      });
    });

    // 3. Sincronizar interactividad según tipo de relación activo
    effect(() => {
      const relType = this.selectedRelationType();
      if (!this.stage || !this.nodeLayer) return;

      const canDrag = !this.isReadOnly() && relType === null;
      for (const [id, group] of this.nodeGroupsMap.entries()) {
        const isLocked = this.isNodeLockedByOther(id);
        group.draggable(canDrag && !isLocked);
      }
    });

    // 4. Sincronizar dimensiones y escala del stage
    effect(() => {
      this.scaledBoardWidth();
      this.scaledBoardHeight();
      this.zoomLevel();
      untracked(() => {
        this.updateStageDimensions();
      });
    });

    // 5. Sincronizar visibilidad de la cuadrícula
    effect(() => {
      this.showGrid();
      untracked(() => {
        this.drawGrid();
      });
    });

    // 6. Sincronizar y restaurar vista cuando cambia el diagrama
    effect(() => {
      const dId = this.diagramId();
      if (!dId || !this.stage) return;
      untracked(() => {
        this.restoreViewportScroll(dId);
      });
    });

    // 7. Sincronizar estado de guías inteligentes
    effect(() => {
      if (!this.smartGuidesEnabled()) {
        this.clearSmartGuides();
      }
    });
  }

  /**
   * Ciclo de vida posterior a la inicialización de la vista. Inicializa el canvas de Konva
   * y restaura el estado previo del viewport.
   */
  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;

    setTimeout(() => {
      this.initKonvaStage();
      this.restoreViewportScroll(this.diagramId());
      this.flowLoaded.emit();
    }, 40);
  }

  /**
   * Ciclo de vida de destrucción. Limpia eventos globales, guías y recursos de memoria.
   */
  ngOnDestroy(): void {
    this.clearSmartGuides();
    if (this.stageEventsCleanup) {
      this.stageEventsCleanup();
      this.stageEventsCleanup = undefined;
    }
    this.relationshipManager.cancelAnimation();
    this.nodeInteraction.destroy();
    this.stageManager.destroy();
    this.stage = null;
    this.bgLayer = null;
    this.frameLayer = null;
    this.relLayer = null;
    this.nodeLayer = null;
    this.uiLayer = null;
    this.gridGroup = null;
    this.bgRect = null;
    this.guideLinesGroup = null;
  }

  /**
   * Inicializa el escenario Konva.Stage, registra las 5 capas y enlaza observadores de interacción.
   */
  private initKonvaStage(): void {
    const container = this.stageContainerRef?.nativeElement;
    const parentContainer = this.flowContainerRef?.nativeElement;
    if (!container) return;

    this.stage = this.stageManager.initStage(
      {
        container,
        parentContainer,
        initialZoom: this.zoomLevel(),
        boardWidth: this.boardWidth(),
        boardHeight: this.boardHeight(),
        scaledBoardWidth: this.scaledBoardWidth(),
        scaledBoardHeight: this.scaledBoardHeight(),
        showGrid: this.showGrid(),
        onResize: () => this.updateStageDimensions(),
      },
      this.ngZone
    );

    if (!this.stage) return;

    this.bgLayer = this.stageManager.getBgLayer();
    this.frameLayer = this.stageManager.getFrameLayer();
    this.relLayer = this.stageManager.getRelLayer();
    this.nodeLayer = this.stageManager.getNodeLayer();
    this.uiLayer = this.stageManager.getUiLayer();
    this.gridGroup = this.stageManager.getGridGroup();
    this.bgRect = this.stageManager.getBgRect();

    if (this.uiLayer) {
      this.relationshipManager.initPreviewGroup(this.uiLayer);
      const uiElements = this.nodeInteraction.initUiElements(this.uiLayer);
      this.guideLinesGroup = uiElements.guideLinesGroup;
    }

    this.renderFullDiagram(true);

    this.stageEventsCleanup = this.nodeInteraction.bindStageEvents({
      stage: this.stage,
      bgRect: this.bgRect,
      uiLayer: this.uiLayer,
      nodeLayer: this.nodeLayer,
      relLayer: this.relLayer,
      nodeGroupsMap: this.nodeGroupsMap,
      nodes: () => this.nodes(),
      connections: () => this.connections(),
      activeDiagramType: () => this.activeDiagramType(),
      selectedRelationType: () => this.selectedRelationType(),
      pendingSourceNodeId: () => this.pendingSourceNodeId(),
      setPendingSourceNodeId: (id) => this.pendingSourceNodeId.set(id),
      isReadOnly: () => this.isReadOnly(),
      isDraggingNode: () => this.isDraggingNode,
      selectedConnIds: () => [...this.selectedConnIds(), ...this.selectedConnIdsInternal()],
      sequenceActivationService: this.sequenceActivationService,
      relationshipManager: this.relationshipManager,
      ngZone: this.ngZone,
      callbacks: {
        onConnectionClick: (connId, event) => this.connectionClick.emit({ connId, event }),
        onConnectionDblClick: (conn, event) => this.connectionDblClick.emit({ conn, event }),
        onConnectionContextMenu: (conn, event) => this.connectionContextMenu.emit({ conn, event }),
        onCanvasBackgroundClick: (event) => this.canvasBackgroundClick.emit(event),
        onCanvasMouseDown: (event) => this.canvasMouseDown.emit(event),
        onCanvasMouseMove: (event) => this.canvasMouseMove.emit(event),
        onCanvasContextMenu: (payload) => this.canvasContextMenu.emit(payload),
        onSelectionChange: (payload) => this.selectionChange.emit(payload),
        onSelect: (nodeIds, connIds) => this.select(nodeIds, connIds),
        onClearSelection: () => this.clearSelection(),
        onLivePreview: (sourceId, x, y) => this.drawLiveConnectionPreview(sourceId, x, y),
        onClearLivePreview: () => this.clearLivePreviewLine(),
      },
    });
  }

  /**
   * Construye el contexto de interacción necesario para conectar eventos sobre los nodos.
   *
   * @returns Contexto NodeInteractionContext configurado.
   */
  private getNodeInteractionContext(): NodeInteractionContext {
    return {
      stage: this.stage,
      nodeLayer: this.nodeLayer,
      frameLayer: this.frameLayer,
      uiLayer: this.uiLayer,
      nodeGroupsMap: this.nodeGroupsMap,
      nodes: () => this.nodes(),
      connections: () => this.connections(),
      activeDiagramType: () => this.activeDiagramType(),
      selectedRelationType: () => this.selectedRelationType(),
      pendingSourceNodeId: () => this.pendingSourceNodeId(),
      setPendingSourceNodeId: (id) => this.pendingSourceNodeId.set(id),
      hoveredNodeId: () => this.hoveredNodeId(),
      setHoveredNodeId: (id) => this.hoveredNodeId.set(id),
      selectedNodeIdsInternal: () => this.selectedNodeIdsInternal(),
      select: (nodeIds, connIds) => this.select(nodeIds, connIds),
      isReadOnly: () => this.isReadOnly(),
      smartGuidesEnabled: () => this.smartGuidesEnabled(),
      isNodeLockedByOther: (nodeId) => this.isNodeLockedByOther(nodeId),
      containmentService: this.containmentService,
      relationshipManager: this.relationshipManager,
      sequenceActivationService: this.sequenceActivationService,
      ngZone: this.ngZone,
      lastLocalMoveTimestamps: this.lastLocalMoveTimestamps,
      callbacks: {
        onNodeClick: (nodeId, event) => this.nodeClick.emit({ nodeId, event }),
        onNodeDblClick: (node, event) => this.nodeDblClick.emit({ node, event }),
        onNodeContextMenu: (node, event) => this.nodeContextMenu.emit({ node, event }),
        onConnectionClick: (connId, event) => this.connectionClick.emit({ connId, event }),
        onConnectionCreated: (event) => this.connectionCreated.emit(event),
        onNodePositionChange: (event) => this.nodePositionChange.emit(event),
        onNodeSizeChange: (event) => this.nodeSizeChange.emit(event),
        onMoveNodes: (event) => this.moveNodes.emit(event),
        onSelectionChange: (event) => this.selectionChange.emit(event),
        onRenderRelationships: () => this.renderRelationshipsOnly(),
        onClearLivePreview: () => this.clearLivePreviewLine(),
        onDragStateChange: (isDragging) => {
          this.isDraggingNode = isDragging;
        },
      },
    };
  }

  /**
   * Actualiza las dimensiones físicas del canvas Konva aplicando cuantización (Bucket Sizing de 512px).
   */
  private updateStageDimensions(): void {
    if (!this.stage) return;
    this.stageManager.updateStageDimensions({
      container: this.stageContainerRef?.nativeElement,
      parentContainer: this.flowContainerRef?.nativeElement,
      zoomLevel: this.zoomLevel(),
      boardWidth: this.boardWidth(),
      boardHeight: this.boardHeight(),
      scaledBoardWidth: this.scaledBoardWidth(),
      scaledBoardHeight: this.scaledBoardHeight(),
      showGrid: this.showGrid(),
    });
  }

  /**
   * Dibuja o actualiza la cuadrícula de fondo en el lienzo.
   */
  private drawGrid(): void {
    this.stageManager.drawGrid(this.showGrid(), this.boardWidth(), this.boardHeight());
  }

  /**
   * Dibuja una línea de conexión temporal desde el nodo origen hacia el cursor.
   *
   * @param sourceId Identificador del nodo origen.
   * @param cursorX Posición horizontal X del cursor.
   * @param cursorY Posición vertical Y del cursor.
   */
  private drawLiveConnectionPreview(sourceId: string, cursorX: number, cursorY: number): void {
    this.relationshipManager.drawLiveConnectionPreview(
      sourceId,
      cursorX,
      cursorY,
      this.nodes(),
      this.activeDiagramType(),
      this.uiLayer
    );
  }

  /**
   * Elimina la línea interactiva de previsualización de conexión.
   */
  private clearLivePreviewLine(): void {
    this.relationshipManager.clearLivePreviewLine(this.uiLayer);
  }

  /**
   * Genera una firma estructural única del diagrama para detectar cambios en atributos o nombres.
   *
   * @returns Cadena de texto representativa de la estructura del diagrama.
   */
  private computeStructureSignature(): string {
    const nodeSig = this.nodes()
      .filter((n) => !n.isAnchor)
      .map((n) => {
        const attrs = (n.attributes || []).map((a) => `${a.name}:${a.type}:${a.visibility}`).join(',');
        const methods = (n.methods || []).map((m) => `${m.name}:${m.parameters}:${m.returnType}:${m.visibility}`).join(',');
        return `${n.id}:${n.name}:${n.stereotype || ''}:${n.nodeType}:${n.color || ''}:${attrs}:${methods}:${n.customWidth ?? 0}:${n.customHeight ?? 0}`;
      })
      .join('|');
    const connSig = this.connections()
      .map((c) => `${c.id}:${c.sourceId}:${c.targetId}:${c.type}:${c.name ?? ''}`)
      .join('|');
    return `${this.activeDiagramType()}#${nodeSig}#${connSig}`;
  }

  /**
   * Reconstruye y renderiza todo el diagrama en las capas correspondientes de Konva.
   *
   * @param animateEntrance Indica si se debe ejecutar la animación progresiva de relaciones.
   */
  renderFullDiagram(animateEntrance = false): void {
    if (!this.nodeLayer || !this.frameLayer || !this.relLayer) return;

    this.nodeInteraction.renderFullDiagram({
      frameLayer: this.frameLayer,
      nodeLayer: this.nodeLayer,
      uiLayer: this.uiLayer,
      nodeGroupsMap: this.nodeGroupsMap,
      nodes: this.nodes(),
      connections: this.connections(),
      selectedNodeIds: this.selectedNodeIds(),
      selectedNodeIdsInternal: this.selectedNodeIdsInternal(),
      pendingSourceNodeId: this.pendingSourceNodeId(),
      activeDiagramType: this.activeDiagramType(),
      sequenceActivationService: this.sequenceActivationService,
      isReadOnly: this.isReadOnly(),
      nodeInteractionContext: this.getNodeInteractionContext(),
    });

    if (animateEntrance) {
      this.relationshipManager.triggerAllRelationshipsDrawAnimation(this.connections(), true);
      this.relationshipManager.startRelationshipAnimationLoop(() => {
        if (this.relLayer && !this.isDraggingNode) {
          this.renderRelationshipsOnly();
        }
      });
    } else {
      this.renderRelationshipsOnly();
    }
    this.lastRenderedSignature = this.computeStructureSignature();
  }

  /**
   * Renderiza exclusivamente la capa de conexiones (relLayer).
   */
  private renderRelationshipsOnly(): void {
    const selectedConnIds = new Set([...this.selectedConnIds(), ...this.selectedConnIdsInternal()]);
    this.relationshipManager.renderRelationshipsOnly({
      relLayer: this.relLayer,
      stage: this.stage,
      nodes: this.nodes(),
      connections: this.connections(),
      nodeGroupsMap: this.nodeGroupsMap,
      selectedConnIds,
      activeDiagramType: this.activeDiagramType(),
      sequenceActivationService: this.sequenceActivationService,
      isReadOnly: this.isReadOnly(),
      ngZone: this.ngZone,
      events: {
        onConnectionClick: (connId, event) => this.connectionClick.emit({ connId, event }),
        onConnectionDblClick: (conn, event) => this.connectionDblClick.emit({ conn, event }),
        onConnectionContextMenu: (conn, event) => this.connectionContextMenu.emit({ conn, event }),
        onSequenceMessageMove: (connectionId, targetSlot) => this.sequenceMessageMove.emit({ connectionId, targetSlot }),
      },
    });
  }

  /**
   * Sincroniza la posición y nodos asignados al transformador de redimensión (Konva.Transformer).
   */
  private syncTransformer(): void {
    const selectedIds = Array.from(
      new Set([...this.selectedNodeIds(), ...this.selectedNodeIdsInternal()])
    );
    this.nodeInteraction.syncTransformer({
      selectedNodeIds: selectedIds,
      nodeGroupsMap: this.nodeGroupsMap,
      isReadOnly: this.isReadOnly(),
      uiLayer: this.uiLayer,
    });
  }

  /**
   * Fuerza el redibujado integral del lienzo y actualiza la detección de cambios.
   */
  redraw(): void {
    this.cdr.detectChanges();
    this.updateStageDimensions();
    if (this.stage && !this.isDraggingNode) {
      this.renderFullDiagram(false);
      this.stage.batchDraw();
    }
  }

  /**
   * Restablece la selección activa y regresa la vista a su estado inicial.
   */
  reset(): void {
    this.clearSelection();
    this.resetView();
  }

  /**
   * Restablece el zoom al 100% y centra la vista del tablero.
   */
  resetView(): void {
    this.viewportManager.resetView(
      this.flowContainerRef?.nativeElement,
      this.diagramId(),
      () => this.updateStageDimensions()
    );
    this.zoomChange.emit(this.zoomLevel());
  }

  /**
   * Encuadra automáticamente todos los nodos del diagrama dentro del área visible.
   */
  fitView(): void {
    this.viewportManager.fitView(
      this.flowContainerRef?.nativeElement,
      this.nodes(),
      this.diagramId(),
      () => this.updateStageDimensions()
    );
    this.zoomChange.emit(this.zoomLevel());
  }

  /**
   * Incrementa el zoom en pasos escalonados.
   */
  zoomIn(): void {
    const clamped = this.viewportManager.zoomIn(
      this.flowContainerRef?.nativeElement,
      this.diagramId(),
      () => this.updateStageDimensions()
    );
    this.zoomChange.emit(clamped);
  }

  /**
   * Reduce el zoom en pasos escalonados.
   */
  zoomOut(): void {
    const clamped = this.viewportManager.zoomOut(
      this.flowContainerRef?.nativeElement,
      this.diagramId(),
      () => this.updateStageDimensions()
    );
    this.zoomChange.emit(clamped);
  }

  /**
   * Ajusta el nivel de zoom a un valor específico con soporte de enfoque en el cursor.
   *
   * @param targetPct Porcentaje de zoom objetivo (15% a 125%).
   * @param autoAdjustScroll Indica si el desplazamiento debe ajustarse al punto focal.
   * @param focusPoint Coordenadas del cursor en pantalla para enfoque puntual.
   * @param persistToStorage Indica si el valor debe guardarse en sessionStorage.
   */
  setZoom(
    targetPct: number,
    autoAdjustScroll = true,
    focusPoint?: { clientX: number; clientY: number },
    persistToStorage = true,
  ): void {
    const clamped = this.viewportManager.setZoom({
      targetPct,
      container: this.flowContainerRef?.nativeElement,
      autoAdjustScroll,
      focusPoint,
      diagramId: this.diagramId(),
      persistToStorage,
      onDimensionsUpdate: () => this.updateStageDimensions(),
    });
    this.zoomChange.emit(clamped);
  }

  /**
   * Sincroniza la señal zoomLevel a partir de la escala actual de Konva.
   */
  syncZoomFromCanvas(): void {
    this.viewportManager.syncZoomFromCanvas(this.stage, (z: number) => this.zoomChange.emit(z));
  }

  /**
   * Restaura el estado de desplazamiento y zoom previamente almacenados para el diagrama.
   *
   * @param diagramId Identificador del diagrama a restaurar.
   */
  restoreViewportScroll(diagramId: string | null): void {
    this.viewportManager.restoreViewportScroll(
      diagramId,
      this.flowContainerRef?.nativeElement,
      () => this.updateStageDimensions()
    );
  }

  /**
   * Centra el desplazamiento del contenedor sobre el origen del tablero.
   */
  centerViewportOnBoard(): void {
    this.viewportManager.centerViewportOnBoard(this.flowContainerRef?.nativeElement);
  }

  /**
   * Notifica cambios en el scroll del viewport y persiste el estado en sessionStorage.
   *
   * @param event Evento DOM de scroll.
   */
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

  /**
   * Maneja el zoom interactivo con la rueda del ratón al presionar Ctrl/Meta con amortiguación RAF.
   *
   * @param event Evento WheelEvent de la rueda del ratón.
   */
  onContainerWheel(event: WheelEvent): void {
    this.viewportManager.handleWheelZoom(
      event,
      this.flowContainerRef?.nativeElement,
      this.diagramId(),
      () => this.updateStageDimensions(),
      (z: number) => this.zoomChange.emit(z)
    );
  }

  /**
   * Selecciona programáticamente un conjunto de nodos y conexiones en el lienzo.
   *
   * @param nodeIds Lista de IDs de nodos a seleccionar.
   * @param connIds Lista de IDs de conexiones a seleccionar.
   */
  select(nodeIds: string[], connIds: string[]): void {
    this.selectedNodeIdsInternal.set(nodeIds);
    this.selectedConnIdsInternal.set(connIds);
    this.syncTransformer();
    const selectedIds = new Set([...this.selectedNodeIds(), ...nodeIds]);
    this.nodeInteraction.updateNodesSelectionAppearance({
      nodeGroupsMap: this.nodeGroupsMap,
      selectedNodeIds: selectedIds,
      pendingSourceNodeId: this.pendingSourceNodeId(),
      frameLayer: this.frameLayer,
      nodeLayer: this.nodeLayer,
    });
    this.renderRelationshipsOnly();
  }

  /**
   * Deselecciona todos los elementos y limpia las guías y transformadores activos.
   */
  clearSelection(): void {
    this.clearSmartGuides();
    this.selectedNodeIdsInternal.set([]);
    this.selectedConnIdsInternal.set([]);
    this.pendingSourceNodeId.set(null);
    this.clearLivePreviewLine();
    this.nodeInteraction.syncTransformer({
      selectedNodeIds: [],
      nodeGroupsMap: this.nodeGroupsMap,
      isReadOnly: this.isReadOnly(),
      uiLayer: this.uiLayer,
    });
    this.nodeInteraction.updateNodesSelectionAppearance({
      nodeGroupsMap: this.nodeGroupsMap,
      selectedNodeIds: new Set(this.selectedNodeIds()),
      pendingSourceNodeId: null,
      frameLayer: this.frameLayer,
      nodeLayer: this.nodeLayer,
    });
    this.renderRelationshipsOnly();
  }

  /**
   * Inicia el modo de edición en línea del nombre de un nodo.
   *
   * @param nodeId Identificador del nodo a renombrar.
   */
  startRenameNode(nodeId: string): void {
    this.renamingNodeId.set(nodeId);
  }

  /**
   * Obtiene una instantánea del estado actual de zoom y scroll del viewport.
   *
   * @returns Estado actual del lienzo DiagramCanvasViewState.
   */
  getViewState(): DiagramCanvasViewState {
    return this.viewportManager.getViewState(this.flowContainerRef?.nativeElement);
  }

  /**
   * Aplica un estado de vista previamente capturado (zoom y scroll).
   *
   * @param state Estado de la vista a aplicar.
   */
  applyViewState(state: DiagramCanvasViewState): void {
    this.viewportManager.applyViewState(
      state,
      this.flowContainerRef?.nativeElement,
      () => this.updateStageDimensions()
    );
  }

  /**
   * Obtiene la referencia al elemento contenedor exportable.
   *
   * @returns Elemento HTML que contiene el tablero exportable.
   */
  getExportElement(): HTMLElement | undefined {
    return this.boardElementRef?.nativeElement || this.stageContainerRef?.nativeElement;
  }

  /**
   * Exporta el contenido vectorial del lienzo Konva a un HTMLCanvasElement optimizado,
   * calculando el bounding box envolvente y renderizando en alta resolución.
   *
   * @param pixelRatio Ratio de resolución de píxeles (2 por defecto para nitidez Retina).
   * @param padding Margen perimetral de seguridad en píxeles.
   * @returns Elemento HTMLCanvasElement renderizado o null si el diagrama está vacío.
   */
  exportContentCanvas(pixelRatio = 2, padding = 40): HTMLCanvasElement | null {
    return this.collabExport.exportContentCanvas({
      stage: this.stage,
      nodes: this.nodes(),
      nodeGroupsMap: this.nodeGroupsMap,
      relLayer: this.relLayer,
      uiLayer: this.uiLayer,
      gridGroup: this.gridGroup,
      bgRect: this.bgRect,
      transformer: (this.nodeInteraction as any).transformer,
      pixelRatio,
      padding,
    });
  }

  /**
   * Objeto de compatibilidad que expone la API de transformación de coordenadas del lienzo.
   *
   * @returns Objeto simulador con escala, reseteo y redibujado.
   */
  get canvas(): any {
    const self = this;
    return {
      get transform() {
        return {
          get scale() {
            return self.zoomLevel() ? self.zoomLevel() / 100 : (self.stage ? self.stage.scaleX() : 1);
          },
          set scale(s: number) {
            self.setZoom(Math.round(s * 100), false);
          },
          get position() {
            return { x: 0, y: 0 };
          },
          set position(_pos: { x: number; y: number }) {
            // Stage position is locked to (0, 0)
          },
          scaledPosition: { x: 0, y: 0 },
        };
      },
      resetScale: () => this.resetView(),
      setScale: (scale: number) => {
        this.setZoom(Math.round(scale * 100), false);
      },
      redraw: () => this.redraw(),
    };
  }

  /**
   * Limpia las líneas magnéticas de la capa UI y solicita actualización visual.
   */
  clearSmartGuides(): void {
    if (this.nodeInteraction) {
      this.nodeInteraction.clearSmartGuides(this.uiLayer, this.guideLinesGroup);
      return;
    }
    if (this.guideLinesGroup && this.guideLinesGroup.children.length > 0) {
      this.guideLinesGroup.destroyChildren();
      this.uiLayer?.batchDraw();
    }
  }

  /**
   * Calcula el ajuste magnético con nodos cercanos (umbral 8px) y dibuja las líneas guía visuales.
   *
   * @param draggedId Identificador del nodo en movimiento.
   * @param currentX Posición X actual antes de ajustar.
   * @param currentY Posición Y actual antes de ajustar.
   * @param width Ancho del nodo en movimiento.
   * @param height Alto del nodo en movimiento.
   * @param ignoredIds Conjunto de IDs de nodos a ignorar durante el cálculo.
   * @returns Coordenadas { x, y } resultantes con el ajuste magnético aplicado si corresponde.
   */
  private calculateAndDrawSmartGuides(
    draggedId: string,
    currentX: number,
    currentY: number,
    width: number,
    height: number,
    ignoredIds: Set<string>
  ): { x: number; y: number } {
    const service = this.nodeInteraction || new CanvasNodeInteractionService();
    return service.calculateAndDrawSmartGuides({
      draggedId,
      currentX,
      currentY,
      width,
      height,
      ignoredIds,
      nodes: this.nodes(),
      nodeGroupsMap: this.nodeGroupsMap,
      activeDiagramType: this.activeDiagramType(),
      uiLayer: this.uiLayer,
      guideLinesGroup: this.guideLinesGroup,
    });
  }

  /**
   * Obtiene el ancho nominal de un nodo según sus características y métricas de texto.
   *
   * @param node Modelo de datos del nodo.
   * @returns Ancho calculado en píxeles.
   */
  getNodeWidth(node: UmlClassNode): number {
    return getNodeWidth(node);
  }

  /**
   * Obtiene el alto nominal de un nodo según sus características y métricas de texto.
   *
   * @param node Modelo de datos del nodo.
   * @returns Alto calculado en píxeles o null si es dinámico.
   */
  getNodeHeight(node: UmlClassNode): number | null {
    return getNodeHeight(node);
  }

  /**
   * Convierte coordenadas de pantalla del cliente (ClientX, ClientY) a coordenadas del lienzo Konva.
   *
   * @param clientX Coordenada horizontal del cursor en pantalla.
   * @param clientY Coordenada vertical del cursor en pantalla.
   * @returns Coordenadas { x, y } mapeadas al espacio virtual del lienzo.
   */
  clientToCanvasCoordinates(clientX: number, clientY: number): { x: number; y: number } {
    return this.viewportManager.clientToCanvasCoordinates(
      clientX,
      clientY,
      this.stageContainerRef?.nativeElement
    );
  }

  /**
   * Calcula la posición horizontal en pantalla de un cursor remoto colaborativo.
   *
   * @param canvasX Coordenada horizontal del cursor en el lienzo.
   * @returns Posición en píxeles escalada según el nivel de zoom activo.
   */
  getCursorScreenX(canvasX: number): number {
    return this.viewportManager.getCursorScreenX(canvasX);
  }

  /**
   * Calcula la posición vertical en pantalla de un cursor remoto colaborativo.
   *
   * @param canvasY Coordenada vertical del cursor en el lienzo.
   * @returns Posición en píxeles escalada según el nivel de zoom activo.
   */
  getCursorScreenY(canvasY: number): number {
    return this.viewportManager.getCursorScreenY(canvasY);
  }

  /**
   * Obtiene la información de bloqueo concurrencial de un nodo.
   *
   * @param nodeId Identificador del nodo a consultar.
   * @returns Datos del bloqueo NodeLock o null si el nodo está libre.
   */
  getNodeLock(nodeId: string): NodeLock | null {
    return this.collabExport.getNodeLock(nodeId, this.nodeLocks());
  }

  /**
   * Determina si un nodo se encuentra bloqueado por otro usuario concurrente.
   *
   * @param nodeId Identificador del nodo a consultar.
   * @returns True si el nodo está bloqueado por un usuario distinto al local.
   */
  isNodeLockedByOther(nodeId: string): boolean {
    return this.collabExport.isNodeLockedByOther(nodeId, this.nodeLocks(), this.currentUserId());
  }

  /**
   * Emite el evento de mousedown sobre el contenedor del lienzo.
   *
   * @param event Evento MouseEvent capturado.
   */
  onCanvasMouseDown(event: MouseEvent): void {
    this.canvasMouseDown.emit(event);
  }

  /**
   * Emite el evento de mousemove sobre el contenedor del lienzo.
   *
   * @param event Evento MouseEvent capturado.
   */
  onCanvasMouseMove(event: MouseEvent): void {
    this.canvasMouseMove.emit(event);
  }

  /**
   * Emite el evento de clic sobre el fondo del lienzo.
   *
   * @param event Evento MouseEvent capturado opcional.
   */
  onCanvasBackgroundClick(event?: MouseEvent): void {
    this.canvasBackgroundClick.emit(event);
  }

  /**
   * Maneja el menú contextual sobre el lienzo y calcula las coordenadas del clic.
   *
   * @param event Evento MouseEvent del clic secundario.
   */
  onCanvasContextMenu(event: MouseEvent): void {
    event.preventDefault();
    const canvasPos = this.clientToCanvasCoordinates(event.clientX, event.clientY);
    this.canvasContextMenu.emit({ event, canvasPos });
  }

  /**
   * Maneja el evento de arrastre sobre el contenedor desde el Toolbox de componentes.
   *
   * @param event Evento DragEvent del navegador.
   */
  onCanvasDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    this.isDragOverCanvas.set(true);
  }

  /**
   * Maneja la salida del puntero durante una operación de arrastre.
   *
   * @param event Evento DragEvent del navegador.
   */
  onCanvasDragLeave(event: DragEvent): void {
    this.isDragOverCanvas.set(false);
  }

  /**
   * Maneja el soltado (drop) de un nuevo elemento desde el Toolbox y calcula su posición.
   *
   * @param event Evento DragEvent con los datos del elemento soltado.
   */
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
