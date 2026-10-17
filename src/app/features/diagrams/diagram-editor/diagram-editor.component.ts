import {
  Component,
  signal,
  ViewChild,
  OnInit,
  OnDestroy,
  HostListener,
  inject,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  FCreateConnectionEvent,
  FReassignConnectionEvent,
  FMoveNodesEvent,
  FSelectionChangeEvent,
} from '@foblex/flow';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { DIAGRAM_EDITOR_ICONS } from './diagram-editor.icons';

import { AuthService } from '../../../core/services/auth.service';
import { DiagramService } from '../../../core/services/diagram.service';
import { ProjectService } from '../../../core/services/project.service';
import { Project } from '../../../core/models/project.model';
import { CollaborationService, NodeLock } from '../../../core/services/collaboration.service';
import { AiAssistantService } from '../../../core/services/ai-assistant.service';
import { XmiService } from '../../../core/services/xmi.service';
import { BmpExportService } from '../../../core/services/bmp-export.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  DiagramType,
  UmlStereotype,
  UmlRelationshipType,
  UmlLineStyle,
  UmlClassNode,
  UmlConnection,
  UmlMessage,
  SaveDiagramAstRequest,
  UML_RELATION_TYPES,
  UML_LINE_STYLES,
} from '../../../core/models/diagram.model';

import { environment } from '../../../../environments/environment';
import { DiagramAppbarComponent } from './components/diagram-appbar/diagram-appbar.component';
import { DiagramSidebarComponent } from './components/diagram-sidebar/diagram-sidebar.component';
import { DiagramCanvasComponent, DiagramCanvasViewState } from './components/diagram-canvas/diagram-canvas.component';
import { DiagramStatusbarComponent } from './components/diagram-statusbar/diagram-statusbar.component';
import { AiAssistantPanelComponent } from './components/ai-assistant-panel/ai-assistant-panel.component';
import { UserProfileModalComponent } from './components/user-profile-modal/user-profile-modal.component';
import { SpringBootModalComponent } from './components/spring-boot-modal/spring-boot-modal.component';
import { EditNodeModalComponent } from './components/edit-node-modal/edit-node-modal.component';
import { EditConnectionModalComponent } from './components/edit-connection-modal/edit-connection-modal.component';
import { JsonModalComponent } from './components/json-modal/json-modal.component';
import { CreateDiagramModalComponent } from './components/create-diagram-modal/create-diagram-modal.component';
import { DiagramTabsComponent, DiagramTab } from './components/diagram-tabs/diagram-tabs.component';
import { DiagramContextMenuComponent, DiagramContextMenuState } from './components/diagram-context-menu/diagram-context-menu.component';
import { DiagramHistoryService, DiagramHistorySnapshot } from './services/diagram-history.service';
import { DiagramClipboardService } from './services/diagram-clipboard.service';
import { DiagramAlignmentService } from './services/diagram-alignment.service';
import { DiagramNodeFactoryService } from './services/diagram-node-factory.service';
import { DiagramNodeOperationsService, DropNodePayload } from './services/diagram-node-operations.service';
import { DiagramExportService } from './services/diagram-export.service';
import { DiagramImportService, DiagramImportResult } from './services/diagram-import.service';
import { DiagramConnectionLayoutService } from './services/diagram-connection-layout.service';
import { DiagramConnectionOperationsService } from './services/diagram-connection-operations.service';
import { DiagramSelectionService } from './services/diagram-selection.service';
import { DiagramTabManagerService } from './services/diagram-tab-manager.service';
import { DiagramAiSyncService, PREDEFINED_DATA_TYPES, PREDEFINED_RETURN_TYPES } from './services/diagram-ai-sync.service';
import { DiagramHotkeysService } from './services/diagram-hotkeys.service';
import { DiagramViewportService } from './services/diagram-viewport.service';
import { DiagramModalService } from './services/diagram-modal.service';
import { DiagramPersistenceService } from './services/diagram-persistence.service';
import { DiagramContainmentService } from './services/diagram-containment.service';
import { DiagramCanvasInteractionService } from './services/diagram-canvas-interaction.service';
import { DiagramCollaborationCoordinatorService } from './services/diagram-collaboration-coordinator.service';
import { DiagramContextMenuService } from './services/diagram-context-menu.service';
import { DiagramToolbarService } from './services/diagram-toolbar.service';
import {
  recalculateSequenceNumbers as recalculateSequenceNumbersLogic,
  generateNextSequenceMessage as generateNextSequenceMessageLogic,
} from './components/diagram-canvas/nodes';
import { TranslatePipe, TranslationService } from '../../../core/i18n';
import {
  getDefaultColorForNodeType,
  getDynamicNodeWidth,
  getNodeWidth,
  getNodeHeight,
  computeBoardWidth,
  computeBoardHeight,
} from './utils/node-metrics.util';
import { resolveUserRoleInProject } from './utils/project-role.util';

export interface UmlDiagramProject {
  version: string;
  name: string;
  createdDate: string;
  defaultLineStyle: UmlLineStyle;
  nodes: UmlClassNode[];
  connections: UmlConnection[];
}

export type { DiagramHistorySnapshot, DiagramTab, DiagramContextMenuState };

