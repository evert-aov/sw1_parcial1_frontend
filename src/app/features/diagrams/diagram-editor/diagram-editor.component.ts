import {
  Component,
  signal,
  ViewChild,
  ElementRef,
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
import { XmiClientParser } from '../../../core/services/xmi-client-parser';
import { BmpExportService } from '../../../core/services/bmp-export.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import {
  DiagramType,
  UmlStereotype,
  UmlNodeType,
  UmlRelationshipType,
  UmlLineStyle,
  UmlAttribute,
  UmlMethod,
  UmlClassNode,
  UmlConnection,
  UmlMessage,
  UmlMessageType,
  SaveDiagramAstRequest,
  UML_RELATION_TYPES,
  UML_LINE_STYLES,
  UML_DIAGRAM_TYPES,
} from '../../../core/models/diagram.model';

import { Subject, debounceTime } from 'rxjs';
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
import { DiagramNodeOperationsService } from './services/diagram-node-operations.service';
import { DiagramExportService } from './services/diagram-export.service';
import { DiagramImportService } from './services/diagram-import.service';
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
import { DiagramCollaborationCoordinatorService } from './services/diagram-collaboration-coordinator.service';
import { DiagramContextMenuService } from './services/diagram-context-menu.service';
import { TranslatePipe, TranslationService } from '../../../core/i18n';
import {
  calculateClassDynamicWidth,
  getDefaultColorForNodeType,
  getDynamicNodeWidth,
  getNodeWidth,
  getNodeHeight,
  computeBoardWidth,
  computeBoardHeight,
} from './utils/node-metrics.util';
import { calculateCanvasCoordinates, isDragMovement } from './utils/canvas-coordinates.util';
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
  readonly diagramCollaborationCoordinatorService = inject(DiagramCollaborationCoordinatorService, { optional: true }) ?? new DiagramCollaborationCoordinatorService();
  readonly diagramContextMenuService = inject(DiagramContextMenuService, { optional: true }) ?? new DiagramContextMenuService(this.selectionService);

  private get nodeFactory(): DiagramNodeFactoryService {
    return this.diagramNodeFactoryService || new DiagramNodeFactoryService();
  }

  private get nodeOps(): DiagramNodeOperationsService {
    return this.diagramNodeOperationsService || new DiagramNodeOperationsService(this.nodeFactory);
  }

  private get exportService(): DiagramExportService {
    return this.diagramExportService || new DiagramExportService();
  }

  private get importService(): DiagramImportService {
    return this.diagramImportService || new DiagramImportService();
  }

  private get alignmentService(): DiagramAlignmentService {
    return this.diagramAlignmentService || new DiagramAlignmentService();
  }

  private get connectionLayoutService(): DiagramConnectionLayoutService {
    return this.diagramConnectionLayoutService || new DiagramConnectionLayoutService();
  }

  private get connectionOps(): DiagramConnectionOperationsService {
    return this.diagramConnectionOperationsService || new DiagramConnectionOperationsService(this.connectionLayoutService);
  }

  private get selectionService(): DiagramSelectionService {
    return this.diagramSelectionService || new DiagramSelectionService();
  }

  private get tabManager(): DiagramTabManagerService {
    return this.diagramTabManagerService || new DiagramTabManagerService();
  }

  private get aiSyncService(): DiagramAiSyncService {
    return this.diagramAiSyncService || new DiagramAiSyncService();
  }

  private get hotkeysService(): DiagramHotkeysService {
    return this.diagramHotkeysService || new DiagramHotkeysService();
  }

  private get viewportService(): DiagramViewportService {
    return this.diagramViewportService || new DiagramViewportService();
  }

  private get modalService(): DiagramModalService {
    return this.diagramModalService || new DiagramModalService();
  }

  private get persistenceService(): DiagramPersistenceService {
    return this.diagramPersistenceService || new DiagramPersistenceService();
  }

  private get containmentService(): DiagramContainmentService {
    return this.diagramContainmentService || new DiagramContainmentService();
  }

  private get collabCoordinator(): DiagramCollaborationCoordinatorService {
    return this.diagramCollaborationCoordinatorService || new DiagramCollaborationCoordinatorService();
  }

  private get contextMenuService(): DiagramContextMenuService {
    return this.diagramContextMenuService || new DiagramContextMenuService(this.selectionService);
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

  // Notificaciones flotantes rápidas
  readonly quickToast = signal<string | null>(null);

  showQuickToast(msg: string): void {
    this.quickToast.set(msg);
    setTimeout(() => {
      if (this.quickToast() === msg) {
        this.quickToast.set(null);
      }
    }, 2500);
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

  saveDiagramViewState(diagramId: string, state?: Partial<DiagramCanvasViewState>): void {
    this.viewportService.saveDiagramViewState(diagramId, state);
  }
  getDiagramViewState(diagramId: string): DiagramCanvasViewState {
    return this.viewportService.getDiagramViewState(diagramId);
  }

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

  private clearLocalDraft(diagramId: string): void {
    this.persistenceService.clearLocalDraft(diagramId);
  }

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
    const single = this.selectedNodeId();
    if (!single) return null;
    const node = this.nodes().find((n) => n.id === single);
    return node?.color || this.getDefaultColorForNodeType(node?.nodeType, node?.stereotype);
  });
  defaultLineStyle = signal<UmlLineStyle>('segment');
  mouseCanvasPos = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  smartGuidesEnabled = signal<boolean>(true);

  private canvasMouseDownPos = { x: 0, y: 0 };

  // Historial de cambios (Deshacer Ctrl+Z / Rehacer Ctrl+Y)
  private isApplyingHistory = false;
  private hasMovedDuringPointerDown = false;
  private lastSelectionChangeTime = 0;

  historyUndoCount = computed(() => this.diagramHistoryService.undoCount());
  historyRedoCount = computed(() => this.diagramHistoryService.redoCount());
  readonly canUndo = computed(() => this.diagramHistoryService.canUndo() && !this.isReadOnly());
  readonly canRedo = computed(() => this.diagramHistoryService.canRedo() && !this.isReadOnly());

  // Paneles laterales (Toolbox / Sidebar y Copilot IA) - Abierto por defecto con Explorador
  readonly isSidebarOpen = signal<boolean>(true);
  readonly isToolboxOpen = this.isSidebarOpen;
  isAiPanelOpen = signal<boolean>(false);
  readonly isExportDropdownOpen = this.modalService.isExportDropdownOpen;
  isImportDropdownOpen = signal<boolean>(false);

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

  private animationTimers: any[] = [];

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
      const cleanNodes = this.applyAiNodesMutation(data.nodes);
      this.nodes.set(cleanNodes);
      const cleanConns = this.sanitizeClientConnections(data.connections || [], cleanNodes);
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
      alert(`🔒 La tabla está siendo editada por ${data.lockedBy.userName}. Por favor espera.`);
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
    const diagramId = params['diagramId'];
    const projectId = params['projectId'];
    const projectName = params['projectName'];

    if (projectId) {
      this.currentProjectId.set(projectId);
      this.diagramService.loadDiagramsByProject(projectId).subscribe();
      this.projectService.getProject(projectId).subscribe({
        next: (project) => {
          this.currentProject.set(project);
          this.currentUserRole.set(resolveUserRoleInProject(project, this.authService.currentUser()?.id));
        },
        error: () => {},
      });
    }

    if (projectName) {
      this.currentDiagramName.set(projectName);
    }

    if (diagramId) {
      this.currentDiagramId.set(diagramId);
      this.loadDiagramFromBackend(diagramId);
    } else if (projectId) {
      this.diagramService.loadDiagramsByProject(projectId).subscribe((diagrams) => {
        if (diagrams && diagrams.length > 0) {
          const first = diagrams[0];
          this.currentDiagramId.set(first.id);
          this.currentDiagramName.set(first.name);
          this.loadDiagramFromBackend(first.id);
        }
      });
    }
  }

  ngOnDestroy(): void {
    if (this.editingNode()) {
      this.collabCoordinator.releaseNodeLock(this.editingNode()!.id);
    }
    this.animationTimers.forEach((t) => clearTimeout(t));
    this.animationTimers = [];
    this.collabCoordinator.leaveRoom();
  }

  loadDiagramFromBackend(diagramId: string): void {
    this.diagramService.loadDiagram(diagramId).subscribe((diagram) => {
      this.currentDiagramName.set(diagram.name);
      if (diagram.type) {
        this.activeDiagramType.set(diagram.type as DiagramType);
        this.collabCoordinator.setCurrentDiagramType(diagram.type);
      }
      if (diagram.defaultLineStyle) {
        this.defaultLineStyle.set(diagram.defaultLineStyle as UmlLineStyle);
      }

      const resolved = this.persistenceService.resolveDiagramData(diagram, {
        getDefaultColor: (nt, st) => this.getDefaultColorForNodeType(nt, st),
        normalizeDataType: (t) => this.normalizeDataType(t),
        normalizeReturnType: (t) => this.normalizeReturnType(t),
      });

      this.nodes.set(resolved.nodes);
      this.connections.set(this.recalculateSequenceNumbers(resolved.connections, true));
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
      requestAnimationFrame(() => {
        this.updateConnectionEndpoints();
        requestAnimationFrame(() => {
          this.updateConnectionEndpoints();
          this.diagramCanvas?.clearSelection();
          this.diagramCanvas?.reset();
          const targetState = this.getDiagramViewState(diagramId);
          this.zoomLevel.set(targetState.zoom);
          this.diagramCanvas?.applyViewState(targetState);
        });
      });
    });
  }

  private syncProjectInfo(projectId?: string | null): void {
    if (!projectId) return;
    if (!this.currentProject()) {
      this.currentProjectId.set(projectId);
      this.projectService.getProject(projectId).subscribe({
        next: (proj) => this.currentProject.set(proj),
        error: () => {},
      });
    }
    if (this.diagramService.projectDiagrams().length === 0) {
      this.diagramService.loadDiagramsByProject(projectId).subscribe();
    }
  }

  normalizeDataType(type: string): string {
    return this.aiSyncService.normalizeDataType(type);
  }

  normalizeReturnType(type: string): string {
    return this.aiSyncService.normalizeReturnType(type);
  }

  getNodeLock(nodeId: string): NodeLock | undefined {
    return this.collabCoordinator.getNodeLock(nodeId);
  }

  isNodeLockedByOther(nodeId: string): boolean {
    return this.collabCoordinator.isNodeLockedByOther(nodeId, this.authService.currentUser()?.id);
  }

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

  @HostListener('window:mousedown')
  onWindowMouseDown(): void {
    this.hasMovedDuringPointerDown = false;
  }

  @HostListener('window:mouseup')
  onWindowMouseUp(): void {
    this.containmentService.resetDragState();
    setTimeout(() => {
      this.hasMovedDuringPointerDown = false;
    }, 50);
  }

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
    this.selectedNodeId.set(null);
    this.selectedNodeIds.set(new Set());
    this.selectedConnId.set(null);
    this.selectedConnIds.set(new Set());
    this.setPointerMode();
    this.closeEditNodeModal();
    this.closeEditConnModal();
    this.showJsonModal.set(false);
    this.showSpringBootModal.set(false);
    this.isExportDropdownOpen.set(false);
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

    const payload = this.buildSaveAstPayload();

    this.diagramService.saveAst(diagramId, payload).subscribe({
      next: () => {
        this.persistenceService.markAsSaved(diagramId);
        this.persistenceService.notifySaveSuccess(2500);
        if (!silent) {
          this.collabCoordinator.sendDiagramSync(
            this.nodes(),
            this.connections(),
            'save',
            this.defaultLineStyle(),
          );
        }
      },
      error: (err) => {
        console.warn('Auto-save no pudo completarse en servidor (borrador local protegido):', err);
      },
    });
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
    this.hasMovedDuringPointerDown = true;

    const { shouldRedraw } = this.containmentService.processNodePositionChange({
      node,
      newPosition,
      nodes: this.nodes(),
      selectedNodeIds: this.selectedNodeIds(),
      selectedNodeId: this.selectedNodeId(),
      activeDiagramType: this.activeDiagramType(),
      getNodeWidth: (n) => this.getNodeWidth(n),
      getNodeHeight: (n) => this.getNodeHeight(n),
      onStartDrag: () => this.pushSnapshot(),
      onSelectNode: (id) => {
        this.selectedNodeIds.set(new Set([id]));
        this.selectedNodeId.set(id);
      },
      sendNodeDrag: (id, pos) => this.collabCoordinator.sendNodeDrag(id, pos),
    });

    if (shouldRedraw) {
      this.diagramCanvas?.redraw();
    }

    this.markAsUnsaved();
    this.updateConnectionEndpoints();
    this.persistenceService.triggerNodeDragEnd();
  }

  onNodeLabelOffsetChange(node: UmlClassNode, offset: { x: number; y: number }): void {
    if (this.isReadOnly() || this.isNodeLockedByOther(node.id)) return;
    this.pushSnapshot();
    this.nodes.set(this.nodeOps.updateNodeLabelOffset(this.nodes(), node.id, offset));
    this.markAsUnsaved();
    this.collabCoordinator.sendDiagramSync(this.nodes(), this.connections(), 'move_node');
  }

  onMoveNodes(event: FMoveNodesEvent): void {
    if (this.isReadOnly()) return;
    this.hasMovedDuringPointerDown = true;

    const { anyMoved } = this.containmentService.processMoveNodes({
      eventNodes: event.nodes,
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
    const coords = calculateCanvasCoordinates(
      event,
      this.diagramCanvas?.getExportElement(),
      this.diagramCanvas?.canvas?.transform,
    );
    if (!coords) return;

    this.collabCoordinator.sendCursorPosition(coords.x, coords.y);
    this.mouseCanvasPos.set(coords);
  }

  getDynamicNodeWidth(node: UmlClassNode): number { return getDynamicNodeWidth(node); }
  getNodeWidth(node: UmlClassNode): number { return getNodeWidth(node); }
  getNodeHeight(node: UmlClassNode): number { return getNodeHeight(node); }

  onNodeSizeChanged(event: { node: UmlClassNode; width: number; height?: number; position: { x: number; y: number } }): void {
    if (this.isReadOnly() || this.isNodeLockedByOther(event.node.id)) return;
    this.pushSnapshot();
    this.nodes.set(this.nodeOps.updateNodeSize(this.nodes(), event));
    this.markAsUnsaved();
    this.updateConnectionEndpoints();
    this.collabCoordinator.sendDiagramSync(
      this.nodes(),
      this.connections(),
      'update',
      this.defaultLineStyle()
    );
    this.diagramCanvas?.redraw();
  }

  toggleSmartGuides(): void {
    this.smartGuidesEnabled.update((val) => !val);
  }

  private applyNodesTransformation(modified: UmlClassNode[], action: string): void {
    if (modified.length === 0) return;
    this.pushSnapshot();
    for (const n of modified) {
      this.collabCoordinator.sendNodeDrag(n.id, n.position);
    }
    this.markAsUnsaved();
    this.updateConnectionEndpoints();
    this.diagramCanvas?.redraw();
    this.collabCoordinator.sendDiagramSync(
      this.nodes(),
      this.connections(),
      action,
      this.defaultLineStyle(),
    );
  }

  alignNodes(direction: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'): void {
    if (this.isReadOnly() || this.selectedNodeIds().size < 2) return;
    const modified = this.alignmentService.alignNodes(
      this.nodes(),
      this.selectedNodeIds(),
      direction,
      (n: UmlClassNode) => this.getNodeWidth(n),
      (n: UmlClassNode) => this.getNodeHeight(n),
    );
    this.applyNodesTransformation(modified, 'align_nodes');
  }

  distributeNodes(direction: 'horizontal' | 'vertical'): void {
    if (this.isReadOnly() || this.selectedNodeIds().size < 3) return;
    const modified = this.alignmentService.distributeNodes(
      this.nodes(),
      this.selectedNodeIds(),
      direction,
      (n: UmlClassNode) => this.getNodeWidth(n),
      (n: UmlClassNode) => this.getNodeHeight(n),
    );
    this.applyNodesTransformation(modified, 'distribute_nodes');
  }

  snapSelectedToGrid(gridSize = 20): void {
    if (this.isReadOnly()) return;
    const modified = this.alignmentService.snapToGrid(
      this.nodes(),
      this.selectedNodeIds(),
      gridSize,
    );
    this.applyNodesTransformation(modified, 'snap_grid');
  }

  getOptimalConnectorId(sourceNode: UmlClassNode, targetNode: UmlClassNode): { sourceId: string; targetId: string } {
    return this.connectionLayoutService.getOptimalConnectorId(
      sourceNode,
      targetNode,
      (n: UmlClassNode) => this.getNodeWidth(n),
      (n: UmlClassNode) => this.getNodeHeight(n),
    );
  }

  getConnectorPoint(node: UmlClassNode, side: string): { x: number; y: number } {
    return this.connectionLayoutService.getConnectorPoint(
      node,
      side,
      (n: UmlClassNode) => this.getNodeHeight(n),
    );
  }

  isRecursiveConn(conn: UmlConnection): boolean { return this.connectionLayoutService.isRecursiveConn(conn); }

  getConnSide(connectorId: string | undefined, defaultSide: 'top' | 'right' | 'bottom' | 'left' = 'top'): 'top' | 'right' | 'bottom' | 'left' {
    return this.connectionLayoutService.getConnSide(connectorId, defaultSide);
  }

  updateConnectionEndpoints(): void {
    const result = this.connectionLayoutService.recalculateConnectionEndpoints(
      this.nodes(),
      this.connections(),
      this.activeDiagramType(),
      this.defaultLineStyle(),
      (n: UmlClassNode) => this.getNodeWidth(n),
      (n: UmlClassNode) => this.getNodeHeight(n),
    );
    if (result.anchorMoved) {
      this.nodes.set(result.updatedNodes);
    }
    this.connections.set(result.updatedConnections);
  }

  onCanvasMouseDown(event: MouseEvent): void {
    if (this.contextMenu()) this.closeContextMenu();
    this.canvasMouseDownPos = { x: event.clientX, y: event.clientY };
  }

  onCanvasBackgroundClick(event?: MouseEvent): void {
    if (event && isDragMovement(this.canvasMouseDownPos.x, this.canvasMouseDownPos.y, event.clientX, event.clientY)) {
      return;
    }
    this.deselectAll();
  }

  deselectAll(): void {
    this.selectedSourceNodeId.set(null);
    this.selectionService.clearSelection();
    this.diagramCanvas?.clearSelection();
    this.closeContextMenu();
  }

  onSelectionChange(event: FSelectionChangeEvent): void {
    this.selectionService.onSelectionChange(
      event,
      this.nodes(),
      this.connections(),
      this.selectedRelationType(),
    );
  }



  selectAllClasses(): void {
    this.selectionService.selectAllClasses(
      this.nodes(),
      this.selectedRelationType(),
      (allIds) => this.diagramCanvas?.select(allIds, []),
    );
  }

  deleteSelected(): void {
    if (this.isReadOnly()) return;
    const nodeIds = this.selectedNodeIdsList();
    const connIds = this.selectedConnIdsList();
    if (nodeIds.length === 0 && connIds.length === 0) return;

    this.pushSnapshot();
    for (const id of nodeIds) {
      this.removeClass(id, undefined, false);
    }
    for (const id of connIds) {
      this.removeConnection(id);
    }
    this.selectionService.clearSelection();
    this.diagramCanvas?.clearSelection();
  }

  onConnectionSelect(connId: string, event: MouseEvent): void {
    if (this.contextMenu()) this.closeContextMenu();
    this.selectionService.onConnectionSelect(
      connId,
      event,
      this.selectedRelationType(),
      (nodeIds, connIds) => this.diagramCanvas?.select(nodeIds, connIds),
    );
  }

  onNodeSelect(nodeId: string, event: MouseEvent): void {
    if (this.contextMenu()) this.closeContextMenu();
    this.selectionService.onNodeSelect(
      nodeId,
      event,
      this.selectedRelationType(),
      this.hasMovedDuringPointerDown,
      (nodeIds, connIds) => this.diagramCanvas?.select(nodeIds, connIds),
      () => this.diagramCanvas?.clearSelection(),
    );
  }

  private cloneSnapshot(): DiagramHistorySnapshot {
    return this.diagramHistoryService.cloneSnapshot(
      this.nodes(),
      this.connections(),
      this.defaultLineStyle(),
    );
  }

  pushSnapshot(): void {
    if (this.isApplyingHistory) return;
    const snapshot = this.cloneSnapshot();
    this.diagramHistoryService.pushSnapshot(snapshot);
  }

  private applyHistorySnapshot(snapshot: DiagramHistorySnapshot, action: 'undo' | 'redo'): void {
    this.isApplyingHistory = true;
    this.nodes.set(snapshot.nodes);
    this.connections.set(snapshot.connections);
    this.defaultLineStyle.set(snapshot.defaultLineStyle);
    this.selectedNodeId.set(null);
    this.selectedNodeIds.set(new Set());
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
    return this.connectionOps.generateNextSequenceMessage(sourceNode, targetNode, isReturn);
  }

  private recalculateSequenceNumbers(
    connectionsList: UmlConnection[],
    preserveSequenceNumbers = false,
  ): UmlConnection[] {
    return this.connectionLayoutService.recalculateSequenceNumbers(
      connectionsList,
      this.nodes(),
      this.activeDiagramType(),
      preserveSequenceNumbers,
    );
  }

  onTableClick(nodeId: string, event: MouseEvent): void {
    if (this.isReadOnly() || this.isNodeLockedByOther(nodeId)) return;

    const activeRel = this.selectedRelationType();
    if (!activeRel) return;

    event.stopPropagation();
    event.preventDefault();
    const currentSource = this.selectedSourceNodeId();

    if (currentSource === null) {
      this.selectedSourceNodeId.set(nodeId);
      this.onCanvasMouseMove(event);
    } else {
      const result = this.connectionOps.processTableClickConnection({
        currentSource,
        targetNodeId: nodeId,
        activeRel,
        activeDiagramType: this.activeDiagramType(),
        nodes: this.nodes(),
        connections: this.connections(),
        defaultLineStyle: this.defaultLineStyle(),
        getOptimalConnectorId: (s, t) => this.getOptimalConnectorId(s, t),
        generateNextSequenceMessage: (s, t, isRet) => this.generateNextSequenceMessage(s, t, isRet),
      });

      if (result.error) {
        alert(result.error);
        this.selectedSourceNodeId.set(null);
        return;
      }

      if (result.isAssocClass) {
        const nodeMap = new Map(this.nodes().map((n) => [n.id, n]));
        const sourceNode = nodeMap.get(currentSource);
        const targetNode = nodeMap.get(nodeId);
        if (sourceNode && targetNode) {
          this.createAssociationClassBetween(sourceNode, targetNode);
        }
        return;
      }

      if (result.newConn) {
        this.applyNewConnection(result.newConn, !!result.isSeqRel);
      }
    }
  }

  private applyNewConnection(newConn: UmlConnection, isSeqRel: boolean): void {
    this.pushSnapshot();
    this.connections.update((list) => this.recalculateSequenceNumbers([...list, newConn]));
    this.markAsUnsaved();
    this.setPointerMode();
    this.updateConnectionEndpoints();
    this.collabCoordinator.sendDiagramSync(this.nodes(), this.connections(), 'create_conn');
    if (isSeqRel) {
      const created = this.connections().find((c) => c.id === newConn.id) || newConn;
      setTimeout(() => this.openEditConnModal(created), 100);
    }
  }

  private applyCreatedAssociationClass(result: { nodes: UmlClassNode[]; connections: UmlConnection[] }): void {
    this.pushSnapshot();
    this.nodes.set(result.nodes);
    this.connections.set(result.connections);
    this.markAsUnsaved();
    this.setPointerMode();
    this.updateConnectionEndpoints();
    requestAnimationFrame(() => {
      this.updateConnectionEndpoints();
      this.diagramCanvas?.reset();
    });
    this.collabCoordinator.sendDiagramSync(this.nodes(), this.connections(), 'create_assoc_class');
  }

  onFlowLoaded(): void {
    this.updateConnectionEndpoints();
    this.diagramCanvas?.redraw();
    this.syncZoomFromCanvas();
  }

  onConnectionCreated(event: FCreateConnectionEvent): void {
    if (this.isReadOnly() || !event.fInputId) return;

    const result = this.connectionOps.processCreateConnection({
      fOutputId: event.fOutputId,
      fInputId: event.fInputId,
      selectedRelationType: this.selectedRelationType(),
      activeDiagramType: this.activeDiagramType(),
      defaultLineStyle: this.defaultLineStyle(),
      nodes: this.nodes(),
      connections: this.connections(),
      isNodeLockedByOther: (id) => this.isNodeLockedByOther(id),
      generateNextSequenceMessage: (src, tgt, isReturn) => this.generateNextSequenceMessage(src, tgt, isReturn),
    });

    if (result.errorMessage) {
      alert(result.errorMessage);
      return;
    }

    if (result.createdAssociationClass) {
      this.applyCreatedAssociationClass(result.createdAssociationClass);
      return;
    }

    if (result.newConnection) {
      this.applyNewConnection(result.newConnection, !!result.isSeqRel);
    }
  }

  onConnectionReassigned(event: FReassignConnectionEvent): void {
    if (this.isReadOnly()) return;
    const { updatedList, isOccupied } = this.connectionOps.processReassignConnection(
      this.connections(),
      event,
      this.activeDiagramType(),
    );
    if (isOccupied) {
      alert('⚠️ No se pueden colocar dos mensajes en la misma posición temporal (fila colineal).');
      return;
    }
    this.pushSnapshot();
    this.connections.set(this.recalculateSequenceNumbers(updatedList));
    this.markAsUnsaved();
    this.updateConnectionEndpoints();
    this.collabCoordinator.sendDiagramSync(this.nodes(), this.connections(), 'reassign_conn');
  }

  onSequenceMessageMove(event: { connectionId: string; targetSlot: number }): void {
    if (this.isReadOnly()) return;
    const { connectionId, targetSlot } = event;

    const allConns = this.connections();
    const movingConn = allConns.find((c) => c.id === connectionId);
    if (!movingConn) return;

    this.pushSnapshot();

    this.connections.update((conns) => {
      const moved = this.connectionLayoutService.computeSequenceMessageMove(
        conns,
        connectionId,
        targetSlot,
        this.activeDiagramType(),
      );
      return this.recalculateSequenceNumbers(moved);
    });

    this.markAsUnsaved();
    this.updateConnectionEndpoints();
    this.collabCoordinator.sendDiagramSync(this.nodes(), this.connections(), 'move_seq_msg');
  }

  createAssociationClassBetween(sourceNode: UmlClassNode, targetNode: UmlClassNode): void {
    const result = this.connectionOps.createAssociationClassBetween(
      sourceNode,
      targetNode,
      this.nodes(),
      this.connections(),
    );
    this.applyCreatedAssociationClass(result);
  }

  private getScrollOffset(): { scrollLeft: number; scrollTop: number } {
    const scrollEl = this.diagramCanvas?.flowContainerRef?.nativeElement;
    return {
      scrollLeft: scrollEl?.scrollLeft || 0,
      scrollTop: scrollEl?.scrollTop || 0,
    };
  }

  private commitNewNode(newNode: UmlClassNode, autoRename = true): void {
    this.nodes.update((list) => [...list, newNode]);
    this.markAsUnsaved();
    this.collabCoordinator.sendDiagramSync(this.nodes(), this.connections(), 'add_node');
    if (autoRename) {
      setTimeout(() => this.diagramCanvas?.startRenameNode(newNode.id), 50);
    }
  }

  private addTypedNode(
    type: string,
    position?: { x: number; y: number },
    autoRename = true,
    stereotype?: UmlStereotype | string | null,
  ): void {
    if (this.isReadOnly()) return;
    this.pushSnapshot();
    const newNode = this.nodeOps.createNode(type, {
      nodes: this.nodes(),
      activeDiagramType: this.activeDiagramType(),
      position,
      stereotype,
      scrollOffset: this.getScrollOffset(),
    });
    this.commitNewNode(newNode, autoRename);
  }

  private addValidatedNode(
    type: string,
    position?: { x: number; y: number },
    autoRename = true,
    stereotype?: UmlStereotype | string | null,
  ): void {
    if (this.isReadOnly()) return;
    const currentType = this.activeDiagramType();
    const validation = this.nodeOps.validateNodeAddition(type, currentType);
    if (!validation.allowed) {
      this.showIncompatibleElementModal(currentType);
      return;
    }
    const finalType = validation.redirectType || type;
    this.addTypedNode(finalType, position, autoRename, stereotype);
  }

  addClass(position?: { x: number; y: number }, stereotype?: UmlStereotype | string | null): void {
    this.addValidatedNode('class', position, true, stereotype);
  }
  addComponent(pos?: { x: number; y: number }): void { this.addTypedNode('component', pos); }
  addDevice(pos?: { x: number; y: number }): void { this.addTypedNode('device', pos); }
  addExecutionEnvironment(pos?: { x: number; y: number }): void { this.addTypedNode('executionEnvironment', pos); }
  addBoundaryBox(pos?: { x: number; y: number }): void { this.addTypedNode('boundary_box', pos, false); }
  addActor(pos?: { x: number; y: number }): void { this.addValidatedNode('actor', pos); }
  addUseCase(pos?: { x: number; y: number }): void { this.addTypedNode('use_case', pos); }
  addPackage(pos?: { x: number; y: number }): void { this.addTypedNode('package', pos); }
  addBoundary(pos?: { x: number; y: number }): void { this.addValidatedNode('boundary', pos); }
  addControl(pos?: { x: number; y: number }): void { this.addValidatedNode('control', pos); }
  addEntity(pos?: { x: number; y: number }): void { this.addValidatedNode('entity', pos); }
  addLifeline(pos?: { x: number; y: number }): void { this.addTypedNode('lifeline', pos); }

  copySelectedNodes(): void {
    const result = this.diagramClipboardService.copyNodes(
      this.nodes(),
      this.connections(),
      this.selectedNodeIds(),
      this.selectedNodeId(),
      this.activeDiagramType(),
    );
    if (!result) return;

    let toast = result.copiedNodesCount === 1 ? `"${result.sampleName}" copiado` : `${result.copiedNodesCount} elementos copiados`;
    if (result.copiedConnsCount > 0) {
      toast += ` (${result.copiedConnsCount} ${result.copiedConnsCount === 1 ? 'relación' : 'relaciones'})`;
    }
    this.showQuickToast(toast);
  }

  pasteNodes(targetPos?: { x: number; y: number }): void {
    if (this.isReadOnly()) return;

    const clip = this.diagramClipboardService.getClipboard();
    if (!clip || !clip.nodes || clip.nodes.length === 0) {
      return;
    }

    const currentType = this.activeDiagramType();
    if (!this.diagramClipboardService.isPasteCompatible(clip, currentType)) {
      this.showIncompatibleElementModal(currentType);
      return;
    }

    this.pushSnapshot();
    const { scrollLeft, scrollTop } = this.getScrollOffset();

    const { newNodes, newConnections, newPastedIds } = this.diagramClipboardService.createPastedElements(
      clip,
      this.nodes(),
      currentType,
      targetPos,
      scrollLeft,
      scrollTop,
    );

    this.nodes.update((list) => [...list, ...newNodes]);
    if (newConnections.length > 0) {
      this.connections.update((list) => [...list, ...newConnections]);
    }
    this.selectedNodeIds.set(new Set(newPastedIds));
    this.selectedNodeId.set(newPastedIds[0]);
    this.diagramCanvas?.select(newPastedIds, []);
    this.markAsUnsaved();
    this.updateConnectionEndpoints();
    this.collabCoordinator.sendDiagramSync(this.nodes(), this.connections(), 'add_node');
    this.closeContextMenu();

    let toast = newNodes.length === 1 ? `"${newNodes[0].name}" pegado en el lienzo` : `${newNodes.length} elementos pegados`;
    if (newConnections.length > 0) {
      toast += ` con ${newConnections.length} ${newConnections.length === 1 ? 'relación' : 'relaciones'}`;
    }
    this.showQuickToast(toast);
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
    this.pushSnapshot();
    this.connections.update((conns) => [...conns]);
    this.markAsUnsaved();
    this.updateConnectionEndpoints();
    this.collabCoordinator.sendDiagramSync(this.nodes(), this.connections(), 'update_connection');
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

  handleCopyNodeFromExplorer(event: { node: any; sourceDiagramId: string; sourceDiagramType?: DiagramType; position?: { x: number; y: number } }): void {
    if (this.isReadOnly()) return;
    const node = event.node;
    if (!node) return;
    const isCurrentDiag = event.sourceDiagramId === this.currentDiagramId();
    const currentType = this.activeDiagramType();

    if (!this.diagramClipboardService.isNodeCompatibleWithDiagramType(node, currentType)) {
      this.showIncompatibleElementModal(currentType);
      return;
    }

    this.pushSnapshot();
    const scrollOffset = this.getScrollOffset();

    const newNode = this.diagramClipboardService.createExplorerCopiedNode(
      node,
      currentType,
      this.nodes(),
      isCurrentDiag,
      event.position,
      scrollOffset,
      (nodeType, stereotype) => this.getDefaultColorForNodeType(nodeType, stereotype),
    );

    this.nodes.update((list) => [...list, newNode]);
    this.selectedNodeId.set(newNode.id);
    this.selectedNodeIds.set(new Set([newNode.id]));
    this.markAsUnsaved();
    this.collabCoordinator.sendDiagramSync(this.nodes(), this.connections(), 'add_node');

    const typeLabel = this.nodeOps.getNodeTypeReadableLabel(newNode.nodeType);
    this.showQuickToast(`${typeLabel} "${newNode.name}" copiado al lienzo`);
  }

  onNodeDropped(event: { payload: any; position: { x: number; y: number } }): void {
    if (this.isReadOnly() || !event.payload) return;
    const { payload, position } = event;

    if (payload.type === 'toolbox_node') {
      this.dropToolboxNode(payload.nodeType, position, payload.stereotype);
    } else if (payload.type === 'explorer_node') {
      const node = payload.nodeData || payload.node;
      this.handleCopyNodeFromExplorer({
        node,
        sourceDiagramId: payload.sourceDiagramId,
        sourceDiagramType: payload.sourceDiagramType,
        position,
      });
    }
  }

  private dropToolboxNode(nodeType: string, position: { x: number; y: number }, stereotype?: any): void {
    const type = nodeType === 'node' ? 'executionEnvironment' : nodeType;
    if (type === 'class') {
      this.addClass(position, stereotype);
    } else if (['actor', 'boundary', 'control', 'entity'].includes(type)) {
      this.addValidatedNode(type, position);
    } else if (type === 'boundary_box') {
      this.addBoundaryBox(position);
    } else {
      this.addTypedNode(type, position);
    }
  }

  handleSelectNodeFromExplorer(nodeId: string): void {
    this.selectedNodeId.set(nodeId);
    this.selectedNodeIds.set(new Set([nodeId]));
    this.diagramCanvas?.select([nodeId], []);
    const node = this.nodes().find((n) => n.id === nodeId);
    if (node && node.position) {
      const scrollEl = this.diagramCanvas?.flowContainerRef?.nativeElement;
      if (scrollEl) {
        scrollEl.scrollLeft = Math.max(0, node.position.x - 200);
        scrollEl.scrollTop = Math.max(0, node.position.y - 150);
      }
    }
  }

  removeClass(nodeId: string, event?: MouseEvent, recordHistory = true): void {
    if (event) event.stopPropagation();
    if (this.isReadOnly()) return;

    if (recordHistory) {
      this.pushSnapshot();
    }

    const { nodesToDelete, connsToDelete } = this.nodeOps.computeCascadeDeleteNode(
      nodeId,
      this.nodes(),
      this.connections(),
    );

    this.nodes.update((list) => list.filter((n) => !nodesToDelete.has(n.id)));
    this.connections.update((list) => this.recalculateSequenceNumbers(list.filter((c) => !connsToDelete.has(c.id))));

    if (this.selectedNodeId() === nodeId || nodesToDelete.has(this.selectedNodeId() || '')) {
      this.selectedNodeId.set(null);
    }

    this.markAsUnsaved();
    this.updateConnectionEndpoints();
    this.collabCoordinator.sendDiagramSync(this.nodes(), this.connections(), 'remove_node');
  }

  openEditNodeModal(node: UmlClassNode, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (this.isReadOnly() || node.isAnchor) return;

    if (this.isNodeLockedByOther(node.id)) {
      const lock = this.getNodeLock(node.id);
      alert(`🔒 Esta tabla está bloqueada por ${lock?.userName || 'otro usuario'}.`);
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

    this.pushSnapshot();
    const { connsToDelete, nodesToDelete } = this.connectionOps.computeCascadeDelete(
      connId,
      this.nodes(),
      this.connections(),
    );

    if (nodesToDelete.size > 0) {
      this.nodes.update((list) => list.filter((n) => !nodesToDelete.has(n.id)));
    }
    this.connections.update((list) => this.recalculateSequenceNumbers(list.filter((c) => !connsToDelete.has(c.id))));

    this.markAsUnsaved();
    this.closeEditConnModal();
    this.updateConnectionEndpoints();
    this.collabCoordinator.sendDiagramSync(this.nodes(), this.connections(), 'delete_conn');
  }

  onAiMutation(event: { nodes: UmlClassNode[]; connections: UmlConnection[]; summary: string }): void {
    if (event.nodes && event.nodes.length > 0) {
      this.applyAiMutationWithAnimation(event.nodes, event.connections || []);
      this.collabCoordinator.sendDiagramSync(event.nodes, event.connections || [], 'ai_mutation');
    }
  }

  private applyAiMutationWithAnimation(targetNodes: UmlClassNode[], targetConns: UmlConnection[]): void {
    const cleanNodes = this.applyAiNodesMutation(targetNodes);
    this.aiSyncService.precalculateAnchorPositions(
      cleanNodes,
      targetConns,
      (s, t) => this.getOptimalConnectorId(s, t),
      (n, side) => this.getConnectorPoint(n, side),
    );

    const cleanConns = this.sanitizeClientConnections(targetConns, cleanNodes);
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

  private applyAiNodesMutation(targetNodes: any[]): UmlClassNode[] {
    return this.aiSyncService.applyAiNodesMutation(targetNodes, (nodeType, stereotype) =>
      this.getDefaultColorForNodeType(nodeType, stereotype),
    );
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

  private checkExportBlocked(): boolean {
    if (this.hasMultipleActiveUsers()) {
      alert(this.translationService.translate('appbar.multiUserExportBlocked'));
      return true;
    }
    return false;
  }

  async downloadBmpFile(): Promise<void> { await this.exportDiagramImage('bmp'); }
  async downloadPngFile(): Promise<void> { await this.exportDiagramImage('png'); }

  private async exportDiagramImage(format: 'bmp' | 'png'): Promise<void> {
    if (this.checkExportBlocked()) return;
    await this.diagramExportService.exportDiagramImage(
      this.diagramCanvas,
      format,
      this.currentDiagramName(),
      this.activeDiagramType(),
      this.nodes(),
      this.connections(),
    );
  }

  downloadXmiFile(): void {
    if (this.checkExportBlocked()) return;
    const diagId = this.currentDiagramId();
    if (!diagId) {
      alert('Debes guardar el diagrama antes de exportar XMI.');
      return;
    }

    this.exportService.exportXmi({
      diagramId: diagId,
      diagramName: this.currentDiagramName(),
      hasUnsavedChanges: this.hasUnsavedChanges(),
      isReadOnly: this.isReadOnly(),
      xmiService: this.xmiService,
      saveAst: (id, payload) => this.diagramService.saveAst(id, payload),
      buildSaveAstPayload: () => this.buildSaveAstPayload(),
      onSavedSuccessfully: () => {
        this.hasUnsavedChanges.set(false);
        this.clearLocalDraft(diagId);
      },
    });
  }

  downloadJsonFile(): void {
    if (this.checkExportBlocked()) return;
    this.diagramExportService.downloadJsonFile(
      this.currentDiagramName(),
      this.defaultLineStyle(),
      this.nodes(),
      this.connections(),
    );
  }

  openExportModal(): void {
    if (this.checkExportBlocked()) return;
    const project = this.diagramExportService.buildProjectJson(
      this.currentDiagramName(),
      this.defaultLineStyle(),
      this.nodes(),
      this.connections(),
    );
    this.modalService.openExportModal(JSON.stringify(project, null, 2));
  }

  openImportModal(): void {
    if (this.hasMultipleActiveUsers()) {
      alert(this.translationService.translate('appbar.multiUserImportBlocked'));
      return;
    }
    this.modalService.openImportModal();
  }

  applyImportedJson(): void {
    this.importService.executeJsonImport({
      jsonString: this.jsonContent(),
      isReadOnly: this.isReadOnly(),
      hasMultipleActiveUsers: this.hasMultipleActiveUsers(),
      multiUserBlockedMsg: this.translationService.translate('appbar.multiUserImportBlocked'),
      normalizeDataType: (t) => this.normalizeDataType(t),
      normalizeReturnType: (rt) => this.normalizeReturnType(rt),
      onSuccess: (result) => {
        this.nodes.set(result.nodes);
        this.connections.set(result.connections);
        if (result.defaultLineStyle) {
          this.defaultLineStyle.set(result.defaultLineStyle);
        }
        this.updateConnectionEndpoints();
        this.showJsonModal.set(false);
        this.collabCoordinator.sendDiagramSync(this.nodes(), this.connections(), 'apply_json');
      },
    });
  }

  copyJsonToClipboard(): void {
    navigator.clipboard.writeText(this.jsonContent()).then(() => {
      alert('¡JSON copiado al portapapeles!');
    });
  }

  async onFileSelected(event: Event): Promise<void> {
    await this.importService.executeFileImport({
      event,
      isReadOnly: this.isReadOnly(),
      hasMultipleActiveUsers: this.hasMultipleActiveUsers(),
      multiUserBlockedMsg: this.translationService.translate('appbar.multiUserImportBlocked'),
      normalizeDataType: (t) => this.normalizeDataType(t),
      normalizeReturnType: (rt) => this.normalizeReturnType(rt),
      onSuccess: (result) => {
        this.nodes.set(result.nodes);
        if (result.format === 'xmi') {
          if (result.name) this.currentDiagramName.set(result.name);
          if (result.diagramType) this.activeDiagramType.set(result.diagramType);
          this.connections.set(this.recalculateSequenceNumbers(result.connections, true));
          this.collabCoordinator.sendDiagramSync(this.nodes(), this.connections(), 'import_xmi');
        } else {
          this.connections.set(result.connections);
          if (result.defaultLineStyle) this.defaultLineStyle.set(result.defaultLineStyle);
          this.collabCoordinator.sendDiagramSync(this.nodes(), this.connections(), 'import_json');
        }
        this.markAsUnsaved();
        this.updateConnectionEndpoints();
        setTimeout(() => {
          this.updateConnectionEndpoints();
          this.fitView();
        }, 100);
      },
    });
  }

  triggerSpringBootGeneration(): void {
    this.modalService.openSpringBootModal();
  }

  openProfileModal(): void {
    this.modalService.openProfileModal();
  }

  syncZoomFromCanvas(): void {
    this.viewportService.syncZoomFromCanvas(this.diagramCanvas);
  }

  onZoomChanged(zoom: number): void {
    if (this.contextMenu()) {
      this.closeContextMenu();
    }
    this.viewportService.onZoomChanged(zoom, this.currentDiagramId());
  }

  zoomIn(): void { this.viewportService.zoomIn(this.diagramCanvas); }
  zoomOut(): void { this.viewportService.zoomOut(this.diagramCanvas); }
  onViewportScroll(event: Event): void {
    if (this.contextMenu()) this.closeContextMenu();
    this.viewportService.onViewportScroll(event, this.currentDiagramId());
  }
  restoreViewportScroll(diagramId: string | null): void { this.viewportService.restoreViewportScroll(this.diagramCanvas, diagramId); }
  centerViewportOnBoard(): void { this.viewportService.centerViewportOnBoard(this.diagramCanvas); }
  resetView(): void { this.viewportService.resetView(this.diagramCanvas); }
  fitView(): void { this.viewportService.fitView(this.diagramCanvas); }

  onDiagramTypeChange(type: DiagramType): void {
    this.activeDiagramType.set(type);
    this.collabCoordinator.setCurrentDiagramType(type);
  }

  onSaveEditedNode(savedNode: UmlClassNode): void {
    const sanitizedNode = this.nodeOps.sanitizeNodeStereotype(savedNode, this.activeDiagramType());

    this.pushSnapshot();
    this.nodes.update((list) =>
      list.map((n) => (n.id === sanitizedNode.id ? sanitizedNode : n))
    );
    this.updateConnectionEndpoints();
    this.markAsUnsaved();
    this.collabCoordinator.sendDiagramSync(this.nodes(), this.connections(), 'update_class');
    this.diagramCanvas?.redraw();
  }

  onSaveEditedConnection(savedConn: UmlConnection): void {
    const { isSeq, prepared } = this.connectionOps.prepareSavedEditedConnection(
      savedConn,
      this.activeDiagramType(),
      (m, seq) => this.normalizeUmlMessage(m, seq),
    );

    this.pushSnapshot();
    this.connections.update((list) => {
      const updated = list.map((c) =>
        c.id === prepared.id ? { ...prepared, messages: prepared.messages ? [...prepared.messages] : undefined } : c,
      );
      return isSeq ? this.recalculateSequenceNumbers(updated, true) : updated;
    });
    this.markAsUnsaved();
    this.closeEditConnModal();
    this.updateConnectionEndpoints();
    this.collabCoordinator.sendDiagramSync(this.nodes(), this.connections(), 'update_connection');
  }

  onApplyImportedJson(json: string): void {
    this.jsonContent.set(json);
    this.applyImportedJson();
  }

  onSetSelectedNodeColor(color: string | null): void {
    if (this.isReadOnly()) return;
    const targetIds = this.selectedNodeIdsList();
    if (targetIds.length === 0) return;

    const { anyChanged, updatedNodes } = this.nodeOps.updateNodesColor(this.nodes(), targetIds, color);
    if (!anyChanged) return;

    this.pushSnapshot();
    this.nodes.set(updatedNodes);
    this.markAsUnsaved();
    this.collabCoordinator.sendDiagramSync(
      this.nodes(),
      this.connections(),
      'update_class',
      this.defaultLineStyle(),
    );
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
    if (this.currentDiagramId() === diagramId) return;

    const outgoingId = this.currentDiagramId();
    if (outgoingId && this.diagramCanvas) {
      this.saveDiagramViewState(outgoingId, this.diagramCanvas.getViewState());
    }

    if (this.hasUnsavedChanges() && !this.isReadOnly()) {
      this.saveToBackend(true);
    }

    this.currentDiagramId.set(diagramId);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { diagramId },
      queryParamsHandling: 'merge',
    });
    this.loadDiagramFromBackend(diagramId);
  }

  getTabTypeShort(type: DiagramType): string { return this.tabManager.getTabTypeShort(type); }

  closeTab(tabId: string, event: MouseEvent): void {
    event.stopPropagation();
    if (this.currentDiagramId() === tabId && this.hasUnsavedChanges() && !this.isReadOnly()) {
      this.saveToBackend(true);
    }
    const result = this.tabManager.closeTab(tabId, this.currentDiagramId());
    if (result?.nextTabId) {
      this.onSelectDiagram(result.nextTabId);
    }
  }

  onRenameDiagram(event: { diagramId: string; name: string }): void {
    if (this.isReadOnly()) return;
    this.tabManager.renameDiagram(event, this.currentDiagramId());
  }

  async onDeleteDiagram(diagramId: string): Promise<void> {
    if (this.isReadOnly()) return;
    await this.tabManager.deleteDiagram(
      diagramId,
      this.currentDiagramId(),
      this.projectDiagrams(),
      (nextId) => {
        if (nextId) {
          this.onSelectDiagram(nextId);
        } else {
          this.currentDiagramId.set(null);
          this.nodes.set([]);
          this.connections.set([]);
        }
      },
    );
  }

  onNodeRename(event: { nodeId: string; newName: string }): void {
    if (this.isReadOnly()) return;
    const { anyChanged, updatedNodes } = this.nodeOps.renameNode(this.nodes(), event.nodeId, event.newName);
    if (!anyChanged) return;

    this.pushSnapshot();
    this.nodes.set(updatedNodes);
    this.markAsUnsaved();
    this.collabCoordinator.sendDiagramSync(
      this.nodes(),
      this.connections(),
      'edit_node',
      this.defaultLineStyle()
    );
  }
}

