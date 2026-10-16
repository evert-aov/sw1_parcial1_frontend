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
import { DiagramExportService } from './services/diagram-export.service';
import { DiagramImportService } from './services/diagram-import.service';
import { DiagramConnectionLayoutService } from './services/diagram-connection-layout.service';
import { DiagramAiSyncService } from './services/diagram-ai-sync.service';
import { DiagramHotkeysService } from './services/diagram-hotkeys.service';
import { DiagramViewportService } from './services/diagram-viewport.service';
import { DiagramModalService } from './services/diagram-modal.service';
import { DiagramPersistenceService } from './services/diagram-persistence.service';
import { DiagramContainmentService } from './services/diagram-containment.service';
import { DiagramCollaborationCoordinatorService } from './services/diagram-collaboration-coordinator.service';
import { TranslatePipe, TranslationService } from '../../../core/i18n';
import { calculateClassDynamicWidth } from './utils/node-metrics.util';

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
  readonly diagramExportService = inject(DiagramExportService, { optional: true }) ?? new DiagramExportService();
  readonly diagramAlignmentService = inject(DiagramAlignmentService, { optional: true }) ?? new DiagramAlignmentService();
  readonly diagramConnectionLayoutService = inject(DiagramConnectionLayoutService, { optional: true }) ?? new DiagramConnectionLayoutService();
  readonly diagramAiSyncService = inject(DiagramAiSyncService, { optional: true }) ?? new DiagramAiSyncService();
  readonly diagramImportService = inject(DiagramImportService, { optional: true }) ?? new DiagramImportService();
  readonly diagramHotkeysService = inject(DiagramHotkeysService, { optional: true }) ?? new DiagramHotkeysService();
  readonly diagramViewportService = inject(DiagramViewportService, { optional: true }) ?? new DiagramViewportService();
  readonly diagramModalService = inject(DiagramModalService, { optional: true }) ?? new DiagramModalService();
  readonly diagramPersistenceService = inject(DiagramPersistenceService, { optional: true }) ?? new DiagramPersistenceService();
  readonly diagramContainmentService = inject(DiagramContainmentService, { optional: true }) ?? new DiagramContainmentService();
  readonly diagramCollaborationCoordinatorService = inject(DiagramCollaborationCoordinatorService, { optional: true }) ?? new DiagramCollaborationCoordinatorService();

  private get nodeFactory(): DiagramNodeFactoryService {
    return this.diagramNodeFactoryService || new DiagramNodeFactoryService();
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
  currentDiagramName = signal<string>('Diagrama UML');
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
  readonly contextMenu = signal<DiagramContextMenuState | null>(null);

  hasClipboardContent(): boolean {
    return this.diagramClipboardService.hasClipboardContent();
  }

  // Tipos de Diagrama & Paneles (Arquitectura Extensible para Casos de Uso, Secuencia, etc.)
  readonly activeDiagramType = signal<DiagramType>(DiagramType.CLASS);

  // Pestañas abiertas en el lienzo (Multi-diagram tabs)
  readonly openTabs = signal<DiagramTab[]>([]);

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

  private saveLocalDraft(): void {
    const diagramId = this.currentDiagramId();
    if (!diagramId) return;
    this.persistenceService.saveLocalDraft(diagramId, {
      nodes: this.nodes(),
      connections: this.connections(),
      defaultLineStyle: this.defaultLineStyle(),
    });
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
  selectedNodeId = signal<string | null>(null);
  selectedNodeIds = signal<Set<string>>(new Set());
  readonly selectedNodeIdsList = computed(() => {
    const set = this.selectedNodeIds();
    const single = this.selectedNodeId();
    const result = new Set(set);
    if (single) result.add(single);
    return Array.from(result);
  });
  selectedConnId = signal<string | null>(null);
  selectedConnIds = signal<Set<string>>(new Set());
  readonly selectedConnIdsList = computed(() => {
    const set = this.selectedConnIds();
    const single = this.selectedConnId();
    const result = new Set(set);
    if (single) result.add(single);
    return Array.from(result);
  });

  getDefaultColorForNodeType(nodeType?: string | null, stereotype?: string | null): string {
    const nt = nodeType || 'class';
    const st = stereotype || '';

    if (nt === 'device' || st === 'device') return '#F3FAF7';
    if (nt === 'executionEnvironment' || st === 'executionEnvironment') return '#CDE5F5';
    if (nt === 'component' || st === 'component' || nt === 'package' || nt === 'boundary_box') return '#FAF1EC';
    if (nt === 'boundary' || nt === 'control' || nt === 'entity' || nt === 'lifeline' || st === 'UI' || st === 'Entity.' || st === 'Controller.' || st === 'boundary' || st === 'control' || st === 'entity') return '#DDF4F5';
    if (nt === 'use_case') return '#E5F2FE';
    if (nt === 'actor') return '#FEF2DD';
    if (nt === 'node') return '#F3FAF7';
    return '#FDFAF3';
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

  // Tipos de datos predefinidos
  readonly predefinedTypes: string[] = [
    'UUID', 'String', 'Integer', 'Long', 'Boolean', 'Double',
    'Float', 'BigDecimal', 'LocalDate', 'LocalDateTime', 'Date', 'Text', 'byte[]'
  ];

  // Tipos de retorno predefinidos
  readonly predefinedReturnTypes: string[] = [
    'void', 'UUID', 'String', 'Integer', 'Long', 'Boolean',
    'Double', 'BigDecimal', 'LocalDate', 'LocalDateTime', 'List<Object>', 'Object'
  ];

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
  readonly boardWidth = computed(() => {
    let max = 2200;
    for (const node of this.nodes()) {
      if (node.position && node.position.x + 350 > max) {
        max = node.position.x + 350;
      }
    }
    return max;
  });

  readonly boardHeight = computed(() => {
    let max = 1400;
    for (const node of this.nodes()) {
      if (node.position && node.position.y + 350 > max) {
        max = node.position.y + 350;
      }
    }
    return max;
  });

  private animationTimers: any[] = [];

  ngOnInit(): void {
    this.collabCoordinator.setupSubscriptions({
      onRemoteNodeDrag: (data) => {
        this.nodes.update((list) =>
          list.map((n) => (n.id === data.nodeId ? { ...n, position: data.position } : n)),
        );
        this.updateConnectionEndpoints();
      },
      onRemoteDiagramSync: (data) => {
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
      },
      onNodeLockRejected: (data) => {
        if (this.editingNode()?.id === data.nodeId) {
          this.isEditNodeModalOpen.set(false);
          this.editingNode.set(null);
          alert(`🔒 La tabla está siendo editada por ${data.lockedBy.userName}. Por favor espera.`);
        }
      },
      onServerSave: (data) => {
        if (data.diagramId === this.currentDiagramId()) {
          this.diagramService.isSaving.set(false);
          this.diagramService.lastSavedAt.set(new Date(data.savedAt));
          if (!this.hasUnsavedChanges()) {
            this.persistenceService.notifySaveSuccess(2000);
          }
        }
      },
      onReconnected: () => {
        const diagramId = this.currentDiagramId();
        if (diagramId) {
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
      },
    });

    // Pipeline de auto-guardado en tiempo real estilo Google Docs
    this.persistenceService.setupAutoSave(() => {
      if (this.hasUnsavedChanges() && !this.isReadOnly() && this.currentDiagramId()) {
        this.saveToBackend(true);
      }
    });

    // Sincronización y persistencia al terminar arrastre de nodos
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

    this.route.queryParams.subscribe((params) => {
      const diagramId = params['diagramId'];
      const projectId = params['projectId'];
      const projectName = params['projectName'];

      if (projectId) {
        this.currentProjectId.set(projectId);
        this.diagramService.loadDiagramsByProject(projectId).subscribe();
        this.projectService.getProject(projectId).subscribe({
          next: (project) => {
            this.currentProject.set(project);
            const user = this.authService.currentUser();
            if (user && project) {
              if (project.userRole) {
                this.currentUserRole.set(project.userRole);
              } else if (project.createdBy === user.id) {
                this.currentUserRole.set('OWNER');
              } else if (project.members) {
                const myMember = project.members.find((m: any) => m.userId === user.id);
                if (myMember) {
                  this.currentUserRole.set(myMember.role);
                }
              }
            }
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
    });

    this.updateConnectionEndpoints();
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

      const isSequence = diagram.type === 'sequence';

      // Si hay un borrador local generado por desconexión no guardada
      const localDraftRaw = localStorage.getItem(`uml_draft_${diagramId}`);
      if (localDraftRaw) {
        try {
          const draft = JSON.parse(localDraftRaw);
          const serverUpdated = diagram.updatedAt ? new Date(diagram.updatedAt).getTime() : 0;
          if (draft.timestamp && draft.timestamp > serverUpdated && draft.nodes?.length > 0) {
            console.log('Restaurando borrador local no guardado por desconexión previa...');
            const sanitizedDraftNodes: UmlClassNode[] = (draft.nodes || []).map((n: any) => {
              let nodeType: UmlNodeType | string = n.nodeType || 'class';
              if (nodeType === 'class') {
                if (n.id?.startsWith('actor_')) nodeType = 'actor';
                else if (n.id?.startsWith('use_case_')) nodeType = 'use_case';
                else if (n.id?.startsWith('boundary_box_')) nodeType = 'boundary_box';
                else if (n.id?.startsWith('package_')) nodeType = 'package';
                else if (n.id?.startsWith('boundary_')) nodeType = 'boundary';
                else if (n.id?.startsWith('control_')) nodeType = 'control';
                else if (n.id?.startsWith('entity_')) nodeType = 'entity';
                else if (n.id?.startsWith('component_')) nodeType = 'component';
                else if (n.id?.startsWith('device_')) nodeType = 'device';
                else if (n.id?.startsWith('exec_env_') || n.id?.startsWith('exec_')) nodeType = 'executionEnvironment';
                else if (n.id?.startsWith('lifeline_') || isSequence) nodeType = 'lifeline';
              }
              let name = n.name || '';
              if (nodeType === 'boundary_box' && (name === 'ClassName' || !name.trim())) {
                name = '.';
              }
              let nodeColor = n.color;
              if (!nodeColor || ((nodeColor === '#FFFDDD' || nodeColor === '#FDFAF3') && ['device', 'executionEnvironment', 'component', 'node', 'boundary_box', 'boundary', 'control', 'entity', 'lifeline', 'actor', 'use_case', 'package'].includes(nodeType))) {
                nodeColor = this.getDefaultColorForNodeType(nodeType, n.stereotype);
              }
              const isExplicitSizeNode = ['component', 'device', 'node', 'executionEnvironment', 'boundary_box', 'package'].includes(nodeType);
              const defaultH = nodeType === 'lifeline' ? 60 : (nodeType === 'component' ? 70 : (nodeType === 'device' || nodeType === 'node' ? 140 : (nodeType === 'executionEnvironment' ? 160 : (nodeType === 'boundary_box' ? 200 : (nodeType === 'package' ? 120 : undefined)))));
              const draftH = nodeType === 'lifeline' ? 60 : (n.height || n.customHeight || defaultH);
              return {
                ...n,
                nodeType,
                name,
                height: draftH,
                customHeight: n.customHeight || (isExplicitSizeNode ? draftH : undefined),
                customWidth: n.customWidth || (isExplicitSizeNode ? (n.width || 220) : undefined),
                isCustomSize: n.isCustomSize !== undefined ? n.isCustomSize : (isExplicitSizeNode || (!!draftH && nodeType === 'class')),
                color: nodeColor,
                stereotype: n.stereotype || null,
              };
            });
            this.nodes.set(sanitizedDraftNodes);
            this.connections.set(this.recalculateSequenceNumbers(draft.connections || [], true));
            if (draft.defaultLineStyle) {
              this.defaultLineStyle.set(draft.defaultLineStyle);
            }
            this.markAsUnsaved();
            this.updateConnectionEndpoints();
            return;
          }
        } catch (_) {}
      }

      const mappedNodes: UmlClassNode[] = (diagram.nodes || []).map((n) => {
        let nodeType: UmlNodeType | string = (n.nodeType as any) || (diagram.type === 'package' ? 'package' : (isSequence ? 'lifeline' : 'class'));
        if (nodeType === 'class') {
          if (n.id.startsWith('actor_')) {
            nodeType = 'actor';
          } else if (n.id.startsWith('use_case_')) {
            nodeType = 'use_case';
          } else if (n.id.startsWith('boundary_box_')) {
            nodeType = 'boundary_box';
          } else if (n.id.startsWith('package_')) {
            nodeType = 'package';
          } else if (n.id.startsWith('boundary_')) {
            nodeType = 'boundary';
          } else if (n.id.startsWith('control_')) {
            nodeType = 'control';
          } else if (n.id.startsWith('entity_')) {
            nodeType = 'entity';
          } else if (n.id.startsWith('component_')) {
            nodeType = 'component';
          } else if (n.id.startsWith('device_')) {
            nodeType = 'device';
          } else if (n.id.startsWith('exec_env_') || n.id.startsWith('exec_')) {
            nodeType = 'executionEnvironment';
          } else if (n.id.startsWith('lifeline_')) {
            nodeType = 'lifeline';
          } else if (isSequence) {
            nodeType = 'lifeline';
          }
        }
        const isBce = nodeType === 'boundary' || nodeType === 'control' || nodeType === 'entity';
        const isLifeline = nodeType === 'lifeline';
        const isExplicitSizeNode = ['component', 'device', 'node', 'executionEnvironment', 'boundary_box', 'package'].includes(nodeType);
        const hasExplicitDbHeight = !!(n.height && n.height > 0);
        const hasCustomFlag = !!(n as any).isCustomSize || (!!(n as any).customHeight && (n as any).customHeight > 0) || (!!(n as any).customWidth && (n as any).customWidth > 0);
        const isManuallyResized = hasCustomFlag || isExplicitSizeNode || (hasExplicitDbHeight && (nodeType === 'class' || isBce || nodeType === 'actor' || nodeType === 'use_case'));

        let nodeName = n.name || '';
        if (nodeType === 'boundary_box' && (nodeName === 'ClassName' || !nodeName.trim())) {
          nodeName = '.';
        }

        let nodeColor = n.color;
        if (!nodeColor || ((nodeColor === '#FFFDDD' || nodeColor === '#FDFAF3') && ['device', 'executionEnvironment', 'component', 'node', 'boundary_box', 'boundary', 'control', 'entity', 'lifeline', 'actor', 'use_case', 'package'].includes(nodeType))) {
          nodeColor = this.getDefaultColorForNodeType(nodeType, (n as any).stereotype);
        }

        const defaultWidth = nodeType === 'actor' ? 65 : (nodeType === 'use_case' ? 140 : (nodeType === 'boundary_box' ? 280 : (nodeType === 'package' ? 200 : (nodeType === 'component' ? 190 : (nodeType === 'device' ? 230 : (nodeType === 'executionEnvironment' ? 240 : (nodeType === 'node' ? 230 : (isBce ? 90 : (isLifeline ? 140 : 220)))))))));
        const resolvedWidth = n.width || defaultWidth;

        const defaultHeight = isLifeline ? 60 : (isBce ? 95 : (nodeType === 'actor' ? 95 : (nodeType === 'boundary_box' ? 200 : (nodeType === 'component' ? 70 : (nodeType === 'device' ? 140 : (nodeType === 'executionEnvironment' ? 160 : (nodeType === 'node' ? 140 : (nodeType === 'package' ? 120 : undefined))))))));
        const resolvedHeight = isLifeline ? 60 : (n.height || defaultHeight);

        return {
          id: n.id,
          name: nodeName,
          position: { x: n.positionX, y: n.positionY },
          width: resolvedWidth,
          height: resolvedHeight,
          customWidth: isManuallyResized ? ((n as any).customWidth || resolvedWidth) : undefined,
          customHeight: isManuallyResized ? ((n as any).customHeight || resolvedHeight) : undefined,
          isCustomSize: isManuallyResized,
          color: nodeColor,
          isAnchor: n.isAnchor,
          nodeType,
          stereotype: n.stereotype || null,
          assocMainConnId: n.assocMainConnId || undefined,
          activations: (n as any).activations || [],
          attributes: (n.attributes || []).map((a) => ({
            name: a.name,
            type: this.normalizeDataType(a.type),
            orderIndex: a.orderIndex,
            nullable: a.nullable !== undefined ? a.nullable : true,
            unique: a.unique !== undefined ? a.unique : false,
            length: a.length !== undefined ? a.length : 255,
            defaultValue: a.defaultValue ?? a.default ?? null,
            default: a.default ?? a.defaultValue ?? null,
          })),
          methods: (n.methods || []).map((m) => ({
            name: m.name,
            parameters: m.parameters,
            returnType: this.normalizeReturnType(m.returnType),
          })),
        };
      });
      this.nodes.set(mappedNodes);

      const mappedConnections: UmlConnection[] = (diagram.connections || []).map((c) => ({
        id: c.id,
        sourceNodeId: c.sourceNodeId || undefined,
        targetNodeId: c.targetNodeId || undefined,
        sourceId: c.sourceId,
        targetId: c.targetId,
        type: c.type as UmlRelationshipType,
        lineStyle: (c.lineStyle as UmlLineStyle) || 'segment',
        name: c.name || undefined,
        sourceMultiplicity: isSequence ? '' : (c.sourceMultiplicity || ''),
        targetMultiplicity: isSequence ? '' : (c.targetMultiplicity || ''),
        assocAnchorNodeId: c.assocAnchorNodeId || undefined,
        messages: (c as any).messages || [],
      }));
      this.connections.set(this.recalculateSequenceNumbers(mappedConnections, true));

      // Limpiar selecciones previas y pila de deshacer/rehacer al cambiar de diagrama
      this.selectedNodeId.set(null);
      this.selectedNodeIds.set(new Set());
      this.selectedConnId.set(null);
      this.selectedConnIds.set(new Set());
      this.selectedSourceNodeId.set(null);
      this.diagramHistoryService.clear();

      // Sincronizar pestaña activa en la barra de pestañas (tabs)
      const diagType = (diagram.type as DiagramType) || DiagramType.CLASS;
      this.openTabs.update((tabs) => {
        const index = tabs.findIndex((t) => t.id === diagram.id);
        if (index >= 0) {
          const updated = [...tabs];
          updated[index] = { ...updated[index], name: diagram.name, type: diagType };
          return updated;
        }
        return [...tabs, { id: diagram.id, name: diagram.name, type: diagType }];
      });

      this.collabCoordinator.switchRoom(this.collabCoordinator.getCurrentDiagramId(), diagramId);

      if (diagram.projectId) {
        if (!this.currentProject()) {
          this.currentProjectId.set(diagram.projectId);
          this.projectService.getProject(diagram.projectId).subscribe({
            next: (proj) => {
              this.currentProject.set(proj);
            },
            error: () => {},
          });
        }
        if (this.diagramService.projectDiagrams().length === 0) {
          this.diagramService.loadDiagramsByProject(diagram.projectId).subscribe();
        }
      }

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
    const diagramId = this.currentDiagramId();
    if (!diagramId || this.isReadOnly() || !this.hasUnsavedChanges()) return;

    // 1. Notificar inmediatamente a colaboradores por WebSocket
    this.collabCoordinator.sendDiagramSync(
      this.nodes(),
      this.connections(),
      'exit_save',
      this.defaultLineStyle(),
    );

    // 2. Fetch con keepalive: true para que el navegador garantice la persistencia en background al cerrar
    try {
      const payload = this.buildSaveAstPayload();
      const token = this.authService.token();
      const url = `${environment.apiUrl}/diagrams/${diagramId}/ast`;
      fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    } catch (_) {}
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
      escape: () => {
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
      },
      hasContextMenu: () => !!this.contextMenu(),
      closeContextMenu: () => this.closeContextMenu(),
      getRenameTargetNodeId: () => {
        const isExplorerHovered =
          this.isSidebarOpen() &&
          this.diagramSidebar?.activeTab() === 'explorer' &&
          !!this.diagramSidebar?.hoveredDiagramId();
        if (isExplorerHovered) return null;
        return this.diagramCanvas?.hoveredNodeId() || this.selectedNodeId();
      },
      startRenameNode: (targetNodeId: string) => {
        this.diagramCanvas?.startRenameNode(targetNodeId);
      },
    });
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

    if (this.selectedRelationType() === type) {
      this.selectedRelationType.set(null);
      this.selectedSourceNodeId.set(null);
    } else {
      this.selectedRelationType.set(type);
      this.selectedSourceNodeId.set(null);
    }
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

    const isSequenceNode = this.activeDiagramType() === DiagramType.SEQUENCE || node.nodeType === 'lifeline';
    if (isSequenceNode) {
      newPosition = { x: Math.round(newPosition.x), y: 50 };
    }

    if (!this.containmentService.isDraggingNode) {
      const rootsToTrace = new Set<string>([node.id]);
      if (this.selectedNodeIds().has(node.id)) {
        for (const id of this.selectedNodeIds()) {
          rootsToTrace.add(id);
        }
      }
      this.containmentService.startDrag(
        rootsToTrace,
        this.nodes(),
        (n) => this.getNodeWidth(n),
        (n) => this.getNodeHeight(n),
      );
      this.pushSnapshot();
    }

    if (!this.selectedNodeIds().has(node.id) && this.selectedNodeId() !== node.id) {
      this.selectedNodeIds.set(new Set([node.id]));
      this.selectedNodeId.set(node.id);
    }

    const last = this.containmentService.lastNodeDragPos.get(node.id);
    if (last && last.x === newPosition.x && last.y === newPosition.y) {
      return;
    }
    if (last) {
      const dx = newPosition.x - last.x;
      const dy = isSequenceNode ? 0 : newPosition.y - last.y;

      if (dx !== 0 || dy !== 0) {
        // 1. Mover nodos seleccionados explícitamente (selección múltiple)
        if (this.selectedNodeIds().size > 1 && this.selectedNodeIds().has(node.id)) {
          for (const other of this.nodes()) {
            if (other.id !== node.id && this.selectedNodeIds().has(other.id) && !other.isAnchor) {
              const otherIsSeq = this.activeDiagramType() === DiagramType.SEQUENCE || other.nodeType === 'lifeline';
              const otherY = otherIsSeq ? 50 : Math.round(other.position.y + dy);
              other.position = { x: Math.round(other.position.x + dx), y: otherY };
              this.collabCoordinator.sendNodeDrag(other.id, other.position);
            }
          }
        }

        // 2. Mover nodos descendientes jerárquicos contenidos (agrupación visual padre-hijo)
        if (this.containmentService.currentDragDescendantIds.size > 0) {
          for (const other of this.nodes()) {
            if (
              this.containmentService.currentDragDescendantIds.has(other.id) &&
              other.id !== node.id &&
              !this.selectedNodeIds().has(other.id) &&
              !other.isAnchor
            ) {
              const otherIsSeq = this.activeDiagramType() === DiagramType.SEQUENCE || other.nodeType === 'lifeline';
              const otherY = otherIsSeq ? 50 : Math.round(other.position.y + dy);
              other.position = { x: Math.round(other.position.x + dx), y: otherY };
              this.collabCoordinator.sendNodeDrag(other.id, other.position);
            }
          }
        }

        if (
          (this.selectedNodeIds().size > 1 && this.selectedNodeIds().has(node.id)) ||
          this.containmentService.currentDragDescendantIds.size > 0
        ) {
          this.diagramCanvas?.redraw();
        }
      }
    }
    this.containmentService.lastNodeDragPos.set(node.id, { x: newPosition.x, y: newPosition.y });

    node.position = newPosition;
    this.markAsUnsaved();
    this.updateConnectionEndpoints();
    this.collabCoordinator.sendNodeDrag(node.id, newPosition);
    this.persistenceService.triggerNodeDragEnd();
  }

  onNodeLabelOffsetChange(node: UmlClassNode, offset: { x: number; y: number }): void {
    if (this.isReadOnly() || this.isNodeLockedByOther(node.id)) return;
    this.pushSnapshot();
    this.nodes.update((list) =>
      list.map((n) => (n.id === node.id ? { ...n, labelOffset: { ...offset } } : n))
    );
    this.markAsUnsaved();
    this.collabCoordinator.sendDiagramSync(this.nodes(), this.connections(), 'move_node');
  }

  onMoveNodes(event: FMoveNodesEvent): void {
    if (this.isReadOnly()) return;
    this.hasMovedDuringPointerDown = true;

    if (!this.containmentService.isDraggingNode) {
      this.containmentService.startDrag(
        event.nodes.map((n) => n.id),
        this.nodes(),
        (n) => this.getNodeWidth(n),
        (n) => this.getNodeHeight(n),
      );
      this.pushSnapshot();
    }

    const nodeMap = new Map(this.nodes().map((n) => [n.id, n]));
    const eventNodeIds = new Set(event.nodes.map((n) => n.id));
    let anyMoved = false;

    for (const item of event.nodes) {
      const node = nodeMap.get(item.id);
      if (node) {
        const isSequenceNode = this.activeDiagramType() === DiagramType.SEQUENCE || node.nodeType === 'lifeline';
        const targetX = Math.round(item.position.x);
        const targetY = isSequenceNode ? 50 : Math.round(item.position.y);
        const dx = targetX - node.position.x;
        const dy = isSequenceNode ? 0 : targetY - node.position.y;
        if (dx !== 0 || dy !== 0) {
          node.position = { x: targetX, y: targetY };
          this.containmentService.lastNodeDragPos.set(node.id, { x: targetX, y: targetY });
          anyMoved = true;
          this.collabCoordinator.sendNodeDrag(node.id, node.position);

          if (this.containmentService.currentDragDescendantIds.size > 0) {
            const descendantsOfThisNode = this.getDescendantNodeIds(node.id);
            for (const descId of descendantsOfThisNode) {
              if (!eventNodeIds.has(descId)) {
                const descNode = nodeMap.get(descId);
                if (descNode && !descNode.isAnchor) {
                  const dY = (this.activeDiagramType() === DiagramType.SEQUENCE || descNode.nodeType === 'lifeline')
                    ? 50
                    : Math.round(descNode.position.y + dy);
                  descNode.position = { x: Math.round(descNode.position.x + dx), y: dY };
                  this.collabCoordinator.sendNodeDrag(descNode.id, descNode.position);
                }
              }
            }
          }
        }
      }
    }

    if (anyMoved) {
      this.nodes.set([...this.nodes()]);
      this.markAsUnsaved();
      this.updateConnectionEndpoints();
      this.diagramCanvas?.redraw();
      this.persistenceService.triggerNodeDragEnd();
    }
  }

  onCanvasMouseMove(event: MouseEvent): void {
    const flowEl = this.diagramCanvas?.getExportElement();
    if (!flowEl) return;

    const rect = flowEl.getBoundingClientRect();
    const rawX = event.clientX - rect.left;
    const rawY = event.clientY - rect.top;

    const scale = this.diagramCanvas?.canvas?.transform?.scale || 1;
    const posX = this.diagramCanvas?.canvas?.transform?.position?.x || 0;
    const posY = this.diagramCanvas?.canvas?.transform?.position?.y || 0;

    const canvasX = (rawX - posX) / scale;
    const canvasY = (rawY - posY) / scale;

    this.collabCoordinator.sendCursorPosition(canvasX, canvasY);
    this.mouseCanvasPos.set({ x: Math.round(canvasX), y: Math.round(canvasY) });
  }

  getDynamicNodeWidth(node: UmlClassNode): number {
    if (node.isAnchor) return 0;
    if (node.nodeType === 'actor') return 65;
    if (node.nodeType === 'lifeline') {
      const nameLen = (node.name || '').length;
      return Math.max(160, Math.round(nameLen * 8.5 + 44));
    }
    if (node.nodeType === 'use_case') {
      const nameLen = (node.name || '').length;
      return Math.min(260, Math.max(140, Math.round(nameLen * 7.5 + 40)));
    }
    if (node.nodeType === 'package') {
      const tabTitle = node.name ? node.name.split('\n')[0].trim() : 'Paquete';
      const bodyText = (node.attributes && node.attributes.length > 0 && node.attributes[0]?.name)
        ? node.attributes[0].name
        : (node.name && node.name.includes('\n') ? node.name.split('\n').slice(1).join('\n').trim() : '');
      const maxLen = Math.max(tabTitle.length, bodyText.length);
      return Math.max(180, Math.round(maxLen * 7.5 + 40));
    }
    if (node.nodeType === 'boundary' || node.nodeType === 'control' || node.nodeType === 'entity') {
      return 70;
    }
    return calculateClassDynamicWidth(node);
  }

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

  getNodeHeight(node: UmlClassNode): number {
    if (node.isAnchor) return 0;
    if (node.nodeType === 'lifeline') return 60;
    if (node.customHeight && node.customHeight > 0) return node.customHeight;
    if (node.isCustomSize && node.height && node.height > 0) return node.height;
    if (node.nodeType === 'actor') return node.customHeight || (node.isCustomSize ? node.height : null) || node.height || 95;

    if (node.nodeType === 'package') return node.customHeight || node.height || 120;
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
    const headerH = 34;
    const attrCount = (node.attributes || []).length;
    const methodCount = (node.methods || []).length;
    const attrH = attrCount > 0 ? attrCount * 22 + 12 : 28;
    const methodH = methodCount > 0 ? methodCount * 22 + 12 : 0;
    return headerH + attrH + methodH;
  }

  isNodeInsideParent(child: UmlClassNode, parent: UmlClassNode): boolean {
    return this.containmentService.isNodeInsideParent(
      child,
      parent,
      (n) => this.getNodeWidth(n),
      (n) => this.getNodeHeight(n),
    );
  }

  getDescendantNodeIds(parentNodeId: string): Set<string> {
    return this.containmentService.getDescendantNodeIds(
      parentNodeId,
      this.nodes(),
      (n) => this.getNodeWidth(n),
      (n) => this.getNodeHeight(n),
    );
  }

  onNodeSizeChanged(event: { node: UmlClassNode; width: number; height?: number; position: { x: number; y: number } }): void {
    if (this.isReadOnly() || this.isNodeLockedByOther(event.node.id)) return;
    this.pushSnapshot();
    this.nodes.update((list) =>
      list.map((n) =>
        n.id === event.node.id
          ? {
              ...n,
              customWidth: event.width,
              customHeight: n.nodeType === 'lifeline' ? 60 : event.height,
              isCustomSize: true,
              width: event.width,
              height: n.nodeType === 'lifeline' ? 60 : event.height,
              position: event.position,
            }
          : n
      )
    );
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

  alignNodes(direction: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'): void {
    if (this.isReadOnly()) return;
    if (this.selectedNodeIds().size < 2) return;

    this.pushSnapshot();
    const modified = this.alignmentService.alignNodes(
      this.nodes(),
      this.selectedNodeIds(),
      direction,
      (n: UmlClassNode) => this.getNodeWidth(n),
      (n: UmlClassNode) => this.getNodeHeight(n),
    );
    if (modified.length === 0) return;

    for (const n of modified) {
      this.collabCoordinator.sendNodeDrag(n.id, n.position);
    }
    this.markAsUnsaved();
    this.updateConnectionEndpoints();
    this.diagramCanvas?.redraw();
    this.collabCoordinator.sendDiagramSync(
      this.nodes(),
      this.connections(),
      'align_nodes',
      this.defaultLineStyle(),
    );
  }

  distributeNodes(direction: 'horizontal' | 'vertical'): void {
    if (this.isReadOnly()) return;
    if (this.selectedNodeIds().size < 3) return;

    this.pushSnapshot();
    const modified = this.alignmentService.distributeNodes(
      this.nodes(),
      this.selectedNodeIds(),
      direction,
      (n: UmlClassNode) => this.getNodeWidth(n),
      (n: UmlClassNode) => this.getNodeHeight(n),
    );
    if (modified.length === 0) return;

    for (const n of modified) {
      this.collabCoordinator.sendNodeDrag(n.id, n.position);
    }
    this.markAsUnsaved();
    this.updateConnectionEndpoints();
    this.diagramCanvas?.redraw();
    this.collabCoordinator.sendDiagramSync(
      this.nodes(),
      this.connections(),
      'distribute_nodes',
      this.defaultLineStyle(),
    );
  }

  snapSelectedToGrid(gridSize = 20): void {
    if (this.isReadOnly()) return;
    const modified = this.alignmentService.snapToGrid(
      this.nodes(),
      this.selectedNodeIds(),
      gridSize,
    );
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
      'snap_grid',
      this.defaultLineStyle(),
    );
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

  isRecursiveConn(conn: UmlConnection): boolean {
    return this.connectionLayoutService.isRecursiveConn(conn);
  }

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
    if (this.contextMenu()) {
      this.closeContextMenu();
    }
    this.canvasMouseDownPos = { x: event.clientX, y: event.clientY };
  }

  onCanvasBackgroundClick(event?: MouseEvent): void {
    if (this.contextMenu()) {
      this.closeContextMenu();
    }
    if (event) {
      const dist = Math.hypot(
        event.clientX - this.canvasMouseDownPos.x,
        event.clientY - this.canvasMouseDownPos.y,
      );
      // Si el cursor se movió más de 5 píxeles, fue un arrastre de selección o nodo y no un clic de deselección
      if (dist > 5) {
        return;
      }
    }
    this.selectedSourceNodeId.set(null);
    this.selectedNodeId.set(null);
    this.selectedNodeIds.set(new Set());
    this.selectedConnId.set(null);
    this.selectedConnIds.set(new Set());
    this.diagramCanvas?.clearSelection();
  }

  deselectAll(): void {
    this.selectedSourceNodeId.set(null);
    this.selectedNodeId.set(null);
    this.selectedNodeIds.set(new Set());
    this.selectedConnId.set(null);
    this.selectedConnIds.set(new Set());
    this.diagramCanvas?.clearSelection();
    this.closeContextMenu();
  }

  onSelectionChange(event: FSelectionChangeEvent): void {
    if (this.selectedRelationType() !== null) return;
    this.lastSelectionChangeTime = Date.now();

    const classNodeIds = (event.nodeIds || []).filter((id) => {
      const node = this.nodes().find((n) => n.id === id);
      return node && !node.isAnchor;
    });

    const connIds = (event.connectionIds || []).filter((id) => {
      return this.connections().some((c) => c.id === id);
    });

    if (classNodeIds.length > 0) {
      this.selectedNodeIds.set(new Set(classNodeIds));
      if (!this.selectedNodeId() || !classNodeIds.includes(this.selectedNodeId()!)) {
        this.selectedNodeId.set(classNodeIds[0]);
      }
    } else {
      this.selectedNodeIds.set(new Set());
      this.selectedNodeId.set(null);
    }

    if (connIds.length > 0) {
      this.selectedConnIds.set(new Set(connIds));
      if (!this.selectedConnId() || !connIds.includes(this.selectedConnId()!)) {
        this.selectedConnId.set(connIds[0]);
      }
    } else {
      this.selectedConnIds.set(new Set());
      this.selectedConnId.set(null);
    }
  }

  isNodeSelected(nodeId: string): boolean {
    return this.selectedNodeIds().has(nodeId) || this.selectedNodeId() === nodeId;
  }

  hasMultipleSelected(): boolean {
    return this.selectedNodeIds().size > 1;
  }

  selectAllClasses(): void {
    if (this.selectedRelationType() !== null) return;
    const nonAnchorNodes = this.nodes().filter((n) => !n.isAnchor);
    if (nonAnchorNodes.length === 0) return;
    const allIds = nonAnchorNodes.map((n) => n.id);
    this.selectedNodeIds.set(new Set(allIds));
    this.selectedNodeId.set(nonAnchorNodes[0]?.id || null);
    this.diagramCanvas?.select(allIds, []);
  }

  deleteSelected(): void {
    if (this.isReadOnly()) return;
    const nodeIdsToDelete = new Set(this.selectedNodeIds());
    if (this.selectedNodeId()) {
      nodeIdsToDelete.add(this.selectedNodeId()!);
    }
    const connIdsToDelete = new Set(this.selectedConnIds());
    if (this.selectedConnId()) {
      connIdsToDelete.add(this.selectedConnId()!);
    }

    if (nodeIdsToDelete.size === 0 && connIdsToDelete.size === 0) return;

    this.pushSnapshot();
    for (const id of nodeIdsToDelete) {
      this.removeClass(id, undefined, false);
    }
    for (const id of connIdsToDelete) {
      this.removeConnection(id);
    }
    this.selectedNodeIds.set(new Set());
    this.selectedNodeId.set(null);
    this.selectedConnIds.set(new Set());
    this.selectedConnId.set(null);
    this.diagramCanvas?.clearSelection();
  }

  onConnectionSelect(connId: string, event: MouseEvent): void {
    if (this.contextMenu()) {
      this.closeContextMenu();
    }
    if (this.selectedRelationType() !== null) return;
    event.stopPropagation();

    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      const current = new Set(this.selectedConnIds());
      if (current.has(connId)) {
        current.delete(connId);
      } else {
        current.add(connId);
      }
      this.selectedConnIds.set(current);
      const remaining = Array.from(current);
      this.selectedConnId.set(remaining.length > 0 ? remaining[remaining.length - 1] : null);
      this.diagramCanvas?.select(Array.from(this.selectedNodeIds()), remaining);
    } else {
      this.selectedNodeIds.set(new Set());
      this.selectedNodeId.set(null);
      this.selectedConnIds.set(new Set([connId]));
      this.selectedConnId.set(connId);
      this.diagramCanvas?.select([], [connId]);
    }
  }

  onNodeSelect(nodeId: string, event: MouseEvent): void {
    if (this.contextMenu()) {
      this.closeContextMenu();
    }
    if (this.selectedRelationType() !== null) return;
    event.stopPropagation();

    const isModifier = event.ctrlKey || event.metaKey || event.shiftKey;
    const fSelectionRecent = (Date.now() - this.lastSelectionChangeTime) < 300;

    if (isModifier) {
      if (fSelectionRecent) {
        // Foblex Flow ya emitió el cambio de selección en sus estructuras internas
        if (!this.selectedNodeId() || !this.selectedNodeIds().has(this.selectedNodeId()!)) {
          const first = Array.from(this.selectedNodeIds())[0] || null;
          this.selectedNodeId.set(first);
        }
        return;
      }

      // Fallback manual si Foblex no procesó la pulsación
      const current = new Set(this.selectedNodeIds());
      if (this.selectedNodeId() && !current.has(this.selectedNodeId()!)) {
        current.add(this.selectedNodeId()!);
      }
      if (current.has(nodeId)) {
        current.delete(nodeId);
        const remaining = Array.from(current);
        this.selectedNodeId.set(remaining.length > 0 ? remaining[remaining.length - 1] : null);
      } else {
        current.add(nodeId);
        this.selectedNodeId.set(nodeId);
      }
      this.selectedNodeIds.set(current);
      const ids = Array.from(current);
      if (ids.length > 0) {
        this.diagramCanvas?.select(ids, []);
      } else {
        this.diagramCanvas?.clearSelection();
      }
      return;
    }

    // Clic normal sin modificadores
    // Si el usuario acaba de arrastrar una selección múltiple, conservar la selección de todas
    if (this.hasMovedDuringPointerDown && this.selectedNodeIds().has(nodeId) && this.selectedNodeIds().size > 1) {
      return;
    }

    this.selectedNodeIds.set(new Set([nodeId]));
    this.selectedNodeId.set(nodeId);
    this.selectedConnId.set(null);
    this.selectedConnIds.set(new Set());
    this.diagramCanvas?.select([nodeId], []);
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

  undo(): void {
    if (this.isReadOnly() || !this.diagramHistoryService.canUndo()) return;

    const currentSnapshot = this.cloneSnapshot();
    const prevSnapshot = this.diagramHistoryService.undo(currentSnapshot);
    if (!prevSnapshot) return;

    this.isApplyingHistory = true;

    this.nodes.set(prevSnapshot.nodes);
    this.connections.set(prevSnapshot.connections);
    this.defaultLineStyle.set(prevSnapshot.defaultLineStyle);

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
      'undo',
      this.defaultLineStyle(),
    );
    this.persistenceService.triggerAutoSave();
  }

  redo(): void {
    if (this.isReadOnly() || !this.diagramHistoryService.canRedo()) return;

    const currentSnapshot = this.cloneSnapshot();
    const nextSnapshot = this.diagramHistoryService.redo(currentSnapshot);
    if (!nextSnapshot) return;

    this.isApplyingHistory = true;

    this.nodes.set(nextSnapshot.nodes);
    this.connections.set(nextSnapshot.connections);
    this.defaultLineStyle.set(nextSnapshot.defaultLineStyle);

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
      'redo',
      this.defaultLineStyle(),
    );
    this.persistenceService.triggerAutoSave();
  }

  isConnectionSelected(connId: string): boolean {
    const selId = this.selectedNodeId();
    if (!selId) return false;
    const conn = this.connections().find((c) => c.id === connId);
    if (!conn) return false;
    const s = conn.sourceNodeId || conn.sourceId?.replace(/_(top|bottom|left|right)$/, '');
    const t = conn.targetNodeId || conn.targetId?.replace(/_(top|bottom|left|right)$/, '');
    return s === selId || t === selId;
  }

  isConnectionDimmed(connId: string): boolean {
    if (this.hasMultipleSelected()) return false;
    const selId = this.selectedNodeId();
    if (!selId) return false;
    const conn = this.connections().find((c) => c.id === connId);
    if (!conn) return false;
    const s = conn.sourceNodeId || conn.sourceId?.replace(/_(top|bottom|left|right)$/, '');
    const t = conn.targetNodeId || conn.targetId?.replace(/_(top|bottom|left|right)$/, '');
    return s !== selId && t !== selId;
  }

  isDiamondAtStart(conn: UmlConnection): boolean {
    const sMult = (conn.sourceMultiplicity || '').trim();
    const tMult = (conn.targetMultiplicity || '').trim();
    const isTargetOne = tMult === '1' || tMult === '0..1';
    const isSourceMany = sMult.includes('*') || sMult.toLowerCase().includes('n');

    if (isTargetOne && isSourceMany) {
      return false;
    }
    return true;
  }

  swapEditingConnectionDirection(): void {
    const c = this.editingConnection();
    if (!c) return;

    const tempSourceNodeId = c.sourceNodeId;
    const tempSourceId = c.sourceId;
    const tempSourceMult = c.sourceMultiplicity;

    c.sourceNodeId = c.targetNodeId;
    c.sourceId = c.targetId;
    c.sourceMultiplicity = c.targetMultiplicity;

    c.targetNodeId = tempSourceNodeId;
    c.targetId = tempSourceId;
    c.targetMultiplicity = tempSourceMult;
  }

  isNeighborNode(nodeId: string): boolean {
    if (this.hasMultipleSelected()) return false;
    const selId = this.selectedNodeId();
    if (!selId || nodeId === selId) return false;
    return this.connections().some((c) => {
      const s = c.sourceNodeId || c.sourceId?.replace(/_(top|bottom|left|right)$/, '');
      const t = c.targetNodeId || c.targetId?.replace(/_(top|bottom|left|right)$/, '');
      return (s === selId && t === nodeId) || (t === selId && s === nodeId);
    });
  }

  private generateNextSequenceMessage(
    sourceNode?: UmlClassNode,
    targetNode?: UmlClassNode,
    isReturn: boolean = false,
  ): UmlMessage[] {
    return [
      {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        sequenceNumber: '',
        functionName: 'msj',
        parameters: '',
        returnType: '',
        isReturn,
        direction: 'forward',
        orderIndex: 0,
        color: '#0284C7',
      },
    ];
  }

  private recalculateSequenceNumbers(
    connectionsList: UmlConnection[],
    preserveSequenceNumbers = false,
  ): UmlConnection[] {
    const isSeq = this.activeDiagramType() === DiagramType.SEQUENCE;
    if (!isSeq) {
      return connectionsList;
    }

    const palette = [
      '#0284C7', // Grupo 1: Azul cielo
      '#7C3AED', // Grupo 2: Violeta
      '#059669', // Grupo 3: Esmeralda
      '#D97706', // Grupo 4: Ámbar
      '#DC2626', // Grupo 5: Rojo carmesí
      '#0891B2', // Grupo 6: Cyan
      '#4F46E5', // Grupo 7: Índigo
      '#C026D3', // Grupo 8: Magenta
    ];

    const nodeMap = new Map(this.nodes().map((n) => [n.id, n]));

    interface SeqConnMeta {
      conn: UmlConnection;
      slot: number;
      index: number;
    }

    const seqMetas: SeqConnMeta[] = [];
    connectionsList.forEach((c, idx) => {
      const isConnSeq =
        isSeq || ['sync', 'reply', 'async', 'create', 'self'].includes(c.type as any);
      if (isConnSeq) {
        const sMatch = c.sourceId?.match(/_slot_(\d+)$/);
        const tMatch = c.targetId?.match(/_slot_(\d+)$/);
        const slot = sMatch ? parseInt(sMatch[1], 10)
          : tMatch ? parseInt(tMatch[1], 10)
          : c.messages?.[0]?.orderIndex ?? idx;
        seqMetas.push({ conn: c, slot, index: idx });
      }
    });

    if (seqMetas.length === 0) {
      return connectionsList;
    }

    // Ordenar cronológicamente de arriba hacia abajo según el slot
    seqMetas.sort((a, b) => a.slot - b.slot || a.index - b.index);

    let currentGroup = 0;
    let childIndex = 0;

    const updatedConnMap = new Map<string, UmlConnection>();

    let globalOrderIndex = 0;
    for (const meta of seqMetas) {
      const c = meta.conn;
      const baseSourceId = c.sourceNodeId || c.sourceId?.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
      const baseTargetId = c.targetNodeId || c.targetId?.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
      const sourceNode = nodeMap.get(baseSourceId);
      const targetNode = nodeMap.get(baseTargetId);

      // Una nueva interacción/grupo inicia cuando el Actor envía un mensaje hacia una línea de vida
      const isActorSource = sourceNode?.nodeType === 'actor';

      let seqNum: string;
      if (isActorSource || currentGroup === 0) {
        currentGroup++;
        childIndex = 0;
        seqNum = `${currentGroup}`;
      } else {
        childIndex++;
        seqNum = `${currentGroup}.${childIndex}`;
      }

      // Cargar/importar no debe convertir etiquetas EA explícitas en grupos por actor.
      const explicitNumber = c.messages?.[0]?.sequenceNumber?.trim();
      if (preserveSequenceNumbers && explicitNumber) seqNum = explicitNumber;
      const color = preserveSequenceNumbers
        ? XmiClientParser.getGroupColor(seqNum)
        : palette[(currentGroup - 1) % palette.length];

      let updatedMessages: UmlMessage[];
      if (c.messages && c.messages.length > 0) {
        updatedMessages = c.messages.map((m, mIdx) => {
          if (mIdx === 0) {
            return {
              ...m,
              sequenceNumber: seqNum,
              direction: m.direction ?? 'forward',
              type: m.type ?? (['sync', 'reply', 'async', 'create'].includes(c.type) ? c.type : 'sync'),
              isReturn: m.isReturn ?? c.type === 'reply',
              orderIndex: globalOrderIndex++,
              color,
            };
          }
          return { ...m, orderIndex: globalOrderIndex++ };
        });
      } else {
        updatedMessages = [
          {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            sequenceNumber: seqNum,
            functionName: 'msj',
            parameters: '',
            returnType: '',
            isReturn: c.type === 'reply',
            direction: 'forward',
            orderIndex: globalOrderIndex++,
            type: ['sync', 'reply', 'async', 'create'].includes(c.type) ? c.type : 'sync',
            color,
          },
        ];
      }

      const updatedConn: UmlConnection = {
        ...c,
        name: c.name && /^\d+(\.\d+)*$/.test(c.name.trim()) ? seqNum : c.name,
        messages: updatedMessages,
      };

      updatedConnMap.set(c.id, updatedConn);
    }

    return connectionsList.map((c) => updatedConnMap.get(c.id) || c);
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
      const nodeMap = new Map(this.nodes().map((n) => [n.id, n]));
      const sourceNode = nodeMap.get(currentSource);
      const targetNode = nodeMap.get(nodeId);

      if (!sourceNode || !targetNode) return;

      if (activeRel === 'association_class') {
        if (currentSource === nodeId) {
          alert('Las clases de asociación conectan dos tablas distintas.');
          this.selectedSourceNodeId.set(null);
          return;
        }
        this.createAssociationClassBetween(sourceNode, targetNode);
        return;
      }

      const isSeqRel =
        ['sync', 'reply', 'async', 'create', 'self'].includes(activeRel) ||
        this.activeDiagramType() === DiagramType.SEQUENCE;

      let sourceId: string;
      let targetId: string;
      if (currentSource === nodeId) {
        sourceId = isSeqRel ? `${currentSource}_right` : `${currentSource}_top`;
        targetId = `${nodeId}_right`;
      } else if (isSeqRel) {
        const nextSlot = this.connectionLayoutService.findNextAvailableSlot(this.connections());
        sourceId = `${currentSource}_slot_${nextSlot}`;
        targetId = `${nodeId}_slot_${nextSlot}`;
      } else {
        const optimal = this.getOptimalConnectorId(sourceNode, targetNode);
        sourceId = optimal.sourceId;
        targetId = optimal.targetId;
      }

      let messages: UmlMessage[] | undefined = undefined;
      if (isSeqRel) {
        const isReturn = activeRel === 'reply';
        messages = this.generateNextSequenceMessage(sourceNode, targetNode, isReturn);
      }

      const newConn = this.connectionLayoutService.buildNewConnection({
        sourceNode,
        targetNode,
        relType: activeRel,
        sourceId,
        targetId,
        defaultLineStyle: this.defaultLineStyle(),
        activeDiagramType: this.activeDiagramType(),
        messages,
      });

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
  }

  onFlowLoaded(): void {
    this.updateConnectionEndpoints();
    this.diagramCanvas?.redraw();
    this.syncZoomFromCanvas();
  }

  onConnectionCreated(event: FCreateConnectionEvent): void {
    if (this.isReadOnly() || !event.fInputId) return;

    const relType = this.selectedRelationType() || 'association';
    const isSeqRel =
      ['sync', 'reply', 'async', 'create', 'self'].includes(relType) ||
      this.activeDiagramType() === DiagramType.SEQUENCE;

    if (isSeqRel) {
      const sHasSlot = event.fOutputId.includes('_slot_');
      const tHasSlot = event.fInputId.includes('_slot_');
      if (!sHasSlot || !tHasSlot) {
        // En diagramas de secuencia sólo se permite conectar slots a lo largo de la línea de vida
        return;
      }
    }

    const baseSourceId = event.fOutputId.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
    const baseTargetId = event.fInputId.replace(/_(top|bottom|left|right|slot_\d+)$/, '');

    if (this.isNodeLockedByOther(baseSourceId) || this.isNodeLockedByOther(baseTargetId)) {
      alert('🔒 No se pueden crear conexiones hacia/desde una tabla que está siendo editada.');
      return;
    }

    const nodeMap = new Map(this.nodes().map((n) => [n.id, n]));
    const sourceNode = nodeMap.get(baseSourceId);
    const targetNode = nodeMap.get(baseTargetId);

    if (relType === 'association_class' && sourceNode && targetNode) {
      if (baseSourceId === baseTargetId) {
        alert('Las clases de asociación conectan dos tablas distintas.');
        return;
      }
      this.createAssociationClassBetween(sourceNode, targetNode);
      return;
    }

    let sourceId = event.fOutputId;
    let targetId = event.fInputId;

    if (sourceNode && targetNode) {
      if (isSeqRel || sourceId.includes('_slot_') || targetId.includes('_slot_')) {
        if (baseSourceId === baseTargetId) {
          sourceId = `${baseSourceId}_right`;
          targetId = `${baseTargetId}_right`;
        } else {
          const sMatch = sourceId.match(/_slot_(\d+)$/);
          const tMatch = targetId.match(/_slot_(\d+)$/);
          let slotNum: string;
          if (sMatch) {
            slotNum = sMatch[1];
          } else if (tMatch) {
            slotNum = tMatch[1];
          } else {
            slotNum = this.connectionLayoutService.findNextAvailableSlot(this.connections());
          }

          // Validación estricta: No permitir colocar dos mensajes en la misma posición temporal (fila colineal)
          const targetSlotNum = parseInt(slotNum, 10);
          const isSlotOccupied = this.connectionLayoutService.isSequenceSlotOccupied(
            this.connections(),
            targetSlotNum,
            this.activeDiagramType(),
          );

          if (isSlotOccupied) {
            alert('⚠️ No se permite colocar dos mensajes en la misma posición temporal (fila colineal). Cada mensaje debe ubicarse en una posición distinta.');
            return;
          }

          sourceId = `${baseSourceId}_slot_${slotNum}`;
          targetId = `${baseTargetId}_slot_${slotNum}`;
        }
      } else if (baseSourceId === baseTargetId) {
        const validConnectors = [
          `${baseSourceId}_top`,
          `${baseSourceId}_right`,
          `${baseSourceId}_bottom`,
          `${baseSourceId}_left`,
        ];
        const isDistinctConnectors =
          validConnectors.includes(sourceId) &&
          validConnectors.includes(targetId) &&
          sourceId !== targetId;

        if (!isDistinctConnectors) {
          sourceId = `${baseSourceId}_top`;
          targetId = `${baseTargetId}_right`;
        }
      } else {
        const optimal = this.getOptimalConnectorId(sourceNode, targetNode);
        sourceId = optimal.sourceId;
        targetId = optimal.targetId;
      }
    }

    let messages: UmlMessage[] | undefined = undefined;
    if (isSeqRel && sourceNode && targetNode) {
      const isReturn = relType === 'reply';
      messages = this.generateNextSequenceMessage(sourceNode, targetNode, isReturn);
    }

    const newConnection = this.connectionLayoutService.buildNewConnection({
      sourceNode: sourceNode || ({ id: baseSourceId } as any),
      targetNode: targetNode || ({ id: baseTargetId } as any),
      relType,
      sourceId,
      targetId,
      defaultLineStyle: this.defaultLineStyle(),
      activeDiagramType: this.activeDiagramType(),
      messages,
    });

    this.pushSnapshot();
    this.connections.update((list) => this.recalculateSequenceNumbers([...list, newConnection]));
    this.markAsUnsaved();
    this.setPointerMode();
    this.updateConnectionEndpoints();

    this.collabCoordinator.sendDiagramSync(this.nodes(), this.connections(), 'create_conn');
    if (isSeqRel) {
      const created = this.connections().find((c) => c.id === newConnection.id) || newConnection;
      setTimeout(() => this.openEditConnModal(created), 100);
    }
  }

  onConnectionReassigned(event: FReassignConnectionEvent): void {
    if (this.isReadOnly()) return;
    this.pushSnapshot();
    const isSeq = this.activeDiagramType() === DiagramType.SEQUENCE;
    this.connections.update((list) => {
      const reassigned = list.map((c) => {
        if (c.id === event.connectionId) {
          let sId = event.nextSourceId || c.sourceId;
          let tId = event.nextTargetId || c.targetId;
          if (isSeq || ['sync', 'reply', 'async', 'create', 'self'].includes(c.type as any)) {
            const sMatch = event.nextSourceId ? event.nextSourceId.match(/_slot_(\d+)$/) : null;
            const tMatch = event.nextTargetId ? event.nextTargetId.match(/_slot_(\d+)$/) : null;
            const slotNum = sMatch ? sMatch[1] : (tMatch ? tMatch[1] : null);
            if (slotNum !== null) {
              const targetSlotNum = parseInt(slotNum, 10);
              const isOccupied = this.connectionLayoutService.isSequenceSlotOccupied(
                list,
                targetSlotNum,
                this.activeDiagramType(),
                event.connectionId,
              );
              if (isOccupied) {
                alert('⚠️ No se pueden colocar dos mensajes en la misma posición temporal (fila colineal).');
                return c;
              }
              const baseSrc = sId.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
              const baseTgt = tId.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
              sId = `${baseSrc}_slot_${slotNum}`;
              tId = `${baseTgt}_slot_${slotNum}`;
            }
          }
          return {
            ...c,
            sourceId: sId,
            targetId: tId,
          };
        }
        return c;
      });
      return this.recalculateSequenceNumbers(reassigned);
    });
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
    this.pushSnapshot();
    const { anchorNode, assocNode, mainConnection, dashedConnection } =
      this.connectionLayoutService.buildAssociationClassElements(sourceNode, targetNode);

    this.nodes.update((list) => [...list, anchorNode, assocNode]);
    this.connections.update((list) => [...list, mainConnection, dashedConnection]);
    this.markAsUnsaved();
    this.setPointerMode();
    this.updateConnectionEndpoints();
    requestAnimationFrame(() => {
      this.updateConnectionEndpoints();
      this.diagramCanvas?.reset();
    });
    this.collabCoordinator.sendDiagramSync(this.nodes(), this.connections(), 'create_assoc_class');
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

  addClass(position?: { x: number; y: number }, stereotype?: UmlStereotype | string | null): void {
    if (this.isReadOnly()) return;
    const currentType = this.activeDiagramType();
    if (currentType === DiagramType.COMMUNICATION) {
      this.showIncompatibleElementModal(currentType);
      return;
    }
    if (currentType === DiagramType.COMPONENT) {
      this.addComponent(position);
      return;
    }
    if (currentType === DiagramType.DEPLOYMENT) {
      this.addExecutionEnvironment(position);
      return;
    }
    if (currentType === DiagramType.LAYERED) {
      this.addPackage(position);
      return;
    }
    this.pushSnapshot();
    const newNode = this.nodeFactory.createClassNode(
      this.nodes(),
      currentType,
      position,
      stereotype,
      this.getScrollOffset(),
    );
    this.commitNewNode(newNode);
  }

  addComponent(position?: { x: number; y: number }): void {
    if (this.isReadOnly()) return;
    this.pushSnapshot();
    const newNode = this.nodeFactory.createComponentNode(
      this.nodes(),
      position,
      this.getScrollOffset(),
    );
    this.commitNewNode(newNode);
  }

  addDevice(position?: { x: number; y: number }): void {
    if (this.isReadOnly()) return;
    this.pushSnapshot();
    const newNode = this.nodeFactory.createDeviceNode(
      this.nodes(),
      position,
      this.getScrollOffset(),
    );
    this.commitNewNode(newNode);
  }

  addExecutionEnvironment(position?: { x: number; y: number }): void {
    if (this.isReadOnly()) return;
    this.pushSnapshot();
    const newNode = this.nodeFactory.createExecutionEnvironmentNode(
      this.nodes(),
      position,
      this.getScrollOffset(),
    );
    this.commitNewNode(newNode);
  }

  addBoundaryBox(position?: { x: number; y: number }): void {
    if (this.isReadOnly()) return;
    this.pushSnapshot();
    const newNode = this.nodeFactory.createBoundaryBoxNode(
      this.activeDiagramType(),
      position,
      this.getScrollOffset(),
    );
    this.commitNewNode(newNode, false);
  }

  addActor(position?: { x: number; y: number }): void {
    if (this.isReadOnly()) return;
    const currentType = this.activeDiagramType();
    if (currentType === DiagramType.CLASS) {
      this.showIncompatibleElementModal(currentType);
      return;
    }
    this.pushSnapshot();
    const newNode = this.nodeFactory.createActorNode(
      this.nodes(),
      currentType,
      position,
      this.getScrollOffset(),
    );
    this.commitNewNode(newNode);
  }

  addUseCase(position?: { x: number; y: number }): void {
    if (this.isReadOnly()) return;
    this.pushSnapshot();
    const newNode = this.nodeFactory.createUseCaseNode(
      this.nodes(),
      position,
      this.getScrollOffset(),
    );
    this.commitNewNode(newNode);
  }

  addPackage(position?: { x: number; y: number }): void {
    if (this.isReadOnly()) return;
    this.pushSnapshot();
    const newNode = this.nodeFactory.createPackageNode(
      this.nodes(),
      position,
      this.getScrollOffset(),
    );
    this.commitNewNode(newNode);
  }

  addBoundary(position?: { x: number; y: number }): void {
    if (this.isReadOnly()) return;
    const currentType = this.activeDiagramType();
    if (currentType === DiagramType.CLASS_ANALYSIS || currentType === DiagramType.CLASS) {
      this.showIncompatibleElementModal(currentType);
      return;
    }
    this.pushSnapshot();
    const newNode = this.nodeFactory.createBoundaryNode(
      this.nodes(),
      position,
      this.getScrollOffset(),
    );
    this.commitNewNode(newNode);
  }

  addControl(position?: { x: number; y: number }): void {
    if (this.isReadOnly()) return;
    const currentType = this.activeDiagramType();
    if (currentType === DiagramType.CLASS_ANALYSIS || currentType === DiagramType.CLASS) {
      this.showIncompatibleElementModal(currentType);
      return;
    }
    this.pushSnapshot();
    const newNode = this.nodeFactory.createControlNode(
      this.nodes(),
      position,
      this.getScrollOffset(),
    );
    this.commitNewNode(newNode);
  }

  addEntity(position?: { x: number; y: number }): void {
    if (this.isReadOnly()) return;
    const currentType = this.activeDiagramType();
    if (currentType === DiagramType.CLASS_ANALYSIS || currentType === DiagramType.CLASS) {
      this.showIncompatibleElementModal(currentType);
      return;
    }
    this.pushSnapshot();
    const newNode = this.nodeFactory.createEntityNode(
      this.nodes(),
      position,
      this.getScrollOffset(),
    );
    this.commitNewNode(newNode);
  }

  addLifeline(position?: { x: number; y: number }): void {
    if (this.isReadOnly()) return;
    this.pushSnapshot();
    const newNode = this.nodeFactory.createLifelineNode(
      this.nodes(),
      this.activeDiagramType(),
      position,
      this.getScrollOffset(),
    );
    this.commitNewNode(newNode);
  }

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
    const scrollEl = this.diagramCanvas?.flowContainerRef?.nativeElement;
    const scrollLeft = scrollEl?.scrollLeft || 0;
    const scrollTop = scrollEl?.scrollTop || 0;

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
    this.contextMenu.set(null);
  }

  onNodeContextMenu(data: { node: UmlClassNode; event: MouseEvent }): void {
    if (this.isReadOnly()) return;
    const { node, event } = data;

    // Si el nodo no forma parte de la selección actual
    if (!this.selectedNodeIds().has(node.id) && this.selectedNodeId() !== node.id) {
      if (event.ctrlKey || event.metaKey || event.shiftKey) {
        const current = new Set(this.selectedNodeIds());
        current.add(node.id);
        this.selectedNodeIds.set(current);
        this.selectedNodeId.set(node.id);
        this.diagramCanvas?.select(Array.from(current), []);
      } else {
        this.selectedNodeIds.set(new Set([node.id]));
        this.selectedNodeId.set(node.id);
        this.selectedConnId.set(null);
        this.selectedConnIds.set(new Set());
        this.diagramCanvas?.select([node.id], []);
      }
    }

    const menuWidth = 240;
    const menuHeight = 350;
    const x = Math.min(event.clientX, Math.max(10, window.innerWidth - menuWidth - 10));
    const y = Math.min(event.clientY, Math.max(10, window.innerHeight - menuHeight - 10));

    this.contextMenu.set({
      visible: true,
      x,
      y,
      type: 'node',
      node,
      canvasPos: this.diagramCanvas?.clientToCanvasCoordinates(event.clientX, event.clientY),
    });
  }

  onConnectionContextMenu(data: { conn: UmlConnection; event: MouseEvent }): void {
    if (this.isReadOnly()) return;
    const { conn, event } = data;

    this.selectedConnIds.set(new Set([conn.id]));
    this.selectedConnId.set(conn.id);
    this.selectedNodeId.set(null);
    this.selectedNodeIds.set(new Set());
    this.diagramCanvas?.select([], [conn.id]);

    const menuWidth = 240;
    const menuHeight = 280;
    const x = Math.min(event.clientX, Math.max(10, window.innerWidth - menuWidth - 10));
    const y = Math.min(event.clientY, Math.max(10, window.innerHeight - menuHeight - 10));

    this.contextMenu.set({
      visible: true,
      x,
      y,
      type: 'connection',
      connection: conn,
      canvasPos: this.diagramCanvas?.clientToCanvasCoordinates(event.clientX, event.clientY),
    });
  }

  onCanvasContextMenu(data: { event: MouseEvent; canvasPos: { x: number; y: number } }): void {
    if (this.isReadOnly()) return;
    const { event, canvasPos } = data;

    const menuWidth = 240;
    const menuHeight = 260;
    const x = Math.min(event.clientX, Math.max(10, window.innerWidth - menuWidth - 10));
    const y = Math.min(event.clientY, Math.max(10, window.innerHeight - menuHeight - 10));

    this.contextMenu.set({
      visible: true,
      x,
      y,
      type: 'canvas',
      canvasPos,
    });
  }

  reverseConnection(conn: UmlConnection): void {
    if (this.isReadOnly()) return;
    this.pushSnapshot();
    const currentS = conn.sourceNodeId || conn.sourceId?.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
    const currentT = conn.targetNodeId || conn.targetId?.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
    const sSideMatch = conn.sourceId?.match(/_(top|bottom|left|right|slot_\d+)$/);
    const tSideMatch = conn.targetId?.match(/_(top|bottom|left|right|slot_\d+)$/);
    const sSide = sSideMatch ? sSideMatch[1] : 'right';
    const tSide = tSideMatch ? tSideMatch[1] : 'left';

    conn.sourceNodeId = currentT;
    conn.targetNodeId = currentS;
    conn.from = currentT;
    conn.to = currentS;
    conn.sourceId = `${currentT}_${tSide}`;
    conn.targetId = `${currentS}_${sSide}`;

    const tempMult = conn.sourceMultiplicity;
    conn.sourceMultiplicity = conn.targetMultiplicity;
    conn.targetMultiplicity = tempMult;

    this.connections.update((conns) => [...conns]);
    this.markAsUnsaved();
    this.updateConnectionEndpoints();
    this.collabCoordinator.sendDiagramSync(this.nodes(), this.connections(), 'update_connection');
    this.closeContextMenu();
    this.showQuickToast('Dirección de relación invertida');
  }

  setConnectionLineStyle(conn: UmlConnection, style: UmlLineStyle): void {
    if (this.isReadOnly()) return;
    this.pushSnapshot();
    conn.lineStyle = style;
    this.connections.update((conns) => [...conns]);
    this.markAsUnsaved();
    this.collabCoordinator.sendDiagramSync(this.nodes(), this.connections(), 'update_connection');
    this.closeContextMenu();
    this.showQuickToast(`Estilo de línea cambiado a ${style}`);
  }

  private showIncompatibleElementModal(diagType: DiagramType): void {
    let msgKey = 'editor.incompatible.class';
    if (diagType === DiagramType.USE_CASE) {
      msgKey = 'editor.incompatible.useCase';
    } else if (diagType === DiagramType.PACKAGE) {
      msgKey = 'editor.incompatible.package';
    } else if (diagType === DiagramType.COMMUNICATION) {
      msgKey = 'editor.incompatible.communication';
    } else if (diagType === DiagramType.SEQUENCE) {
      msgKey = 'editor.incompatible.sequence';
    } else if (diagType === DiagramType.CLASS) {
      msgKey = 'editor.incompatible.class';
    } else if (diagType === DiagramType.CLASS_ANALYSIS) {
      msgKey = 'editor.incompatible.classAnalysis';
    } else if (diagType === DiagramType.COMPONENT) {
      msgKey = 'editor.incompatible.component';
    } else if (diagType === DiagramType.DEPLOYMENT) {
      msgKey = 'editor.incompatible.deployment';
    } else if (diagType === DiagramType.LAYERED) {
      msgKey = 'editor.incompatible.layered';
    }

    this.confirmDialogService.alert({
      title: 'editor.incompatible.title',
      message: msgKey,
      type: 'warning',
      confirmText: 'common.confirmModal.understood',
    });
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
    const scrollEl = this.diagramCanvas?.flowContainerRef?.nativeElement;
    const scrollOffset = {
      scrollLeft: scrollEl?.scrollLeft || 0,
      scrollTop: scrollEl?.scrollTop || 0,
    };

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

    const typeLabel = newNode.nodeType === 'actor' ? 'Actor' : (newNode.nodeType === 'use_case' ? 'Caso de Uso' : (newNode.nodeType === 'package' ? 'Paquete' : (newNode.nodeType === 'boundary' ? 'Boundary' : (newNode.nodeType === 'control' ? 'Control' : (newNode.nodeType === 'entity' ? 'Entidad' : (newNode.nodeType === 'component' ? 'Componente' : (newNode.nodeType === 'device' || newNode.nodeType === 'node' ? 'Nodo' : 'Clase')))))));
    this.showQuickToast(`${typeLabel} "${newNode.name}" copiado al lienzo`);
  }

  onNodeDropped(event: { payload: any; position: { x: number; y: number } }): void {
    if (this.isReadOnly() || !event.payload) return;
    const { payload, position } = event;

    if (payload.type === 'toolbox_node') {
      const nodeType = payload.nodeType;
      switch (nodeType) {
        case 'class':
          this.addClass(position, payload.stereotype);
          break;
        case 'component':
          this.addComponent(position);
          break;
        case 'device':
          this.addDevice(position);
          break;
        case 'executionEnvironment':
        case 'node':
          this.addExecutionEnvironment(position);
          break;
        case 'actor':
          this.addActor(position);
          break;
        case 'use_case':
          this.addUseCase(position);
          break;
        case 'package':
          this.addPackage(position);
          break;
        case 'boundary_box':
          this.addBoundaryBox(position);
          break;
        case 'boundary':
          this.addBoundary(position);
          break;
        case 'control':
          this.addControl(position);
          break;
        case 'entity':
          this.addEntity(position);
          break;
        case 'lifeline':
          this.addLifeline(position);
          break;
      }
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

    const nodesToDelete = new Set<string>([nodeId]);
    const connsToDelete = new Set<string>();

    // 1. Identificar conexiones que tocan directamente a nodeId
    const directConns = this.connections().filter((c) => {
      const sourceBase = c.sourceNodeId || c.sourceId.replace(/_(top|bottom|left|right)$/, '');
      const targetBase = c.targetNodeId || c.targetId.replace(/_(top|bottom|left|right)$/, '');
      return sourceBase === nodeId || targetBase === nodeId;
    });

    directConns.forEach((c) => {
      connsToDelete.add(c.id);

      // Si la conexión tiene un ancla asociada (relación muchos a muchos con tabla intermedia)
      if (c.assocAnchorNodeId) {
        nodesToDelete.add(c.assocAnchorNodeId);
      }

      // Buscar si alguna tabla intermedia está vinculada a esta conexión principal
      this.nodes().forEach((n) => {
        if (n.assocMainConnId === c.id) {
          nodesToDelete.add(n.id);
        }
      });
    });

    // 2. Si el propio nodo a eliminar es una tabla intermedia (tiene assocMainConnId)
    const targetNode = this.nodes().find((n) => n.id === nodeId);
    if (targetNode?.assocMainConnId) {
      connsToDelete.add(targetNode.assocMainConnId);
      const mainConn = this.connections().find((c) => c.id === targetNode.assocMainConnId);
      if (mainConn?.assocAnchorNodeId) {
        nodesToDelete.add(mainConn.assocAnchorNodeId);
      }
    }

    // 3. Buscar todas las tablas/anclas asociadas por conexiones tipo 'association_class' (línea discontinua «link»)
    this.connections().forEach((c) => {
      if (c.type === 'association_class') {
        const sourceBase = c.sourceNodeId || c.sourceId.replace(/_(top|bottom|left|right)$/, '');
        const targetBase = c.targetNodeId || c.targetId.replace(/_(top|bottom|left|right)$/, '');
        if (nodesToDelete.has(sourceBase)) {
          nodesToDelete.add(targetBase);
        }
        if (nodesToDelete.has(targetBase)) {
          nodesToDelete.add(sourceBase);
        }
      }
    });

    // 4. Si cualquier nodo ancla o tabla intermedia está marcado, marcar la conexión principal
    this.connections().forEach((c) => {
      if (c.assocAnchorNodeId && nodesToDelete.has(c.assocAnchorNodeId)) {
        connsToDelete.add(c.id);
      }
    });
    this.nodes().forEach((n) => {
      if (n.assocMainConnId && nodesToDelete.has(n.id)) {
        connsToDelete.add(n.assocMainConnId);
      }
    });

    // 5. Eliminar todas las conexiones que toquen a cualquiera de los nodos marcados para eliminación
    this.connections().forEach((c) => {
      const sourceBase = c.sourceNodeId || c.sourceId.replace(/_(top|bottom|left|right)$/, '');
      const targetBase = c.targetNodeId || c.targetId.replace(/_(top|bottom|left|right)$/, '');
      if (nodesToDelete.has(sourceBase) || nodesToDelete.has(targetBase)) {
        connsToDelete.add(c.id);
      }
    });

    // 6. Aplicar la eliminación en cascada a los signals
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

  saveEditedNode(): void {
    const edited = this.editingNode();
    if (!edited) return;

    this.pushSnapshot();
    this.nodes.update((list) => list.map((n) => (n.id === edited.id ? edited : n)));
    this.markAsUnsaved();
    this.closeEditNodeModal();
    this.updateConnectionEndpoints();
    this.collabCoordinator.sendDiagramSync(this.nodes(), this.connections(), 'update_node');
  }

  addAttributeToEditingNode(): void {
    this.modalService.addAttributeToEditingNode();
  }

  removeAttributeFromEditingNode(index: number): void {
    this.modalService.removeAttributeFromEditingNode(index);
  }

  addMethodToEditingNode(): void {
    this.modalService.addMethodToEditingNode();
  }

  removeMethodFromEditingNode(index: number): void {
    this.modalService.removeMethodFromEditingNode(index);
  }

  openEditConnModal(conn: UmlConnection, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (this.isReadOnly()) return;

    this.modalService.openEditConnModal(conn);
  }

  closeEditConnModal(): void {
    this.modalService.closeEditConnModal();
  }

  saveEditedConnection(): void {
    const edited = this.editingConnection();
    if (!edited) return;

    if (edited.type === 'generalization' || edited.type === 'realization') {
      edited.sourceMultiplicity = '';
      edited.targetMultiplicity = '';
    }

    if (this.activeDiagramType() === DiagramType.SEQUENCE && edited.messages && edited.messages.length > 0) {
      const palette = ['#0284C7', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0891B2', '#4F46E5', '#C026D3'];
      const m = edited.messages[0];
      const match = m.sequenceNumber?.trim().match(/^(\d+)(?:\.|$)/);
      if (match) {
        const g = parseInt(match[1], 10);
        m.color = palette[(Math.max(1, g) - 1) % palette.length];
      }
    }

    this.pushSnapshot();
    this.connections.update((list) => this.recalculateSequenceNumbers(list.map((c) => (c.id === edited.id ? edited : c)), true));
    this.markAsUnsaved();
    this.closeEditConnModal();
    this.updateConnectionEndpoints();
    this.collabCoordinator.sendDiagramSync(this.nodes(), this.connections(), 'update_conn');
  }

  removeConnection(connId: string, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (this.isReadOnly()) return;

    this.pushSnapshot();
    const conn = this.connections().find((c) => c.id === connId);
    const connsToDelete = new Set<string>([connId]);
    const nodesToDelete = new Set<string>();

    if (conn) {
      if (conn.assocAnchorNodeId) {
        nodesToDelete.add(conn.assocAnchorNodeId);
      }
      this.nodes().forEach((n) => {
        if (n.assocMainConnId === conn.id) {
          nodesToDelete.add(n.id);
        }
      });

      if (conn.type === 'association_class') {
        const sourceBase = conn.sourceNodeId || conn.sourceId.replace(/_(top|bottom|left|right)$/, '');
        const targetBase = conn.targetNodeId || conn.targetId.replace(/_(top|bottom|left|right)$/, '');
        const sourceNode = this.nodes().find((n) => n.id === sourceBase);
        const targetNode = this.nodes().find((n) => n.id === targetBase);
        if (sourceNode?.isAnchor) nodesToDelete.add(sourceNode.id);
        if (targetNode?.isAnchor) nodesToDelete.add(targetNode.id);
        if (sourceNode && !sourceNode.isAnchor) nodesToDelete.add(sourceNode.id);
        if (targetNode && !targetNode.isAnchor) nodesToDelete.add(targetNode.id);
      }
    }

    // Propagar relaciones association_class en cascada
    this.connections().forEach((c) => {
      if (c.type === 'association_class') {
        const sourceBase = c.sourceNodeId || c.sourceId.replace(/_(top|bottom|left|right)$/, '');
        const targetBase = c.targetNodeId || c.targetId.replace(/_(top|bottom|left|right)$/, '');
        if (nodesToDelete.has(sourceBase)) nodesToDelete.add(targetBase);
        if (nodesToDelete.has(targetBase)) nodesToDelete.add(sourceBase);
      }
    });

    // Si cualquier nodo ancla o tabla intermedia está marcado, marcar la conexión principal
    this.connections().forEach((c) => {
      if (c.assocAnchorNodeId && nodesToDelete.has(c.assocAnchorNodeId)) {
        connsToDelete.add(c.id);
      }
    });
    this.nodes().forEach((n) => {
      if (n.assocMainConnId && nodesToDelete.has(n.id)) {
        connsToDelete.add(n.assocMainConnId);
      }
    });

    this.connections().forEach((c) => {
      const sourceBase = c.sourceNodeId || c.sourceId.replace(/_(top|bottom|left|right)$/, '');
      const targetBase = c.targetNodeId || c.targetId.replace(/_(top|bottom|left|right)$/, '');
      if (nodesToDelete.has(sourceBase) || nodesToDelete.has(targetBase)) {
        connsToDelete.add(c.id);
      }
    });

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
    // Precalcular la posición del ancla antes de emitir a señales para que nazca en el punto medio
    const nodeMap = new Map(cleanNodes.map((n) => [n.id, n]));
    for (const conn of targetConns) {
      if (conn.assocAnchorNodeId) {
        const anchorNode = nodeMap.get(conn.assocAnchorNodeId);
        const baseSourceId = conn.sourceNodeId || conn.sourceId?.replace(/_(top|bottom|left|right)$/, '');
        const baseTargetId = conn.targetNodeId || conn.targetId?.replace(/_(top|bottom|left|right)$/, '');
        const sourceNode = baseSourceId ? nodeMap.get(baseSourceId) : undefined;
        const targetNode = baseTargetId ? nodeMap.get(baseTargetId) : undefined;
        if (anchorNode && sourceNode && targetNode) {
          const optimal = this.getOptimalConnectorId(sourceNode, targetNode);
          const sSide = optimal.sourceId.split('_').pop() || 'right';
          const tSide = optimal.targetId.split('_').pop() || 'left';
          const p1 = this.getConnectorPoint(sourceNode, sSide);
          const p2 = this.getConnectorPoint(targetNode, tSide);
          anchorNode.position = {
            x: Math.round((p1.x + p2.x) / 2),
            y: Math.round((p1.y + p2.y) / 2),
          };
        }
      }
    }

    const cleanConns = this.sanitizeClientConnections(targetConns, cleanNodes);
    this.nodes.set(cleanNodes);
    this.connections.set(cleanConns);
    this.markAsUnsaved();

    // Redibujado secuencial: frame 1 tras cambio de señal, frame 2 tras layout del DOM, y frame 3 post-fitView
    requestAnimationFrame(() => {
      this.updateConnectionEndpoints();
      requestAnimationFrame(() => {
        this.updateConnectionEndpoints();
        this.diagramCanvas?.reset();
        setTimeout(() => {
          this.updateConnectionEndpoints();
          this.fitView();
          setTimeout(() => {
            this.diagramCanvas?.redraw();
          }, 80);
        }, 80);
      });
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

  async downloadBmpFile(): Promise<void> {
    if (this.hasMultipleActiveUsers()) {
      alert(this.translationService.translate('appbar.multiUserExportBlocked'));
      return;
    }
    await this.exportDiagramImage('bmp');
  }

  async downloadPngFile(): Promise<void> {
    if (this.hasMultipleActiveUsers()) {
      alert(this.translationService.translate('appbar.multiUserExportBlocked'));
      return;
    }
    await this.exportDiagramImage('png');
  }

  private async exportDiagramImage(format: 'bmp' | 'png'): Promise<void> {
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
    if (this.hasMultipleActiveUsers()) {
      alert(this.translationService.translate('appbar.multiUserExportBlocked'));
      return;
    }
    const diagId = this.currentDiagramId();
    if (!diagId) {
      alert('Debes guardar el diagrama antes de exportar XMI.');
      return;
    }

    const triggerDownload = () => {
      this.xmiService.exportDiagram(diagId).subscribe({
        next: (blob: Blob) => {
          const filename = `${this.currentDiagramName().toLowerCase().replace(/\s+/g, '_')}_ea.xmi`;
          this.diagramExportService.downloadBlob(blob, filename);
        },
        error: (err: any) => {
          const errMsg = err?.error?.message || err?.message || 'Error al exportar XMI.';
          alert(`Error al exportar XMI: ${errMsg}`);
        },
      });
    };

    if (this.hasUnsavedChanges() && !this.isReadOnly()) {
      const payload = this.buildSaveAstPayload();
      this.diagramService.saveAst(diagId, payload).subscribe({
        next: () => {
          this.hasUnsavedChanges.set(false);
          this.clearLocalDraft(diagId);
          triggerDownload();
        },
        error: (err) => {
          console.warn('No se pudo guardar automáticamente antes de exportar XMI:', err);
          triggerDownload();
        },
      });
    } else {
      triggerDownload();
    }
  }

  downloadJsonFile(): void {
    if (this.hasMultipleActiveUsers()) {
      alert(this.translationService.translate('appbar.multiUserExportBlocked'));
      return;
    }
    this.diagramExportService.downloadJsonFile(
      this.currentDiagramName(),
      this.defaultLineStyle(),
      this.nodes(),
      this.connections(),
    );
  }

  openExportModal(): void {
    if (this.hasMultipleActiveUsers()) {
      alert(this.translationService.translate('appbar.multiUserExportBlocked'));
      return;
    }
    const project: UmlDiagramProject = {
      version: '1.0',
      name: this.currentDiagramName(),
      createdDate: new Date().toISOString(),
      defaultLineStyle: this.defaultLineStyle(),
      nodes: this.nodes(),
      connections: this.connections(),
    };
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
    if (this.isReadOnly()) return;
    if (this.hasMultipleActiveUsers()) {
      alert(this.translationService.translate('appbar.multiUserImportBlocked'));
      return;
    }
    try {
      const project = JSON.parse(this.jsonContent()) as UmlDiagramProject;
      if (project.nodes && project.connections) {
        this.nodes.set(
          project.nodes.map((n) => ({
            ...n,
            width: n.width || 220,
            attributes: (n.attributes || []).map((a) => ({
              ...a,
              name: a.name,
              type: this.normalizeDataType(a.type),
              nullable: a.nullable !== undefined ? a.nullable : true,
              unique: a.unique !== undefined ? a.unique : false,
              length: a.length !== undefined ? a.length : 255,
              defaultValue: a.defaultValue ?? a.default ?? null,
            })),
            methods: (n.methods || []).map((m) => ({
              name: m.name,
              parameters: m.parameters,
              returnType: this.normalizeReturnType(m.returnType),
            })),
          })),
        );
        this.connections.set(project.connections);
        if (project.defaultLineStyle) {
          this.defaultLineStyle.set(project.defaultLineStyle);
        }
        this.updateConnectionEndpoints();
        this.showJsonModal.set(false);
        this.collabCoordinator.sendDiagramSync(this.nodes(), this.connections(), 'apply_json');
      } else {
        alert('Estructura JSON inválida: faltan nodos o conexiones.');
      }
    } catch (e) {
      alert('Error en el formato JSON: ' + e);
    }
  }

  copyJsonToClipboard(): void {
    navigator.clipboard.writeText(this.jsonContent()).then(() => {
      alert('¡JSON copiado al portapapeles!');
    });
  }

  async onFileSelected(event: Event): Promise<void> {
    if (this.isReadOnly()) return;
    if (this.hasMultipleActiveUsers()) {
      alert(this.translationService.translate('appbar.multiUserImportBlocked'));
      const target = event.target as HTMLInputElement;
      if (target) target.value = '';
      return;
    }
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    try {
      const result = await this.importService.parseFile(
        file,
        (t) => this.normalizeDataType(t),
        (rt) => this.normalizeReturnType(rt),
      );

      this.nodes.set(result.nodes);
      if (result.format === 'xmi') {
        if (result.name) {
          this.currentDiagramName.set(result.name);
        }
        if (result.diagramType) {
          this.activeDiagramType.set(result.diagramType);
        }
        this.connections.set(this.recalculateSequenceNumbers(result.connections, true));
        this.collabCoordinator.sendDiagramSync(this.nodes(), this.connections(), 'import_xmi');
      } else {
        this.connections.set(result.connections);
        if (result.defaultLineStyle) {
          this.defaultLineStyle.set(result.defaultLineStyle);
        }
        this.collabCoordinator.sendDiagramSync(this.nodes(), this.connections(), 'import_json');
      }

      this.markAsUnsaved();
      this.updateConnectionEndpoints();
      setTimeout(() => {
        this.updateConnectionEndpoints();
        this.fitView();
      }, 100);
    } catch (err: any) {
      alert('Error al leer el archivo: ' + (err.message || err));
    } finally {
      target.value = '';
    }
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

  zoomIn(): void {
    this.viewportService.zoomIn(this.diagramCanvas);
  }

  zoomOut(): void {
    this.viewportService.zoomOut(this.diagramCanvas);
  }

  onViewportScroll(event: Event): void {
    if (this.contextMenu()) {
      this.closeContextMenu();
    }
    this.viewportService.onViewportScroll(event, this.currentDiagramId());
  }

  restoreViewportScroll(diagramId: string | null): void {
    this.viewportService.restoreViewportScroll(this.diagramCanvas, diagramId);
  }

  centerViewportOnBoard(): void {
    this.viewportService.centerViewportOnBoard(this.diagramCanvas);
  }

  resetView(): void {
    this.viewportService.resetView(this.diagramCanvas);
  }

  fitView(): void {
    this.viewportService.fitView(this.diagramCanvas);
  }

  onDiagramTypeChange(type: DiagramType): void {
    this.activeDiagramType.set(type);
    this.collabCoordinator.setCurrentDiagramType(type);
  }

  onSaveEditedNode(savedNode: UmlClassNode): void {
    const dt = (this.activeDiagramType() || '').toLowerCase().trim();
    const nt = (savedNode.nodeType || '').toLowerCase().trim();

    if (nt === 'actor' || nt === 'use_case' || nt === 'lifeline') {
      savedNode.stereotype = null;
    } else if (dt === 'communication' || dt === 'collaboration') {
      if (nt === 'boundary' || nt === 'ui') savedNode.stereotype = UmlStereotype.BOUNDARY;
      else if (nt === 'control') savedNode.stereotype = UmlStereotype.CONTROL;
      else if (nt === 'entity') savedNode.stereotype = UmlStereotype.ENTITY;
      else savedNode.stereotype = null;
    } else if (dt === 'class' || dt === 'logical') {
      if (nt === 'class') {
        savedNode.stereotype = null;
      } else if (savedNode.stereotype && (savedNode.stereotype as string).toLowerCase() === 'class') {
        savedNode.stereotype = null;
      }
    } else if (dt === 'class_analysis') {
      const s = (savedNode.stereotype || '').toLowerCase().trim();
      if (s === 'ui' || s === 'boundary' || nt === 'boundary' || nt === 'ui') savedNode.stereotype = 'UI' as any;
      else if (s === 'controller.' || s === 'controller' || s === 'control' || nt === 'control') savedNode.stereotype = 'Controller.' as any;
      else if (s === 'entity.' || s === 'entity' || nt === 'entity') savedNode.stereotype = 'Entity.' as any;
      else if (savedNode.stereotype && !['UI', 'Controller.', 'Entity.'].includes(savedNode.stereotype as string)) {
        savedNode.stereotype = null;
      }
    }

    this.pushSnapshot();
    this.nodes.update((list) =>
      list.map((n) => (n.id === savedNode.id ? savedNode : n))
    );
    this.updateConnectionEndpoints();
    this.markAsUnsaved();
    this.collabCoordinator.sendDiagramSync(this.nodes(), this.connections(), 'update_class');
    this.diagramCanvas?.redraw();
  }

  onSaveEditedConnection(savedConn: UmlConnection): void {
    const isSeq =
      this.activeDiagramType() === DiagramType.SEQUENCE ||
      ['sync', 'reply', 'async', 'create', 'self'].includes(savedConn.type as any);

    if (isSeq || savedConn.type === 'generalization' || savedConn.type === 'realization') {
      savedConn.sourceMultiplicity = '';
      savedConn.targetMultiplicity = '';
    }

    if (isSeq && savedConn.messages && savedConn.messages.length > 0) {
      // En diagramas de secuencia cada conexión representa un único mensaje independiente
      const norm = this.normalizeUmlMessage(savedConn.messages[0], savedConn.messages[0].sequenceNumber || '1');
      norm.orderIndex = 0;
      savedConn.messages = [norm];
    }

    this.pushSnapshot();
    this.connections.update((list) => {
      const updated = list.map((c) =>
        c.id === savedConn.id ? { ...savedConn, messages: savedConn.messages ? [...savedConn.messages] : undefined } : c,
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
    const targetIds = this.selectedNodeIds().size > 0
      ? Array.from(this.selectedNodeIds())
      : (this.selectedNodeId() ? [this.selectedNodeId()!] : []);
    if (targetIds.length === 0) return;

    const newColor = color || '#FDFAF3';
    const anyChanged = this.nodes().some(
      (node) => targetIds.includes(node.id) && !node.isAnchor && (node.color || '#FDFAF3') !== newColor,
    );
    if (!anyChanged) return;

    this.pushSnapshot();
    this.nodes.update((nodes) =>
      nodes.map((node) => {
        if (targetIds.includes(node.id) && !node.isAnchor) {
          return { ...node, color: newColor };
        }
        return node;
      }),
    );
    this.markAsUnsaved();
    this.collabCoordinator.sendDiagramSync(
      this.nodes(),
      this.connections(),
      'update_class',
      this.defaultLineStyle(),
    );
  }

  // --- MÉTODOS DEL EXPLORADOR DE DIAGRAMAS POR TIPO ---

  openCreateDiagramModal(lockedType: DiagramType | null = null): void {
    this.modalService.openCreateDiagramModal(lockedType);
  }

  closeCreateDiagramModal(): void {
    this.modalService.closeCreateDiagramModal();
  }

  handleCreateDiagram(data: { name: string; type: DiagramType }): void {
    const projectId = this.currentProjectId();
    if (!projectId) {
      console.error('Cannot create diagram without a valid project ID');
      return;
    }

    if (this.hasUnsavedChanges() && !this.isReadOnly()) {
      this.saveToBackend(true);
    }

    this.diagramService.createDiagram(projectId, data.name, data.type).subscribe({
      next: (created) => {
        this.closeCreateDiagramModal();
        const diagramType = (created.type as DiagramType) || data.type;
        // Agregamos la nueva pestaña sin cerrar la anterior
        this.openTabs.update((tabs) => {
          if (!tabs.some((t) => t.id === created.id)) {
            return [...tabs, { id: created.id, name: created.name, type: diagramType }];
          }
          return tabs;
        });
        this.onSelectDiagram(created.id);
      },
      error: (err) => {
        console.error('Error creating diagram:', err);
      },
    });
  }

  onSelectDiagram(diagramId: string): void {
    if (this.currentDiagramId() === diagramId) return;

    // Guardar el estado de vista del lienzo del diagrama saliente
    const outgoingId = this.currentDiagramId();
    if (outgoingId && this.diagramCanvas) {
      this.saveDiagramViewState(outgoingId, this.diagramCanvas.getViewState());
    }

    // Si hay cambios sin guardar en el diagrama actual, persistirlos antes de cambiar
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

  getTabTypeShort(type: DiagramType): string {
    const found = UML_DIAGRAM_TYPES.find((d) => d.id === type);
    return found ? found.shortLabel : 'UML';
  }

  closeTab(tabId: string, event: MouseEvent): void {
    event.stopPropagation();
    const currentTabs = this.openTabs();
    if (currentTabs.length <= 1) return;

    if (this.currentDiagramId() === tabId && this.hasUnsavedChanges() && !this.isReadOnly()) {
      this.saveToBackend(true);
    }

    this.viewportService.deleteDiagramViewState(tabId);

    const index = currentTabs.findIndex((t) => t.id === tabId);
    const newTabs = currentTabs.filter((t) => t.id !== tabId);
    this.openTabs.set(newTabs);

    if (this.currentDiagramId() === tabId) {
      const nextIndex = Math.max(0, index - 1);
      const nextTab = newTabs[nextIndex] || newTabs[0];
      if (nextTab) {
        this.onSelectDiagram(nextTab.id);
      }
    }
  }

  onRenameDiagram(event: { diagramId: string; name: string }): void {
    if (this.isReadOnly()) return;
    this.diagramService.renameDiagram(event.diagramId, event.name).subscribe({
      next: (updated) => {
        if (this.currentDiagramId() === event.diagramId) {
          this.currentDiagramName.set(updated.name);
        }
        this.openTabs.update((tabs) =>
          tabs.map((t) => (t.id === event.diagramId ? { ...t, name: updated.name } : t))
        );
      },
      error: (err) => {
        console.error('Error renaming diagram:', err);
      },
    });
  }

  async onDeleteDiagram(diagramId: string): Promise<void> {
    if (this.isReadOnly()) return;
    const diag = this.projectDiagrams().find((d) => d.id === diagramId);
    const diagName = diag ? diag.name : 'este diagrama';

    const confirmed = await this.confirmDialogService.confirm({
      title: 'common.confirmModal.deleteDiagramTitle',
      message: 'common.confirmModal.deleteDiagramMessage',
      messageParams: { name: diagName },
      type: 'danger',
    });

    if (!confirmed) {
      return;
    }

    this.diagramService.deleteDiagram(diagramId).subscribe({
      next: () => {
        this.viewportService.deleteDiagramViewState(diagramId);

        const currentTabs = this.openTabs();
        const wasActive = this.currentDiagramId() === diagramId;
        const newTabs = currentTabs.filter((t) => t.id !== diagramId);
        this.openTabs.set(newTabs);

        if (wasActive) {
          if (newTabs.length > 0) {
            this.onSelectDiagram(newTabs[0].id);
          } else {
            const remaining = this.projectDiagrams().filter((d) => d.id !== diagramId);
            if (remaining.length > 0) {
              this.onSelectDiagram(remaining[0].id);
            } else {
              this.currentDiagramId.set(null);
              this.nodes.set([]);
              this.connections.set([]);
            }
          }
        }
      },
      error: (err) => {
        console.error('Error deleting diagram:', err);
        alert('No se pudo eliminar el diagrama.');
      },
    });
  }

  onNodeRename(event: { nodeId: string; newName: string }): void {
    if (this.isReadOnly()) return;
    const node = this.nodes().find((n) => n.id === event.nodeId);
    if (!node) return;
    let newName = event.newName ?? '';
    if (node.nodeType === 'boundary_box' && (!newName.trim() || newName === 'ClassName')) {
      newName = '.';
    }
    if (node.name === newName) return;

    this.pushSnapshot();
    this.nodes.update((list) =>
      list.map((n) => (n.id === event.nodeId ? { ...n, name: newName } : n))
    );
    this.markAsUnsaved();
    this.collabCoordinator.sendDiagramSync(
      this.nodes(),
      this.connections(),
      'edit_node',
      this.defaultLineStyle()
    );
  }
}

