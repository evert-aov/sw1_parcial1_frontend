import { Component, signal, ViewChild, ElementRef, OnInit, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { FFlowModule, FCreateConnectionEvent, FCanvasComponent } from '@foblex/flow';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { AuthService } from '../../../core/services/auth.service';
import { DiagramService } from '../../../core/services/diagram.service';
import {
  UmlRelationshipType,
  UmlLineStyle,
  UmlAttribute,
  UmlMethod,
  UmlClassNode,
  UmlConnection,
  SaveDiagramAstRequest,
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
  heroCloudArrowUp
} from '@ng-icons/heroicons/outline';

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
    })
  ],
  templateUrl: './diagram-editor.component.html',
  styleUrl: './diagram-editor.component.css',
})
export class DiagramEditorComponent implements OnInit {
  readonly authService = inject(AuthService);
  readonly diagramService = inject(DiagramService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  @ViewChild(FCanvasComponent) canvas?: FCanvasComponent;
  @ViewChild('flowContainer') flowContainerRef?: ElementRef<HTMLElement>;
  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  // Contexto del diagrama y proyecto
  currentDiagramId = signal<string | null>(null);
  currentProjectId = signal<string | null>(null);
  currentDiagramName = signal<string>('Diagrama UML');
  saveSuccessMessage = signal<boolean>(false);

  // Por defecto: Modo Seleccionar / Mover
  selectedRelationType = signal<UmlRelationshipType | null>(null);

  // Estilo de línea por defecto para nuevas conexiones
  defaultLineStyle = signal<UmlLineStyle>('segment');

  // Nodo origen seleccionado en el flujo clic-a-clic
  selectedSourceNodeId = signal<string | null>(null);

  // Posición del cursor en coordenadas del lienzo
  mouseCanvasPos = signal<{ x: number; y: number }>({ x: 0, y: 0 });

  // Opciones de multiplicidad estándar
  readonly multiplicityOptions: string[] = ['1', '0..1', '1..*', '0..*', '*', 'n', 'm'];

  // Tipos de datos predefinidos
  readonly predefinedTypes: string[] = [
    'uuid',
    'String',
    'int',
    'Integer',
    'Long',
    'Boolean',
    'Float',
    'Double',
    'BigDecimal',
    'Date',
    'DateTime',
    'Timestamp',
    'byte[]',
    'Object',
    'void',
    'List<String>',
    'List<uuid>',
    'List<Object>'
  ];

  // Tipos de retorno para métodos
  readonly predefinedReturnTypes: string[] = [
    'void',
    'String',
    'uuid',
    'int',
    'Boolean',
    'BigDecimal',
    'Date',
    'Object',
    'List<Object>'
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

  // Estilos de enrutamiento
  readonly lineStyles: { id: UmlLineStyle; label: string }[] = [
    { id: 'segment', label: 'Ortogonal (Segment)' },
    { id: 'straight', label: 'Directa (Straight)' },
    { id: 'bezier', label: 'Curva Bezier' },
    { id: 'adaptive-curve', label: 'Curva Adaptativa' },
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

  // Nodos y Conexiones del Diagrama
  nodes = signal<UmlClassNode[]>([
    {
      id: 'node_1',
      name: 'Usuario',
      position: { x: 80, y: 80 },
      width: 220,
      attributes: [
        { name: 'id', type: 'UUID' },
        { name: 'email', type: 'String' },
        { name: 'password_hash', type: 'String' },
      ],
      methods: [
        { name: 'login', parameters: 'pass: String', returnType: 'Boolean' },
      ],
    },
    {
      id: 'node_2',
      name: 'Role',
      position: { x: 440, y: 80 },
      width: 220,
      attributes: [
        { name: 'id', type: 'UUID' },
        { name: 'role_name', type: 'String' },
      ],
      methods: [
        { name: 'hasPermission', parameters: 'perm: String', returnType: 'Boolean' },
      ],
    },
  ]);

  connections = signal<UmlConnection[]>([
    {
      id: 'conn_1_2',
      sourceNodeId: 'node_1',
      targetNodeId: 'node_2',
      sourceId: 'node_1_right',
      targetId: 'node_2_left',
      type: 'association',
      lineStyle: 'segment',
      sourceMultiplicity: '1',
      targetMultiplicity: '0..*',
      name: 'posee',
    },
  ]);

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      const diagramId = params['diagramId'];
      const projectId = params['projectId'];
      const projectName = params['projectName'];

      if (projectId) {
        this.currentProjectId.set(projectId);
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
            attributes: n.attributes || [],
            methods: n.methods || [],
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

      setTimeout(() => {
        this.updateConnectionEndpoints();
      }, 50);
    });
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.setPointerMode();
      this.closeEditNodeModal();
      this.closeEditConnModal();
      this.showJsonModal.set(false);
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      this.saveToBackend();
    }
  }

