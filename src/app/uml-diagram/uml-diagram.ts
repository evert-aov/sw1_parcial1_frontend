import { Component, signal, ViewChild, ElementRef, OnInit, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { FFlowModule, FCreateConnectionEvent, FCanvasComponent } from '@foblex/flow';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { AuthService } from '../core/services/auth.service';
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
  heroFolder
} from '@ng-icons/heroicons/outline';

export type UmlRelationshipType = 
  | 'association' 
  | 'generalization' 
  | 'realization' 
  | 'composition' 
  | 'aggregation' 
  | 'dependency'
  | 'association_class';

export type UmlLineStyle = 'segment' | 'straight' | 'bezier' | 'adaptive-curve';

export interface UmlAttribute {
  name: string;
  type: string;
}

export interface UmlMethod {
  name: string;
  parameters: string;
  returnType: string;
}

export interface UmlClassNode {
  id: string;
  name: string;
  position: { x: number; y: number };
  width: number;
  height?: number;
  attributes: UmlAttribute[];
  methods: UmlMethod[];
  isAnchor?: boolean;
  assocMainConnId?: string;
}

export interface UmlConnection {
  id: string;
  sourceNodeId?: string;
  targetNodeId?: string;
  sourceId: string;
  targetId: string;
  type: UmlRelationshipType;
  lineStyle?: UmlLineStyle;
  name?: string;
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
  assocAnchorNodeId?: string;
}

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
  selector: 'app-uml-diagram',
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
      heroFolder
    })
  ],
  templateUrl: './uml-diagram.html',
  styleUrl: './uml-diagram.css',
})
export class UmlDiagram implements OnInit {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  @ViewChild(FCanvasComponent) canvas?: FCanvasComponent;
  @ViewChild('flowContainer') flowContainerRef?: ElementRef<HTMLElement>;
  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  // Por defecto: Modo Seleccionar / Mover
  selectedRelationType = signal<UmlRelationshipType | null>(null);

  // Estilo de línea por defecto
  defaultLineStyle = signal<UmlLineStyle>('segment');

  // Nodo origen seleccionado en el flujo clic-a-clic
  selectedSourceNodeId = signal<string | null>(null);

  // Posición del cursor en coordenadas del lienzo
  mouseCanvasPos = signal<{ x: number; y: number }>({ x: 0, y: 0 });

  // Opciones de multiplicidad estándar
  multiplicityOptions: string[] = ['1', '0..1', '1..*', '0..*', '*', 'n', 'm'];

