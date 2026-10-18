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
import { isSequenceRelationshipType, findNextAvailableSlot } from './nodes/uml-lifeline-node/uml-lifeline.logic';

import {
  createClassKonvaNode,
  createActorKonvaNode,
  createUseCaseKonvaNode,
  createBoundaryKonvaNode,
  createControlKonvaNode,
  createEntityKonvaNode,
  createLifelineKonvaNode,
  createDeploymentKonvaNode,
  createComponentKonvaNode,
  createPackageKonvaNode,
  createPackageLayerKonvaNode,
  createActivityKonvaNode,
  createNoteKonvaNode,
} from './konva/nodes';
import { toKonvaNode } from './konva/konva-adapter.util';
import { UmlNode } from './konva/models/uml.model';

import {
  CanvasStageManagerService,
  CanvasViewportManagerService,
  CanvasRelationshipManagerService,
  CanvasNodeInteractionService,
  CanvasCollabExportService,
  DiagramCanvasViewState,
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
 * Renderiza el escenario gráfico de Konva.js gestionando la interacción de nodos,
 * conexiones reactivas a 60 FPS, paneo, zoom adaptativo, cursores remotos y selección.
 * Delega sus responsabilidades en 5 servicios especializados para mantener alta cohesión.
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

  // Servicios modulares especializados inyectados
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
  readonly zoomLevel = this.viewportManager.zoomLevel;
  readonly isDragOverCanvas = signal<boolean>(false);
  readonly hoveredNodeId = signal<string | null>(null);
  readonly renamingNodeId = signal<string | null>(null);
  readonly pendingSourceNodeId = signal<string | null>(null);

  // Referencias a instancias de Konva
  private stage: Konva.Stage | null = null;
  private bgLayer: Konva.Layer | null = null;
  private frameLayer: Konva.Layer | null = null;
  private relLayer: Konva.Layer | null = null;
  private nodeLayer: Konva.Layer | null = null;
  private uiLayer: Konva.Layer | null = null;
  private transformer: Konva.Transformer | null = null;
  private gridGroup: Konva.Group | null = null;
  private bgRect: Konva.Rect | null = null;
  private previewLineGroup: Konva.Group | null = null;
  private guideLinesGroup: Konva.Group | null = null;
  private marqueeRect: Konva.Rect | null = null;

  private nodeGroupsMap = new Map<string, Konva.Group>();
  private readonly selectedNodeIdsInternal = signal<string[]>([]);
  private readonly selectedConnIdsInternal = signal<string[]>([]);

  private isDraggingNode = false;
  private isMarqueeSelecting = false;
  private marqueeStartPos = { x: 0, y: 0 };
  private lastRenderedSignature = '';
  private readonly lastLocalMoveTimestamps = new Map<string, number>();
  private onWindowMouseUpHandler?: () => void;

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
    // 1. Sincronizar estructura de nodos y conexiones (NUNCA destruir durante arrastre activo)
    effect(() => {
      const nodes = this.nodes();
      const conns = this.connections();
      const diagType = this.activeDiagramType();

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
          this.applyLiveGroupColor(group, rawNode);
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
      this.updateNodesSelectionAppearance();
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

    // 4. Sincronizar dimensiones y escala del stage cuando cambia el tablero o el zoom
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

    // 6. Sincronizar y restaurar vista y zoom cuando cambia el diagrama activo
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
    if (this.onWindowMouseUpHandler && typeof window !== 'undefined') {
      window.removeEventListener('mouseup', this.onWindowMouseUpHandler);
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
    this.transformer = null;
    this.marqueeRect = null;
    this.guideLinesGroup = null;
    this.previewLineGroup = null;
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
      this.previewLineGroup = this.relationshipManager.initPreviewGroup(this.uiLayer);
      const uiElements = this.nodeInteraction.initUiElements(this.uiLayer);
      this.transformer = uiElements.transformer;
      this.marqueeRect = uiElements.marqueeRect;
      this.guideLinesGroup = uiElements.guideLinesGroup;
    }

    this.renderFullDiagram(true);
    this.bindStageEvents();
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
   * Inicia el bucle de animación suave a 60 FPS con requestAnimationFrame para relaciones UML.
   */
  private startRelationshipAnimationLoop(): void {
    this.relationshipManager.startRelationshipAnimationLoop(() => {
      if (this.relLayer && !this.isDraggingNode) {
        this.renderRelationshipsOnly();
      }
    });
  }

  /**
   * Dispara la animación de entrada progresiva de todas las conexiones del diagrama.
   *
   * @param staggered Indica si se debe aplicar un retardo escalonado de 90ms entre conexiones.
   */
  private triggerAllRelationshipsDrawAnimation(staggered = true): void {
    this.relationshipManager.triggerAllRelationshipsDrawAnimation(this.connections(), staggered);
    this.startRelationshipAnimationLoop();
  }

  /**
   * Registra los eventos de puntero sobre el escenario de Konva (selección, barrido, clic de fondo).
   */
  private bindStageEvents(): void {
    if (!this.stage) return;

    this.stage.on('mousedown touchstart', (e) => {
      const isTargetStage = e.target === this.stage || e.target === this.bgRect;

      if (isTargetStage) {
        const pointer = this.stage?.getPointerPosition() || { x: 0, y: 0 };
        const transform = this.stage?.getAbsoluteTransform().copy().invert();
        const canvasPos = transform ? transform.point(pointer) : pointer;
        const canvasX = Math.round(canvasPos.x);
        const canvasY = Math.round(canvasPos.y);

        const nearConn = this.findClosestRelationshipAtCanvasPoint(canvasX, canvasY, 28);
        if (nearConn) {
          this.ngZone.run(() => {
            this.select([], [nearConn.id]);
            this.connectionClick.emit({ connId: nearConn.id, event: e.evt as MouseEvent });
          });
          return;
        }

        const mouseEvt = e.evt as MouseEvent;
        const isLeftClick = mouseEvt.button === 0 || mouseEvt.button === undefined;

        if (isLeftClick && !this.selectedRelationType() && !this.isReadOnly()) {
          this.isMarqueeSelecting = true;
          this.marqueeStartPos = { x: canvasX, y: canvasY };
          if (this.marqueeRect) {
            this.marqueeRect.position({ x: canvasX, y: canvasY });
            this.marqueeRect.size({ width: 0, height: 0 });
            this.marqueeRect.visible(false);
          }
          if (!mouseEvt.shiftKey && !mouseEvt.ctrlKey) {
            this.ngZone.run(() => {
              this.clearSelection();
            });
          }
        }

        this.ngZone.run(() => {
          this.pendingSourceNodeId.set(null);
          this.clearLivePreviewLine();
          if (!this.isMarqueeSelecting) {
            this.clearSelection();
          }
          this.canvasBackgroundClick.emit(e.evt as MouseEvent);
          this.canvasMouseDown.emit(e.evt as MouseEvent);
        });
      }
    });

    this.stage.on('dblclick dbltap', (e) => {
      const isTargetStage = e.target === this.stage || e.target === this.bgRect;
      if (isTargetStage) {
        const pointer = this.stage?.getPointerPosition() || { x: 0, y: 0 };
        const transform = this.stage?.getAbsoluteTransform().copy().invert();
        const canvasPos = transform ? transform.point(pointer) : pointer;
        const canvasX = Math.round(canvasPos.x);
        const canvasY = Math.round(canvasPos.y);

        const nearConn = this.findClosestRelationshipAtCanvasPoint(canvasX, canvasY, 28);
        if (nearConn) {
          this.ngZone.run(() => {
            this.connectionDblClick.emit({ conn: nearConn, event: e.evt as MouseEvent });
          });
        }
      }
    });

    this.stage.on('contextmenu', (e) => {
      e.evt.preventDefault();
      const isTargetStage = e.target === this.stage || e.target === this.bgRect;
      if (isTargetStage) {
        const pointer = this.stage?.getPointerPosition() || { x: 0, y: 0 };
        const transform = this.stage?.getAbsoluteTransform().copy().invert();
        const canvasPos = transform ? transform.point(pointer) : pointer;
        const canvasX = Math.round(canvasPos.x);
        const canvasY = Math.round(canvasPos.y);

        const nearConn = this.findClosestRelationshipAtCanvasPoint(canvasX, canvasY, 28);
        if (nearConn) {
          this.ngZone.run(() => {
            this.select([], [nearConn.id]);
            this.connectionContextMenu.emit({ conn: nearConn, event: e.evt as MouseEvent });
          });
          return;
        }

        this.ngZone.run(() => {
          this.canvasContextMenu.emit({
            event: e.evt as MouseEvent,
            canvasPos: { x: Math.round(canvasPos.x), y: Math.round(canvasPos.y) },
          });
        });
      }
    });

    this.stage.on('mousemove touchmove', (e) => {
      if (!this.stage) return;

      const pointer = this.stage.getPointerPosition() || { x: 0, y: 0 };
      const transform = this.stage.getAbsoluteTransform().copy().invert();
      const canvasPos = transform ? transform.point(pointer) : pointer;
      const canvasX = Math.round(canvasPos.x);
      const canvasY = Math.round(canvasPos.y);

      // Selección por recuadro / barrido (Marquee Selection)
      if (this.isMarqueeSelecting && this.marqueeRect) {
        const x = Math.min(this.marqueeStartPos.x, canvasX);
        const y = Math.min(this.marqueeStartPos.y, canvasY);
        const w = Math.abs(canvasX - this.marqueeStartPos.x);
        const h = Math.abs(canvasY - this.marqueeStartPos.y);

        this.marqueeRect.position({ x, y });
        this.marqueeRect.size({ width: w, height: h });
        this.marqueeRect.visible(w > 3 || h > 3);

        const intersectingIds: string[] = [];
        for (const [id, group] of this.nodeGroupsMap.entries()) {
          const gx = group.x();
          const gy = group.y();
          const gw = group.width() || 180;
          const gh = group.height() || 100;

          if (gx < x + w && gx + gw > x && gy < y + h && gy + gh > y) {
            intersectingIds.push(id);
          }
        }

        this.ngZone.run(() => {
          this.select(intersectingIds, []);
          this.selectionChange.emit({ nodeIds: intersectingIds, connectionIds: [] });
        });
        this.uiLayer?.batchDraw();
      }

      // Previsualización de línea elástica en modo conexión
      const pendingSrcId = this.pendingSourceNodeId();
      if (pendingSrcId) {
        this.drawLiveConnectionPreview(pendingSrcId, canvasPos.x, canvasPos.y);
      } else if (!this.isDraggingNode && !this.isMarqueeSelecting) {
        // Detección de proximidad magnética de 28px al acercar el puntero a cualquier relación
        const isOverNode = e.target?.getLayer() === this.nodeLayer;
        if (!isOverNode && !this.selectedRelationType()) {
          const nearConn = this.findClosestRelationshipAtCanvasPoint(canvasX, canvasY, 28);
          this.setHoveredRelationship(nearConn?.id ?? null);
          if (this.stage.container()) {
            this.stage.container().style.cursor = nearConn ? 'pointer' : 'default';
          }
        } else {
          this.setHoveredRelationship(null);
          if (this.stage.container()) {
            this.stage.container().style.cursor = 'default';
          }
        }
      }

      this.canvasMouseMove.emit(e.evt as MouseEvent);
    });

    const finishMarquee = () => {
      if (this.isMarqueeSelecting) {
        this.isMarqueeSelecting = false;
        if (this.marqueeRect) {
          this.marqueeRect.visible(false);
          this.uiLayer?.batchDraw();
        }
      }
    };
    this.stage.on('mouseup touchend', finishMarquee);
    this.onWindowMouseUpHandler = finishMarquee;
    if (typeof window !== 'undefined') {
      window.addEventListener('mouseup', finishMarquee);
    }
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
   * Determina si un nodo actúa como contenedor estructural de fondo.
   *
   * @param node Nodo UML a evaluar.
   * @returns True si el nodo es un contenedor estructural.
   */
  private isContainerNode(node?: UmlClassNode | UmlNode | null): boolean {
    return this.nodeInteraction.isContainerNode(node);
  }

  /**
   * Obtiene el peso de ordenamiento de profundidad Z para un nodo.
   *
   * @param node Nodo UML a evaluar.
   * @returns Peso numérico en el eje Z.
   */
  private getNodeZWeight(node: UmlClassNode | UmlNode): number {
    return this.nodeInteraction.getNodeZWeight(node);
  }

  /**
   * Asegura que los contenedores de fondo y los componentes mantengan el orden Z correcto.
   */
  private enforceZOrdering(): void {
    this.nodeInteraction.enforceZOrdering(this.nodeLayer, this.frameLayer, this.nodeGroupsMap, this.nodes());
  }

  /**
   * Resuelve el nodo destino real considerando la contención geométrica interna.
   *
   * @param clickedNode Nodo sobre el cual se hizo clic.
   * @returns El nodo hijo contenido si el clic apuntaba a su interior, o clickedNode.
   */
  private resolveTargetNodeAtPointer(clickedNode: UmlClassNode): UmlClassNode {
    return this.nodeInteraction.resolveTargetNodeAtPointer(
      clickedNode,
      this.stage,
      this.nodes(),
      this.nodeGroupsMap
    );
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
   * Aplica dinámicamente el color personalizado a las figuras internas de un nodo Konva.
   *
   * @param group Grupo de Konva que representa visualmente al nodo.
   * @param rawNode Modelo de datos del nodo.
   */
  private applyLiveGroupColor(group: Konva.Group, rawNode: UmlClassNode): void {
    const color = rawNode.color;
    if (!color) return;

    const bgRect = group.findOne<Konva.Rect>('.bg-rect');
    if (bgRect && bgRect.fill() !== color) {
      bgRect.fill(color);
    }
    const ucEllipse = group.findOne<Konva.Ellipse>('.uc-ellipse');
    if (ucEllipse && ucEllipse.fill() !== color) {
      ucEllipse.fill(color);
    }
    const actorHead = group.findOne<Konva.Circle>('.actor-part');
    if (actorHead && actorHead.fill() !== color) {
      actorHead.fill(color);
    }
    const compBody = group.findOne<Konva.Rect>('.comp-part');
    if (compBody) {
      compBody.fill(color);
    }
    const pkgFolderParts = group.find<Konva.Rect>('.pkg-folder-part');
    pkgFolderParts.forEach((part) => {
      if (part.fill() !== color) part.fill(color);
    });
    const actParts = group.find<Konva.Shape>('.act-part');
    actParts.forEach((part) => {
      if (part instanceof Konva.Rect && part.cornerRadius() === 12) {
        part.fill(color);
      } else if (part instanceof Konva.Line && part.closed()) {
        part.fill(color);
      }
    });
    const lifelineBox = group.findOne<Konva.Rect>('.lifeline-part');
    if (lifelineBox && lifelineBox.fill() !== color) {
      lifelineBox.fill(color);
    }
    const deployBox = group.findOne<Konva.Rect>('.deploy-main');
    if (deployBox && deployBox.fill() !== color) {
      deployBox.fill(color);
    }
    const layerBg = group.findOne<Konva.Rect>('.layer-bg');
    if (layerBg && layerBg.fill() !== color) {
      layerBg.fill(color);
    }
    const notePart = group.findOne<Konva.Shape>('.note-part');
    if (notePart && (notePart as any).fill && (notePart as any).fill() !== color) {
      (notePart as any).fill(color);
    }
  }

  /**
   * Actualiza el trazo visual de selección sobre los nodos en pantalla.
   */
  private updateNodesSelectionAppearance(): void {
    const selectedIds = new Set([...this.selectedNodeIds(), ...this.selectedNodeIdsInternal()]);
    const pendingSrcId = this.pendingSourceNodeId();

    for (const [id, group] of this.nodeGroupsMap.entries()) {
      const isSelected = selectedIds.has(id) || id === pendingSrcId;

      const bgRect = group.findOne<Konva.Rect>('.bg-rect');
      if (bgRect) {
        bgRect.stroke(isSelected ? '#059669' : '#78716C');
        bgRect.strokeWidth(isSelected ? 2 : 1.3);
      }

      const ellipse = group.findOne<Konva.Ellipse>('.uc-ellipse');
      if (ellipse) {
        ellipse.stroke(isSelected ? '#059669' : '#78716C');
        ellipse.strokeWidth(isSelected ? 2.2 : 1.6);
      }

      const hitRect = group.findOne<Konva.Rect>('.hit-rect');
      if (hitRect) {
        hitRect.stroke(isSelected ? '#10B981' : 'transparent');
        hitRect.strokeWidth(isSelected ? 1 : 0);
      }
    }
    this.frameLayer?.batchDraw();
    this.nodeLayer?.batchDraw();
  }

  /**
   * Reconstruye y renderiza todo el diagrama en las capas correspondientes de Konva.
   *
   * @param animateEntrance Indica si se debe ejecutar la animación progresiva de relaciones.
   */
  renderFullDiagram(animateEntrance = false): void {
    if (!this.nodeLayer || !this.frameLayer || !this.relLayer) return;

    this.frameLayer.destroyChildren();
    this.nodeLayer.destroyChildren();
    this.nodeGroupsMap.clear();

    const currentNodes = this.nodes().filter((n) => !n.isAnchor);
    currentNodes.sort((a, b) => this.getNodeZWeight(a) - this.getNodeZWeight(b));

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

      if (this.isContainerNode(rawNode)) {
        this.frameLayer.add(group);
      } else {
        this.nodeLayer.add(group);
      }
    }

    this.enforceZOrdering();
    if (animateEntrance) {
      this.triggerAllRelationshipsDrawAnimation(true);
    } else {
      this.renderRelationshipsOnly();
    }
    this.syncTransformer();
    this.lastRenderedSignature = this.computeStructureSignature();
    this.frameLayer.batchDraw();
    this.nodeLayer.batchDraw();
    this.uiLayer?.batchDraw();
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
        onConnectionClick: (connId, event) => {
          this.connectionClick.emit({ connId, event });
        },
        onConnectionDblClick: (conn, event) => {
          this.connectionDblClick.emit({ conn, event });
        },
        onConnectionContextMenu: (conn, event) => {
          this.connectionContextMenu.emit({ conn, event });
        },
        onSequenceMessageMove: (connectionId, targetSlot) => {
          this.sequenceMessageMove.emit({ connectionId, targetSlot });
        },
      },
    });
  }

  /**
   * Detecta la conexión más cercana a un punto específico del lienzo dentro del umbral magnético de 28px.
   *
   * @param canvasX Coordenada X dentro del lienzo.
   * @param canvasY Coordenada Y dentro del lienzo.
   * @param maxDistancePx Distancia máxima de captura en píxeles.
   * @returns La conexión más próxima al punto o null.
   */
  private findClosestRelationshipAtCanvasPoint(
    canvasX: number,
    canvasY: number,
    maxDistancePx = 28
  ): UmlConnection | null {
    return this.relationshipManager.findClosestRelationshipAtCanvasPoint({
      canvasX,
      canvasY,
      nodes: this.nodes(),
      connections: this.connections(),
      nodeGroupsMap: this.nodeGroupsMap,
      activeDiagramType: this.activeDiagramType(),
      sequenceActivationService: this.sequenceActivationService,
      maxDistancePx,
    });
  }

  /**
   * Actualiza el efecto visual de iluminación halo sobre la relación bajo el puntero.
   *
   * @param relId ID de la relación o null.
   */
  private setHoveredRelationship(relId: string | null): void {
    const selectedConnIds = new Set([...this.selectedConnIds(), ...this.selectedConnIdsInternal()]);
    this.relationshipManager.setHoveredRelationship(relId, selectedConnIds, this.relLayer);
  }

  /**
   * Instancia el grupo Konva correspondiente al tipo de nodo UML.
   *
   * @param node Modelo Konva del nodo.
   * @param isSelected Indica si el nodo se encuentra seleccionado.
   * @returns Grupo Konva.Group construido.
   */
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
      case 'component':
        return createComponentKonvaNode(node, isSelected);
      case 'package':
        return createPackageKonvaNode(node, isSelected);
      case 'package_layer':
        return createPackageLayerKonvaNode(node, isSelected);
      case 'note':
        return createNoteKonvaNode(node, isSelected);
      case 'activity_initial':
      case 'activity_final':
      case 'activity_action':
      case 'activity_decision':
      case 'activity_fork':
        return createActivityKonvaNode(node, isSelected);
      default:
        return createClassKonvaNode(node, isSelected);
    }
  }

  /**
   * Asocia controladores de interacción a un nodo (arrastre individual, selección múltiple, contención, redimensión).
   *
   * @param group Grupo Konva del nodo.
   * @param origNode Modelo original del nodo.
   */
  private attachNodeInteractions(group: Konva.Group, origNode: UmlClassNode): void {
    const isLocked = this.isNodeLockedByOther(origNode.id);
    const canDrag = !this.isReadOnly() && !isLocked && this.selectedRelationType() === null;
    group.draggable(canDrag);

    group.on('mouseenter', (e) => {
      this.hoveredNodeId.set(origNode.id);
      if (!this.isReadOnly() && !this.isNodeLockedByOther(origNode.id)) {
        this.stage?.container().style.setProperty('cursor', this.selectedRelationType() ? 'crosshair' : 'move');
      }

      const mouseEvt = e.evt as MouseEvent;
      if (mouseEvt && mouseEvt.buttons === 1 && !this.selectedRelationType() && !this.isDraggingNode) {
        if (!this.isContainerNode(origNode) && !this.selectedNodeIdsInternal().includes(origNode.id)) {
          const updated = [...this.selectedNodeIdsInternal(), origNode.id];
          this.ngZone.run(() => {
            this.select(updated, []);
            this.selectionChange.emit({ nodeIds: updated, connectionIds: [] });
          });
        }
      }
    });

    group.on('mouseleave', () => {
      if (this.hoveredNodeId() === origNode.id) {
        this.hoveredNodeId.set(null);
      }
      this.stage?.container().style.setProperty('cursor', 'default');
    });

    group.on('mousedown touchstart', (e) => {
      e.cancelBubble = true;

      if (this.isContainerNode(origNode) && !this.selectedRelationType()) {
        const mouseEvt = e.evt as MouseEvent;
        if (mouseEvt && (mouseEvt.button === 0 || mouseEvt.button === undefined)) {
          const pointer = this.stage?.getPointerPosition();
          if (pointer) {
            const transform = this.stage?.getAbsoluteTransform().copy().invert();
            const canvasPos = transform ? transform.point(pointer) : pointer;
            const nearConn = this.findClosestRelationshipAtCanvasPoint(Math.round(canvasPos.x), Math.round(canvasPos.y), 28);
            if (nearConn) {
              this.ngZone.run(() => {
                this.select([], [nearConn.id]);
                this.connectionClick.emit({ connId: nearConn.id, event: mouseEvt });
              });
              return;
            }
          }
        }
      }

      const activeRelType = this.selectedRelationType();
      if (activeRelType) {
        const targetNode = this.resolveTargetNodeAtPointer(origNode);
        this.ngZone.run(() => {
          const pendingSrc = this.pendingSourceNodeId();
          if (!pendingSrc) {
            this.pendingSourceNodeId.set(targetNode.id);
          } else if (pendingSrc !== targetNode.id) {
            const isSeq =
              this.activeDiagramType() === DiagramType.SEQUENCE ||
              isSequenceRelationshipType(activeRelType);
            if (isSeq) {
              const nextSlot = findNextAvailableSlot(this.connections());
              this.connectionCreated.emit({
                fOutputId: `${pendingSrc}_slot_${nextSlot}`,
                fInputId: `${targetNode.id}_slot_${nextSlot}`,
              });
            } else {
              this.connectionCreated.emit({
                fOutputId: pendingSrc,
                fInputId: targetNode.id,
              });
            }
            this.pendingSourceNodeId.set(null);
            this.clearLivePreviewLine();
          }
        });
        return;
      }

      const mouseEvt = e.evt as MouseEvent;
      if (mouseEvt && (mouseEvt.button === 0 || mouseEvt.button === undefined)) {
        const isAlreadySelected = this.selectedNodeIdsInternal().includes(origNode.id);
        this.ngZone.run(() => {
          if (!isAlreadySelected) {
            if (mouseEvt.shiftKey || mouseEvt.ctrlKey) {
              const updated = [...this.selectedNodeIdsInternal(), origNode.id];
              this.select(updated, []);
              this.selectionChange.emit({ nodeIds: updated, connectionIds: [] });
            } else {
              this.select([origNode.id], []);
              this.selectionChange.emit({ nodeIds: [origNode.id], connectionIds: [] });
              this.nodeClick.emit({ nodeId: origNode.id, event: mouseEvt });
            }
          } else {
            if (mouseEvt.shiftKey || mouseEvt.ctrlKey) {
              const updated = this.selectedNodeIdsInternal().filter((id) => id !== origNode.id);
              this.select(updated, []);
              this.selectionChange.emit({ nodeIds: updated, connectionIds: [] });
            }
          }
        });
      }
    });

    group.on('click tap', (e) => {
      if (this.selectedRelationType()) return;
      e.cancelBubble = true;

      if (this.isDraggingNode) return;

      const mouseEvt = e.evt as MouseEvent;
      if (mouseEvt && !mouseEvt.shiftKey && !mouseEvt.ctrlKey && this.selectedNodeIdsInternal().length > 1) {
        this.ngZone.run(() => {
          this.select([origNode.id], []);
          this.selectionChange.emit({ nodeIds: [origNode.id], connectionIds: [] });
          this.nodeClick.emit({ nodeId: origNode.id, event: mouseEvt });
        });
      } else {
        this.ngZone.run(() => {
          this.nodeClick.emit({ nodeId: origNode.id, event: mouseEvt });
        });
      }
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

    let dragStartPos = { x: Math.round(group.x()), y: Math.round(group.y()) };
    const siblingStartPositions = new Map<string, { x: number; y: number }>();

    group.on('dragstart', () => {
      this.isDraggingNode = true;
      this.lastLocalMoveTimestamps.set(origNode.id, Date.now());

      if (this.isContainerNode(origNode)) {
        group.moveToBottom();
      } else {
        group.moveToTop();
      }
      this.enforceZOrdering();

      dragStartPos = { x: Math.round(group.x()), y: Math.round(group.y()) };
      siblingStartPositions.clear();

      if (!this.selectedNodeIdsInternal().includes(origNode.id)) {
        this.select([origNode.id], []);
        this.selectionChange.emit({ nodeIds: [origNode.id], connectionIds: [] });
      }

      if (this.transformer) {
        this.transformer.nodes([]);
        this.uiLayer?.batchDraw();
      }

      for (const id of this.selectedNodeIdsInternal()) {
        const otherG = this.nodeGroupsMap.get(id);
        if (otherG) {
          siblingStartPositions.set(id, { x: Math.round(otherG.x()), y: Math.round(otherG.y()) });
        }
      }

      const currentNodes = this.nodes().map((n) => {
        const g = this.nodeGroupsMap.get(n.id);
        return {
          ...n,
          position: g ? { x: Math.round(g.x()), y: Math.round(g.y()) } : { ...n.position },
        };
      });

      const getW = (n: UmlClassNode) => this.nodeGroupsMap.get(n.id)?.width() || getNodeWidth(n);
      const getH = (n: UmlClassNode) => this.nodeGroupsMap.get(n.id)?.height() || getNodeHeight(n);

      const rootsToTrace = this.selectedNodeIdsInternal().length > 0 ? this.selectedNodeIdsInternal() : [origNode.id];
      const descendants = this.containmentService.collectDescendantsForRoots(
        rootsToTrace,
        currentNodes,
        getW,
        getH
      );

      for (const descId of descendants) {
        if (!siblingStartPositions.has(descId)) {
          const descG = this.nodeGroupsMap.get(descId);
          if (descG) {
            siblingStartPositions.set(descId, { x: Math.round(descG.x()), y: Math.round(descG.y()) });
          }
        }
      }
    });

    group.on('dragmove', () => {
      this.isDraggingNode = true;
      this.lastLocalMoveTimestamps.set(origNode.id, Date.now());

      if (this.activeDiagramType() === DiagramType.SEQUENCE || origNode.nodeType === 'lifeline') {
        group.y(origNode.position ? origNode.position.y : 30);
      }

      let rawX = Math.max(10, Math.round(group.x()));
      let rawY = Math.max(10, Math.round(group.y()));

      if (this.smartGuidesEnabled()) {
        const ignoredIds = new Set<string>();
        ignoredIds.add(origNode.id);
        if (siblingStartPositions.size > 0) {
          for (const sId of siblingStartPositions.keys()) {
            ignoredIds.add(sId);
          }
        }
        const snapped = this.calculateAndDrawSmartGuides(
          origNode.id,
          rawX,
          rawY,
          group.width() || getNodeWidth(origNode),
          group.height() || getNodeHeight(origNode) || 100,
          ignoredIds
        );
        rawX = snapped.x;
        rawY = snapped.y;
      } else {
        this.clearSmartGuides();
      }

      const curX = rawX;
      const curY = rawY;
      group.x(curX);
      group.y(curY);
      const dx = curX - dragStartPos.x;
      const dy = curY - dragStartPos.y;

      const currentNode = this.nodes().find((n) => n.id === origNode.id) || origNode;
      currentNode.position = { x: curX, y: curY };
      origNode.position = { x: curX, y: curY };

      if (siblingStartPositions.size > 1 && siblingStartPositions.has(origNode.id)) {
        for (const [id, start] of siblingStartPositions.entries()) {
          if (id !== origNode.id) {
            const otherG = this.nodeGroupsMap.get(id);
            const otherNode = this.nodes().find((n) => n.id === id);
            if (otherG && otherNode) {
              const targetX = Math.max(10, Math.round(start.x + dx));
              const targetY =
                this.activeDiagramType() === DiagramType.SEQUENCE || otherNode.nodeType === 'lifeline'
                  ? (otherNode.position ? otherNode.position.y : 30)
                  : Math.max(10, Math.round(start.y + dy));
              otherG.position({ x: targetX, y: targetY });
              otherNode.position = { x: targetX, y: targetY };
              this.lastLocalMoveTimestamps.set(id, Date.now());
            }
          }
        }
        this.frameLayer?.batchDraw();
        this.nodeLayer?.batchDraw();
      }

      if (siblingStartPositions.size <= 1) {
        this.nodePositionChange.emit({ node: currentNode, newPosition: { x: curX, y: curY } });
      }
      this.renderRelationshipsOnly();
    });

    group.on('dragend', () => {
      this.clearSmartGuides();
      this.lastLocalMoveTimestamps.set(origNode.id, Date.now());

      if (this.activeDiagramType() === DiagramType.SEQUENCE || origNode.nodeType === 'lifeline') {
        group.y(origNode.position ? origNode.position.y : 30);
      }
      const finalX = Math.max(10, Math.round(group.x()));
      const finalY = Math.max(10, Math.round(group.y()));
      group.x(finalX);
      group.y(finalY);
      const newPosition = { x: finalX, y: finalY };

      const currentNode = this.nodes().find((n) => n.id === origNode.id) || origNode;
      currentNode.position = newPosition;
      origNode.position = newPosition;

      if (siblingStartPositions.size > 1 && siblingStartPositions.has(origNode.id)) {
        const movedPayload: Array<{ id: string; position: { x: number; y: number } }> = [];
        for (const [id] of siblingStartPositions.entries()) {
          const otherG = this.nodeGroupsMap.get(id);
          const otherNode = this.nodes().find((n) => n.id === id) || (id === origNode.id ? origNode : null);
          if (otherG && otherNode) {
            const targetPos = {
              x: Math.max(10, Math.round(otherG.x())),
              y: Math.max(10, Math.round(otherG.y())),
            };
            otherG.position(targetPos);
            otherNode.position = targetPos;
            this.lastLocalMoveTimestamps.set(id, Date.now());
            movedPayload.push({ id, position: targetPos });
          }
        }

        this.ngZone.run(() => {
          this.moveNodes.emit({ nodes: movedPayload });
          this.syncTransformer();
          this.enforceZOrdering();
          setTimeout(() => {
            this.isDraggingNode = false;
          }, 50);
        });
      } else {
        this.ngZone.run(() => {
          this.nodePositionChange.emit({ node: currentNode, newPosition });
          this.syncTransformer();
          this.enforceZOrdering();
          setTimeout(() => {
            this.isDraggingNode = false;
          }, 50);
        });
      }
      this.frameLayer?.batchDraw();
      this.nodeLayer?.batchDraw();
      this.renderRelationshipsOnly();
    });

    group.on('transformstart', () => {
      this.isDraggingNode = true;
      this.lastLocalMoveTimestamps.set(origNode.id, Date.now());
    });

    group.on('transform', () => {
      this.lastLocalMoveTimestamps.set(origNode.id, Date.now());
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

      const actualW = Math.round(group.width());
      const actualH = Math.round(group.height());

      const currentNode = this.nodes().find((n) => n.id === origNode.id) || origNode;
      currentNode.width = actualW;
      currentNode.height = actualH;
      currentNode.customWidth = actualW;
      currentNode.customHeight = actualH;
      currentNode.isCustomSize = true;
      currentNode.position = { x: Math.round(group.x()), y: Math.round(group.y()) };

      origNode.width = actualW;
      origNode.height = actualH;
      origNode.customWidth = actualW;
      origNode.customHeight = actualH;
      origNode.isCustomSize = true;
      origNode.position = { x: Math.round(group.x()), y: Math.round(group.y()) };

      this.nodeLayer?.batchDraw();
      this.frameLayer?.batchDraw();
      this.renderRelationshipsOnly();
    });

    group.on('transformend', () => {
      this.lastLocalMoveTimestamps.set(origNode.id, Date.now());
      const width = Math.round(group.width());
      const height = Math.round(group.height());
      const position = { x: Math.round(group.x()), y: Math.round(group.y()) };

      const currentNode = this.nodes().find((n) => n.id === origNode.id) || origNode;
      currentNode.width = width;
      currentNode.height = height;
      currentNode.customWidth = width;
      currentNode.customHeight = height;
      currentNode.isCustomSize = true;
      currentNode.position = position;

      origNode.width = width;
      origNode.height = height;
      origNode.customWidth = width;
      origNode.customHeight = height;
      origNode.isCustomSize = true;
      origNode.position = position;

      this.ngZone.run(() => {
        this.nodeSizeChange.emit({ node: currentNode, width, height, position });
        this.syncTransformer();
        this.enforceZOrdering();
        setTimeout(() => {
          this.isDraggingNode = false;
        }, 50);
      });
    });
  }

  /**
   * Redimensiona fluidamente los elementos internos de un nodo según su tipo UML.
   *
   * @param group Grupo Konva del nodo.
   * @param node Modelo Konva del nodo.
   * @param newW Nuevo ancho en píxeles.
   * @param newH Nuevo alto en píxeles.
   */
  private applyFluidNodeResize(
    group: Konva.Group,
    node: UmlNode,
    newW: number,
    newH: number
  ): void {
    this.nodeInteraction.applyFluidNodeResize(group, node, newW, newH);
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
    this.updateNodesSelectionAppearance();
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
    if (this.transformer) {
      this.transformer.nodes([]);
      this.uiLayer?.batchDraw();
    }
    this.updateNodesSelectionAppearance();
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
      transformer: this.transformer,
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
