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
import {
  heroMagnifyingGlassPlus,
  heroMagnifyingGlassMinus,
  heroArrowsPointingOut,
  heroDocumentText,
  heroArrowDownTray,
  heroArrowUpTray,
  heroTrash,
  heroPlus,
  heroXMark,
  heroClipboardDocument,
  heroCheck,
  heroCursorArrowRays,
  heroChevronRight,
  heroChevronDown,
  heroSquares2x2,
  heroCube,
  heroArrowsRightLeft,
  heroArrowRightOnRectangle,
  heroUserCircle,
  heroFolder,
  heroCloudArrowUp,
  heroUserGroup,
  heroSparkles,
  heroBolt,
  heroCommandLine,
  heroCpuChip,
  heroArrowPath,
  heroEye,
  heroLockClosed,
  heroLockOpen,
  heroBars3,
  heroBars3CenterLeft,
  heroChevronLeft,
  heroScissors,
  heroSquare2Stack,
  heroPencilSquare,
  heroSwatch,
  heroDocumentDuplicate,
} from '@ng-icons/heroicons/outline';

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

export interface DiagramHistorySnapshot {
  nodes: UmlClassNode[];
  connections: UmlConnection[];
  defaultLineStyle: UmlLineStyle;
}

export interface DiagramTab {
  id: string;
  name: string;
  type: DiagramType;
}

