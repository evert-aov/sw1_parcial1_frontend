import { Component, signal, ViewChild, ElementRef, OnInit, OnDestroy, HostListener, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { FFlowModule, FCreateConnectionEvent, FCanvasComponent, FZoomDirective, FCanvasChangeEvent } from '@foblex/flow';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
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
  heroMicrophone,
  heroPhoto,
  heroCamera,
  heroClipboard,
  heroPaperAirplane,
  heroStop,
  heroBars3,
  heroBars3CenterLeft,
  heroChevronLeft,
} from '@ng-icons/heroicons/outline';

export interface UmlDiagramProject {
  version: string;
  name: string;
  createdDate: string;
  defaultLineStyle: UmlLineStyle;
  nodes: UmlClassNode[];
  connections: UmlConnection[];
}

export interface AiChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  imagePreview?: string;
  changesSummary?: string;
  timestamp: Date;
  status?: 'success' | 'clarification' | 'error' | 'pending';
}

@Component({
  standalone: true,
  selector: 'app-diagram-editor',
  imports: [CommonModule, FormsModule, FFlowModule, NgIconComponent, RouterLink],
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
      heroMicrophone,
      heroPhoto,
      heroCamera,
      heroClipboard,
      heroPaperAirplane,
      heroStop,
      heroBars3,
      heroBars3CenterLeft,
      heroChevronLeft,
    })
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
  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('imageInput') imageInput?: ElementRef<HTMLInputElement>;
  @ViewChild('chatScrollContainer') chatScrollContainerRef?: ElementRef<HTMLElement>;

  // Contexto del diagrama y proyecto
  currentDiagramId = signal<string | null>(null);
  currentProjectId = signal<string | null>(null);
  currentDiagramName = signal<string>('Diagrama UML');
  saveSuccessMessage = signal<boolean>(false);
  zoomLevel = signal<number>(100);

  // Rol del usuario actual en el proyecto
  currentUserRole = signal<string>('EDITOR');
  readonly isReadOnly = computed(() => this.currentUserRole() === 'VIEWER');

  // Modo Seleccionar / Mover o Crear Relación
  selectedRelationType = signal<UmlRelationshipType | null>(null);
  selectedSourceNodeId = signal<string | null>(null);
  selectedNodeId = signal<string | null>(null);
  defaultLineStyle = signal<UmlLineStyle>('segment');
  mouseCurrentPos = signal<{ x: number; y: number }>({ x: 0, y: 0 });

  // Posición del cursor en coordenadas del lienzo
  mouseCanvasPos = signal<{ x: number; y: number }>({ x: 0, y: 0 });

  // Paneles laterales (Visibilidad colapsable)
  isToolboxOpen = signal<boolean>(true);
  isAiPanelOpen = signal<boolean>(true);
  isExportDropdownOpen = signal<boolean>(false);
  isImportDropdownOpen = signal<boolean>(false);

  // IA Copilot (Vertex AI Gemini 2.5 Flash)
  aiPrompt = signal<string>('');
  isAiProcessing = signal<boolean>(false);
  isVoiceListening = signal<boolean>(false);
  attachedImageBase64 = signal<string | null>(null);
  attachedImageMimeType = signal<string>('image/png');
  attachedImageName = signal<string | null>(null);
  showWebcamModal = signal<boolean>(false);
  @ViewChild('webcamVideo') webcamVideoRef?: ElementRef<HTMLVideoElement>;
  private webcamMediaStream: MediaStream | null = null;
  private speechRecognitionInstance: any = null;

  // Conversación tipo Chat con Copilot IA
  activeAiTab = signal<'chat' | 'history'>('chat');
  sessionHistory = signal<SessionActivityEvent[]>([
    {
      id: 'init_session',
      timestamp: new Date(),
      type: 'ai_chat',
      title: 'Sesión Iniciada',
      description: 'Espacio de modelado UML y Copilot IA inicializados.',
      actor: 'Sistema',
      icon: 'heroSparkles',
      badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300'
    }
  ]);
  aiChatMessages = signal<AiChatMessage[]>([
    {
      id: 'm_welcome',
      sender: 'assistant',
      text: '¡Hola! Soy tu Copilot de Arquitectura UML con Google Vertex AI. Puedes pedirme crear tablas, agregar atributos tipados, trazar relaciones, dictarme por voz o adjuntarme fotos de diagramas.',
      timestamp: new Date(),
      status: 'success',
    }
  ]);

  // Opciones de multiplicidad estándar
  readonly multiplicityOptions: string[] = ['1', '0..1', '1..*', '0..*', '*', 'n', 'm'];

  // Tipos de datos estrictamente predefinidos y compatibles con Backend (Spring Boot / NestJS / SQL)
  readonly predefinedTypes: string[] = [
    'UUID',
    'String',
    'Integer',
    'Long',
    'Boolean',
    'Double',
    'Float',
    'BigDecimal',
    'LocalDate',
    'LocalDateTime',
    'Date',
    'Text',
    'byte[]'
  ];

  // Tipos de retorno para métodos
  readonly predefinedReturnTypes: string[] = [
    'void',
    'UUID',
    'String',
    'Integer',
    'Long',
    'Boolean',
    'Double',
    'BigDecimal',
    'LocalDate',
    'LocalDateTime',
    'List<Object>',
    'Object'
  ];

  // Lista de relaciones del Toolbox
  readonly relationTypes: { id: UmlRelationshipType; label: string; icon: string; description: string }[] = [
    { 
      id: 'association', 
      label: 'Association', 
      icon: '───', 
      description: 'Relación estructural simple entre dos clases' 
    },
    { 
      id: 'generalization', 
      label: 'Generalization', 
      icon: '─▷', 
      description: 'Herencia: la subclase hereda de la superclase' 
    },
    { 
      id: 'realization', 
      label: 'Realization', 
      icon: '┈▷', 
      description: 'Implementación de una interfaz' 
    },
    { 
      id: 'composition', 
      label: 'Composition', 
      icon: '◆──', 
      description: 'Pertenencia fuerte del todo a las partes' 
    },
    { 
      id: 'aggregation', 
      label: 'Aggregation', 
      icon: '◇──', 
      description: 'Pertenencia débil o contenedor independiente' 
    },
    { 
      id: 'dependency', 
      label: 'Dependency', 
      icon: '┈>', 
      description: 'Uso temporal o dependencia débil' 
    },
    { 
      id: 'association_class', 
      label: 'Association Class', 
      icon: '─*─┄[C]', 
      description: 'Relación muchos a muchos con clase intermedia' 
    },
  ];

  // Estilos de enrutamiento compatibles con Enterprise Architect
  readonly lineStyles: { id: UmlLineStyle; label: string; shortcut?: string }[] = [
    { id: 'segment', label: 'Custom Line (EA Default / Segmentos)', shortcut: 'Ctrl+Shift+C' },
    { id: 'straight', label: 'Direct (Directa / Recta)', shortcut: 'Ctrl+Shift+D' },
    { id: 'bezier', label: 'Bezier (Curva Suave)' },
    { id: 'adaptive-curve', label: 'Orthogonal - Rounded (Curva Adaptativa)' },
  ];

  // Acordeones del toolbox
  isRelationshipsOpen = signal<boolean>(true);
  isLineStylesOpen = signal<boolean>(true);

  // Modales de edición
  isEditNodeModalOpen = signal<boolean>(false);
  isEditConnModalOpen = signal<boolean>(false);
  editingNode = signal<UmlClassNode | null>(null);
  editingConnection = signal<UmlConnection | null>(null);

  // Modal JSON
  showJsonModal = signal<boolean>(false);
  jsonContent = signal<string>('');
  jsonModalMode = signal<'import' | 'export'>('export');

  // Modal Perfil de Usuario (/api/auth/me)
  isProfileModalOpen = signal<boolean>(false);
  isRefreshingProfile = signal<boolean>(false);

  // Modal Spring Boot
  showSpringBootModal = signal<boolean>(false);

  // Nodos y Conexiones del Diagrama (Inicialización limpia / vacía)
  nodes = signal<UmlClassNode[]>([]);
  connections = signal<UmlConnection[]>([]);

  ngOnInit(): void {
    // Sincronización remota de movimiento de nodos
    this.collaborationService.remoteNodeDrag$.subscribe((data) => {
      this.nodes.update((list) =>
        list.map((n) => (n.id === data.nodeId ? { ...n, position: data.position } : n)),
      );
      this.updateConnectionEndpoints();
    });

    // Sincronización remota del diagrama completo (incluyendo mutaciones del Copilot IA)
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
      } else if (data.connections) {
        this.connections.set(this.sanitizeClientConnections(data.connections, this.nodes()));
        this.updateConnectionEndpoints();
      }

      if (data.action === 'ai_mutation' && !this.isAiProcessing()) {
        this.aiChatMessages.update(list => [
          ...list,
          {
            id: `ai_remote_${Date.now()}`,
            sender: 'assistant',
            text: '✨ Copilot IA actualizó el diagrama en tiempo real.',
            timestamp: new Date(),
            status: 'success',
          },
        ]);
        this.scrollToChatBottom();
      }
    });

    // Manejo de rechazo de bloqueo por condición de carrera
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
      // Sin diagramId ni projectId: no se une a ninguna sala de colaboración
    });

    this.updateConnectionEndpoints();
  }

  ngOnDestroy(): void {
    if (this.editingNode()) {
      this.collaborationService.releaseNodeLock(this.editingNode()!.id);
    }
    if (this.speechRecognitionInstance && this.isVoiceListening()) {
      this.speechRecognitionInstance.stop();
    }
    this.animationTimers.forEach(t => clearTimeout(t));
    this.animationTimers = [];
    this.collaborationService.leaveRoom();
  }

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
            attributes: (n.attributes || []).map(a => ({
              name: a.name,
              type: this.normalizeDataType(a.type)
            })),
            methods: (n.methods || []).map(m => ({
              name: m.name,
              parameters: m.parameters,
              returnType: this.normalizeReturnType(m.returnType)
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

  normalizeDataType(type: string): string {
    if (!type) return 'String';
    const found = this.predefinedTypes.find(t => t.toLowerCase() === type.trim().toLowerCase());
    return found || 'String';
  }

  normalizeReturnType(type: string): string {
    if (!type) return 'void';
    const found = this.predefinedReturnTypes.find(rt => rt.toLowerCase() === type.trim().toLowerCase());
    return found || 'void';
  }

  // --- BLOQUEOS Y EXCLUSIÓN MUTUA DE TABLAS ---
  getNodeLock(nodeId: string): NodeLock | undefined {
    return this.collaborationService.activeNodeLocks().get(nodeId);
  }

  isNodeLockedByOther(nodeId: string): boolean {
    const lock = this.collaborationService.activeNodeLocks().get(nodeId);
    const currentUserId = this.authService.currentUser()?.id;
    return !!lock && lock.userId !== currentUserId;
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.selectedNodeId.set(null);
      this.setPointerMode();
      this.closeEditNodeModal();
      this.closeEditConnModal();
      this.showJsonModal.set(false);
      this.showSpringBootModal.set(false);
      this.isExportDropdownOpen.set(false);
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
    }
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
      },
    });
  }

  // --- SELECCIÓN Y HERRAMIENTAS DEL TOOLBOX ---
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
    this.defaultLineStyle.set(style);
  }

  // --- ARRASTRE Y REDIMENSIONAMIENTO ---
  onNodePositionChange(node: UmlClassNode, newPosition: { x: number; y: number }): void {
    if (this.isReadOnly() || this.isNodeLockedByOther(node.id)) return;
    node.position = newPosition;
    this.updateConnectionEndpoints();
    this.collaborationService.sendNodeDrag(node.id, newPosition);
  }

  onResizeMouseDown(node: UmlClassNode, event: MouseEvent): void {
    if (this.isReadOnly() || this.isNodeLockedByOther(node.id)) return;
    event.stopPropagation();
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = node.width || 220;
    const startHeight = node.height || 60;
    const scale = this.canvas?.transform?.scale || 1;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startX) / scale;
      const dy = (moveEvent.clientY - startY) / scale;
      node.width = Math.max(180, Math.round(startWidth + dx));
      if (Math.abs(dy) > 5) {
        node.height = Math.max(50, Math.round(startHeight + dy));
      }
      this.nodes.update(list => [...list]);
      this.updateConnectionEndpoints();
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'resize');
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  // --- SEGUIMIENTO Y LÍNEA GUÍA ---
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

  getSelectedSourceNode(): UmlClassNode | undefined {
    const id = this.selectedSourceNodeId();
    if (!id) return undefined;
    return this.nodes().find(n => n.id === id);
  }

  getPreviewSourcePoint(sourceNode: UmlClassNode, mousePos: { x: number; y: number }): { x: number; y: number } {
    const nodeWidth = sourceNode.width || 220;
    const nodeHeight = this.getNodeHeight(sourceNode);
    const cx = sourceNode.position.x + nodeWidth / 2;
    const cy = sourceNode.position.y + nodeHeight / 2;
    const dx = mousePos.x - cx;
    const dy = mousePos.y - cy;

    if (Math.abs(dx) >= Math.abs(dy)) {
      if (dx >= 0) {
        return { x: sourceNode.position.x + nodeWidth, y: cy };
      } else {
        return { x: sourceNode.position.x, y: cy };
      }
    } else {
      if (dy >= 0) {
        return { x: cx, y: sourceNode.position.y + nodeHeight };
      } else {
        return { x: cx, y: sourceNode.position.y };
      }
    }
  }

  getPreviewPath(): string {
    const sourceNode = this.getSelectedSourceNode();
    if (!sourceNode) return '';

    const mouse = this.mouseCanvasPos();
    const start = this.getPreviewSourcePoint(sourceNode, mouse);
    const style = this.defaultLineStyle();

    if (style === 'straight') {
      return `M ${start.x} ${start.y} L ${mouse.x} ${mouse.y}`;
    } else if (style === 'bezier') {
      const midX = (start.x + mouse.x) / 2;
      return `M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${mouse.y}, ${mouse.x} ${mouse.y}`;
    } else {
      const midX = (start.x + mouse.x) / 2;
      return `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${mouse.y} L ${mouse.x} ${mouse.y}`;
    }
  }

  getNodeHeight(node: UmlClassNode): number {
    if (node.isAnchor) return 0;
    if (node.height && node.height > 0) return node.height;
    const headerH = 34;
    const attrCount = (node.attributes || []).length;
    const methodCount = (node.methods || []).length;
    const attrH = attrCount > 0 ? (attrCount * 22) + 12 : 28;
    const methodH = methodCount > 0 ? (methodCount * 22) + 12 : 28;
    return headerH + attrH + methodH;
  }

  // --- CONECTORES Y ENRUTAMIENTO ---
  getOptimalConnectorId(sourceNode: UmlClassNode, targetNode: UmlClassNode): { sourceId: string; targetId: string } {
    const sWidth = sourceNode.isAnchor ? 0 : (sourceNode.width || 220);
    const sHeight = sourceNode.isAnchor ? 0 : this.getNodeHeight(sourceNode);
    const tWidth = targetNode.isAnchor ? 0 : (targetNode.width || 220);
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
      targetId: targetNode.id + (targetNode.isAnchor ? '' : targetSide)
    };
  }

  getConnectorPoint(node: UmlClassNode, side: string): { x: number; y: number } {
    const w = node.isAnchor ? 0 : (node.width || 220);
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

  updateConnectionEndpoints(): void {
    const nodeMap = new Map(this.nodes().map(n => [n.id, n]));

    // 1. Actualizar posiciones de nodos ancla invisibles en el punto medio
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
          anchorNode.position = {
            x: Math.round((p1.x + p2.x) / 2),
            y: Math.round((p1.y + p2.y) / 2)
          };
        }
      }
    }

    // 2. Actualizar extremos de las conexiones filtrando conexiones huérfanas
    this.connections.update(conns => conns
      .filter(conn => {
        const baseSourceId = conn.sourceNodeId || conn.sourceId.replace(/_(top|bottom|left|right)$/, '');
        const baseTargetId = conn.targetNodeId || conn.targetId.replace(/_(top|bottom|left|right)$/, '');
        return nodeMap.has(baseSourceId) && nodeMap.has(baseTargetId);
      })
      .map(conn => {
        if (conn.type === 'association_class' && conn.sourceNodeId && conn.targetNodeId) {
          const sourceNode = nodeMap.get(conn.sourceNodeId);
          const targetNode = nodeMap.get(conn.targetNodeId);
          if (sourceNode && targetNode && sourceNode.isAnchor) {
            const optimal = this.getOptimalConnectorId(sourceNode, targetNode);
            return {
              ...conn,
              sourceId: sourceNode.id,
              targetId: optimal.targetId
            };
          }
        }

        const baseSourceId = conn.sourceNodeId || conn.sourceId.replace(/_(top|bottom|left|right)$/, '');
        const baseTargetId = conn.targetNodeId || conn.targetId.replace(/_(top|bottom|left|right)$/, '');

        const sourceNode = nodeMap.get(baseSourceId);
        const targetNode = nodeMap.get(baseTargetId);

        if (sourceNode && targetNode && !sourceNode.isAnchor && !targetNode.isAnchor) {
          const optimal = this.getOptimalConnectorId(sourceNode, targetNode);
          return {
            ...conn,
            sourceNodeId: baseSourceId,
            targetNodeId: baseTargetId,
            sourceId: optimal.sourceId,
            targetId: optimal.targetId
          };
        }
        return conn;
      })
    );
  }

  onCanvasBackgroundClick(): void {
    this.selectedSourceNodeId.set(null);
    this.selectedNodeId.set(null);
  }

  // --- SELECCIÓN Y RESALTADO DE TABLAS Y RELACIONES (dbdiagram.io) ---
  onNodeSelect(nodeId: string, event: MouseEvent): void {
    if (this.selectedRelationType() !== null) return;
    event.stopPropagation();
    this.selectedNodeId.update(curr => (curr === nodeId ? null : nodeId));
  }

  isConnectionHighlighted(conn: UmlConnection): boolean {
    const selId = this.selectedNodeId();
    if (!selId) return false;
    const s = conn.sourceNodeId || conn.sourceId?.replace(/_(top|bottom|left|right)$/, '');
    const t = conn.targetNodeId || conn.targetId?.replace(/_(top|bottom|left|right)$/, '');
    return s === selId || t === selId;
  }

  isConnectionDimmed(conn: UmlConnection): boolean {
    const selId = this.selectedNodeId();
    if (!selId) return false;
    const s = conn.sourceNodeId || conn.sourceId?.replace(/_(top|bottom|left|right)$/, '');
    const t = conn.targetNodeId || conn.targetId?.replace(/_(top|bottom|left|right)$/, '');
    return s !== selId && t !== selId;
  }

  isNeighborNode(nodeId: string): boolean {
    const selId = this.selectedNodeId();
    if (!selId || nodeId === selId) return false;
    return this.connections().some(c => {
      const s = c.sourceNodeId || c.sourceId?.replace(/_(top|bottom|left|right)$/, '');
      const t = c.targetNodeId || c.targetId?.replace(/_(top|bottom|left|right)$/, '');
      return (s === selId && t === nodeId) || (t === selId && s === nodeId);
    });
  }

  // --- CREACIÓN DE RELACIONES ---
  onTableClick(nodeId: string, event: MouseEvent): void {
    if (this.isReadOnly() || this.isNodeLockedByOther(nodeId)) return;

    const activeRel = this.selectedRelationType();
    if (!activeRel) return;

    event.stopPropagation();
    const currentSource = this.selectedSourceNodeId();

    if (currentSource === null) {
      this.selectedSourceNodeId.set(nodeId);
      this.onCanvasMouseMove(event);
    } else if (currentSource === nodeId) {
      this.selectedSourceNodeId.set(null);
    } else {
      const nodeMap = new Map(this.nodes().map(n => [n.id, n]));
      const sourceNode = nodeMap.get(currentSource);
      const targetNode = nodeMap.get(nodeId);

      if (!sourceNode || !targetNode) return;

      if (activeRel === 'association_class') {
        this.createAssociationClassBetween(sourceNode, targetNode);
        return;
      }

      const optimal = this.getOptimalConnectorId(sourceNode, targetNode);
      const newConnection: UmlConnection = {
        id: `conn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        sourceNodeId: currentSource,
        targetNodeId: nodeId,
        sourceId: optimal.sourceId,
        targetId: optimal.targetId,
        type: activeRel,
        lineStyle: this.defaultLineStyle(),
        sourceMultiplicity: this.getDefaultMultiplicity(activeRel, 'source'),
        targetMultiplicity: this.getDefaultMultiplicity(activeRel, 'target'),
      };

      this.connections.update(conns => [...conns, newConnection]);
      this.selectedSourceNodeId.set(null);
      this.updateConnectionEndpoints();
      const sName = sourceNode?.name || currentSource;
      const tName = targetNode?.name || nodeId;
      this.logSessionActivity('create_conn', 'Relación Creada', `Relación ${activeRel} entre "${sName}" y "${tName}".`);
      this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'add_connection');
    }
  }

  onConnectionCreated(event: FCreateConnectionEvent): void {
    if (this.isReadOnly() || !event.targetId) return;

    const relType = this.selectedRelationType() || 'association';
    const baseSourceId = event.sourceId.replace(/_(top|bottom|left|right)$/, '');
    const baseTargetId = (event.targetId as string).replace(/_(top|bottom|left|right)$/, '');

    if (this.isNodeLockedByOther(baseSourceId) || this.isNodeLockedByOther(baseTargetId)) {
      alert('🔒 No se pueden crear conexiones hacia/desde una tabla que está siendo editada.');
      return;
    }

    const nodeMap = new Map(this.nodes().map(n => [n.id, n]));
    const sourceNode = nodeMap.get(baseSourceId);
    const targetNode = nodeMap.get(baseTargetId);

    if (relType === 'association_class' && sourceNode && targetNode) {
      this.createAssociationClassBetween(sourceNode, targetNode);
      return;
    }

    let sourceId = event.sourceId;
    let targetId = event.targetId as string;

    if (sourceNode && targetNode) {
      const optimal = this.getOptimalConnectorId(sourceNode, targetNode);
      sourceId = optimal.sourceId;
      targetId = optimal.targetId;
    }

    const newConnection: UmlConnection = {
      id: `conn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sourceNodeId: baseSourceId,
      targetNodeId: baseTargetId,
      sourceId: sourceId,
      targetId: targetId,
      type: relType,
      lineStyle: this.defaultLineStyle(),
      sourceMultiplicity: this.getDefaultMultiplicity(relType, 'source'),
      targetMultiplicity: this.getDefaultMultiplicity(relType, 'target'),
    };

    this.connections.update(conns => [...conns, newConnection]);
    this.selectedSourceNodeId.set(null);
    this.updateConnectionEndpoints();
    const sName = sourceNode?.name || baseSourceId;
    const tName = targetNode?.name || baseTargetId;
    this.logSessionActivity('create_conn', 'Relación Trazada', `Relación ${relType} trazada entre "${sName}" y "${tName}".`);
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'add_connection');
  }

  createAssociationClassBetween(sourceNode: UmlClassNode, targetNode: UmlClassNode): void {
    if (this.isReadOnly()) return;

    const timestamp = Date.now();
    const assocClassId = `node_assoc_${timestamp}`;
    const anchorNodeId = `anchor_${timestamp}`;
    const mainConnId = `conn_main_${timestamp}`;

    const assocNode: UmlClassNode = {
      id: assocClassId,
      name: `${sourceNode.name}_${targetNode.name}`,
      position: {
        x: Math.round((sourceNode.position.x + targetNode.position.x) / 2),
        y: Math.max(sourceNode.position.y, targetNode.position.y) + 160,
      },
      width: 220,
      attributes: [
        { name: 'id', type: 'UUID' },
        { name: 'fecha_registro', type: 'LocalDateTime' },
      ],
      methods: [],
      isAnchor: false,
      assocMainConnId: mainConnId,
    };

    const anchorNode: UmlClassNode = {
      id: anchorNodeId,
      name: '',
      position: {
        x: Math.round((sourceNode.position.x + targetNode.position.x) / 2 + 100),
        y: Math.round((sourceNode.position.y + targetNode.position.y) / 2 + 50),
      },
      width: 8,
      height: 8,
      attributes: [],
      methods: [],
      isAnchor: true,
      assocMainConnId: mainConnId,
    };

    const mainConn: UmlConnection = {
      id: mainConnId,
      sourceNodeId: sourceNode.id,
      targetNodeId: targetNode.id,
      sourceId: `${sourceNode.id}_right`,
      targetId: `${targetNode.id}_left`,
      type: 'association',
      lineStyle: 'segment',
      sourceMultiplicity: '0..*',
      targetMultiplicity: '0..*',
      assocAnchorNodeId: anchorNodeId,
    };

    const assocConn: UmlConnection = {
      id: `conn_assoc_${timestamp}`,
      sourceNodeId: anchorNodeId,
      targetNodeId: assocClassId,
      sourceId: anchorNodeId,
      targetId: `${assocClassId}_top`,
      type: 'association_class',
      lineStyle: 'straight',
      sourceMultiplicity: '',
      targetMultiplicity: '',
    };

    this.nodes.update(list => [...list, assocNode, anchorNode]);
    this.connections.update(conns => [...conns, mainConn, assocConn]);
    this.selectedSourceNodeId.set(null);
    this.updateConnectionEndpoints();
    this.logSessionActivity('create_node', 'Clase de Asociación Creada', `Se creó la clase intermedia "${assocNode.name}" vinculada a "${sourceNode.name}" y "${targetNode.name}".`);
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'create_association_class');
  }

  private getDefaultMultiplicity(type: UmlRelationshipType, side: 'source' | 'target'): string {
    switch (type) {
      case 'composition':
        return side === 'source' ? '1' : '1..*';
      case 'aggregation':
        return side === 'source' ? '1' : '0..*';
      case 'generalization':
      case 'realization':
        return '';
      default:
        return side === 'source' ? '1' : '0..*';
    }
  }

  // --- GESTIÓN DE CLASES ---
  addClass(): void {
    if (this.isReadOnly()) return;

    const currentCount = this.nodes().filter(n => !n.isAnchor).length + 1;
    const offset = (this.nodes().length * 35) % 250;
    const newNode: UmlClassNode = {
      id: `node_${Date.now()}`,
      name: `Class${currentCount}`,
      position: { x: 180 + offset, y: 140 + offset },
      width: 220,
      attributes: [
        { name: 'id', type: 'UUID' },
        { name: 'nombre', type: 'String' },
      ],
      methods: [
        { name: 'getId', parameters: '', returnType: 'UUID' },
      ],
    };

    this.nodes.update(list => [...list, newNode]);
    this.updateConnectionEndpoints();
    this.logSessionActivity('create_node', 'Clase Creada', `Se creó la clase "${newNode.name}" con atributos iniciales.`);
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'add_class');
  }

  removeClass(nodeId: string, event?: MouseEvent): void {
    if (this.isReadOnly()) return;
    if (event) event.stopPropagation();

    const targetNode = this.nodes().find(n => n.id === nodeId);
    const nodeName = targetNode?.name || nodeId;

    if (this.isNodeLockedByOther(nodeId)) {
      const lock = this.getNodeLock(nodeId);
      alert(`🔒 No puedes eliminar la tabla "${nodeName}" mientras ${lock?.userName || 'otro usuario'} la está editando.`);
      return;
    }

    const nodesToRemove = new Set<string>([nodeId]);

    for (const conn of this.connections()) {
      if (conn.sourceNodeId === nodeId || conn.targetNodeId === nodeId) {
        if (conn.assocAnchorNodeId) {
          nodesToRemove.add(conn.assocAnchorNodeId);
        }
      }
    }

    this.nodes.update(nodes => nodes.filter(n => !nodesToRemove.has(n.id)));
    this.connections.update(conns => 
      conns.filter(c => 
        !nodesToRemove.has(c.sourceNodeId || '') && 
        !nodesToRemove.has(c.targetNodeId || '') && 
        !nodesToRemove.has(c.sourceId.replace(/_(top|bottom|left|right)$/, '')) && 
        !nodesToRemove.has(c.targetId.replace(/_(top|bottom|left|right)$/, ''))
      )
    );
    if (this.selectedSourceNodeId() === nodeId) {
      this.selectedSourceNodeId.set(null);
    }
    this.logSessionActivity('delete_node', 'Clase Eliminada', `Se eliminó la clase "${nodeName}" y sus relaciones.`);
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'remove_class');
  }

  // --- MODAL DE EDICIÓN DE CLASE (DOBLE CLIC CON EXCLUSIÓN MUTUA) ---
  openEditNodeModal(node: UmlClassNode, event?: MouseEvent): void {
    if (this.isReadOnly() || node.isAnchor) return;
    if (event) event.stopPropagation();

    if (this.isNodeLockedByOther(node.id)) {
      const lock = this.getNodeLock(node.id);
      alert(`🔒 La tabla "${node.name}" está siendo editada actualmente por ${lock?.userName || 'otro usuario'}. Por favor espera a que termine de guardar.`);
      return;
    }

    // Abrir el modal inmediatamente y emitir el bloqueo a los colaboradores
    this.editingNode.set(JSON.parse(JSON.stringify(node)));
    this.isEditNodeModalOpen.set(true);
    this.collaborationService.requestNodeLock(node.id);
  }

  closeEditNodeModal(): void {
    const node = this.editingNode();
    if (node) {
      this.collaborationService.releaseNodeLock(node.id);
    }
    this.isEditNodeModalOpen.set(false);
    this.editingNode.set(null);
  }

  saveEditedNode(): void {
    if (this.isReadOnly()) return;
    const edited = this.editingNode();
    if (!edited) return;

    this.nodes.update(nodes =>
      nodes.map(n => (n.id === edited.id ? edited : n))
    );
    this.updateConnectionEndpoints();
    this.collaborationService.releaseNodeLock(edited.id);
    this.isEditNodeModalOpen.set(false);
    this.editingNode.set(null);
    this.logSessionActivity('update_node', 'Clase Modificada', `Se actualizaron las propiedades y atributos de "${edited.name}".`);
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'edit_node');
  }

  addAttributeToEditingNode(): void {
    const node = this.editingNode();
    if (!node) return;
    node.attributes.push({ name: `attr${node.attributes.length + 1}`, type: 'String' });
    this.editingNode.set({ ...node });
  }

  removeAttributeFromEditingNode(index: number): void {
    const node = this.editingNode();
    if (!node) return;
    node.attributes.splice(index, 1);
    this.editingNode.set({ ...node });
  }

  addMethodToEditingNode(): void {
    const node = this.editingNode();
    if (!node) return;
    node.methods.push({ name: `operacion${node.methods.length + 1}`, parameters: '', returnType: 'void' });
    this.editingNode.set({ ...node });
  }

  removeMethodFromEditingNode(index: number): void {
    const node = this.editingNode();
    if (!node) return;
    node.methods.splice(index, 1);
    this.editingNode.set({ ...node });
  }

  // --- MODAL DE EDICIÓN DE CONEXIÓN (DOBLE CLIC) ---
  openEditConnModal(conn: UmlConnection, event?: MouseEvent): void {
    if (this.isReadOnly()) return;
    if (event) event.stopPropagation();

    this.editingConnection.set(JSON.parse(JSON.stringify(conn)));
    this.isEditConnModalOpen.set(true);
  }

  closeEditConnModal(): void {
    this.isEditConnModalOpen.set(false);
    this.editingConnection.set(null);
  }

  saveEditedConnection(): void {
    if (this.isReadOnly()) return;
    const edited = this.editingConnection();
    if (!edited) return;

    this.connections.update(conns =>
      conns.map(c => (c.id === edited.id ? edited : c))
    );
    this.updateConnectionEndpoints();
    this.closeEditConnModal();
    this.logSessionActivity('update_conn', 'Relación Modificada', `Se actualizaron las propiedades de la relación (${edited.type}).`);
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'edit_connection');
  }

  removeConnection(connId: string, event?: MouseEvent): void {
    if (this.isReadOnly()) return;
    if (event) event.stopPropagation();

    this.connections.update(conns => conns.filter(c => c.id !== connId));
    this.logSessionActivity('delete_conn', 'Relación Eliminada', 'Se eliminó una relación del diagrama.');
    this.collaborationService.sendDiagramSync(this.nodes(), this.connections(), 'remove_connection');
  }

  // --- ZOOM Y VISTA ---
  zoomIn(): void {
    if (this.fZoom) {
      this.fZoom.zoomIn();
      this.zoomLevel.set(Math.round((this.fZoom.getZoomValue() || 1) * 100));
    } else if (this.canvas) {
      const currentScale = this.canvas.getScale() || 1;
      const nextScale = Math.min(4, currentScale * 1.2);
      this.canvas.setScale(nextScale);
      this.canvas.redrawWithAnimation();
      this.zoomLevel.set(Math.round(nextScale * 100));
    }
  }

  zoomOut(): void {
    if (this.fZoom) {
      this.fZoom.zoomOut();
      this.zoomLevel.set(Math.round((this.fZoom.getZoomValue() || 1) * 100));
    } else if (this.canvas) {
      const currentScale = this.canvas.getScale() || 1;
      const nextScale = Math.max(0.1, currentScale * 0.8);
      this.canvas.setScale(nextScale);
      this.canvas.redrawWithAnimation();
      this.zoomLevel.set(Math.round(nextScale * 100));
    }
  }

  resetView(): void {
    if (this.canvas) {
      this.canvas.resetScaleAndCenter();
      this.zoomLevel.set(100);
    } else if (this.fZoom) {
      this.fZoom.reset();
      this.zoomLevel.set(100);
    }
  }

  fitView(): void {
    if (this.canvas) {
      this.canvas.fitToScreen({ x: 40, y: 40 });
      this.zoomLevel.set(Math.round((this.canvas.getScale() || 1) * 100));
    }
  }

  onCanvasChange(event: FCanvasChangeEvent): void {
    if (event && event.scale) {
      this.zoomLevel.set(Math.round(event.scale * 100));
    }
  }

  // --- ASISTENTE IA (COPILOT VERTEX AI GEMINI 2.5 FLASH) ---
  initVoiceRecognition(): void {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.speechRecognitionInstance = new SpeechRecognition();
      this.speechRecognitionInstance.continuous = false;
      this.speechRecognitionInstance.lang = 'es-ES';
      this.speechRecognitionInstance.interimResults = false;

      this.speechRecognitionInstance.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        const current = this.aiPrompt();
        this.aiPrompt.set(current ? `${current} ${transcript}` : transcript);
        this.isVoiceListening.set(false);
      };

      this.speechRecognitionInstance.onerror = () => {
        this.isVoiceListening.set(false);
      };

      this.speechRecognitionInstance.onend = () => {
        this.isVoiceListening.set(false);
      };
    }
  }

  toggleVoiceRecognition(): void {
    if (this.isReadOnly()) return;
    if (!this.speechRecognitionInstance) {
      this.initVoiceRecognition();
    }
    if (!this.speechRecognitionInstance) {
      alert('Tu navegador no soporta reconocimiento de voz nativo (Web Speech API). Puedes escribir el comando en el cuadro de texto.');
      return;
    }

    if (this.isVoiceListening()) {
      this.speechRecognitionInstance.stop();
      this.isVoiceListening.set(false);
    } else {
      this.speechRecognitionInstance.start();
      this.isVoiceListening.set(true);
    }
  }

  triggerImageInput(): void {
    if (this.isReadOnly()) return;
    this.imageInput?.nativeElement.click();
  }

  onImageSelected(event: Event): void {
    if (this.isReadOnly()) return;
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    this.processImageFile(file);
    target.value = '';
  }

  private processImageFile(file: File | Blob, customName?: string): void {
    const fileName = customName || (file instanceof File ? file.name : `Captura_${new Date().toLocaleTimeString().replace(/:/g, '-')}.png`);
    this.attachedImageName.set(fileName);
    this.attachedImageMimeType.set(file.type || 'image/png');

    const reader = new FileReader();
    reader.onload = (e) => {
      this.attachedImageBase64.set(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  onPasteImage(event: ClipboardEvent): void {
    if (this.isReadOnly()) return;
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          event.preventDefault();
          this.processImageFile(file, `Captura_Portapapeles_${new Date().toLocaleTimeString().replace(/:/g, '-')}.png`);
          return;
        }
      }
    }
  }

  onDropImage(event: DragEvent): void {
    if (this.isReadOnly()) return;
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      this.processImageFile(file);
    }
  }

  async pasteFromClipboard(): Promise<void> {
    if (this.isReadOnly()) return;
    try {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        alert('Puedes presionar Ctrl + V dentro del cuadro de texto del chat para pegar tu captura de pantalla.');
        return;
      }
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find(type => type.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          this.processImageFile(blob, `Captura_Portapapeles_${new Date().toLocaleTimeString().replace(/:/g, '-')}.png`);
          return;
        }
      }
      alert('No se detectó ninguna imagen en el portapapeles. Copia una captura primero con Win + Shift + S o imprPant / Ctrl + C y vuelve a presionar este botón o usa Ctrl + V.');
    } catch (err) {
      alert('Puedes presionar directamente Ctrl + V dentro del cuadro de texto del chat para pegar tu captura de pantalla.');
    }
  }

  async openWebcamModal(): Promise<void> {
    if (this.isReadOnly()) return;
    try {
      this.showWebcamModal.set(true);
      setTimeout(async () => {
        try {
          this.webcamMediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
          });
          if (this.webcamVideoRef?.nativeElement) {
            this.webcamVideoRef.nativeElement.srcObject = this.webcamMediaStream;
          }
        } catch (err) {
          alert('No se pudo acceder a la cámara del dispositivo: ' + err);
          this.closeWebcamModal();
        }
      }, 100);
    } catch (e) {
      alert('Error accediendo a la cámara: ' + e);
    }
  }

  captureWebcamPhoto(): void {
    if (!this.webcamVideoRef?.nativeElement) return;
    const video = this.webcamVideoRef.nativeElement;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      this.attachedImageBase64.set(dataUrl);
      this.attachedImageName.set(`Foto_Camara_${new Date().toLocaleTimeString().replace(/:/g, '-')}.png`);
      this.attachedImageMimeType.set('image/png');
    }
    this.closeWebcamModal();
  }

  closeWebcamModal(): void {
    if (this.webcamMediaStream) {
      this.webcamMediaStream.getTracks().forEach(track => track.stop());
      this.webcamMediaStream = null;
    }
    this.showWebcamModal.set(false);
  }

  removeAttachedImage(): void {
    this.attachedImageBase64.set(null);
    this.attachedImageName.set(null);
  }

  logSessionActivity(
    type: SessionActivityEvent['type'],
    title: string,
    description: string,
    actor: string = 'Usuario',
    metadata?: Record<string, any>
  ): void {
    const icons: Record<SessionActivityEvent['type'], string> = {
      ai_mutation: 'heroSparkles',
      ai_chat: 'heroChatBubbleLeftRight',
      create_node: 'heroPlusCircle',
      update_node: 'heroPencilSquare',
      delete_node: 'heroTrash',
      create_conn: 'heroLink',
      update_conn: 'heroPencil',
      delete_conn: 'heroTrash',
      import_file: 'heroArrowUpTray',
      export_file: 'heroArrowDownTray',
    };

    const badgeColors: Record<SessionActivityEvent['type'], string> = {
      ai_mutation: 'bg-purple-100 text-purple-800 border-purple-300',
      ai_chat: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      create_node: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      update_node: 'bg-amber-100 text-amber-800 border-amber-300',
      delete_node: 'bg-rose-100 text-rose-800 border-rose-300',
      create_conn: 'bg-sky-100 text-sky-800 border-sky-300',
      update_conn: 'bg-blue-100 text-blue-800 border-blue-300',
      delete_conn: 'bg-red-100 text-red-800 border-red-300',
      import_file: 'bg-teal-100 text-teal-800 border-teal-300',
      export_file: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    };

    const event: SessionActivityEvent = {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date(),
      type,
      title,
      description,
      actor,
      icon: icons[type] || 'heroClock',
      badgeClass: badgeColors[type] || 'bg-slate-100 text-slate-800 border-slate-300',
      metadata,
    };

    this.sessionHistory.update(list => [event, ...list]);
  }

  copySessionHistory(): void {
    const lines = this.sessionHistory().map(h => 
      `[${h.timestamp.toLocaleTimeString()}] ${h.actor}: ${h.title} - ${h.description}`
    );
    navigator.clipboard.writeText(lines.join('\n'));
    alert('Historial de la sesión copiado al portapapeles.');
  }

  askAiAboutSession(): void {
    this.activeAiTab.set('chat');
    this.aiPrompt.set('¿Puedes resumir y analizar todas las acciones y el modelo que hemos construido en esta sesión?');
    this.applyAiPrompt();
  }

  scrollToChatBottom(): void {
    setTimeout(() => {
      if (this.chatScrollContainerRef?.nativeElement) {
        this.chatScrollContainerRef.nativeElement.scrollTop = this.chatScrollContainerRef.nativeElement.scrollHeight;
      }
    }, 60);
  }

  onAiInputKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.applyAiPrompt();
    }
  }

  applyAiPrompt(): void {
    if (this.isReadOnly()) return;
    const promptText = this.aiPrompt().trim();
    const imageBase64 = this.attachedImageBase64();
    const diagramId = this.currentDiagramId() || 'default-diagram';
    const roomCode = this.collaborationService.activeRoomCode() || undefined;

    if (!promptText && !imageBase64) return;

    // Agregar mensaje del usuario a la conversación del chat
    const userMsgId = `usr_${Date.now()}`;
    this.aiChatMessages.update(list => [
      ...list,
      {
        id: userMsgId,
        sender: 'user',
        text: promptText || 'Digitalización de imagen de diagrama UML',
        imagePreview: imageBase64 || undefined,
        timestamp: new Date(),
      }
    ]);

    // Limpiar de inmediato la bandeja de entrada de texto e imagen como en los chats
    this.aiPrompt.set('');
    const sentImageBase64 = imageBase64;
    const sentImageMime = this.attachedImageMimeType();
    this.removeAttachedImage();
    this.isAiProcessing.set(true);
    this.scrollToChatBottom();

    if (sentImageBase64) {
      this.aiAssistantService.sendVisionPrompt(
        sentImageBase64,
        sentImageMime,
        promptText || undefined,
        diagramId,
        roomCode,
        this.nodes(),
        this.connections(),
        this.sessionHistory(),
      ).subscribe({
        next: (res) => {
          this.isAiProcessing.set(false);
          if (res.success && res.nodes) {
            this.applyAiMutationWithAnimation(res.nodes, res.connections || []);

            this.logSessionActivity('ai_mutation', 'Mutación por Copilot IA (Visión)', res.changesSummary || res.message, '✨ Copilot IA');

            this.aiChatMessages.update(list => [
              ...list,
              {
                id: `ai_${Date.now()}`,
                sender: 'assistant',
                text: res.message,
                changesSummary: res.changesSummary,
                timestamp: new Date(),
                status: 'success',
              }
            ]);
          } else {
            this.aiChatMessages.update(list => [
              ...list,
              {
                id: `ai_${Date.now()}`,
                sender: 'assistant',
                text: res.message,
                timestamp: new Date(),
                status: 'clarification',
              }
            ]);
          }
          this.scrollToChatBottom();
        },
        error: (err) => {
          this.isAiProcessing.set(false);
          this.aiChatMessages.update(list => [
            ...list,
            {
              id: `ai_${Date.now()}`,
              sender: 'assistant',
              text: 'Error al procesar la imagen: ' + (err.error?.message || err.message),
              timestamp: new Date(),
              status: 'error',
            }
          ]);
          this.scrollToChatBottom();
        }
      });
    } else {
      this.aiAssistantService.sendTextPrompt(
        promptText,
        diagramId,
        roomCode,
        this.nodes(),
        this.connections(),
        this.sessionHistory(),
      ).subscribe({
        next: (res) => {
          this.isAiProcessing.set(false);
          if (res.success && res.nodes) {
            this.applyAiMutationWithAnimation(res.nodes, res.connections || []);

            this.logSessionActivity('ai_mutation', 'Mutación por Copilot IA', res.changesSummary || res.message, '✨ Copilot IA');

            this.aiChatMessages.update(list => [
              ...list,
              {
                id: `ai_${Date.now()}`,
                sender: 'assistant',
                text: res.message,
                changesSummary: res.changesSummary,
                timestamp: new Date(),
                status: 'success',
              }
            ]);
          } else {
            // Guardrail: Aclaración requerida
            this.aiChatMessages.update(list => [
              ...list,
              {
                id: `ai_${Date.now()}`,
                sender: 'assistant',
                text: res.message,
                timestamp: new Date(),
                status: 'clarification',
              }
            ]);
          }
          this.scrollToChatBottom();
        },
        error: (err) => {
          this.isAiProcessing.set(false);
          this.aiChatMessages.update(list => [
            ...list,
            {
              id: `ai_${Date.now()}`,
              sender: 'assistant',
              text: 'Error en Copilot IA: ' + (err.error?.message || err.message),
              timestamp: new Date(),
              status: 'error',
            }
          ]);
          this.scrollToChatBottom();
        }
      });
    }
  }

  private animationTimers: any[] = [];

  private applyAiMutationWithAnimation(
    rawNodes: any[],
    rawConnections: any[],
    onComplete?: () => void,
  ): void {
    // 1. Limpiar timers de animación previos si hubiera alguno en curso
    this.animationTimers.forEach(t => clearTimeout(t));
    this.animationTimers = [];

    const finalNodes = this.applyAiNodesMutation(rawNodes);
    const finalConnections = this.sanitizeClientConnections(rawConnections || [], finalNodes);

    const currentNodes = this.nodes();
    const currentConns = this.connections();

    const currentNodeIds = new Set(currentNodes.map(n => n.id));
    const currentConnIds = new Set(currentConns.map(c => c.id));

    // Nodos nuevos que no existían antes
    const newNodes = finalNodes.filter(n => !currentNodeIds.has(n.id));
    // Conexiones nuevas que no existían antes
    const newConnections = finalConnections.filter(c => !currentConnIds.has(c.id));

    // Si no hay nuevos elementos añadidos (ej: eliminación o edición in-place):
    if (newNodes.length === 0 && newConnections.length === 0) {
      this.nodes.set(finalNodes);
      this.connections.set(finalConnections);
      this.updateConnectionEndpoints();
      setTimeout(() => this.updateConnectionEndpoints(), 60);
      onComplete?.();
      return;
    }

    // 2. Establecer primero los nodos base existentes (conservando modificaciones o remociones)
    const baseNodes = finalNodes.filter(n => currentNodeIds.has(n.id));
    const baseConns = finalConnections.filter(c => currentConnIds.has(c.id));

    this.nodes.set(baseNodes);
    this.connections.set(baseConns);
    this.updateConnectionEndpoints();

    let delay = 60;
    const nodeInterval = 280; // ms entre cada tabla insertada
    const connInterval = 220; // ms entre cada relación trazada

    // 3. Insertar secuencialmente las nuevas tablas una por una con animación fluida
    newNodes.forEach((node) => {
      const timer = setTimeout(() => {
        this.nodes.update(list => [...list, node]);
        this.updateConnectionEndpoints();
      }, delay);
      this.animationTimers.push(timer);
      delay += nodeInterval;
    });

    // 4. Una vez insertadas las tablas, trazar secuencialmente las nuevas relaciones una por una
    newConnections.forEach((conn) => {
      const timer = setTimeout(() => {
        this.connections.update(list => [...list, conn]);
        this.updateConnectionEndpoints();
        setTimeout(() => this.updateConnectionEndpoints(), 40);
      }, delay);
      this.animationTimers.push(timer);
      delay += connInterval;
    });

    // 5. Finalización
    const finalTimer = setTimeout(() => {
      this.updateConnectionEndpoints();
      setTimeout(() => this.updateConnectionEndpoints(), 80);
      onComplete?.();
    }, delay + 60);
    this.animationTimers.push(finalTimer);
  }

  private applyAiNodesMutation(nodes: any[]): UmlClassNode[] {
    const cleanNodes = this.sanitizeClientNodes(nodes);
    const currentNodes = this.nodes();
    const currentMap = new Map(currentNodes.map(n => [n.id, n]));

    const result: UmlClassNode[] = [];
    for (const incNode of cleanNodes) {
      const existing = currentMap.get(incNode.id);
      if (existing) {
        // Preservar la misma referencia del objeto para evitar destrucción/recreación destructiva en el DOM
        existing.name = incNode.name;
        existing.position = incNode.position;
        existing.width = incNode.width;
        existing.height = incNode.height;
        existing.isAnchor = incNode.isAnchor;
        existing.assocMainConnId = incNode.assocMainConnId;
        existing.attributes = incNode.attributes;
        existing.methods = incNode.methods;
        result.push(existing);
      } else {
        result.push(incNode);
      }
    }

    return result;
  }

  private sanitizeClientNodes(nodes: any[]): UmlClassNode[] {
    if (!Array.isArray(nodes)) return [];
    return nodes
      .filter(n => !!n)
      .map((n, i) => ({
        id: (n.id && typeof n.id === 'string' && n.id.trim()) ? n.id.trim() : `node_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
        name: n.name || `Clase${i + 1}`,
        position: n.position || { x: 120 + (i * 260) % 780, y: 80 + Math.floor((i * 260) / 780) * 220 },
        width: n.width || 220,
        height: n.height || undefined,
        isAnchor: !!n.isAnchor,
        assocAnchorNodeId: n.assocAnchorNodeId || undefined,
        assocMainConnId: n.assocMainConnId || undefined,
        attributes: Array.isArray(n.attributes) ? n.attributes.map((a: any) => ({
          name: a.name || 'attr',
          type: this.normalizeDataType(a.type || 'String'),
        })) : [],
        methods: Array.isArray(n.methods) ? n.methods.map((m: any) => ({
          name: m.name || 'operation',
          parameters: m.parameters || '',
          returnType: this.normalizeReturnType(m.returnType || 'void'),
        })) : [],
      }));
  }

  private sanitizeClientConnections(conns: any[], nodes: UmlClassNode[]): UmlConnection[] {
    if (!Array.isArray(conns)) return [];
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    return conns
      .filter(c => !!c && c.id)
      .map(c => {
        const sourceNodeId = c.sourceNodeId || c.sourceId?.replace(/_(top|bottom|left|right)$/, '');
        const targetNodeId = c.targetNodeId || c.targetId?.replace(/_(top|bottom|left|right)$/, '');
        return {
          id: c.id,
          sourceNodeId,
          targetNodeId,
          sourceId: c.sourceId || `${sourceNodeId}_right`,
          targetId: c.targetId || `${targetNodeId}_left`,
          type: c.type || 'association',
          lineStyle: c.lineStyle || 'segment',
          name: c.name || undefined,
          sourceMultiplicity: c.sourceMultiplicity || '',
          targetMultiplicity: c.targetMultiplicity || '',
          assocAnchorNodeId: c.assocAnchorNodeId || undefined,
        };
      })
      .filter(c => nodeMap.has(c.sourceNodeId || '') && nodeMap.has(c.targetNodeId || ''));
  }

  setAiSuggestion(text: string): void {
    if (this.isReadOnly()) return;
    this.aiPrompt.set(text);
  }

  // --- EXPORTAR / IMPORTAR / SPRING BOOT ---
  openExportModal(): void {
    const project: UmlDiagramProject = {
      version: '1.0.0',
      name: this.currentDiagramName(),
      createdDate: new Date().toISOString(),
      defaultLineStyle: this.defaultLineStyle(),
      nodes: this.nodes(),
      connections: this.connections()
    };
    this.jsonContent.set(JSON.stringify(project, null, 2));
    this.jsonModalMode.set('export');
    this.showJsonModal.set(true);
    this.isExportDropdownOpen.set(false);
  }

  openImportModal(): void {
    if (this.isReadOnly()) return;
    this.jsonContent.set('');
    this.jsonModalMode.set('import');
    this.showJsonModal.set(true);
    this.isExportDropdownOpen.set(false);
    this.isImportDropdownOpen.set(false);
  }

  downloadJsonFile(): void {
    const project: UmlDiagramProject = {
      version: '1.0.0',
      name: this.currentDiagramName(),
      createdDate: new Date().toISOString(),
      defaultLineStyle: this.defaultLineStyle(),
      nodes: this.nodes(),
      connections: this.connections()
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(project, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${this.currentDiagramName().toLowerCase().replace(/\s+/g, '_')}_ast.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    this.isExportDropdownOpen.set(false);
    this.logSessionActivity('export_file', 'Exportación JSON', `Se descargó el AST JSON del diagrama (${this.nodes().length} clases).`);
  }

  downloadXmiFile(): void {
    this.xmiService.exportAst({
      diagramName: this.currentDiagramName(),
      nodes: this.nodes(),
      connections: this.connections(),
      defaultLineStyle: this.defaultLineStyle(),
    }).subscribe({
      next: (res) => {
        const blob = new Blob([res.xmiContent], { type: 'application/xml;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute('href', url);
        downloadAnchor.setAttribute('download', res.filename || `${this.currentDiagramName().toLowerCase().replace(/\s+/g, '_')}_ea.xmi`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        window.URL.revokeObjectURL(url);
        this.isExportDropdownOpen.set(false);
        this.logSessionActivity('export_file', 'Exportación XMI', `Se exportó el diagrama compatible con Enterprise Architect v17 (${this.nodes().length} clases).`);
      },
      error: (err) => {
        console.error('Error al exportar XMI:', err);
        alert('Error al generar archivo XMI: ' + (err.error?.message || err.message));
        this.isExportDropdownOpen.set(false);
      }
    });
  }

  triggerFileInput(): void {
    if (this.isReadOnly()) return;
    this.fileInput?.nativeElement.click();
    this.isExportDropdownOpen.set(false);
    this.isImportDropdownOpen.set(false);
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
          // Importar XMI / XML desde Enterprise Architect
          try {
            const ast = XmiClientParser.parse(content);
            if (ast.nodes && ast.nodes.length > 0) {
              this.nodes.set(ast.nodes.map((n: any) => ({
                ...n,
                width: n.width || 220,
                attributes: (n.attributes || []).map((a: any) => ({
                  name: a.name,
                  type: this.normalizeDataType(a.type),
                  visibility: a.visibility || 'private',
                  isPk: a.isPk || false,
                  isNullable: a.isNullable || false
                })),
                methods: (n.methods || []).map((m: any) => ({
                  name: m.name,
                  parameters: m.parameters || '',
                  returnType: this.normalizeReturnType(m.returnType),
                  visibility: m.visibility || 'public'
                }))
              })));
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
              this.logSessionActivity('import_file', 'Importación XMI Exitosa', `Se importaron ${ast.nodes.length} clases y ${(ast.connections || []).length} relaciones desde ${file.name}.`);

              const diagId = this.currentDiagramId();
              if (diagId) {
                this.diagramService.saveAst(diagId, {
                  defaultLineStyle: this.defaultLineStyle(),
                  nodes: this.nodes().map(n => ({
                    id: n.id,
                    name: n.name,
                    positionX: n.position.x,
                    positionY: n.position.y,
                    width: n.width,
                    height: n.height,
                    isAnchor: n.isAnchor,
                    attributes: n.attributes.map((a, i) => ({ name: a.name, type: a.type, orderIndex: i })),
                    methods: n.methods.map((m, i) => ({ name: m.name, parameters: m.parameters, returnType: m.returnType, orderIndex: i })),
                  })),
                  connections: this.connections().map(c => ({
                    id: c.id,
                    sourceNodeId: c.sourceNodeId || c.sourceId.replace(/_(top|bottom|left|right)$/, ''),
                    targetNodeId: c.targetNodeId || c.targetId.replace(/_(top|bottom|left|right)$/, ''),
                    sourceId: c.sourceId,
                    targetId: c.targetId,
                    type: c.type,
                    name: c.name,
                    sourceMultiplicity: c.sourceMultiplicity,
                    targetMultiplicity: c.targetMultiplicity,
                    lineStyle: c.lineStyle,
                  })),
                }).subscribe();
              }
            } else {
              alert('El archivo XMI no contiene clases UML legibles.');
            }
          } catch (err: any) {
            console.error('Error al parsear XMI:', err);
            alert('Error al leer el archivo XMI: ' + (err.message || err));
          } finally {
            target.value = '';
          }
        } else {
          // Importar JSON
          const project = JSON.parse(content) as UmlDiagramProject;
          if (project.nodes && project.connections) {
            this.nodes.set(project.nodes.map(n => ({
              ...n,
              width: n.width || 220,
              attributes: (n.attributes || []).map(a => ({
                name: a.name,
                type: this.normalizeDataType(a.type)
              })),
              methods: (n.methods || []).map(m => ({
                name: m.name,
                parameters: m.parameters,
                returnType: this.normalizeReturnType(m.returnType)
              }))
            })));
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
            alert('El archivo JSON no contiene un diagrama de clases válido.');
          }
        }
      } catch (err) {
        alert('Error al leer el archivo: ' + err);
      } finally {
        target.value = '';
      }
      target.value = '';
    };
    reader.readAsText(file);
  }

  applyImportedJson(): void {
    if (this.isReadOnly()) return;
    try {
      const project = JSON.parse(this.jsonContent()) as UmlDiagramProject;
      if (project.nodes && project.connections) {
        this.nodes.set(project.nodes.map(n => ({
          ...n,
          width: n.width || 220,
          attributes: (n.attributes || []).map(a => ({
            name: a.name,
            type: this.normalizeDataType(a.type)
          })),
          methods: (n.methods || []).map(m => ({
            name: m.name,
            parameters: m.parameters,
            returnType: this.normalizeReturnType(m.returnType)
          }))
        })));
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

  copyRoomCode(): void {
    const code = this.collaborationService.activeRoomCode();
    if (code) {
      navigator.clipboard.writeText(code).then(() => {
        alert(`Código de sala "${code}" copiado al portapapeles.`);
      });
    }
  }

  triggerSpringBootGeneration(): void {
    this.showSpringBootModal.set(false);
    alert('El motor de generación de código Spring Boot se integrará en el siguiente módulo (code-generator).');
  }

  clearDiagram(): void {
    if (this.isReadOnly()) return;
    if (confirm('¿Estás seguro de que deseas limpiar el diagrama?')) {
      this.nodes.set([]);
      this.connections.set([]);
      this.selectedSourceNodeId.set(null);
      this.collaborationService.sendDiagramSync([], [], 'clear');
    }
  }

  openProfileModal(): void {
    this.isProfileModalOpen.set(true);
    this.refreshProfile();
  }

  refreshProfile(): void {
    this.isRefreshingProfile.set(true);
    this.authService.fetchProfile().subscribe({
      next: () => {
        this.isRefreshingProfile.set(false);
      },
      error: () => {
        this.isRefreshingProfile.set(false);
      }
    });
  }
}
