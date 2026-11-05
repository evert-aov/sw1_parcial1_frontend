import { RELATIONSHIP_RULES } from '../../../core/plugins/contracts/relationship-rules.contract';
import { PluginRegistryService } from '../../../core/plugins/plugin-registry.service';
import { PluginOutletDirective, PluginOutputEvent } from '../../../core/plugins/plugin-outlet.directive';
import {
  ChangeDetectionStrategy,
  ApplicationRef,
  EnvironmentInjector,
  Injector,
  createComponent,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import {
  FCanvasComponent,
  FCreateConnectionEvent,
  FMoveNodesEvent,
  FReassignConnectionEvent,
  FSelectionChangeEvent,
} from '@foblex/flow';
import { provideIcons } from '@ng-icons/core';
import { DIAGRAM_EDITOR_ICONS } from './diagram-editor.icons';
import { environment } from '../../../../environments/environment';
import {
  DiagramType,
  SaveDiagramAstRequest,
  UmlClassNode,
  UmlConnection,
  UmlLineStyle,
  UML_LINE_STYLES,
  sanitizeLineStyle,
  UmlMessage,
  UmlRelationshipType,
} from '../../../core/models/diagram.model';
import { Project, ProjectRole } from '../../../core/models/project.model';
import { AuthService } from '../../../core/services/auth.service';
import { CollaborationService, NodeLock } from '../../../core/services/collaboration.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { DiagramService } from '../../../core/services/diagram.service';
import { ProjectService } from '../../../core/services/project.service';
import { ThemeService } from '../../../core/services/theme.service';
import { ToastService } from '../../../core/services/toast.service';
import { XmiService } from '../../../core/plugins/contracts/xmi.service.contract';
import { AiAssistantCoordinator } from '../../../core/plugins/contracts/ai-assistant.service.contract';
import { TranslatePipe, TranslationService } from '../../../core/i18n/index';
import { CreateDiagramModalComponent } from './components/create-diagram-modal/create-diagram-modal.component';
import { DiagramAppbarComponent } from './components/diagram-appbar/diagram-appbar.component';
import { DiagramCanvasComponent } from './components/diagram-canvas/diagram-canvas.component';
import { DiagramContextMenuComponent } from './components/diagram-context-menu/diagram-context-menu.component';
import { DiagramSidebarComponent } from './components/diagram-sidebar/diagram-sidebar.component';
import { DiagramStatusbarComponent } from './components/diagram-statusbar/diagram-statusbar.component';
import { DiagramTabsComponent } from './components/diagram-tabs/diagram-tabs.component';
import { JsonModalComponent } from './components/json-modal/json-modal.component';
import { UserProfileModalComponent } from './components/user-profile-modal/user-profile-modal.component';
import {
  AlignmentDirection,
  DiagramDocumentSyncService,
  DiagramAlignmentService,
  DiagramAssemblyConnectionService,
  DiagramCanvasInteractionService,
  DiagramClipboardService,
  DiagramCollaborationCoordinatorService,
  DiagramConnectionLayoutService,
  DiagramConnectionOperationsService,
  DiagramContainmentService,
  DiagramContextMenuService,
  DiagramEditorContextUtil,
  DiagramExportService,
  DiagramHistoryService,
  DiagramHotkeysService,
  DiagramImportResult,
  DiagramImportService,
  DiagramModalService,
  DiagramNodeFactoryService,
  DiagramNodeOperationsService,
  DiagramNodeResizeService,
  DiagramPersistenceService,
  DiagramSelectionService,
  DiagramSequenceActivationService,
  DiagramTabManagerService,
  DiagramToolbarService,
  DiagramViewportService,
  DistributionDirection,
} from './services/index';
import { NodeMetricsService, computeBoardWidth, computeBoardHeight } from './utils/node-metrics.util';
import { resolveUserRoleInProject } from './utils/project-role.util';
import { UmlNodeNormalizerUtil } from '../../../core/plugins/contracts/uml-node-normalizer.util.contract';


/**
 * Componente principal del Editor de Diagramas UML.
 * Orquesta los servicios especializados de lienzo, persistencia, historial,
 * colaboración en tiempo real y sincronización con el asistente de IA.
 */
@Component({
  selector: 'app-diagram-editor',
  standalone: true,
  imports: [
    PluginOutletDirective,
    CommonModule,
    FormsModule,
    TranslatePipe,
    DiagramAppbarComponent,
    DiagramTabsComponent,
    DiagramSidebarComponent,
    DiagramCanvasComponent,
    DiagramStatusbarComponent,
    DiagramContextMenuComponent,
    JsonModalComponent,
    CreateDiagramModalComponent,
    UserProfileModalComponent,
  ],
  providers: [provideIcons(DIAGRAM_EDITOR_ICONS)],
  templateUrl: './diagram-editor.component.html',
  styleUrl: './diagram-editor.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:keydown)': 'onKeyDown($event)',
    '(window:mousedown)': 'onWindowMouseDown()',
    '(window:mouseup)': 'onWindowMouseUp()',
    '(window:beforeunload)': 'onBeforeUnload()',
  },
})
export class DiagramEditorComponent implements OnInit, OnDestroy {
  private readonly normalizer = inject(UmlNodeNormalizerUtil);
  private readonly metrics = inject(NodeMetricsService);
  /**
   * Procesa eventos emitidos por el plugin del modal de edición de nodo (guardar o cerrar).
   * @param event Evento de salida del plugin con nombre y valor.
   */
  onNodeEditorEvent(event: PluginOutputEvent): void {
    if (event.name === 'close') this.closeEditNodeModal();
    if (event.name === 'save') this.onSaveEditedNode(event.value as UmlClassNode);
  }

  /**
   * Procesa eventos emitidos por el plugin del modal de edición de relaciones (guardar, eliminar o cerrar).
   * @param event Evento de salida del plugin con nombre y valor.
   */
  onConnectionEditorEvent(event: PluginOutputEvent): void {
    if (event.name === 'close') this.closeEditConnModal();
    if (event.name === 'save') this.onSaveEditedConnection(event.value as UmlConnection);
    if (event.name === 'delete') this.removeConnection(event.value as string);
    if (event.name === 'applyStyleToAll') this.setAllConnectionsLineStyle(event.value as UmlLineStyle);
  }

  /**
   * Procesa eventos emitidos por el asistente de inteligencia artificial para mutar el diagrama o cerrar el panel.
   * @param event Evento de salida del plugin de IA.
   */
  onAiPluginEvent(event: PluginOutputEvent): void {
    if (event.name === 'closePanel') this.isAiPanelOpen.set(false);
    if (event.name === 'proposalApplied' && event.value === this.currentDiagramId() && !this.hasUnsavedChanges()) this.loadDiagram(event.value as string);
  }
  readonly plugins = inject(PluginRegistryService);
  private readonly relationshipRules = inject(RELATIONSHIP_RULES);
  readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  readonly cdr = inject(ChangeDetectorRef);
  readonly diagramService = inject(DiagramService);
  readonly projectService = inject(ProjectService);
  readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  readonly translationService = inject(TranslationService);
  readonly collaborationService = inject(CollaborationService);
  readonly confirmDialog = inject(ConfirmDialogService);

  /** Obtiene la instancia del servicio XMI si el plugin se encuentra registrado en el sistema. */
  get xmiService(): XmiService | null { return this.plugins.has(XmiService) ? this.plugins.resolve(XmiService) : null; }

  /** Obtiene el coordinador reactivo de Kanon cuando el plugin expone su capacidad real. */
  get aiCoordinator(): AiAssistantCoordinator | null {
    if (!this.plugins.has(AiAssistantCoordinator)) return null;
    const resolved = this.plugins.resolve(AiAssistantCoordinator) as Partial<AiAssistantCoordinator> | null;
    return typeof resolved?.observeDiagramSnapshot === 'function'
      ? (resolved as AiAssistantCoordinator)
      : null;
  }
  readonly toastService = inject(ToastService, { optional: true });

  readonly viewportService = inject(DiagramViewportService);
  readonly historyService = inject(DiagramHistoryService);
  readonly selectionService = inject(DiagramSelectionService);
  readonly clipboardService = inject(DiagramClipboardService);
  readonly alignmentService = inject(DiagramAlignmentService);
  readonly modalService = inject(DiagramModalService);
  readonly contextMenuService = inject(DiagramContextMenuService);
  readonly hotkeysService = inject(DiagramHotkeysService);
  readonly nodeFactory = inject(DiagramNodeFactoryService);
  readonly nodeResizeService = inject(DiagramNodeResizeService);
  readonly containmentService = inject(DiagramContainmentService);
  readonly assemblyConnectionService = inject(DiagramAssemblyConnectionService);
  readonly sequenceActivationService = inject(DiagramSequenceActivationService);
  readonly connectionLayoutService = inject(DiagramConnectionLayoutService);
  readonly documentSyncService = inject(DiagramDocumentSyncService);
  private readonly exportEnvironment = inject(EnvironmentInjector);
  private readonly exportInjector = inject(Injector);
  private readonly exportApplication = inject(ApplicationRef);
  readonly persistenceService = inject(DiagramPersistenceService);
  readonly exportService = inject(DiagramExportService);
  readonly importService = inject(DiagramImportService);
  readonly tabManager = inject(DiagramTabManagerService);
  readonly collabCoordinator = inject(DiagramCollaborationCoordinatorService);
  readonly nodeOps = inject(DiagramNodeOperationsService);
  readonly connectionOps = inject(DiagramConnectionOperationsService);
  readonly canvasInteraction = inject(DiagramCanvasInteractionService);
  readonly toolbarService = inject(DiagramToolbarService);

  @ViewChild(DiagramCanvasComponent) diagramCanvas?: DiagramCanvasComponent;

  /** Obtiene la referencia al lienzo FCanvasComponent subyacente. */
  get fCanvas(): FCanvasComponent | undefined {
    return this.diagramCanvas?.canvas;
  }

  /** Obtiene la referencia al elemento nativo de exportación del lienzo. */
  get canvasExportArea(): ElementRef<HTMLElement> | undefined {
    return this.diagramCanvas?.boardElementRef;
  }

  readonly DiagramType = DiagramType;
  readonly currentProjectId = signal<string | null>(null);
  readonly currentProject = signal<Project | null>(null);
  readonly currentDiagramId = signal<string | null>(null);
  readonly currentDiagramName = this.tabManager.currentDiagramName;
  readonly activeDiagramType = signal<DiagramType>(DiagramType.CLASS);
  readonly currentUserRole = signal<ProjectRole>('OWNER');
  readonly isReadOnly = computed(() => this.currentUserRole() === 'VIEWER');

  readonly nodes = signal<UmlClassNode[]>([]);
  readonly connections = signal<UmlConnection[]>([]);
  readonly defaultLineStyle = signal<UmlLineStyle>('segment');
  readonly selectedRelationType = signal<UmlRelationshipType | null>(null);
  readonly selectedSourceNodeId = signal<string | null>(null);
  readonly tempCursorPos = signal<{ x: number; y: number } | null>(null);