export interface DiagramContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  type: 'node' | 'connection' | 'canvas';
  node?: UmlClassNode;
  connection?: UmlConnection;
  canvasPos?: { x: number; y: number };
}

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
    TranslatePipe,
  ],
  providers: [
    provideIcons({
      heroMagnifyingGlassPlus,
      heroMagnifyingGlassMinus,
      heroArrowsPointingOut,
      heroDocumentText,
      heroArrowDownTray,
      heroArrowUpTray,
      heroTrash,
      heroPlus,
      heroXMark,
      heroClipboardDocument,
      heroCheck,
      heroCursorArrowRays,
      heroChevronRight,
      heroChevronDown,
      heroSquares2x2,
      heroCube,
      heroArrowsRightLeft,
      heroArrowRightOnRectangle,
      heroUserCircle,
      heroFolder,
      heroCloudArrowUp,
      heroUserGroup,
      heroSparkles,
      heroBolt,
      heroCommandLine,
      heroCpuChip,
      heroArrowPath,
      heroEye,
      heroLockClosed,
      heroLockOpen,
      heroBars3,
      heroBars3CenterLeft,
      heroChevronLeft,
      heroScissors,
      heroSquare2Stack,
      heroPencilSquare,
      heroSwatch,
      heroDocumentDuplicate,
    }),
  ],
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

  // Lista reactiva de diagramas del proyecto para el Explorador por tipo
  readonly projectDiagrams = this.diagramService.projectDiagrams;

  // Indica si hay 2 o más usuarios editando concurrentemente en la sala
  readonly hasMultipleActiveUsers = computed(() => {
    return this.collaborationService.isMultiUserEditing();
  });

  @ViewChild('diagramCanvas') diagramCanvas?: DiagramCanvasComponent;
  @ViewChild(DiagramSidebarComponent) diagramSidebar?: DiagramSidebarComponent;

  // Contexto del diagrama y proyecto
  currentDiagramId = signal<string | null>(null);
  currentProjectId = signal<string | null>(null);
  currentProject = signal<Project | null>(null);
  currentDiagramName = signal<string>('Diagrama UML');
  saveSuccessMessage = signal<boolean>(false);
  hasUnsavedChanges = signal<boolean>(false);
  zoomLevel = signal<number>(100);

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

  // Portapapeles de nodos para copiar/pegar entre diagramas del mismo tipo
  private clipboardNodes: {
    diagramType: DiagramType;
    nodes: UmlClassNode[];
    connections?: UmlConnection[];
  } | null = null;

  // Menú contextual flotante (clic derecho)
  readonly contextMenu = signal<DiagramContextMenuState | null>(null);

  hasClipboardContent(): boolean {
    if (this.clipboardNodes?.nodes && this.clipboardNodes.nodes.length > 0) return true;
    try {
      const saved = sessionStorage.getItem('uml_clipboard_nodes');
      if (saved) {
        const parsed = JSON.parse(saved);
        return !!(parsed?.nodes?.length > 0);
      }
    } catch (_) {}
    return false;
  }

  // Tipos de Diagrama & Paneles (Arquitectura Extensible para Casos de Uso, Secuencia, etc.)
  readonly activeDiagramType = signal<DiagramType>(DiagramType.CLASS);

  // Pestañas abiertas en el lienzo (Multi-diagram tabs)
  readonly openTabs = signal<DiagramTab[]>([]);

  // Estado de vista independiente por diagrama (zoom y posición de scroll)
  private readonly diagramViewStates = new Map<string, DiagramCanvasViewState>();

  saveDiagramViewState(diagramId: string, state?: Partial<DiagramCanvasViewState>): void {
    if (!diagramId) return;
    const current = this.getDiagramViewState(diagramId);
    const updated: DiagramCanvasViewState = {
      zoom: state?.zoom !== undefined ? state.zoom : current.zoom,
      scrollLeft: state?.scrollLeft !== undefined ? state.scrollLeft : current.scrollLeft,
      scrollTop: state?.scrollTop !== undefined ? state.scrollTop : current.scrollTop,
    };
    this.diagramViewStates.set(diagramId, updated);
    try {
      sessionStorage.setItem(`diagram_view_state_${diagramId}`, JSON.stringify(updated));
    } catch (_) {}
  }

  getDiagramViewState(diagramId: string): DiagramCanvasViewState {
    if (this.diagramViewStates.has(diagramId)) {
      return this.diagramViewStates.get(diagramId)!;
    }
    try {
      const raw = sessionStorage.getItem(`diagram_view_state_${diagramId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.zoom === 'number') {
          this.diagramViewStates.set(diagramId, parsed);
          return parsed;
        }
      }
    } catch (_) {}
    return { zoom: 100, scrollLeft: 0, scrollTop: 0 };
  }

  // Pipelines reactivos para auto-guardado en tiempo real (Google Docs style)
  private readonly autoSave$ = new Subject<void>();
  private readonly nodeDragEnd$ = new Subject<void>();

  markAsUnsaved(): void {
    if (!this.isReadOnly()) {
      this.hasUnsavedChanges.set(true);
      this.saveLocalDraft();
      this.autoSave$.next();
    }
  }

  private saveLocalDraft(): void {
    const diagramId = this.currentDiagramId();
    if (!diagramId) return;
    try {
      const draft = {
        diagramId,
        nodes: this.nodes(),
        connections: this.connections(),
        defaultLineStyle: this.defaultLineStyle(),
        timestamp: Date.now(),
      };
      localStorage.setItem(`uml_draft_${diagramId}`, JSON.stringify(draft));
    } catch (_) {}
  }

  private clearLocalDraft(diagramId: string): void {
    try {
      localStorage.removeItem(`uml_draft_${diagramId}`);
    } catch (_) {}
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
  private historyUndoStack: DiagramHistorySnapshot[] = [];
  private historyRedoStack: DiagramHistorySnapshot[] = [];
  private readonly maxHistoryLength = 50;
  private isApplyingHistory = false;
  private isDraggingNode = false;
  private hasMovedDuringPointerDown = false;
  private lastNodeDragPos = new Map<string, { x: number; y: number }>();
  private currentDragDescendantIds = new Set<string>();
  private lastSelectionChangeTime = 0;

  historyUndoCount = signal<number>(0);
  historyRedoCount = signal<number>(0);
  readonly canUndo = computed(() => this.historyUndoCount() > 0 && !this.isReadOnly());
  readonly canRedo = computed(() => this.historyRedoCount() > 0 && !this.isReadOnly());

  // Paneles laterales (Toolbox / Sidebar y Copilot IA) - Abierto por defecto con Explorador
  readonly isSidebarOpen = signal<boolean>(true);
  readonly isToolboxOpen = this.isSidebarOpen;
  isAiPanelOpen = signal<boolean>(false);
  isExportDropdownOpen = signal<boolean>(false);
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

  // Modales de edición
  isEditNodeModalOpen = signal<boolean>(false);
  isEditConnModalOpen = signal<boolean>(false);
  editingNode = signal<UmlClassNode | null>(null);
  editingConnection = signal<UmlConnection | null>(null);

  // Modal JSON
  showJsonModal = signal<boolean>(false);
  jsonContent = signal<string>('');
  jsonModalMode = signal<'import' | 'export'>('export');

  // Modal Perfil
  isProfileModalOpen = signal<boolean>(false);

  // Modal Spring Boot
  showSpringBootModal = signal<boolean>(false);

  // Modal Crear Diagrama por Tipo
  isCreateDiagramModalOpen = signal<boolean>(false);
  createDiagramLockedType = signal<DiagramType | null>(null);

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
    this.collaborationService.remoteNodeDrag$.subscribe((data) => {
      this.nodes.update((list) =>
        list.map((n) => (n.id === data.nodeId ? { ...n, position: data.position } : n)),
      );
      this.updateConnectionEndpoints();
    });

    this.collaborationService.remoteDiagramSync$.subscribe((data) => {
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
    });

    this.collaborationService.nodeLockRejected$.subscribe((data) => {
      if (this.editingNode()?.id === data.nodeId) {
        this.isEditNodeModalOpen.set(false);
        this.editingNode.set(null);
        alert(`🔒 La tabla está siendo editada por ${data.lockedBy.userName}. Por favor espera.`);
      }
    });

    // Escuchar confirmación de persistencia remota en la BD
    this.collaborationService.lastServerSave$.subscribe((data) => {
      if (data.diagramId === this.currentDiagramId()) {
        this.diagramService.isSaving.set(false);
        this.diagramService.lastSavedAt.set(new Date(data.savedAt));
        if (!this.hasUnsavedChanges()) {
          this.saveSuccessMessage.set(true);
          setTimeout(() => this.saveSuccessMessage.set(false), 2000);
        }
      }
    });

    // Pipeline de auto-guardado en tiempo real estilo Google Docs
    this.autoSave$.pipe(debounceTime(1000)).subscribe(() => {
      if (this.hasUnsavedChanges() && !this.isReadOnly() && this.currentDiagramId()) {
        this.saveToBackend(true);
      }
    });

    // Sincronización y persistencia al terminar arrastre de nodos
    this.nodeDragEnd$.pipe(debounceTime(600)).subscribe(() => {
      this.isDraggingNode = false;
      this.lastNodeDragPos.clear();
      this.currentDragDescendantIds.clear();
      if (!this.isReadOnly() && this.currentDiagramId()) {
        this.collaborationService.sendDiagramSync(
          this.nodes(),
          this.connections(),
          'move_node',
          this.defaultLineStyle(),
        );
        this.autoSave$.next();
      }
    });

    // Gestión resiliente de desconexión y reconexión de red
    let wasConnected = false;
    this.collaborationService.onConnect$.subscribe(() => {
      const diagramId = this.currentDiagramId();
      if (wasConnected && diagramId) {
        if (this.hasUnsavedChanges()) {
          this.collaborationService.sendDiagramSync(
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
      wasConnected = true;
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
      this.collaborationService.releaseNodeLock(this.editingNode()!.id);
    }
    this.animationTimers.forEach((t) => clearTimeout(t));
    this.animationTimers = [];
    this.collaborationService.leaveRoom();
  }

  loadDiagramFromBackend(diagramId: string): void {
    this.diagramService.loadDiagram(diagramId).subscribe((diagram) => {
      this.currentDiagramName.set(diagram.name);
      if (diagram.type) {
        this.activeDiagramType.set(diagram.type as DiagramType);
        this.collaborationService.currentDiagramType.set(diagram.type);
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
      this.historyUndoStack = [];
      this.historyRedoStack = [];
      this.historyUndoCount.set(0);
      this.historyRedoCount.set(0);

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

      if (this.collaborationService.currentDiagramId() && this.collaborationService.currentDiagramId() !== diagramId) {
        this.collaborationService.leaveRoom();
      }
      this.collaborationService.joinRoom(diagramId);

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
    if (!type) return 'String';
    const found = this.predefinedTypes.find((t) => t.toLowerCase() === type.trim().toLowerCase());
    return found || 'String';
  }

  normalizeReturnType(type: string): string {
    if (!type) return 'void';
    const found = this.predefinedReturnTypes.find((rt) => rt.toLowerCase() === type.trim().toLowerCase());
    return found || 'void';
  }

  getNodeLock(nodeId: string): NodeLock | undefined {
    return this.collaborationService.activeNodeLocks().get(nodeId);
  }

  isNodeLockedByOther(nodeId: string): boolean {
    const lock = this.collaborationService.activeNodeLocks().get(nodeId);
    const currentUserId = this.authService.currentUser()?.id;
    return !!lock && lock.userId !== currentUserId;
  }

  @HostListener('window:pagehide')
  onPageHide(): void {
    this.flushExitSave();
    this.collaborationService.leaveRoom();
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) {
      this.flushExitSave();
      event.preventDefault();
      event.returnValue = '';
    } else {
      this.collaborationService.leaveRoom();
    }
  }

  private flushExitSave(): void {
    const diagramId = this.currentDiagramId();
    if (!diagramId || this.isReadOnly() || !this.hasUnsavedChanges()) return;

    // 1. Notificar inmediatamente a colaboradores por WebSocket
    this.collaborationService.sendDiagramSync(
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
    this.isDraggingNode = false;
    this.lastNodeDragPos.clear();
    this.currentDragDescendantIds.clear();
    setTimeout(() => {
      this.hasMovedDuringPointerDown = false;
    }, 50);
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    const activeTag = (document.activeElement?.tagName || '').toLowerCase();
    const isInputActive = activeTag === 'input' || activeTag === 'textarea';

    if (event.key === 'Escape') {
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
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      if (!isInputActive) {
        event.preventDefault();
        this.selectAllClasses();
      }
    } else if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
      if (!isInputActive) {
        event.preventDefault();
        this.undo();
      }
    } else if (
      (event.ctrlKey || event.metaKey) &&
      (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'))
    ) {
      if (!isInputActive) {
        event.preventDefault();
        this.redo();
      }
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      if (!this.isReadOnly()) {
        this.saveToBackend();
      }
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
      event.preventDefault();
      this.isToolboxOpen.set(!this.isToolboxOpen());
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'i') {
      event.preventDefault();
      this.isAiPanelOpen.set(!this.isAiPanelOpen());
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
      if (!isInputActive) {
        event.preventDefault();
        this.copySelectedNodes();
      }
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'x') {
      if (!isInputActive) {
        event.preventDefault();
        this.cutSelectedNodes();
      }
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
      if (!isInputActive) {
        event.preventDefault();
        this.pasteNodes();
      }
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
      if (!isInputActive) {
        event.preventDefault();
        this.duplicateSelected();
      }
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      if (!isInputActive) {
        event.preventDefault();
        this.selectAllClasses();
      }
    } else if (event.key === 'Delete' && !this.isReadOnly()) {
      if (!isInputActive) {
        event.preventDefault();
        this.deleteSelected();
      }
    } else if (event.key === 'Escape') {
      if (this.contextMenu()) {
        this.closeContextMenu();
        event.preventDefault();
        return;
      }
    } else if (event.key === 'F2') {
      if (!isInputActive && !event.defaultPrevented) {
        const isExplorerHovered =
          this.isSidebarOpen() &&
          this.diagramSidebar?.activeTab() === 'explorer' &&
          !!this.diagramSidebar?.hoveredDiagramId();
        if (!isExplorerHovered) {
          const hoveredNode = this.diagramCanvas?.hoveredNodeId();
          const selectedNode = this.selectedNodeId();
          const targetNodeId = hoveredNode || selectedNode;
          if (targetNodeId && !this.isReadOnly()) {
            event.preventDefault();
            this.diagramCanvas?.startRenameNode(targetNodeId);
          }
        }
      }
    }
  }

  buildSaveAstPayload(): SaveDiagramAstRequest {
    const isSequence = this.activeDiagramType() === DiagramType.SEQUENCE;
    const connections = isSequence
      ? this.recalculateSequenceNumbers(this.connections(), true)
      : this.connections();
    return {
      type: this.activeDiagramType(),
      defaultLineStyle: this.defaultLineStyle(),
      nodes: this.nodes().map((n) => {
        const cleanName = (n.name || '').trim();
        const fallbackName = n.isAnchor
          ? 'Anchor'
          : n.nodeType === 'boundary_box'
            ? '.'
            : (isSequence
              ? (n.nodeType === 'actor' || n.id.startsWith('actor_') ? 'actor_1' : 'lifeline_1')
              : 'ClassName');
        const finalName = (n.nodeType === 'boundary_box' && (cleanName === 'ClassName' || !cleanName))
          ? '.'
          : (cleanName || fallbackName);

        const resolvedNodeType =
          n.nodeType && n.nodeType !== 'class'
            ? n.nodeType
            : n.id.startsWith('actor_')
            ? 'actor'
            : n.id.startsWith('use_case_')
            ? 'use_case'
            : n.id.startsWith('boundary_box_')
            ? 'boundary_box'
            : n.id.startsWith('package_')
            ? 'package'
            : n.id.startsWith('boundary_')
            ? 'boundary'
            : n.id.startsWith('control_')
            ? 'control'
            : n.id.startsWith('entity_')
            ? 'entity'
            : n.id.startsWith('component_')
            ? 'component'
            : n.id.startsWith('device_')
            ? 'device'
            : n.id.startsWith('exec_env_') || n.id.startsWith('exec_')
            ? 'executionEnvironment'
            : n.id.startsWith('lifeline_')
            ? 'lifeline'
            : isSequence
            ? 'lifeline'
            : this.activeDiagramType() === DiagramType.PACKAGE
            ? 'package'
            : n.nodeType || 'class';

        let nodeColor = n.color;
        if (!nodeColor || ((nodeColor === '#FFFDDD' || nodeColor === '#FDFAF3') && ['device', 'executionEnvironment', 'component', 'node', 'boundary_box', 'boundary', 'control', 'entity', 'lifeline', 'actor', 'use_case', 'package'].includes(resolvedNodeType))) {
          nodeColor = this.getDefaultColorForNodeType(resolvedNodeType, n.stereotype);
        }

        const isExplicitSize = ['component', 'device', 'node', 'executionEnvironment', 'boundary_box', 'package'].includes(resolvedNodeType);
        const savedHeight = resolvedNodeType === 'lifeline'
          ? 60
          : (isExplicitSize
              ? (n.customHeight || n.height || this.getNodeHeight(n))
              : (n.customHeight || (n.isCustomSize ? n.height : null) || null));

        return {
          id: n.id,
          name: finalName,
          positionX: n.position.x,
          positionY: n.position.y,
          width: this.getNodeWidth(n),
          height: savedHeight,
          color: nodeColor,
          isAnchor: n.isAnchor,
          assocMainConnId: n.assocMainConnId,
          nodeType: resolvedNodeType,
          stereotype: n.stereotype || null,
          activations: (n as any).activations || [],
          attributes: (n.attributes || []).map((a: any, aIdx: number) => ({
            name: a.name,
            type: a.type || 'String',
            orderIndex: typeof a.orderIndex === 'number' ? a.orderIndex : aIdx,
            nullable: a.nullable !== undefined ? a.nullable : (a.isNullable !== undefined ? a.isNullable : true),
            unique: a.unique !== undefined ? a.unique : (a.isUnique !== undefined ? a.isUnique : false),
            length: a.length !== undefined && a.length !== null ? Number(a.length) : 255,
            defaultValue: a.defaultValue ?? a.default ?? null,
            default: a.default ?? a.defaultValue ?? null,
            visibility: a.visibility || undefined,
            isPk: typeof a.isPk === 'boolean' ? a.isPk : undefined,
            isFk: typeof a.isFk === 'boolean' ? a.isFk : undefined,
            isNullable: typeof a.isNullable === 'boolean' ? a.isNullable : undefined,
            isUnique: typeof a.isUnique === 'boolean' ? a.isUnique : undefined,
          })),
          methods: (n.methods || []).map((m: any, mIdx: number) => ({
            name: m.name,
            parameters: m.parameters || '',
            returnType: m.returnType || 'void',
            orderIndex: typeof m.orderIndex === 'number' ? m.orderIndex : mIdx,
            visibility: m.visibility || undefined,
          })),
        };
      }),
      connections: connections.map((c) => {
        const baseSourceId = c.sourceNodeId || c.sourceId.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
        const baseTargetId = c.targetNodeId || c.targetId.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
        return {
          id: c.id,
          sourceNodeId: baseSourceId,
          targetNodeId: baseTargetId,
          sourceId: c.sourceId,
          targetId: c.targetId,
          type: c.type,
          lineStyle: c.lineStyle || this.defaultLineStyle(),
          name: c.name || null,
          sourceMultiplicity: isSequence ? '' : (c.sourceMultiplicity || ''),
          targetMultiplicity: isSequence ? '' : (c.targetMultiplicity || ''),
          assocAnchorNodeId: c.assocAnchorNodeId || null,
          messages: (c.messages || []).map((m, mIdx) => {
            const norm = this.normalizeUmlMessage(m, `${mIdx + 1}`);
            return {
              id: norm.id,
              sequenceNumber: norm.sequenceNumber,
              functionName: norm.functionName,
              parameters: norm.parameters ?? '',
              returnType: norm.returnType || undefined,
              direction: norm.direction,
              type: norm.type,
              isReturn: norm.isReturn,
              orderIndex: norm.orderIndex ?? mIdx,
              positionY: norm.positionY,
              color: norm.color || undefined,
            };
          }),
        };
      }),
    };
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
        this.hasUnsavedChanges.set(false);
        this.clearLocalDraft(diagramId);
        this.saveSuccessMessage.set(true);
        setTimeout(() => this.saveSuccessMessage.set(false), 2500);
        if (!silent) {
          this.collaborationService.sendDiagramSync(
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

    if (!this.isDraggingNode) {
      this.isDraggingNode = true;
      this.pushSnapshot();
      this.currentDragDescendantIds.clear();

      // Recopilar todos los nodos hijos/descendientes del nodo arrastrado y de la selección actual
      const rootsToTrace = new Set<string>([node.id]);
      if (this.selectedNodeIds().has(node.id)) {
        for (const id of this.selectedNodeIds()) {
          rootsToTrace.add(id);
        }
      }
      for (const rootId of rootsToTrace) {
        const desc = this.getDescendantNodeIds(rootId);
        for (const dId of desc) {
          this.currentDragDescendantIds.add(dId);
        }
      }
    }

    if (!this.selectedNodeIds().has(node.id) && this.selectedNodeId() !== node.id) {
      this.selectedNodeIds.set(new Set([node.id]));
      this.selectedNodeId.set(node.id);
    }

    const last = this.lastNodeDragPos.get(node.id);
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
              this.collaborationService.sendNodeDrag(other.id, other.position);
            }
          }
        }

        // 2. Mover nodos descendientes jerárquicos contenidos (agrupación visual padre-hijo)
        if (this.currentDragDescendantIds.size > 0) {
          for (const other of this.nodes()) {
            if (
              this.currentDragDescendantIds.has(other.id) &&
              other.id !== node.id &&
              !this.selectedNodeIds().has(other.id) &&
              !other.isAnchor
            ) {
              const otherIsSeq = this.activeDiagramType() === DiagramType.SEQUENCE || other.nodeType === 'lifeline';
              const otherY = otherIsSeq ? 50 : Math.round(other.position.y + dy);
              other.position = { x: Math.round(other.position.x + dx), y: otherY };
              this.collaborationService.sendNodeDrag(other.id, other.position);
            }
          }
        }

        if (
          (this.selectedNodeIds().size > 1 && this.selectedNodeIds().has(node.id)) ||
          this.currentDragDescendantIds.size > 0
        ) {
          this.diagramCanvas?.redraw();
        }
      }
    }
    this.lastNodeDragPos.set(node.id, { x: newPosition.x, y: newPosition.y });

    node.position = newPosition;
    this.markAsUnsaved();
    this.updateConnectionEndpoints();
    this.collaborationService.sendNodeDrag(node.id, newPosition);
    this.nodeDragEnd$.next();
  }

  onNodeLabelOffsetChange(node: UmlClassNode, offset: { x: number; y: number }): void {
    if (this.isReadOnly() || this.isNodeLockedByOther(node.id)) return;
    this.pushSnapshot();
    this.nodes.update((list) =>
      list.map((n) => (n.id === node.id ? { ...n, labelOffset: { ...offset } } : n))
    );
    this.markAsUnsaved();
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'move_node');
  }

  onMoveNodes(event: FMoveNodesEvent): void {
    if (this.isReadOnly()) return;
    this.hasMovedDuringPointerDown = true;

    if (!this.isDraggingNode) {
      this.isDraggingNode = true;
      this.pushSnapshot();
      this.currentDragDescendantIds.clear();
      for (const item of event.nodes) {
        const desc = this.getDescendantNodeIds(item.id);
        for (const dId of desc) {
          this.currentDragDescendantIds.add(dId);
        }
      }
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
          this.lastNodeDragPos.set(node.id, { x: targetX, y: targetY });
          anyMoved = true;
          this.collaborationService.sendNodeDrag(node.id, node.position);

          if (this.currentDragDescendantIds.size > 0) {
            const descendantsOfThisNode = this.getDescendantNodeIds(node.id);
            for (const descId of descendantsOfThisNode) {
              if (!eventNodeIds.has(descId)) {
                const descNode = nodeMap.get(descId);
                if (descNode && !descNode.isAnchor) {
                  const dY = (this.activeDiagramType() === DiagramType.SEQUENCE || descNode.nodeType === 'lifeline')
                    ? 50
                    : Math.round(descNode.position.y + dy);
                  descNode.position = { x: Math.round(descNode.position.x + dx), y: dY };
                  this.collaborationService.sendNodeDrag(descNode.id, descNode.position);
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
      this.nodeDragEnd$.next();
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

    this.collaborationService.sendCursorPosition(canvasX, canvasY);
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

  getDescendantNodeIds(parentNodeId: string): Set<string> {
    const descendants = new Set<string>();
    const nodeMap = new Map(this.nodes().map((n) => [n.id, n]));
    const parent = nodeMap.get(parentNodeId);
    if (!parent) return descendants;

    const queue: UmlClassNode[] = [parent];
    const visited = new Set<string>([parentNodeId]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const candidate of this.nodes()) {
        if (!visited.has(candidate.id) && this.isNodeInsideParent(candidate, current)) {
          visited.add(candidate.id);
          descendants.add(candidate.id);
          queue.push(candidate);
        }
      }
    }
    return descendants;
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
    this.collaborationService.sendDiagramSync(
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
    const selected = this.nodes().filter((n) => this.selectedNodeIds().has(n.id) && !n.isAnchor);
    if (selected.length < 2) return;

    this.pushSnapshot();

    if (direction === 'left') {
      const minX = Math.min(...selected.map((n) => n.position.x));
      for (const n of selected) {
        n.position = { x: minX, y: n.position.y };
        this.collaborationService.sendNodeDrag(n.id, n.position);
      }
    } else if (direction === 'center') {
      const centers = selected.map((n) => n.position.x + this.getNodeWidth(n) / 2);
      const avgCenter = Math.round(centers.reduce((a, b) => a + b, 0) / centers.length);
      for (const n of selected) {
        n.position = { x: Math.round(avgCenter - this.getNodeWidth(n) / 2), y: n.position.y };
        this.collaborationService.sendNodeDrag(n.id, n.position);
      }
    } else if (direction === 'right') {
      const maxRight = Math.max(...selected.map((n) => n.position.x + this.getNodeWidth(n)));
      for (const n of selected) {
        n.position = { x: Math.round(maxRight - this.getNodeWidth(n)), y: n.position.y };
        this.collaborationService.sendNodeDrag(n.id, n.position);
      }
    } else if (direction === 'top') {
      const minY = Math.min(...selected.map((n) => n.position.y));
      for (const n of selected) {
        n.position = { x: n.position.x, y: minY };
        this.collaborationService.sendNodeDrag(n.id, n.position);
      }
    } else if (direction === 'middle') {
      const middles = selected.map((n) => n.position.y + this.getNodeHeight(n) / 2);
      const avgMiddle = Math.round(middles.reduce((a, b) => a + b, 0) / middles.length);
      for (const n of selected) {
        n.position = { x: n.position.x, y: Math.round(avgMiddle - this.getNodeHeight(n) / 2) };
        this.collaborationService.sendNodeDrag(n.id, n.position);
      }
    } else if (direction === 'bottom') {
      const maxBottom = Math.max(...selected.map((n) => n.position.y + this.getNodeHeight(n)));
      for (const n of selected) {
        n.position = { x: n.position.x, y: Math.round(maxBottom - this.getNodeHeight(n)) };
        this.collaborationService.sendNodeDrag(n.id, n.position);
      }
    }

    this.markAsUnsaved();
    this.updateConnectionEndpoints();
    this.diagramCanvas?.redraw();
    this.collaborationService.sendDiagramSync(
      this.nodes(),
      this.connections(),
      'align_nodes',
      this.defaultLineStyle(),
    );
  }

  distributeNodes(direction: 'horizontal' | 'vertical'): void {
    if (this.isReadOnly()) return;
    const selected = this.nodes().filter((n) => this.selectedNodeIds().has(n.id) && !n.isAnchor);
    if (selected.length < 3) return;

    this.pushSnapshot();

    if (direction === 'horizontal') {
      selected.sort((a, b) => a.position.x - b.position.x);
      const first = selected[0];
      const last = selected[selected.length - 1];
      const totalWidth = selected.slice(1, -1).reduce((sum, n) => sum + this.getNodeWidth(n), 0);
      const span = last.position.x - (first.position.x + this.getNodeWidth(first));
      const spacing = Math.max(20, Math.round((span - totalWidth) / (selected.length - 1)));

      let currentX = first.position.x + this.getNodeWidth(first) + spacing;
      for (let i = 1; i < selected.length - 1; i++) {
        selected[i].position = { x: currentX, y: selected[i].position.y };
        this.collaborationService.sendNodeDrag(selected[i].id, selected[i].position);
        currentX += this.getNodeWidth(selected[i]) + spacing;
      }
    } else {
      selected.sort((a, b) => a.position.y - b.position.y);
      const first = selected[0];
      const last = selected[selected.length - 1];
      const totalHeight = selected.slice(1, -1).reduce((sum, n) => sum + this.getNodeHeight(n), 0);
      const span = last.position.y - (first.position.y + this.getNodeHeight(first));
      const spacing = Math.max(20, Math.round((span - totalHeight) / (selected.length - 1)));

      let currentY = first.position.y + this.getNodeHeight(first) + spacing;
      for (let i = 1; i < selected.length - 1; i++) {
        selected[i].position = { x: selected[i].position.x, y: currentY };
        this.collaborationService.sendNodeDrag(selected[i].id, selected[i].position);
        currentY += this.getNodeHeight(selected[i]) + spacing;
      }
    }

    this.markAsUnsaved();
    this.updateConnectionEndpoints();
    this.diagramCanvas?.redraw();
    this.collaborationService.sendDiagramSync(
      this.nodes(),
      this.connections(),
      'distribute_nodes',
      this.defaultLineStyle(),
    );
  }

  snapSelectedToGrid(gridSize = 20): void {
    if (this.isReadOnly()) return;
    const targets = this.selectedNodeIds().size > 0
      ? this.nodes().filter((n) => this.selectedNodeIds().has(n.id) && !n.isAnchor)
      : this.nodes().filter((n) => !n.isAnchor);
    if (targets.length === 0) return;

    this.pushSnapshot();
    for (const n of targets) {
      n.position = {
        x: Math.round(n.position.x / gridSize) * gridSize,
        y: Math.round(n.position.y / gridSize) * gridSize,
      };
      this.collaborationService.sendNodeDrag(n.id, n.position);
    }
    this.markAsUnsaved();
    this.updateConnectionEndpoints();
    this.diagramCanvas?.redraw();
    this.collaborationService.sendDiagramSync(
      this.nodes(),
      this.connections(),
      'snap_grid',
      this.defaultLineStyle(),
    );
  }

  getOptimalConnectorId(sourceNode: UmlClassNode, targetNode: UmlClassNode): { sourceId: string; targetId: string } {
    if (sourceNode.id === targetNode.id) {
      return {
        sourceId: `${sourceNode.id}_top`,
        targetId: `${targetNode.id}_right`,
      };
    }

    const sWidth = sourceNode.isAnchor ? 0 : this.getNodeWidth(sourceNode);
    const sHeight = sourceNode.isAnchor ? 0 : this.getNodeHeight(sourceNode);
    const tWidth = targetNode.isAnchor ? 0 : this.getNodeWidth(targetNode);
    const tHeight = targetNode.isAnchor ? 0 : this.getNodeHeight(targetNode);

    const sCenter = { x: sourceNode.position.x + sWidth / 2, y: sourceNode.position.y + sHeight / 2 };
    const tCenter = { x: targetNode.position.x + tWidth / 2, y: targetNode.position.y + tHeight / 2 };

    const dx = tCenter.x - sCenter.x;
    const dy = tCenter.y - sCenter.y;

    let sourceSide = '_right';
    let targetSide = '_left';

    if (Math.abs(dx) >= Math.abs(dy)) {
      if (dx >= 0) {
        sourceSide = '_right';
        targetSide = '_left';
      } else {
        sourceSide = '_left';
        targetSide = '_right';
      }
    } else {
      if (dy >= 0) {
        sourceSide = '_bottom';
        targetSide = '_top';
      } else {
        sourceSide = '_top';
        targetSide = '_bottom';
      }
    }

    return {
      sourceId: sourceNode.id + (sourceNode.isAnchor ? '' : sourceSide),
      targetId: targetNode.id + (targetNode.isAnchor ? '' : targetSide),
    };
  }

  getConnectorPoint(node: UmlClassNode, side: string): { x: number; y: number } {
    const w = node.isAnchor ? 0 : node.width || 220;
    const h = this.getNodeHeight(node);
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

  isRecursiveConn(conn: UmlConnection): boolean {
    const s = conn.sourceNodeId || conn.sourceId?.replace(/_(top|bottom|left|right)$/, '');
    const t = conn.targetNodeId || conn.targetId?.replace(/_(top|bottom|left|right)$/, '');
    return !!s && s === t;
  }

  getConnSide(connectorId: string | undefined, defaultSide: 'top' | 'right' | 'bottom' | 'left' = 'top'): 'top' | 'right' | 'bottom' | 'left' {
    if (!connectorId) return defaultSide;
    if (connectorId.endsWith('_top')) return 'top';
    if (connectorId.endsWith('_right')) return 'right';
    if (connectorId.endsWith('_bottom')) return 'bottom';
    if (connectorId.endsWith('_left')) return 'left';
    return defaultSide;
  }

  updateConnectionEndpoints(): void {
    const nodeMap = new Map(this.nodes().map((n) => [n.id, n]));

    let anchorMoved = false;
    for (const conn of this.connections()) {
      if (conn.assocAnchorNodeId) {
        const anchorNode = nodeMap.get(conn.assocAnchorNodeId);
        const baseSourceId = conn.sourceNodeId || conn.sourceId.replace(/_(top|bottom|left|right)$/, '');
        const baseTargetId = conn.targetNodeId || conn.targetId.replace(/_(top|bottom|left|right)$/, '');
        const sourceNode = nodeMap.get(baseSourceId);
        const targetNode = nodeMap.get(baseTargetId);

        if (anchorNode && sourceNode && targetNode) {
          const optimal = this.getOptimalConnectorId(sourceNode, targetNode);
          const sSide = optimal.sourceId.split('_').pop() || 'right';
          const tSide = optimal.targetId.split('_').pop() || 'left';
          const p1 = this.getConnectorPoint(sourceNode, sSide);
          const p2 = this.getConnectorPoint(targetNode, tSide);
          const newX = Math.round((p1.x + p2.x) / 2);
          const newY = Math.round((p1.y + p2.y) / 2);
          if (!anchorNode.position || anchorNode.position.x !== newX || anchorNode.position.y !== newY) {
            anchorNode.position = { x: newX, y: newY };
            anchorMoved = true;
          }
        }
      }
    }

    if (anchorMoved) {
      this.nodes.update((nodes) => nodes.map((n) => ({ ...n })));
    }

    this.connections.update((conns) =>
      conns
        .filter((conn) => {
          const baseSourceId = conn.sourceNodeId || conn.sourceId.replace(/_(top|bottom|left|right)$/, '');
          const baseTargetId = conn.targetNodeId || conn.targetId.replace(/_(top|bottom|left|right)$/, '');
          return nodeMap.has(baseSourceId) && nodeMap.has(baseTargetId);
        })
        .map((conn) => {
          if (conn.type === 'association_class' && conn.sourceNodeId && conn.targetNodeId) {
            const sourceNode = nodeMap.get(conn.sourceNodeId);
            const targetNode = nodeMap.get(conn.targetNodeId);
            if (sourceNode && targetNode) {
              if (sourceNode.isAnchor) {
                const optimal = this.getOptimalConnectorId(sourceNode, targetNode);
                return {
                  ...conn,
                  sourceId: sourceNode.id,
                  targetId: optimal.targetId,
                };
              } else if (targetNode.isAnchor) {
                const optimal = this.getOptimalConnectorId(sourceNode, targetNode);
                return {
                  ...conn,
                  sourceId: optimal.sourceId,
                  targetId: targetNode.id,
                };
              }
            }
          }

          const baseSourceId = conn.sourceNodeId || conn.sourceId.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
          const baseTargetId = conn.targetNodeId || conn.targetId.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
          const sourceNode = nodeMap.get(baseSourceId);
          const targetNode = nodeMap.get(baseTargetId);

          if (
            conn.sourceId.includes('_slot_') ||
            conn.targetId.includes('_slot_') ||
            this.activeDiagramType() === DiagramType.SEQUENCE ||
            ['sync', 'reply', 'async', 'create', 'self'].includes(conn.type)
          ) {
            const sMatch = conn.sourceId?.match(/_slot_(\d+)$/);
            const tMatch = conn.targetId?.match(/_slot_(\d+)$/);
            const slotNum = sMatch ? sMatch[1] : (tMatch ? tMatch[1] : '0');
            return {
              ...conn,
              sourceNodeId: baseSourceId,
              targetNodeId: baseTargetId,
              sourceId: `${baseSourceId}_slot_${slotNum}`,
              targetId: `${baseTargetId}_slot_${slotNum}`,
            };
          }

          if (sourceNode && targetNode && !sourceNode.isAnchor && !targetNode.isAnchor) {
            if (baseSourceId === baseTargetId) {
              const validConnectors = [
                `${baseSourceId}_top`,
                `${baseSourceId}_right`,
                `${baseSourceId}_bottom`,
                `${baseSourceId}_left`,
              ];
              const curSource = conn.sourceId;
              const curTarget = conn.targetId;
              const hasDistinct =
                validConnectors.includes(curSource) &&
                validConnectors.includes(curTarget) &&
                curSource !== curTarget;

              return {
                ...conn,
                sourceNodeId: baseSourceId,
                targetNodeId: baseTargetId,
                sourceId: hasDistinct ? curSource : `${baseSourceId}_top`,
                targetId: hasDistinct ? curTarget : `${baseTargetId}_right`,
              };
            }

            const optimal = this.getOptimalConnectorId(sourceNode, targetNode);
            return {
              ...conn,
              sourceNodeId: baseSourceId,
              targetNodeId: baseTargetId,
              sourceId: optimal.sourceId,
              targetId: optimal.targetId,
            };
          }
          return conn;
        }),
    );
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
    return {
      nodes: JSON.parse(JSON.stringify(this.nodes())),
      connections: JSON.parse(JSON.stringify(this.connections())),
      defaultLineStyle: this.defaultLineStyle(),
    };
  }

  pushSnapshot(): void {
    if (this.isApplyingHistory) return;
    const snapshot = this.cloneSnapshot();
    this.historyUndoStack.push(snapshot);
    if (this.historyUndoStack.length > this.maxHistoryLength) {
      this.historyUndoStack.shift();
    }
    this.historyRedoStack = [];
    this.historyUndoCount.set(this.historyUndoStack.length);
    this.historyRedoCount.set(0);
  }

  undo(): void {
    if (this.isReadOnly() || this.historyUndoStack.length === 0) return;

    const currentSnapshot = this.cloneSnapshot();
    this.historyRedoStack.push(currentSnapshot);

    const prevSnapshot = this.historyUndoStack.pop()!;
    this.isApplyingHistory = true;

    this.nodes.set(prevSnapshot.nodes);
    this.connections.set(prevSnapshot.connections);
    this.defaultLineStyle.set(prevSnapshot.defaultLineStyle);

    this.historyUndoCount.set(this.historyUndoStack.length);
    this.historyRedoCount.set(this.historyRedoStack.length);

    this.selectedNodeId.set(null);
    this.selectedNodeIds.set(new Set());

    this.markAsUnsaved();
    this.updateConnectionEndpoints();
    requestAnimationFrame(() => {
      this.updateConnectionEndpoints();
      this.diagramCanvas?.reset();
      this.isApplyingHistory = false;
    });

    this.collaborationService.sendDiagramSync(
      this.nodes(),
      this.connections(),
      'undo',
      this.defaultLineStyle(),
    );
    this.autoSave$.next();
  }

  redo(): void {
    if (this.isReadOnly() || this.historyRedoStack.length === 0) return;

    const currentSnapshot = this.cloneSnapshot();
    this.historyUndoStack.push(currentSnapshot);

    const nextSnapshot = this.historyRedoStack.pop()!;
    this.isApplyingHistory = true;

    this.nodes.set(nextSnapshot.nodes);
    this.connections.set(nextSnapshot.connections);
    this.defaultLineStyle.set(nextSnapshot.defaultLineStyle);

    this.historyUndoCount.set(this.historyUndoStack.length);
    this.historyRedoCount.set(this.historyRedoStack.length);

    this.selectedNodeId.set(null);
    this.selectedNodeIds.set(new Set());

    this.markAsUnsaved();
    this.updateConnectionEndpoints();
    requestAnimationFrame(() => {
      this.updateConnectionEndpoints();
      this.diagramCanvas?.reset();
      this.isApplyingHistory = false;
    });

    this.collaborationService.sendDiagramSync(
      this.nodes(),
      this.connections(),
      'redo',
      this.defaultLineStyle(),
    );
    this.autoSave$.next();
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
        const usedSlots = new Set<number>();
        for (const c of this.connections()) {
          const m1 = c.sourceId?.match(/_slot_(\d+)$/);
          const m2 = c.targetId?.match(/_slot_(\d+)$/);
          if (m1) usedSlots.add(parseInt(m1[1], 10));
          if (m2) usedSlots.add(parseInt(m2[1], 10));
        }
        let nextSlot = 0;
        while (usedSlots.has(nextSlot)) {
          nextSlot++;
        }
        sourceId = `${currentSource}_slot_${nextSlot}`;
        targetId = `${nodeId}_slot_${nextSlot}`;
      } else {
        const optimal = this.getOptimalConnectorId(sourceNode, targetNode);
        sourceId = optimal.sourceId;
        targetId = optimal.targetId;
      }

      const isInheritance = activeRel === 'generalization' || activeRel === 'realization';
      const isPackageRel =
        activeRel === 'import' ||
        activeRel === 'access' ||
        activeRel === 'merge' ||
        activeRel === 'trace' ||
        this.activeDiagramType() === DiagramType.PACKAGE ||
        this.activeDiagramType() === DiagramType.LAYERED ||
        sourceNode.nodeType === 'package' ||
        targetNode.nodeType === 'package';
      const isUseCaseRel =
        activeRel === 'include' ||
        activeRel === 'extend' ||
        this.activeDiagramType() === DiagramType.USE_CASE ||
        sourceNode.nodeType === 'actor' ||
        sourceNode.nodeType === 'use_case' ||
        targetNode.nodeType === 'actor' ||
        targetNode.nodeType === 'use_case';
      const relName =
        activeRel === 'include'
          ? '«include»'
          : activeRel === 'extend'
          ? '«extend»'
          : activeRel === 'import'
          ? '«import»'
          : activeRel === 'access'
          ? '«access»'
          : activeRel === 'merge'
          ? '«merge»'
          : activeRel === 'trace'
          ? '«trace»'
          : undefined;

      let messages: UmlMessage[] | undefined = undefined;
      if (isSeqRel) {
        const isReturn = activeRel === 'reply';
        messages = this.generateNextSequenceMessage(sourceNode, targetNode, isReturn);
      }

      const newConn: UmlConnection = {
        id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        sourceNodeId: currentSource,
        targetNodeId: nodeId,
        sourceId,
        targetId,
        type: activeRel,
        lineStyle: isSeqRel ? 'straight' : this.defaultLineStyle(),
        name: relName,
        sourceMultiplicity: '',
        targetMultiplicity: '',
        messages,
      };

      this.pushSnapshot();
      this.connections.update((list) => this.recalculateSequenceNumbers([...list, newConn]));
      this.markAsUnsaved();
      this.setPointerMode();
      this.updateConnectionEndpoints();
      this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'create_conn');
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
            const usedSlots = new Set<number>();
            for (const c of this.connections()) {
              const m1 = c.sourceId?.match(/_slot_(\d+)$/);
              const m2 = c.targetId?.match(/_slot_(\d+)$/);
              if (m1) usedSlots.add(parseInt(m1[1], 10));
              if (m2) usedSlots.add(parseInt(m2[1], 10));
            }
            let nextSlot = 0;
            while (usedSlots.has(nextSlot)) {
              nextSlot++;
            }
            slotNum = nextSlot.toString();
          }

          // Validación estricta: No permitir colocar dos mensajes en la misma posición temporal (fila colineal)
          const targetSlotNum = parseInt(slotNum, 10);
          const isSlotOccupied = this.connections().some((c) => {
            const isSeq =
              this.activeDiagramType() === DiagramType.SEQUENCE ||
              ['sync', 'reply', 'async', 'create', 'self'].includes(c.type as any);
            if (!isSeq) return false;
            const m1 = c.sourceId?.match(/_slot_(\d+)$/);
            const m2 = c.targetId?.match(/_slot_(\d+)$/);
            return (m1 && parseInt(m1[1], 10) === targetSlotNum) || (m2 && parseInt(m2[1], 10) === targetSlotNum);
          });

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

    const isInheritance = relType === 'generalization' || relType === 'realization';
    const isPackageRel =
      relType === 'import' ||
      relType === 'access' ||
      relType === 'merge' ||
      relType === 'trace' ||
      this.activeDiagramType() === DiagramType.PACKAGE ||
      this.activeDiagramType() === DiagramType.LAYERED ||
      (sourceNode && sourceNode.nodeType === 'package') ||
      (targetNode && targetNode.nodeType === 'package');
    const isUseCaseRel =
      relType === 'include' ||
      relType === 'extend' ||
      this.activeDiagramType() === DiagramType.USE_CASE ||
      (sourceNode && (sourceNode.nodeType === 'actor' || sourceNode.nodeType === 'use_case')) ||
      (targetNode && (targetNode.nodeType === 'actor' || targetNode.nodeType === 'use_case'));
    const relName =
      relType === 'include'
        ? '«include»'
        : relType === 'extend'
        ? '«extend»'
        : relType === 'import'
        ? '«import»'
        : relType === 'access'
        ? '«access»'
        : relType === 'merge'
        ? '«merge»'
        : relType === 'trace'
        ? '«trace»'
        : undefined;

    let messages: UmlMessage[] | undefined = undefined;
    if (isSeqRel) {
      const isReturn = relType === 'reply';
      messages = this.generateNextSequenceMessage(sourceNode, targetNode, isReturn);
    }

    const newConnection: UmlConnection = {
      id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      sourceNodeId: baseSourceId,
      targetNodeId: baseTargetId,
      sourceId,
      targetId,
      type: relType,
      lineStyle: isSeqRel ? 'straight' : this.defaultLineStyle(),
      name: relName,
      sourceMultiplicity: '',
      targetMultiplicity: '',
      messages,
    };

    this.pushSnapshot();
    this.connections.update((list) => this.recalculateSequenceNumbers([...list, newConnection]));
    this.markAsUnsaved();
    this.setPointerMode();
    this.updateConnectionEndpoints();

    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'create_conn');
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
              const isOccupied = list.some((other) => {
                if (other.id === event.connectionId) return false;
                const m1 = other.sourceId?.match(/_slot_(\d+)$/);
                const m2 = other.targetId?.match(/_slot_(\d+)$/);
                return (m1 && parseInt(m1[1], 10) === targetSlotNum) || (m2 && parseInt(m2[1], 10) === targetSlotNum);
              });
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
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'reassign_conn');
  }

  onSequenceMessageMove(event: { connectionId: string; targetSlot: number }): void {
    if (this.isReadOnly()) return;
    const { connectionId, targetSlot } = event;

    const allConns = this.connections();
    const movingConn = allConns.find((c) => c.id === connectionId);
    if (!movingConn) return;

    const sMatch = movingConn.sourceId?.match(/_slot_(\d+)$/);
    const fromSlot = sMatch ? parseInt(sMatch[1], 10) : 0;
    const toSlot = Math.max(0, targetSlot);

    if (fromSlot === toSlot) return;

    this.pushSnapshot();

    this.connections.update((conns) => {
      const isSeqConn = (c: UmlConnection) =>
        this.activeDiagramType() === DiagramType.SEQUENCE ||
        ['sync', 'reply', 'async', 'create', 'self'].includes(c.type as any);

      const getSlot = (c: UmlConnection) => {
        const m = c.sourceId?.match(/_slot_(\d+)$/);
        return m ? parseInt(m[1], 10) : 0;
      };

      const movingSeqNum = movingConn.messages?.[0]?.sequenceNumber?.trim() || '';
      const isInitiator = /^\d+$/.test(movingSeqNum);

      interface MoveItem {
        conn: UmlConnection;
        originalSlot: number;
        relativeOffset: number;
        targetSlot: number;
      }

      const moveItems: MoveItem[] = [];

      if (isInitiator) {
        const groupPrefix = `${movingSeqNum}.`;
        const groupMembers = conns.filter(
          (c) =>
            isSeqConn(c) &&
            (c.id === connectionId || (c.messages?.[0]?.sequenceNumber?.trim() || '').startsWith(groupPrefix))
        );

        // Ordenar los miembros del grupo por su slot actual
        groupMembers.sort((a, b) => getSlot(a) - getSlot(b));

        for (const m of groupMembers) {
          const origSlot = getSlot(m);
          const relOffset = origSlot - fromSlot;
          moveItems.push({
            conn: m,
            originalSlot: origSlot,
            relativeOffset: relOffset,
            targetSlot: toSlot + relOffset,
          });
        }
      } else {
        moveItems.push({
          conn: movingConn,
          originalSlot: fromSlot,
          relativeOffset: 0,
          targetSlot: toSlot,
        });
      }

      const movingIds = new Set(moveItems.map((mi) => mi.conn.id));
      const targetSlotMap = new Map<string, number>(moveItems.map((mi) => [mi.conn.id, mi.targetSlot]));

      const deltaSlot = toSlot - fromSlot;
      const numMovedItems = moveItems.length;

      // Calcular nuevos slots para todas las conexiones
      const updatedSlotsList = conns.map((c) => {
        if (!isSeqConn(c)) return c;

        const currentSlot = getSlot(c);
        const baseSrc = c.sourceNodeId || c.sourceId?.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
        const baseTgt = c.targetNodeId || c.targetId?.replace(/_(top|bottom|left|right|slot_\d+)$/, '');

        let newSlot = currentSlot;

        if (movingIds.has(c.id)) {
          newSlot = targetSlotMap.get(c.id)!;
        } else {
          // Desplazar las conexiones intermedias que no forman parte del lote
          if (deltaSlot > 0) {
            // Lote arrastrado hacia abajo: las conexiones intermedias suben
            const maxTargetSlot = Math.max(...moveItems.map((mi) => mi.targetSlot));
            if (currentSlot > fromSlot && currentSlot <= maxTargetSlot) {
              newSlot = currentSlot - numMovedItems;
            }
          } else {
            // Lote arrastrado hacia arriba: las conexiones intermedias bajan
            const minTargetSlot = Math.min(...moveItems.map((mi) => mi.targetSlot));
            if (currentSlot >= minTargetSlot && currentSlot < fromSlot) {
              newSlot = currentSlot + numMovedItems;
            }
          }
        }

        if (newSlot !== currentSlot) {
          return {
            ...c,
            sourceId: `${baseSrc}_slot_${newSlot}`,
            targetId: `${baseTgt}_slot_${newSlot}`,
          };
        }
        return c;
      });

      return this.recalculateSequenceNumbers(updatedSlotsList);
    });

    this.markAsUnsaved();
    this.updateConnectionEndpoints();
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'move_seq_msg');
  }

  createAssociationClassBetween(sourceNode: UmlClassNode, targetNode: UmlClassNode): void {
    this.pushSnapshot();
    const timestamp = Date.now();
    const anchorId = `anchor_${timestamp}`;
    const assocNodeId = `node_${timestamp}_assoc`;
    const assocName = `${sourceNode.name}_${targetNode.name}`;

    const anchorNode: UmlClassNode = {
      id: anchorId,
      name: '',
      position: {
        x: Math.round((sourceNode.position.x + targetNode.position.x) / 2),
        y: Math.round((sourceNode.position.y + targetNode.position.y) / 2),
      },
      width: 0,
      height: 0,
      attributes: [],
      methods: [],
      isAnchor: true,
    };

    const mainConnId = `conn_${timestamp}_assoc_main`;
    const mainConnection: UmlConnection = {
      id: mainConnId,
      sourceNodeId: sourceNode.id,
      targetNodeId: targetNode.id,
      sourceId: `${sourceNode.id}_right`,
      targetId: `${targetNode.id}_left`,
      type: 'association',
      lineStyle: 'straight',
      name: assocName,
      sourceMultiplicity: '',
      targetMultiplicity: '',
      assocAnchorNodeId: anchorId,
    };

    // Extraer atributos ID de las tablas a las que se asocia (sin id propio ni fechaRegistro)
    const getEntityFk = (node: UmlClassNode): { name: string; type: string } => {
      const pkAttr = (node.attributes || []).find((a) =>
        /^(id|.*_id|.*id)$/i.test(a.name.trim()),
      ) || (node.attributes || [])[0];

      const pkType = pkAttr?.type || 'UUID';

      let base = node.name.trim();
      if (base.toLowerCase().endsWith('es') && base.length > 3) {
        base = base.slice(0, -2);
      } else if (base.toLowerCase().endsWith('s') && base.length > 2 && !base.toLowerCase().endsWith('ss')) {
        base = base.slice(0, -1);
      }
      const camelBase = base.charAt(0).toLowerCase() + base.slice(1);

      let fkName = `${camelBase}Id`;
      if (pkAttr && pkAttr.name.trim().toLowerCase() !== 'id') {
        fkName = pkAttr.name.trim();
      }

      return { name: fkName, type: pkType };
    };

    const sourceFk = getEntityFk(sourceNode);
    const targetFk = getEntityFk(targetNode);

    if (sourceFk.name.toLowerCase() === targetFk.name.toLowerCase()) {
      sourceFk.name = `${sourceNode.name.toLowerCase()}Id`;
      targetFk.name = `${targetNode.name.toLowerCase()}Id`;
    }

    const assocNode: UmlClassNode = {
      id: assocNodeId,
      name: assocName,
      position: {
        x: anchorNode.position.x - 110,
        y: anchorNode.position.y + 120,
      },
      width: 220,
      attributes: [sourceFk, targetFk],
      methods: [],
      assocMainConnId: mainConnId,
    };

    const dashedConnId = `conn_${timestamp}_assoc_dashed`;
    const dashedConnection: UmlConnection = {
      id: dashedConnId,
      sourceNodeId: anchorId,
      targetNodeId: assocNodeId,
      sourceId: anchorId,
      targetId: `${assocNodeId}_top`,
      type: 'association_class',
      lineStyle: 'straight',
      name: '«link»',
    };

    this.nodes.update((list) => [...list, anchorNode, assocNode]);
    this.connections.update((list) => [...list, mainConnection, dashedConnection]);
    this.markAsUnsaved();
    this.setPointerMode();
    this.updateConnectionEndpoints();
    requestAnimationFrame(() => {
      this.updateConnectionEndpoints();
      this.diagramCanvas?.reset();
    });
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'create_assoc_class');
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
    const scrollEl = this.diagramCanvas?.flowContainerRef?.nativeElement;
    const scrollLeft = scrollEl?.scrollLeft || 0;
    const scrollTop = scrollEl?.scrollTop || 0;
    const defaultWidth = 220;
    const defaultHeight = stereotype ? 120 : undefined;
    const posX = position ? Math.max(20, Math.round(position.x - defaultWidth / 2)) : Math.max(50, Math.round(scrollLeft + 120 + Math.random() * 60));
    const posY = position ? Math.max(20, Math.round(position.y - (defaultHeight ? defaultHeight / 2 : 40))) : Math.max(50, Math.round(scrollTop + 80 + Math.random() * 60));

    const count = this.nodes().filter((n) => !n.isAnchor).length + 1;
    let namePrefix = 'Tabla_';
    if (stereotype === UmlStereotype.UI || stereotype === 'UI') {
      namePrefix = 'UI_';
    } else if (stereotype === UmlStereotype.CONTROLLER_DOT || stereotype === 'Controller.') {
      namePrefix = 'Controller_';
    } else if (stereotype === UmlStereotype.ENTITY_DOT || stereotype === 'Entity.') {
      namePrefix = 'Entity_';
    } else if (currentType === DiagramType.CLASS_ANALYSIS) {
      namePrefix = 'Clase_';
    }

    const newNode: UmlClassNode = {
      id: `class_${Date.now()}`,
      name: `${namePrefix}${count}`,
      nodeType: 'class',
      position: { x: posX, y: posY },
      width: defaultWidth,
      height: defaultHeight,
      color: '#FDFAF3',
      attributes: [],
      methods: [],
      stereotype: (stereotype as UmlStereotype) || null,
    };

    this.nodes.update((list) => [...list, newNode]);
    this.markAsUnsaved();
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'add_node');
    setTimeout(() => this.diagramCanvas?.startRenameNode(newNode.id), 50);
  }

  addComponent(position?: { x: number; y: number }): void {
    if (this.isReadOnly()) return;
    this.pushSnapshot();
    const scrollEl = this.diagramCanvas?.flowContainerRef?.nativeElement;
    const scrollLeft = scrollEl?.scrollLeft || 0;
    const scrollTop = scrollEl?.scrollTop || 0;
    const posX = position ? Math.max(20, Math.round(position.x - 95)) : Math.max(50, Math.round(scrollLeft + 120 + Math.random() * 60));
    const posY = position ? Math.max(20, Math.round(position.y - 35)) : Math.max(50, Math.round(scrollTop + 80 + Math.random() * 60));

    const count = this.nodes().filter((n) => n.nodeType === 'component').length + 1;
    const newNode: UmlClassNode = {
      id: `component_${Date.now()}`,
      name: `Component_${count}`,
      nodeType: 'component',
      stereotype: 'file',
      position: { x: posX, y: posY },
      width: 190,
      height: 70,
      customWidth: 190,
      customHeight: 70,
      isCustomSize: true,
      color: '#FAF1EC',
      attributes: [],
      methods: [],
    };

    this.nodes.update((list) => [...list, newNode]);
    this.markAsUnsaved();
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'add_node');
    setTimeout(() => this.diagramCanvas?.startRenameNode(newNode.id), 50);
  }

  addDevice(position?: { x: number; y: number }): void {
    if (this.isReadOnly()) return;
    this.pushSnapshot();
    const scrollEl = this.diagramCanvas?.flowContainerRef?.nativeElement;
    const scrollLeft = scrollEl?.scrollLeft || 0;
    const scrollTop = scrollEl?.scrollTop || 0;
    const posX = position ? Math.max(20, Math.round(position.x - 115)) : Math.max(50, Math.round(scrollLeft + 120 + Math.random() * 60));
    const posY = position ? Math.max(20, Math.round(position.y - 70)) : Math.max(50, Math.round(scrollTop + 80 + Math.random() * 60));

    const count = this.nodes().filter((n) => n.nodeType === 'device').length + 1;
    const newNode: UmlClassNode = {
      id: `device_${Date.now()}`,
      name: `Dispositivo_${count}`,
      nodeType: 'device',
      stereotype: 'device',
      position: { x: posX, y: posY },
      width: 230,
      height: 140,
      customWidth: 230,
      customHeight: 140,
      isCustomSize: true,
      color: '#F3FAF7',
      attributes: [],
      methods: [],
    };

    this.nodes.update((list) => [...list, newNode]);
    this.markAsUnsaved();
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'add_node');
    setTimeout(() => this.diagramCanvas?.startRenameNode(newNode.id), 50);
  }

  addExecutionEnvironment(position?: { x: number; y: number }): void {
    if (this.isReadOnly()) return;
    this.pushSnapshot();
    const scrollEl = this.diagramCanvas?.flowContainerRef?.nativeElement;
    const scrollLeft = scrollEl?.scrollLeft || 0;
    const scrollTop = scrollEl?.scrollTop || 0;
    const posX = position ? Math.max(20, Math.round(position.x - 120)) : Math.max(50, Math.round(scrollLeft + 120 + Math.random() * 60));
    const posY = position ? Math.max(20, Math.round(position.y - 80)) : Math.max(50, Math.round(scrollTop + 80 + Math.random() * 60));

    const count = this.nodes().filter((n) => n.nodeType === 'executionEnvironment').length + 1;
    const newNode: UmlClassNode = {
      id: `exec_env_${Date.now()}`,
      name: `Servidor_${count}`,
      nodeType: 'executionEnvironment',
      stereotype: 'executionEnvironment',
      position: { x: posX, y: posY },
      width: 240,
      height: 160,
      customWidth: 240,
      customHeight: 160,
      isCustomSize: true,
      color: '#CDE5F5',
      attributes: [],
      methods: [],
    };

    this.nodes.update((list) => [...list, newNode]);
    this.markAsUnsaved();
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'add_node');
    setTimeout(() => this.diagramCanvas?.startRenameNode(newNode.id), 50);
  }

  addBoundaryBox(position?: { x: number; y: number }): void {
    if (this.isReadOnly()) return;
    this.pushSnapshot();
    const isLayered = this.activeDiagramType() === DiagramType.LAYERED;
    const isComponent = this.activeDiagramType() === DiagramType.COMPONENT;
    const defaultWidth = (isLayered || isComponent) ? 420 : 280;
    const defaultHeight = (isLayered || isComponent) ? 220 : 200;
    const defaultName = isLayered ? 'Capa' : (isComponent ? 'Agrupación' : '.');
    const scrollEl = this.diagramCanvas?.flowContainerRef?.nativeElement;
    const scrollLeft = scrollEl?.scrollLeft || 0;
    const scrollTop = scrollEl?.scrollTop || 0;
    const posX = position ? Math.max(20, Math.round(position.x - defaultWidth / 2)) : Math.max(50, Math.round(scrollLeft + 120 + Math.random() * 60));
    const posY = position ? Math.max(20, Math.round(position.y - defaultHeight / 2)) : Math.max(50, Math.round(scrollTop + 80 + Math.random() * 60));

    const newNode: UmlClassNode = {
      id: `boundary_box_${Date.now()}`,
      name: defaultName,
      nodeType: 'boundary_box',
      stereotype: null,
      position: { x: posX, y: posY },
      width: defaultWidth,
      height: defaultHeight,
      customWidth: defaultWidth,
      customHeight: defaultHeight,
      isCustomSize: true,
      color: '#FAF1EC',
      attributes: [],
      methods: [],
    };

    this.nodes.update((list) => [...list, newNode]);
    this.markAsUnsaved();
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'add_node');
  }

  addActor(position?: { x: number; y: number }): void {
    if (this.isReadOnly()) return;
    const currentType = this.activeDiagramType();
    if (currentType === DiagramType.CLASS) {
      this.showIncompatibleElementModal(currentType);
      return;
    }
    this.pushSnapshot();
    const isSequence = this.activeDiagramType() === DiagramType.SEQUENCE;
    const scrollEl = this.diagramCanvas?.flowContainerRef?.nativeElement;
    const scrollLeft = scrollEl?.scrollLeft || 0;
    const scrollTop = scrollEl?.scrollTop || 0;
    let posX = position ? Math.max(20, Math.round(position.x - 32)) : Math.max(50, Math.round(scrollLeft + 120 + Math.random() * 60));
    let posY = isSequence ? 50 : (position ? Math.max(20, Math.round(position.y - 47)) : Math.max(50, Math.round(scrollTop + 80 + Math.random() * 60)));

    if (isSequence && !position) {
      posY = 50;
      const topNodes = this.nodes().filter((n) => (n.nodeType === 'lifeline' || n.nodeType === 'actor') && !n.isAnchor);
      if (topNodes.length > 0) {
        const maxRight = Math.max(...topNodes.map((n) => (n.position?.x || 0) + (n.width || 120)));
        posX = maxRight + 60;
      } else {
        posX = 80;
      }
    }

    const count = this.nodes().filter((n) => n.nodeType === 'actor').length + 1;
    const newNode: UmlClassNode = {
      id: `actor_${Date.now()}`,
      name: isSequence ? `actor_${count}` : `Actor_${count}`,
      nodeType: 'actor',
      position: { x: posX, y: posY },
      width: 65,
      height: 95,
      color: '#FEF2DD',
      attributes: [],
      methods: [],
      activations: [],
    };

    this.nodes.update((list) => [...list, newNode]);
    this.markAsUnsaved();
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'add_node');
    setTimeout(() => this.diagramCanvas?.startRenameNode(newNode.id), 50);
  }

  addUseCase(position?: { x: number; y: number }): void {
    if (this.isReadOnly()) return;
    this.pushSnapshot();
    const scrollEl = this.diagramCanvas?.flowContainerRef?.nativeElement;
    const scrollLeft = scrollEl?.scrollLeft || 0;
    const scrollTop = scrollEl?.scrollTop || 0;
    const posX = position ? Math.max(20, Math.round(position.x - 70)) : Math.max(50, Math.round(scrollLeft + 120 + Math.random() * 60));
    const posY = position ? Math.max(20, Math.round(position.y - 30)) : Math.max(50, Math.round(scrollTop + 80 + Math.random() * 60));

    const count = this.nodes().filter((n) => n.nodeType === 'use_case').length + 1;
    const newNode: UmlClassNode = {
      id: `use_case_${Date.now()}`,
      name: `CasoDeUso_${count}`,
      nodeType: 'use_case',
      position: { x: posX, y: posY },
      width: 140,
      height: 60,
      color: '#E5F2FE',
      attributes: [],
      methods: [],
    };

    this.nodes.update((list) => [...list, newNode]);
    this.markAsUnsaved();
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'add_node');
    setTimeout(() => this.diagramCanvas?.startRenameNode(newNode.id), 50);
  }

  addPackage(position?: { x: number; y: number }): void {
    if (this.isReadOnly()) return;
    this.pushSnapshot();
    const scrollEl = this.diagramCanvas?.flowContainerRef?.nativeElement;
    const scrollLeft = scrollEl?.scrollLeft || 0;
    const scrollTop = scrollEl?.scrollTop || 0;
    const posX = position ? Math.max(20, Math.round(position.x - 100)) : Math.max(50, Math.round(scrollLeft + 120 + Math.random() * 60));
    const posY = position ? Math.max(20, Math.round(position.y - 60)) : Math.max(50, Math.round(scrollTop + 80 + Math.random() * 60));

    const count = this.nodes().filter((n) => n.nodeType === 'package').length + 1;
    const newNode: UmlClassNode = {
      id: `package_${Date.now()}`,
      name: `Paquete_${count}`,
      nodeType: 'package',
      position: { x: posX, y: posY },
      width: 200,
      height: 120,
      color: '#FAF1EC',
      attributes: [{ name: `Contenido Paquete ${count}`, type: 'package' }],
      methods: [],
    };

    this.nodes.update((list) => [...list, newNode]);
    this.markAsUnsaved();
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'add_node');
    setTimeout(() => this.diagramCanvas?.startRenameNode(newNode.id), 50);
  }

  addBoundary(position?: { x: number; y: number }): void {
    if (this.isReadOnly()) return;
    const currentType = this.activeDiagramType();
    if (currentType === DiagramType.CLASS_ANALYSIS || currentType === DiagramType.CLASS) {
      this.showIncompatibleElementModal(currentType);
      return;
    }
    this.pushSnapshot();
    const scrollEl = this.diagramCanvas?.flowContainerRef?.nativeElement;
    const scrollLeft = scrollEl?.scrollLeft || 0;
    const scrollTop = scrollEl?.scrollTop || 0;
    const defaultWidth = 70;
    const defaultHeight = 70;
    const posX = position ? Math.max(20, Math.round(position.x - defaultWidth / 2)) : Math.max(50, Math.round(scrollLeft + 120 + Math.random() * 60));
    const posY = position ? Math.max(20, Math.round(position.y - defaultHeight / 2)) : Math.max(50, Math.round(scrollTop + 80 + Math.random() * 60));

    const count = this.nodes().filter((n) => n.nodeType === 'boundary').length + 1;
    const newNode: UmlClassNode = {
      id: `boundary_${Date.now()}`,
      name: `Boundary_${count}`,
      nodeType: 'boundary',
      stereotype: UmlStereotype.BOUNDARY,
      position: { x: posX, y: posY },
      width: defaultWidth,
      height: defaultHeight,
      color: '#DDF4F5',
      attributes: [],
      methods: [],
    };

    this.nodes.update((list) => [...list, newNode]);
    this.markAsUnsaved();
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'add_node');
    setTimeout(() => this.diagramCanvas?.startRenameNode(newNode.id), 50);
  }

  addControl(position?: { x: number; y: number }): void {
    if (this.isReadOnly()) return;
    const currentType = this.activeDiagramType();
    if (currentType === DiagramType.CLASS_ANALYSIS || currentType === DiagramType.CLASS) {
      this.showIncompatibleElementModal(currentType);
      return;
    }
    this.pushSnapshot();
    const scrollEl = this.diagramCanvas?.flowContainerRef?.nativeElement;
    const scrollLeft = scrollEl?.scrollLeft || 0;
    const scrollTop = scrollEl?.scrollTop || 0;
    const defaultWidth = 70;
    const defaultHeight = 70;
    const posX = position ? Math.max(20, Math.round(position.x - defaultWidth / 2)) : Math.max(50, Math.round(scrollLeft + 120 + Math.random() * 60));
    const posY = position ? Math.max(20, Math.round(position.y - defaultHeight / 2)) : Math.max(50, Math.round(scrollTop + 80 + Math.random() * 60));

    const count = this.nodes().filter((n) => n.nodeType === 'control').length + 1;
    const newNode: UmlClassNode = {
      id: `control_${Date.now()}`,
      name: `Control_${count}`,
      nodeType: 'control',
      stereotype: UmlStereotype.CONTROL,
      position: { x: posX, y: posY },
      width: defaultWidth,
      height: defaultHeight,
      color: '#DDF4F5',
      attributes: [],
      methods: [],
    };

    this.nodes.update((list) => [...list, newNode]);
    this.markAsUnsaved();
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'add_node');
    setTimeout(() => this.diagramCanvas?.startRenameNode(newNode.id), 50);
  }

  addEntity(position?: { x: number; y: number }): void {
    if (this.isReadOnly()) return;
    const currentType = this.activeDiagramType();
    if (currentType === DiagramType.CLASS_ANALYSIS || currentType === DiagramType.CLASS) {
      this.showIncompatibleElementModal(currentType);
      return;
    }
    this.pushSnapshot();
    const scrollEl = this.diagramCanvas?.flowContainerRef?.nativeElement;
    const scrollLeft = scrollEl?.scrollLeft || 0;
    const scrollTop = scrollEl?.scrollTop || 0;
    const defaultWidth = 70;
    const defaultHeight = 70;
    const posX = position ? Math.max(20, Math.round(position.x - defaultWidth / 2)) : Math.max(50, Math.round(scrollLeft + 120 + Math.random() * 60));
    const posY = position ? Math.max(20, Math.round(position.y - defaultHeight / 2)) : Math.max(50, Math.round(scrollTop + 80 + Math.random() * 60));

    const count = this.nodes().filter((n) => n.nodeType === 'entity').length + 1;
    const newNode: UmlClassNode = {
      id: `entity_${Date.now()}`,
      name: `Entity_${count}`,
      nodeType: 'entity',
      stereotype: UmlStereotype.ENTITY,
      position: { x: posX, y: posY },
      width: defaultWidth,
      height: defaultHeight,
      color: '#DDF4F5',
      attributes: [],
      methods: [],
    };

    this.nodes.update((list) => [...list, newNode]);
    this.markAsUnsaved();
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'add_node');
    setTimeout(() => this.diagramCanvas?.startRenameNode(newNode.id), 50);
  }

  addLifeline(position?: { x: number; y: number }): void {
    if (this.isReadOnly()) return;
    this.pushSnapshot();
    const isSequence = this.activeDiagramType() === DiagramType.SEQUENCE;
    const scrollEl = this.diagramCanvas?.flowContainerRef?.nativeElement;
    const scrollLeft = scrollEl?.scrollLeft || 0;
    const scrollTop = scrollEl?.scrollTop || 0;

    let posX = position ? Math.max(20, Math.round(position.x - 80)) : Math.max(50, Math.round(scrollLeft + 120 + Math.random() * 60));
    let posY = isSequence ? 50 : (position ? Math.max(20, Math.round(position.y - 24)) : Math.max(50, Math.round(scrollTop + 80 + Math.random() * 60)));

    if (isSequence && !position) {
      posY = 50;
      const topNodes = this.nodes().filter((n) => (n.nodeType === 'lifeline' || n.nodeType === 'actor') && !n.isAnchor);
      if (topNodes.length > 0) {
        const maxRight = Math.max(...topNodes.map((n) => (n.position?.x || 0) + (n.width || 140)));
        posX = maxRight + 60;
      } else {
        posX = 80;
      }
    }

    const count = this.nodes().filter((n) => n.nodeType === 'lifeline').length + 1;
    const defaultName = isSequence ? `lifeline_${count}` : `Objeto_${count}`;

    const newNode: UmlClassNode = {
      id: `lifeline_${Date.now()}`,
      name: defaultName,
      nodeType: 'lifeline',
      position: { x: posX, y: posY },
      width: 160,
      height: 60,
      color: '#DDF4F5',
      attributes: [],
      methods: [],
      activations: [],
    };

    this.nodes.update((list) => [...list, newNode]);
    this.markAsUnsaved();
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'add_node');
    setTimeout(() => this.diagramCanvas?.startRenameNode(newNode.id), 50);
  }

  copySelectedNodes(): void {
    const selIds = this.selectedNodeIds();
    const selId = this.selectedNodeId();
    const ids = Array.from(selIds);
    if (selId && !ids.includes(selId)) ids.push(selId);

    const nodesToCopy = this.nodes().filter((n) => ids.includes(n.id) && !n.isAnchor);
    if (nodesToCopy.length === 0) return;

    const copiedNodeIdSet = new Set(nodesToCopy.map((n) => n.id));

    // Identificar y copiar relaciones que conectan a los nodos seleccionados
    const connectionsToCopy = this.connections().filter((c) => {
      const s = c.sourceNodeId || c.sourceId?.replace(/_(top|bottom|left|right)$/, '');
      const t = c.targetNodeId || c.targetId?.replace(/_(top|bottom|left|right)$/, '');
      return s && t && copiedNodeIdSet.has(s) && copiedNodeIdSet.has(t);
    });

    this.clipboardNodes = {
      diagramType: this.activeDiagramType(),
      nodes: JSON.parse(JSON.stringify(nodesToCopy)),
      connections: JSON.parse(JSON.stringify(connectionsToCopy)),
    };
    try {
      sessionStorage.setItem('uml_clipboard_nodes', JSON.stringify(this.clipboardNodes));
    } catch (_) {}

    const count = nodesToCopy.length;
    const connsCount = connectionsToCopy.length;
    let toast = count === 1 ? `"${nodesToCopy[0].name}" copiado` : `${count} elementos copiados`;
    if (connsCount > 0) {
      toast += ` (${connsCount} ${connsCount === 1 ? 'relación' : 'relaciones'})`;
    }
    this.showQuickToast(toast);
  }

  pasteNodes(targetPos?: { x: number; y: number }): void {
    if (this.isReadOnly()) return;

    let clip = this.clipboardNodes;
    if (!clip) {
      try {
        const saved = sessionStorage.getItem('uml_clipboard_nodes');
        if (saved) clip = JSON.parse(saved);
      } catch (_) {}
    }

    if (!clip || !clip.nodes || clip.nodes.length === 0) {
      return;
    }

    const currentType = this.activeDiagramType();
    // Validar compatibilidad de tipo de diagrama
    let isInvalidPaste = false;
    if (currentType === DiagramType.USE_CASE) {
      isInvalidPaste = clip.nodes.some((n) => n.nodeType !== 'actor' && n.nodeType !== 'use_case');
    } else if (currentType === DiagramType.PACKAGE) {
      isInvalidPaste = clip.nodes.some((n) => n.nodeType !== 'package' && n.nodeType !== 'use_case' && n.nodeType !== 'actor');
    } else if (currentType === DiagramType.COMMUNICATION) {
      // En diagrama de comunicación: SOLO actor, boundary, control, entity. Clases no permitidas.
      isInvalidPaste = clip.nodes.some((n) => n.nodeType !== 'boundary' && n.nodeType !== 'control' && n.nodeType !== 'entity' && n.nodeType !== 'actor');
    } else if (currentType === DiagramType.SEQUENCE) {
      isInvalidPaste = clip.nodes.some((n) => n.nodeType !== 'actor' && n.nodeType !== 'lifeline' && n.nodeType !== 'class' && n.nodeType !== 'boundary' && n.nodeType !== 'control' && n.nodeType !== 'entity');
    } else if (currentType === DiagramType.CLASS_ANALYSIS) {
      // En análisis de clases: SOLO clases estándar (con/sin estereotipo) y actor. Nodos puros (boundary/control/entity) no permitidos.
      isInvalidPaste = clip.nodes.some((n) => (n.nodeType !== 'class' && n.nodeType !== undefined) && n.nodeType !== 'actor');
    } else if (currentType === DiagramType.COMPONENT) {
      isInvalidPaste = clip.nodes.some((n) => n.nodeType !== 'component' && n.nodeType !== 'boundary_box' && n.nodeType !== 'package');
    } else if (currentType === DiagramType.DEPLOYMENT) {
      isInvalidPaste = clip.nodes.some((n) => n.nodeType === 'actor' || n.nodeType === 'use_case' || n.nodeType === 'lifeline');
    } else if (currentType === DiagramType.LAYERED) {
      isInvalidPaste = clip.nodes.some((n) => n.nodeType !== 'package' && n.nodeType !== 'boundary_box');
    } else if (currentType === DiagramType.CLASS) {
      isInvalidPaste = clip.nodes.some((n) => n.nodeType && n.nodeType !== 'class');
    }

    if (isInvalidPaste) {
      this.showIncompatibleElementModal(currentType);
      return;
    }

    this.pushSnapshot();
    const scrollEl = this.diagramCanvas?.flowContainerRef?.nativeElement;
    const scrollLeft = scrollEl?.scrollLeft || 0;
    const scrollTop = scrollEl?.scrollTop || 0;

    const newPastedIds: string[] = [];
    const newNodes: UmlClassNode[] = [];
    const oldToNewIdMap = new Map<string, string>();

    const minClipX = clip.nodes.reduce((min, n) => Math.min(min, n.position?.x ?? 0), Infinity);
    const minClipY = clip.nodes.reduce((min, n) => Math.min(min, n.position?.y ?? 0), Infinity);

    for (let i = 0; i < clip.nodes.length; i++) {
      const src = clip.nodes[i];
      const newId = `${src.nodeType || 'node'}_${Date.now()}_${Math.floor(Math.random() * 1000) + i}`;
      newPastedIds.push(newId);
      oldToNewIdMap.set(src.id, newId);

      const isSameDiagram = clip.diagramType === currentType && this.nodes().some((n) => n.name === src.name);
      const newName = isSameDiagram ? `${src.name}_Copia` : src.name;

      let posX: number;
      let posY: number;
      if (targetPos) {
        const deltaX = (src.position?.x ?? 0) - minClipX;
        const deltaY = (src.position?.y ?? 0) - minClipY;
        posX = Math.max(20, Math.round(targetPos.x + deltaX));
        posY = currentType === DiagramType.SEQUENCE ? 50 : Math.max(20, Math.round(targetPos.y + deltaY));
      } else {
        posX = src.position ? src.position.x + 35 : Math.max(60, scrollLeft + 150 + i * 30);
        posY = currentType === DiagramType.SEQUENCE ? 50 : (src.position ? src.position.y + 35 : Math.max(60, scrollTop + 100 + i * 30));
      }

      newNodes.push({
        id: newId,
        name: newName,
        nodeType: src.nodeType,
        stereotype: src.stereotype || null,
        position: { x: posX, y: posY },
        width: src.width,
        height: src.height,
        color: src.color,
        attributes: (src.attributes || []).map((a) => ({ ...a })),
        methods: (src.methods || []).map((m) => ({ ...m })),
      });
    }

    // Copiar y enlazar las relaciones entre los nodos duplicados/pegados
    const newConnections: UmlConnection[] = [];
    if (clip.connections && clip.connections.length > 0) {
      for (const oldConn of clip.connections) {
        const oldSourceNode = oldConn.sourceNodeId || oldConn.sourceId?.replace(/_(top|bottom|left|right)$/, '');
        const oldTargetNode = oldConn.targetNodeId || oldConn.targetId?.replace(/_(top|bottom|left|right)$/, '');

        const newSourceNodeId = oldSourceNode ? oldToNewIdMap.get(oldSourceNode) : undefined;
        const newTargetNodeId = oldTargetNode ? oldToNewIdMap.get(oldTargetNode) : undefined;

        if (newSourceNodeId && newTargetNodeId) {
          const sSideMatch = oldConn.sourceId?.match(/_(top|bottom|left|right)$/);
          const tSideMatch = oldConn.targetId?.match(/_(top|bottom|left|right)$/);
          const sSide = sSideMatch ? sSideMatch[1] : 'right';
          const tSide = tSideMatch ? tSideMatch[1] : 'left';

          const newConnId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
          newConnections.push({
            ...oldConn,
            id: newConnId,
            sourceNodeId: newSourceNodeId,
            targetNodeId: newTargetNodeId,
            sourceId: `${newSourceNodeId}_${sSide}`,
            targetId: `${newTargetNodeId}_${tSide}`,
            from: newSourceNodeId,
            to: newTargetNodeId,
          });
        }
      }
    }

    this.nodes.update((list) => [...list, ...newNodes]);
    if (newConnections.length > 0) {
      this.connections.update((list) => [...list, ...newConnections]);
    }
    this.selectedNodeIds.set(new Set(newPastedIds));
    this.selectedNodeId.set(newPastedIds[0]);
    this.diagramCanvas?.select(newPastedIds, []);
    this.markAsUnsaved();
    this.updateConnectionEndpoints();
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'add_node');
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
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'update_connection');
    this.closeContextMenu();
    this.showQuickToast('Dirección de relación invertida');
  }

  setConnectionLineStyle(conn: UmlConnection, style: UmlLineStyle): void {
    if (this.isReadOnly()) return;
    this.pushSnapshot();
    conn.lineStyle = style;
    this.connections.update((conns) => [...conns]);
    this.markAsUnsaved();
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'update_connection');
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
    let isInvalidCopy = false;
    const isClassNode = !node.nodeType || node.nodeType === 'class';
    const isPureBceNode = node.nodeType === 'boundary' || node.nodeType === 'control' || node.nodeType === 'entity';

    if (currentType === DiagramType.USE_CASE) {
      if (node.nodeType !== 'actor' && node.nodeType !== 'use_case') {
        isInvalidCopy = true;
      }
    } else if (currentType === DiagramType.PACKAGE) {
      if (node.nodeType !== 'package' && node.nodeType !== 'use_case' && node.nodeType !== 'actor') {
        isInvalidCopy = true;
      }
    } else if (currentType === DiagramType.COMMUNICATION) {
      // En diagrama de comunicación: SOLO se permiten actor, boundary, control, entity.
      // Las clases (incluso con estereotipo UI, Controller., Entity.) NO están permitidas.
      if (isClassNode || (!isPureBceNode && node.nodeType !== 'actor')) {
        isInvalidCopy = true;
      }
    } else if (currentType === DiagramType.SEQUENCE) {
      if (node.nodeType !== 'actor' && node.nodeType !== 'lifeline' && !isClassNode && !isPureBceNode) {
        isInvalidCopy = true;
      }
    } else if (currentType === DiagramType.CLASS_ANALYSIS) {
      // En análisis de clases: SOLO se permiten clases y actor.
      // Los nodos puros (boundary, control, entity) NO están permitidos.
      if (isPureBceNode || (!isClassNode && node.nodeType !== 'actor')) {
        isInvalidCopy = true;
      }
    } else if (currentType === DiagramType.COMPONENT) {
      if (node.nodeType !== 'component' && node.nodeType !== 'boundary_box' && node.nodeType !== 'package') {
        isInvalidCopy = true;
      }
    } else if (currentType === DiagramType.DEPLOYMENT) {
      if (
        node.nodeType !== 'device' &&
        node.nodeType !== 'node' &&
        node.nodeType !== 'executionEnvironment' &&
        node.nodeType !== 'component' &&
        node.nodeType !== 'boundary_box' &&
        node.nodeType !== 'package' &&
        !isClassNode
      ) {
        isInvalidCopy = true;
      }
    } else if (currentType === DiagramType.LAYERED) {
      if (node.nodeType !== 'package' && node.nodeType !== 'boundary_box') {
        isInvalidCopy = true;
      }
    } else if (currentType === DiagramType.CLASS) {
      if (!isClassNode) {
        isInvalidCopy = true;
      }
    }

    if (isInvalidCopy) {
      this.showIncompatibleElementModal(currentType);
      return;
    }

    this.pushSnapshot();
    const scrollEl = this.diagramCanvas?.flowContainerRef?.nativeElement;
    const scrollLeft = scrollEl?.scrollLeft || 0;
    const scrollTop = scrollEl?.scrollTop || 0;

    const isBce = node.nodeType === 'boundary' || node.nodeType === 'control' || node.nodeType === 'entity';
    const isDeploymentNode = node.nodeType === 'device' || node.nodeType === 'node' || node.nodeType === 'executionEnvironment';
    const width = node.width || (node.nodeType === 'actor' ? 65 : (node.nodeType === 'use_case' ? 140 : (node.nodeType === 'package' ? 200 : (node.nodeType === 'component' ? 190 : (isDeploymentNode ? 240 : (isBce ? 90 : 220))))));
    const height = node.height || (node.nodeType === 'actor' ? 95 : (node.nodeType === 'use_case' ? 60 : (node.nodeType === 'package' ? 120 : (node.nodeType === 'component' ? 70 : (isDeploymentNode ? 150 : (isBce ? 95 : null))))));

    let posX: number;
    let posY: number;

    if (event.position) {
      posX = Math.max(20, Math.round(event.position.x - width / 2));
      posY = (currentType === DiagramType.SEQUENCE && (node.nodeType === 'actor' || node.nodeType === 'lifeline'))
        ? 50
        : Math.max(20, Math.round(event.position.y - (height || 80) / 2));
    } else {
      posX = isCurrentDiag && node.position?.x
        ? node.position.x + 40
        : Math.max(60, Math.round(scrollLeft + 150 + Math.random() * 50));
      posY = isCurrentDiag && node.position?.y
        ? node.position.y + 40
        : Math.max(60, Math.round(scrollTop + 100 + Math.random() * 50));

      if (currentType === DiagramType.SEQUENCE && (node.nodeType === 'actor' || node.nodeType === 'lifeline')) {
        posY = 50;
        const topNodes = this.nodes().filter((n) => (n.nodeType === 'lifeline' || n.nodeType === 'actor') && !n.isAnchor);
        if (topNodes.length > 0) {
          const maxRight = Math.max(...topNodes.map((n) => (n.position?.x || 0) + (n.width || 120)));
          posX = maxRight + 60;
        } else {
          posX = 80;
        }
      }
    }

    let newName = node.name;
    if (isCurrentDiag) {
      const sameNameCount = this.nodes().filter((n) => n.name.startsWith(node.name)).length;
      newName = sameNameCount > 0 ? `${node.name}_Copia` : node.name;
    }

    const newNodeId = `${node.nodeType || 'node'}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    let resolvedNodeType = node.nodeType || (currentType === DiagramType.USE_CASE ? 'use_case' : (currentType === DiagramType.PACKAGE ? 'package' : (currentType === DiagramType.COMMUNICATION ? 'boundary' : 'class')));
    let resolvedStereotype = node.stereotype || null;
    let resolvedWidth = width;
    let resolvedHeight = height;

    const isExplicitSizeNode = ['component', 'device', 'node', 'executionEnvironment', 'boundary_box', 'package'].includes(resolvedNodeType);
    const newNode: UmlClassNode = {
      id: newNodeId,
      name: newName,
      nodeType: resolvedNodeType,
      stereotype: resolvedStereotype,
      position: { x: posX, y: posY },
      width: resolvedWidth,
      height: resolvedHeight,
      customWidth: isExplicitSizeNode ? resolvedWidth : node.customWidth,
      customHeight: isExplicitSizeNode ? resolvedHeight : node.customHeight,
      isCustomSize: isExplicitSizeNode || !!node.isCustomSize,
      color: node.color || this.getDefaultColorForNodeType(resolvedNodeType, resolvedStereotype),
      attributes: (node.attributes || []).map((a: any) => ({ ...a })),
      methods: (node.methods || []).map((m: any) => ({ ...m })),
    };

    this.nodes.update((list) => [...list, newNode]);
    this.selectedNodeId.set(newNode.id);
    this.selectedNodeIds.set(new Set([newNode.id]));
    this.markAsUnsaved();
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'add_node');

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
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'remove_node');
  }

  openEditNodeModal(node: UmlClassNode, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (this.isReadOnly() || node.isAnchor) return;

    if (this.isNodeLockedByOther(node.id)) {
      const lock = this.getNodeLock(node.id);
      alert(`🔒 Esta tabla está bloqueada por ${lock?.userName || 'otro usuario'}.`);
      return;
    }

    this.collaborationService.requestNodeLock(node.id);
    this.editingNode.set(JSON.parse(JSON.stringify(node)));
    this.isEditNodeModalOpen.set(true);
  }

  closeEditNodeModal(): void {
    if (this.editingNode()) {
      this.collaborationService.releaseNodeLock(this.editingNode()!.id);
    }
    this.isEditNodeModalOpen.set(false);
    this.editingNode.set(null);
  }

  saveEditedNode(): void {
    const edited = this.editingNode();
    if (!edited) return;

    this.pushSnapshot();
    this.nodes.update((list) => list.map((n) => (n.id === edited.id ? edited : n)));
    this.markAsUnsaved();
    this.closeEditNodeModal();
    this.updateConnectionEndpoints();
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'update_node');
  }

  addAttributeToEditingNode(): void {
    const n = this.editingNode();
    if (!n) return;
    n.attributes = n.attributes || [];
    n.attributes.push({
      name: 'nuevoCampo',
      type: 'String',
      nullable: true,
      unique: false,
      length: 255,
      defaultValue: null,
      default: null,
    });
  }

  removeAttributeFromEditingNode(index: number): void {
    const n = this.editingNode();
    if (!n || !n.attributes) return;
    n.attributes.splice(index, 1);
  }

  addMethodToEditingNode(): void {
    const n = this.editingNode();
    if (!n) return;
    n.methods = n.methods || [];
    n.methods.push({ name: 'nuevaOperacion', parameters: '', returnType: 'void' });
  }

  removeMethodFromEditingNode(index: number): void {
    const n = this.editingNode();
    if (!n || !n.methods) return;
    n.methods.splice(index, 1);
  }

  openEditConnModal(conn: UmlConnection, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (this.isReadOnly()) return;

    this.editingConnection.set(JSON.parse(JSON.stringify(conn)));
    this.isEditConnModalOpen.set(true);
  }

  closeEditConnModal(): void {
    this.isEditConnModalOpen.set(false);
    this.editingConnection.set(null);
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
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'update_conn');
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
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'delete_conn');
  }

  onAiMutation(event: { nodes: UmlClassNode[]; connections: UmlConnection[]; summary: string }): void {
    if (event.nodes && event.nodes.length > 0) {
      this.applyAiMutationWithAnimation(event.nodes, event.connections || []);
      this.collaborationService.sendDiagramSync(event.nodes, event.connections || [], 'ai_mutation');
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
    return targetNodes.map((n, i) => {
      let nodeType: UmlNodeType | string = n.nodeType || 'class';
      if (/^cu[-_ \d]/i.test(n.name || '') || (typeof n.name === 'string' && /caso\s+de\s+uso/i.test(n.name))) {
        nodeType = 'use_case';
      } else if (nodeType === 'boundary_box' || n.id?.startsWith('boundary_box_') || n.id?.startsWith('bbox_')) {
        nodeType = 'boundary_box';
      } else if (nodeType === 'class' || (nodeType === 'package' && (n.id?.startsWith('uc_') || n.id?.startsWith('use_case_')))) {
        if (n.id?.startsWith('actor_')) nodeType = 'actor';
        else if (n.id?.startsWith('use_case_') || n.id?.startsWith('uc_')) nodeType = 'use_case';
        else if (n.id?.startsWith('package_') || n.id?.startsWith('pkg_')) nodeType = 'package';
        else if (n.id?.startsWith('boundary_box_') || n.id?.startsWith('bbox_')) nodeType = 'boundary_box';
        else if (n.id?.startsWith('boundary_')) nodeType = 'boundary';
        else if (n.id?.startsWith('control_')) nodeType = 'control';
        else if (n.id?.startsWith('entity_')) nodeType = 'entity';
        else if (n.id?.startsWith('lifeline_')) nodeType = 'lifeline';
        else if (n.id?.startsWith('comp_') || n.id?.startsWith('component_')) nodeType = 'component';
        else if (n.id?.startsWith('dev_') || n.id?.startsWith('device_')) nodeType = 'device';
        else if (n.id?.startsWith('exec_') || n.id?.startsWith('executionEnvironment_')) nodeType = 'executionEnvironment';
      }
      const isExplicitSizeNode = ['component', 'device', 'node', 'executionEnvironment', 'boundary_box', 'package'].includes(nodeType);
      const isManuallyResized = !!n.isCustomSize || (!!n.customHeight && n.customHeight > 0) || isExplicitSizeNode || (!!(n.height && n.height > 0) && nodeType === 'class');
      let defaultWidth = 220;
      let defaultHeight: number | undefined = undefined;
      if (nodeType === 'actor') {
        defaultWidth = 65;
        defaultHeight = 95;
      } else if (nodeType === 'use_case') {
        defaultWidth = 150;
        defaultHeight = 65;
      } else if (nodeType === 'package') {
        defaultWidth = 200;
        defaultHeight = 120;
      } else if (nodeType === 'component') {
        defaultWidth = 190;
        defaultHeight = 70;
      } else if (nodeType === 'node' || nodeType === 'device') {
        defaultWidth = 230;
        defaultHeight = 140;
      } else if (nodeType === 'executionEnvironment') {
        defaultWidth = 240;
        defaultHeight = 160;
      } else if (nodeType === 'boundary_box') {
        defaultWidth = 280;
        defaultHeight = 200;
      } else if (['boundary', 'control', 'entity'].includes(nodeType)) {
        defaultWidth = 70;
        defaultHeight = 70;
      } else if (nodeType === 'lifeline') {
        defaultWidth = 120;
        defaultHeight = 60;
      }

      const isBce = ['boundary', 'control', 'entity'].includes(nodeType);
      const resolvedW = n.isAnchor ? 0 : (isBce ? 70 : (n.width || defaultWidth));
      const resolvedH = n.isAnchor ? 0 : nodeType === 'lifeline' ? 60 : (isBce ? 70 : (n.height || defaultHeight));

      return {
        id: n.id || `class_ai_${Date.now()}_${i}`,
        name: n.name || (n.isAnchor ? '' : (nodeType === 'boundary_box' ? 'BoundaryBox' : `Clase_${i + 1}`)),
        position: {
          x: n.position?.x ?? (n.positionX ?? (100 + (i % 3) * 260)),
          y: n.position?.y ?? (n.positionY ?? (100 + Math.floor(i / 3) * 220)),
        },
        width: resolvedW,
        height: resolvedH,
        customWidth: n.customWidth || (isExplicitSizeNode ? resolvedW : undefined),
        customHeight: n.customHeight || (isExplicitSizeNode ? resolvedH : undefined),
        isCustomSize: isManuallyResized,
        color: (!n.color || ((n.color === '#FFFDDD' || n.color === '#FDFAF3') && ['device', 'executionEnvironment', 'component', 'node', 'boundary_box', 'boundary', 'control', 'entity', 'lifeline', 'actor', 'use_case', 'package'].includes(nodeType)))
          ? this.getDefaultColorForNodeType(nodeType, n.stereotype)
          : n.color,
        nodeType,
        stereotype: n.stereotype || null,
        activations: n.activations || [],
        labelOffset: n.labelOffset,
        isAnchor: !!n.isAnchor,
        assocMainConnId: n.assocMainConnId,
        attributes: (n.attributes || []).map((a: any) => ({
          ...a,
          name: a.name,
          type: this.normalizeDataType(a.type),
          nullable: a.nullable !== undefined ? a.nullable : true,
          unique: a.unique !== undefined ? a.unique : false,
          length: a.length !== undefined ? a.length : 255,
          defaultValue: a.defaultValue ?? a.default ?? null,
        })),
        methods: (n.methods || []).map((m: any) => ({
          name: m.name,
          parameters: m.parameters || '',
          returnType: this.normalizeReturnType(m.returnType),
        })),
      };
    });
  }

  public normalizeUmlMessage(m: any, defaultSeq = '1'): UmlMessage {
    let seq = String(m.sequenceNumber || '').trim();
    let fn = String(m.functionName || '').trim();
    let params = String(m.parameters ?? '').trim();
    let returnType = m.returnType ? String(m.returnType).trim() : undefined;
    const rawText = String(m.name || m.text || m.label || '').trim();

    // 1. Limpiar fn si contiene números de secuencia, tipo de retorno o parámetros entre paréntesis
    if (fn) {
      // 1a. ¿Prefijo de secuencia? Ej: "1.1 register(data)" o "1: login(user)" o "1 - test"
      const fnSeqMatch = fn.match(/^(\d+(?:\.\d+)*)\s*[:.\s-]\s*(.*)$/);
      if (fnSeqMatch) {
        if (!seq) seq = fnSeqMatch[1];
        fn = fnSeqMatch[2].trim();
      } else if (/^\d+(\.\d+)*$/.test(fn)) {
        if (!seq) seq = fn;
        fn = '';
      }

      // 1b. ¿Tipo de retorno al final? Ej: "getUser(id): User"
      const fnRetMatch = fn.match(/^(.*?)\s*:\s*([a-zA-Z0-9_\[\]<>]+)$/);
      if (fnRetMatch) {
        fn = fnRetMatch[1].trim();
        if (!returnType) returnType = fnRetMatch[2].trim();
      }

      // 1c. ¿Paréntesis con parámetros? Ej: "register(data)" o "logout()"
      const fnParenMatch = fn.match(/^(.*?)\((.*?)\)$/);
      if (fnParenMatch) {
        fn = fnParenMatch[1].trim();
        if (!params && fnParenMatch[2] !== undefined) {
          params = fnParenMatch[2].trim();
        }
      }

      fn = fn.replace(/\(\)/g, '').trim();
      fn = fn.replace(/^(\d+(?:\.\d+)*)\s*[:.\s-]\s*/, '').trim();
    }

    // 2. Si fn quedó vacío o es el placeholder por defecto ('msj', 'mensaje'), intentar extraer de rawText
    if ((!fn || fn.toLowerCase() === 'msj' || fn.toLowerCase() === 'mensaje') && rawText) {
      let candidate = rawText;

      const rawSeqMatch = candidate.match(/^(\d+(?:\.\d+)*)\s*[:.\s-]\s*(.*)$/);
      if (rawSeqMatch) {
        if (!seq) seq = rawSeqMatch[1];
        candidate = rawSeqMatch[2].trim();
      } else if (/^\d+(\.\d+)*$/.test(candidate)) {
        if (!seq) seq = candidate;
        candidate = '';
      }

      const rawRetMatch = candidate.match(/^(.*?)\s*:\s*([a-zA-Z0-9_\[\]<>]+)$/);
      if (rawRetMatch) {
        candidate = rawRetMatch[1].trim();
        if (!returnType) returnType = rawRetMatch[2].trim();
      }

      const rawParenMatch = candidate.match(/^(.*?)\((.*?)\)$/);
      if (rawParenMatch) {
        candidate = rawParenMatch[1].trim();
        if (!params && rawParenMatch[2] !== undefined) {
          params = rawParenMatch[2].trim();
        }
      }

      candidate = candidate.replace(/\(\)/g, '').trim();
      candidate = candidate.replace(/^(\d+(?:\.\d+)*)\s*[:.\s-]\s*/, '').trim();

      if (candidate && candidate.toLowerCase() !== 'msj' && candidate.toLowerCase() !== 'mensaje') {
        fn = candidate;
      }
    }

    // 3. Fallback final para fn
    if (!fn || fn.toLowerCase() === 'msj' || fn.toLowerCase() === 'mensaje') {
      const fallbackName = m.name && m.name !== 'msj' && m.name !== 'mensaje()' && m.name !== 'mensaje'
        ? m.name.replace(/\(\)/g, '').replace(/^(\d+(?:\.\d+)*)\s*[:.\s-]\s*/, '').trim()
        : '';
      fn = fallbackName || 'msj';
    }

    // 4. Limpieza de parámetros
    if (params) {
      params = params.trim();
      if (params.startsWith('(') && params.endsWith(')')) {
        params = params.slice(1, -1).trim();
      }
    }

    if (!seq) seq = defaultSeq;

    const isReturn = m.type === 'reply' || !!m.isReturn;
    // En comunicación, direction es relativo al enlace; reply no implica invertir
    // un conector de secuencia que ya tiene los extremos dirigidos.
    const direction = m.direction === 'forward' || m.direction === 'reverse'
      ? m.direction
      : isReturn ? 'reverse' : 'forward';

    return {
      id: m.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sequenceNumber: seq,
      functionName: fn,
      parameters: params,
      returnType,
      direction,
      type: isReturn ? 'reply' : (m.type as UmlMessageType) || 'sync',
      isReturn,
      orderIndex: typeof m.orderIndex === 'number' && Number.isFinite(m.orderIndex) ? m.orderIndex : undefined,
      positionY: typeof m.positionY === 'number' && Number.isFinite(m.positionY) ? m.positionY : undefined,
      color: m.color || undefined,
    };
  }

  private sanitizeClientConnections(conns: any[], validNodes: UmlClassNode[]): UmlConnection[] {
    const nodeMap = new Map(validNodes.map((n) => [n.id, n]));
    const nodeIds = new Set(validNodes.map((n) => n.id));
    const extractBaseNodeId = (rawId?: string) => {
      if (!rawId) return '';
      return rawId
        .replace(/_(top|bottom|left|right)$/, '')
        .replace(/_slot_\d+$/, '');
    };

    const isSeqDiagram = this.activeDiagramType() === DiagramType.SEQUENCE;
    const isCommDiagram = this.activeDiagramType() === DiagramType.COMMUNICATION;

    const seqConns: any[] = [];
    const commMergedMap = new Map<string, any>();
    const otherConns: any[] = [];

    for (const c of conns) {
      const s = c.sourceNodeId || extractBaseNodeId(c.sourceId);
      const t = c.targetNodeId || extractBaseNodeId(c.targetId);
      if (!nodeIds.has(s) || !nodeIds.has(t)) continue;

      const isSeqConn =
        isSeqDiagram ||
        ['sync', 'reply', 'async', 'create', 'self'].includes(c.type) ||
        (c.sourceId && c.sourceId.includes('_slot_')) ||
        (c.targetId && c.targetId.includes('_slot_'));

      if (isSeqConn) {
        // EN DIAGRAMAS DE SECUENCIA:
        // CADA MENSAJE DEBE SER SU PROPIA CONEXIÓN CON EXACTAMENTE UN MENSAJE (messages.length === 1)
        // NUNCA FUSIONAR CONEXIONES DE SECUENCIA POR PAIRKEY.
        const rawMsgs = (c.messages && c.messages.length > 0)
          ? c.messages
          : (c.name ? [{ name: c.name, type: c.type }] : [{ functionName: 'msj', type: c.type || 'sync' }]);

        // Si la conexión trajo múltiples mensajes agrupados, desempacarlos en conexiones individuales
        rawMsgs.forEach((m: any, mIdx: number) => {
          const norm = this.normalizeUmlMessage(m, `${seqConns.length + 1}`);
          const isMsgReverse = norm.direction === 'reverse';

          let effectiveSource = s;
          let effectiveTarget = t;
          if (isMsgReverse && !['reply'].includes(c.type) && !c.isReturn && mIdx > 0) {
            effectiveSource = t;
            effectiveTarget = s;
          }

          // Los extremos ya representan la dirección del mensaje individual.
          norm.direction = 'forward';
          seqConns.push({
            ...c,
            id: rawMsgs.length === 1 && c.id ? c.id : `msg_${Date.now()}_${seqConns.length}_${Math.random().toString(36).substring(2, 5)}`,
            sourceNodeId: effectiveSource,
            targetNodeId: effectiveTarget,
            type: norm.type || (isMsgReverse ? 'reply' : 'sync'),
            lineStyle: 'straight',
            sourceMultiplicity: '',
            targetMultiplicity: '',
            messages: [norm],
          });
        });
      } else if (isCommDiagram) {
        // EN DIAGRAMAS DE COMUNICACIÓN:
        // Existe una sola línea de asociación entre cada par de objetos, y múltiples mensajes viven sobre esa línea
        const pairKey = [s, t].sort().join('___');
        const rawMsgs = (c.messages && c.messages.length > 0)
          ? c.messages
          : (c.name ? [{ name: c.name }] : []);

        if (commMergedMap.has(pairKey)) {
          const existing = commMergedMap.get(pairKey);
          const isReversedPair = (existing.sourceNodeId || extractBaseNodeId(existing.sourceId)) !== s;

          const normalizedNewMsgs = rawMsgs.map((m: any, mIdx: number) => {
            const norm = this.normalizeUmlMessage(m, `${(existing.messages || []).length + mIdx + 1}`);
            if (isReversedPair) {
              norm.direction = norm.direction === 'reverse' ? 'forward' : 'reverse';
            }
            return norm;
          });

          existing.messages = existing.messages || [];
          for (const nm of normalizedNewMsgs) {
            const exists = existing.messages.some(
              (em: any) => em.sequenceNumber === nm.sequenceNumber && em.functionName === nm.functionName
            );
            if (!exists) {
              existing.messages.push(nm);
            }
          }
        } else {
          const normalizedMsgs = rawMsgs.map((m: any, mIdx: number) =>
            this.normalizeUmlMessage(m, `${mIdx + 1}`)
          );

          commMergedMap.set(pairKey, {
            ...c,
            sourceNodeId: s,
            targetNodeId: t,
            messages: normalizedMsgs.length > 0 ? normalizedMsgs : undefined,
          });
        }
      } else {
        // OTROS DIAGRAMAS
        otherConns.push({
          ...c,
          sourceNodeId: s,
          targetNodeId: t,
        });
      }
    }

    // 2. Asignar slots únicos y ordenados para diagramas de secuencia
    const usedSlots = new Set<number>();
    let nextFreeSlot = 0;
    seqConns.sort((a, b) => {
      const order = (c: any) => {
        const match = c.sourceId?.match(/_slot_(\d+)$/) || c.targetId?.match(/_slot_(\d+)$/);
        return match ? Number(match[1]) : c.messages?.[0]?.orderIndex;
      };
      return (order(a) ?? conns.length) - (order(b) ?? conns.length);
    });

    const normalizedSeqConns: UmlConnection[] = seqConns.map((conn) => {
      const sMatch = conn.sourceId?.match(/_slot_(\d+)$/);
      const tMatch = conn.targetId?.match(/_slot_(\d+)$/);
      let slot = sMatch ? parseInt(sMatch[1], 10) : (tMatch ? parseInt(tMatch[1], 10) : -1);

      if (slot < 0 || usedSlots.has(slot)) {
        while (usedSlots.has(nextFreeSlot)) {
          nextFreeSlot++;
        }
        slot = nextFreeSlot;
      }
      usedSlots.add(slot);
      nextFreeSlot = Math.max(nextFreeSlot, slot + 1);

      const msg = conn.messages[0];
      return {
        id: conn.id || `msg_${Date.now()}_${slot}`,
        sourceNodeId: conn.sourceNodeId,
        targetNodeId: conn.targetNodeId,
        sourceId: `${conn.sourceNodeId}_slot_${slot}`,
        targetId: `${conn.targetNodeId}_slot_${slot}`,
        type: (conn.type as UmlRelationshipType) || (msg?.isReturn ? 'reply' : 'sync'),
        lineStyle: 'straight',
        name: undefined,
        sourceMultiplicity: '',
        targetMultiplicity: '',
        assocAnchorNodeId: undefined,
        messages: [msg],
      };
    });

    // 3. Procesar conexiones de comunicación
    const normalizedCommConns: UmlConnection[] = Array.from(commMergedMap.values()).map((c) => {
      const sourceNodeId = c.sourceNodeId || extractBaseNodeId(c.sourceId);
      const targetNodeId = c.targetNodeId || extractBaseNodeId(c.targetId);

      const sortedMessages = (c.messages || []).slice().sort((a: any, b: any) => {
        const parseSeq = (str: string) => String(str || '').split('.').map((n) => parseInt(n, 10) || 0);
        const pa = parseSeq(a.sequenceNumber);
        const pb = parseSeq(b.sequenceNumber);
        for (let k = 0; k < Math.max(pa.length, pb.length); k++) {
          const na = pa[k] || 0;
          const nb = pb[k] || 0;
          if (na !== nb) return na - nb;
        }
        return 0;
      });

      return {
        id: c.id || `conn_comm_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        sourceNodeId,
        targetNodeId,
        sourceId: c.sourceId || `${sourceNodeId}_right`,
        targetId: c.targetId || `${targetNodeId}_left`,
        type: (c.type as UmlRelationshipType) || 'association',
        lineStyle: (c.lineStyle as UmlLineStyle) || 'straight',
        name: sortedMessages.length > 0 ? undefined : (c.name || undefined),
        sourceMultiplicity: '',
        targetMultiplicity: '',
        assocAnchorNodeId: undefined,
        messages: sortedMessages.length > 0 ? sortedMessages : undefined,
      };
    });

    // 4. Procesar otros diagramas
    const normalizedOtherConns: UmlConnection[] = otherConns.map((c) => {
      const sourceNodeId = c.sourceNodeId || extractBaseNodeId(c.sourceId);
      const targetNodeId = c.targetNodeId || extractBaseNodeId(c.targetId);
      const sourceNode = nodeMap.get(sourceNodeId);
      const targetNode = nodeMap.get(targetNodeId);

      let sourceId = c.sourceId;
      let targetId = c.targetId;

      if (sourceNode && targetNode) {
        if (sourceNodeId === targetNodeId) {
          sourceId = sourceId || `${sourceNodeId}_top`;
          targetId = targetId || `${targetNodeId}_right`;
        } else if (c.type === 'association_class') {
          if (sourceNode.isAnchor) {
            const optimal = this.getOptimalConnectorId(sourceNode, targetNode);
            sourceId = sourceNode.id;
            targetId = optimal.targetId;
          } else if (targetNode.isAnchor) {
            const optimal = this.getOptimalConnectorId(sourceNode, targetNode);
            sourceId = optimal.sourceId;
            targetId = targetNode.id;
          } else {
            const optimal = this.getOptimalConnectorId(sourceNode, targetNode);
            sourceId = optimal.sourceId;
            targetId = optimal.targetId;
          }
        } else if (!sourceNode.isAnchor && !targetNode.isAnchor) {
          const optimal = this.getOptimalConnectorId(sourceNode, targetNode);
          sourceId = optimal.sourceId;
          targetId = optimal.targetId;
        }
      }

      return {
        id: c.id || `conn_ai_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        sourceNodeId,
        targetNodeId,
        sourceId: sourceId || `${sourceNodeId}_right`,
        targetId: targetId || `${targetNodeId}_left`,
        type: (c.type as UmlRelationshipType) || 'association',
        lineStyle: (c.lineStyle as UmlLineStyle) || this.defaultLineStyle(),
        name: c.name || undefined,
        sourceMultiplicity: c.sourceMultiplicity || '',
        targetMultiplicity: c.targetMultiplicity || '',
        assocAnchorNodeId: c.assocAnchorNodeId || undefined,
        messages: c.messages,
      };
    });

    const combined = [...normalizedSeqConns, ...normalizedCommConns, ...normalizedOtherConns];

    if (this.activeDiagramType() === DiagramType.SEQUENCE) {
      return this.recalculateSequenceNumbers(combined, true);
    }

    return combined;
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
    const canvasComp = this.diagramCanvas?.canvas;
    const prevScale = canvasComp?.transform?.scale ?? 1;
    const prevPos = canvasComp?.transform?.position ? { ...canvasComp.transform.position } : { x: 0, y: 0 };
    const prevScaledPos = canvasComp?.transform?.scaledPosition ? { ...canvasComp.transform.scaledPosition } : { x: 0, y: 0 };

    // Limpiar selección para que no salgan recuadros azules de foco en la imagen
    this.diagramCanvas?.clearSelection();

    try {
      // Normalizar escala a 1:1 y origen para captura pura de elementos
      if (canvasComp?.transform) {
        canvasComp.resetScale();
        canvasComp.transform.position = { x: 0, y: 0 };
        canvasComp.transform.scaledPosition = { x: 0, y: 0 };
        canvasComp.redraw();
      }
      // Breve espera para que el DOM de Foblex sincronice transformaciones
      await new Promise((resolve) => setTimeout(resolve, 60));

      const containerEl = this.diagramCanvas?.getExportElement();
      if (containerEl) {
        if (format === 'bmp') {
          await this.bmpExportService.exportElementToBmp(
            containerEl,
            this.currentDiagramName(),
            this.activeDiagramType(),
          );
        } else {
          await this.bmpExportService.exportElementToPng(
            containerEl,
            this.currentDiagramName(),
            this.activeDiagramType(),
          );
        }
      } else {
        if (format === 'bmp') {
          this.bmpExportService.exportToBmp(
            this.nodes(),
            this.connections(),
            this.currentDiagramName(),
            this.activeDiagramType(),
          );
        } else {
          this.bmpExportService.exportToPng(
            this.nodes(),
            this.connections(),
            this.currentDiagramName(),
            this.activeDiagramType(),
          );
        }
      }
    } finally {
      // Restaurar el zoom y posición de pantalla que tenía el usuario
      if (canvasComp?.transform) {
        canvasComp.transform.scale = prevScale;
        canvasComp.transform.position = prevPos;
        canvasComp.transform.scaledPosition = prevScaledPos;
        canvasComp.redraw();
      }
    }
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
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${this.currentDiagramName().toLowerCase().replace(/\s+/g, '_')}_ea.xmi`;
          a.click();
          window.URL.revokeObjectURL(url);
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
    const project: UmlDiagramProject = {
      version: '1.0',
      name: this.currentDiagramName(),
      createdDate: new Date().toISOString(),
      defaultLineStyle: this.defaultLineStyle(),
      nodes: this.nodes(),
      connections: this.connections(),
    };

    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.currentDiagramName().toLowerCase().replace(/\s+/g, '_')}_ast.json`;
    a.click();
    window.URL.revokeObjectURL(url);
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
    this.jsonContent.set(JSON.stringify(project, null, 2));
    this.jsonModalMode.set('export');
    this.showJsonModal.set(true);
  }

  openImportModal(): void {
    if (this.hasMultipleActiveUsers()) {
      alert(this.translationService.translate('appbar.multiUserImportBlocked'));
      return;
    }
    this.jsonContent.set('');
    this.jsonModalMode.set('import');
    this.showJsonModal.set(true);
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
        this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'apply_json');
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

  onFileSelected(event: Event): void {
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

    const fileName = file.name.toLowerCase();
    const isXmiOrXml = fileName.endsWith('.xml') || fileName.endsWith('.xmi');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let content = '';
        const buffer = e.target?.result;
        if (buffer instanceof ArrayBuffer) {
          const headerBytes = new Uint8Array(buffer.slice(0, Math.min(buffer.byteLength, 300)));
          const asciiHeader = String.fromCharCode(...headerBytes);
          const match = asciiHeader.match(/encoding=["']([^"']+)["']/i);
          const declaredEncoding = match ? match[1].toLowerCase() : '';

          if (declaredEncoding.includes('1252') || declaredEncoding.includes('ansi')) {
            try {
              content = new TextDecoder('windows-1252').decode(buffer);
            } catch {
              content = new TextDecoder('utf-8').decode(buffer);
            }
          } else if (declaredEncoding.includes('8859-1')) {
            try {
              content = new TextDecoder('iso-8859-1').decode(buffer);
            } catch {
              content = new TextDecoder('utf-8').decode(buffer);
            }
          } else {
            try {
              content = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
            } catch {
              try {
                content = new TextDecoder('windows-1252').decode(buffer);
              } catch {
                content = new TextDecoder('utf-8').decode(buffer);
              }
            }
          }
        } else {
          content = (buffer as string) || '';
        }

        content = XmiClientParser.fixUtf8Mojibake(content);

        if (isXmiOrXml) {
          try {
            const ast = XmiClientParser.parse(content);
            if (ast.nodes && ast.nodes.length > 0) {
              this.nodes.set(
                ast.nodes.map((n: any) => {
                  const isBce = n.nodeType === 'boundary' || n.nodeType === 'control' || n.nodeType === 'entity';
                  return {
                    ...n,
                    width: n.width || (n.nodeType === 'actor' ? 65 : (n.nodeType === 'use_case' ? 140 : (n.nodeType === 'package' ? 200 : (isBce ? 70 : 220)))),
                    height: n.height || (n.nodeType === 'actor' ? 95 : (n.nodeType === 'use_case' ? 60 : (n.nodeType === 'package' ? 120 : (isBce ? 70 : 120)))),
                    attributes: (n.attributes || []).map((a: any) => ({
                      ...a,
                      name: a.name,
                      type: this.normalizeDataType(a.type),
                      nullable: a.nullable !== undefined ? a.nullable : true,
                      unique: a.unique !== undefined ? a.unique : false,
                      length: a.length !== undefined ? a.length : 255,
                      defaultValue: a.defaultValue ?? a.default ?? null,
                    })),
                    methods: (n.methods || []).map((m: any) => ({
                      name: m.name,
                      parameters: m.parameters || '',
                      returnType: this.normalizeReturnType(m.returnType),
                    })),
                  };
                }),
              );
              if (ast.name) {
                this.currentDiagramName.set(ast.name);
              }
              if (ast.diagramType) {
                this.activeDiagramType.set(ast.diagramType as DiagramType);
              }
              this.connections.set(this.recalculateSequenceNumbers(ast.connections || [], true));
              this.markAsUnsaved();
              this.updateConnectionEndpoints();
              setTimeout(() => {
                this.updateConnectionEndpoints();
                this.fitView();
              }, 100);
              this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'import_xmi');
            } else {
              alert('El archivo XMI no contiene clases UML legibles.');
            }
          } catch (err: any) {
            alert('Error al leer el archivo XMI: ' + (err.message || err));
          } finally {
            target.value = '';
          }
        } else {
          const project = JSON.parse(content) as UmlDiagramProject;
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
            this.markAsUnsaved();
            this.updateConnectionEndpoints();
            setTimeout(() => {
              this.updateConnectionEndpoints();
              this.fitView();
            }, 100);
            this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'import_json');
          } else {
            alert('El archivo JSON no contiene un diagrama válido.');
          }
        }
      } catch (err) {
        alert('Error al leer el archivo: ' + err);
      } finally {
        target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  }

  triggerSpringBootGeneration(): void {
    this.showSpringBootModal.set(true);
  }

  openProfileModal(): void {
    this.isProfileModalOpen.set(true);
  }

  syncZoomFromCanvas(): void {
    this.diagramCanvas?.syncZoomFromCanvas();
  }

  onZoomChanged(zoom: number): void {
    if (this.contextMenu()) {
      this.closeContextMenu();
    }
    this.zoomLevel.set(zoom);
    const diagId = this.currentDiagramId();
    if (diagId) {
      this.saveDiagramViewState(diagId, { zoom });
    }
  }

  zoomIn(): void {
    this.diagramCanvas?.zoomIn();
  }

  zoomOut(): void {
    this.diagramCanvas?.zoomOut();
  }

  onViewportScroll(event: Event): void {
    if (this.contextMenu()) {
      this.closeContextMenu();
    }
    const el = event.target as HTMLElement;
    if (!el) return;
    const diagramId = this.currentDiagramId();
    if (diagramId) {
      this.saveDiagramViewState(diagramId, {
        scrollLeft: el.scrollLeft,
        scrollTop: el.scrollTop,
      });
      sessionStorage.setItem(
        `diagram_scroll_${diagramId}`,
        JSON.stringify({ left: el.scrollLeft, top: el.scrollTop }),
      );
    }
  }

  restoreViewportScroll(diagramId: string | null): void {
    this.diagramCanvas?.restoreViewportScroll(diagramId);
  }

  centerViewportOnBoard(): void {
    this.diagramCanvas?.centerViewportOnBoard();
  }

  resetView(): void {
    this.diagramCanvas?.resetView();
  }

  fitView(): void {
    this.diagramCanvas?.fitView();
  }

  onDiagramTypeChange(type: DiagramType): void {
    this.activeDiagramType.set(type);
    this.collaborationService.currentDiagramType.set(type);
  }

  onSaveEditedNode(savedNode: UmlClassNode): void {
    this.pushSnapshot();
    this.nodes.update((list) =>
      list.map((n) => (n.id === savedNode.id ? savedNode : n))
    );
    this.updateConnectionEndpoints();
    this.markAsUnsaved();
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'update_class');
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
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'update_connection');
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
    this.collaborationService.sendDiagramSync(
      this.nodes(),
      this.connections(),
      'update_class',
      this.defaultLineStyle(),
    );
  }

  // --- MÉTODOS DEL EXPLORADOR DE DIAGRAMAS POR TIPO ---

  openCreateDiagramModal(lockedType: DiagramType | null = null): void {
    this.createDiagramLockedType.set(lockedType);
    this.isCreateDiagramModalOpen.set(true);
  }

  closeCreateDiagramModal(): void {
    this.isCreateDiagramModalOpen.set(false);
    this.createDiagramLockedType.set(null);
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

    this.diagramViewStates.delete(tabId);
    try {
      sessionStorage.removeItem(`diagram_view_state_${tabId}`);
      sessionStorage.removeItem(`diagram_scroll_${tabId}`);
    } catch (_) {}

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
        this.diagramViewStates.delete(diagramId);
        try {
          sessionStorage.removeItem(`diagram_view_state_${diagramId}`);
          sessionStorage.removeItem(`diagram_scroll_${diagramId}`);
        } catch (_) {}

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
    this.collaborationService.sendDiagramSync(
      this.nodes(),
      this.connections(),
      'edit_node',
      this.defaultLineStyle()
    );
  }
}

