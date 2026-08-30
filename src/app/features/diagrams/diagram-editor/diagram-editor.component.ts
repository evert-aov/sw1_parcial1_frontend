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
import { Router, ActivatedRoute } from '@angular/router';
import {
  FFlowModule,
  FCreateConnectionEvent,
  FCanvasComponent,
  FZoomDirective,
  FCanvasChangeEvent,
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
import { CollaborationService, NodeLock } from '../../../core/services/collaboration.service';
import { AiAssistantService } from '../../../core/services/ai-assistant.service';
import { XmiService } from '../../../core/services/xmi.service';
import { XmiClientParser } from '../../../core/services/xmi-client-parser';
import {
  UmlRelationshipType,
  UmlLineStyle,
  UmlAttribute,
  UmlMethod,
  UmlClassNode,
  UmlConnection,
  SaveDiagramAstRequest,
  SessionActivityEvent,
} from '../../../core/models/diagram.model';

import { DiagramAppbarComponent } from './components/diagram-appbar/diagram-appbar.component';
import { AiAssistantPanelComponent } from './components/ai-assistant-panel/ai-assistant-panel.component';
import { UserProfileModalComponent } from './components/user-profile-modal/user-profile-modal.component';

export interface UmlDiagramProject {
  version: string;
  name: string;
  createdDate: string;
  defaultLineStyle: UmlLineStyle;
  nodes: UmlClassNode[];
  connections: UmlConnection[];
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
    AiAssistantPanelComponent,
    UserProfileModalComponent,
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
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  @ViewChild(FCanvasComponent) canvas?: FCanvasComponent;
  @ViewChild(FZoomDirective) fZoom?: FZoomDirective;
  @ViewChild('flowContainer') flowContainerRef?: ElementRef<HTMLElement>;

  // Contexto del diagrama y proyecto
  currentDiagramId = signal<string | null>(null);
  currentProjectId = signal<string | null>(null);
  currentDiagramName = signal<string>('Diagrama UML');
  saveSuccessMessage = signal<boolean>(false);
  zoomLevel = signal<number>(100);

  // Rol del usuario actual en el proyecto
  currentUserRole = signal<string>('EDITOR');
  readonly isReadOnly = computed(() => this.currentUserRole() === 'VIEWER');

  // Herramienta activa
  selectedRelationType = signal<UmlRelationshipType | null>(null);
  selectedSourceNodeId = signal<string | null>(null);
  selectedNodeId = signal<string | null>(null);
  defaultLineStyle = signal<UmlLineStyle>('segment');
  mouseCurrentPos = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  mouseCanvasPos = signal<{ x: number; y: number }>({ x: 0, y: 0 });

  // Paneles y modales
  isToolboxOpen = signal<boolean>(true);
  isAiPanelOpen = signal<boolean>(true);
  isProfileModalOpen = signal<boolean>(false);
  isRelationshipsOpen = signal<boolean>(true);
  isLineStylesOpen = signal<boolean>(true);

  // Historial de actividad de la sesión
  sessionHistory = signal<SessionActivityEvent[]>([
    {
      id: 'init_session',
      timestamp: new Date(),
      type: 'ai_chat',
      title: 'Sesión Iniciada',
      description: 'Espacio de modelado UML y Copilot IA inicializados.',
      actor: 'Sistema',
      icon: 'heroSparkles',
      badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    },
  ]);

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

  // Relaciones del Toolbox
  readonly relationTypes: { id: UmlRelationshipType; label: string; icon: string; description: string }[] = [
    { id: 'association', label: 'Association', icon: '───', description: 'Relación estructural simple entre dos clases' },
    { id: 'generalization', label: 'Generalization', icon: '─▷', description: 'Herencia: la subclase hereda de la superclase' },
    { id: 'realization', label: 'Realization', icon: '┈▷', description: 'Implementación de una interfaz' },
    { id: 'composition', label: 'Composition', icon: '◆──', description: 'Pertenencia fuerte del todo a las partes' },
    { id: 'aggregation', label: 'Aggregation', icon: '◇──', description: 'Pertenencia débil o contenedor independiente' },
    { id: 'dependency', label: 'Dependency', icon: '┈>', description: 'Uso temporal o dependencia débil' },
    { id: 'association_class', label: 'Association Class', icon: '─*─┄[C]', description: 'Relación muchos a muchos con clase intermedia' },
  ];

  // Estilos de línea Enterprise Architect
  readonly lineStyles: { id: UmlLineStyle; label: string; shortcut?: string }[] = [
    { id: 'segment', label: 'Custom Line (EA Default / Segmentos)', shortcut: 'Ctrl+Shift+C' },
    { id: 'straight', label: 'Direct (Directa / Recta)', shortcut: 'Ctrl+Shift+D' },
    { id: 'bezier', label: 'Bezier (Curva Suave)' },
    { id: 'adaptive-curve', label: 'Orthogonal - Rounded (Curva Adaptativa)' },
  ];

  // Modales de edición
  isEditNodeModalOpen = signal<boolean>(false);
  isEditConnModalOpen = signal<boolean>(false);
  editingNode = signal<UmlClassNode | null>(null);
  editingConnection = signal<UmlConnection | null>(null);

  // Modal JSON
  showJsonModal = signal<boolean>(false);
  jsonContent = signal<string>('');
  jsonModalMode = signal<'import' | 'export'>('export');

  // Modal Spring Boot
  showSpringBootModal = signal<boolean>(false);

  // Nodos y Conexiones del Diagrama
  nodes = signal<UmlClassNode[]>([]);
  connections = signal<UmlConnection[]>([]);

  private animationTimers: any[] = [];

  ngOnInit(): void {
    // Sincronización remota de movimiento de nodos
    this.collaborationService.remoteNodeDrag$.subscribe((data) => {
      this.nodes.update((list) =>
        list.map((n) => (n.id === data.nodeId ? { ...n, position: data.position } : n)),
      );
      this.updateConnectionEndpoints();
    });

    // Sincronización remota del diagrama completo
    this.collaborationService.remoteDiagramSync$.subscribe((data) => {
      if (data.action === 'ai_mutation' && data.nodes) {
        this.applyAiMutationWithAnimation(data.nodes, data.connections || []);
      } else if (data.nodes) {
        const cleanNodes = this.applyAiNodesMutation(data.nodes);
        this.nodes.set(cleanNodes);
        const cleanConns = this.sanitizeClientConnections(data.connections || [], cleanNodes);
        this.connections.set(cleanConns);
        this.updateConnectionEndpoints();
        setTimeout(() => this.updateConnectionEndpoints(), 60);
      }
    });

    // Bloqueos concurrentes
    this.collaborationService.nodeLockRejected$.subscribe((data) => {
      if (this.editingNode()?.id === data.nodeId) {
        this.isEditNodeModalOpen.set(false);
        this.editingNode.set(null);
        alert(`🔒 La tabla está siendo editada por ${data.lockedBy.userName}. Por favor espera.`);
      }
    });

    this.route.queryParams.subscribe((params) => {
      const diagramId = params['diagramId'];
      const projectId = params['projectId'];
      const projectName = params['projectName'];

      if (projectId) {
        this.currentProjectId.set(projectId);
        this.projectService.getProject(projectId).subscribe({
          next: (project) => {
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

  // -------------------------------------------------------------
  // REGISTRO DE AUDITORÍA
  // -------------------------------------------------------------
  logSessionActivity(
    type: SessionActivityEvent['type'],
    title: string,
    description: string,
    actor?: string,
    badgeClass?: string
  ): void {
    const user = this.authService.currentUser();
    const resolvedActor = actor || (user ? `👤 ${user.fullName}` : '👤 Usuario');

    const icons: Record<SessionActivityEvent['type'], string> = {
      ai_mutation: 'heroSparkles',
      ai_chat: 'heroSparkles',
      create_node: 'heroPlus',
      update_node: 'heroPencilSquare',
      delete_node: 'heroTrash',
      create_conn: 'heroArrowsRightLeft',
      update_conn: 'heroPencilSquare',
      delete_conn: 'heroTrash',
      import_file: 'heroArrowUpTray',
      export_file: 'heroArrowDownTray',
    };

    const badgeColors: Record<SessionActivityEvent['type'], string> = {
      ai_mutation: 'bg-purple-100 text-purple-800 border-purple-300',
      ai_chat: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      create_node: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      update_node: 'bg-sky-100 text-sky-800 border-sky-300',
      delete_node: 'bg-red-100 text-red-800 border-red-300',
      create_conn: 'bg-amber-100 text-amber-800 border-amber-300',
      update_conn: 'bg-orange-100 text-orange-800 border-orange-300',
      delete_conn: 'bg-rose-100 text-rose-800 border-rose-300',
      import_file: 'bg-teal-100 text-teal-800 border-teal-300',
      export_file: 'bg-blue-100 text-blue-800 border-blue-300',
    };

    const event: SessionActivityEvent = {
      id: 'act_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      timestamp: new Date(),
      type,
      title,
      description,
      actor: resolvedActor,
      icon: icons[type] || 'heroDocumentText',
      badgeClass: badgeClass || badgeColors[type] || 'bg-slate-100 text-slate-700 border-slate-300',
    };

    this.sessionHistory.update((list) => [event, ...list]);
  }

  // -------------------------------------------------------------
  // CARGA Y PERSISTENCIA DE DIAGRAMAS
  // -------------------------------------------------------------
  loadDiagramFromBackend(diagramId: string): void {
    this.diagramService.loadDiagram(diagramId).subscribe((diagram) => {
      this.currentDiagramName.set(diagram.name);
      if (diagram.defaultLineStyle) {
        this.defaultLineStyle.set(diagram.defaultLineStyle as UmlLineStyle);
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

      setTimeout(() => {
        this.updateConnectionEndpoints();
      }, 50);
    });
  }

  saveToBackend(): void {
    if (this.isReadOnly()) return;

    const diagramId = this.currentDiagramId();
    if (!diagramId) {
      this.openExportModal();
      return;
    }

    const payload: SaveDiagramAstRequest = {
      defaultLineStyle: this.defaultLineStyle(),
      nodes: this.nodes().map((n) => ({
        id: n.id,
        name: n.name,
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

    this.diagramService.saveAst(diagramId, payload).subscribe({
      next: () => {
        this.saveSuccessMessage.set(true);
        setTimeout(() => this.saveSuccessMessage.set(false), 2500);
        this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'save');
        this.logSessionActivity('create_node', 'Diagrama Guardado', 'El estado del diagrama se persistió en el servidor.');
      },
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

  // -------------------------------------------------------------
  // HERRAMIENTAS Y TOOLBOX
  // -------------------------------------------------------------
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

  addClass(): void {
    if (this.isReadOnly()) return;
    this.createClassAtPosition(this.mouseCanvasPos().x || 250, this.mouseCanvasPos().y || 200);
  }

  createClassAtPosition(x: number, y: number): void {
    const count = this.nodes().filter((n) => !n.isAnchor).length + 1;
    const newNode: UmlClassNode = {
      id: `class_${Date.now()}`,
      name: `Tabla_${count}`,
      position: { x: Math.round(x), y: Math.round(y) },
      width: 220,
      attributes: [
        { name: 'id', type: 'UUID' },
        { name: 'nombre', type: 'String' },
      ],
      methods: [
        { name: 'getId', parameters: '', returnType: 'UUID' },
      ],
    };

    this.nodes.update((list) => [...list, newNode]);
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'add_node');
    this.logSessionActivity('create_node', `Clase Creada: ${newNode.name}`, `Se añadió una nueva entidad en (${Math.round(x)}, ${Math.round(y)}).`);
  }

  removeClass(nodeId: string, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (this.isReadOnly()) return;

    const node = this.nodes().find((n) => n.id === nodeId);
    this.nodes.update((list) => list.filter((n) => n.id !== nodeId));
    this.connections.update((list) =>
      list.filter((c) => {
        const sourceBase = c.sourceNodeId || c.sourceId.replace(/_(top|bottom|left|right)$/, '');
        const targetBase = c.targetNodeId || c.targetId.replace(/_(top|bottom|left|right)$/, '');
        return sourceBase !== nodeId && targetBase !== nodeId;
      }),
    );

    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'remove_node');
    this.logSessionActivity('delete_node', `Clase Eliminada: ${node?.name || nodeId}`, 'Entidad y relaciones asociadas eliminadas.');
  }

  // -------------------------------------------------------------
  // MANEJO DE CONEXIONES FOBLEX FLOW
  // -------------------------------------------------------------
  onConnectionCreated(event: FCreateConnectionEvent): void {
    if (this.isReadOnly()) return;
    if (!event.fOutputId || !event.fInputId) return;

    const sourceConnectorId = event.fOutputId;
    const targetConnectorId = event.fInputId;
    const sourceNodeId = sourceConnectorId.replace(/_(top|bottom|left|right)$/, '');
    const targetNodeId = targetConnectorId.replace(/_(top|bottom|left|right)$/, '');

    if (sourceNodeId === targetNodeId) return;

    const relType = this.selectedRelationType() || 'association';

    if (relType === 'association_class') {
      this.createAssociationClassNode(sourceNodeId, targetNodeId);
      this.setPointerMode();
      return;
    }

    const newConnection: UmlConnection = {
      id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      sourceNodeId,
      targetNodeId,
      sourceId: sourceConnectorId,
      targetId: targetConnectorId,
      type: relType,
      lineStyle: this.defaultLineStyle(),
      sourceMultiplicity: '1',
      targetMultiplicity: '1..*',
    };

    this.connections.update((list) => [...list, newConnection]);
    this.setPointerMode();
    this.updateConnectionEndpoints();

    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'create_conn');
    this.logSessionActivity('create_conn', `Relación Trazada (${relType})`, `Conectado ${sourceNodeId} con ${targetNodeId}.`);
  }

  private createAssociationClassNode(sourceNodeId: string, targetNodeId: string): void {
    const sourceNode = this.nodes().find((n) => n.id === sourceNodeId);
    const targetNode = this.nodes().find((n) => n.id === targetNodeId);
    if (!sourceNode || !targetNode) return;

    const assocClassName = `${sourceNode.name}_${targetNode.name}`;
    const midX = Math.round((sourceNode.position.x + targetNode.position.x) / 2);
    const midY = Math.round((sourceNode.position.y + targetNode.position.y) / 2) + 120;

    const assocNode: UmlClassNode = {
      id: `class_${Date.now()}_assoc`,
      name: assocClassName,
      position: { x: midX, y: midY },
      width: 220,
      attributes: [
        { name: 'id', type: 'UUID' },
        { name: 'fechaRegistro', type: 'LocalDateTime' },
      ],
      methods: [
        { name: 'getId', parameters: '', returnType: 'UUID' },
      ],
    };

    const mainConn: UmlConnection = {
      id: `conn_${Date.now()}_main`,
      sourceNodeId,
      targetNodeId,
      sourceId: `${sourceNodeId}_right`,
      targetId: `${targetNodeId}_left`,
      type: 'association',
      lineStyle: this.defaultLineStyle(),
      sourceMultiplicity: '1..*',
      targetMultiplicity: '1..*',
    };

    const dashedConn: UmlConnection = {
      id: `conn_${Date.now()}_dashed`,
      sourceNodeId: assocNode.id,
      targetNodeId,
      sourceId: `${assocNode.id}_top`,
      targetId: `${targetNodeId}_bottom`,
      type: 'dependency',
      lineStyle: 'straight',
      name: '«link»',
    };

    this.nodes.update((list) => [...list, assocNode]);
    this.connections.update((list) => [...list, mainConn, dashedConn]);
    this.updateConnectionEndpoints();

    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'create_assoc_class');
    this.logSessionActivity('create_node', `Clase de Asociación: ${assocClassName}`, `Creada entre ${sourceNode.name} y ${targetNode.name}.`);
  }

  updateConnectionEndpoints(): void {
    const nodeMap = new Map(this.nodes().map((n) => [n.id, n]));
    this.connections.update((conns) =>
      conns.map((c) => {
        const sourceBase = c.sourceNodeId || c.sourceId.replace(/_(top|bottom|left|right)$/, '');
        const targetBase = c.targetNodeId || c.targetId.replace(/_(top|bottom|left|right)$/, '');
        const s = nodeMap.get(sourceBase);
        const t = nodeMap.get(targetBase);
        if (!s || !t) return c;

        return {
          ...c,
          sourceNodeId: sourceBase,
          targetNodeId: targetBase,
        };
      }),
    );
  }

  onNodeDragEnd(nodeId: string, position: { x: number; y: number }): void {
    this.nodes.update((list) =>
      list.map((n) => (n.id === nodeId ? { ...n, position: { x: Math.round(position.x), y: Math.round(position.y) } } : n)),
    );
    this.updateConnectionEndpoints();
    this.collaborationService.sendNodeDrag(nodeId, position);
  }

  onCanvasChange(event: FCanvasChangeEvent): void {
    if (event.scale !== undefined) {
      this.zoomLevel.set(Math.round(event.scale * 100));
    }
  }

  // -------------------------------------------------------------
  // MODALES DE EDICIÓN DE NODOS Y CONEXIONES
  // -------------------------------------------------------------
  openEditNodeModal(node: UmlClassNode, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (this.isReadOnly()) return;

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

    this.nodes.update((list) => list.map((n) => (n.id === edited.id ? edited : n)));
    this.closeEditNodeModal();
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'update_node');
    this.logSessionActivity('update_node', `Clase Editada: ${edited.name}`, 'Atributos o métodos actualizados.');
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

    this.connections.update((list) => list.map((c) => (c.id === edited.id ? edited : c)));
    this.closeEditConnModal();
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'update_conn');
    this.logSessionActivity('update_conn', `Relación Actualizada (${edited.type})`, 'Multiplicidades o estilo modificados.');
  }

  removeConnection(connId: string, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (this.isReadOnly()) return;

    this.connections.update((list) => list.filter((c) => c.id !== connId));
    this.closeEditConnModal();
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'delete_conn');
    this.logSessionActivity('delete_conn', 'Relación Eliminada', `Conexión ${connId} removida.`);
  }

  // Atributos y Métodos dinámicos en Modal
  addAttributeToEditingNode(): void {
    const n = this.editingNode();
    if (!n) return;
    n.attributes = n.attributes || [];
    n.attributes.push({ name: 'nuevoAtributo', type: 'String' });
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

  // -------------------------------------------------------------
  // IA MUTATION HANDLERS
  // -------------------------------------------------------------
  onAiMutation(event: { nodes: UmlClassNode[]; connections: UmlConnection[]; summary: string }): void {
    if (event.nodes && event.nodes.length > 0) {
      this.applyAiMutationWithAnimation(event.nodes, event.connections || []);
      this.collaborationService.sendDiagramSync(event.nodes, event.connections || [], 'ai_mutation');
    }
  }

  private applyAiMutationWithAnimation(targetNodes: UmlClassNode[], targetConns: UmlConnection[]): void {
    const cleanNodes = this.applyAiNodesMutation(targetNodes);
    this.nodes.set(cleanNodes);
    const cleanConns = this.sanitizeClientConnections(targetConns, cleanNodes);
    this.connections.set(cleanConns);
    this.updateConnectionEndpoints();
    setTimeout(() => {
      this.updateConnectionEndpoints();
      this.fitView();
    }, 100);
  }

  private applyAiNodesMutation(targetNodes: any[]): UmlClassNode[] {
    return targetNodes.map((n, i) => ({
      id: n.id || `class_ai_${Date.now()}_${i}`,
      name: n.name || `Clase_${i + 1}`,
      position: {
        x: n.position?.x ?? (n.positionX ?? (100 + (i % 3) * 260)),
        y: n.position?.y ?? (n.positionY ?? (100 + Math.floor(i / 3) * 220)),
      },
      width: n.width || 220,
      height: n.height,
      isAnchor: n.isAnchor,
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
    const nodeIds = new Set(validNodes.map((n) => n.id));
    return conns
      .filter((c) => {
        const s = c.sourceNodeId || c.sourceId?.replace(/_(top|bottom|left|right)$/, '');
        const t = c.targetNodeId || c.targetId?.replace(/_(top|bottom|left|right)$/, '');
        return nodeIds.has(s) && nodeIds.has(t);
      })
      .map((c) => ({
        id: c.id || `conn_ai_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        sourceNodeId: c.sourceNodeId || c.sourceId?.replace(/_(top|bottom|left|right)$/, ''),
        targetNodeId: c.targetNodeId || c.targetId?.replace(/_(top|bottom|left|right)$/, ''),
        sourceId: c.sourceId || `${c.sourceNodeId}_right`,
        targetId: c.targetId || `${c.targetNodeId}_left`,
        type: (c.type as UmlRelationshipType) || 'association',
        lineStyle: (c.lineStyle as UmlLineStyle) || this.defaultLineStyle(),
        name: c.name || undefined,
        sourceMultiplicity: c.sourceMultiplicity || '',
        targetMultiplicity: c.targetMultiplicity || '',
        assocAnchorNodeId: c.assocAnchorNodeId || undefined,
      }));
  }

  // -------------------------------------------------------------
  // EXPORTACIÓN & IMPORTACIÓN (XMI / JSON)
  // -------------------------------------------------------------
  downloadXmiFile(): void {
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
          this.logSessionActivity('export_file', 'Exportación XMI (EA)', 'Archivo XMI 2.1 descargado para Enterprise Architect.');
        },
      });
    } else {
      alert('Debes guardar el diagrama antes de exportar XMI.');
    }
  }

  downloadJsonFile(): void {
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
    this.logSessionActivity('export_file', 'Exportación AST JSON', 'Archivo JSON AST descargado.');
  }

  openExportModal(): void {
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
    this.jsonContent.set('');
    this.jsonModalMode.set('import');
    this.showJsonModal.set(true);
  }

  applyImportedJson(): void {
    if (this.isReadOnly()) return;
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
        this.logSessionActivity('import_file', 'Importación JSON Aplicada', `Se cargaron ${project.nodes.length} clases.`);
      } else {
        alert('Estructura JSON inválida: faltan nodos o conexiones.');
      }
    } catch (e) {
      alert('Error en el formato JSON: ' + e);
    }
  }

  onFileSelected(event: Event): void {
    if (this.isReadOnly()) return;
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
              this.updateConnectionEndpoints();
              setTimeout(() => {
                this.updateConnectionEndpoints();
                this.fitView();
              }, 100);
              this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'import_xmi');
              this.logSessionActivity('import_file', 'Importación XMI Exitosa', `Se importaron ${ast.nodes.length} clases desde ${file.name}.`);
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
            this.updateConnectionEndpoints();
            setTimeout(() => {
              this.updateConnectionEndpoints();
              this.fitView();
            }, 100);
            this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'import_json');
            this.logSessionActivity('import_file', 'Importación JSON Exitosa', `Se importaron ${project.nodes.length} clases desde ${file.name}.`);
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

  clearDiagram(): void {
    if (this.isReadOnly()) return;
    if (confirm('¿Estás seguro de que deseas limpiar el diagrama?')) {
      this.nodes.set([]);
      this.connections.set([]);
      this.selectedSourceNodeId.set(null);
      this.collaborationService.sendDiagramSync([], [], 'clear');
      this.logSessionActivity('delete_node', 'Diagrama Limpiado', 'Se removieron todos los elementos del lienzo.');
    }
  }

  // Zoom & Pan
  zoomIn(): void {
    this.fZoom?.zoomIn();
  }

  zoomOut(): void {
    this.fZoom?.zoomOut();
  }

  resetZoom(): void {
    this.fZoom?.reset();
  }

  fitView(): void {
    this.canvas?.fitToScreen();
  }
}