  readonly isSidebarOpen = signal<boolean>(true);
  readonly isLeftSidebarCollapsed = signal<boolean>(false);
  readonly isLeftToolbarCollapsed = signal<boolean>(false);
  readonly isAiPanelOpen = signal<boolean>(false);
  readonly toastMessage = signal<string>('');
  readonly isExportingXmi = signal<boolean>(false);
  readonly isImportingXmi = signal<boolean>(false);

  readonly zoomLevel = this.viewportService.zoomLevel;
  readonly openTabs = this.tabManager.openTabs;
  readonly projectDiagrams = this.diagramService.projectDiagrams;
  readonly hasUnsavedChanges = this.persistenceService.hasUnsavedChanges;
  readonly saveSuccessMessage = this.persistenceService.saveSuccessMessage;

  readonly selectedNodeId = this.selectionService.selectedNodeId;
  readonly selectedNodeIds = this.selectionService.selectedNodeIds;
  readonly selectedNodeIdsList = this.selectionService.selectedNodeIdsList;
  readonly selectedConnId = this.selectionService.selectedConnId;
  readonly selectedConnIds = this.selectionService.selectedConnIds;
  readonly selectedConnIdsList = this.selectionService.selectedConnIdsList;

  readonly hasMultipleActiveUsers = computed(() => this.collabCoordinator.isMultiUserEditing());
  readonly canUndo = computed(() => this.historyService.canUndo() && !this.isReadOnly());
  readonly canRedo = computed(() => this.historyService.canRedo() && !this.isReadOnly());
  readonly selectedNodeColor = computed(() =>
    this.toolbarService.computeSelectedNodeColor(
      this.selectedNodeId(),
      this.nodes(),
      (t, s) => this.getDefaultColorForNodeType(t, s),
    ),
  );
  readonly smartGuidesEnabled = this.toolbarService.smartGuidesEnabled;
  readonly isGridVisible = this.toolbarService.isGridVisible;

  readonly isEditNodeModalOpen = this.modalService.isEditNodeModalOpen;
  readonly editingNode = this.modalService.editingNode;
  readonly isEditConnModalOpen = this.modalService.isEditConnModalOpen;
  readonly editingConnection = this.modalService.editingConnection;
  readonly showJsonModal = this.modalService.showJsonModal;
  readonly jsonContent = this.modalService.jsonContent;
  readonly jsonModalMode = this.modalService.jsonModalMode;
  readonly isCreateDiagramModalOpen = this.modalService.isCreateDiagramModalOpen;
  readonly lockedDiagramType = this.modalService.lockedDiagramType;
  readonly createDiagramLockedType = this.modalService.lockedDiagramType;
  readonly showSpringBootModal = this.modalService.showSpringBootModal;
  readonly isProfileModalOpen = this.modalService.isProfileModalOpen;
  readonly isExportDropdownOpen = this.modalService.isExportDropdownOpen;
  readonly isAnyModalOpen = this.modalService.isAnyModalOpen;
  readonly contextMenu = this.contextMenuService.contextMenu;

  /** Callback enlazado para comprobar si un nodo está bloqueado por otro usuario. */
  readonly isNodeLockedFn = (nodeId: string): boolean => this.isNodeLockedByOther(nodeId);

  /** Callback enlazado para obtener la información del bloqueo activo de un nodo. */
  readonly getNodeLockFn = (nodeId: string): NodeLock | undefined =>
    this.collabCoordinator?.getNodeLock(nodeId);

  private subscriptions: Subscription[] = [];
  private handledAiOpenRequests = 0;

  /** Sincroniza instantáneas del diagrama con el motor de sugerencias y escucha aperturas del chat. */
  constructor() {
    this.handledAiOpenRequests = this.aiCoordinator?.openRequests() ?? 0;

    effect(() => {
      const diagramId = this.currentDiagramId();
      const diagramType = this.activeDiagramType();
      const nodes = this.nodes();
      const connections = this.connections();
      untracked(() => {
        this.aiCoordinator?.observeDiagramSnapshot(diagramId, diagramType, nodes, connections);
      });
    });

    effect(() => {
      const requests = this.aiCoordinator?.openRequests() ?? 0;
      if (requests <= this.handledAiOpenRequests) return;
      this.handledAiOpenRequests = requests;
      untracked(() => {
        this.isAiPanelOpen.set(true);
        this.deselectAll();
      });
    });

    effect(() => {
      const project = this.currentProject();
      if (!project) return;
      const count = project.memberCount ?? project.members?.length ?? 1;
      const hasMultiple = count > 1;
      untracked(() => {
        this.aiCoordinator?.setHasMultipleCollaborators(hasMultiple);
      });
    });

    effect(() => {
      const suggestion = this.aiCoordinator?.noteInsertionRequest();
      if (!suggestion) return;
      untracked(() => {
        this.addSuggestionAsFloatingNote(suggestion);
        this.aiCoordinator?.clearNoteInsertionRequest();
      });
    });
  }

  /** Inicializa suscripciones reactivas de ruta, auto-guardado y colaboración en tiempo real. */
  ngOnInit(): void {
    this.subscriptions.push(...DiagramEditorContextUtil.setupEditorSubscriptions(this));
  }

  /** Libera suscripciones, guarda estado pendiente y desconecta sesión colaborativa al destruir. */
  ngOnDestroy(): void {
    this.onBeforeUnload();
    this.aiCoordinator?.observeDiagramSnapshot(null, this.activeDiagramType(), [], []);
    this.subscriptions.forEach((s) => s.unsubscribe());
    this.collaborationService.disconnect();
  }

  /** Persiste cambios pendientes mediante `keepalive` antes de cerrar la pestaña del navegador. */
  onBeforeUnload(): void {
    this.persistenceService.flushExitSave({
      diagramId: this.currentDiagramId(),
      isReadOnly: this.isReadOnly(),
      hasUnsavedChanges: this.hasUnsavedChanges(),
      token: this.authService.token(),
      apiUrl: environment.apiUrl,
      payload: this.buildSaveAstPayload(),
      onSendDiagramSync: () => this.sendDiagramSync(this.nodes(), this.connections(), 'exit_save'),
    });
  }

  /** Resuelve el rol del usuario autenticado dentro del proyecto cargado. */
  resolveUserRole(project: Project | null, userId?: string | null): ProjectRole {
    return resolveUserRoleInProject(project, userId);
  }

