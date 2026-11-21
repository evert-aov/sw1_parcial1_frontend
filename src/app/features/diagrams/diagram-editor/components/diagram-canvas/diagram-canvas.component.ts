import { PluginRegistryService } from '../../../../../core/plugins/plugin-registry.service';
import type { DiagramExportCanvasTarget } from '../../../../../core/plugins/contracts/diagram-export.service.contract';
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
  FBackgroundComponent,
  FCanvasComponent,
  FCreateConnectionEvent,
  FEventTrigger,
  FFlowComponent,
  FFlowModule,
  FMoveNodesEvent,
  FReassignConnectionEvent,
  FRectPatternComponent,
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
import { TranslatePipe, TranslationService } from '../../../../../core/i18n/index';
import {
  ConnectionMarkerSvgComponent,
  UmlMarkerConfig,
} from '../../../../../plugin-sdk/ui/uml-svg/connection-marker-svg.component';
import { NodePluginRegistryService } from '../../../../../core/plugins/node-plugin-registry.service';
import { PluginOutletDirective, PluginOutputEvent } from '../../../../../core/plugins/plugin-outlet.directive';
import {
  DiagramCanvasDragService,
  DiagramCanvasGeometryService,
  DiagramNodeResizeService,
  DiagramSequenceActivationService,
} from '../../services/index';
import { CalculateLateralLineData, LATERAL_CONNECTION_TYPE } from '../../services/spatial-engine/lateral-connection.builder';
import {
  CalculateSequenceLineData,
  CalculateSequenceSelfLineData,
  SEQUENCE_CONNECTION_TYPE,
  SEQUENCE_SELF_CONNECTION_TYPE,
} from '../../services/spatial-engine/sequence-connection.builder';
import { NodeMetricsService, computeBoardHeight, computeBoardWidth } from '../../utils/node-metrics.util';
import { ConnectionCascadeUtil } from '../../../../../core/plugins/contracts/connection-cascade.util.contract';

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
    PluginOutletDirective,
  ],
  providers: [
    DiagramCanvasGeometryService,
    DiagramCanvasDragService,
    {
      provide: F_CONNECTION_BUILDERS,
      useValue: {
        'tree_horizontal': new CalculateSegmentLineData(),
        'tree_vertical': new CalculateSegmentLineData(),
        [LATERAL_CONNECTION_TYPE]: new CalculateLateralLineData(),
        [SEQUENCE_CONNECTION_TYPE]: new CalculateSequenceLineData(),
        [SEQUENCE_SELF_CONNECTION_TYPE]: new CalculateSequenceSelfLineData(),
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
    '[attr.inert]': 'interactionDisabled() ? "" : null',
    '(window:keydown)': 'onWindowKeyDown($event)',
    '(window:keyup)': 'onWindowKeyUp($event)',
    '(window:mouseup)': 'onWindowMouseUp($event)',
  },
  templateUrl: './diagram-canvas.component.html',
  styleUrl: './diagram-canvas.component.css',
})
export class DiagramCanvasComponent implements DiagramExportCanvasTarget {
  private readonly registry = inject(PluginRegistryService);

