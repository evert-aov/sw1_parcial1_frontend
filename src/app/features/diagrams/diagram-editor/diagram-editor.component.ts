import { Component, signal, ViewChild, ElementRef, OnInit, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { FFlowModule, FCanvasComponent } from '@foblex/flow';
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
  canvasScale = signal<number>(1);

  // Por defecto: Modo Seleccionar / Mover
  selectedRelationType = signal<UmlRelationshipType | null>(null);

  // Estilo de línea por defecto
  defaultLineStyle = signal<UmlLineStyle>('segment');

  // Nodo origen seleccionado en el flujo clic-a-clic
  selectedSourceNodeId = signal<string | null>(null);

  // Posición del cursor en coordenadas del lienzo
  mouseCanvasPos = signal<{ x: number; y: number }>({ x: 0, y: 0 });

  // Lista de relaciones y conectores disponibles
  readonly relationTypes: { id: UmlRelationshipType; label: string; icon: string; description: string; preview: string }[] = [
    { 
      id: 'association', 
      label: 'Association', 
      icon: '───', 
      description: 'Relación estructural simple entre dos clases',
      preview: '────────'
    },
    { 
      id: 'generalization', 
      label: 'Generalization', 
      icon: '─▷', 
      description: 'Herencia: la subclase hereda de la superclase (triángulo blanco)',
      preview: '──────▷'
    },
    { 
      id: 'realization', 
      label: 'Realization', 
      icon: '┈▷', 
      description: 'Implementación de una interfaz (línea discontinua con triángulo)',
      preview: '- - - ▷'
    },
    { 
      id: 'composition', 
      label: 'Composition', 
      icon: '◆──', 
      description: 'Pertenencia fuerte del todo a las partes (rombo negro relleno)',
      preview: '◆───────'
    },
    { 
      id: 'aggregation', 
      label: 'Aggregation', 
      icon: '◇──', 
      description: 'Pertenencia débil o contenedor independiente (rombo blanco hueco)',
      preview: '◇───────'
    },
    { 
      id: 'dependency', 
      label: 'Dependency', 
      icon: '┈>', 
      description: 'Uso temporal o dependencia débil (flecha discontinua)',
      preview: '- - - >'
    },
    { 
      id: 'association_class', 
      label: 'Association Class', 
      icon: '─*─┄[T]', 
      description: 'Relación muchos a muchos con tabla intermedia automática',
      preview: '──*──*──\n    ┆   \n   [T]  '
    },
  ];

  readonly lineStyles: { id: UmlLineStyle; label: string }[] = [
    { id: 'segment', label: 'Ortogonal (Segment)' },
    { id: 'straight', label: 'Directa (Straight)' },
    { id: 'bezier', label: 'Curva Bezier' },
    { id: 'adaptive-curve', label: 'Curva Adaptativa' },
  ];

  // Acordeones del toolbox
  isRelationshipsOpen = signal<boolean>(true);
  isLineStylesOpen = signal<boolean>(true);

  // Estados de modales
  isExportModalOpen = signal<boolean>(false);
  isImportModalOpen = signal<boolean>(false);
  isEditNodeModalOpen = signal<boolean>(false);
  isEditConnModalOpen = signal<boolean>(false);

  // JSON exportado
  exportedJson = signal<string>('');
  copyFeedback = signal<boolean>(false);

  // JSON a importar
  importJsonText = '';
  importError = signal<string | null>(null);

  // Elementos seleccionados para edición
  editingNode = signal<UmlClassNode | null>(null);
  editingConnection = signal<UmlConnection | null>(null);

  // Datos del diagrama
  classNodes = signal<UmlClassNode[]>([
    {
      id: 'node_1',
      name: 'Usuario',
      position: { x: 80, y: 80 },
      width: 220,
      attributes: [
        { name: 'id', type: 'UUID' },
        { name: 'email', type: 'String' },
        { name: 'password_hash', type: 'String' },
        { name: 'is_active', type: 'Boolean' },
      ],
      methods: [
        { name: 'login', parameters: 'pass: String', returnType: 'Boolean' },
        { name: 'changePassword', parameters: 'newPass: String', returnType: 'void' },
      ],
    },
    {
      id: 'node_2',
      name: 'Role',
      position: { x: 420, y: 80 },
      width: 220,
      attributes: [
        { name: 'id', type: 'UUID' },
        { name: 'role_name', type: 'String' },
        { name: 'description', type: 'String' },
      ],
      methods: [
        { name: 'hasPermission', parameters: 'perm: String', returnType: 'Boolean' },
      ],
    },
    {
      id: 'node_3',
      name: 'Session',
      position: { x: 80, y: 380 },
      width: 220,
      attributes: [
        { name: 'token', type: 'String' },
        { name: 'created_at', type: 'Date' },
        { name: 'expires_at', type: 'Date' },
      ],
      methods: [
        { name: 'isValid', parameters: '', returnType: 'Boolean' },
      ],
    },
    {
      id: 'node_4',
      name: 'AuditLog',
      position: { x: 420, y: 380 },
      width: 220,
      attributes: [
        { name: 'id', type: 'UUID' },
        { name: 'action', type: 'String' },
        { name: 'timestamp', type: 'Date' },
      ],
      methods: [
        { name: 'record', parameters: 'evt: String', returnType: 'void' },
      ],
    },
  ]);

  connections = signal<UmlConnection[]>([
    {
      id: 'conn_1_2',
      from: 'node_1_right',
      to: 'node_2_left',
      sourceId: 'node_1_right',
      targetId: 'node_2_left',
      type: 'generalization',
      lineStyle: 'segment',
      sourceMultiplicity: '1',
      targetMultiplicity: '1',
    },
    {
      id: 'conn_1_3',
      from: 'node_1_bottom',
      to: 'node_3_top',
      sourceId: 'node_1_bottom',
      targetId: 'node_3_top',
      type: 'composition',
      lineStyle: 'segment',
      sourceMultiplicity: '1',
      targetMultiplicity: '0..*',
    },
    {
      id: 'conn_1_4',
      from: 'node_1_right',
      to: 'node_4_left',
      sourceId: 'node_1_right',
      targetId: 'node_4_left',
      type: 'aggregation',
      lineStyle: 'segment',
      sourceMultiplicity: '1',
      targetMultiplicity: '0..*',
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
        // Cargar diagramas del proyecto
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
  }

  loadDiagramFromBackend(diagramId: string): void {
    this.diagramService.loadDiagram(diagramId).subscribe((diagram) => {
      this.currentDiagramName.set(diagram.name);
      if (diagram.defaultLineStyle) {
        this.defaultLineStyle.set(diagram.defaultLineStyle);
      }

      if (diagram.nodes && diagram.nodes.length > 0) {
        this.classNodes.set(
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

      if (diagram.connections) {
        this.connections.set(
          diagram.connections.map((c) => ({
            id: c.id,
            from: c.sourceId,
            to: c.targetId,
            sourceId: c.sourceId,
            targetId: c.targetId,
            type: c.type as UmlRelationshipType,
            lineStyle: (c.lineStyle as UmlLineStyle) || 'segment',
            name: c.name || undefined,
            sourceMultiplicity: c.sourceMultiplicity,
            targetMultiplicity: c.targetMultiplicity,
            assocAnchorNodeId: c.assocAnchorNodeId || undefined,
          })),
        );
      }
    });
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.setPointerMode();
      this.closeExportModal();
      this.closeImportModal();
      this.closeEditNodeModal();
      this.closeEditConnModal();
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
      nodes: this.classNodes().map((n) => ({
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
        const sourceNodeId = this.getNodeIdFromConnector(c.sourceId);
        const targetNodeId = this.getNodeIdFromConnector(c.targetId);
        return {
          id: c.id,
          sourceNodeId,
          targetNodeId,
          sourceId: c.sourceId,
          targetId: c.targetId,
          type: c.type,
          lineStyle: c.lineStyle || this.defaultLineStyle(),
          name: c.name || null,
          sourceMultiplicity: c.sourceMultiplicity || '1',
          targetMultiplicity: c.targetMultiplicity || '0..*',
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

  // Selección de tipo de relación
  selectRelationType(type: UmlRelationshipType): void {
    if (this.selectedRelationType() === type) {
      this.selectedRelationType.set(null);
    } else {
      this.selectedRelationType.set(type);
    }
    this.selectedSourceNodeId.set(null);
  }

  setPointerMode(): void {
    this.selectedRelationType.set(null);
    this.selectedSourceNodeId.set(null);
  }

  setDefaultLineStyle(style: UmlLineStyle): void {
    this.defaultLineStyle.set(style);
  }

  onMouseMoveOnCanvas(e: MouseEvent): void {
    if (this.selectedSourceNodeId()) {
      const container = this.flowContainerRef?.nativeElement;
      if (container) {
        const rect = container.getBoundingClientRect();
        this.mouseCanvasPos.set({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    }
  }

  onNodeClick(node: UmlClassNode, event: MouseEvent): void {
    const currentRel = this.selectedRelationType();
    if (!currentRel) return;

    event.stopPropagation();

    const sourceId = this.selectedSourceNodeId();
    if (!sourceId) {
      this.selectedSourceNodeId.set(node.id);
    } else {
      if (sourceId === node.id) {
        this.selectedSourceNodeId.set(null);
        return;
      }
      this.createRelationshipBetweenNodes(sourceId, node.id, currentRel);
      this.selectedSourceNodeId.set(null);
    }
  }

  private createRelationshipBetweenNodes(
    sourceNodeId: string,
    targetNodeId: string,
    type: UmlRelationshipType
  ): void {
    const sourceNode = this.classNodes().find(n => n.id === sourceNodeId);
    const targetNode = this.classNodes().find(n => n.id === targetNodeId);
    if (!sourceNode || !targetNode) return;

    const sourceConns = this.getBestConnectorPair(sourceNode, targetNode);

    if (type === 'association_class') {
      this.createAssociationClassStructure(
        sourceNodeId,
        targetNodeId,
        sourceConns.sourceConnector,
        sourceConns.targetConnector
      );
      return;
    }

    const newConnection: UmlConnection = {
      id: `conn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      from: sourceConns.sourceConnector,
      to: sourceConns.targetConnector,
      sourceId: sourceConns.sourceConnector,
      targetId: sourceConns.targetConnector,
      type: type,
      lineStyle: this.defaultLineStyle(),
      sourceMultiplicity: this.getDefaultMultiplicity(type, 'source'),
      targetMultiplicity: this.getDefaultMultiplicity(type, 'target'),
    };

    this.connections.update((conns) => [...conns, newConnection]);
  }

  private createAssociationClassStructure(
    sourceNodeId: string,
    targetNodeId: string,
    sourceConnector: string,
    targetConnector: string
  ): void {
    const sourceNode = this.classNodes().find(n => n.id === sourceNodeId);
    const targetNode = this.classNodes().find(n => n.id === targetNodeId);
    if (!sourceNode || !targetNode) return;

    const mainConnId = `conn_main_${Date.now()}`;
    const mainConnection: UmlConnection = {
      id: mainConnId,
      from: sourceConnector,
      to: targetConnector,
      sourceId: sourceConnector,
      targetId: targetConnector,
      type: 'association',
      lineStyle: 'segment',
      sourceMultiplicity: '*',
      targetMultiplicity: '*',
    };

    const midX = (sourceNode.position.x + targetNode.position.x) / 2;
    const midY = (sourceNode.position.y + targetNode.position.y) / 2;

    const anchorNodeId = `anchor_${Date.now()}`;
    const anchorNode: UmlClassNode = {
      id: anchorNodeId,
      name: '',
      position: { x: midX + 110, y: midY + 40 },
      width: 4,
      height: 4,
      attributes: [],
      methods: [],
      isAnchor: true,
      assocMainConnId: mainConnId,
    };

    const assocNodeId = `node_${Date.now()}`;
    const assocNodeName = `${sourceNode.name}${targetNode.name}`;
    const intermediateClassNode: UmlClassNode = {
      id: assocNodeId,
      name: assocNodeName,
      position: { x: midX, y: midY + 140 },
      width: 220,
      attributes: [
        { name: `${sourceNode.name.toLowerCase()}_id`, type: 'UUID' },
        { name: `${targetNode.name.toLowerCase()}_id`, type: 'UUID' },
        { name: 'fecha_registro', type: 'Date' },
        { name: 'estado', type: 'String' },
      ],
      methods: [],
    };

    const dashedConnId = `conn_dashed_${Date.now()}`;
    const dashedConnection: UmlConnection = {
      id: dashedConnId,
      from: `${anchorNodeId}_center`,
      to: `${assocNodeId}_top`,
      sourceId: `${anchorNodeId}_center`,
      targetId: `${assocNodeId}_top`,
      type: 'dependency',
      lineStyle: 'segment',
      assocAnchorNodeId: anchorNodeId,
    };

    this.classNodes.update(nodes => [...nodes, anchorNode, intermediateClassNode]);
    this.connections.update(conns => [...conns, mainConnection, dashedConnection]);
  }

  private getBestConnectorPair(source: UmlClassNode, target: UmlClassNode): { sourceConnector: string; targetConnector: string } {
    const dx = target.position.x - source.position.x;
    const dy = target.position.y - source.position.y;

    if (Math.abs(dx) >= Math.abs(dy)) {
      if (dx > 0) {
        return { sourceConnector: `${source.id}_right`, targetConnector: `${target.id}_left` };
      } else {
        return { sourceConnector: `${source.id}_left`, targetConnector: `${target.id}_right` };
      }
    } else {
      if (dy > 0) {
        return { sourceConnector: `${source.id}_bottom`, targetConnector: `${target.id}_top` };
      } else {
        return { sourceConnector: `${source.id}_top`, targetConnector: `${target.id}_bottom` };
      }
    }
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

  onConnectionCreated(event: any): void {
    const source = event?.fSourceId || event?.fSource || event?.source;
    const target = event?.fTargetId || event?.fTarget || event?.target;
    if (!source || !target) return;

    const sourceNodeId = this.getNodeIdFromConnector(source);
    const targetNodeId = this.getNodeIdFromConnector(target);

    if (sourceNodeId === targetNodeId) return;

    const relType = this.selectedRelationType() || 'association';

    if (relType === 'association_class') {
      this.createAssociationClassStructure(
        sourceNodeId,
        targetNodeId,
        source,
        target
      );
      this.setPointerMode();
      return;
    }

    const newConn: UmlConnection = {
      id: `conn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      from: source,
      to: target,
      sourceId: source,
      targetId: target,
      type: relType,
      lineStyle: this.defaultLineStyle(),
      sourceMultiplicity: this.getDefaultMultiplicity(relType, 'source'),
      targetMultiplicity: this.getDefaultMultiplicity(relType, 'target'),
    };

    this.connections.update((conns) => [...conns, newConn]);
    this.setPointerMode();
  }

  private getNodeIdFromConnector(connectorId: string): string {
    const parts = connectorId.split('_');
    if (parts.length >= 2) {
      parts.pop();
      return parts.join('_');
    }
    return connectorId;
  }

  addClassNode(): void {
    const currentCount = this.classNodes().filter(n => !n.isAnchor).length;
    const offset = (currentCount % 6) * 35;
    const newNode: UmlClassNode = {
      id: `node_${Date.now()}`,
      name: `Class${currentCount + 1}`,
      position: { x: 180 + offset, y: 140 + offset },
      width: 220,
      attributes: [
        { name: 'id', type: 'UUID' },
        { name: 'name', type: 'String' },
      ],
      methods: [
        { name: 'getId', parameters: '', returnType: 'UUID' },
      ],
    };

    this.classNodes.update((nodes) => [...nodes, newNode]);
  }

  deleteClassNode(nodeId: string, event?: MouseEvent): void {
    if (event) event.stopPropagation();

    this.connections.update((conns) =>
      conns.filter((c) => !c.from.startsWith(nodeId) && !c.to.startsWith(nodeId))
    );

    this.classNodes.update((nodes) => nodes.filter((n) => n.id !== nodeId));
  }

  deleteConnection(connId: string, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.connections.update((conns) => conns.filter((c) => c.id !== connId));
  }

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

    this.classNodes.update((nodes) =>
      nodes.map((n) => (n.id === edited.id ? edited : n))
    );
    this.closeEditNodeModal();
  }

  addAttributeToEditingNode(): void {
    const node = this.editingNode();
    if (!node) return;
    node.attributes.push({ name: 'newAttribute', type: 'String' });
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
    node.methods.push({ name: 'newMethod', parameters: '', returnType: 'void' });
    this.editingNode.set({ ...node });
  }

  removeMethodFromEditingNode(index: number): void {
    const node = this.editingNode();
    if (!node) return;
    node.methods.splice(index, 1);
    this.editingNode.set({ ...node });
  }

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

    this.connections.update((conns) =>
      conns.map((c) => (c.id === edited.id ? edited : c))
    );
    this.closeEditConnModal();
  }

  zoomIn(): void {
    this.canvasScale.update((s) => Math.min(2.5, s + 0.15));
  }

  zoomOut(): void {
    this.canvasScale.update((s) => Math.max(0.25, s - 0.15));
  }

  resetView(): void {
    this.canvasScale.set(1);
    this.canvas?.resetScaleAndCenter();
  }

  fitView(): void {
    this.canvas?.fitToScreen();
  }

  openExportModal(): void {
    const project: UmlDiagramProject = {
      version: '2.5',
      name: this.currentDiagramName(),
      createdDate: new Date().toISOString(),
      defaultLineStyle: this.defaultLineStyle(),
      nodes: this.classNodes(),
      connections: this.connections(),
    };
    this.exportedJson.set(JSON.stringify(project, null, 2));
    this.copyFeedback.set(false);
    this.isExportModalOpen.set(true);
  }

  closeExportModal(): void {
    this.isExportModalOpen.set(false);
  }

  copyJsonToClipboard(): void {
    navigator.clipboard.writeText(this.exportedJson()).then(() => {
      this.copyFeedback.set(true);
      setTimeout(() => this.copyFeedback.set(false), 2000);
    });
  }

  downloadJsonFile(): void {
    const project: UmlDiagramProject = {
      version: '2.5',
      name: this.currentDiagramName(),
      createdDate: new Date().toISOString(),
      defaultLineStyle: this.defaultLineStyle(),
      nodes: this.classNodes(),
      connections: this.connections(),
    };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `uml_diagram_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  openImportModal(): void {
    this.importJsonText = '';
    this.importError.set(null);
    this.isImportModalOpen.set(true);
  }

  closeImportModal(): void {
    this.isImportModalOpen.set(false);
  }

  triggerFileInput(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        this.processImportJson(text);
      } catch (err: any) {
        alert('Error al leer el archivo JSON: ' + err.message);
      }
      input.value = '';
    };
    reader.readAsText(file);
  }

  applyImportedJson(): void {
    if (!this.importJsonText.trim()) {
      this.importError.set('Por favor pega el contenido JSON.');
      return;
    }
    try {
      this.processImportJson(this.importJsonText);
      this.closeImportModal();
    } catch (err: any) {
      this.importError.set('JSON inválido: ' + err.message);
    }
  }

  private processImportJson(jsonText: string): void {
    const data = JSON.parse(jsonText);
    if (!data.nodes || !Array.isArray(data.nodes)) {
      throw new Error('El JSON no contiene un arreglo "nodes" válido.');
    }

    if (data.defaultLineStyle) {
      this.defaultLineStyle.set(data.defaultLineStyle);
    }

    this.classNodes.set(data.nodes);
    this.connections.set(data.connections || []);
  }

  clearDiagram(): void {
    if (confirm('¿Estás seguro de que deseas limpiar todo el diagrama?')) {
      this.classNodes.set([]);
      this.connections.set([]);
    }
  }

  getNodeHeight(node: UmlClassNode): number {
    if (node.isAnchor) return 4;
    const headerHeight = 33;
    const attrCount = (node.attributes || []).length;
    const methodCount = (node.methods || []).length;
    const attrHeight = attrCount > 0 ? (attrCount * 22) + 12 : 28;
    const methodHeight = methodCount > 0 ? (methodCount * 22) + 12 : 28;
    return headerHeight + attrHeight + methodHeight;
  }
}