  /** Suspende atajos del editor durante el chat y conserva Ctrl/Cmd+I para cerrar el panel. */
  onKeyDown(event: KeyboardEvent): void {
    if (this.isAiPanelOpen()) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'i') {
        event.preventDefault();
        this.toggleAiPanel();
      }
      return;
    }
    this.hotkeysService.handleKeyDown(event, DiagramEditorContextUtil.buildHotkeysActions(this));
  }

  /** Registra el inicio de clic global de puntero para control de arrastre. */
  onWindowMouseDown(): void {
    this.canvasInteraction.handleWindowMouseDown();
  }

  /** Finaliza estados de arrastre al soltar el botón del ratón. */
  onWindowMouseUp(): void { this.canvasInteraction.handleWindowMouseUp(); }

  /** Navega de regreso a la vista de proyectos o dashboard. */
  goBack(): void {
    const pid = this.currentProjectId();
    this.router.navigate(pid ? ['/projects', pid] : ['/dashboard']);
  }

  /** Cierra la sesión activa del usuario. */
  onLogout(): void { this.authService.logout(); }

  /** Alterna el colapso de la barra lateral izquierda de diagramas. */
  toggleLeftSidebar(): void { this.isLeftSidebarCollapsed.update((v) => !v); }

  /** Alterna el colapso de la caja de herramientas de elementos UML. */
  toggleLeftToolbar(): void { this.isLeftToolbarCollapsed.update((v) => !v); }

  /** Abre o cierra el chat y elimina selecciones y menús del lienzo antes de conversar. */
  toggleAiPanel(): void {
    this.isAiPanelOpen.update((value) => !value);
    if (this.isAiPanelOpen()) this.deselectAll();
  }

  /** Alterna las guías inteligentes de alineación magnética en el lienzo. */
  toggleSmartGuides(): void { this.toolbarService.toggleSmartGuides(); }
  toggleGrid(): void { this.toolbarService.toggleGrid(); }

  /** Alterna la apertura del menú desplegable de exportación. */
  toggleExportDropdown(event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.modalService.isExportDropdownOpen.update((v) => !v);
  }

  /** Cierra el menú desplegable de exportación. */
  closeExportDropdown(): void { this.modalService.isExportDropdownOpen.set(false); }

  /** Obtiene la etiqueta traducida del tipo de diagrama activo. */
  getActiveDiagramTypeLabel(): string {
    return DiagramEditorContextUtil.getDiagramTypeInfo(this.activeDiagramType()).label;
  }

  /** Obtiene el icono representativo del tipo de diagrama activo. */
  getActiveDiagramTypeIcon(): string {
    return DiagramEditorContextUtil.getDiagramTypeInfo(this.activeDiagramType()).icon;
  }

  /** Obtiene el color distintivo del tipo de diagrama activo. */
  getActiveDiagramTypeColor(): string { return '#6366f1'; }

  /** Indica si hay múltiples colaboradores editando simultáneamente. */
  isMultiUserEditing(): boolean { return this.collabCoordinator.isMultiUserEditing(); }

  /** Acerca la vista del lienzo. */
  zoomIn(): void { this.viewportService.zoomIn(this.diagramCanvas); }

  /** Aleja la vista del lienzo. */
  zoomOut(): void { this.viewportService.zoomOut(this.diagramCanvas); }

  /** Ajusta y centra el contenido del diagrama en el área visible. */
  fitView(): void { this.viewportService.fitView(this.diagramCanvas); }

  /** Restablece la escala y posición del lienzo a los valores iniciales. */
  resetView(): void { this.viewportService.resetView(this.diagramCanvas); }

  /** Sincroniza los puntos finales de conexión cuando el lienzo termina de cargarse. */
  onFlowLoaded(): void { this.updateConnectionEndpoints(); }

  /** Actualiza el nivel de zoom cuando el lienzo emite un cambio. */
  onZoomChanged(zoom: number): void { this.viewportService.onZoomChanged(zoom, this.currentDiagramId()); }

  /** Registra el desplazamiento de scroll del viewport para el diagrama actual. */
  onViewportScroll(event: Event): void { this.viewportService.onViewportScroll(event, this.currentDiagramId()); }

  /** Convierte coordenadas de cliente (ventana) a coordenadas internas del lienzo. */
  clientToCanvasCoordinates(clientX: number, clientY: number): { x: number; y: number } {
    const el = this.diagramCanvas?.getExportElement();
    const transform = this.fCanvas?.transform;
    if (!el) return { x: clientX, y: clientY };
    const rect = el.getBoundingClientRect();
    const scale = transform?.scale || 1;
    const pos = transform?.position || { x: 0, y: 0 };
    const scaledPos = transform?.scaledPosition || { x: 0, y: 0 };
    return {
      x: Math.round((clientX - rect.left - pos.x - scaledPos.x) / scale),
      y: Math.round((clientY - rect.top - pos.y - scaledPos.y) / scale),
    };
  }

  /** Guarda una instantánea del estado actual en la pila de historial Undo/Redo. */
  pushSnapshot(): void {
    if (this.historyService) {
      this.historyService.pushSnapshot(
        this.historyService.cloneSnapshot(this.nodes(), this.connections(), this.defaultLineStyle()),
      );
    }
  }

  /** Deshace la última acción realizada sobre el diagrama. */
  undo(): void {
    if (this.isReadOnly()) return;
    const prev = this.historyService.undo(
      this.historyService.cloneSnapshot(this.nodes(), this.connections(), this.defaultLineStyle()),
    );
    if (!prev) return;
    this.nodes.set(prev.nodes);
    this.connections.set(prev.connections);
    this.defaultLineStyle.set(prev.defaultLineStyle);
    this.selectionService.clearSelection();
    this.markAsUnsaved();
    this.sendDiagramSync(this.nodes(), this.connections(), 'undo');
  }

  /** Rehace la última acción deshecha sobre el diagrama. */
  redo(): void {
    if (this.isReadOnly()) return;
    const next = this.historyService.redo(
      this.historyService.cloneSnapshot(this.nodes(), this.connections(), this.defaultLineStyle()),
    );
    if (!next) return;
    this.nodes.set(next.nodes);
    this.connections.set(next.connections);
    this.defaultLineStyle.set(next.defaultLineStyle);
    this.selectionService.clearSelection();
    this.markAsUnsaved();
    this.sendDiagramSync(this.nodes(), this.connections(), 'redo');
  }

  /** Cierra el menú contextual flotante del lienzo. */
  closeContextMenu(): void { this.contextMenuService.closeContextMenu(); }

  /** Abre el menú contextual sobre un nodo específico del lienzo. */
  onNodeContextMenu(
    nodeOrEvent: UmlClassNode | { node: UmlClassNode; event: MouseEvent },
    maybeEvent?: MouseEvent,
  ): void {
    const node = 'event' in nodeOrEvent ? nodeOrEvent.node : nodeOrEvent;
    const event = 'event' in nodeOrEvent ? nodeOrEvent.event : maybeEvent!;
    this.contextMenuService.onNodeContextMenu({
      node,
      event,
      selectOnCanvas: (nIds, cIds) => this.diagramCanvas?.select(nIds, cIds),
      clientToCanvas: (x, y) => this.clientToCanvasCoordinates(x, y),
    });
  }

  /** Abre el menú contextual sobre una conexión específica del lienzo. */
  onConnectionContextMenu(
    connOrEvent: UmlConnection | { conn: UmlConnection; event: MouseEvent },
    maybeEvent?: MouseEvent,
  ): void {
    const conn = 'event' in connOrEvent ? connOrEvent.conn : connOrEvent;
    const event = 'event' in connOrEvent ? connOrEvent.event : maybeEvent!;
    this.contextMenuService.onConnectionContextMenu({
      conn,
      event,
      selectOnCanvas: (nIds, cIds) => this.diagramCanvas?.select(nIds, cIds),
      clientToCanvas: (x, y) => this.clientToCanvasCoordinates(x, y),
    });
  }

  /** Abre el menú contextual sobre el fondo vacío del lienzo. */
  onCanvasContextMenu(
    eventOrPayload: MouseEvent | { event: MouseEvent; canvasPos: { x: number; y: number } },
  ): void {
    const event = 'canvasPos' in eventOrPayload ? eventOrPayload.event : eventOrPayload;
    const canvasPos =
      'canvasPos' in eventOrPayload
        ? eventOrPayload.canvasPos
        : this.clientToCanvasCoordinates(event.clientX, event.clientY);
    this.contextMenuService.onCanvasContextMenu({ event, canvasPos });
  }

  /** Invierte la dirección de una conexión desde el menú contextual. */
  reverseConnection(conn: UmlConnection): void {
    if (this.isReadOnly()) return;
    this.pushSnapshot();
    const reversed = this.connectionOps.reverseConnection(conn);
    const nextConns = this.recalculateSequenceNumbers(
      this.connections().map((c) => (c.id === conn.id ? reversed : c)),
    );
    this.connections.set(nextConns);
    this.updateConnectionEndpoints();
    this.markAsUnsaved();
    this.sendDiagramSync(this.nodes(), this.connections(), 'reverse_connection');
    this.closeContextMenu();
  }

  /** Cambia el estilo de enrutamiento de línea de una conexión. */
  changeConnectionLineStyle(conn: UmlConnection, style: UmlLineStyle): void {
    if (this.isReadOnly()) return;
    this.pushSnapshot();
    this.connections.set(this.connections().map((c) => (c.id === conn.id ? { ...c, lineStyle: style } : c)));
    this.markAsUnsaved();
    this.sendDiagramSync(this.nodes(), this.connections(), 'change_line_style');
    this.closeContextMenu();
  }

  /** Alias de cambio de estilo de línea de una conexión para eventos del menú contextual. */
  setConnectionLineStyle(conn: UmlConnection, style: UmlLineStyle): void {
    this.changeConnectionLineStyle(conn, style);
  }

  /** Cambia el color de fondo de los nodos seleccionados desde la barra de herramientas. */
  onSetSelectedNodeColor(color: string | null): void {
    this.toolbarService.applySelectedNodeColor(color || '', {
      isReadOnly: this.isReadOnly(),
      selectedNodeIds: this.selectedNodeIdsList(),
      nodes: this.nodes(),
      connections: this.connections(),
      defaultLineStyle: this.defaultLineStyle(),
      pushSnapshot: () => this.pushSnapshot(),
      setNodes: (n) => this.nodes.set(n),
      markAsUnsaved: () => this.markAsUnsaved(),
      sendDiagramSync: (n, c, act) => this.sendDiagramSync(n, c, act),
    });
    this.closeContextMenu();
  }

  /** Cambia el color de fondo de un nodo específico desde el menú contextual. */
  changeNodeColor(node: UmlClassNode, color: string): void {
    this.toolbarService.applySelectedNodeColor(color, {
      isReadOnly: this.isReadOnly(),
      selectedNodeIds: this.selectedNodeIds().has(node.id) ? this.selectedNodeIdsList() : [node.id],
      nodes: this.nodes(),
      connections: this.connections(),
      defaultLineStyle: this.defaultLineStyle(),
      pushSnapshot: () => this.pushSnapshot(),
      setNodes: (n) => this.nodes.set(n),
      markAsUnsaved: () => this.markAsUnsaved(),
      sendDiagramSync: (n, c, act) => this.sendDiagramSync(n, c, act),
    });
    this.closeContextMenu();
  }

  /** Indica si existen elementos copiados en el portapapeles interno. */
  hasClipboard(): boolean { return this.clipboardService.hasClipboardContent(); }

  /** Alias de comprobación de contenido en el portapapeles interno. */
  hasClipboardContent(): boolean { return this.clipboardService.hasClipboardContent(); }

  /** Copia los nodos seleccionados al portapapeles interno del editor. */
  copySelectedNodes(): void {
    const res = this.clipboardService.copyNodes(
      this.nodes(),
      this.connections(),
      this.selectedNodeIds(),
      this.selectedNodeId(),
      this.activeDiagramType(),
    );
    if (res && res.copiedNodesCount > 0) {
      this.triggerQuickToast(this.clipboardService.formatCopyToast(res));
    }
  }

  /** Corta los nodos seleccionados copiándolos al portapapeles y eliminándolos del lienzo. */
  cutSelectedNodes(): void {
    if (this.isReadOnly()) return;
    this.copySelectedNodes();
    this.deleteSelectedNodes();
  }

  /** Copia un nodo específico desde el menú contextual. */
  copyNodeFromMenu(node: UmlClassNode): void {
    this.selectionService.selectSingleNode(node.id);
    this.copySelectedNodes();
    this.closeContextMenu();
  }

  /** Pega los nodos del portapapeles en el lienzo. */
  pasteClipboardNodes(targetPos?: { x: number; y: number }): void {
    const scrollEl = this.diagramCanvas?.flowContainerRef?.nativeElement;
    const res = this.clipboardService.executePaste({
      isReadOnly: this.isReadOnly(),
      activeDiagramType: this.activeDiagramType(),
      nodes: this.nodes(),
      targetPos,
      scrollOffset: { scrollLeft: scrollEl?.scrollLeft || 0, scrollTop: scrollEl?.scrollTop || 0 },
      onIncompatible: (diagType) => this.modalService.showIncompatibleElementModal(diagType, this.confirmDialog),
    });
    if (!res || !res.newNodes.length) return;
    this.pushSnapshot();
    this.nodes.set([...this.nodes(), ...res.newNodes]);
    this.connections.set(
      this.recalculateSequenceNumbers([...this.connections(), ...res.newConnections]),
    );
    this.selectionService.setNodeSelection(res.newPastedIds);
    this.updateConnectionEndpoints();
    this.closeContextMenu();
    this.markAsUnsaved();
    this.sendDiagramSync(this.nodes(), this.connections(), 'paste_nodes');
  }

  /** Alias de pegado de nodos para eventos del menú contextual. */
  pasteNodes(targetPos?: { x: number; y: number }): void {
    this.pasteClipboardNodes(targetPos);
  }

  /** Duplica inmediatamente los nodos seleccionados desplazados ligeramente. */
  duplicateSelectedNodes(): void {
    if (this.isReadOnly()) return;
    this.copySelectedNodes();
    this.pasteClipboardNodes();
  }

  /** Alias de duplicación de nodos seleccionados. */
  duplicateSelected(): void {
    this.duplicateSelectedNodes();
  }

  /** Duplica un nodo desde el menú contextual. */
  duplicateNodeFromMenu(node: UmlClassNode): void {
    this.selectionService.selectSingleNode(node.id);
    this.duplicateSelectedNodes();
  }

  /** Copia un nodo desde el explorador del proyecto al diagrama activo. */
  handleCopyNodeFromExplorer(event: {
    node: UmlClassNode;
    sourceDiagramId: string;
    sourceDiagramType?: DiagramType;
  }): void {
    const scrollEl = this.diagramCanvas?.flowContainerRef?.nativeElement;
    const cloned = this.clipboardService.executeCopyFromExplorer({
      isReadOnly: this.isReadOnly(),
      node: event.node,
      sourceDiagramId: event.sourceDiagramId,
      currentDiagramId: this.currentDiagramId(),
      activeDiagramType: this.activeDiagramType(),
      nodes: this.nodes(),
      scrollOffset: { scrollLeft: scrollEl?.scrollLeft || 0, scrollTop: scrollEl?.scrollTop || 0 },
      getDefaultColor: (t, s) => this.getDefaultColorForNodeType(t, s),
      onIncompatible: (diagType: DiagramType) =>
        this.modalService.showIncompatibleElementModal(diagType, this.confirmDialog),
    });
    if (!cloned) return;
    this.pushSnapshot();
    this.nodes.set([...this.nodes(), cloned]);
    this.selectionService.selectSingleNode(cloned.id);
    this.markAsUnsaved();
    this.sendDiagramSync(this.nodes(), this.connections(), 'copy_from_explorer');
  }

  /** Selecciona y enfoca un nodo desde el explorador del proyecto. */
  handleSelectNodeFromExplorer(nodeId: string): void {
    this.selectionService.selectSingleNode(nodeId);
    this.diagramCanvas?.select([nodeId], []);
  }

  /** Selecciona todas las clases y elementos del diagrama actual. */
  selectAllClasses(): void {
    this.selectionService.selectAllClasses(this.nodes(), this.selectedRelationType(), (ids: string[]) =>
      this.diagramCanvas?.select(ids, []),
    );
    this.closeContextMenu();
  }

  /** Limpia la selección actual de nodos y conexiones. */
  clearSelection(): void {
    this.selectionService?.clearSelection();
    this.diagramCanvas?.clearSelection();
  }

  /** Deselecciona todos los elementos y cierra el menú contextual. */
  deselectAll(): void {
    this.clearSelection();
    this.closeContextMenu();
  }

  /** Alinea los nodos seleccionados en la dirección indicada. */
  alignSelectedNodes(direction: AlignmentDirection): void {
    this.toolbarService.alignNodes(direction, DiagramEditorContextUtil.buildToolbarContext(this));
  }

  /** Alias de alineación de nodos para eventos del Appbar. */
  alignNodes(direction: AlignmentDirection): void {
    this.alignSelectedNodes(direction);
  }

  /** Distribuye equitativamente tres o más nodos seleccionados. */
  distributeSelectedNodes(direction: DistributionDirection): void {
    this.toolbarService.distributeNodes(direction, DiagramEditorContextUtil.buildToolbarContext(this));
  }

  /** Alias de distribución de nodos para eventos del Appbar. */
  distributeNodes(direction: DistributionDirection): void {
    this.distributeSelectedNodes(direction);
  }

  /** Ajusta las coordenadas de los nodos seleccionados a la cuadrícula del lienzo. */
  snapSelectedToGrid(): void {
    this.toolbarService.snapSelectedToGrid(DiagramEditorContextUtil.buildToolbarContext(this));
  }

  /** Selecciona y carga un diagrama específico en el área de trabajo. */
  selectDiagram(diagramId: string): void {
    this.tabManager.executeSelectDiagram(diagramId, {
      currentDiagramId: this.currentDiagramId(),
      isReadOnly: this.isReadOnly(),
      hasUnsavedChanges: this.hasUnsavedChanges(),
      saveToBackend: () => this.saveToBackend(true),
      setCurrentDiagramId: (id: string) => this.currentDiagramId.set(id),
      navigateToDiagram: (id: string) => {
        this.router.navigate([], { relativeTo: this.route, queryParams: { diagramId: id }, queryParamsHandling: 'merge' });
      },
      loadDiagram: (id: string) => this.loadDiagram(id),
    });
  }

  /** Alias de selección de diagrama para eventos del Sidebar y Tabs. */
  onSelectDiagram(diagramId: string): void {
    this.selectDiagram(diagramId);
  }

  /** Cierra una pestaña abierta en la barra superior de pestañas. */
  closeTab(tabId: string, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    const res = this.tabManager.closeTab(tabId, this.currentDiagramId());
    if (res?.nextTabId) this.selectDiagram(res.nextTabId);
  }

  /** Guarda el nuevo nombre del diagrama activo desde la barra superior. */
  saveCurrentDiagramRename(newName: string): void {
    const id = this.currentDiagramId();
    if (!id || this.isReadOnly()) return;
    this.tabManager.renameDiagram({ diagramId: id, name: newName }, id);
  }

  /** Renombra un diagrama desde su pestaña o barra lateral. */
  onRenameDiagram(event: { diagramId: string; name: string }): void {
    if (this.isReadOnly()) return;
    this.tabManager.renameDiagram(event, this.currentDiagramId());
  }

  /** Alias de renombrado desde pestaña. */
  onTabRenameDiagram(event: { diagramId: string; name: string }): void {
    this.onRenameDiagram(event);
  }

  /** Alias de renombrado desde barra lateral. */
  onSidebarRenameDiagram(event: { diagramId: string; name: string }): void {
    this.onRenameDiagram(event);
  }

  /** Cambia el tipo de diagrama activo cuando se selecciona en la barra lateral. */
  onDiagramTypeChange(type: DiagramType): void {
    this.activeDiagramType.set(type);
    this.setPointerMode();
  }

  /** Abre el modal de creación de un nuevo diagrama. */
  openCreateDiagramModal(lockedType: DiagramType | null = null): void {
    if (this.isReadOnly()) return;
    this.modalService.openCreateDiagramModal(lockedType);
  }

  /** Cierra el modal de creación de diagrama. */
  closeCreateDiagramModal(): void { this.modalService.closeCreateDiagramModal(); }

  /** Crea un nuevo diagrama en el proyecto actual a partir de los datos del modal. */
  handleCreateDiagram(data: { name: string; type: DiagramType }): void {
    this.tabManager.handleCreateDiagram(
      this.currentProjectId(),
      data,
      (createdId) => this.selectDiagram(createdId),
      () => {
        if (this.hasUnsavedChanges() && !this.isReadOnly()) this.saveToBackend(true);
      },
    );
  }

  /** Solicita confirmación y elimina un diagrama desde la barra lateral. */
  deleteDiagramFromSidebar(diagramId: string): void {
    if (this.isReadOnly()) return;
    this.tabManager.deleteDiagram(
      diagramId,
      this.currentDiagramId(),
      this.projectDiagrams(),
      (nextId) => {
        if (nextId) {
          this.selectDiagram(nextId);
        } else {
          this.currentDiagramId.set(null);
          this.nodes.set([]);
          this.connections.set([]);
        }
      },
    );
  }

  /** Alias de eliminación de diagrama desde la barra lateral. */
  onDeleteDiagram(diagramId: string): void {
    this.deleteDiagramFromSidebar(diagramId);
  }

  /** Carga un diagrama desde el servidor o restaura su borrador local si es más reciente. */
  loadDiagram(diagramId: string): void {
    DiagramEditorContextUtil.executeLoadDiagram(this, diagramId);
  }

  /** Marca el diagrama actual con cambios pendientes y programa el auto-guardado. */
  markAsUnsaved(): void {
    this.persistenceService?.markAsUnsaved(this.isReadOnly(), this.currentDiagramId(), {
      nodes: this.nodes(),
      connections: this.connections(),
      defaultLineStyle: this.defaultLineStyle(),
    });
  }

  /** Construye el payload canónico AST para guardar el diagrama en el backend. */
  buildSaveAstPayload(): SaveDiagramAstRequest {
    const exp = (this as any).diagramExportService || this.exportService;
    return exp.buildSaveAstPayload(
      this.activeDiagramType(),
      this.defaultLineStyle(),
      this.nodes(),
      this.connections(),
      (n: UmlClassNode) => this.getNodeWidth(n),
      (n: UmlClassNode) => this.getNodeHeight(n),
      (t?: string | null, s?: string | null) => this.getDefaultColorForNodeType(t, s),
      (m: any, seq?: string) => this.normalizeUmlMessage(m, seq),
      (c: UmlConnection[], p?: boolean) => this.recalculateSequenceNumbers(c, p),
    );
  }

  /** Guarda el árbol sintáctico (AST) del diagrama actual en el backend. */
  saveToBackend(silent = false): void {
    const id = this.currentDiagramId();
    if (!id || this.isReadOnly()) return;
    const payload = this.buildSaveAstPayload();
    this.persistenceService.executeSaveToBackend(this.diagramService, id, payload, silent, () => {
      this.sendDiagramSync(this.nodes(), this.connections(), 'save');
    });
  }

  /** Ejecuta un guardado manual inmediato del diagrama activo. */
  saveDiagramManual(): void { this.saveToBackend(false); }

  /** Envía el estado sincronizado del diagrama a la sala colaborativa. */
  sendDiagramSync(nodes: UmlClassNode[], connections: UmlConnection[], action: string): void {
    const collab = (this as any).collaborationService || this.collabCoordinator;
    if (collab?.sendDiagramSync) {
      collab.sendDiagramSync(nodes, connections, action, this.defaultLineStyle());
    }
  }

  /** Normaliza un tipo de dato de atributo al catálogo predefinido. */
  normalizeDataType(type: string): string {
    const sync = (this as any).diagramDocumentSyncService || this.documentSyncService;
    return sync.normalizeDataType(type);
  }

  /** Normaliza un tipo de retorno de método al catálogo predefinido. */
  normalizeReturnType(type: string): string {
    const sync = (this as any).diagramDocumentSyncService || this.documentSyncService;
    return sync.normalizeReturnType(type);
  }

  /** Normaliza un mensaje de secuencia o comunicación delegando en `UmlNodeNormalizerUtil`. */
  normalizeUmlMessage(m: any, defaultSeq = '1'): UmlMessage {
    return this.normalizer.normalizeUmlMessage(m, defaultSeq);
  }

  /** Recalcula la numeración jerárquica de mensajes en diagramas de secuencia. */
  recalculateSequenceNumbers(connectionsList: UmlConnection[], preserveSequenceNumbers = false): UmlConnection[] {
    const layout =
      (this as any).diagramConnectionLayoutService ||
      this.connectionLayoutService ||
      new DiagramConnectionLayoutService();
    return layout.recalculateSequenceNumbers(
      connectionsList,
      this.nodes(),
      this.activeDiagramType(),
      preserveSequenceNumbers,
    );
  }

  /** Devuelve el color predeterminado asociado a un tipo de nodo y estereotipo. */
  getDefaultColorForNodeType(nodeType?: string | null, stereotype?: string | null): string {
    return this.metrics.getDefaultColorForNodeType(nodeType, stereotype);
  }

  /** Calcula el ancho visual estimado de un nodo UML. */
  getNodeWidth(node: UmlClassNode): number {
    const diagType = typeof this.activeDiagramType === 'function' ? this.activeDiagramType() : undefined;
    return this.metrics.getNodeWidth(node, diagType);
  }

  /** Calcula el alto visual estimado de un nodo UML. */
  getNodeHeight(node: UmlClassNode): number {
    const diagType = typeof this.activeDiagramType === 'function' ? this.activeDiagramType() : undefined;
    return this.metrics.getNodeHeight(node, diagType);
  }

  /** Obtiene el nombre legible de un nodo por su ID. */
  getNodeName(nodeId: string): string {
    return this.nodes().find((n) => n.id === nodeId)?.name || nodeId;
  }

  /** Obtiene la etiqueta descriptiva de un tipo de relación UML. */
  getRelationLabel(relType: UmlRelationshipType): string {
    return relType || 'association';
  }

  /** Determina si un tipo de relación pertenece a diagramas de secuencia. */
  isSequenceConnection(relType: UmlRelationshipType | null): boolean {
    return this.relationshipRules.isSequenceConnection(relType, this.activeDiagramType());
  }

  /** Calcula los conectores óptimos de salida y entrada entre dos nodos. */
  getOptimalConnectorId(sourceNode: UmlClassNode, targetNode: UmlClassNode): { sourceId: string; targetId: string } {
    return this.connectionLayoutService.getOptimalConnectorId(
      sourceNode,
      targetNode,
      (n: UmlClassNode) => this.getNodeWidth(n),
      (n: UmlClassNode) => this.getNodeHeight(n),
    );
  }

  /** Obtiene las coordenadas del puerto de conexión en un lado específico del nodo. */
  getConnectorPoint(node: UmlClassNode, side: string): { x: number; y: number } {
    return this.connectionLayoutService.getConnectorPoint(node, side, (n: UmlClassNode) => this.getNodeHeight(n));
  }

  /** Actualiza los conectores de todas las relaciones tras mover o redimensionar nodos. */
  updateConnectionEndpoints(): void {
    const res = this.connectionLayoutService.recalculateConnectionEndpoints(
      this.nodes(),
      this.connections(),
      this.activeDiagramType(),
      this.defaultLineStyle(),
      (n: UmlClassNode) => this.getNodeWidth(n),
      (n: UmlClassNode) => this.getNodeHeight(n),
    );
    if (res.anchorMoved) this.nodes.set(res.updatedNodes);
    this.connections.set(res.updatedConnections);
  }

  /** Verifica si un nodo está bloqueado por otro colaborador remoto en la sala. */
  isNodeLockedByOther(nodeId: string): boolean {
    return this.collabCoordinator?.isNodeLockedByOther(nodeId) || false;
  }

  /** Activa el modo puntero cancelando cualquier herramienta de relación activa. */
  setPointerMode(): void {
    this.selectedRelationType.set(null);
    this.selectedSourceNodeId.set(null);
    this.tempCursorPos.set(null);
  }

  /** Selecciona o deselecciona una herramienta de relación UML en la caja de herramientas. */
  selectRelationTool(type: UmlRelationshipType | null): void {
    if (this.isReadOnly()) return;
    if (!type || this.selectedRelationType() === type) {
      this.setPointerMode();
    } else {
      this.selectedRelationType.set(type);
      this.selectedSourceNodeId.set(null);
      this.clearSelection();
    }
  }

  /** Alias de selección de tipo de relación desde la barra lateral. */
  selectRelationType(type: UmlRelationshipType | null): void {
    this.selectRelationTool(type);
  }

  /** Establece el estilo de línea predeterminado para todas las conexiones del diagrama. */
  setAllConnectionsLineStyle(style: UmlLineStyle): void {
    if (this.isReadOnly()) return;
    this.pushSnapshot();
    this.defaultLineStyle.set(style);
    const updated = this.connections().map((c) =>
      this.relationshipRules.isSequenceConnection(c.type, this.activeDiagramType())
        ? c
        : { ...c, lineStyle: style },
    );
    this.connections.set(updated);
    this.markAsUnsaved();
    this.sendDiagramSync(this.nodes(), this.connections(), 'change_default_line_style');
    this.closeContextMenu();

    const styleItem = UML_LINE_STYLES.find((s) => s.id === style);
    const styleLabel = styleItem?.label || style;
    const count = updated.filter((c) => !this.relationshipRules.isSequenceConnection(c.type, this.activeDiagramType())).length;
    const baseMsg = this.translationService.translate('editor.allLinesStyleChanged', { style: styleLabel });
    const countMsg = count > 0 ? ` (${this.translationService.translate('editor.allLinesCount', { count })})` : '';
    this.toastService?.success?.(`${baseMsg}${countMsg}`);
  }

  /** Alias para cambiar el estilo de línea predeterminado desde la barra lateral. */
  setDefaultLineStyle(style: UmlLineStyle): void {
    this.setAllConnectionsLineStyle(style);
  }

  /** Maneja el cambio de selección múltiple emitido por `@foblex/flow`. */
  onSelectionChange(event: FSelectionChangeEvent): void {
    this.selectionService.onSelectionChange(event, this.nodes(), this.connections(), this.selectedRelationType());
  }

  /** Maneja la selección por clic sobre un nodo del lienzo. */
  onNodeSelect(nodeId: string, event: MouseEvent): void {
    if (this.selectedRelationType()) {
      this.onTableClick(nodeId, event);
      return;
    }
    this.selectionService.onNodeSelect(
      nodeId,
      event,
      this.selectedRelationType(),
      this.canvasInteraction.hasMovedDuringPointerDown,
      (ids: string[], cids: string[]) => this.diagramCanvas?.select(ids, cids),
      () => this.diagramCanvas?.clearSelection(),
    );
  }

  /** Maneja la selección por clic sobre una conexión del lienzo. */
  onConnectionSelect(connId: string, event: MouseEvent): void {
    this.selectionService.onConnectionSelect(connId, event, this.selectedRelationType(), (ids: string[], cids: string[]) =>
      this.diagramCanvas?.select(ids, cids),
    );
  }

  /** Procesa el clic sobre un nodo cuando hay una herramienta de relación activa. */
  onTableClick(nodeId: string, event: MouseEvent): void {
    DiagramEditorContextUtil.executeTableClick(this, nodeId, event);
  }

  /** Registra la posición inicial de clic en el lienzo para diferenciar clic de arrastre. */
  onCanvasMouseDown(event: MouseEvent): void {
    this.canvasInteraction.handleCanvasMouseDown(event, () => this.closeContextMenu());
  }

  /** Limpia la selección al hacer clic sobre el fondo vacío del lienzo. */
  onCanvasBackgroundClick(event?: MouseEvent): void {
    this.canvasInteraction.handleCanvasBackgroundClick(event, () => {
      this.clearSelection();
      this.setPointerMode();
      this.closeContextMenu();
    });
  }

  /** Actualiza la posición del cursor colaborativo al mover el ratón. */
  onCanvasMouseMove(event: MouseEvent): void {
    this.canvasInteraction.handleCanvasMouseMove(
      event,
      this.canvasExportArea?.nativeElement,
      this.fCanvas?.transform,
      (x, y) => this.collabCoordinator.sendCursorPosition(x, y),
    );
  }

  /** Crea y valida un nodo del tipo especificado en el diagrama. */
  createNodeOfType(nodeType: string, customPos?: { x: number; y: number }, stereotype?: string | null): void {
    const ops = (this as any).diagramNodeOpsService || this.nodeOps;
    const scrollEl = this.diagramCanvas?.flowContainerRef?.nativeElement;
    const newNode = ops.createValidatedNode(nodeType, {
      isReadOnly: this.isReadOnly(),
      activeDiagramType: this.activeDiagramType(),
      nodes: this.nodes(),
      position: customPos,
      stereotype,
      scrollOffset: { scrollLeft: scrollEl?.scrollLeft || 0, scrollTop: scrollEl?.scrollTop || 0 },
      onIncompatible: (diagType: DiagramType) => {
        const modal = this.modalService || new DiagramModalService();
        modal.showIncompatibleElementModal(diagType, (this as any).confirmDialogService || this.confirmDialog);
      },
    });
    if (!newNode) return;
    this.pushSnapshot();
    this.nodes.set([...this.nodes(), newNode]);
    this.selectionService?.selectSingleNode(newNode.id);
    this.markAsUnsaved();
    this.sendDiagramSync(this.nodes(), this.connections(), 'add_node');
  }

  /** Agrega una clase UML al lienzo. */
  addClass(customPos?: { x: number; y: number }, stereotype?: string | null): void { this.createNodeOfType('class', customPos, stereotype); }
  /** Agrega una interfaz UML al lienzo. */
  addInterface(customPos?: { x: number; y: number }): void { this.createNodeOfType('class', customPos, 'interface'); }
  /** Agrega un actor UML al lienzo. */
  addActor(customPos?: { x: number; y: number }): void { this.createNodeOfType('actor', customPos); }
  /** Agrega un caso de uso UML al lienzo. */
  addUseCase(customPos?: { x: number; y: number }): void { this.createNodeOfType('use_case', customPos); }
  /** Agrega una nota de comentario UML al lienzo. */
  addNote(customPos?: { x: number; y: number }): void { this.createNodeOfType('class', customPos, 'note'); }

  /** Inserta una sugerencia autónoma de Kanon como nota flotante morada en el lienzo. */
  addSuggestionAsFloatingNote(suggestion: { title: string; summary: string }): void {
    if (this.isReadOnly()) return;
    const scrollEl = this.diagramCanvas?.flowContainerRef?.nativeElement;
    const scrollLeft = scrollEl?.scrollLeft || 0;
    const scrollTop = scrollEl?.scrollTop || 0;

    const existingNotes = this.nodes().filter((n) => (n.nodeType || '').toLowerCase() === 'note');
    const offset = (existingNotes.length * 32) % 240;
    const baseX = Math.max(80, scrollLeft + 160) + offset;
    const baseY = Math.max(60, scrollTop + 120) + offset;

    const newNote: UmlClassNode = {
      id: `note_${crypto.randomUUID()}`,
      name: `💡 ${suggestion.title}:\n${suggestion.summary}`,
      nodeType: 'note',
      position: { x: baseX, y: baseY },
      width: 275,
      height: 135,
      color: '#F3E8FF',
      attributes: [],
      methods: [],
    };

    this.pushSnapshot();
    this.nodes.set([...this.nodes(), newNote]);
    this.selectionService?.selectSingleNode(newNote.id);
    this.markAsUnsaved();
    this.sendDiagramSync(this.nodes(), this.connections(), 'add_node');
    const toastMsg = this.translationService.t('chat.noteAddedToast') || 'Nota flotante morada agregada al diagrama.';
    this.toastService?.success?.(toastMsg);
  }
  /** Agrega un paquete UML al lienzo. */
  addPackage(customPos?: { x: number; y: number }): void { this.createNodeOfType('package', customPos); }
  /** Agrega un nodo Boundary al lienzo. */
  addBoundary(customPos?: { x: number; y: number }): void { this.createNodeOfType('boundary', customPos); }
  /** Agrega un nodo Control al lienzo. */
  addControl(customPos?: { x: number; y: number }): void { this.createNodeOfType('control', customPos); }
  /** Agrega un nodo Entity al lienzo. */
  addEntity(customPos?: { x: number; y: number }): void { this.createNodeOfType('entity', customPos); }
  /** Agrega un límite de sistema (Boundary Box) al lienzo. */
  addBoundaryBox(customPos?: { x: number; y: number }): void { this.createNodeOfType('boundary_box', customPos); }
  /** Agrega una línea de vida al lienzo. */
  addLifeline(customPos?: { x: number; y: number }): void { this.createNodeOfType('lifeline', customPos); }
  /** Agrega un componente UML al lienzo. */
  addComponent(customPos?: { x: number; y: number }): void { this.createNodeOfType('component', customPos); }
  /** Agrega un nodo físico de despliegue al lienzo. */
  addNode(customPos?: { x: number; y: number }): void { this.createNodeOfType('node', customPos); }
  /** Agrega un dispositivo de despliegue al lienzo. */
  addDevice(customPos?: { x: number; y: number }): void { this.createNodeOfType('device', customPos); }
  /** Agrega un entorno de ejecución al lienzo. */
  addExecutionEnvironment(customPos?: { x: number; y: number }): void { this.createNodeOfType('executionEnvironment', customPos); }
  /** Agrega un artefacto de despliegue al lienzo. */
  addArtifact(customPos?: { x: number; y: number }): void { this.createNodeOfType('class', customPos, 'artifact'); }

  /** Procesa el soltado de un elemento desde el Toolbox o Explorador en el lienzo. */
  onNodeDropped(event: any): void {
    if (this.isReadOnly() || !event) return;
    const payload = event.payload;
    if (payload?.type === 'explorer_node') {
      const node = payload.nodeData || payload.node;
      if (node) {
        this.handleCopyNodeFromExplorer({
          node,
          sourceDiagramId: payload.sourceDiagramId,
          sourceDiagramType: payload.sourceDiagramType,
        });
      }
      return;
    }
    const resolvedType =
      payload?.nodeType ||
      event.nodeType ||
      (event.type !== 'toolbox_node' && event.type !== 'explorer_node' ? event.type : 'class');
    const resolvedStereotype = payload?.stereotype ?? event.stereotype;
    this.createNodeOfType(resolvedType, event.position, resolvedStereotype);
  }

  /** Procesa el renombrado en línea de un nodo en el lienzo. */
  onNodeRename(event: { nodeId: string; newName: string }): void {
    if (this.isReadOnly() || this.isNodeLockedByOther(event.nodeId)) return;
    const { anyChanged, updatedNodes } = this.nodeOps.renameNode(
      this.nodes(),
      event.nodeId,
      event.newName,
    );
    if (!anyChanged) return;
    this.pushSnapshot();
    this.nodes.set(updatedNodes);
    this.markAsUnsaved();
    this.sendDiagramSync(this.nodes(), this.connections(), 'rename_node');
  }

  /** Procesa el cambio de offset de etiqueta flotante de un nodo. */
  onNodeLabelOffsetChange(node: UmlClassNode, offset: { x: number; y: number }): void {
    if (this.isReadOnly() || this.isNodeLockedByOther(node.id)) return;
    this.nodes.set(this.nodeOps.updateNodeLabelOffset(this.nodes(), node.id, offset));
    this.markAsUnsaved();
  }

  /** Agrega un atributo a un nodo desde el lienzo. */
  addAttribute(node: UmlClassNode): void {
    if (this.isReadOnly() || this.isNodeLockedByOther(node.id)) return;
    this.pushSnapshot();
    const attrs = [...(node.attributes || [])];
    attrs.push({ name: `attr${attrs.length + 1}`, type: 'String', nullable: true, unique: false, length: 255 });
    this.nodes.set(this.nodes().map((n) => (n.id === node.id ? { ...n, attributes: attrs } : n)));
    this.markAsUnsaved();
    this.sendDiagramSync(this.nodes(), this.connections(), 'add_attribute');
  }

  /** Agrega un atributo a un nodo desde el menú contextual. */
  addAttributeFromMenu(node: UmlClassNode): void {
    this.addAttribute(node);
    this.closeContextMenu();
  }

  /** Agrega un método a un nodo desde el lienzo. */
  addMethod(node: UmlClassNode): void {
    if (this.isReadOnly() || this.isNodeLockedByOther(node.id)) return;
    this.pushSnapshot();
    const methods = [...(node.methods || [])];
    methods.push({ name: `metodo${methods.length + 1}`, parameters: '', returnType: 'void' });
    this.nodes.set(this.nodes().map((n) => (n.id === node.id ? { ...n, methods } : n)));
    this.markAsUnsaved();
    this.sendDiagramSync(this.nodes(), this.connections(), 'add_method');
  }

  /** Agrega un método a un nodo desde el menú contextual. */
  addMethodFromMenu(node: UmlClassNode): void {
    this.addMethod(node);
    this.closeContextMenu();
  }

  /** Procesa el cambio de posición de un nodo individual en el lienzo. */
  onNodePositionChange(node: UmlClassNode, newPosition: { x: number; y: number }): void {
    if (this.isReadOnly() || this.isNodeLockedByOther(node.id)) return;
    const { shouldRedraw } = this.canvasInteraction.handleNodePositionChange({
      node,
      newPosition,
      nodes: this.nodes(),
      selectedNodeIds: this.selectedNodeIds(),
      selectedNodeId: this.selectedNodeId(),
      activeDiagramType: this.activeDiagramType(),
      getNodeWidth: (n: UmlClassNode) => this.getNodeWidth(n),
      getNodeHeight: (n: UmlClassNode) => this.getNodeHeight(n),
      onStartDrag: () => this.pushSnapshot(),
      onSelectNode: (id: string) => this.selectionService.selectSingleNode(id),
      sendNodeDrag: (id: string, pos: { x: number; y: number }) => this.collabCoordinator.sendNodeDrag(id, pos),
    });
    if (shouldRedraw) this.fCanvas?.redraw();
    this.updateConnectionEndpoints();
    this.markAsUnsaved();
    this.persistenceService.triggerNodeDragEnd();
  }

  /** Procesa el movimiento simultáneo de múltiples nodos seleccionados en el lienzo. */
  onMoveNodes(event: FMoveNodesEvent): void {
    if (this.isReadOnly()) return;
    const { anyMoved } = this.canvasInteraction.handleMoveNodes({
      event,
      nodes: this.nodes(),
      activeDiagramType: this.activeDiagramType(),
      getNodeWidth: (n: UmlClassNode) => this.getNodeWidth(n),
      getNodeHeight: (n: UmlClassNode) => this.getNodeHeight(n),
      onStartDrag: () => this.pushSnapshot(),
      sendNodeDrag: (id: string, pos: { x: number; y: number }) => this.collabCoordinator.sendNodeDrag(id, pos),
    });
    if (!anyMoved) return;
    this.nodes.set([...this.nodes()]);
    this.updateConnectionEndpoints();
    this.markAsUnsaved();
    this.persistenceService.triggerNodeDragEnd();
  }

  /** Procesa el redimensionado manual de un nodo en el lienzo. */
  onNodeSizeChange(data: { node: UmlClassNode; width: number; height: number; position: { x: number; y: number } }): void {
    if (this.isReadOnly() || this.isNodeLockedByOther(data.node.id)) return;
    this.pushSnapshot();
    this.nodes.set(this.nodeOps.updateNodeSize(this.nodes(), data));
    this.updateConnectionEndpoints();
    this.markAsUnsaved();
    this.sendDiagramSync(this.nodes(), this.connections(), 'resize_node');
  }

  /** Alias de redimensionado de nodo para el evento del lienzo. */
  onNodeSizeChanged(data: { node: UmlClassNode; width: number; height: number; position: { x: number; y: number } }): void {
    this.onNodeSizeChange(data);
  }

  /** Procesa la creación de una conexión arrastrando entre puertos del lienzo. */
  onConnectionCreated(event: FCreateConnectionEvent): void {
    DiagramEditorContextUtil.executeConnectionCreated(this, event);
  }

  /** Procesa la reubicación vertical de un mensaje en un diagrama de secuencia. */
  onSequenceMessageMove(event: { connectionId: string; targetSlot: number }): void {
    this.connectionOps.handleSequenceMessageMove(event, {
      isReadOnly: this.isReadOnly(),
      connections: this.connections(),
      activeDiagramType: this.activeDiagramType(),
      onApplyMoved: (updatedList: UmlConnection[]) => {
        this.pushSnapshot();
        const recalculated = this.recalculateSequenceNumbers(updatedList, false);
        this.connections.set(recalculated);
        this.markAsUnsaved();
        this.sendDiagramSync(this.nodes(), recalculated, 'move_sequence_message');
      },
    });
  }

  /** Procesa la reasignación de extremo de una conexión en el lienzo. */
  onConnectionReassigned(event: FReassignConnectionEvent): void {
    this.connectionOps.handleConnectionReassigned(event, {
      isReadOnly: this.isReadOnly(),
      connections: this.connections(),
      activeDiagramType: this.activeDiagramType(),
      onApplyReassigned: (updatedList: UmlConnection[]) => {
        this.pushSnapshot();
        const recalculated = this.recalculateSequenceNumbers(updatedList, false);
        this.connections.set(recalculated);
        this.markAsUnsaved();
        this.sendDiagramSync(this.nodes(), recalculated, 'reassign_connection');
      },
    });
  }

  /** Abre el modal de edición de un nodo y solicita su bloqueo colaborativo. */
  openEditNodeModal(node: UmlClassNode, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (this.isReadOnly()) return;
    if (this.isNodeLockedByOther(node.id)) {
      const lock = this.collabCoordinator.getNodeLock(node.id);
      this.toastService?.warning(`🔒 "${node.name}" está siendo editado por ${lock?.userName || 'otro usuario'}`);
      return;
    }
    this.collabCoordinator.requestNodeLock(node.id);
    this.modalService.openEditNodeModal(node);
  }

  /** Cierra el modal de edición de nodo y libera su bloqueo colaborativo. */
  closeEditNodeModal(): void {
    this.modalService.closeEditNodeModal((id) => this.collabCoordinator.releaseNodeLock(id));
  }

  /** Guarda los cambios realizados en el modal de edición de nodo. */
  saveEditedNode(savedNode?: UmlClassNode): void {
    const target = savedNode || this.editingNode();
    if (!target || this.isReadOnly()) return;
    this.pushSnapshot();
    const updatedNodes = this.nodeOps.saveEditedNode(this.nodes(), target, this.activeDiagramType());
    this.nodes.set(updatedNodes);
    this.updateConnectionEndpoints();
    this.closeEditNodeModal();
    this.markAsUnsaved();
    this.sendDiagramSync(this.nodes(), this.connections(), 'edit_node');
  }

  /** Alias de guardado de nodo editado para el evento del modal. */
  onSaveEditedNode(savedNode: UmlClassNode): void {
    this.saveEditedNode(savedNode);
  }

  /** Abre el modal de edición de una conexión UML. */
  openEditConnModal(conn: UmlConnection, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (this.isReadOnly()) return;
    this.modalService.openEditConnModal(conn);
  }

  /** Cierra el modal de edición de conexión. */
  closeEditConnModal(): void { this.modalService.closeEditConnModal(); }

  /** Guarda los cambios realizados en el modal de edición de conexión. */
  saveEditedConnection(savedConn?: UmlConnection): void {
    const target = savedConn || this.editingConnection();
    if (!target || this.isReadOnly()) return;
    this.pushSnapshot();
    const { updatedConnections } = this.connectionOps.saveEditedConnection(
      this.connections(),
      target,
      this.activeDiagramType(),
      (m: any, seq?: string) => this.normalizeUmlMessage(m, seq),
    );
    const nextConns = this.recalculateSequenceNumbers(updatedConnections);
    this.connections.set(nextConns);
    this.modalService.closeEditConnModal();
    this.markAsUnsaved();
    this.sendDiagramSync(this.nodes(), this.connections(), 'edit_connection');
  }

  /** Alias de guardado de conexión editada para el evento del modal. */
  onSaveEditedConnection(savedConn: UmlConnection): void {
    this.saveEditedConnection(savedConn);
  }

  /** Elimina un nodo del diagrama en cascada junto con sus conexiones asociadas. */
  deleteNode(nodeId: string, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (this.isReadOnly() || this.isNodeLockedByOther(nodeId)) return;
    this.pushSnapshot();
    const { remainingNodes, remainingConnections } = this.nodeOps.executeCascadeDeleteNode(
      nodeId,
      this.nodes(),
      this.connections(),
      this.selectedNodeId(),
      (c: UmlConnection[]) => this.recalculateSequenceNumbers(c),
    );
    this.nodes.set(remainingNodes);
    this.connections.set(remainingConnections);
    this.clearSelection();
    this.closeEditNodeModal();
    this.closeContextMenu();
    this.markAsUnsaved();
    this.sendDiagramSync(this.nodes(), this.connections(), 'delete_node');
  }

  /** Alias para eliminar un nodo desde eventos del lienzo. */
  removeClass(nodeId: string, event?: MouseEvent): void {
    this.deleteNode(nodeId, event);
  }

  /** Elimina un nodo desde el menú contextual. */
  deleteNodeFromMenu(node: UmlClassNode): void {
    this.deleteNode(node.id);
    this.closeContextMenu();
  }

  /** Elimina una conexión específica del diagrama. */
  deleteConnection(connId: string, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (this.isReadOnly()) return;
    this.pushSnapshot();
    const { remainingNodes, remainingConnections } = this.connectionOps.executeCascadeDeleteConnection(
      connId,
      this.nodes(),
      this.connections(),
      (c: UmlConnection[]) => this.recalculateSequenceNumbers(c),
    );
    this.nodes.set(remainingNodes);
    this.connections.set(remainingConnections);
    this.selectionService.clearSelection();
    this.modalService.closeEditConnModal();
    this.closeContextMenu();
    this.markAsUnsaved();
    this.sendDiagramSync(this.nodes(), this.connections(), 'delete_connection');
  }

  /** Alias para eliminar una conexión desde el modal de edición. */
  removeConnection(connOrId: UmlConnection | string): void {
    const id = typeof connOrId === 'string' ? connOrId : connOrId.id;
    this.deleteConnection(id);
  }

  /** Elimina una conexión desde el menú contextual. */
  deleteConnectionFromMenu(conn: UmlConnection): void {
    this.deleteConnection(conn.id);
  }

  /** Elimina todos los nodos o conexiones actualmente seleccionados. */
  deleteSelectedNodes(): void {
    if (this.isReadOnly()) return;
    const nodeIds = this.selectedNodeIdsList();
    const connIds = this.selectedConnIdsList();
    if (nodeIds.length === 0 && connIds.length === 0) return;
    this.pushSnapshot();
    let curNodes = this.nodes();
    let curConns = this.connections();
    for (const nid of nodeIds) {
      if (!this.isNodeLockedByOther(nid)) {
        const res = this.nodeOps.executeCascadeDeleteNode(nid, curNodes, curConns, null, (c) => c);
        curNodes = res.remainingNodes;
        curConns = res.remainingConnections;
      }
    }
    for (const cid of connIds) {
      const res = this.connectionOps.executeCascadeDeleteConnection(cid, curNodes, curConns, (c) => c);
      curNodes = res.remainingNodes;
      curConns = res.remainingConnections;
    }
    this.nodes.set(curNodes);
    this.connections.set(this.recalculateSequenceNumbers(curConns));
    this.clearSelection();
    this.closeContextMenu();
    this.markAsUnsaved();
    this.sendDiagramSync(this.nodes(), this.connections(), 'delete_selected');
  }

  /** Alias de eliminación de elementos seleccionados. */
  deleteSelected(): void {
    this.deleteSelectedNodes();
  }

  /** Solicita confirmación y limpia todos los elementos del lienzo actual. */
  async clearAll(): Promise<void> {
    if (this.isReadOnly() || (this.nodes().length === 0 && this.connections().length === 0)) return;
    const confirmed = await this.confirmDialog.confirm({
      title: 'common.confirmModal.clearBoardTitle',
      message: 'common.confirmModal.clearBoardMessage',
      type: 'danger',
    });
    if (!confirmed) return;
    this.pushSnapshot();
    this.nodes.set([]);
    this.connections.set([]);
    this.clearSelection();
    this.closeContextMenu();
    this.markAsUnsaved();
    this.sendDiagramSync([], [], 'clear_board');
  }

  /** Abre el modal con el JSON exportado del diagrama actual. */
  openExportModal(): void {
    this.closeExportDropdown();
    const proj = this.exportService.buildProjectJson(
      this.currentDiagramName(),
      this.defaultLineStyle(),
      this.nodes(),
      this.connections(),
    );
    this.modalService.openExportModal(JSON.stringify(proj, null, 2));
  }

  /** Abre el modal para pegar e importar un diagrama en formato JSON. */
  openImportModal(): void {
    if (this.isReadOnly()) return;
    this.modalService.openImportModal();
  }

  /** Cierra el modal de visualización/importación JSON. */
  closeJsonModal(): void { this.modalService.closeJsonModal(); }

  /** Descarga el archivo JSON del diagrama actual. */
  downloadJsonFile(): void {
    this.exportService.downloadJsonFile(
      this.currentDiagramName(),
      this.defaultLineStyle(),
      this.nodes(),
      this.connections(),
    );
  }

  /** Procesa la selección de un archivo JSON o XMI desde la barra superior. */
  onFileSelected(event: Event): void {
    if (this.isReadOnly()) return;
    this.importService.executeFileImport({
      event,
      isReadOnly: this.isReadOnly(),
      hasMultipleActiveUsers: this.hasMultipleActiveUsers(),
      multiUserBlockedMsg: 'No se puede importar mientras hay múltiples usuarios activos.',
      normalizeDataType: (t: string) => this.normalizeDataType(t),
      normalizeReturnType: (t: string) => this.normalizeReturnType(t),
      onSuccess: (res: DiagramImportResult) => this.applyImportResult(res, false),
    });
  }

  /** Aplica el contenido JSON importado desde el modal JSON. */
  onApplyImportedJson(jsonText: string): void {
    this.importFromJson(jsonText);
  }

  /** Procesa la importación de un JSON pegado en el modal de importación. */
  importFromJson(jsonText?: string): void {
    const content = jsonText ?? this.jsonContent();
    if (!content || this.isReadOnly()) return;
    try {
      const parsed = this.importService.parseJsonProject(
        content,
        (t) => this.normalizeDataType(t),
        (t) => this.normalizeReturnType(t),
      );
      this.applyImportResult(parsed, true);
    } catch (e: any) {
      this.confirmDialog.alert({
        title: 'Error de importación',
        message: e?.message || 'El formato JSON no es válido.',
        type: 'danger',
      });
    }
  }

  /** Aplica un resultado de importación JSON o XMI sobre el lienzo. */
  private applyImportResult(res: DiagramImportResult, closeJson: boolean): void {
    if (res.name) this.currentDiagramName.set(res.name);
    if (res.diagramType) this.activeDiagramType.set(res.diagramType);
    if (res.defaultLineStyle) this.defaultLineStyle.set(res.defaultLineStyle);
    this.onApplyAiDiagramChanges({ nodes: res.nodes, connections: res.connections });
    if (closeJson) this.closeJsonModal();
  }

  /** Copia el contenido JSON actual al portapapeles del sistema. */
  copyJsonToClipboard(): void {
    navigator.clipboard?.writeText(this.jsonContent());
    this.triggerQuickToast('✅ JSON copiado');
  }

  /** Exporta el diagrama actual como imagen PNG. */
  exportAsImage(): void {
    this.closeExportDropdown();
    this.exportService.exportDiagramImage(
      this.diagramCanvas,
      'png',
      this.currentDiagramName(),
      this.activeDiagramType(),
      this.nodes(),
      this.connections(),
    );
  }

  /** Alias para descargar imagen PNG desde el Appbar. */
  downloadPngFile(): void {
    this.exportAsImage();
  }

  /** Exporta el diagrama actual como mapa de bits BMP. */
  exportAsBmp(): void {
    this.closeExportDropdown();
    this.exportService.exportDiagramImage(
      this.diagramCanvas,
      'bmp',
      this.currentDiagramName(),
      this.activeDiagramType(),
      this.nodes(),
      this.connections(),
    );
  }

  /** Alias para descargar archivo BMP desde el Appbar. */
  downloadBmpFile(): void {
    this.exportAsBmp();
  }

  /** Exporta el diagrama actual como imagen vectorial SVG. */
  exportAsSvg(): void {
    this.closeExportDropdown();
    this.exportService.exportDiagramSvg(
      this.diagramCanvas,
      this.currentDiagramName(),
      this.activeDiagramType(),
      this.nodes(),
      this.connections(),
    );
  }

  /** Alias para descargar archivo SVG desde el Appbar. */
  downloadSvgFile(): void {
    this.exportAsSvg();
  }

  /**
   * Exporta todos los diagramas del proyecto en un archivo comprimido .ZIP (PNG o SVG).
   */
  readonly zipExportError = signal<string | null>(null);
  readonly zipExportProgress = signal<{ current: number; total: number; name?: string; stage: 'loading' | 'rendering' | 'packing' } | null>(null);

  /** Genera un solo ZIP a la vez y publica avances reales de preparación y empaquetado. */
  async downloadProjectZip(format: 'png' | 'svg'): Promise<void> {
    if (this.zipExportProgress()) return;
    this.closeExportDropdown();
    const projId = this.currentProjectId();
    if (!projId) {
      this.toastService?.warning('No hay un proyecto activo seleccionado.');
      return;
    }

    this.zipExportError.set(null);
    this.zipExportProgress.set({ current: 0, total: 0, stage: 'loading' });
    try {
      this.toastService?.info(this.translationService.translate('appbar.exportZipLoading'));
      let rawDiagrams = this.projectDiagrams();
      try {
        const fetched = await firstValueFrom(this.diagramService.loadDiagramsByProject(projId));
        if (fetched && fetched.length > 0) {
          rawDiagrams = fetched;
        }
      } catch (loadErr) {
        console.warn('No se pudo refrescar diagramas desde backend, usando lista en memoria:', loadErr);
      }

      const activeId = this.currentDiagramId();
      const diagrams = (rawDiagrams || []).map((d) => {
        const mapped = this.persistenceService.mapServerDiagramToLocal(d);
        const mappedConnections = mapped.connections.map((connection, index) => ({
          ...connection,
          lineStyle: sanitizeLineStyle(d.connections?.[index]?.lineStyle, d.defaultLineStyle ?? connection.lineStyle ?? 'segment'),
        }));
        if (d.id === activeId) {
          const localNodes = this.nodes();
          const serverIds = new Set(mapped.nodes.map(node => node.id));
          const localIds = new Set(localNodes.map(node => node.id));
          const isLoaded = serverIds.size === localIds.size &&
            [...serverIds].every(id => localIds.has(id));
          const useLocal = isLoaded || this.hasUnsavedChanges();
          return {
            id: d.id,
            name: this.currentDiagramName() || d.name,
            type: this.activeDiagramType() || d.type,
            defaultLineStyle: this.defaultLineStyle(),
            nodes: useLocal ? localNodes : mapped.nodes,
            connections: useLocal ? this.connections() : mappedConnections,
            captureCanvas: useLocal,
          };
        }
        return {
          id: d.id,
          name: d.name,
          type: d.type,
          defaultLineStyle: d.defaultLineStyle,
          nodes: mapped.nodes,
          connections: mappedConnections,
        };
      });

      if (diagrams.length === 0) {
        this.toastService?.warning('El proyecto no contiene diagramas para exportar.');
        return;
      }

      await this.exportService.exportProjectDiagramsZip(
        diagrams,
        format,
        this.currentProject()?.name || this.currentDiagramName() || 'proyecto',
        undefined,
        undefined,
        async index => {
          this.zipExportProgress.set({ current: index + 1, total: diagrams.length, name: diagrams[index].name, stage: 'rendering' });
          const capture = await this.createExportCanvas(diagrams[index]);
          return {
            element: capture.element,
            dispose: () => {
              capture.dispose();
              if (index === diagrams.length - 1) {
                this.zipExportProgress.set({ current: diagrams.length, total: diagrams.length, stage: 'packing' });
              }
            },
          };
        },
      );
    } catch (err) {
      const progress = this.zipExportProgress();
      const stageKey = { loading: 'appbar.zipPreparing', rendering: 'appbar.zipRendering', packing: 'appbar.zipPacking' }[progress?.stage ?? 'loading'];
      const detail = `${this.translationService.translate(stageKey)} (${progress?.current ?? 0}/${progress?.total ?? 0}) ${progress?.name ?? ''}`;
      this.zipExportError.set(`${detail}${err instanceof Error && err.message ? ` — ${err.message}` : ''}`);
      const reason = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ''}` : String(err);
      console.error('[ZIP export failed]', reason, { projectId: projId, format, progress, error: err });
      this.toastService?.error(this.translationService.translate('appbar.zipFailed'));
    } finally {
      this.zipExportProgress.set(null);
    }
  }

  /** Renderiza una copia aislada con los mismos plug-ins, estilos y rutas Foblex del editor. */
  private async createExportCanvas(diagram: {
    nodes: UmlClassNode[]; connections: UmlConnection[]; type?: string; defaultLineStyle?: UmlLineStyle;
  }): Promise<{ element: HTMLElement; dispose: () => void }> {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-100000px;top:0;width:2400px;height:1600px;pointer-events:none;background:white';
    host.setAttribute('aria-hidden', 'true');
    document.body.appendChild(host);
    const ref = createComponent(DiagramCanvasComponent, {
      hostElement: host, environmentInjector: this.exportEnvironment, elementInjector: this.exportInjector,
    });
    this.exportApplication.attachView(ref.hostView);
    let restore: (() => void) | undefined;
    let readyTimer: ReturnType<typeof setTimeout> | undefined;
    const dispose = () => {
      clearTimeout(readyTimer);
      restore?.();
      this.exportApplication.detachView(ref.hostView);
      ref.destroy();
      host.remove();
    };
    try {
      const loaded = new Promise<void>((resolve, reject) => {
        readyTimer = setTimeout(() => reject(new Error('Export canvas did not finish rendering within 15 seconds')), 15000);
        ref.instance.flowLoaded.subscribe(() => { clearTimeout(readyTimer); resolve(); });
      });
      // Evita rechazos sin manejar si detectChanges falla antes de esperar el renderizado.
      void loaded.catch(() => undefined);
      ref.setInput('exportSize', {
        width: computeBoardWidth(diagram.nodes, diagram.connections, diagram.type as DiagramType),
        height: computeBoardHeight(diagram.nodes, diagram.connections, diagram.type as DiagramType),
      });
      ref.setInput('nodes', structuredClone(diagram.nodes));
      ref.setInput('connections', structuredClone(diagram.connections));
      ref.setInput('activeDiagramType', diagram.type || DiagramType.CLASS);
      ref.setInput('defaultLineStyle', diagram.defaultLineStyle || 'segment');
      ref.setInput('interactionDisabled', true);
      ref.setInput('isGridVisible', false);
      ref.changeDetectorRef.detectChanges();
      await loaded;
      await document.fonts?.ready;
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      restore = ref.instance.prepareForExport();
      ref.changeDetectorRef.detectChanges();
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const element = ref.instance.getExportElement();
      if (!element) throw new Error('Export canvas is unavailable');
      if (element.clientWidth <= 0 || element.clientHeight <= 0) {
        throw new Error(`Export canvas has invalid dimensions: ${element.clientWidth}x${element.clientHeight}`);
      }
      return { element, dispose };
    } catch (error) {
      dispose();
      throw error;
    }
  }

  readonly showRepositoryImport = signal(false);
  readonly isExportingQea = signal(false);

  /** Guarda el documento activo antes de solicitar el QEA y evita descargas simultáneas. */
  async downloadQea(project: boolean): Promise<void> {
    const id = project ? this.currentProjectId() : this.currentDiagramId();
    if (!id || !this.xmiService || this.isExportingQea()) return;
    this.isExportingQea.set(true);
    this.toastService?.info(this.translationService.translate('appbar.qeaPreparing'));
    try {
      const diagramId = this.currentDiagramId();
      if (this.hasUnsavedChanges() && !this.isReadOnly() && diagramId) {
        await firstValueFrom(this.diagramService.saveAst(diagramId, this.buildSaveAstPayload()));
        this.persistenceService.markAsSaved(diagramId);
      }
      const blob = await firstValueFrom(this.xmiService.exportQea(id, project));
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${project ? 'project' : this.currentDiagramName()}.qea`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.toastService?.success(this.translationService.translate('appbar.qeaReady'));
    } catch (error) {
      console.error('[QEA export failed]', error);
      this.toastService?.error(this.translationService.translate('appbar.qeaFailed'));
    } finally { this.isExportingQea.set(false); }
  }

  /** Descarga el diagrama actual en estándar OMG XMI 2.1. */
  exportXmi(): void {
    this.closeExportDropdown();
    if (!this.xmiService) return;
    this.exportService.executeDownloadXmi({
      currentDiagramId: this.currentDiagramId(),
      currentDiagramName: this.currentDiagramName(),
      hasUnsavedChanges: this.hasUnsavedChanges(),
      isReadOnly: this.isReadOnly(),
      xmiService: this.xmiService,
      saveAst: (id, payload) => this.diagramService.saveAst(id, payload),
      buildSaveAstPayload: () => this.buildSaveAstPayload(),
      onSavedSuccessfully: () => {
        const id = this.currentDiagramId();
        if (id) this.persistenceService.markAsSaved(id);
      },
    });
  }

  /** Alias para descargar archivo XMI desde el Appbar. */
  downloadXmiFile(): void {
    this.exportXmi();
  }

  /** Sanitiza las conexiones entrantes desde el cliente o asistente IA. */
  sanitizeClientConnections(conns: any[], targetNodes: UmlClassNode[]): UmlConnection[] {
    const sync = (this as any).diagramDocumentSyncService || this.documentSyncService;
    return sync.sanitizeClientConnections(
      conns,
      targetNodes,
      this.activeDiagramType(),
      this.defaultLineStyle(),
      (c: UmlConnection[], p?: boolean) => this.recalculateSequenceNumbers(c, p),
    );
  }

  /** Aplica mutaciones de nodos y conexiones emitidas por el componente Copilot IA. */
  onAiMutation(changes: { nodes: any[]; connections: any[] }): void {
    this.onApplyAiDiagramChanges(changes);
  }

  /** Aplica mutaciones completas de nodos y conexiones provenientes del asistente IA. */
  onApplyAiDiagramChanges(changes: { nodes: any[]; connections: any[] }): void {
    if (this.isReadOnly()) return;
    this.pushSnapshot();
    const { cleanNodes, cleanConns } = this.documentSyncService.processDocumentMutation({
      targetNodes: changes.nodes || [],
      targetConns: changes.connections || [],
      activeDiagramType: this.activeDiagramType(),
      defaultLineStyle: this.defaultLineStyle(),
      getDefaultColorForNodeType: (t?: string | null, s?: string | null) => this.getDefaultColorForNodeType(t, s),
      getOptimalConnectorId: (s: UmlClassNode, t: UmlClassNode) => this.getOptimalConnectorId(s, t),
      getConnectorPoint: (n: UmlClassNode, side: string) => this.getConnectorPoint(n, side),
      recalculateSequenceNumbers: (c: UmlConnection[], p?: boolean) => this.recalculateSequenceNumbers(c, p),
    });
    this.nodes.set(cleanNodes);
    this.connections.set(cleanConns);
    this.documentSyncService.schedulePostMutationRedraw({
      updateEndpoints: () => this.updateConnectionEndpoints(),
      resetCanvas: () => this.resetView(),
      fitView: () => this.fitView(),
      redrawCanvas: () => this.fCanvas?.redraw(),
    });
    this.markAsUnsaved();
    this.saveToBackend(false);
    this.sendDiagramSync(this.nodes(), this.connections(), 'ai_mutation');
  }

  /** Abre el modal de generación de proyectos Spring Boot. */
  openSpringBootModal(): void { this.modalService.openSpringBootModal(); }

  /** Cierra el modal de generación de proyectos Spring Boot. */
  closeSpringBootModal(): void { this.modalService.closeSpringBootModal(); }

  /** Abre el modal de perfil de usuario. */
  openProfileModal(): void { this.modalService.openProfileModal(); }

  /** Cierra el modal de perfil de usuario. */
  closeProfileModal(): void { this.modalService.closeProfileModal(); }

  /** Muestra una notificación flotante rápida en el editor. */
  showQuickToast(msg = '✅ Acción completada'): void {
    this.toastMessage.set(msg);
    this.toastService?.info?.(msg);
  }

  /** Alias para disparar notificación rápida. */
  triggerQuickToast(msg = '✅ Acción completada'): void {
    this.showQuickToast(msg);
  }
}