  /** Resuelve la utilidad de selección en cascada desde el registro de plugins si está disponible. */
  private get cascadeRules(): ConnectionCascadeUtil | undefined { return this.registry.has(ConnectionCascadeUtil) ? this.registry.resolve(ConnectionCascadeUtil) : undefined; }
  private readonly metrics = inject(NodeMetricsService);
  readonly nodePlugins = inject(NodePluginRegistryService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translationService = inject(TranslationService);
  private readonly geometryService = inject(DiagramCanvasGeometryService);
  private readonly dragService = inject(DiagramCanvasDragService);
  private readonly nodeResizeService = inject(DiagramNodeResizeService);

  /** Resuelve el servicio de activación de mensajes de secuencia desde el registro de plugins. */
  private get sequenceActivationService(): DiagramSequenceActivationService | undefined { return this.registry.has(DiagramSequenceActivationService) ? this.registry.resolve(DiagramSequenceActivationService) : undefined; }

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
  /** Dimensiones explícitas del flujo temporal; evitan depender de porcentajes fuera del editor. */
  readonly exportSize = input<{ width: number; height: number } | null>(null);
  readonly connections = input<UmlConnection[]>([]);
  readonly selectedRelationType = input<UmlRelationshipType | null>(null);
  readonly selectedSourceNodeId = input<string | null>(null);
  readonly defaultLineStyle = input<UmlLineStyle>('segment');
  readonly isReadOnly = input<boolean>(false);
  /** Suspende la interacción local sin detener renderizado ni actualizaciones colaborativas. */
  readonly interactionDisabled = input(false);
  readonly selectedNodeIds = input<string[]>([]);
  readonly selectedConnIds = input<string[]>([]);
  readonly remoteCursors = input<RemoteCursor[]>([]);
  readonly nodeLocks = input<Map<string, NodeLock>>(new Map());
  readonly currentUserId = input<string | null>(null);
  readonly diagramId = input<string | null>(null);
  readonly activeDiagramType = input<DiagramType>(DiagramType.CLASS);
  readonly smartGuidesEnabled = input<boolean>(true);
  readonly isGridVisible = input<boolean>(false);

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
  /**
   * Grosor (en px del lienzo) de los bordes finos de los nodos. Al alejar el zoom, un borde de
   * 1px se escala por debajo de un píxel de pantalla y el navegador lo omite en algunos lados;
   * compensarlo con la escala inversa mantiene siempre al menos 1px visible (máx. 4px).
   */
  readonly nodeHairlineWidth = computed(() => {
    const scale = Math.max(this.zoomLevel(), 1) / 100;
    return `${Math.min(4, Math.max(1, 1 / scale)).toFixed(3)}px`;
  });
  readonly isDragOverCanvas = signal<boolean>(false);
  readonly hoveredNodeId = signal<string | null>(null);
  readonly hoveredConnectionId = signal<string | null>(null);
  readonly renamingNodeId = signal<string | null>(null);
  readonly isDraggingLabel = signal<boolean>(false);
  readonly draggingLabelNodeId = signal<string | null>(null);
  readonly isDraggingSeqMessage = signal<boolean>(false);
  readonly draggingSeqMessageConnId = signal<string | null>(null);
  readonly draggingSeqMessageDeltaY = signal<number>(0);
  readonly draggingSeqMessageTargetSlot = signal<number>(0);
  readonly isSpacePressed = signal<boolean>(false);

  readonly canvasLayers: EFCanvasLayer[] = [EFCanvasLayer.GROUPS, EFCanvasLayer.NODES, EFCanvasLayer.CONNECTIONS];

  readonly scaledBoardWidth = computed(() =>
    Math.round(computeBoardWidth(this.nodes(), this.connections(), this.activeDiagramType()) * (this.zoomLevel() / 100))
  );
  readonly scaledBoardHeight = computed(() =>
    Math.round(computeBoardHeight(this.nodes(), this.connections(), this.activeDiagramType()) * (this.zoomLevel() / 100))
  );
  readonly hasNoRealNodes = computed(() => !this.nodes().some((n) => !n.isAnchor));
  readonly canvasEmptyStateMessage = computed(() =>
    this.translationService.translate(this.geometryService.getEmptyStateMessageKey(this.activeDiagramType())),
  );

  readonly livePointerPos = signal<{ x: number; y: number } | null>(null);
  readonly livePreviewCoords = computed(() => {
    const srcId = this.selectedSourceNodeId();
    const ptr = this.livePointerPos();
    if (!srcId || !ptr) return null;
    const srcNode = this.nodes().find((n) => n.id === srcId);
    if (!srcNode || !srcNode.position) return null;
    const w = this.getNodeWidth(srcNode) || 160;
    const h = this.getNodeHeight(srcNode) || 80;
    const x1 = Math.round(srcNode.position.x + w / 2);
    const y1 = Math.round(srcNode.position.y + h / 2);
    return {
      x1,
      y1,
      x2: Math.round(ptr.x),
      y2: Math.round(ptr.y),
    };
  });

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

  /**
   * Prepara y mapea las propiedades de entrada para el componente plug-in correspondiente al nodo.
   * @param node Nodo UML a renderizar en el plugin outlet.
   * @returns Diccionario de entradas para el componente plug-in.
   */
  nodePluginInputs(node: UmlClassNode): Record<string, unknown> {
    return this.nodeRendererInputs().get(node.id) ?? {};
  }

  /**
   * Conserva la identidad de las entradas del renderer mientras sus dependencias no cambian.
   * Los adaptadores pueden producir objetos anidados (colores, dimensiones); recrearlos
   * durante cada comprobación vuelve a ensuciar las vistas dinámicas indefinidamente.
   */
  private readonly nodeRendererInputs = computed(() => new Map(this.nodes().map(node => {
    const context = {
      node, connections: this.connections(), isSelected: this.isNodeSelected(node.id),
      isNeighbor: this.isNeighborNode(node.id), isLocked: this.isNodeLockedByOther(node.id),
      isReadOnly: this.isReadOnly(), activeDiagramType: this.activeDiagramType(),
      selectedRelationType: this.selectedRelationType(), renamingNodeId: this.renamingNodeId(),
    };
    return [node.id, this.nodePlugins.forNode(node)?.inputs(context) ?? context];
  })));

  /**
   * Despacha eventos de salida originados desde los componentes plug-in hacia los manejadores del canvas.
   * @param node Nodo UML emisor del evento.
   * @param event Evento genérico con nombre y valor.
   */
  onPluginEvent(node: UmlClassNode, event: PluginOutputEvent): void {
    const handlers: Record<string, (value: unknown) => void> = {
      nodeClick: value => this.onNodeClick(node.id, value as MouseEvent),
      deleteNode: value => this.onDeleteNode(node.id, value as MouseEvent),
      tableClick: value => this.onTableClick(node.id, value as MouseEvent),
      labelDblClick: value => this.onLabelDblClick(node, value as MouseEvent),
      commitRename: value => this.commitNodeRename(node.id, value as string),
      cancelRename: () => this.cancelNodeRename(),
    };
    handlers[event.name]?.(event.value);
  }

  // --- DELEGACIÓN GEOMÉTRICA Y VISUAL ---

  /** Obtiene el ancho calculado o configurado de un nodo. */
  getNodeWidth(node: UmlClassNode): number {
    const diagType = typeof this.activeDiagramType === 'function' ? this.activeDiagramType() : undefined;
    return this.metrics.getNodeWidth(node, diagType);
  }

  /** Obtiene la altura calculada o configurada de un nodo. */
  getNodeHeight(node: UmlClassNode): number {
    const diagType = typeof this.activeDiagramType === 'function' ? this.activeDiagramType() : undefined;
    return this.metrics.getNodeHeight(node, diagType);
  }

  /** Obtiene las dimensiones compuestas (ancho y alto) de un nodo. */
  getNodeSize(node: UmlClassNode): { width: number; height: number } {
    const diagType = typeof this.activeDiagramType === 'function' ? this.activeDiagramType() : undefined;
    return this.geometryService.getNodeSize(node, diagType);
  }

  /**
   * Determina si un nodo admite redimensión manual interactiva en el diagrama actual.
   * Delega en el plugin del nodo si define `isResizable`, o permite redimensión por defecto.
   */
  isNodeResizable(node: UmlClassNode): boolean {
    if (node.isAnchor) return false;
    if (this.isReadOnly() || this.isNodeLockedByOther(node.id)) return false;
    const diagType = typeof this.activeDiagramType === 'function' ? this.activeDiagramType() : undefined;
    const geometry = this.nodePlugins?.forNode(node)?.geometry;
    if (geometry?.isResizable) {
      return geometry.isResizable(node, diagType);
    }
    return true;
  }

  /** Obtiene el ancho mínimo permitido de un nodo en el contexto actual. */
  getNodeMinWidth(node: UmlClassNode): number {
    const diagType = typeof this.activeDiagramType === 'function' ? this.activeDiagramType() : undefined;
    const geometry = this.nodePlugins?.forNode(node)?.geometry;
    if (geometry?.isResizable && !geometry.isResizable(node, diagType)) {
      return this.getNodeWidth(node);
    }
    return geometry?.minWidth ?? 50;
  }

  /** Obtiene la altura mínima permitida de un nodo en el contexto actual. */
  getNodeMinHeight(node: UmlClassNode): number {
    const diagType = typeof this.activeDiagramType === 'function' ? this.activeDiagramType() : undefined;
    const geometry = this.nodePlugins?.forNode(node)?.geometry;
    if (geometry?.isResizable && !geometry.isResizable(node, diagType)) {
      return this.getNodeHeight(node);
    }
    return geometry?.minHeight ?? 50;
  }

  /** Calcula el índice de apilamiento visual (z-index) según el tipo de nodo y estado de selección. */
  getNodeZIndex(node: UmlClassNode): number { return this.geometryService.getNodeZIndex(node, this.isNodeSelected(node.id)); }

  /** Obtiene la distancia vertical para el conector inferior de nodos especiales (como líneas de vida). */
  getBottomConnectorOffset(node: UmlClassNode): number { return this.geometryService.getBottomConnectorOffset(node); }

  /** Obtiene la configuración de renderizado SVG para los marcadores de flecha/diamante de la relación. */
  getMarkerConfig(relationType: UmlRelationshipType | string | null | undefined, isStartDiamond = false): UmlMarkerConfig {
    return this.geometryService.getMarkerConfig(relationType, isStartDiamond);
  }

  /** Determina si la relación requiere un diamante en el extremo inicial (agregación o composición). */
  isDiamondAtStart(conn: UmlConnection): boolean { return this.geometryService.isDiamondAtStart(conn); }

  /** Comprueba si la conexión representa un mensaje en un diagrama de secuencia. */
  isSequenceConnection(conn: UmlConnection): boolean { return this.geometryService.isSequenceConnection(conn, this.activeDiagramType()); }

  /** Determina si la conexión es un auto-enlace o relación recursiva que conecta un nodo consigo mismo. */
  isRecursiveConn(conn: UmlConnection): boolean { return this.geometryService.isRecursiveConn(conn); }

  /** Determina si la conexión utiliza anclaje flotante magnético entre centros de nodos. */
  isFloatingConn(conn: UmlConnection): boolean { return this.geometryService.isFloatingConn(conn); }

  /** Comprueba si la conexión en un diagrama de secuencia corresponde a un mensaje de respuesta (reply). */
  isReplyConnection(conn: UmlConnection): boolean { return this.sequenceActivationService?.isReplyConnection(conn) ?? false; }

  /** Resuelve el lado de conexión ('top', 'bottom', 'left', 'right') a partir del identificador del conector. */
  getConnSide(connectorId: string | undefined, defaultSide: 'top' | 'right' | 'bottom' | 'left' = 'right'): 'top' | 'right' | 'bottom' | 'left' {
    return this.geometryService.getConnSide(connectorId, defaultSide);
  }

  /** Comprueba si una conexión de secuencia es un automensaje (sobre la misma línea de vida). */
  isSequenceSelfConnection(conn: UmlConnection): boolean {
    return this.isSequenceConnection(conn) && (this.isRecursiveConn(conn) || conn.type === 'self');
  }

  /**
   * Resuelve el tipo de trazado de Foblex ('segment', 'straight', 'bezier', 'adaptive-curve', 'lateral', 'sequence', 'sequence_self') para una conexión existente.
   * @param conn Conexión evaluada.
   * @returns Tipo de renderizado de la arista.
   */
  getConnectionType(
    conn: UmlConnection,
  ):
    | 'segment'
    | 'straight'
    | 'bezier'
    | 'adaptive-curve'
    | typeof LATERAL_CONNECTION_TYPE
    | typeof SEQUENCE_CONNECTION_TYPE
    | typeof SEQUENCE_SELF_CONNECTION_TYPE {
    if (this.isSequenceConnection(conn)) {
      return this.isSequenceSelfConnection(conn)
        ? SEQUENCE_SELF_CONNECTION_TYPE
        : SEQUENCE_CONNECTION_TYPE;
    }
    const style = sanitizeLineStyle(conn?.lineStyle, this.defaultLineStyle() || 'orthogonal_square');
    switch (style) {
      case 'straight':
        return 'straight';
      case 'bezier':
        return 'bezier';
      case 'orthogonal_rounded':
      case 'adaptive-curve':
        return 'adaptive-curve';
      case 'orthogonal_square':
      case 'segment':
      case 'tree_vertical':
      case 'lateral_vertical':
      case 'lateral_horizontal':
        return LATERAL_CONNECTION_TYPE;
      case 'tree_horizontal':
      default:
        return 'segment';
    }
  }

  /**
   * Obtiene el radio de curvatura en las esquinas ortogonales redondeadas de una conexión.
   * @param conn Conexión evaluada.
   * @returns Radio de curvatura en píxeles.
   */
  getConnectionRadius(conn: UmlConnection): number {
    const style = sanitizeLineStyle(conn?.lineStyle, this.defaultLineStyle() || 'orthogonal_square');
    if (style === 'orthogonal_rounded' || style === 'adaptive-curve') {
      return 14;
    }
    return 0;
  }

  /**
   * Determina el tipo de trazado de Foblex a utilizar durante el proceso de creación interactiva de una arista.
   * @returns Tipo de línea para la conexión en curso.
   */
  getConnectionTypeForCreate(): 'segment' | 'straight' | 'bezier' | 'adaptive-curve' | typeof LATERAL_CONNECTION_TYPE {
    const style = sanitizeLineStyle(this.defaultLineStyle() || 'orthogonal_square');
    switch (style) {
      case 'straight':
        return 'straight';
      case 'bezier':
        return 'bezier';
      case 'orthogonal_rounded':
      case 'adaptive-curve':
        return 'adaptive-curve';
      case 'orthogonal_square':
      case 'segment':
      case 'tree_vertical':
      case 'lateral_vertical':
      case 'lateral_horizontal':
        return LATERAL_CONNECTION_TYPE;
      case 'tree_horizontal':
      default:
        return 'segment';
    }
  }

  /**
   * Obtiene el radio de curvatura para la conexión en curso durante el trazado interactivo.
   * @returns Radio en píxeles.
   */
  getConnectionRadiusForCreate(): number {
    const style = sanitizeLineStyle(this.defaultLineStyle() || 'orthogonal_square');
    if (style === 'orthogonal_rounded' || style === 'adaptive-curve') {
      return 14;
    }
    return 0;
  }

  /**
   * Conector de origen usado para renderizar la arista. En los estilos laterales se ancla al
   * puerto central del lado calculado (p. ej. `_bottom`) para que el codo salga del centro
   * de ese lado y no del puerto lateral guardado en la conexión.
   */
  getConnectionOutputId(conn: UmlConnection): string {
    if (!this.usesWholeNodeAnchor(conn)) return conn.sourceId;
    const base = conn.sourceNodeId || this.stripSidePort(conn.sourceId);
    return `${base}_${this.getConnectionOutputSide(conn)}`;
  }

  /** Conector de destino usado para renderizar la arista (ver {@link getConnectionOutputId}). */
  getConnectionInputId(conn: UmlConnection): string {
    if (!this.usesWholeNodeAnchor(conn)) return conn.targetId;
    const base = conn.targetNodeId || this.stripSidePort(conn.targetId);
    return `${base}_${this.getConnectionInputSide(conn)}`;
  }

  /** Indica si la arista lateral debe anclarse a los puertos centrales de los lados calculados. */
  private usesWholeNodeAnchor(conn: UmlConnection): boolean {
    if (!conn || this.isRecursiveConn(conn) || this.isSequenceConnection(conn)) return false;
    const style = sanitizeLineStyle(conn.lineStyle, this.defaultLineStyle() || 'orthogonal_square');
    if (style !== 'lateral_vertical' && style !== 'lateral_horizontal') return false;
    const isSlot = (id: string | undefined) => !id || /_slot_\d+$/.test(id);
    return !isSlot(conn.sourceId) && !isSlot(conn.targetId);
  }

  /** Elimina el sufijo de puerto lateral (`_bottom`, `_right_start`, …) de un identificador de conector. */
  private stripSidePort(connectorId: string): string {
    return connectorId.replace(/_(top|right|bottom|left)(_start|_end)?$/, '');
  }

  /**
   * Determina si la conexión debe comportarse como flotante (magnética al centro) o anclada fijamente a un puerto.
   * @param conn Conexión a evaluar.
   * @returns Comportamiento 'floating' o 'fixed'.
   */
  getConnectionBehavior(conn: UmlConnection): 'floating' | 'fixed' {
    if (this.isRecursiveConn(conn)) return 'fixed';
    // Los estilos laterales necesitan anclar en el centro del lado calculado (codo en L);
    // el modo flotante ignora los lados y recorta sobre la línea entre centros.
    const style = sanitizeLineStyle(conn?.lineStyle, this.defaultLineStyle() || 'orthogonal_square');
    if (style === 'lateral_vertical' || style === 'lateral_horizontal') return 'fixed';
    return this.isFloatingConn(conn) ? 'floating' : 'fixed';
  }

  /**
   * Determina el lado de salida ('top', 'right', 'bottom', 'left' o 'default') para el extremo origen de la conexión.
   * @param conn Conexión evaluada.
   * @returns Lado de salida de la arista.
   */
  getConnectionOutputSide(conn: UmlConnection): 'default' | 'top' | 'right' | 'bottom' | 'left' {
    if (this.isSequenceConnection(conn)) {
      if (this.isSequenceSelfConnection(conn)) {
        return 'right';
      }
      return this.geometryService.getTreeHorizontalSourceSide(conn, this.nodes());
    }
    if (this.isRecursiveConn(conn)) {
      return this.getConnSide(conn.sourceId, 'top');
    }
    const style = sanitizeLineStyle(conn?.lineStyle, this.defaultLineStyle() || 'orthogonal_square');
    if (style === 'tree_vertical') {
      return this.geometryService.getTreeVerticalSourceSide(conn, this.nodes());
    }
    if (style === 'tree_horizontal') {
      return this.geometryService.getTreeHorizontalSourceSide(conn, this.nodes());
    }
    if (style === 'lateral_vertical') {
      return this.geometryService.getLateralVerticalSourceSide(conn, this.nodes());
    }
    if (style === 'lateral_horizontal') {
      return this.geometryService.getLateralHorizontalSourceSide(conn, this.nodes());
    }
    if (this.isFloatingConn(conn)) {
      return 'default';
    }
    return this.getConnSide(conn.sourceId, 'right');
  }

  /**
   * Determina el lado de entrada ('top', 'right', 'bottom', 'left' o 'default') para el extremo destino de la conexión.
   * @param conn Conexión evaluada.
   * @returns Lado de entrada de la arista.
   */
  getConnectionInputSide(conn: UmlConnection): 'default' | 'top' | 'right' | 'bottom' | 'left' {
    if (this.isSequenceConnection(conn)) {
      if (this.isSequenceSelfConnection(conn)) {
        return 'right';
      }
      return this.geometryService.getTreeHorizontalTargetSide(conn, this.nodes());
    }
    if (this.isRecursiveConn(conn)) {
      return this.getConnSide(conn.targetId, 'right');
    }
    const style = sanitizeLineStyle(conn?.lineStyle, this.defaultLineStyle() || 'orthogonal_square');
    if (style === 'tree_vertical') {
      return this.geometryService.getTreeVerticalTargetSide(conn, this.nodes());
    }
    if (style === 'tree_horizontal') {
      return this.geometryService.getTreeHorizontalTargetSide(conn, this.nodes());
    }
    if (style === 'lateral_vertical') {
      return this.geometryService.getLateralVerticalTargetSide(conn, this.nodes());
    }
    if (style === 'lateral_horizontal') {
      return this.geometryService.getLateralHorizontalTargetSide(conn, this.nodes());
    }
    if (this.isFloatingConn(conn)) {
      return 'default';
    }
    return this.getConnSide(conn.targetId, 'left');
  }

  /** Calcula el ángulo de inclinación de un conector de ensamblado/socket en diagramas de componentes. */
  getAssemblyAngle(conn: UmlConnection): number {
    return this.geometryService.getAssemblyAngle(conn, this.nodes(), this.boardElementRef?.nativeElement);
  }

  /** Determina si se deben renderizar etiquetas de multiplicidad para la conexión en el tipo de diagrama actual. */
  shouldShowMultiplicity(conn: UmlConnection): boolean {
    return this.geometryService.shouldShowMultiplicity(conn, this.activeDiagramType());
  }

  /** Obtiene el color visual correspondiente a un mensaje en un diagrama de secuencia. */
  getSequenceConnColor(conn: UmlConnection): string { return this.geometryService.getSequenceConnColor(conn); }

  /** Calcula la transformación CSS interactiva al arrastrar un mensaje en un diagrama de secuencia. */
  getSequenceMessageTransform(conn: UmlConnection): string {
    return this.geometryService.getSequenceMessageTransform(
      conn,
      this.isDraggingSeqMessage(),
      this.draggingSeqMessageConnId(),
      this.draggingSeqMessageDeltaY(),
    );
  }

  /** Determina si el mensaje es el iniciador de un grupo secuencial en diagramas de comunicación. */
  isGroupInitiator(conn: UmlConnection): boolean { return this.geometryService.isGroupInitiator(conn); }

  /** Obtiene la cantidad de mensajes que conforman el grupo de comunicación. */
  getGroupMemberCount(conn: UmlConnection): number { return this.geometryService.getGroupMemberCount(conn, this.connections()); }

  /** Comprueba si la conexión posee mensajes dirigidos en sentido hacia adelante. */
  hasForwardMessages(conn: UmlConnection): boolean { return this.geometryService.hasForwardMessages(conn); }

  /** Obtiene los mensajes en sentido hacia adelante asociados a la conexión. */
  getForwardMessages(conn: UmlConnection): UmlMessage[] { return this.geometryService.getForwardMessages(conn); }

  /** Comprueba si la conexión posee mensajes dirigidos en sentido inverso. */
  hasReverseMessages(conn: UmlConnection): boolean { return this.geometryService.hasReverseMessages(conn); }

  /** Obtiene los mensajes en sentido inverso asociados a la conexión. */
  getReverseMessages(conn: UmlConnection): UmlMessage[] { return this.geometryService.getReverseMessages(conn); }

  /** Obtiene el color de resalte para un mensaje de comunicación según su número de secuencia. */
  getCommMessageColor(msg: UmlMessage): string { return this.geometryService.getCommMessageColor(msg); }

  /** Obtiene la transformación CSS de desplazamiento de la etiqueta flotante de un nodo. */
  getLabelTransform(node: UmlClassNode): string { return this.geometryService.getLabelTransform(node); }

  /** Comprueba si el nodo posee un desplazamiento manual aplicado a su etiqueta de texto. */
  hasLabelOffset(node: UmlClassNode): boolean { return this.geometryService.hasLabelOffset(node); }

  // --- SELECCIÓN Y BLOQUEOS COLABORATIVOS ---

  /** Obtiene el bloqueo colaborativo activo sobre el nodo especificado. */
  getNodeLock(nodeId: string): NodeLock | undefined { return this.nodeLocks()?.get(nodeId); }

  /** Comprueba si el nodo está bloqueado por otro usuario concurrente. */
  isNodeLockedByOther(nodeId: string): boolean {
    const lock = this.getNodeLock(nodeId);
    return !!lock && lock.userId !== this.currentUserId();
  }

  /** Verifica si un nodo se encuentra directamente en la lista de selección activa. */
  isNodeSelected(nodeId: string): boolean { return this.selectedNodeIds().includes(nodeId); }

  /** Comprueba si una conexión está directamente seleccionada. */
  isConnectionDirectlySelected(connId: string): boolean {
    return this.selectedConnIds().includes(connId);
  }

  /** Comprueba si una conexión está seleccionada por efecto cascada debido a la selección de su nodo principal. */
  isConnectionCascadeSelected(connId: string): boolean {
    const primaryNode = this.selectedNodeIds().length === 1 ? this.selectedNodeIds()[0] : null;
    return this.cascadeRules?.isConnectionSelected(connId, this.connections(), primaryNode) ?? false;
  }
  /** Determina si una conexión está seleccionada (directamente o por propagación en cascada). */
  isConnectionSelected(connId: string): boolean {
    return this.isConnectionDirectlySelected(connId) || this.isConnectionCascadeSelected(connId);
  }

  /** Determina si una conexión debe atenuarse visualmente porque no pertenece a la selección activa. */
  isConnectionDimmed(connId: string): boolean {
    const ids = this.selectedNodeIds();
    return this.cascadeRules?.isConnectionDimmed(connId, this.connections(), ids[0] || null, ids.length > 1) ?? false;
  }

  /** Comprueba si el nodo es vecino directo de los nodos seleccionados. */
  isNeighborNode(nodeId: string): boolean {
    const ids = this.selectedNodeIds();
    return this.cascadeRules?.isNeighborNode(nodeId, this.connections(), ids[0] || null, ids.length > 1) ?? false;
  }

  /**
   * Detecta la conexión más cercana a un punto de la pantalla dentro de un radio de tolerancia magnética.
   * Utiliza sondeo radial subpíxel sobre los trazados SVG de @foblex/flow emulando la precisión de Konva.
   */
  findClosestConnectionAtClientPoint(clientX: number, clientY: number, maxDistancePx: number = 28): string | null {
    if (typeof document === 'undefined' || typeof document.elementsFromPoint !== 'function') {
      return null;
    }

    const testPoint = (x: number, y: number): string | null => {
      const elements = document.elementsFromPoint(x, y);
      for (const el of elements) {
        if (el.closest('[fNode]')) {
          return null; // Prioridad al nodo si el cursor cae sobre él
        }
        const connEl = el.closest('.f-connection');
        if (connEl) {
          const connId =
            connEl.getAttribute('data-connection-id') ||
            connEl.getAttribute('fConnectionId') ||
            connEl.id;
          if (connId) return connId;
        }
      }
      return null;
    };

    // 1. Sondeo directo en el punto del cursor
    const directHit = testPoint(clientX, clientY);
    if (directHit) return directHit;

    // 2. Sondeo radial magnético concéntrico (14px y maxDistancePx en 8 cuadrantes)
    const probeRadii = [14, maxDistancePx];
    const angles = [
      0,
      Math.PI / 4,
      Math.PI / 2,
      (3 * Math.PI) / 4,
      Math.PI,
      (5 * Math.PI) / 4,
      (3 * Math.PI) / 2,
      (7 * Math.PI) / 4,
    ];

    for (const r of probeRadii) {
      for (const theta of angles) {
        const px = clientX + Math.round(r * Math.cos(theta));
        const py = clientY + Math.round(r * Math.sin(theta));
        const hit = testPoint(px, py);
        if (hit) return hit;
      }
    }

    return null;
  }

  // --- MANEJADORES DE EVENTOS DE NODOS Y CONEXIONES ---

  /** Emite el evento de carga completa del motor de flujo Foblex. */
  onFlowLoaded(): void { this.flowLoaded.emit(); }

  /** Emite la creación de una nueva conexión trazada por el usuario. */
  onConnectionCreated(event: FCreateConnectionEvent): void { this.connectionCreated.emit(event); }

  /** Emite la reasignación de un extremo de una conexión existente hacia otro puerto. */
  onConnectionReassigned(event: FReassignConnectionEvent): void { this.connectionReassigned.emit(event); }

  /** Emite la notificación de desplazamiento espacial de nodos en el lienzo. */
  onMoveNodes(event: FMoveNodesEvent): void { this.moveNodes.emit(event); }

  /** Emite cambios en los elementos seleccionados en el diagrama. */
  onSelectionChange(event: FSelectionChangeEvent): void {
    if (!this.interactionDisabled()) this.selectionChange.emit(event);
  }

  /** Emite eventos de desplazamiento (scroll) dentro del contenedor del viewport. */
  onViewportScroll(event: Event): void { this.viewportScroll.emit(event); }

  /**
   * Gestiona el evento mousedown en el lienzo, iniciando paneo con botón central o tecla espacio.
   * @param event Evento MouseEvent capturado.
   */
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
  /**
   * Gestiona el movimiento del ratón sobre el lienzo, actualizando punteros interactivos, paneos y detección magnética.
   * @param event Evento MouseEvent capturado.
   */
  onCanvasMouseMove(event: MouseEvent): void {
    if (this.selectedSourceNodeId()) {
      const pos = this.clientToCanvasPosition(event.clientX, event.clientY);
      this.livePointerPos.set(pos);
    } else if (this.livePointerPos() !== null) {
      this.livePointerPos.set(null);
    }
    if (!this.selectedRelationType() && !this.isPanning() && !this.isSpacePressed()) {
      const nearConnId = this.findClosestConnectionAtClientPoint(event.clientX, event.clientY, 22);
      if (nearConnId !== this.hoveredConnectionId()) {
        this.hoveredConnectionId.set(nearConnId);
      }
    } else if (this.hoveredConnectionId()) {
      this.hoveredConnectionId.set(null);
    }
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

  /**
   * Gestiona el clic sobre el fondo del lienzo o redirige a selección de conexiones cercanas por tolerancia magnética.
   * @param event Evento MouseEvent.
   */
  onCanvasBackgroundClick(event: MouseEvent): void {
    if (this.selectedRelationType() !== null) return;
    const nearConnId = this.findClosestConnectionAtClientPoint(event.clientX, event.clientY, 28);
    if (nearConnId) {
      event.stopPropagation();
      this.onConnectionClick(nearConnId, event);
      return;
    }
    this.canvasBackgroundClick.emit(event);
  }

  /** Gancho para capturar pointerdown directamente en el componente flow. */
  onFlowPointerDown(_event: PointerEvent): void {}

  /** Gancho para capturar clic directamente en el componente flow. */
  onFlowClick(_event: MouseEvent): void {}

  /** Gancho para capturar doble clic directamente en el componente flow. */
  onFlowDblClick(_event: MouseEvent): void {}

  /**
   * Sincroniza la escala de zoom interna cuando el motor de canvas de Foblex emite cambios.
   * @param event Objeto con el nuevo factor de escala.
   */
  onCanvasChange(event?: { scale?: number }): void {
    if (event?.scale != null) {
      const nextZoom = Math.round(event.scale * 100);
      if (nextZoom !== this.zoomLevel()) {
        this.zoomLevel.set(nextZoom);
        this.zoomChange.emit(nextZoom);
      }
    }
  }

  /** Gancho reservado para cambios de tamaño de nodo. */
  onNodeSizeChange(_node: UmlClassNode, _rect: unknown): void {}

  /**
   * Emite el cambio de posición de un nodo cuando el usuario lo arrastra por el lienzo.
   * @param node Nodo UML modificado.
   * @param newPosition Nuevas coordenadas en el plano del lienzo.
   */
  onNodePositionChange(node: UmlClassNode, newPosition: { x: number; y: number }): void {
    this.nodePositionChange.emit({ node, newPosition });
  }

  /**
   * Limpia el estado de hovering cuando el puntero abandona los límites del nodo.
   * @param nodeId Identificador del nodo.
   */
  onNodeMouseLeave(nodeId: string): void {
    if (this.hoveredNodeId() === nodeId) this.hoveredNodeId.set(null);
  }

  /**
   * Emite el evento de clic simple sobre un nodo si no se estaba arrastrando su etiqueta.
   * @param nodeId Identificador del nodo pulsado.
   * @param event Evento MouseEvent.
   */
  onNodeClick(nodeId: string, event: MouseEvent): void {
    if (this.isDraggingLabel()) return;
    this.nodeClick.emit({ nodeId, event });
  }

  /**
   * Emite el evento de doble clic sobre un nodo para abrir su diálogo de edición.
   * @param node Nodo UML pulsado.
   * @param event Evento MouseEvent.
   */
  onNodeDblClick(node: UmlClassNode, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.isReadOnly() && !this.isNodeLockedByOther(node.id)) {
      this.nodeDblClick.emit({ node, event });
    }
  }

  /**
   * Despliega el menú contextual propio para un nodo UML.
   * @param node Nodo receptor del clic derecho.
   * @param event Evento del ratón.
   */
  onNodeContextMenu(node: UmlClassNode, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.nodeContextMenu.emit({ node, event });
  }

  /**
   * Emite la solicitud de eliminación de un nodo si no está bloqueado por otro usuario.
   * @param nodeId Identificador del nodo a eliminar.
   * @param event Evento de clic.
   */
  onDeleteNode(nodeId: string, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.isReadOnly() && !this.isNodeLockedByOther(nodeId)) {
      this.deleteNode.emit({ nodeId, event });
    }
  }