  // Tipos de datos predefinidos
  predefinedTypes: string[] = [
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
  predefinedReturnTypes: string[] = [
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

  // Modal JSON
  showJsonModal = signal<boolean>(false);
  jsonContent = signal<string>('');
  jsonModalMode = signal<'import' | 'export'>('export');

  // Acordeones de la barra lateral
  isRelationshipsOpen = signal<boolean>(true);
  isElementsOpen = signal<boolean>(true);

  // Inicia en blanco sin ninguna tabla por defecto
  nodes = signal<UmlClassNode[]>([]);

  // Inicia sin conexiones por defecto
  connections = signal<UmlConnection[]>([]);

  ngOnInit() {
    this.updateConnectionEndpoints();
  }

  // Cancelar selección con tecla Escape
  @HostListener('window:keydown.escape')
  onEscapeKey() {
    this.selectedSourceNodeId.set(null);
    this.selectedRelationType.set(null);
  }

  // Redimensionamiento interactivo de la tabla
  onResizeMouseDown(node: UmlClassNode, event: MouseEvent) {
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
      node.width = Math.max(160, Math.round(startWidth + dx));
      if (Math.abs(dy) > 5) {
        node.height = Math.max(40, Math.round(startHeight + dy));
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

  // Seguimiento continuo del cursor
  onCanvasMouseMove(event: MouseEvent) {
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

  // Obtiene el nodo origen seleccionado actualmente
  getSelectedSourceNode(): UmlClassNode | undefined {
    const id = this.selectedSourceNodeId();
    if (!id) return undefined;
    return this.nodes().find(n => n.id === id);
  }

  // Calcula el punto de anclaje de salida más cercano de Tabla A
  getPreviewSourcePoint(sourceNode: UmlClassNode, mousePos: { x: number; y: number }): { x: number; y: number } {
    const nodeWidth = sourceNode.width || 220;
    const nodeHeight = sourceNode.height || 60;
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

  // Trazo SVG interactivo que conecta Tabla A con el cursor
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
      // Ortogonal segment
      const midX = (start.x + mouse.x) / 2;
      return `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${mouse.y} L ${mouse.x} ${mouse.y}`;
    }
  }

  // Ángulo del símbolo en la punta del cursor
  getPreviewTargetAngle(): number {
    const sourceNode = this.getSelectedSourceNode();
    if (!sourceNode) return 0;
    const mouse = this.mouseCanvasPos();
    const start = this.getPreviewSourcePoint(sourceNode, mouse);
    const style = this.defaultLineStyle();

    if (style === 'segment') {
      return mouse.x >= start.x ? 0 : 180;
    }

    const angleRad = Math.atan2(mouse.y - start.y, mouse.x - start.x);
    return angleRad * (180 / Math.PI);
  }

  // Obtiene la altura precisa de un nodo de clase
  getNodeHeight(node: UmlClassNode): number {
    if (node.isAnchor) return 0;
    if (node.height && node.height > 0) {
      return node.height;
    }
    const el = document.querySelector(`[fConnectorId="${node.id}"]`)?.closest('.f-node') as HTMLElement;
    if (el && el.offsetHeight > 0) {
      return el.offsetHeight;
    }
    const headerH = 32;
    const attrH = Math.max(28, (node.attributes?.length || 0) * 24 + 28);
    const methodH = Math.max(28, (node.methods?.length || 0) * 24 + 28);
    return headerH + attrH + methodH + 4;
  }

  // Calcula lados óptimos entre dos tablas
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

  // Coordenadas absolutas del punto de conexión (top/bottom/left/right) de una tabla
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

  // Actualiza los extremos de todas las conexiones y reubica los anclas de Association Class en el punto medio
  updateConnectionEndpoints() {
    const nodeMap = new Map(this.nodes().map(n => [n.id, n]));

    // 1. Actualizar posiciones de los nodos ancla invisibles en el punto medio de sus conexiones principales
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

    // 2. Actualizar extremos de todas las conexiones
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

  // Manejador al mover una tabla
  onNodePositionChange(node: UmlClassNode, newPosition: { x: number; y: number }) {
    node.position = newPosition;
    this.updateConnectionEndpoints();
  }

  // Alternar herramienta de relación en la barra lateral
  toggleRelationType(type: UmlRelationshipType) {
    if (this.selectedRelationType() === type) {
      this.selectedRelationType.set(null);
      this.selectedSourceNodeId.set(null);
    } else {
      this.selectedRelationType.set(type);
    }
  }

  // Modo Selección / Mover
  setPointerMode() {
    this.selectedRelationType.set(null);
    this.selectedSourceNodeId.set(null);
  }

  // Genera automáticamente la clase de asociación intermedia y las conexiones correspondientes (muchos a muchos)
  createAssociationClassBetween(sourceNode: UmlClassNode, targetNode: UmlClassNode) {
    const timestamp = Date.now();
    const assocClassId = `node_${timestamp}_assoc`;
    const anchorNodeId = `node_${timestamp}_anchor`;
    const mainConnId = `conn_${timestamp}_main`;
    const linkConnId = `conn_${timestamp}_link`;

    const sWidth = sourceNode.width || 220;
    const sHeight = sourceNode.height || 60;
    const tWidth = targetNode.width || 220;
    const tHeight = targetNode.height || 60;

    const sCenter = { x: sourceNode.position.x + sWidth / 2, y: sourceNode.position.y + sHeight / 2 };
    const tCenter = { x: targetNode.position.x + tWidth / 2, y: targetNode.position.y + tHeight / 2 };

    const dx = tCenter.x - sCenter.x;
    const dy = tCenter.y - sCenter.y;

    const mainOptimal = this.getOptimalConnectorId(sourceNode, targetNode);
    const sourceSide = mainOptimal.sourceId.split('_').pop() || 'right';
    const targetSide = mainOptimal.targetId.split('_').pop() || 'left';

    const p1 = this.getConnectorPoint(sourceNode, sourceSide);
    const p2 = this.getConnectorPoint(targetNode, targetSide);
    const midX = Math.round((p1.x + p2.x) / 2);
    const midY = Math.round((p1.y + p2.y) / 2);

    let assocPos = { x: Math.round(midX + 160), y: Math.round(midY - 30) };
    if (Math.abs(dx) > Math.abs(dy)) {
      // Disposición horizontal -> colocar clase de asociación abajo
      assocPos = { x: Math.round(midX - 100), y: Math.round(midY + 130) };
    } else {
      // Disposición vertical -> colocar clase de asociación a la derecha
      assocPos = { x: Math.round(midX + 160), y: Math.round(midY - 30) };
    }

    // 1. Nodo visible: Clase de Asociación intermedia
    const assocNode: UmlClassNode = {
      id: assocClassId,
      name: `${sourceNode.name}_${targetNode.name}`,
      position: assocPos,
      width: 200,
      attributes: [],
      methods: []
    };

    // 2. Nodo ancla invisible en el punto medio de la línea principal
    const anchorNode: UmlClassNode = {
      id: anchorNodeId,
      name: '',
      position: { x: midX, y: midY },
      width: 1,
      height: 1,
      attributes: [],
      methods: [],
      isAnchor: true,
      assocMainConnId: mainConnId
    };

    // 3. Conexión principal sólida entre Tabla A y Tabla B (* a *)
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
      assocAnchorNodeId: anchorNodeId
    };

    // 4. Enlace discontinuo que SALE de la línea principal (desde el ancla) hacia la Clase de Asociación
    const linkOptimal = this.getOptimalConnectorId(anchorNode, assocNode);
    const assocConn: UmlConnection = {
      id: linkConnId,
      sourceNodeId: anchorNodeId,
      targetNodeId: assocClassId,
      sourceId: anchorNodeId,
      targetId: linkOptimal.targetId,
      type: 'association_class',
      lineStyle: 'straight',
      sourceMultiplicity: '',
      targetMultiplicity: ''
    };

    this.nodes.update(list => [...list, assocNode, anchorNode]);
    this.connections.update(conns => [...conns, mainConn, assocConn]);
    this.selectedSourceNodeId.set(null);
    this.updateConnectionEndpoints();
  }

  // Clic en cualquier parte de la tabla para seleccionar Tabla A o Tabla B
  onTableClick(nodeId: string, event: MouseEvent) {
    const activeRel = this.selectedRelationType();
    
    if (!activeRel) {
      return;
    }

    event.stopPropagation();
    const currentSource = this.selectedSourceNodeId();

    if (currentSource === null) {
      // Paso 1: Seleccionar como Tabla A (Origen)
      this.selectedSourceNodeId.set(nodeId);
      this.onCanvasMouseMove(event);
    } else if (currentSource === nodeId) {
      // Deseleccionar
      this.selectedSourceNodeId.set(null);
    } else {
      // Paso 2: Conectar con Tabla B (Destino)
      const nodeMap = new Map(this.nodes().map(n => [n.id, n]));
      const sourceNode = nodeMap.get(currentSource);
      const targetNode = nodeMap.get(nodeId);

      if (activeRel === 'association_class' && sourceNode && targetNode) {
        this.createAssociationClassBetween(sourceNode, targetNode);
        return;
      }

      let sourceId = currentSource + '_right';
      let targetId = nodeId + '_left';

      if (sourceNode && targetNode) {
        const optimal = this.getOptimalConnectorId(sourceNode, targetNode);
        sourceId = optimal.sourceId;
        targetId = optimal.targetId;
      }

      const isAssocClass = activeRel === 'association_class';
      const newConnection: UmlConnection = {
        id: `conn_${Date.now()}`,
        sourceNodeId: currentSource,
        targetNodeId: nodeId,
        sourceId: sourceId,
        targetId: targetId,
        type: activeRel,
        lineStyle: this.defaultLineStyle(),
        sourceMultiplicity: isAssocClass ? '*' : '1',
        targetMultiplicity: isAssocClass ? '*' : '0..*'
      };

      this.connections.update(conns => [...conns, newConnection]);
      this.selectedSourceNodeId.set(null);
    }
  }

  // Cancelar selección al hacer clic en el lienzo vacío
  onCanvasBackgroundClick() {
    this.selectedSourceNodeId.set(null);
  }

  // Conexión creada mediante arrastre directo (drag-to-connect)
  onConnectionCreated(event: FCreateConnectionEvent) {
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

    const isAssocClass = relType === 'association_class';
    const newConnection: UmlConnection = {
      id: `conn_${Date.now()}`,
      sourceNodeId: baseSourceId,
      targetNodeId: baseTargetId,
      sourceId: sourceId,
      targetId: targetId,
      type: relType,
      lineStyle: this.defaultLineStyle(),
      sourceMultiplicity: isAssocClass ? '*' : '1',
      targetMultiplicity: isAssocClass ? '*' : '0..*'
    };

    this.connections.update(conns => [...conns, newConnection]);
    this.selectedSourceNodeId.set(null);
    this.updateConnectionEndpoints();
  }

  // Agregar nueva Clase limpia (solo nombre, sin atributos ni operaciones por default)
  addClass() {
    const timestamp = Date.now();
    const count = this.nodes().filter(n => !n.isAnchor).length + 1;
    const newId = `node_${timestamp}`;

    const newNode: UmlClassNode = {
      id: newId,
      name: `Class${count}`,
      position: { 
        x: 180 + (this.nodes().length * 35) % 350, 
        y: 140 + (this.nodes().length * 35) % 250 
      },
      width: 220,
      attributes: [],
      methods: []
    };

    this.nodes.update(list => [...list, newNode]);
  }

  // Eliminar Clase
  removeClass(nodeId: string) {
    const nodesToRemove = new Set<string>([nodeId]);

    // Buscar anclas vinculadas
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

  // Auto-ajustar ancho de la tabla según contenido de atributos, métodos y nombre
  autoAdjustWidth(node: UmlClassNode) {
    const CHAR_W = 8.0;
    let maxLineW = (node.name?.length || 0) * CHAR_W + 60;

    for (const attr of node.attributes) {
      const nameLen = attr.name?.length || 0;
      const typeLen = attr.type?.length || 0;
      // "- name : type" + delete button padding
      const lineLen = nameLen + typeLen + 6;
      maxLineW = Math.max(maxLineW, lineLen * CHAR_W + 60);
    }
    for (const m of node.methods) {
      const nameLen = m.name?.length || 0;
      const paramLen = m.parameters?.length || 0;
      const returnLen = m.returnType?.length || 0;
      // "+ name(params): returnType" + delete button padding
      const lineLen = nameLen + paramLen + returnLen + 8;
      maxLineW = Math.max(maxLineW, lineLen * CHAR_W + 60);
    }

    const required = Math.max(220, Math.ceil(maxLineW));
    if (required > (node.width || 220)) {
      node.width = required;
      this.nodes.update(list => [...list]);
      this.updateConnectionEndpoints();
    }
  }

  onNodeContentChange(node: UmlClassNode) {
    this.autoAdjustWidth(node);
  }

  // Atributos
  addAttribute(node: UmlClassNode) {
    const attrCount = node.attributes.length + 1;
    node.attributes.push({ name: `attribute${attrCount}`, type: 'String' });
    this.autoAdjustWidth(node);
    this.nodes.update(list => [...list]);
    this.updateConnectionEndpoints();
  }

  removeAttribute(node: UmlClassNode, index: number) {
    node.attributes.splice(index, 1);
    this.nodes.update(list => [...list]);
    this.updateConnectionEndpoints();
  }

  // Métodos
  addMethod(node: UmlClassNode) {
    const opCount = node.methods.length + 1;
    node.methods.push({ name: `operation${opCount}`, parameters: '', returnType: 'void' });
    this.autoAdjustWidth(node);
    this.nodes.update(list => [...list]);
    this.updateConnectionEndpoints();
  }

  removeMethod(node: UmlClassNode, index: number) {
    node.methods.splice(index, 1);
    this.nodes.update(list => [...list]);
    this.updateConnectionEndpoints();
  }

  // Eliminar conexión
  removeConnection(connId: string) {
    this.connections.update(conns => conns.filter(c => c.id !== connId));
  }

  // Cambiar tipo de relación
  changeConnectionType(conn: UmlConnection, newType: UmlRelationshipType) {
    conn.type = newType;
    this.connections.update(list => [...list]);
  }

  // Cambiar estilo de línea
  changeConnectionStyle(conn: UmlConnection, newStyle: UmlLineStyle) {
    conn.lineStyle = newStyle;
    this.connections.update(list => [...list]);
  }

  // Zoom y Vista
  zoomIn() {
    if (this.canvas) {
      this.canvas.setScale(this.canvas.getScale() * 1.15);
    }
  }

  zoomOut() {
    if (this.canvas) {
      this.canvas.setScale(this.canvas.getScale() * 0.85);
    }
  }

  resetView() {
    if (this.canvas) {
      this.canvas.resetScaleAndCenter();
    }
  }

  fitView() {
    if (this.canvas) {
      this.canvas.fitToScreen({ x: 40, y: 40 });
    }
  }

  // Exportar / Importar
  openExportModal() {
    const project: UmlDiagramProject = {
      version: '1.0.0',
      name: 'EnterpriseArchitect_ClassDiagram',
      createdDate: new Date().toISOString(),
      defaultLineStyle: this.defaultLineStyle(),
      nodes: this.nodes(),
      connections: this.connections()
    };
    this.jsonContent.set(JSON.stringify(project, null, 2));
    this.jsonModalMode.set('export');
    this.showJsonModal.set(true);
  }

  openImportModal() {
    this.jsonContent.set('');
    this.jsonModalMode.set('import');
    this.showJsonModal.set(true);
  }

  downloadJsonFile() {
    const project: UmlDiagramProject = {
      version: '1.0.0',
      name: 'EnterpriseArchitect_ClassDiagram',
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

  triggerFileInput() {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event) {
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
          for (const n of this.nodes()) {
            this.autoAdjustWidth(n);
          }
          this.nodes.update(list => [...list]);
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

  applyImportedJson() {
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
          for (const n of this.nodes()) {
            this.autoAdjustWidth(n);
          }
          this.nodes.update(list => [...list]);
          this.showJsonModal.set(false);
      } else {
        alert('Estructura JSON inválida: faltan nodos o conexiones.');
      }
    } catch (e) {
      alert('Error en el formato JSON: ' + e);
    }
  }

  copyJsonToClipboard() {
    navigator.clipboard.writeText(this.jsonContent()).then(() => {
      alert('¡JSON copiado al portapapeles!');
    });
  }

  clearDiagram() {
    if (confirm('¿Estás seguro de que deseas limpiar el diagrama?')) {
      this.nodes.set([]);
      this.connections.set([]);
      this.selectedSourceNodeId.set(null);
    }
  }
}