@Component({
  standalone: true,
  selector: 'app-diagram-editor',
  imports: [
    CommonModule,
    FormsModule,
    NgIconComponent,
    DiagramAppbarComponent,
    DiagramSidebarComponent,
    DiagramCanvasComponent,
    DiagramStatusbarComponent,
    AiAssistantPanelComponent,
    UserProfileModalComponent,
    SpringBootModalComponent,
    EditNodeModalComponent,
    EditConnectionModalComponent,
    JsonModalComponent,
    CreateDiagramModalComponent,
    DiagramTabsComponent,
    DiagramContextMenuComponent,
    TranslatePipe,
  ],
  providers: [provideIcons(DIAGRAM_EDITOR_ICONS)],
  templateUrl: './diagram-editor.component.html',
  styleUrl: './diagram-editor.component.css',
})
export class DiagramEditorComponent implements OnInit, OnDestroy {
  readonly authService = inject(AuthService);
  readonly diagramService = inject(DiagramService);
  readonly projectService = inject(ProjectService);
  readonly collaborationService = inject(CollaborationService);
  readonly aiAssistantService = inject(AiAssistantService);
  readonly xmiService = inject(XmiService);
  readonly bmpExportService = inject(BmpExportService);
  readonly translationService = inject(TranslationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirmDialogService = inject(ConfirmDialogService);
  readonly toastService = inject(ToastService);
  readonly diagramHistoryService = inject(DiagramHistoryService);
  readonly diagramClipboardService = inject(DiagramClipboardService);
  readonly diagramNodeFactoryService = inject(DiagramNodeFactoryService, { optional: true }) ?? new DiagramNodeFactoryService();
  readonly diagramNodeOperationsService = inject(DiagramNodeOperationsService, { optional: true }) ?? new DiagramNodeOperationsService();
  readonly diagramExportService = inject(DiagramExportService, { optional: true }) ?? new DiagramExportService();
  readonly diagramAlignmentService = inject(DiagramAlignmentService, { optional: true }) ?? new DiagramAlignmentService();
  readonly diagramConnectionLayoutService = inject(DiagramConnectionLayoutService, { optional: true }) ?? new DiagramConnectionLayoutService();
  readonly diagramConnectionOperationsService = inject(DiagramConnectionOperationsService, { optional: true }) ?? new DiagramConnectionOperationsService();
  readonly diagramSelectionService = inject(DiagramSelectionService, { optional: true }) ?? new DiagramSelectionService();
  readonly diagramTabManagerService = inject(DiagramTabManagerService, { optional: true }) ?? new DiagramTabManagerService();
  readonly diagramAiSyncService = inject(DiagramAiSyncService, { optional: true }) ?? new DiagramAiSyncService();
  readonly diagramImportService = inject(DiagramImportService, { optional: true }) ?? new DiagramImportService();
  readonly diagramHotkeysService = inject(DiagramHotkeysService, { optional: true }) ?? new DiagramHotkeysService();
  readonly diagramViewportService = inject(DiagramViewportService, { optional: true }) ?? new DiagramViewportService();
  readonly diagramModalService = inject(DiagramModalService, { optional: true }) ?? new DiagramModalService();
  readonly diagramPersistenceService = inject(DiagramPersistenceService, { optional: true }) ?? new DiagramPersistenceService();
  readonly diagramContainmentService = inject(DiagramContainmentService, { optional: true }) ?? new DiagramContainmentService();
  readonly diagramCanvasInteractionService = inject(DiagramCanvasInteractionService, { optional: true }) ?? new DiagramCanvasInteractionService(this.containmentService);
  readonly diagramCollaborationCoordinatorService = inject(DiagramCollaborationCoordinatorService, { optional: true }) ?? new DiagramCollaborationCoordinatorService();
  readonly diagramContextMenuService = inject(DiagramContextMenuService, { optional: true }) ?? new DiagramContextMenuService(this.selectionService);
  readonly diagramToolbarService = inject(DiagramToolbarService, { optional: true }) ?? new DiagramToolbarService(
    this.alignmentService,
    this.selectionService,
    this.nodeOps,
  );

  private get nodeFactory(): DiagramNodeFactoryService { return this.diagramNodeFactoryService || new DiagramNodeFactoryService(); }
  private get nodeOps(): DiagramNodeOperationsService { return this.diagramNodeOperationsService || new DiagramNodeOperationsService(this.nodeFactory); }
  private get exportService(): DiagramExportService { return this.diagramExportService || new DiagramExportService(); }
  private get importService(): DiagramImportService { return this.diagramImportService || new DiagramImportService(); }
  private get alignmentService(): DiagramAlignmentService { return this.diagramAlignmentService || new DiagramAlignmentService(); }
  private get connectionLayoutService(): DiagramConnectionLayoutService { return this.diagramConnectionLayoutService || new DiagramConnectionLayoutService(); }
  private get connectionOps(): DiagramConnectionOperationsService { return this.diagramConnectionOperationsService || new DiagramConnectionOperationsService(this.connectionLayoutService); }
  private get selectionService(): DiagramSelectionService { return this.diagramSelectionService || new DiagramSelectionService(); }
  private get tabManager(): DiagramTabManagerService { return this.diagramTabManagerService || new DiagramTabManagerService(); }
  private get aiSyncService(): DiagramAiSyncService { return this.diagramAiSyncService || new DiagramAiSyncService(); }
  private get hotkeysService(): DiagramHotkeysService { return this.diagramHotkeysService || new DiagramHotkeysService(); }
  private get viewportService(): DiagramViewportService { return this.diagramViewportService || new DiagramViewportService(); }
  private get modalService(): DiagramModalService { return this.diagramModalService || new DiagramModalService(); }
  private get persistenceService(): DiagramPersistenceService { return this.diagramPersistenceService || new DiagramPersistenceService(); }
  private get containmentService(): DiagramContainmentService { return this.diagramContainmentService || new DiagramContainmentService(); }
  private get interactionService(): DiagramCanvasInteractionService { return this.diagramCanvasInteractionService || new DiagramCanvasInteractionService(this.containmentService); }
  private get collabCoordinator(): DiagramCollaborationCoordinatorService { return this.diagramCollaborationCoordinatorService || new DiagramCollaborationCoordinatorService(); }
  private get contextMenuService(): DiagramContextMenuService { return this.diagramContextMenuService || new DiagramContextMenuService(this.selectionService); }
  private get toolbarService(): DiagramToolbarService {
    return this.diagramToolbarService || new DiagramToolbarService(
      this.alignmentService,
      this.selectionService,
      this.nodeOps,
    );
  }

  // Lista reactiva de diagramas del proyecto para el Explorador por tipo
  readonly projectDiagrams = this.diagramService.projectDiagrams;

  // Indica si hay 2 o más usuarios editando concurrentemente en la sala
  readonly hasMultipleActiveUsers = computed(() => {
    return this.collabCoordinator.isMultiUserEditing();
  });

  @ViewChild('diagramCanvas') diagramCanvas?: DiagramCanvasComponent;
  @ViewChild(DiagramSidebarComponent) diagramSidebar?: DiagramSidebarComponent;

  // Contexto del diagrama y proyecto
  currentDiagramId = signal<string | null>(null);
  currentProjectId = signal<string | null>(null);
  currentProject = signal<Project | null>(null);
  readonly currentDiagramName = this.tabManager.currentDiagramName;
  readonly saveSuccessMessage = this.persistenceService.saveSuccessMessage;
  readonly hasUnsavedChanges = this.persistenceService.hasUnsavedChanges;
  readonly zoomLevel = this.viewportService.zoomLevel;

  // Notificaciones flotantes unificadas con ToastService
  readonly quickToast = signal<string | null>(null);

  showQuickToast(msg: string): void {
    if (this.toastService?.info) {
      this.toastService.info(msg);
    }
  }

  /**
   * Ejecuta una mutación atómica de estado en el diagrama:
   * 1. Registra snapshot en el historial Undo/Redo (si aplica).
   * 2. Actualiza los signals inmutables `nodes` y/o `connections`.
   * 3. Marca el diagrama con cambios sin guardar (`hasUnsavedChanges`).
   * 4. Recalcula automáticamente puertos geométricos y anclas de conexión.
   * 5. Emite evento de sincronización en tiempo real vía WebSocket.
   * 6. Opcionalmente solicita redibujado de la capa de conexiones del canvas.
   */
  private commitDiagramMutation(options: {
    nodes?: UmlClassNode[];
    connections?: UmlConnection[];
    action: string;
    recordHistory?: boolean;
    redrawCanvas?: boolean;
  }): void {
    if (options.recordHistory !== false) {
      this.pushSnapshot();
    }
    if (options.nodes) {
      this.nodes.set(options.nodes);
    }
    if (options.connections) {
      this.connections.set(options.connections);
    }
    this.markAsUnsaved();
    this.updateConnectionEndpoints();
    this.collabCoordinator.sendDiagramSync(
      this.nodes(),
      this.connections(),
      options.action,
      this.defaultLineStyle(),
    );
    if (options.redrawCanvas) {
      this.diagramCanvas?.redraw();
    }
  }

  // Menú contextual flotante (clic derecho)
  readonly contextMenu = this.contextMenuService.contextMenu;

  hasClipboardContent(): boolean {
    return this.diagramClipboardService.hasClipboardContent();
  }

  // Tipos de Diagrama & Paneles (Arquitectura Extensible para Casos de Uso, Secuencia, etc.)
  readonly activeDiagramType = signal<DiagramType>(DiagramType.CLASS);

  // Pestañas abiertas en el lienzo (Multi-diagram tabs)
  readonly openTabs = this.tabManager.openTabs;

  // Marcar cambios pendientes y actualizar borrador local
  markAsUnsaved(): void {
    this.persistenceService.markAsUnsaved(
      this.isReadOnly(),
      this.currentDiagramId(),
      {
        nodes: this.nodes(),
        connections: this.connections(),
        defaultLineStyle: this.defaultLineStyle(),
      },
    );
  }

  private clearLocalDraft(diagramId: string): void { this.persistenceService.clearLocalDraft(diagramId); }

  // Rol del usuario actual en el proyecto
  currentUserRole = signal<string>('EDITOR');
  readonly isReadOnly = computed(() => this.currentUserRole() === 'VIEWER');

  // Modo Seleccionar / Mover o Crear Relación
  selectedRelationType = signal<UmlRelationshipType | null>(null);
  selectedSourceNodeId = signal<string | null>(null);
  readonly selectedNodeId = this.selectionService.selectedNodeId;
  readonly selectedNodeIds = this.selectionService.selectedNodeIds;
  readonly selectedNodeIdsList = this.selectionService.selectedNodeIdsList;
  readonly selectedConnId = this.selectionService.selectedConnId;
  readonly selectedConnIds = this.selectionService.selectedConnIds;
  readonly selectedConnIdsList = this.selectionService.selectedConnIdsList;

  getDefaultColorForNodeType(nodeType?: string | null, stereotype?: string | null): string {
    return getDefaultColorForNodeType(nodeType, stereotype);
  }

  readonly selectedNodeColor = computed(() => {
    return this.toolbarService.computeSelectedNodeColor(
      this.selectedNodeId(),
      this.nodes(),
      (type, st) => this.getDefaultColorForNodeType(type, st),
    );
  });
  defaultLineStyle = signal<UmlLineStyle>('segment');
  mouseCanvasPos = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  get smartGuidesEnabled() { return this.toolbarService.smartGuidesEnabled; }

  private isApplyingHistory = false;
  get hasMovedDuringPointerDown(): boolean { return this.interactionService.hasMovedDuringPointerDown; }
  set hasMovedDuringPointerDown(val: boolean) { this.interactionService.hasMovedDuringPointerDown = val; }

  historyUndoCount = computed(() => this.diagramHistoryService.undoCount());
  historyRedoCount = computed(() => this.diagramHistoryService.redoCount());
  readonly canUndo = computed(() => this.diagramHistoryService.canUndo() && !this.isReadOnly());
  readonly canRedo = computed(() => this.diagramHistoryService.canRedo() && !this.isReadOnly());

  // Paneles laterales (Toolbox / Sidebar y Copilot IA) - Abierto por defecto con Explorador
  readonly isSidebarOpen = signal<boolean>(true);
  readonly isToolboxOpen = this.isSidebarOpen;
  isAiPanelOpen = signal<boolean>(false);
  readonly isExportDropdownOpen = this.modalService.isExportDropdownOpen;

  // Opciones de multiplicidad estándar
  readonly multiplicityOptions: string[] = ['1', '0..1', '1..*', '0..*', '*', 'n', 'm'];

  // Tipos de datos y retornos predefinidos
  readonly predefinedTypes = PREDEFINED_DATA_TYPES;
  readonly predefinedReturnTypes = PREDEFINED_RETURN_TYPES;

  // Lista de relaciones (reutilizadas en modal de conexión)
  readonly relationTypes = UML_RELATION_TYPES;

  // Estilos de línea Enterprise Architect
  readonly lineStyles = UML_LINE_STYLES;

  // Modales de edición delegados a DiagramModalService
  readonly isEditNodeModalOpen = this.modalService.isEditNodeModalOpen;
  readonly isEditConnModalOpen = this.modalService.isEditConnModalOpen;
  readonly editingNode = this.modalService.editingNode;
  readonly editingConnection = this.modalService.editingConnection;
  readonly isAnyModalOpen = this.modalService.isAnyModalOpen;

  // Modal JSON
  readonly showJsonModal = this.modalService.showJsonModal;
  readonly jsonContent = this.modalService.jsonContent;
  readonly jsonModalMode = this.modalService.jsonModalMode;

  // Modal Perfil
  readonly isProfileModalOpen = this.modalService.isProfileModalOpen;

  // Modal Spring Boot
  readonly showSpringBootModal = this.modalService.showSpringBootModal;

  // Modal Crear Diagrama por Tipo
  readonly isCreateDiagramModalOpen = this.modalService.isCreateDiagramModalOpen;
  readonly createDiagramLockedType = this.modalService.lockedDiagramType;

  nodes = signal<UmlClassNode[]>([]);
  connections = signal<UmlConnection[]>([]);

  // Dimensiones dinámicas del tablero Enterprise Architect (mínimo 2200x1400, expande con nodos)
  readonly boardWidth = computed(() => computeBoardWidth(this.nodes()));
  readonly boardHeight = computed(() => computeBoardHeight(this.nodes()));

  ngOnInit(): void {
    this.initCollaborationSubscriptions();
    this.initPersistencePipelines();
    this.route.queryParams.subscribe((params) => this.handleRouteQueryParams(params));
    this.updateConnectionEndpoints();
  }

  private initCollaborationSubscriptions(): void {
    this.collabCoordinator.setupSubscriptions({
      onRemoteNodeDrag: (data) => {
        this.nodes.update((list) =>
          list.map((n) => (n.id === data.nodeId ? { ...n, position: data.position } : n)),
        );
        this.updateConnectionEndpoints();
      },
      onRemoteDiagramSync: (data) => this.applyRemoteDiagramSync(data),
      onNodeLockRejected: (data) => this.handleNodeLockRejected(data),
      onServerSave: (data) => {
        if (data.diagramId === this.currentDiagramId()) {
          this.diagramService.isSaving.set(false);
          this.diagramService.lastSavedAt.set(new Date(data.savedAt));
          if (!this.hasUnsavedChanges()) this.persistenceService.notifySaveSuccess(2000);
        }
      },
      onReconnected: () => this.handleReconnection(),
    });
  }

  private applyRemoteDiagramSync(data: { action: string; nodes?: UmlClassNode[]; connections?: UmlConnection[] }): void {
    if (data.action === 'ai_mutation' && data.nodes) {
      this.applyAiMutationWithAnimation(data.nodes, data.connections || []);
    } else if (data.nodes) {
      const { cleanNodes, cleanConns } = this.processAiMutation(data.nodes, data.connections || []);
      this.nodes.set(cleanNodes);
      this.connections.set(cleanConns);
      this.updateConnectionEndpoints();
      requestAnimationFrame(() => {
        this.updateConnectionEndpoints();
        this.diagramCanvas?.redraw();
      });
    }
  }

  private handleNodeLockRejected(data: { nodeId: string; lockedBy: { userId: string; userName: string } }): void {
    if (this.editingNode()?.id === data.nodeId) {
      this.isEditNodeModalOpen.set(false);
      this.editingNode.set(null);
      this.toastService.warning(`🔒 La tabla está siendo editada por ${data.lockedBy.userName}. Por favor espera.`);
    }
  }

  private handleReconnection(): void {
    const diagramId = this.currentDiagramId();
    if (!diagramId) return;
    if (this.hasUnsavedChanges()) {
      this.collabCoordinator.sendDiagramSync(
        this.nodes(),
        this.connections(),
        'reconnect_sync',
        this.defaultLineStyle(),
      );
      this.saveToBackend(true);
    } else {
      this.loadDiagramFromBackend(diagramId);
    }
  }

  private initPersistencePipelines(): void {
    this.persistenceService.setupAutoSave(() => {
      if (this.hasUnsavedChanges() && !this.isReadOnly() && this.currentDiagramId()) {
        this.saveToBackend(true);
      }
    });

    this.persistenceService.setupNodeDragEnd(() => {
      this.containmentService.resetDragState();
      if (!this.isReadOnly() && this.currentDiagramId()) {
        this.collabCoordinator.sendDiagramSync(
          this.nodes(),
          this.connections(),
          'move_node',
          this.defaultLineStyle(),
        );
        this.persistenceService.triggerAutoSave();
      }
    });
  }

  private handleRouteQueryParams(params: any): void {
    this.tabManager.handleRouteQueryParams(params, {
      userId: this.authService.currentUser()?.id,
      setCurrentProjectId: (id) => this.currentProjectId.set(id),
      setCurrentDiagramId: (id) => this.currentDiagramId.set(id),
      setCurrentDiagramName: (name) => this.currentDiagramName.set(name),
      setCurrentProject: (proj) => this.currentProject.set(proj),
      setCurrentUserRole: (role) => this.currentUserRole.set(role),
      loadDiagramsByProject: (pId) => this.diagramService.loadDiagramsByProject(pId),
      getProject: (pId) => this.projectService.getProject(pId),
      loadDiagram: (dId) => this.loadDiagramFromBackend(dId),
      resolveUserRole: (proj, uId) => resolveUserRoleInProject(proj, uId),
    });
  }

  ngOnDestroy(): void {
    if (this.editingNode()) {
      this.collabCoordinator.releaseNodeLock(this.editingNode()!.id);
    }
    this.collabCoordinator.leaveRoom();
  }

  loadDiagramFromBackend(diagramId: string): void {
    this.persistenceService.executeLoadDiagram(this.diagramService, diagramId, {
      getDefaultColor: (nt, st) => this.getDefaultColorForNodeType(nt, st),
      normalizeDataType: (t) => this.aiSyncService.normalizeDataType(t),
      normalizeReturnType: (t) => this.aiSyncService.normalizeReturnType(t),
      recalculateSequenceNumbers: (conns, p) => this.recalculateSequenceNumbers(conns, p),
      onLoaded: (diagram, resolved) => {
        this.currentDiagramName.set(diagram.name);
        if (diagram.type) {
          this.activeDiagramType.set(diagram.type as DiagramType);
          this.collabCoordinator.setCurrentDiagramType(diagram.type);
        }
        if (diagram.defaultLineStyle) {
          this.defaultLineStyle.set(diagram.defaultLineStyle as UmlLineStyle);
        }

        this.nodes.set(resolved.nodes);
        this.connections.set(resolved.connections);
        if (resolved.defaultLineStyle) {
          this.defaultLineStyle.set(resolved.defaultLineStyle);
        }

        if (resolved.fromDraft) {
          this.markAsUnsaved();
          this.updateConnectionEndpoints();
          return;
        }

        this.selectionService.clearSelection();
        this.selectedSourceNodeId.set(null);
        this.diagramHistoryService.clear();

        const diagType = (diagram.type as DiagramType) || DiagramType.CLASS;
        this.tabManager.addTab({ id: diagram.id, name: diagram.name, type: diagType });
        this.tabManager.updateTabName(diagram.id, diagram.name);
        this.collabCoordinator.switchRoom(this.collabCoordinator.getCurrentDiagramId(), diagramId);

        this.syncProjectInfo(diagram.projectId);

        this.hasUnsavedChanges.set(false);
        this.viewportService.restoreCanvasViewState(this.diagramCanvas, diagramId, () => this.updateConnectionEndpoints());
      },
    });
  }

  private syncProjectInfo(projectId?: string | null): void {
    this.persistenceService.syncProjectInfo(projectId, {
      hasCurrentProject: !!this.currentProject(),
      projectDiagramsCount: this.diagramService.projectDiagrams().length,
      setCurrentProjectId: (id) => this.currentProjectId.set(id),
      fetchProject: (id) => this.projectService.getProject(id),
      fetchProjectDiagrams: (id) => this.diagramService.loadDiagramsByProject(id),
      onProjectLoaded: (proj) => this.currentProject.set(proj),
    });
  }

  isNodeLockedByOther(nodeId: string): boolean { return this.collabCoordinator.isNodeLockedByOther(nodeId, this.authService.currentUser()?.id); }

  @HostListener('window:pagehide')
  onPageHide(): void {
    this.flushExitSave();
    this.collabCoordinator.leaveRoom();
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) {
      this.flushExitSave();
      event.preventDefault();
      event.returnValue = '';
    } else {
      this.collabCoordinator.leaveRoom();
    }
  }