  saveToBackend(): void {
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
      },
    });
  }

  // --- SELECCIÓN Y HERRAMIENTAS DEL TOOLBOX ---
  selectRelationType(type: UmlRelationshipType): void {
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
    node.position = newPosition;
    this.updateConnectionEndpoints();
  }

  onResizeMouseDown(node: UmlClassNode, event: MouseEvent): void {
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
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  // --- SEGUIMIENTO Y LÍNEA GUÍA ---
  onCanvasMouseMove(event: MouseEvent): void {
    if (!this.selectedSourceNodeId()) return;

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

    this.mouseCanvasPos.set({ x: canvasX, y: canvasY });
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

    // 2. Actualizar extremos de las conexiones
    this.connections.update(conns => conns.map(conn => {
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
    }));
  }

  // --- CREACIÓN DE RELACIONES ---
  onTableClick(nodeId: string, event: MouseEvent): void {
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
    }
  }

  onCanvasBackgroundClick(): void {
    this.selectedSourceNodeId.set(null);
  }

  onConnectionCreated(event: FCreateConnectionEvent): void {
    if (!event.targetId) return;

    const relType = this.selectedRelationType() || 'association';
    const baseSourceId = event.sourceId.replace(/_(top|bottom|left|right)$/, '');
    const baseTargetId = (event.targetId as string).replace(/_(top|bottom|left|right)$/, '');

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
  }

  createAssociationClassBetween(sourceNode: UmlClassNode, targetNode: UmlClassNode): void {
    const timestamp = Date.now();
    const assocClassId = `node_${timestamp}_assoc`;
    const anchorNodeId = `node_${timestamp}_anchor`;
    const mainConnId = `conn_${timestamp}_main`;
    const linkConnId = `conn_${timestamp}_link`;

    const mainOptimal = this.getOptimalConnectorId(sourceNode, targetNode);
    const sourceSide = mainOptimal.sourceId.split('_').pop() || 'right';
    const targetSide = mainOptimal.targetId.split('_').pop() || 'left';

    const p1 = this.getConnectorPoint(sourceNode, sourceSide);
    const p2 = this.getConnectorPoint(targetNode, targetSide);
    const midX = Math.round((p1.x + p2.x) / 2);
    const midY = Math.round((p1.y + p2.y) / 2);

    const assocNode: UmlClassNode = {
      id: assocClassId,
      name: `${sourceNode.name}${targetNode.name}`,
      position: { x: Math.round(midX - 110), y: Math.round(midY + 130) },
      width: 220,
      attributes: [
        { name: `${sourceNode.name.toLowerCase()}_id`, type: 'UUID' },
        { name: `${targetNode.name.toLowerCase()}_id`, type: 'UUID' },
        { name: 'fecha_registro', type: 'Date' },
      ],
      methods: [],
    };

    const anchorNode: UmlClassNode = {
      id: anchorNodeId,
      name: '',
      position: { x: midX, y: midY },
      width: 1,
      height: 1,
      attributes: [],
      methods: [],
      isAnchor: true,
      assocMainConnId: mainConnId,
    };

    const mainConn: UmlConnection = {
      id: mainConnId,
      sourceNodeId: sourceNode.id,
      targetNodeId: targetNode.id,
      sourceId: mainOptimal.sourceId,
      targetId: mainOptimal.targetId,
      type: 'association',
      lineStyle: this.defaultLineStyle(),
      sourceMultiplicity: '*',
      targetMultiplicity: '*',
      assocAnchorNodeId: anchorNodeId,
    };

    const assocConn: UmlConnection = {
      id: linkConnId,
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
  }

  removeClass(nodeId: string, event?: MouseEvent): void {
    if (event) event.stopPropagation();
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
  }

  // --- MODAL DE EDICIÓN DE CLASE (DOBLE CLIC) ---
  openEditNodeModal(node: UmlClassNode, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (node.isAnchor) return;
    this.editingNode.set(JSON.parse(JSON.stringify(node)));
    this.isEditNodeModalOpen.set(true);
  }

  closeEditNodeModal(): void {
    this.isEditNodeModalOpen.set(false);
    this.editingNode.set(null);
  }

  saveEditedNode(): void {
    const edited = this.editingNode();
    if (!edited) return;

    this.nodes.update(nodes =>
      nodes.map(n => (n.id === edited.id ? edited : n))
    );
    this.updateConnectionEndpoints();
    this.closeEditNodeModal();
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
    if (event) event.stopPropagation();
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

    this.connections.update(conns =>
      conns.map(c => (c.id === edited.id ? edited : c))
    );
    this.updateConnectionEndpoints();
    this.closeEditConnModal();
  }

  removeConnection(connId: string, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.connections.update(conns => conns.filter(c => c.id !== connId));
  }

  // --- ZOOM Y VISTA ---
  zoomIn(): void {
    if (this.canvas) {
      this.canvas.setScale(this.canvas.getScale() * 1.15);
    }
  }

  zoomOut(): void {
    if (this.canvas) {
      this.canvas.setScale(this.canvas.getScale() * 0.85);
    }
  }

  resetView(): void {
    if (this.canvas) {
      this.canvas.resetScaleAndCenter();
    }
  }

  fitView(): void {
    if (this.canvas) {
      this.canvas.fitToScreen({ x: 40, y: 40 });
    }
  }

  // --- EXPORTAR / IMPORTAR ---
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
  }

  openImportModal(): void {
    this.jsonContent.set('');
    this.jsonModalMode.set('import');
    this.showJsonModal.set(true);
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
    downloadAnchor.setAttribute('download', `diagrama_clases_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  triggerFileInput(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const project = JSON.parse(content) as UmlDiagramProject;
        if (project.nodes && project.connections) {
          this.nodes.set(project.nodes.map(n => ({
            ...n,
            width: n.width || 220
          })));
          this.connections.set(project.connections);
          if (project.defaultLineStyle) {
            this.defaultLineStyle.set(project.defaultLineStyle);
          }
          this.updateConnectionEndpoints();
        } else {
          alert('El archivo JSON no contiene un diagrama de clases válido.');
        }
      } catch (err) {
        alert('Error al leer el archivo JSON: ' + err);
      }
      target.value = '';
    };
    reader.readAsText(file);
  }

  applyImportedJson(): void {
    try {
      const project = JSON.parse(this.jsonContent()) as UmlDiagramProject;
      if (project.nodes && project.connections) {
        this.nodes.set(project.nodes.map(n => ({
          ...n,
          width: n.width || 220
        })));
        this.connections.set(project.connections);
        if (project.defaultLineStyle) {
          this.defaultLineStyle.set(project.defaultLineStyle);
        }
        this.updateConnectionEndpoints();
        this.showJsonModal.set(false);
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

  clearDiagram(): void {
    if (confirm('¿Estás seguro de que deseas limpiar el diagrama?')) {
      this.nodes.set([]);
      this.connections.set([]);
      this.selectedSourceNodeId.set(null);
    }
  }
}