  /**
   * Emite el clic sobre la tabla interna de atributos o métodos de una clase.
   * @param nodeId Identificador del nodo.
   * @param event Evento del ratón.
   */
  onTableClick(nodeId: string, event: MouseEvent): void {
    this.tableClick.emit({ nodeId, event });
  }

  /** Detiene la propagación del pointerdown en una conexión para evitar deselecciones accidentales. */
  onConnectionPointerDown(_connId: string, event: PointerEvent): void {
    event.stopPropagation();
  }

  /**
   * Emite la selección de una conexión al hacer clic sobre ella.
   * @param connId Identificador de la conexión pulsada.
   * @param event Evento MouseEvent.
   */
  onConnectionClick(connId: string, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.isDraggingSeqMessage()) {
      this.connectionClick.emit({ connId, event });
    }
  }

  /**
   * Emite el evento de doble clic sobre una relación para abrir su modal de edición.
   * @param conn Objeto de conexión pulsado.
   * @param event Evento MouseEvent.
   */
  onConnectionDblClick(conn: UmlConnection, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.isReadOnly()) {
      this.connectionDblClick.emit({ conn, event });
    }
  }
  /**
   * Despliega el menú contextual propio para una relación o conexión seleccionada.
   * @param conn Conexión UML receptora del clic secundario.
   * @param event Evento MouseEvent.
   */
  onConnectionContextMenu(conn: UmlConnection, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.connectionContextMenu.emit({ conn, event });
  }

  /**
   * Despliega el menú contextual global del lienzo, detectando conexiones magnéticas o emitiendo opciones del fondo.
   * @param event Evento MouseEvent.
   */
  onCanvasContextMenu(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target?.closest('[fNode]')) return;

    const nearConnId = this.findClosestConnectionAtClientPoint(event.clientX, event.clientY, 28);
    if (nearConnId) {
      event.preventDefault();
      event.stopPropagation();
      const conn = this.connections().find((c) => c.id === nearConnId);
      if (conn) {
        this.onConnectionContextMenu(conn, event);
        return;
      }
    }

    if (target?.closest('.f-connection')) return;
    event.preventDefault();
    const canvasPos = this.clientToCanvasPosition(event.clientX, event.clientY);
    this.canvasContextMenu.emit({ event, canvasPos });
  }

  // --- RENOMBRADO EN LÍNEA, REDIMENSIONAMIENTO Y ARRASTRE ---

  /**
   * Inicia el modo de renombrado en línea para un nodo específico.
   * @param nodeId Identificador del nodo a renombrar.
   */
  startRenameNode(nodeId: string): void {
    if (this.isReadOnly() || this.isNodeLockedByOther(nodeId)) return;
    this.renamingNodeId.set(nodeId);
    this.cdr.markForCheck();
  }

  /**
   * Inicia el renombrado de un nodo al recibir un doble clic sobre su etiqueta.
   * @param node Nodo UML involucrado.
   * @param event Evento MouseEvent.
   */
  onLabelDblClick(node: UmlClassNode, event: MouseEvent): void {
    event.stopPropagation();
    this.startRenameNode(node.id);
  }

  /**
   * Confirma y emite el nuevo nombre asignado al nodo tras completar la edición en línea.
   * @param nodeId Identificador del nodo.
   * @param newName Nombre definitivo asignado.
   */
  commitNodeRename(nodeId: string, newName: string): void {
    this.renamingNodeId.set(null);
    const trimmed = newName.trim();
    if (trimmed) this.nodeRename.emit({ nodeId, newName: trimmed });
  }

  /** Cancela la edición en línea del nombre del nodo. */
  cancelNodeRename(): void {
    this.renamingNodeId.set(null);
  }

  /**
   * Restablece el desplazamiento personalizado de la etiqueta del nodo a su posición por defecto.
   * @param node Nodo UML modificado.
   * @param event Evento MouseEvent.
   */
  resetLabelOffset(node: UmlClassNode, event: MouseEvent): void {
    event.stopPropagation();
    if (this.isReadOnly()) return;
    node.labelOffset = { x: 0, y: 0 };
    this.nodeLabelOffsetChange.emit({ node, offset: { x: 0, y: 0 } });
  }

  /**
   * Inicia el arrastre interactivo de la etiqueta de texto flotante de un nodo.
   * @param node Nodo UML contenedor de la etiqueta.
   * @param event Evento PointerEvent.
   */
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

  /**
   * Inicia el redimensionamiento del nodo a través de uno de sus controles de borde o esquina.
   * @param node Nodo UML que se va a redimensionar.
   * @param handleType Identificador del tirador ('top-left', 'bottom-right', etc.).
   * @param event Evento PointerEvent inicial.
   */
  onResizeHandlePointerDown(node: UmlClassNode, handleType: string, event: PointerEvent): void {
    if (this.isReadOnly() || this.isNodeLockedByOther(node.id) || !this.isNodeResizable(node)) return;
    const scale = this.canvas?.transform?.scale || this.zoomLevel() / 100 || 1;
    this.nodeResizeService.startResize({
      event,
      node,
      handleType,
      scale,
      initialWidth: this.getNodeWidth(node),
      initialHeight: this.getNodeHeight(node),
      dynamicNodeWidthFn: (n) => this.metrics.getDynamicNodeWidth(n),
      cdr: this.cdr,
      onRedraw: () => this.flow?.redraw(),
      onComplete: (result) => this.nodeSizeChange.emit(result),
    });
  }

  /**
   * Inicia el desplazamiento vertical interactivo de un mensaje en el diagrama de secuencia.
   * @param conn Conexión que representa el mensaje.
   * @param event Evento PointerEvent.
   */
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

  /**
   * Gestiona el evento dragover sobre el lienzo al arrastrar elementos desde el explorador o toolbox.
   * @param event Evento DragEvent.
   */
  onCanvasDragOver(event: DragEvent): void {
    if (this.isReadOnly()) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    if (!this.isDragOverCanvas()) this.isDragOverCanvas.set(true);
  }

  /**
   * Limpia el indicador visual de arrastre cuando el puntero sale de la superficie del lienzo.
   * @param event Evento DragEvent.
   */
  onCanvasDragLeave(event: DragEvent): void {
    const related = event.relatedTarget as Node | null;
    const container = this.flowContainerRef?.nativeElement;
    if (container && related && container.contains(related)) return;
    this.isDragOverCanvas.set(false);
  }

  /**
   * Procesa el evento de soltar (drop) un nodo o herramienta externa sobre el área de trabajo.
   * @param event Evento DragEvent.
   */
  onCanvasDrop(event: DragEvent): void {
    this.isDragOverCanvas.set(false);
    if (this.isReadOnly()) return;
    event.preventDefault();
    const scale = this.canvas?.transform?.scale || this.zoomLevel() / 100 || 1;
    const parsed = this.dragService.parseCanvasDropEvent(event, this.boardElementRef?.nativeElement, scale);
    if (parsed) this.nodeDropped.emit(parsed);
  }

  /**
   * Transforma coordenadas de pantalla de cliente a coordenadas espaciales relativas al lienzo UML.
   * @param clientX Coordenada horizontal de la ventana.
   * @param clientY Coordenada vertical de la ventana.
   * @returns Punto transformado { x, y } dentro del espacio de coordenadas del diagrama.
   */
  clientToCanvasPosition(clientX: number, clientY: number): { x: number; y: number } {
    const scale = this.canvas?.transform?.scale || this.zoomLevel() / 100 || 1;
    return this.dragService.clientToCanvasPosition(clientX, clientY, this.boardElementRef?.nativeElement, scale);
  }

  /**
   * Gestiona el zoom mediante la rueda del ratón manteniendo presionada la tecla Ctrl/Meta.
   * @param event Evento WheelEvent.
   */
  onContainerWheel(event: WheelEvent): void {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const delta = event.deltaY < 0 ? 10 : -10;
    this.setZoomPercent(this.zoomLevel() + delta);
  }

  /**
   * Aplica un nivel de zoom porcentual específico al lienzo y actualiza la directiva FZoom.
   * @param targetZoom Porcentaje de escala deseado (ej. 100, 150).
   */
  setZoomPercent(targetZoom: number): void {
    this.dragService.applyZoomLevel(
      targetZoom,
      this.canvas,
      this.zoomDirective,
      (z) => this.zoomLevel.set(z),
      (z) => this.zoomChange.emit(z),
    );
  }

  /**
   * Sincroniza la señal del nivel de zoom leyendo el valor directo de la matriz de transformación del canvas.
   */
  syncZoomFromCanvas(): void {
    const scale = this.canvas?.transform?.scale || 1;
    const pct = Math.round(scale * 100);
    this.zoomLevel.set(pct);
    this.zoomChange.emit(pct);
  }

  /** Aumenta el nivel de zoom en un 10%. */
  zoomIn(): void { this.setZoomPercent(this.zoomLevel() + 10); }

  /** Disminuye el nivel de zoom en un 10%. */
  zoomOut(): void { this.setZoomPercent(this.zoomLevel() - 10); }

  /** Restablece la vista al 100% de escala y centra el lienzo. */
  resetView(): void {
    this.setZoomPercent(100);
    this.centerViewportOnBoard();
  }

  /** Ajusta el zoom y desplazamiento para encuadrar todos los nodos del diagrama dentro de la pantalla visible. */
  fitView(): void {
    this.dragService.fitNodesInViewport(
      this.nodes(),
      this.flowContainerRef?.nativeElement,
      (z) => this.setZoomPercent(z),
    );
  }

  /** Centra el desplazamiento del contenedor sobre el origen del tablero. */
  centerViewportOnBoard(): void {
    const el = this.flowContainerRef?.nativeElement;
    if (el) {
      el.scrollLeft = 0;
      el.scrollTop = 0;
    }
  }

  /**
   * Restaura el desplazamiento previo de la vista almacenado en sessionStorage para el diagrama especificado.
   * @param diagramId Identificador del diagrama cargado.
   */
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

  /**
   * Aplica un estado visual previo de zoom y desplazamiento guardado.
   * @param state Objeto con zoom y coordenadas de scroll.
   */
  applyViewState(state: DiagramCanvasViewState): void {
    this.dragService.applyViewState(state, this.flowContainerRef?.nativeElement, (z) => this.setZoomPercent(z));
  }

  /** Solicita el redibujado forzado del motor de flujo Foblex y del canvas. */
  redraw(): void {
    this.flow?.redraw();
    this.canvas?.redraw();
    this.cdr.markForCheck();
  }

  /** Restablece el estado interno del componente de flujo. */
  reset(): void {
    this.flow?.reset();
    this.cdr.markForCheck();
  }

  /**
   * Selecciona programáticamente los nodos y conexiones indicados.
   * @param nodeIds Lista de identificadores de nodos.
   * @param connectionIds Lista opcional de identificadores de conexiones.
   */
  select(nodeIds: string[], connectionIds: string[] = []): void {
    this.flow?.select(nodeIds, connectionIds);
  }

  /** Limpia todas las selecciones en el motor de flujo. */
  clearSelection(): void { this.flow?.clearSelection(); }

  /**
   * Prepara temporalmente el lienzo para captura o exportación gráfica desactivando transformaciones,
   * y devuelve una función de restauración para recuperar el estado visual previo.
   * @returns Función de restauración del estado.
   */
  prepareForExport(): () => void {
    const canvas = this.canvas;
    if (!canvas?.transform) return () => {};
    const flow = this.getExportElement();
    const previousWidth = flow?.style.width;
    const previousHeight = flow?.style.height;
    if (flow) {
      // resetScale() coloca Foblex al 100 %, así que el área exportable usa medidas sin zoom.
      flow.style.width = `${Math.max(flow.clientWidth, computeBoardWidth(this.nodes(), this.connections(), this.activeDiagramType()))}px`;
      flow.style.height = `${Math.max(flow.clientHeight, computeBoardHeight(this.nodes(), this.connections(), this.activeDiagramType()))}px`;
    }

    const scale = canvas.transform.scale;
    const position = { ...canvas.transform.position };
    const scaledPosition = { ...canvas.transform.scaledPosition };
    const restore = () => {
      canvas.transform.scale = scale;
      canvas.transform.position = position;
      canvas.transform.scaledPosition = scaledPosition;
      if (flow) {
        flow.style.width = previousWidth || '';
        flow.style.height = previousHeight || '';
      }
      canvas.redraw();
    };

    try {
      canvas.resetScale();
      canvas.transform.position = { x: 0, y: 0 };
      canvas.transform.scaledPosition = { x: 0, y: 0 };
      canvas.redraw();
    } catch (error) {
      restore();
      throw error;
    }
    return restore;
  }

  /**
   * Obtiene la referencia al elemento HTML base utilizado para renderizar la captura o exportación visual.
   * @returns Elemento HTML del flujo o del contenedor del tablero.
   */
  getExportElement(): HTMLElement | undefined {
    const board = this.boardElementRef?.nativeElement;
    if (!board) return undefined;
    return (board.querySelector('f-flow') as HTMLElement) || board;
  }

  /**
   * Gestiona la pulsación de teclas globales en la ventana, habilitando el modo de paneo al mantener la barra espaciadora.
   * @param event Evento KeyboardEvent.
   */
  onWindowKeyDown(event: KeyboardEvent): void {
    if (this.interactionDisabled()) return;
    const tag = (document.activeElement?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    if (event.code === 'Space' && !this.isSpacePressed()) this.isSpacePressed.set(true);
  }

  /**
   * Gestiona la liberación de teclas en la ventana, deshabilitando el modo espaciador.
   * @param event Evento KeyboardEvent.
   */
  onWindowKeyUp(event: KeyboardEvent): void {
    if (event.code === 'Space') this.isSpacePressed.set(false);
  }

  /**
   * Finaliza la operación de paneo al soltar el botón del ratón en cualquier parte de la ventana.
   * @param _event Evento MouseEvent opcional.
   */
  onWindowMouseUp(_event?: MouseEvent): void {
    if (this.isPanning()) {
      this.isPanning.set(false);
    }
  }
}
