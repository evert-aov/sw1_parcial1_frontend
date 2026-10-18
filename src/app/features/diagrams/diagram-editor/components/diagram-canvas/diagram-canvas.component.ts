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
  createComponentKonvaNode,
  resizeComponentKonvaNode,
  createPackageKonvaNode,
  resizePackageKonvaNode,
  createPackageLayerKonvaNode,
  resizePackageLayerKonvaNode,
  createActivityKonvaNode,
  resizeActivityKonvaNode,
  createNoteKonvaNode,
  resizeNoteKonvaNode,
  createUmlRelationshipKonvaGroup,
  getPointToRelationshipDistance,
} from './konva/nodes';
import { toKonvaNode, toKonvaRelationship } from './konva/konva-adapter.util';
import { UmlNode, UmlRelationship } from './konva/models/uml.model';

interface RelDrawAnimationState {
  startTime: number;
  duration: number;
  delay: number;
}

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
  readonly zoomLevel = signal<number>(100);
  readonly isDragOverCanvas = signal<boolean>(false);
  readonly hoveredNodeId = signal<string | null>(null);
  readonly renamingNodeId = signal<string | null>(null);
  readonly pendingSourceNodeId = signal<string | null>(null);

  // Konva Engine References
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

  private nodeGroupsMap = new Map<string, Konva.Group>();
  private readonly konvaRelGroupMap = new Map<string, Konva.Group>();
  private hoveredRelId: string | null = null;
  private relAnimStates = new Map<string, RelDrawAnimationState>();
  private relProgressMap = new Map<string, number>();
  private animFrameId: number | null = null;
  private lastFrameTime = 0;
  private flowPhase = 0;
  private resizeObserver?: ResizeObserver;
  private marqueeRect: Konva.Rect | null = null;
  private isMarqueeSelecting = false;
  private marqueeStartPos = { x: 0, y: 0 };
  private onWindowMouseUpHandler?: () => void;
  private pendingWheelZoom: { nextZoom: number; focusPoint: { clientX: number; clientY: number } } | null = null;
  private wheelAnimFrameId: number | null = null;

  // Selección interna
  private readonly selectedNodeIdsInternal = signal<string[]>([]);
  private readonly selectedConnIdsInternal = signal<string[]>([]);

  // Estado de interacción de arrastre
  private isDraggingNode = false;
  private lastRenderedSignature = '';
  private readonly lastLocalMoveTimestamps = new Map<string, number>();

  /** Computed: true cuando no hay nodos reales en el diagrama */
  readonly hasNoRealNodes = computed(() => !this.nodes().some((n) => !n.isAnchor));

  /** Computed: mensaje contextual del empty state */
  readonly canvasEmptyStateMessage = computed(() => {
    const type = this.activeDiagramType();
    const key = `editor.canvas.emptyState.${type}`;
    const msg = this.translationService.translate(key);
    return msg !== key ? msg : this.translationService.translate('editor.canvas.emptyState.class');
  });

  // Dimensiones dinámicas del tablero Enterprise Architect (mínimo 2200x1400 para garantizar scroll bidireccional fluido en pantallas 1080p y superiores)
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
        // Solo posiciones modificadas (por ejemplo por sincronización remota o historial)
        for (const rawNode of nodes) {
          const group = this.nodeGroupsMap.get(rawNode.id);
          if (!group) continue;

          // Si el nodo está en arrastre activo o terminó de moverse localmente hace menos de 400ms,
          // Konva es la fuente de verdad. No forzar posición vieja desde el estado padre.
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

    // 2. Sincronizar selección visual (NUNCA destruye nodos)
    effect(() => {
      const selectedIds = this.selectedNodeIds();
      const selectedConns = this.selectedConnIds();

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

    // 6. Sincronizar y restaurar vista y zoom cuando cambia el diagrama activo (tabs o explorador)
    effect(() => {
      const dId = this.diagramId();
      if (!dId || !this.stage) return;
      untracked(() => {
        this.restoreViewportScroll(dId);
      });
    });
  }

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

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;

    setTimeout(() => {
      this.initKonvaStage();
      this.restoreViewportScroll(this.diagramId());
      this.flowLoaded.emit();
    }, 40);
  }

  ngOnDestroy(): void {
    if (this.onWindowMouseUpHandler && typeof window !== 'undefined') {
      window.removeEventListener('mouseup', this.onWindowMouseUpHandler);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.wheelAnimFrameId !== null) {
      cancelAnimationFrame(this.wheelAnimFrameId);
      this.wheelAnimFrameId = null;
    }
    if (this.stage) {
      this.stage.destroy();
      this.stage = null;
    }
  }

  private initKonvaStage(): void {
    const container = this.stageContainerRef?.nativeElement;
    const parentContainer = this.flowContainerRef?.nativeElement;
    if (!container) return;

    const scale = Math.max(0.2, this.zoomLevel() / 100);
    const rawTargetW = Math.max(parentContainer?.clientWidth || 0, container.clientWidth || 0, this.scaledBoardWidth(), 2200);
    const rawTargetH = Math.max(parentContainer?.clientHeight || 0, container.clientHeight || 0, this.scaledBoardHeight(), 1400);

    // Cuantización de dimensiones del canvas a bloques de 512px (Bucket Sizing)
    const width = Math.ceil(rawTargetW / 512) * 512;
    const height = Math.ceil(rawTargetH / 512) * 512;

    // Limitar el pixel ratio a 1.5x max para evitar alocaciones masivas de memoria en pantallas HiDPI/Retina
    Konva.pixelRatio = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 1.5);
    Konva.dragDistance = 3;

    this.ngZone.runOutsideAngular(() => {
      this.stage = new Konva.Stage({
        container,
        width,
        height,
        draggable: false,
      });

      this.stage.scale({ x: scale, y: scale });
      this.stage.position({ x: 0, y: 0 });

      this.bgLayer = new Konva.Layer({ listening: true });
      this.frameLayer = new Konva.Layer({ listening: true });
      this.relLayer = new Konva.Layer();
      this.nodeLayer = new Konva.Layer();
      this.uiLayer = new Konva.Layer();

      const effectiveW = Math.max(this.boardWidth(), Math.ceil(width / 0.25));
      const effectiveH = Math.max(this.boardHeight(), Math.ceil(height / 0.25));

      this.bgRect = new Konva.Rect({
        x: 0,
        y: 0,
        width: effectiveW,
        height: effectiveH,
        fill: '#FAF9F5',
        listening: true,
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

      this.marqueeRect = new Konva.Rect({
        name: 'marquee-rect',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        visible: false,
        stroke: '#2563EB',
        strokeWidth: 1.5,
        dash: [4, 4],
        fill: 'rgba(37, 99, 235, 0.12)',
        listening: false,
      });
      this.uiLayer.add(this.marqueeRect);

      this.stage.add(this.bgLayer);
      this.stage.add(this.frameLayer);
      this.stage.add(this.relLayer);
      this.stage.add(this.nodeLayer);
      this.stage.add(this.uiLayer);

      this.drawGrid();
      this.renderFullDiagram(true);
      this.bindStageEvents();

      // Observador de redimensionamiento del contenedor y viewport
      this.resizeObserver = new ResizeObserver(() => {
        this.updateStageDimensions();
      });
      this.resizeObserver.observe(container);
      if (parentContainer) {
        this.resizeObserver.observe(parentContainer);
      }
    });
  }

  private updateStageDimensions(): void {
    if (!this.stage) return;
    const container = this.stageContainerRef?.nativeElement;
    const parentContainer = this.flowContainerRef?.nativeElement;
    const scale = Math.max(0.2, this.zoomLevel() / 100);
    const rawTargetW = Math.max(parentContainer?.clientWidth || 0, container?.clientWidth || 0, this.scaledBoardWidth());
    const rawTargetH = Math.max(parentContainer?.clientHeight || 0, container?.clientHeight || 0, this.scaledBoardHeight());

    // Cuantizar las dimensiones físicas del canvas en bloques de 512px (Bucket Sizing)
    // Esto evita que al hacer zoom gradual (ej. 30% -> 110%) el canvas se redimensione en cada paso de 5%,
    // reduciendo decenas de descartes de buffer a 0 o 1 sola redimensión en todo el recorrido.
    const targetW = Math.ceil(rawTargetW / 512) * 512;
    const targetH = Math.ceil(rawTargetH / 512) * 512;

    if (targetW > 0 && targetH > 0) {
      let dimensionsChanged = false;
      if (this.stage.width() !== targetW || this.stage.height() !== targetH) {
        this.stage.width(targetW);
        this.stage.height(targetH);
        dimensionsChanged = true;
      }

      const scaleChanged = this.stage.scaleX() !== scale || this.stage.scaleY() !== scale;
      if (scaleChanged) {
        this.stage.scale({ x: scale, y: scale });
        this.stage.position({ x: 0, y: 0 });
      }

      // Solo reconstruir la cuadrícula si cambiaron las dimensiones del canvas
      if (dimensionsChanged) {
        this.drawGrid();
      }

      if (dimensionsChanged || scaleChanged) {
        this.stage.batchDraw();
      }
    }
  }

  private startRelationshipAnimationLoop(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.lastFrameTime = performance.now();

    const step = (timestamp: number) => {
      if (!this.lastFrameTime) this.lastFrameTime = timestamp;
      this.lastFrameTime = timestamp;

      let needsRedraw = false;

      for (const [relId, animState] of this.relAnimStates.entries()) {
        const elapsed = timestamp - animState.startTime - animState.delay;
        if (elapsed < 0) {
          this.relProgressMap.set(relId, 0);
          needsRedraw = true;
        } else if (elapsed < animState.duration) {
          const t = Math.max(0, Math.min(1, elapsed / animState.duration));
          const eased = 1 - Math.pow(1 - t, 3);
          this.relProgressMap.set(relId, eased);
          needsRedraw = true;
        } else {
          this.relProgressMap.set(relId, 1);
          this.relAnimStates.delete(relId);
          needsRedraw = true;
        }
      }

      if (needsRedraw && this.relLayer && !this.isDraggingNode) {
        this.renderRelationshipsOnly();
      }

      // Si aún quedan relaciones animándose, continuar en el siguiente fotograma
      if (this.relAnimStates.size > 0) {
        this.animFrameId = requestAnimationFrame(step);
      } else {
        // Animaciones completadas: apagar el loop y dejar la CPU en reposo (0% CPU)
        this.animFrameId = null;
        this.lastFrameTime = 0;
      }
    };

    this.animFrameId = requestAnimationFrame(step);
  }

  private triggerAllRelationshipsDrawAnimation(staggered = true): void {
    const now = performance.now();
    this.relAnimStates.clear();
    this.relProgressMap.clear();

    const conns = this.connections();
    conns.forEach((conn, index) => {
      this.relProgressMap.set(conn.id, 0);
      this.relAnimStates.set(conn.id, {
        startTime: now,
        duration: 680,
        delay: staggered ? index * 90 : 0,
      });
    });

    this.startRelationshipAnimationLoop();
  }

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

        // Si se hace clic dentro de la zona magnética de 28px de una relación
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

      // Selección por recuadro / barrido (Marquee Selection) con clic izquierdo
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

      // Previsualización de línea en modo conexión
      const pendingSrcId = this.pendingSourceNodeId();
      if (pendingSrcId) {
        this.drawLiveConnectionPreview(pendingSrcId, canvasPos.x, canvasPos.y);
      } else if (!this.isDraggingNode && !this.isMarqueeSelecting) {
        // Detección geométrica de proximidad de 28px al acercar el cursor a cualquier relación
        const isOverNode = e.target?.getLayer() === this.nodeLayer;
        if (!isOverNode && !this.selectedRelationType()) {
          const nearConn = this.findClosestRelationshipAtCanvasPoint(canvasX, canvasY, 28);
          this.setHoveredRelationship(nearConn?.id ?? null);
          if (this.stage.container()) {
            this.stage.container().style.cursor = nearConn ? 'pointer' : 'default';
          }
        } else if (this.hoveredRelId) {
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

  private drawGrid(): void {
    if (!this.gridGroup || !this.bgLayer || !this.stage) return;
    this.gridGroup.destroyChildren();

    const targetW = this.stage.width();
    const targetH = this.stage.height();

    // Cubrir hasta el rango de zoom mínimo (25%) para que durante el zoom no se requiera recrear líneas
    const effectiveW = Math.max(this.boardWidth(), Math.ceil(targetW / 0.25));
    const effectiveH = Math.max(this.boardHeight(), Math.ceil(targetH / 0.25));

    if (this.bgRect) {
      this.bgRect.position({ x: 0, y: 0 });
      this.bgRect.width(effectiveW);
      this.bgRect.height(effectiveH);
    }

    // Dibujar líneas de cuadrícula solo si está activada la opción showGrid
    if (this.showGrid()) {
      const step = 28;
      for (let x = 0; x <= effectiveW; x += step) {
        const isMajor = x % (step * 4) === 0;
        this.gridGroup.add(
          new Konva.Line({
            points: [x, 0, x, effectiveH],
            stroke: isMajor ? 'rgba(120, 113, 108, 0.15)' : 'rgba(120, 113, 108, 0.05)',
            strokeWidth: 1,
            listening: false,
          })
        );
      }

      for (let y = 0; y <= effectiveH; y += step) {
        const isMajor = y % (step * 4) === 0;
        this.gridGroup.add(
          new Konva.Line({
            points: [0, y, effectiveW, y],
            stroke: isMajor ? 'rgba(120, 113, 108, 0.15)' : 'rgba(120, 113, 108, 0.05)',
            strokeWidth: 1,
            listening: false,
          })
        );
      }
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

  private isContainerNode(node?: UmlClassNode | UmlNode | null): boolean {
    if (!node) return false;
    const n = node as any;
    const t = (n.nodeType || n.type || '').toLowerCase();
    const id = (n.id || '').toLowerCase();
    return (
      t === 'boundary_box' ||
      t === 'package_layer' ||
      t === 'package' ||
      t === 'device' ||
      t === 'executionenvironment' ||
      t === 'execution_environment' ||
      t === 'exec_env' ||
      t === 'deployment_node' ||
      t === 'node' ||
      t === 'subsystem' ||
      id.startsWith('boundary_box_') ||
      id.startsWith('bbox_') ||
      id.startsWith('package_')
    );
  }

  private getNodeZWeight(node: UmlClassNode | UmlNode): number {
    const n = node as any;
    const t = (n.nodeType || n.type || '').toLowerCase();
    const id = (n.id || '').toLowerCase();
    // 1. Grouping boundaries y boundary boxes al fondo absoluto de frameLayer
    if (t === 'boundary_box' || t === 'package_layer' || id.startsWith('boundary_box_') || id.startsWith('bbox_')) {
      return 0;
    }
    // 2. Paquetes UML
    if (t === 'package' || id.startsWith('package_')) {
      return 1;
    }
    // 3. Nodos contenedores de despliegue (device, executionEnvironment, node)
    if (
      t === 'device' ||
      t === 'executionenvironment' ||
      t === 'execution_environment' ||
      t === 'exec_env' ||
      t === 'deployment_node' ||
      t === 'node' ||
      t === 'subsystem'
    ) {
      return 2;
    }
    // 4. Componentes y artefactos contenidos siempre en z = top
    if (t === 'component' || t === 'artifact') {
      return 100;
    }
    // 5. Nodos regulares (clase, actor, use case, lifelines, notas, actividades) en el nivel intermedio
    return 10;
  }

  private enforceZOrdering(): void {
    if (!this.nodeLayer || !this.frameLayer) return;

    // 1. En frameLayer: ordenar contenedores manteniendo los de menor peso (boundary_box) al fondo
    for (const [id, grp] of this.nodeGroupsMap.entries()) {
      const n = this.nodes().find((x) => x.id === id);
      if (!n || !this.isContainerNode(n)) continue;
      const w = this.getNodeZWeight(n);
      if (w === 0) {
        grp.moveToBottom();
      }
    }

    // 2. En nodeLayer: componentes siempre en z = top
    for (const [id, grp] of this.nodeGroupsMap.entries()) {
      const n = this.nodes().find((x) => x.id === id);
      if (!n || this.isContainerNode(n)) continue;
      const t = (n?.nodeType || '').toLowerCase();
      if (t === 'component' || t === 'artifact') {
        grp.moveToTop();
      }
    }
  }

  /**
   * Resuelve el nodo destino real considerando la contención geométrica interna.
   * Si el usuario hace clic sobre un contenedor (boundary box, paquete o dispositivo)
   * pero el puntero apunta a un componente o clase dentro de él, prioriza el nodo interno.
   */
  private resolveTargetNodeAtPointer(clickedNode: UmlClassNode): UmlClassNode {
    if (!this.isContainerNode(clickedNode)) {
      return clickedNode;
    }

    const pointer = this.stage?.getPointerPosition();
    if (!pointer) return clickedNode;

    const transform = this.stage?.getAbsoluteTransform().copy().invert();
    const canvasPos = transform ? transform.point(pointer) : pointer;
    const px = Math.round(canvasPos.x);
    const py = Math.round(canvasPos.y);

    const candidates = this.nodes().filter((n) => {
      if (n.id === clickedNode.id || n.isAnchor) return false;
      const group = this.nodeGroupsMap.get(n.id);
      const nx = group ? group.x() : n.position?.x ?? 0;
      const ny = group ? group.y() : n.position?.y ?? 0;
      const nw = group ? group.width() : n.width || 120;
      const nh = group ? group.height() : n.height || 60;
      return px >= nx && px <= nx + nw && py >= ny && py <= ny + nh;
    });

    if (candidates.length === 0) {
      return clickedNode;
    }

    // Priorizar nodo interno con mayor peso Z (ej. componente) o menor área geométrica
    candidates.sort((a, b) => {
      const zDiff = this.getNodeZWeight(b) - this.getNodeZWeight(a);
      if (zDiff !== 0) return zDiff;
      const areaA = (a.width || 120) * (a.height || 60);
      const areaB = (b.width || 120) * (b.height || 60);
      return areaA - areaB;
    });

    return candidates[0];
  }

  renderFullDiagram(animateEntrance = false): void {
    if (!this.nodeLayer || !this.frameLayer || !this.relLayer) return;

    this.frameLayer.destroyChildren();
    this.nodeLayer.destroyChildren();
    this.nodeGroupsMap.clear();

    const currentNodes = this.nodes().filter((n) => !n.isAnchor);
    // Ordenamiento estricto Z: Boundary/Grouping al fondo (0, 1, 2), Clases (10), Componentes arriba (100)
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

  private renderRelationshipsOnly(): void {
    if (!this.relLayer) return;
    this.relLayer.destroyChildren();
    this.konvaRelGroupMap.clear();

    const nodeMap = new Map<string, UmlNode>();
    for (const rawNode of this.nodes()) {
      if (!rawNode.isAnchor) {
        const liveG = this.nodeGroupsMap.get(rawNode.id);
        const kNode = toKonvaNode(
          rawNode,
          this.activeDiagramType(),
          this.connections(),
          this.sequenceActivationService
        );
        if (liveG) {
          kNode.x = Math.round(liveG.x());
          kNode.y = Math.round(liveG.y());
        }
        nodeMap.set(rawNode.id, kNode);
      }
    }

    const selectedConnIds = new Set([...this.selectedConnIds(), ...this.selectedConnIdsInternal()]);
    const isSequenceDiag = this.activeDiagramType() === DiagramType.SEQUENCE;

    for (const rawConn of this.connections()) {
      // Ignorar conexiones de anclaje legacy hacia el nodo ancla invisible (ej: anchor_xxx)
      // ya que la conexión principal dibuja la rama discontinua automáticamente
      const isLegacyAnchorDashed =
        rawConn.id.includes('assoc_dashed') ||
        (rawConn.sourceNodeId && this.nodes().some((n) => n.id === rawConn.sourceNodeId && n.isAnchor));
      if (isLegacyAnchorDashed) {
        continue;
      }

      // Si existe una conexión duplicada generada por el bug anterior (ej: conn_..._assoc_main junto a la conexión original),
      // omitir el duplicado para no dibujar líneas dobles superpuestas
      if (rawConn.id.includes('_assoc_main')) {
        const srcId = rawConn.sourceNodeId || rawConn.sourceId.replace(/_(top|right|bottom|left|slot_\d+)$/, '');
        const tgtId = rawConn.targetNodeId || rawConn.targetId.replace(/_(top|right|bottom|left|slot_\d+)$/, '');
        const hasOtherConn = this.connections().some(
          (c) =>
            c.id !== rawConn.id &&
            !c.id.includes('assoc_dashed') &&
            ((c.sourceNodeId === srcId && c.targetNodeId === tgtId) ||
              (c.sourceId?.startsWith(srcId) && c.targetId?.startsWith(tgtId)) ||
              (c.sourceNodeId === tgtId && c.targetNodeId === srcId) ||
              (c.sourceId?.startsWith(tgtId) && c.targetId?.startsWith(srcId)))
        );
        if (hasOtherConn) {
          continue;
        }
      }

      const kRel = toKonvaRelationship(rawConn, this.activeDiagramType(), this.nodes(), this.connections());
      const src = nodeMap.get(kRel.sourceId);
      const tgt = nodeMap.get(kRel.targetId);
      if (!src || !tgt) continue;

      const assocNode = kRel.associationClassNodeId
        ? nodeMap.get(kRel.associationClassNodeId) ?? null
        : null;

      const isSelected = selectedConnIds.has(rawConn.id);
      const progress = this.relProgressMap.get(rawConn.id) ?? 1;
      const relGroup = createUmlRelationshipKonvaGroup(
        kRel,
        src,
        tgt,
        isSelected,
        progress,
        this.flowPhase,
        assocNode
      );

      this.konvaRelGroupMap.set(rawConn.id, relGroup);

      if (this.hoveredRelId === rawConn.id && !isSelected) {
        relGroup.find('.hover-halo').forEach((h) => h.opacity(1));
      }

      relGroup.on('mouseenter', () => {
        this.setHoveredRelationship(rawConn.id);
        if (this.stage?.container()) {
          this.stage.container().style.cursor = 'pointer';
        }
      });

      relGroup.on('mouseleave', () => {
        if (this.hoveredRelId === rawConn.id) {
          this.setHoveredRelationship(null);
          if (this.stage?.container()) {
            this.stage.container().style.cursor = 'default';
          }
        }
      });

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

  private findClosestRelationshipAtCanvasPoint(
    canvasX: number,
    canvasY: number,
    maxDistancePx = 28
  ): UmlConnection | null {
    const nodeMap = new Map<string, UmlNode>();
    for (const rawNode of this.nodes()) {
      if (!rawNode.isAnchor) {
        const liveG = this.nodeGroupsMap.get(rawNode.id);
        const kNode = toKonvaNode(
          rawNode,
          this.activeDiagramType(),
          this.connections(),
          this.sequenceActivationService
        );
        if (liveG) {
          kNode.x = Math.round(liveG.x());
          kNode.y = Math.round(liveG.y());
        }
        nodeMap.set(rawNode.id, kNode);
      }
    }

    let closestConn: UmlConnection | null = null;
    let bestDist = maxDistancePx;

    for (const rawConn of this.connections()) {
      const isLegacyAnchorDashed =
        rawConn.id.includes('assoc_dashed') ||
        (rawConn.sourceNodeId && this.nodes().some((n) => n.id === rawConn.sourceNodeId && n.isAnchor));
      if (isLegacyAnchorDashed) {
        continue;
      }

      if (rawConn.id.includes('_assoc_main')) {
        const srcId = rawConn.sourceNodeId || rawConn.sourceId.replace(/_(top|right|bottom|left|slot_\d+)$/, '');
        const tgtId = rawConn.targetNodeId || rawConn.targetId.replace(/_(top|right|bottom|left|slot_\d+)$/, '');
        const hasOtherConn = this.connections().some(
          (c) =>
            c.id !== rawConn.id &&
            !c.id.includes('assoc_dashed') &&
            ((c.sourceNodeId === srcId && c.targetNodeId === tgtId) ||
              (c.sourceId?.startsWith(srcId) && c.targetId?.startsWith(tgtId)) ||
              (c.sourceNodeId === tgtId && c.targetNodeId === srcId) ||
              (c.sourceId?.startsWith(tgtId) && c.targetId?.startsWith(srcId)))
        );
        if (hasOtherConn) {
          continue;
        }
      }

      const kRel = toKonvaRelationship(rawConn, this.activeDiagramType(), this.nodes(), this.connections());
      const src = nodeMap.get(kRel.sourceId);
      const tgt = nodeMap.get(kRel.targetId);
      if (!src || !tgt) continue;

      const assocNode = kRel.associationClassNodeId
        ? nodeMap.get(kRel.associationClassNodeId) ?? null
        : null;

      const d = getPointToRelationshipDistance(
        { x: canvasX, y: canvasY },
        kRel,
        src,
        tgt,
        assocNode
      );
      if (d <= bestDist) {
        bestDist = d;
        closestConn = rawConn;
      }
    }

    return closestConn;
  }

  private setHoveredRelationship(relId: string | null): void {
    if (this.hoveredRelId === relId) return;

    const selectedConnIds = new Set([...this.selectedConnIds(), ...this.selectedConnIdsInternal()]);

    if (this.hoveredRelId && !selectedConnIds.has(this.hoveredRelId)) {
      const prevGroup = this.konvaRelGroupMap.get(this.hoveredRelId);
      prevGroup?.find('.hover-halo').forEach((h) => h.opacity(0));
    }

    this.hoveredRelId = relId;

    if (relId) {
      const nextGroup = this.konvaRelGroupMap.get(relId);
      nextGroup?.find('.hover-halo').forEach((h) => h.opacity(1));
    }

    this.relLayer?.batchDraw();
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

  private attachNodeInteractions(group: Konva.Group, origNode: UmlClassNode): void {
    const isLocked = this.isNodeLockedByOther(origNode.id);
    const canDrag = !this.isReadOnly() && !isLocked && this.selectedRelationType() === null;
    group.draggable(canDrag);

    group.on('mouseenter', (e) => {
      this.hoveredNodeId.set(origNode.id);
      if (!this.isReadOnly() && !this.isNodeLockedByOther(origNode.id)) {
        this.stage?.container().style.setProperty('cursor', this.selectedRelationType() ? 'crosshair' : 'move');
      }

      // Al pasar el cursor por las clases con el botón izquierdo presionado, agregarla a la selección
      const mouseEvt = e.evt as MouseEvent;
      if (mouseEvt && mouseEvt.buttons === 1 && !this.selectedRelationType() && !this.isDraggingNode) {
        // No auto-seleccionar contenedores grandes por arrastre de puntero para no eclipsar componentes
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

      // Si el nodo clickeado es un contenedor, verificar si se hizo clic cerca de una relación (28px)
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

      // Si hay una relación seleccionada en la barra de herramientas, crear conexión de A -> B
      const activeRelType = this.selectedRelationType();
      if (activeRelType) {
        // Resolver nodo de destino considerando contención geométrica interna
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

      // Selección al presionar sobre la clase
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
            // El nodo ya estaba seleccionado: si usa Shift/Ctrl, alternar remoción
            if (mouseEvt.shiftKey || mouseEvt.ctrlKey) {
              const updated = this.selectedNodeIdsInternal().filter((id) => id !== origNode.id);
              this.select(updated, []);
              this.selectionChange.emit({ nodeIds: updated, connectionIds: [] });
            }
            // Si no tiene Shift/Ctrl, no alteramos la selección aquí para permitir arrastre en grupo
          }
        });
      }
    });

    group.on('click tap', (e) => {
      if (this.selectedRelationType()) return;
      e.cancelBubble = true;

      // Si hubo movimiento de arrastre, no procesar clic para preservar la multiselección
      if (this.isDraggingNode) return;

      const mouseEvt = e.evt as MouseEvent;
      // Si fue un clic simple sin arrastre sobre un elemento que pertenecía a un grupo multiseleccionado,
      // reducir la selección a este único elemento
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

    // Control de arrastre fluido individual y sincronizado (multi-selección y secuencial)
    let dragStartPos = { x: Math.round(group.x()), y: Math.round(group.y()) };
    const siblingStartPositions = new Map<string, { x: number; y: number }>();

    group.on('dragstart', (e) => {
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

      // Si el nodo que se arrastra no estaba seleccionado, seleccionarlo como único
      if (!this.selectedNodeIdsInternal().includes(origNode.id)) {
        this.select([origNode.id], []);
        this.selectionChange.emit({ nodeIds: [origNode.id], connectionIds: [] });
      }

      // Ocultar temporalmente el transformer para máxima fluidez durante el arrastre
      if (this.transformer) {
        this.transformer.nodes([]);
        this.uiLayer?.batchDraw();
      }

      // Registrar posiciones iniciales de todos los nodos seleccionados
      for (const id of this.selectedNodeIdsInternal()) {
        const otherG = this.nodeGroupsMap.get(id);
        if (otherG) {
          siblingStartPositions.set(id, { x: Math.round(otherG.x()), y: Math.round(otherG.y()) });
        }
      }

      // Sincronizar coordenadas actuales de los nodos en el lienzo antes de consultar contención
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

    // Actualización de líneas en vivo durante el arrastre
    group.on('dragmove', () => {
      this.isDraggingNode = true;
      this.lastLocalMoveTimestamps.set(origNode.id, Date.now());

      // En diagramas de secuencia, la línea de vida solo se mueve horizontalmente en X
      if (this.activeDiagramType() === DiagramType.SEQUENCE || origNode.nodeType === 'lifeline') {
        group.y(origNode.position ? origNode.position.y : 30);
      }

      const curX = Math.max(10, Math.round(group.x()));
      const curY = Math.max(10, Math.round(group.y()));
      group.x(curX);
      group.y(curY);
      const dx = curX - dragStartPos.x;
      const dy = curY - dragStartPos.y;

      const currentNode = this.nodes().find((n) => n.id === origNode.id) || origNode;
      currentNode.position = { x: curX, y: curY };
      origNode.position = { x: curX, y: curY };

      // Mover los demás nodos seleccionados o descendientes contenidos de manera coordinada
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
        // Redibujar tanto frameLayer como nodeLayer para sincronizar capas a 60 FPS
        this.frameLayer?.batchDraw();
        this.nodeLayer?.batchDraw();
      }

      // Si es arrastre individual sin hijos ni hermanos
      if (siblingStartPositions.size <= 1) {
        this.nodePositionChange.emit({ node: currentNode, newPosition: { x: curX, y: curY } });
      }
      this.renderRelationshipsOnly();
    });

    group.on('dragend', () => {
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

      // Si había hermanos movidos por multiselección o descendientes contenidos, emitir el movimiento en lote
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

    // Redimensión fluida de nodo mediante Transformer
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

  private applyFluidNodeResize(
    group: Konva.Group,
    node: UmlNode,
    newW: number,
    newH: number
  ): void {
    switch (node.type) {
      case 'class':
        resizeClassKonvaNode(group, newW, newH, node);
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
      case 'component':
        resizeComponentKonvaNode(group, node, newW, newH, true);
        break;
      case 'package':
        resizePackageKonvaNode(group, node, newW, newH, true);
        break;
      case 'package_layer':
        resizePackageLayerKonvaNode(group, node, newW, newH, true);
        break;
      case 'note':
        resizeNoteKonvaNode(group, node, newW, newH, true);
        break;
      case 'activity_initial':
      case 'activity_final':
      case 'activity_action':
      case 'activity_decision':
      case 'activity_fork':
        resizeActivityKonvaNode(group, node, newW, newH, true);
        break;
    }
  }

  private syncTransformer(): void {
    if (!this.transformer || !this.uiLayer) return;

    const selectedIds = Array.from(
      new Set([...this.selectedNodeIds(), ...this.selectedNodeIdsInternal()])
    );
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
    this.transformer.forceUpdate();
    this.uiLayer.batchDraw();
  }

  // Métodos de compatibilidad y control público del Canvas

  redraw(): void {
    this.cdr.detectChanges();
    this.updateStageDimensions();
    if (this.stage && !this.isDraggingNode) {
      this.renderFullDiagram(false);
      this.stage.batchDraw();
    }
  }

  reset(): void {
    this.clearSelection();
    this.resetView();
  }

  resetView(): void {
    this.setZoom(100, false);
    this.centerViewportOnBoard();
  }

  fitView(): void {
    const container = this.flowContainerRef?.nativeElement;
    const nodes = this.nodes().filter((n) => !n.isAnchor);
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

    const availableWidth = container.clientWidth || 800;
    const availableHeight = container.clientHeight || 600;

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

  zoomIn(): void {
    const current = this.zoomLevel();
    const next = current < 100 ? current + 10 : Math.min(125, current + 25);
    this.setZoom(next, true);
  }

  zoomOut(): void {
    const current = this.zoomLevel();
    const next = current <= 100 ? current - 10 : current - 25;
    this.setZoom(next, true);
  }

  setZoom(
    targetPct: number,
    autoAdjustScroll = true,
    focusPoint?: { clientX: number; clientY: number },
    persistToStorage = true,
  ): void {
    const clamped = Math.max(25, Math.min(125, Math.round(targetPct)));
    const oldZoom = this.zoomLevel();
    if (oldZoom === clamped && this.stage?.scaleX() === clamped / 100) {
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
    this.updateStageDimensions();
    this.zoomChange.emit(clamped);

    if (persistToStorage) {
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

  syncZoomFromCanvas(): void {
    if (this.stage) {
      const pct = Math.round(this.stage.scaleX() * 100);
      if (pct !== this.zoomLevel()) {
        this.zoomLevel.set(pct);
        this.zoomChange.emit(pct);
      }
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

      // Calcular el próximo zoom acumulativo sobre el valor pendiente o el actual
      const baseZoom = this.pendingWheelZoom ? this.pendingWheelZoom.nextZoom : this.zoomLevel();
      const nextZoom = Math.max(25, Math.min(125, baseZoom + direction * zoomStep));

      this.pendingWheelZoom = {
        nextZoom,
        focusPoint: { clientX: event.clientX, clientY: event.clientY },
      };

      if (this.wheelAnimFrameId === null) {
        this.wheelAnimFrameId = requestAnimationFrame(() => {
          this.wheelAnimFrameId = null;
          if (this.pendingWheelZoom) {
            const { nextZoom: targetZoom, focusPoint } = this.pendingWheelZoom;
            this.pendingWheelZoom = null;
            this.ngZone.run(() => {
              this.setZoom(targetZoom, true, focusPoint);
            });
          }
        });
      }
    }
  }

  select(nodeIds: string[], connIds: string[]): void {
    this.selectedNodeIdsInternal.set(nodeIds);
    this.selectedConnIdsInternal.set(connIds);
    this.syncTransformer();
    this.updateNodesSelectionAppearance();
    this.renderRelationshipsOnly();
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
    this.updateNodesSelectionAppearance();
    this.renderRelationshipsOnly();
  }

  startRenameNode(nodeId: string): void {
    this.renamingNodeId.set(nodeId);
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
    this.setZoom(state.zoom, false, undefined, false);
    const el = this.flowContainerRef?.nativeElement;
    if (el) {
      requestAnimationFrame(() => {
        el.scrollLeft = Math.max(0, state.scrollLeft);
        el.scrollTop = Math.max(0, state.scrollTop);
      });
    }
  }

  getExportElement(): HTMLElement | undefined {
    return this.boardElementRef?.nativeElement || this.stageContainerRef?.nativeElement;
  }

  /**
   * Exporta el contenido vectorial del lienzo Konva a un HTMLCanvasElement optimizado,
   * calculando el bounding box envolvente de todos los nodos y relaciones en coordenadas absolutas del modelo (escala 1x),
   * ocultando temporalmente la rejilla, marquesina de selección y transformer,
   * y renderizando a alta resolución (pixelRatio: 2 por defecto para nitidez Retina).
   */
  exportContentCanvas(pixelRatio = 2, padding = 40): HTMLCanvasElement | null {
    if (!this.stage) return null;

    const validNodes = this.nodes().filter((n) => !n.isAnchor);
    if (validNodes.length === 0) {
      return null;
    }

    // 1. Calcular el bounding box envolvente de todos los nodos y elementos del modelo
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const rawNode of this.nodes()) {
      const group = this.nodeGroupsMap.get(rawNode.id);
      const x = group ? group.x() : rawNode.position.x;
      const y = group ? group.y() : rawNode.position.y;
      const w = group?.width() || this.getNodeWidth(rawNode) || 200;
      const h = group?.height() || this.getNodeHeight(rawNode) || 80;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    }

    // Incorporar relaciones con bounds seguros si existen capas de relación renderizadas
    if (this.relLayer && this.relLayer.children.length > 0) {
      try {
        const relRect = this.relLayer.getClientRect({ skipTransform: true });
        if (Number.isFinite(relRect.x) && Number.isFinite(relRect.width) && relRect.width > 0 && relRect.width < 50000) {
          minX = Math.min(minX, relRect.x);
          minY = Math.min(minY, relRect.y);
          maxX = Math.max(maxX, relRect.x + relRect.width);
          maxY = Math.max(maxY, relRect.y + relRect.height);
        }
      } catch {
        // Fallback a coordenadas de nodos
      }
    }

    // Margen de seguridad alrededor del diagrama
    const cropX = Math.floor(minX - padding);
    const cropY = Math.floor(minY - padding);
    const cropW = Math.max(120, Math.ceil(maxX - minX + padding * 2));
    const cropH = Math.max(80, Math.ceil(maxY - minY + padding * 2));

    // 2. Preparar el stage de Konva: aislar de zoom temporal y ocultar UI interactiva
    const prevScale = { x: this.stage.scaleX(), y: this.stage.scaleY() };
    const prevPos = { x: this.stage.x(), y: this.stage.y() };
    const prevGridVisible = this.gridGroup ? this.gridGroup.visible() : true;
    const prevUiVisible = this.uiLayer ? this.uiLayer.visible() : true;
    const prevBgColor = this.bgRect ? (this.bgRect.fill() as string) : '#FAF9F5';
    const prevTransformerNodes = this.transformer ? [...this.transformer.nodes()] : [];

    try {
      if (this.transformer) {
        this.transformer.nodes([]);
      }
      if (this.uiLayer) {
        this.uiLayer.visible(false);
      }
      if (this.gridGroup) {
        this.gridGroup.visible(false);
      }
      if (this.bgRect) {
        this.bgRect.fill('#FFFFFF');
      }

      // Normalizar stage a escala 1x y posición 0,0 para captura matemática exacta
      this.stage.scale({ x: 1, y: 1 });
      this.stage.position({ x: 0, y: 0 });

      // Generar el canvas con la API nativa de Konva
      const contentCanvas = this.stage.toCanvas({
        x: cropX,
        y: cropY,
        width: cropW,
        height: cropH,
        pixelRatio,
      });

      return contentCanvas;
    } finally {
      // Restaurar el estado interactivo original del usuario
      this.stage.scale(prevScale);
      this.stage.position(prevPos);
      if (this.gridGroup) {
        this.gridGroup.visible(prevGridVisible);
      }
      if (this.uiLayer) {
        this.uiLayer.visible(prevUiVisible);
      }
      if (this.bgRect) {
        this.bgRect.fill(prevBgColor);
      }
      if (this.transformer && prevTransformerNodes.length > 0) {
        this.transformer.nodes(prevTransformerNodes);
      }
      this.stage.batchDraw();
    }
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
      setScale: (scale: number, _origin?: { x: number; y: number }) => {
        this.setZoom(Math.round(scale * 100), false);
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
    const container = this.stageContainerRef?.nativeElement;
    const scale = Math.max(0.2, this.zoomLevel() / 100);
    if (!container) return { x: clientX, y: clientY };
    const rect = container.getBoundingClientRect();
    const x = (clientX - rect.left) / scale;
    const y = (clientY - rect.top) / scale;
    return {
      x: Math.max(10, Math.round(x)),
      y: Math.max(10, Math.round(y)),
    };
  }

  // Helpers de posición de cursores remotos en pantalla
  getCursorScreenX(canvasX: number): number {
    return Math.round(canvasX * (this.zoomLevel() / 100));
  }

  getCursorScreenY(canvasY: number): number {
    return Math.round(canvasY * (this.zoomLevel() / 100));
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
