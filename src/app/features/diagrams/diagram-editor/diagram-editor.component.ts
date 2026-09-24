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
import { ActivatedRoute } from '@angular/router';
import {
  FFlowModule,
  FFlowComponent,
  FCreateConnectionEvent,
  FReassignConnectionEvent,
  FCanvasComponent,
  FZoomDirective,
  FCanvasChangeEvent,
  FTriggerEvent,
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
import {
  UmlRelationshipType,
  UmlLineStyle,
  UmlAttribute,
  UmlMethod,
  UmlClassNode,
  UmlConnection,
  SaveDiagramAstRequest,
  UML_RELATION_TYPES,
  UML_LINE_STYLES,
} from '../../../core/models/diagram.model';

import { Subject, debounceTime } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { DiagramAppbarComponent } from './components/diagram-appbar/diagram-appbar.component';
import { DiagramToolboxComponent } from './components/diagram-toolbox/diagram-toolbox.component';
import { AiAssistantPanelComponent } from './components/ai-assistant-panel/ai-assistant-panel.component';
import { UserProfileModalComponent } from './components/user-profile-modal/user-profile-modal.component';
import { SpringBootModalComponent } from './components/spring-boot-modal/spring-boot-modal.component';
import { TranslatePipe, TranslationService } from '../../../core/i18n';

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

@Component({
  standalone: true,
  selector: 'app-diagram-editor',
  imports: [
    CommonModule,
    FormsModule,
    FFlowModule,
    NgIconComponent,
    DiagramAppbarComponent,
    DiagramToolboxComponent,
    AiAssistantPanelComponent,
    UserProfileModalComponent,
    SpringBootModalComponent,
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

  // Indica si hay 2 o más usuarios editando concurrentemente en la sala
  readonly hasMultipleActiveUsers = computed(() => {
    return this.collaborationService.isMultiUserEditing();
  });

  @ViewChild(FFlowComponent) fFlow?: FFlowComponent;
  @ViewChild(FCanvasComponent) canvas?: FCanvasComponent;
  @ViewChild(FZoomDirective) fZoom?: FZoomDirective;
  @ViewChild('flowContainer') flowContainerRef?: ElementRef<HTMLElement>;

  // Contexto del diagrama y proyecto
  currentDiagramId = signal<string | null>(null);
  currentProjectId = signal<string | null>(null);
  currentProject = signal<Project | null>(null);
  currentDiagramName = signal<string>('Diagrama UML');
  saveSuccessMessage = signal<boolean>(false);
  hasUnsavedChanges = signal<boolean>(false);
  zoomLevel = signal<number>(100);

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
  defaultLineStyle = signal<UmlLineStyle>('segment');
  mouseCanvasPos = signal<{ x: number; y: number }>({ x: 0, y: 0 });

  // Control de movimiento del lienzo: el lienzo/pizarra es estático, solo se pueden mover las clases
  canvasMoveTrigger = (): boolean => false;

  // Historial de cambios (Deshacer Ctrl+Z / Rehacer Ctrl+Y)
  private historyUndoStack: DiagramHistorySnapshot[] = [];
  private historyRedoStack: DiagramHistorySnapshot[] = [];
  private readonly maxHistoryLength = 50;
  private isApplyingHistory = false;
  private isDraggingNode = false;
  private lastNodeDragPos = new Map<string, { x: number; y: number }>();

  historyUndoCount = signal<number>(0);
  historyRedoCount = signal<number>(0);
  readonly canUndo = computed(() => this.historyUndoCount() > 0 && !this.isReadOnly());
  readonly canRedo = computed(() => this.historyRedoCount() > 0 && !this.isReadOnly());

  // Paneles laterales
  isToolboxOpen = signal<boolean>(true);
  isAiPanelOpen = signal<boolean>(true);
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

  // Nodos y Conexiones del Diagrama
  nodes = signal<UmlClassNode[]>([]);
  connections = signal<UmlConnection[]>([]);

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
          this.fFlow?.redraw();
          this.canvas?.redraw();
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
      if (diagram.defaultLineStyle) {
        this.defaultLineStyle.set(diagram.defaultLineStyle as UmlLineStyle);
      }

      // Si hay un borrador local generado por desconexión no guardada
      const localDraftRaw = localStorage.getItem(`uml_draft_${diagramId}`);
      if (localDraftRaw) {
        try {
          const draft = JSON.parse(localDraftRaw);
          const serverUpdated = diagram.updatedAt ? new Date(diagram.updatedAt).getTime() : 0;
          if (draft.timestamp && draft.timestamp > serverUpdated && draft.nodes?.length > 0) {
            console.log('Restaurando borrador local no guardado por desconexión previa...');
            this.nodes.set(draft.nodes);
            this.connections.set(draft.connections || []);
            if (draft.defaultLineStyle) {
              this.defaultLineStyle.set(draft.defaultLineStyle);
            }
            this.markAsUnsaved();
            this.updateConnectionEndpoints();
            return;
          }
        } catch (_) {}
      }

      if (diagram.nodes && diagram.nodes.length > 0) {
        this.nodes.set(
          diagram.nodes.map((n) => ({
            id: n.id,
            name: n.name,
            position: { x: n.positionX, y: n.positionY },
            width: n.width || 220,
            height: n.height || undefined,
            isAnchor: n.isAnchor,
            assocMainConnId: n.assocMainConnId || undefined,
            attributes: (n.attributes || []).map((a) => ({
              name: a.name,
              type: this.normalizeDataType(a.type),
            })),
            methods: (n.methods || []).map((m) => ({
              name: m.name,
              parameters: m.parameters,
              returnType: this.normalizeReturnType(m.returnType),
            })),
          })),
        );
      }

      if (diagram.connections && diagram.connections.length > 0) {
        this.connections.set(
          diagram.connections.map((c) => ({
            id: c.id,
            sourceNodeId: c.sourceNodeId || undefined,
            targetNodeId: c.targetNodeId || undefined,
            sourceId: c.sourceId,
            targetId: c.targetId,
            type: c.type as UmlRelationshipType,
            lineStyle: (c.lineStyle as UmlLineStyle) || 'segment',
            name: c.name || undefined,
            sourceMultiplicity: c.sourceMultiplicity || '',
            targetMultiplicity: c.targetMultiplicity || '',
            assocAnchorNodeId: c.assocAnchorNodeId || undefined,
          })),
        );
      }

      this.collaborationService.joinRoom(diagramId);

      if (diagram.projectId && !this.currentProject()) {
        this.currentProjectId.set(diagram.projectId);
        this.projectService.getProject(diagram.projectId).subscribe({
          next: (proj) => {
            this.currentProject.set(proj);
          },
          error: () => {},
        });
      }

      this.hasUnsavedChanges.set(false);
      requestAnimationFrame(() => {
        this.updateConnectionEndpoints();
        requestAnimationFrame(() => {
          this.updateConnectionEndpoints();
          this.fFlow?.reset();
          this.fFlow?.redraw();
          this.canvas?.redraw();
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

  @HostListener('window:mouseup')
  onWindowMouseUp(): void {
    this.isDraggingNode = false;
    this.lastNodeDragPos.clear();
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    const activeTag = (document.activeElement?.tagName || '').toLowerCase();
    const isInputActive = activeTag === 'input' || activeTag === 'textarea';

    if (event.key === 'Escape') {
      this.selectedNodeId.set(null);
      this.selectedNodeIds.set(new Set());
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
    } else if (event.key === 'Delete' && !this.isReadOnly()) {
      if (!isInputActive) {
        event.preventDefault();
        this.deleteSelected();
      }
    }
  }

  buildSaveAstPayload(): SaveDiagramAstRequest {
    return {
      defaultLineStyle: this.defaultLineStyle(),
      nodes: this.nodes().map((n) => ({
        id: n.id,
        name: n.isAnchor ? (n.name || 'Anchor') : n.name,
        positionX: n.position.x,
        positionY: n.position.y,
        width: n.width,
        height: n.height,
        isAnchor: n.isAnchor,
        assocMainConnId: n.assocMainConnId,
        attributes: n.attributes,
        methods: n.methods,
      })),
      connections: this.connections().map((c) => {
        const baseSourceId = c.sourceNodeId || c.sourceId.replace(/_(top|bottom|left|right)$/, '');
        const baseTargetId = c.targetNodeId || c.targetId.replace(/_(top|bottom|left|right)$/, '');
        return {
          id: c.id,
          sourceNodeId: baseSourceId,
          targetNodeId: baseTargetId,
          sourceId: c.sourceId,
          targetId: c.targetId,
          type: c.type,
          lineStyle: c.lineStyle || this.defaultLineStyle(),
          name: c.name || null,
          sourceMultiplicity: c.sourceMultiplicity || '',
          targetMultiplicity: c.targetMultiplicity || '',
          assocAnchorNodeId: c.assocAnchorNodeId || null,
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

    if (!this.isDraggingNode) {
      this.isDraggingNode = true;
      this.pushSnapshot();
    }

    if (!this.selectedNodeIds().has(node.id) && this.selectedNodeId() !== node.id) {
      this.selectedNodeIds.set(new Set([node.id]));
      this.selectedNodeId.set(node.id);
    }

    const last = this.lastNodeDragPos.get(node.id);
    if (last) {
      const dx = newPosition.x - last.x;
      const dy = newPosition.y - last.y;

      if ((dx !== 0 || dy !== 0) && this.selectedNodeIds().size > 1 && this.selectedNodeIds().has(node.id)) {
        for (const other of this.nodes()) {
          if (other.id !== node.id && this.selectedNodeIds().has(other.id) && !other.isAnchor) {
            other.position = { x: Math.round(other.position.x + dx), y: Math.round(other.position.y + dy) };
            this.collaborationService.sendNodeDrag(other.id, other.position);
          }
        }
        this.fFlow?.redraw();
      }
    }
    this.lastNodeDragPos.set(node.id, { x: newPosition.x, y: newPosition.y });

    node.position = newPosition;
    this.markAsUnsaved();
    this.updateConnectionEndpoints();
    this.collaborationService.sendNodeDrag(node.id, newPosition);
    this.nodeDragEnd$.next();
  }

  onCanvasMouseMove(event: MouseEvent): void {
    const container = this.flowContainerRef?.nativeElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const rawX = event.clientX - rect.left;
    const rawY = event.clientY - rect.top;

    const scale = this.canvas?.transform?.scale || 1;
    const posX = this.canvas?.transform?.position?.x || 0;
    const posY = this.canvas?.transform?.position?.y || 0;

    const canvasX = (rawX - posX) / scale;
    const canvasY = (rawY - posY) / scale;

    this.collaborationService.sendCursorPosition(canvasX, canvasY);

    if (this.selectedSourceNodeId()) {
      this.mouseCanvasPos.set({ x: canvasX, y: canvasY });
    }
  }

  getNodeHeight(node: UmlClassNode): number {
    if (node.isAnchor) return 0;
    if (node.height && node.height > 0) return node.height;
    const headerH = 34;
    const attrCount = (node.attributes || []).length;
    const methodCount = (node.methods || []).length;
    const attrH = attrCount > 0 ? attrCount * 22 + 12 : 28;
    const methodH = methodCount > 0 ? methodCount * 22 + 12 : 28;
    return headerH + attrH + methodH;
  }

  getOptimalConnectorId(sourceNode: UmlClassNode, targetNode: UmlClassNode): { sourceId: string; targetId: string } {
    if (sourceNode.id === targetNode.id) {
      return {
        sourceId: `${sourceNode.id}_top`,
        targetId: `${targetNode.id}_right`,
      };
    }

    const sWidth = sourceNode.isAnchor ? 0 : sourceNode.width || 220;
    const sHeight = sourceNode.isAnchor ? 0 : this.getNodeHeight(sourceNode);
    const tWidth = targetNode.isAnchor ? 0 : targetNode.width || 220;
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
    switch (side) {
      case 'left':
        return { x: node.position.x, y: node.position.y + h / 2 };
      case 'right':
        return { x: node.position.x + w, y: node.position.y + h / 2 };
      case 'top':
        return { x: node.position.x + w / 2, y: node.position.y };
      case 'bottom':
        return { x: node.position.x + w / 2, y: node.position.y + h };
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

          const baseSourceId = conn.sourceNodeId || conn.sourceId.replace(/_(top|bottom|left|right)$/, '');
          const baseTargetId = conn.targetNodeId || conn.targetId.replace(/_(top|bottom|left|right)$/, '');
          const sourceNode = nodeMap.get(baseSourceId);
          const targetNode = nodeMap.get(baseTargetId);

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

  onCanvasBackgroundClick(): void {
    this.selectedSourceNodeId.set(null);
    this.selectedNodeId.set(null);
    this.selectedNodeIds.set(new Set());
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
    const allIds = new Set(nonAnchorNodes.map((n) => n.id));
    this.selectedNodeIds.set(allIds);
    this.selectedNodeId.set(nonAnchorNodes[0]?.id || null);
  }

  deleteSelected(): void {
    if (this.isReadOnly()) return;
    const idsToDelete = new Set(this.selectedNodeIds());
    if (this.selectedNodeId()) {
      idsToDelete.add(this.selectedNodeId()!);
    }
    if (idsToDelete.size === 0) return;

    this.pushSnapshot();
    for (const id of idsToDelete) {
      this.removeClass(id, undefined, false);
    }
    this.selectedNodeIds.set(new Set());
    this.selectedNodeId.set(null);
  }

  onNodeSelect(nodeId: string, event: MouseEvent): void {
    if (this.selectedRelationType() !== null) return;
    event.stopPropagation();

    if (event.ctrlKey || event.metaKey || event.shiftKey) {
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
    } else {
      this.selectedNodeIds.set(new Set([nodeId]));
      this.selectedNodeId.update((curr) => (curr === nodeId ? null : nodeId));
      if (!this.selectedNodeId()) {
        this.selectedNodeIds.set(new Set());
      }
    }
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
      this.fFlow?.reset();
      this.fFlow?.redraw();
      this.canvas?.redraw();
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
      this.fFlow?.reset();
      this.fFlow?.redraw();
      this.canvas?.redraw();
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

      let sourceId: string;
      let targetId: string;
      if (currentSource === nodeId) {
        sourceId = `${currentSource}_top`;
        targetId = `${nodeId}_right`;
      } else {
        const optimal = this.getOptimalConnectorId(sourceNode, targetNode);
        sourceId = optimal.sourceId;
        targetId = optimal.targetId;
      }

      const isInheritance = activeRel === 'generalization' || activeRel === 'realization';
      const newConn: UmlConnection = {
        id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        sourceNodeId: currentSource,
        targetNodeId: nodeId,
        sourceId,
        targetId,
        type: activeRel,
        lineStyle: this.defaultLineStyle(),
        sourceMultiplicity: isInheritance ? '' : '1',
        targetMultiplicity: isInheritance ? '' : '0..*',
      };

      this.pushSnapshot();
      this.connections.update((list) => [...list, newConn]);
      this.markAsUnsaved();
      this.setPointerMode();
      this.updateConnectionEndpoints();
      this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'create_conn');
    }
  }

  onFlowLoaded(): void {
    this.updateConnectionEndpoints();
    this.fFlow?.redraw();
    this.canvas?.redraw();
    this.syncZoomFromCanvas();
  }

  onConnectionCreated(event: FCreateConnectionEvent): void {
    if (this.isReadOnly() || !event.fInputId) return;

    const relType = this.selectedRelationType() || 'association';
    const baseSourceId = event.fOutputId.replace(/_(top|bottom|left|right)$/, '');
    const baseTargetId = event.fInputId.replace(/_(top|bottom|left|right)$/, '');

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
      if (baseSourceId === baseTargetId) {
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
    const newConnection: UmlConnection = {
      id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      sourceNodeId: baseSourceId,
      targetNodeId: baseTargetId,
      sourceId,
      targetId,
      type: relType,
      lineStyle: this.defaultLineStyle(),
      sourceMultiplicity: isInheritance ? '' : '1',
      targetMultiplicity: isInheritance ? '' : '0..*',
    };

    this.pushSnapshot();
    this.connections.update((list) => [...list, newConnection]);
    this.markAsUnsaved();
    this.setPointerMode();
    this.updateConnectionEndpoints();

    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'create_conn');
  }

  onConnectionReassigned(event: FReassignConnectionEvent): void {
    if (this.isReadOnly()) return;
    this.pushSnapshot();
    this.connections.update((list) =>
      list.map((c) => {
        if (c.id === event.connectionId) {
          return {
            ...c,
            sourceId: event.nextSourceId || c.sourceId,
            targetId: event.nextTargetId || c.targetId,
          };
        }
        return c;
      }),
    );
    this.markAsUnsaved();
    this.updateConnectionEndpoints();
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'reassign_conn');
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
      sourceMultiplicity: '*',
      targetMultiplicity: '*',
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
      this.fFlow?.reset();
      this.fFlow?.redraw();
      this.canvas?.redraw();
    });
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'create_assoc_class');
  }

  addClass(): void {
    if (this.isReadOnly()) return;
    this.pushSnapshot();
    const posX = Math.round(- (this.canvas?.transform?.position?.x || 0) + 150 + Math.random() * 80);
    const posY = Math.round(- (this.canvas?.transform?.position?.y || 0) + 150 + Math.random() * 80);

    const count = this.nodes().filter((n) => !n.isAnchor).length + 1;
    const newNode: UmlClassNode = {
      id: `class_${Date.now()}`,
      name: `Tabla_${count}`,
      position: { x: Math.max(50, posX), y: Math.max(50, posY) },
      width: 220,
      attributes: [],
      methods: [],
    };

    this.nodes.update((list) => [...list, newNode]);
    this.markAsUnsaved();
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'add_node');
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
    this.connections.update((list) => list.filter((c) => !connsToDelete.has(c.id)));

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
    n.attributes.push({ name: 'nuevoCampo', type: 'String' });
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

    this.pushSnapshot();
    this.connections.update((list) => list.map((c) => (c.id === edited.id ? edited : c)));
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
    this.connections.update((list) => list.filter((c) => !connsToDelete.has(c.id)));

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
        this.fFlow?.reset();
        this.fFlow?.redraw();
        this.canvas?.redraw();
        setTimeout(() => {
          this.updateConnectionEndpoints();
          this.fitView();
          setTimeout(() => {
            this.fFlow?.redraw();
            this.canvas?.redraw();
          }, 80);
        }, 80);
      });
    });
  }

  private applyAiNodesMutation(targetNodes: any[]): UmlClassNode[] {
    return targetNodes.map((n, i) => ({
      id: n.id || `class_ai_${Date.now()}_${i}`,
      name: n.name || (n.isAnchor ? '' : `Clase_${i + 1}`),
      position: {
        x: n.position?.x ?? (n.positionX ?? (100 + (i % 3) * 260)),
        y: n.position?.y ?? (n.positionY ?? (100 + Math.floor(i / 3) * 220)),
      },
      width: n.isAnchor ? 0 : (n.width || 220),
      height: n.isAnchor ? 0 : n.height,
      isAnchor: !!n.isAnchor,
      assocMainConnId: n.assocMainConnId,
      attributes: (n.attributes || []).map((a: any) => ({
        name: a.name,
        type: this.normalizeDataType(a.type),
      })),
      methods: (n.methods || []).map((m: any) => ({
        name: m.name,
        parameters: m.parameters || '',
        returnType: this.normalizeReturnType(m.returnType),
      })),
    }));
  }

  private sanitizeClientConnections(conns: any[], validNodes: UmlClassNode[]): UmlConnection[] {
    const nodeMap = new Map(validNodes.map((n) => [n.id, n]));
    const nodeIds = new Set(validNodes.map((n) => n.id));
    return conns
      .filter((c) => {
        const s = c.sourceNodeId || c.sourceId?.replace(/_(top|bottom|left|right)$/, '');
        const t = c.targetNodeId || c.targetId?.replace(/_(top|bottom|left|right)$/, '');
        return nodeIds.has(s) && nodeIds.has(t);
      })
      .map((c) => {
        const sourceNodeId = c.sourceNodeId || c.sourceId?.replace(/_(top|bottom|left|right)$/, '');
        const targetNodeId = c.targetNodeId || c.targetId?.replace(/_(top|bottom|left|right)$/, '');
        const sourceNode = nodeMap.get(sourceNodeId);
        const targetNode = nodeMap.get(targetNodeId);

        let sourceId = c.sourceId;
        let targetId = c.targetId;

        if (sourceNode && targetNode) {
          if (sourceNodeId === targetNodeId) {
            const validConnectors = [
              `${sourceNodeId}_top`,
              `${sourceNodeId}_right`,
              `${sourceNodeId}_bottom`,
              `${sourceNodeId}_left`,
            ];
            const hasDistinct =
              validConnectors.includes(sourceId) &&
              validConnectors.includes(targetId) &&
              sourceId !== targetId;
            sourceId = hasDistinct ? sourceId : `${sourceNodeId}_top`;
            targetId = hasDistinct ? targetId : `${targetNodeId}_right`;
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
          sourceMultiplicity: c.sourceMultiplicity || (sourceNodeId === targetNodeId ? '1' : ''),
          targetMultiplicity: c.targetMultiplicity || (sourceNodeId === targetNodeId ? '0..*' : ''),
          assocAnchorNodeId: c.assocAnchorNodeId || undefined,
        };
      });
  }

  async downloadBmpFile(): Promise<void> {
    if (this.hasMultipleActiveUsers()) {
      alert(this.translationService.translate('appbar.multiUserExportBlocked'));
      return;
    }
    const containerEl = this.flowContainerRef?.nativeElement;
    if (containerEl) {
      await this.bmpExportService.exportElementToBmp(
        containerEl,
        this.currentDiagramName(),
      );
    } else {
      this.bmpExportService.exportToBmp(
        this.nodes(),
        this.connections(),
        this.currentDiagramName(),
      );
    }
  }

  downloadXmiFile(): void {
    if (this.hasMultipleActiveUsers()) {
      alert(this.translationService.translate('appbar.multiUserExportBlocked'));
      return;
    }
    const diagId = this.currentDiagramId();
    if (diagId) {
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
    } else {
      alert('Debes guardar el diagrama antes de exportar XMI.');
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
              name: a.name,
              type: this.normalizeDataType(a.type),
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
        const content = e.target?.result as string;

        if (isXmiOrXml) {
          try {
            const ast = XmiClientParser.parse(content);
            if (ast.nodes && ast.nodes.length > 0) {
              this.nodes.set(
                ast.nodes.map((n: any) => ({
                  ...n,
                  width: n.width || 220,
                  attributes: (n.attributes || []).map((a: any) => ({
                    name: a.name,
                    type: this.normalizeDataType(a.type),
                  })),
                  methods: (n.methods || []).map((m: any) => ({
                    name: m.name,
                    parameters: m.parameters || '',
                    returnType: this.normalizeReturnType(m.returnType),
                  })),
                })),
              );
              this.connections.set(ast.connections || []);
              if (ast.name) {
                this.currentDiagramName.set(ast.name);
              }
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
                  name: a.name,
                  type: this.normalizeDataType(a.type),
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
    reader.readAsText(file);
  }

  triggerSpringBootGeneration(): void {
    this.showSpringBootModal.set(true);
  }

  openProfileModal(): void {
    this.isProfileModalOpen.set(true);
  }

  syncZoomFromCanvas(): void {
    if (this.canvas?.transform?.scale !== undefined) {
      this.zoomLevel.set(Math.round(this.canvas.transform.scale * 100));
    }
  }

  onCanvasChange(event?: FCanvasChangeEvent): void {
    if (event?.scale !== undefined) {
      this.zoomLevel.set(Math.round(event.scale * 100));
    } else {
      this.syncZoomFromCanvas();
    }
  }

  zoomIn(): void {
    this.fZoom?.zoomIn();
    requestAnimationFrame(() => {
      this.syncZoomFromCanvas();
    });
  }

  zoomOut(): void {
    this.fZoom?.zoomOut();
    requestAnimationFrame(() => {
      this.syncZoomFromCanvas();
    });
  }

  resetView(): void {
    if (this.canvas) {
      this.canvas.resetScaleAndCenter();
    } else if (this.fZoom) {
      this.fZoom.reset();
    }
    this.zoomLevel.set(100);
    requestAnimationFrame(() => {
      this.syncZoomFromCanvas();
    });
  }

  fitView(): void {
    this.canvas?.fitToScreen();
    requestAnimationFrame(() => {
      this.syncZoomFromCanvas();
    });
  }
}