  private flushExitSave(): void {
    this.persistenceService.flushExitSave({
      diagramId: this.currentDiagramId(),
      isReadOnly: this.isReadOnly(),
      hasUnsavedChanges: this.hasUnsavedChanges(),
      token: this.authService.token(),
      apiUrl: environment.apiUrl,
      payload: this.buildSaveAstPayload(),
      onSendDiagramSync: () =>
        this.collabCoordinator.sendDiagramSync(
          this.nodes(),
          this.connections(),
          'exit_save',
          this.defaultLineStyle(),
        ),
    });
  }

  @HostListener('window:mousedown') onWindowMouseDown(): void { this.interactionService.handleWindowMouseDown(); }
  @HostListener('window:mouseup') onWindowMouseUp(): void { this.interactionService.handleWindowMouseUp(); }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    this.hotkeysService.handleKeyDown(event, {
      isReadOnly: () => this.isReadOnly(),
      isModalOpen: () => this.isAnyModalOpen(),
      undo: () => this.undo(),
      redo: () => this.redo(),
      save: () => this.saveToBackend(),
      toggleToolbox: () => this.isToolboxOpen.set(!this.isToolboxOpen()),
      toggleAi: () => this.isAiPanelOpen.set(!this.isAiPanelOpen()),
      copy: () => this.copySelectedNodes(),
      cut: () => this.cutSelectedNodes(),
      paste: () => this.pasteNodes(),
      duplicate: () => this.duplicateSelected(),
      selectAll: () => this.selectAllClasses(),
      deleteSelected: () => this.deleteSelected(),
      escape: () => this.handleEscapeKey(),
      hasContextMenu: () => !!this.contextMenu(),
      closeContextMenu: () => this.closeContextMenu(),
      getRenameTargetNodeId: () => this.getRenameTargetNodeId(),
      startRenameNode: (targetNodeId: string) => this.diagramCanvas?.startRenameNode(targetNodeId),
    });
  }

  private handleEscapeKey(): void {
    this.selectionService.clearSelection();
    this.setPointerMode();
    this.modalService.closeAllModals((nodeId) => this.collabCoordinator.releaseNodeLock(nodeId));
  }

  private getRenameTargetNodeId(): string | null {
    const isExplorerHovered =
      this.isSidebarOpen() &&
      this.diagramSidebar?.activeTab() === 'explorer' &&
      !!this.diagramSidebar?.hoveredDiagramId();
    if (isExplorerHovered) return null;
    return this.diagramCanvas?.hoveredNodeId() || this.selectedNodeId();
  }

  buildSaveAstPayload(): SaveDiagramAstRequest {
    return this.exportService.buildSaveAstPayload(
      this.activeDiagramType(),
      this.defaultLineStyle(),
      this.nodes(),
      this.connections(),
      (n: UmlClassNode) => this.getNodeWidth(n),
      (n: UmlClassNode) => this.getNodeHeight(n),
      (nodeType?: string | null, stereotype?: string | null) => this.getDefaultColorForNodeType(nodeType, stereotype),
      (m: any, defaultSeq?: string) => this.normalizeUmlMessage(m, defaultSeq),
      (conns: UmlConnection[], preserveOrder?: boolean) => this.recalculateSequenceNumbers(conns, preserveOrder),
    );
  }

  saveToBackend(silent = false): void {
    if (this.isReadOnly()) return;
    const diagramId = this.currentDiagramId();
    if (!diagramId) {
      if (!silent) this.openExportModal();
      return;
    }
    this.persistenceService.executeSaveToBackend(
      this.diagramService,
      diagramId,
      this.buildSaveAstPayload(),
      silent,
      () => this.collabCoordinator.sendDiagramSync(this.nodes(), this.connections(), 'save', this.defaultLineStyle()),
    );
  }

  selectRelationType(type: UmlRelationshipType): void {
    if (this.isReadOnly()) return;
    this.selectedRelationType.set(this.selectedRelationType() === type ? null : type);
    this.selectedSourceNodeId.set(null);
  }

  setPointerMode(): void {
    this.selectedRelationType.set(null);
    this.selectedSourceNodeId.set(null);
  }

  setDefaultLineStyle(style: UmlLineStyle): void {
    if (this.defaultLineStyle() !== style) {
      this.pushSnapshot();
      this.defaultLineStyle.set(style);
      this.markAsUnsaved();
    }
  }

  onNodePositionChange(node: UmlClassNode, newPosition: { x: number; y: number }): void {
    if (this.isReadOnly() || this.isNodeLockedByOther(node.id)) return;
    const { shouldRedraw } = this.interactionService.handleNodePositionChange({
      node,
      newPosition,
      nodes: this.nodes(),
      selectedNodeIds: this.selectedNodeIds(),
      selectedNodeId: this.selectedNodeId(),
      activeDiagramType: this.activeDiagramType(),
      getNodeWidth: (n) => this.getNodeWidth(n),
      getNodeHeight: (n) => this.getNodeHeight(n),
      onStartDrag: () => this.pushSnapshot(),
      onSelectNode: (id) => this.selectionService.setNodeSelection([id]),
      sendNodeDrag: (id, pos) => this.collabCoordinator.sendNodeDrag(id, pos),
    });
    if (shouldRedraw) this.diagramCanvas?.redraw();
    this.markAsUnsaved();
    this.updateConnectionEndpoints();
    this.persistenceService.triggerNodeDragEnd();
  }

  onNodeLabelOffsetChange(node: UmlClassNode, offset: { x: number; y: number }): void {
    if (this.isReadOnly() || this.isNodeLockedByOther(node.id)) return;
    this.commitDiagramMutation({
      nodes: this.nodeOps.updateNodeLabelOffset(this.nodes(), node.id, offset),
      action: 'move_node',
    });
  }

  onMoveNodes(event: FMoveNodesEvent): void {
    if (this.isReadOnly()) return;
    const { anyMoved } = this.interactionService.handleMoveNodes({
      event,
      nodes: this.nodes(),
      activeDiagramType: this.activeDiagramType(),
      getNodeWidth: (n) => this.getNodeWidth(n),
      getNodeHeight: (n) => this.getNodeHeight(n),
      onStartDrag: () => this.pushSnapshot(),
      sendNodeDrag: (id, pos) => this.collabCoordinator.sendNodeDrag(id, pos),
    });
    if (anyMoved) {
      this.nodes.set([...this.nodes()]);
      this.markAsUnsaved();
      this.updateConnectionEndpoints();
      this.diagramCanvas?.redraw();
      this.persistenceService.triggerNodeDragEnd();
    }
  }

  onCanvasMouseMove(event: MouseEvent): void {
    const coords = this.interactionService.handleCanvasMouseMove(
      event,
      this.diagramCanvas?.getExportElement(),
      this.diagramCanvas?.canvas?.transform,
      (x, y) => this.collabCoordinator.sendCursorPosition(x, y),
    );
    if (coords) this.mouseCanvasPos.set(coords);
  }

  getDynamicNodeWidth(node: UmlClassNode): number { return getDynamicNodeWidth(node); }
  getNodeWidth(node: UmlClassNode): number { return getNodeWidth(node); }
  getNodeHeight(node: UmlClassNode): number { return getNodeHeight(node); }

  onNodeSizeChanged(event: { node: UmlClassNode; width: number; height?: number; position: { x: number; y: number } }): void {
    if (this.isReadOnly() || this.isNodeLockedByOther(event.node.id)) return;
    this.commitDiagramMutation({
      nodes: this.nodeOps.updateNodeSize(this.nodes(), event),
      action: 'update',
      redrawCanvas: true,
    });
  }

  toggleSmartGuides(): void {
    this.toolbarService.toggleSmartGuides();
  }

  private applyNodesTransformation(modified: UmlClassNode[], action: string): void {
    this.toolbarService.applyNodesTransformation(modified, action, {
      pushSnapshot: () => this.pushSnapshot(),
      nodes: this.nodes(),
      connections: this.connections(),
      defaultLineStyle: this.defaultLineStyle(),
      markAsUnsaved: () => this.markAsUnsaved(),
      updateConnectionEndpoints: () => this.updateConnectionEndpoints(),
      redrawCanvas: () => this.diagramCanvas?.redraw(),
      sendNodeDrag: (id, pos) => this.collabCoordinator.sendNodeDrag(id, pos),
      sendDiagramSync: (nodes, conns, act, style) => this.collabCoordinator.sendDiagramSync(nodes, conns, act, style),
    });
  }

  alignNodes(direction: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'): void {
    this.toolbarService.alignNodes(direction, {
      isReadOnly: this.isReadOnly(),
      selectedNodeIds: this.selectedNodeIds(),
      nodes: this.nodes(),
      getNodeWidth: (n) => this.getNodeWidth(n),
      getNodeHeight: (n) => this.getNodeHeight(n),
      onApplyTransformation: (mod, act) => this.applyNodesTransformation(mod, act),
    });
  }

  distributeNodes(direction: 'horizontal' | 'vertical'): void {
    this.toolbarService.distributeNodes(direction, {
      isReadOnly: this.isReadOnly(),
      selectedNodeIds: this.selectedNodeIds(),
      nodes: this.nodes(),
      getNodeWidth: (n) => this.getNodeWidth(n),
      getNodeHeight: (n) => this.getNodeHeight(n),
      onApplyTransformation: (mod, act) => this.applyNodesTransformation(mod, act),
    });
  }

  snapSelectedToGrid(gridSize = 20): void {
    this.toolbarService.snapSelectedToGrid(
      {
        isReadOnly: this.isReadOnly(),
        selectedNodeIds: this.selectedNodeIds(),
        nodes: this.nodes(),
        getNodeWidth: (n) => this.getNodeWidth(n),
        getNodeHeight: (n) => this.getNodeHeight(n),
        onApplyTransformation: (mod, act) => this.applyNodesTransformation(mod, act),
      },
      gridSize,
    );
  }

  getOptimalConnectorId(sourceNode: UmlClassNode, targetNode: UmlClassNode): { sourceId: string; targetId: string } {
    return this.connectionLayoutService.getOptimalConnectorId(sourceNode, targetNode, (n) => this.getNodeWidth(n), (n) => this.getNodeHeight(n));
  }

  getConnectorPoint(node: UmlClassNode, side: string): { x: number; y: number } {
    return this.connectionLayoutService.getConnectorPoint(node, side, (n) => this.getNodeHeight(n));
  }

  updateConnectionEndpoints(): void {
    const result = this.connectionLayoutService.recalculateConnectionEndpoints(
      this.nodes(),
      this.connections(),
      this.activeDiagramType(),
      this.defaultLineStyle(),
      (n) => this.getNodeWidth(n),
      (n) => this.getNodeHeight(n),
    );
    if (result.anchorMoved) this.nodes.set(result.updatedNodes);
    this.connections.set(result.updatedConnections);
  }

  onCanvasMouseDown(event: MouseEvent): void {
    this.interactionService.handleCanvasMouseDown(event, () => this.closeContextMenu());
  }

  onCanvasBackgroundClick(event?: MouseEvent): void {
    this.interactionService.handleCanvasBackgroundClick(event, () => this.deselectAll());
  }

  deselectAll(): void {
    this.selectedSourceNodeId.set(null);
    this.selectionService.clearSelection();
    this.diagramCanvas?.clearSelection();
    this.closeContextMenu();
  }

  onSelectionChange(event: FSelectionChangeEvent): void {
    this.selectionService.onSelectionChange(event, this.nodes(), this.connections(), this.selectedRelationType());
  }

  selectAllClasses(): void {
    this.selectionService.selectAllClasses(this.nodes(), this.selectedRelationType(), (allIds) => this.diagramCanvas?.select(allIds, []));
  }

  deleteSelected(): void {
    if (this.isReadOnly()) return;
    const nodeIds = this.selectedNodeIdsList();
    const connIds = this.selectedConnIdsList();
    if (nodeIds.length === 0 && connIds.length === 0) return;

    this.pushSnapshot();
    for (const id of nodeIds) this.removeClass(id, undefined, false);
    for (const id of connIds) this.removeConnection(id);
    this.deselectAll();
  }

  onConnectionSelect(connId: string, event: MouseEvent): void {
    if (this.contextMenu()) this.closeContextMenu();
    this.selectionService.onConnectionSelect(connId, event, this.selectedRelationType(), (n, c) => this.diagramCanvas?.select(n, c));
  }

  onNodeSelect(nodeId: string, event: MouseEvent): void {
    if (this.contextMenu()) this.closeContextMenu();
    this.selectionService.onNodeSelect(
      nodeId,
      event,
      this.selectedRelationType(),
      this.hasMovedDuringPointerDown,
      (n, c) => this.diagramCanvas?.select(n, c),
      () => this.diagramCanvas?.clearSelection(),
    );
  }

  private cloneSnapshot(): DiagramHistorySnapshot {
    return this.diagramHistoryService.cloneSnapshot(this.nodes(), this.connections(), this.defaultLineStyle());
  }

  pushSnapshot(): void {
    if (!this.isApplyingHistory) this.diagramHistoryService.pushSnapshot(this.cloneSnapshot());
  }

  private applyHistorySnapshot(snapshot: DiagramHistorySnapshot, action: 'undo' | 'redo'): void {
    this.isApplyingHistory = true;
    this.nodes.set(snapshot.nodes);
    this.connections.set(snapshot.connections);
    this.defaultLineStyle.set(snapshot.defaultLineStyle);
    this.selectionService.clearSelection();
    this.markAsUnsaved();
    this.updateConnectionEndpoints();
    requestAnimationFrame(() => {
      this.updateConnectionEndpoints();
      this.diagramCanvas?.reset();
      this.isApplyingHistory = false;
    });
    this.collabCoordinator.sendDiagramSync(
      this.nodes(),
      this.connections(),
      action,
      this.defaultLineStyle(),
    );
    this.persistenceService.triggerAutoSave();
  }

  undo(): void {
    if (this.isReadOnly() || !this.diagramHistoryService.canUndo()) return;
    const prev = this.diagramHistoryService.undo(this.cloneSnapshot());
    if (prev) this.applyHistorySnapshot(prev, 'undo');
  }

  redo(): void {
    if (this.isReadOnly() || !this.diagramHistoryService.canRedo()) return;
    const next = this.diagramHistoryService.redo(this.cloneSnapshot());
    if (next) this.applyHistorySnapshot(next, 'redo');
  }



  private generateNextSequenceMessage(
    sourceNode?: UmlClassNode,
    targetNode?: UmlClassNode,
    isReturn: boolean = false,
  ): UmlMessage[] {
    return generateNextSequenceMessageLogic(sourceNode, targetNode, isReturn);
  }

  private recalculateSequenceNumbers(
    connectionsList: UmlConnection[],
    preserveSequenceNumbers = false,
  ): UmlConnection[] {
    return recalculateSequenceNumbersLogic(
      connectionsList,
      this.nodes(),
      this.activeDiagramType(),
      preserveSequenceNumbers,
    );
  }

  onTableClick(nodeId: string, event: MouseEvent): void {
    this.connectionOps.handleTableClick(nodeId, event, {
      isReadOnly: this.isReadOnly(),
      isLocked: this.isNodeLockedByOther(nodeId),
      activeRel: this.selectedRelationType(),
      currentSource: this.selectedSourceNodeId(),
      setSourceNodeId: (id) => this.selectedSourceNodeId.set(id),
      onMouseMove: (e) => this.onCanvasMouseMove(e),
      activeDiagramType: this.activeDiagramType(),
      nodes: this.nodes(),
      connections: this.connections(),
      defaultLineStyle: this.defaultLineStyle(),
      getOptimalConnectorId: (s, t) => this.getOptimalConnectorId(s, t),
      generateNextSequenceMessage: (s, t, isRet) => this.generateNextSequenceMessage(s, t, isRet),
      onApplyNewConnection: (newConn, isSeqRel) => this.applyNewConnection(newConn, isSeqRel),
      onApplyAssociationClass: (assocResult) => this.applyCreatedAssociationClass(assocResult),
    });
  }

  private applyNewConnection(newConn: UmlConnection, isSeqRel: boolean): void {
    const updated = this.recalculateSequenceNumbers([...this.connections(), newConn]);
    this.commitDiagramMutation({
      connections: updated,
      action: 'create_conn',
    });
    this.setPointerMode();
    if (isSeqRel) {
      const created = this.connections().find((c) => c.id === newConn.id) || newConn;
      setTimeout(() => this.openEditConnModal(created), 100);
    }
  }

  private applyCreatedAssociationClass(result: { nodes: UmlClassNode[]; connections: UmlConnection[] }): void {
    this.commitDiagramMutation({
      nodes: result.nodes,
      connections: result.connections,
      action: 'create_assoc_class',
    });
    this.setPointerMode();
    requestAnimationFrame(() => {
      this.updateConnectionEndpoints();
      this.diagramCanvas?.reset();
    });
  }

  onFlowLoaded(): void {
    this.updateConnectionEndpoints();
    this.diagramCanvas?.redraw();
    this.syncZoomFromCanvas();
  }

  onConnectionCreated(event: FCreateConnectionEvent): void {
    this.connectionOps.handleConnectionCreated(event, {
      isReadOnly: this.isReadOnly(),
      selectedRelationType: this.selectedRelationType(),
      activeDiagramType: this.activeDiagramType(),
      defaultLineStyle: this.defaultLineStyle(),
      nodes: this.nodes(),
      connections: this.connections(),
      isNodeLockedByOther: (id) => this.isNodeLockedByOther(id),
      generateNextSequenceMessage: (src, tgt, isReturn) => this.generateNextSequenceMessage(src, tgt, isReturn),
      onApplyNewConnection: (newConn, isSeqRel) => this.applyNewConnection(newConn, isSeqRel),
      onApplyAssocClass: (res) => this.applyCreatedAssociationClass(res),
    });
  }

  onConnectionReassigned(event: FReassignConnectionEvent): void {
    this.connectionOps.handleConnectionReassigned(event, {
      isReadOnly: this.isReadOnly(),
      connections: this.connections(),
      activeDiagramType: this.activeDiagramType(),
      onApplyReassigned: (updatedList) => {
        this.commitDiagramMutation({
          connections: this.recalculateSequenceNumbers(updatedList),
          action: 'reassign_conn',
        });
      },
    });
  }

  onSequenceMessageMove(event: { connectionId: string; targetSlot: number }): void {
    this.connectionOps.handleSequenceMessageMove(event, {
      isReadOnly: this.isReadOnly(),
      connections: this.connections(),
      activeDiagramType: this.activeDiagramType(),
      onApplyMoved: (moved) => {
        this.commitDiagramMutation({
          connections: this.recalculateSequenceNumbers(moved),
          action: 'move_seq_msg',
        });
      },
    });
  }

  private getScrollOffset(): { scrollLeft: number; scrollTop: number } {
    const scrollEl = this.diagramCanvas?.flowContainerRef?.nativeElement;
    return {
      scrollLeft: scrollEl?.scrollLeft || 0,
      scrollTop: scrollEl?.scrollTop || 0,
    };
  }

  private commitNewNode(newNode: UmlClassNode, autoRename = true): void {
    this.commitDiagramMutation({
      nodes: [...this.nodes(), newNode],
      action: 'add_node',
      recordHistory: false,
    });
    if (autoRename) {
      setTimeout(() => this.diagramCanvas?.startRenameNode(newNode.id), 50);
    }
  }

  private addValidatedNode(
    type: string,
    position?: { x: number; y: number },
    autoRename = true,
    stereotype?: UmlStereotype | string | null,
  ): void {
    const newNode = this.nodeOps.createValidatedNode(type, {
      isReadOnly: this.isReadOnly(),
      activeDiagramType: this.activeDiagramType(),
      nodes: this.nodes(),
      position,
      stereotype,
      scrollOffset: this.getScrollOffset(),
      onIncompatible: (t) => this.showIncompatibleElementModal(t),
    });
    if (!newNode) return;
    this.pushSnapshot();
    this.commitNewNode(newNode, autoRename);
  }

  addClass(pos?: { x: number; y: number }, stereotype?: UmlStereotype | string | null): void { this.addValidatedNode('class', pos, true, stereotype); }
  addComponent(pos?: { x: number; y: number }): void { this.addValidatedNode('component', pos); }
  addDevice(pos?: { x: number; y: number }): void { this.addValidatedNode('device', pos); }
  addExecutionEnvironment(pos?: { x: number; y: number }): void { this.addValidatedNode('executionEnvironment', pos); }
  addBoundaryBox(pos?: { x: number; y: number }): void { this.addValidatedNode('boundary_box', pos, false); }
  addActor(pos?: { x: number; y: number }): void { this.addValidatedNode('actor', pos); }
  addUseCase(pos?: { x: number; y: number }): void { this.addValidatedNode('use_case', pos); }
  addPackage(pos?: { x: number; y: number }): void { this.addValidatedNode('package', pos); }
  addBoundary(pos?: { x: number; y: number }): void { this.addValidatedNode('boundary', pos); }
  addControl(pos?: { x: number; y: number }): void { this.addValidatedNode('control', pos); }
  addEntity(pos?: { x: number; y: number }): void { this.addValidatedNode('entity', pos); }
  addLifeline(pos?: { x: number; y: number }): void { this.addValidatedNode('lifeline', pos); }

  copySelectedNodes(): void {
    const result = this.diagramClipboardService.copyNodes(
      this.nodes(),
      this.connections(),
      this.selectedNodeIds(),
      this.selectedNodeId(),
      this.activeDiagramType(),
    );
    if (!result) return;
    this.showQuickToast(this.diagramClipboardService.formatCopyToast(result));
  }

  pasteNodes(targetPos?: { x: number; y: number }): void {
    const result = this.diagramClipboardService.executePaste({
      isReadOnly: this.isReadOnly(),
      activeDiagramType: this.activeDiagramType(),
      nodes: this.nodes(),
      targetPos,
      scrollOffset: this.getScrollOffset(),
      onIncompatible: (t) => this.showIncompatibleElementModal(t),
    });
    if (!result) return;

    const newConns = result.newConnections.length > 0 ? [...this.connections(), ...result.newConnections] : undefined;
    this.commitDiagramMutation({
      nodes: [...this.nodes(), ...result.newNodes],
      connections: newConns,
      action: 'add_node',
    });
    this.selectedNodeIds.set(new Set(result.newPastedIds));
    this.selectedNodeId.set(result.newPastedIds[0]);
    this.diagramCanvas?.select(result.newPastedIds, []);
    this.closeContextMenu();
    this.showQuickToast(this.diagramClipboardService.formatPasteToast(result.newNodes, result.newConnections));
  }

  cutSelectedNodes(): void {
    if (this.isReadOnly()) return;
    this.copySelectedNodes();
    this.deleteSelected();
    this.closeContextMenu();
  }

  duplicateSelected(): void {
    if (this.isReadOnly()) return;
    this.copySelectedNodes();
    this.pasteNodes();
    this.closeContextMenu();
  }

  closeContextMenu(): void {
    this.contextMenuService.closeContextMenu();
  }

  onNodeContextMenu(data: { node: UmlClassNode; event: MouseEvent }): void {
    if (this.isReadOnly()) return;
    this.contextMenuService.onNodeContextMenu({
      ...data,
      selectOnCanvas: (nodeIds, connIds) => this.diagramCanvas?.select(nodeIds, connIds),
      clientToCanvas: (x, y) => this.diagramCanvas?.clientToCanvasCoordinates(x, y),
    });
  }

  onConnectionContextMenu(data: { conn: UmlConnection; event: MouseEvent }): void {
    if (this.isReadOnly()) return;
    this.contextMenuService.onConnectionContextMenu({
      ...data,
      selectOnCanvas: (nodeIds, connIds) => this.diagramCanvas?.select(nodeIds, connIds),
      clientToCanvas: (x, y) => this.diagramCanvas?.clientToCanvasCoordinates(x, y),
    });
  }

  onCanvasContextMenu(data: { event: MouseEvent; canvasPos: { x: number; y: number } }): void {
    if (this.isReadOnly()) return;
    this.contextMenuService.onCanvasContextMenu(data);
  }

  private syncUpdatedConnections(toastMsg: string): void {
    this.commitDiagramMutation({
      connections: [...this.connections()],
      action: 'update_connection',
    });
    this.closeContextMenu();
    this.showQuickToast(toastMsg);
  }

  reverseConnection(conn: UmlConnection): void {
    if (this.isReadOnly()) return;
    this.connectionOps.reverseConnection(conn);
    this.syncUpdatedConnections('Dirección de relación invertida');
  }

  setConnectionLineStyle(conn: UmlConnection, style: UmlLineStyle): void {
    if (this.isReadOnly()) return;
    conn.lineStyle = style;
    this.syncUpdatedConnections(`Estilo de línea cambiado a ${style}`);
  }

  private showIncompatibleElementModal(diagType: DiagramType): void {
    this.modalService.showIncompatibleElementModal(diagType, this.confirmDialogService);
  }

  handleCopyNodeFromExplorer(event: { node: UmlClassNode; sourceDiagramId?: string; sourceDiagramType?: DiagramType; position?: { x: number; y: number } }): void {
    const newNode = this.diagramClipboardService.executeCopyFromExplorer({
      isReadOnly: this.isReadOnly(),
      node: event.node,
      sourceDiagramId: event.sourceDiagramId || '',
      currentDiagramId: this.currentDiagramId(),
      activeDiagramType: this.activeDiagramType(),
      nodes: this.nodes(),
      position: event.position,
      scrollOffset: this.getScrollOffset(),
      getDefaultColor: (nt, st) => this.getDefaultColorForNodeType(nt, st),
      onIncompatible: (t) => this.showIncompatibleElementModal(t),
    });
    if (!newNode) return;

    this.commitDiagramMutation({
      nodes: [...this.nodes(), newNode],
      action: 'add_node',
    });
    this.selectedNodeId.set(newNode.id);
    this.selectedNodeIds.set(new Set([newNode.id]));
    const typeLabel = this.nodeOps.getNodeTypeReadableLabel(newNode.nodeType);
    this.showQuickToast(`${typeLabel} "${newNode.name}" copiado al lienzo`);
  }

  onNodeDropped(event: { payload: DropNodePayload; position: { x: number; y: number } }): void {
    this.nodeOps.handleNodeDropped(event, {
      isReadOnly: this.isReadOnly(),
      onDropToolbox: (type, pos, st) => this.addValidatedNode(type, pos, type !== 'boundary_box', st),
      onCopyExplorer: (data) => this.handleCopyNodeFromExplorer(data),
    });
  }

  handleSelectNodeFromExplorer(nodeId: string): void {
    this.nodeOps.handleSelectNodeFromExplorer(
      nodeId,
      this.nodes(),
      this.diagramCanvas,
      (id) => {
        this.selectedNodeId.set(id);
        this.selectedNodeIds.set(new Set([id]));
      },
    );
  }

  removeClass(nodeId: string, event?: MouseEvent, recordHistory = true): void {
    if (event) event.stopPropagation();
    if (this.isReadOnly()) return;

    const result = this.nodeOps.executeCascadeDeleteNode(
      nodeId,
      this.nodes(),
      this.connections(),
      this.selectedNodeId(),
      (c) => this.recalculateSequenceNumbers(c),
    );

    this.commitDiagramMutation({
      nodes: result.remainingNodes,
      connections: result.remainingConnections,
      action: 'remove_node',
      recordHistory,
    });
    this.selectedNodeId.set(result.nextSelectedNodeId);
  }

  openEditNodeModal(node: UmlClassNode, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (this.isReadOnly() || node.isAnchor) return;

    if (this.isNodeLockedByOther(node.id)) {
      const lock = this.collabCoordinator.getNodeLock(node.id);
      this.toastService.warning(`🔒 Esta tabla está bloqueada por ${lock?.userName || 'otro usuario'}.`);
      return;
    }

    this.collabCoordinator.requestNodeLock(node.id);
    this.modalService.openEditNodeModal(node);
  }

  closeEditNodeModal(): void {
    this.modalService.closeEditNodeModal((nodeId) => {
      this.collabCoordinator.releaseNodeLock(nodeId);
    });
  }

  openEditConnModal(conn: UmlConnection, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (!this.isReadOnly()) this.modalService.openEditConnModal(conn);
  }
  closeEditConnModal(): void { this.modalService.closeEditConnModal(); }

  removeConnection(connId: string, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (this.isReadOnly()) return;

    const result = this.connectionOps.executeCascadeDeleteConnection(
      connId,
      this.nodes(),
      this.connections(),
      (c) => this.recalculateSequenceNumbers(c),
    );

    this.commitDiagramMutation({
      nodes: result.remainingNodes,
      connections: result.remainingConnections,
      action: 'delete_conn',
    });
    this.closeEditConnModal();
  }

  onAiMutation(event: { nodes: UmlClassNode[]; connections: UmlConnection[]; summary: string }): void {
    if (event.nodes && event.nodes.length > 0) {
      this.applyAiMutationWithAnimation(event.nodes, event.connections || []);
      this.collabCoordinator.sendDiagramSync(event.nodes, event.connections || [], 'ai_mutation');
    }
  }

  private processAiMutation(targetNodes: any[], targetConns: any[]): { cleanNodes: UmlClassNode[]; cleanConns: UmlConnection[] } {
    return this.aiSyncService.processAiMutation({
      targetNodes,
      targetConns,
      activeDiagramType: this.activeDiagramType(),
      defaultLineStyle: this.defaultLineStyle(),
      getDefaultColorForNodeType: (nt, st) => this.getDefaultColorForNodeType(nt, st),
      getOptimalConnectorId: (s, t) => this.getOptimalConnectorId(s, t),
      getConnectorPoint: (n, s) => this.getConnectorPoint(n, s),
      recalculateSequenceNumbers: (c, p) => this.recalculateSequenceNumbers(c, p),
    });
  }

  private applyAiMutationWithAnimation(targetNodes: UmlClassNode[], targetConns: UmlConnection[]): void {
    const { cleanNodes, cleanConns } = this.processAiMutation(targetNodes, targetConns);
    this.nodes.set(cleanNodes);
    this.connections.set(cleanConns);
    this.markAsUnsaved();
    this.aiSyncService.schedulePostMutationRedraw({
      updateEndpoints: () => this.updateConnectionEndpoints(),
      resetCanvas: () => this.diagramCanvas?.reset(),
      fitView: () => this.fitView(),
      redrawCanvas: () => this.diagramCanvas?.redraw(),
    });
  }

  public normalizeUmlMessage(m: any, defaultSeq = '1'): UmlMessage {
    return this.aiSyncService.normalizeUmlMessage(m, defaultSeq);
  }

  private sanitizeClientConnections(conns: any[], validNodes: UmlClassNode[]): UmlConnection[] {
    return this.aiSyncService.sanitizeClientConnections(
      conns,
      validNodes,
      this.activeDiagramType(),
      this.defaultLineStyle(),
      (combined, preserve) => this.recalculateSequenceNumbers(combined, preserve),
    );
  }

  async downloadBmpFile(): Promise<void> {
    this.showQuickToast('Generando imagen BMP...');
    try {
      await this.exportService.exportDiagramImage(
        this.diagramCanvas,
        'bmp',
        this.currentDiagramName(),
        this.activeDiagramType(),
        this.nodes(),
        this.connections(),
      );
    } catch {
      this.showQuickToast('Error al exportar imagen BMP');
    }
  }

  async downloadPngFile(): Promise<void> {
    this.showQuickToast('Generando imagen PNG...');
    try {
      await this.exportService.exportDiagramImage(
        this.diagramCanvas,
        'png',
        this.currentDiagramName(),
        this.activeDiagramType(),
        this.nodes(),
        this.connections(),
      );
    } catch {
      this.showQuickToast('Error al exportar imagen PNG');
    }
  }

  downloadXmiFile(): void {
    this.exportService.executeDownloadXmi({
      currentDiagramId: this.currentDiagramId(),
      currentDiagramName: this.currentDiagramName(),
      hasUnsavedChanges: this.hasUnsavedChanges(),
      isReadOnly: this.isReadOnly(),
      xmiService: this.xmiService,
      saveAst: (id, payload) => this.diagramService.saveAst(id, payload),
      buildSaveAstPayload: () => this.buildSaveAstPayload(),
      onSavedSuccessfully: () => {
        this.hasUnsavedChanges.set(false);
        const diagId = this.currentDiagramId();
        if (diagId) this.clearLocalDraft(diagId);
      },
    });
  }

  downloadJsonFile(): void {
    this.exportService.downloadJsonFile(
      this.currentDiagramName(),
      this.defaultLineStyle(),
      this.nodes(),
      this.connections(),
    );
  }

  openExportModal(): void {
    const project = this.exportService.buildProjectJson(
      this.currentDiagramName(),
      this.defaultLineStyle(),
      this.nodes(),
      this.connections(),
    );
    this.modalService.openExportModal(JSON.stringify(project, null, 2));
  }

  openImportModal(): void {
    this.modalService.openImportModal();
  }

  private applyImportSuccess(result: DiagramImportResult, action: string): void {
    this.nodes.set(result.nodes);
    if (result.format === 'xmi') {
      if (result.name) this.currentDiagramName.set(result.name);
      if (result.diagramType) this.activeDiagramType.set(result.diagramType);
      this.connections.set(this.recalculateSequenceNumbers(result.connections, true));
    } else {
      this.connections.set(result.connections);
      if (result.defaultLineStyle) this.defaultLineStyle.set(result.defaultLineStyle);
    }
    this.markAsUnsaved();
    this.updateConnectionEndpoints();
    this.collabCoordinator.sendDiagramSync(this.nodes(), this.connections(), action);
    setTimeout(() => {
      this.updateConnectionEndpoints();
      this.fitView();
    }, 100);
  }

  async onFileSelected(event: Event): Promise<void> {
    await this.importService.executeFileImport({
      event,
      isReadOnly: this.isReadOnly(),
      hasMultipleActiveUsers: this.hasMultipleActiveUsers(),
      multiUserBlockedMsg: this.translationService.translate('appbar.multiUserImportBlocked'),
      normalizeDataType: (t) => this.aiSyncService.normalizeDataType(t),
      normalizeReturnType: (rt) => this.aiSyncService.normalizeReturnType(rt),
      onSuccess: (result) => this.applyImportSuccess(result, result.format === 'xmi' ? 'import_xmi' : 'import_json'),
    });
  }

  triggerSpringBootGeneration(): void { this.modalService.openSpringBootModal(); }
  openProfileModal(): void { this.modalService.openProfileModal(); }
  syncZoomFromCanvas(): void { this.viewportService.syncZoomFromCanvas(this.diagramCanvas); }
  onZoomChanged(zoom: number): void {
    if (this.contextMenu()) this.closeContextMenu();
    this.viewportService.onZoomChanged(zoom, this.currentDiagramId());
  }

  zoomIn(): void { this.viewportService.zoomIn(this.diagramCanvas); }
  zoomOut(): void { this.viewportService.zoomOut(this.diagramCanvas); }
  onViewportScroll(event: Event): void {
    if (this.contextMenu()) this.closeContextMenu();
    this.viewportService.onViewportScroll(event, this.currentDiagramId());
  }

  resetView(): void { this.viewportService.resetView(this.diagramCanvas); }
  fitView(): void { this.viewportService.fitView(this.diagramCanvas); }
  onDiagramTypeChange(type: DiagramType): void {
    this.activeDiagramType.set(type);
    this.collabCoordinator.setCurrentDiagramType(type);
  }

  onSaveEditedNode(savedNode: UmlClassNode): void {
    this.commitDiagramMutation({
      nodes: this.nodeOps.saveEditedNode(this.nodes(), savedNode, this.activeDiagramType()),
      action: 'update_class',
      redrawCanvas: true,
    });
  }

  onSaveEditedConnection(savedConn: UmlConnection): void {
    const { updatedConnections, isSeq } = this.connectionOps.saveEditedConnection(
      this.connections(),
      savedConn,
      this.activeDiagramType(),
      (m, seq) => this.normalizeUmlMessage(m, seq),
    );

    this.commitDiagramMutation({
      connections: isSeq ? this.recalculateSequenceNumbers(updatedConnections, true) : updatedConnections,
      action: 'update_connection',
    });
    this.closeEditConnModal();
  }

  onApplyImportedJson(json: string): void {
    this.importService.executeJsonImport({
      jsonString: json,
      isReadOnly: this.isReadOnly(),
      hasMultipleActiveUsers: this.hasMultipleActiveUsers(),
      multiUserBlockedMsg: this.translationService.translate('appbar.multiUserImportBlocked'),
      normalizeDataType: (t) => this.aiSyncService.normalizeDataType(t),
      normalizeReturnType: (rt) => this.aiSyncService.normalizeReturnType(rt),
      onSuccess: (result) => {
        this.applyImportSuccess(result, 'apply_json');
        this.showJsonModal.set(false);
      },
    });
  }

  onSetSelectedNodeColor(color: string | null): void {
    this.toolbarService.applySelectedNodeColor(color, {
      isReadOnly: this.isReadOnly(),
      selectedNodeIds: this.selectedNodeIdsList(),
      nodes: this.nodes(),
      connections: this.connections(),
      defaultLineStyle: this.defaultLineStyle(),
      pushSnapshot: () => this.pushSnapshot(),
      setNodes: (n) => this.nodes.set(n),
      markAsUnsaved: () => this.markAsUnsaved(),
      sendDiagramSync: (nodes, conns, act, style) => this.collabCoordinator.sendDiagramSync(nodes, conns, act, style),
    });
  }

  // --- MÉTODOS DEL EXPLORADOR DE DIAGRAMAS POR TIPO ---

  openCreateDiagramModal(lockedType: DiagramType | null = null): void { this.modalService.openCreateDiagramModal(lockedType); }
  closeCreateDiagramModal(): void { this.modalService.closeCreateDiagramModal(); }

  handleCreateDiagram(data: { name: string; type: DiagramType }): void {
    this.tabManager.handleCreateDiagram(
      this.currentProjectId(),
      data,
      (createdId) => this.onSelectDiagram(createdId),
      () => {
        if (this.hasUnsavedChanges() && !this.isReadOnly()) {
          this.saveToBackend(true);
        }
      },
    );
  }

  onSelectDiagram(diagramId: string): void {
    this.tabManager.executeSelectDiagram(diagramId, {
      currentDiagramId: this.currentDiagramId(),
      isReadOnly: this.isReadOnly(),
      hasUnsavedChanges: this.hasUnsavedChanges(),
      saveCurrentViewState: () => {
        const outgoingId = this.currentDiagramId();
        if (outgoingId && this.diagramCanvas) {
          this.viewportService.saveDiagramViewState(outgoingId, this.diagramCanvas.getViewState());
        }
      },
      saveToBackend: () => this.saveToBackend(true),
      setCurrentDiagramId: (id) => this.currentDiagramId.set(id),
      navigateToDiagram: (id) => {
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { diagramId: id },
          queryParamsHandling: 'merge',
        });
      },
      loadDiagram: (id) => this.loadDiagramFromBackend(id),
    });
  }

  closeTab(tabId: string, event: MouseEvent): void {
    event.stopPropagation();
    if (this.currentDiagramId() === tabId && this.hasUnsavedChanges() && !this.isReadOnly()) this.saveToBackend(true);
    const result = this.tabManager.closeTab(tabId, this.currentDiagramId());
    if (result?.nextTabId) this.onSelectDiagram(result.nextTabId);
  }

  onRenameDiagram(event: { diagramId: string; name: string }): void {
    if (!this.isReadOnly()) this.tabManager.renameDiagram(event, this.currentDiagramId());
  }

  async onDeleteDiagram(diagramId: string): Promise<void> {
    if (this.isReadOnly()) return;
    await this.tabManager.deleteDiagram(diagramId, this.currentDiagramId(), this.projectDiagrams(), (nextId) => {
      if (nextId) {
        this.onSelectDiagram(nextId);
      } else {
        this.currentDiagramId.set(null);
        this.nodes.set([]);
        this.connections.set([]);
      }
    });
  }

  onNodeRename(event: { nodeId: string; newName: string }): void {
    if (this.isReadOnly()) return;
    const { anyChanged, updatedNodes } = this.nodeOps.renameNode(this.nodes(), event.nodeId, event.newName);
    if (!anyChanged) return;

    this.commitDiagramMutation({
      nodes: updatedNodes,
      action: 'edit_node',
    });
  }
}

