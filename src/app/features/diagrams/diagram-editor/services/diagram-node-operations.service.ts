import { Injectable, inject } from '@angular/core';
import {
  DiagramType,
  UmlClassNode,
  UmlConnection,
  UmlStereotype,
} from '../../../../core/models/diagram.model';
import { DiagramNodeFactoryService } from './diagram-node-factory.service';
import { DiagramClipboardService } from './diagram-clipboard.service';
import {
  sanitizeBoundaryBoxName,
  isSystemBoundaryBox,
} from '../components/diagram-canvas/nodes';

export interface DropNodePayload {
  type: 'toolbox_node' | 'explorer_node';
  nodeType?: string;
  stereotype?: UmlStereotype | string | null;
  nodeData?: UmlClassNode;
  node?: UmlClassNode;
  sourceDiagramId?: string;
  sourceDiagramType?: DiagramType;
}

@Injectable({
  providedIn: 'root',
})
export class DiagramNodeOperationsService {
  private readonly nodeFactory: DiagramNodeFactoryService;
  private readonly clipboardService: DiagramClipboardService;

  constructor(
    nodeFactory?: DiagramNodeFactoryService,
    clipboardService?: DiagramClipboardService,
  ) {
    if (nodeFactory) {
      this.nodeFactory = nodeFactory;
    } else {
      let injectedFactory: DiagramNodeFactoryService | null = null;
      try {
        injectedFactory = inject(DiagramNodeFactoryService, { optional: true });
      } catch {
        // Outside Angular DI context
      }
      this.nodeFactory = injectedFactory ?? new DiagramNodeFactoryService();
    }

    if (clipboardService) {
      this.clipboardService = clipboardService;
    } else {
      let injectedClipboard: DiagramClipboardService | null = null;
      try {
        injectedClipboard = inject(DiagramClipboardService, { optional: true });
      } catch {
        // Outside Angular DI context
      }
      this.clipboardService = injectedClipboard ?? new DiagramClipboardService();
    }
  }

  /**
   * Calcula los nodos y conexiones que deben eliminarse en cascada al borrar un nodo
   */
  computeCascadeDeleteNode(
    nodeId: string,
    nodes: UmlClassNode[],
    connections: UmlConnection[],
  ): { nodesToDelete: Set<string>; connsToDelete: Set<string> } {
    const nodesToDelete = new Set<string>([nodeId]);
    const connsToDelete = new Set<string>();

    // 1. Identificar conexiones que tocan directamente a nodeId
    const directConns = connections.filter((c) => {
      const sourceBase = c.sourceNodeId || c.sourceId.replace(/_(top|bottom|left|right)$/, '');
      const targetBase = c.targetNodeId || c.targetId.replace(/_(top|bottom|left|right)$/, '');
      return sourceBase === nodeId || targetBase === nodeId;
    });

    directConns.forEach((c) => {
      connsToDelete.add(c.id);

      if (c.assocAnchorNodeId) {
        nodesToDelete.add(c.assocAnchorNodeId);
      }

      nodes.forEach((n) => {
        if (n.assocMainConnId === c.id) {
          nodesToDelete.add(n.id);
        }
      });
    });

    // 2. Si el propio nodo a eliminar es una tabla intermedia
    const targetNode = nodes.find((n) => n.id === nodeId);
    if (targetNode?.assocMainConnId) {
      connsToDelete.add(targetNode.assocMainConnId);
      const mainConn = connections.find((c) => c.id === targetNode.assocMainConnId);
      if (mainConn?.assocAnchorNodeId) {
        nodesToDelete.add(mainConn.assocAnchorNodeId);
      }
    }

    // 3. Buscar todas las tablas/anclas asociadas por conexiones tipo 'association_class'
    connections.forEach((c) => {
      if (c.type === 'association_class') {
        const sourceBase = c.sourceNodeId || c.sourceId.replace(/_(top|bottom|left|right)$/, '');
        const targetBase = c.targetNodeId || c.targetId.replace(/_(top|bottom|left|right)$/, '');
        if (nodesToDelete.has(sourceBase)) nodesToDelete.add(targetBase);
        if (nodesToDelete.has(targetBase)) nodesToDelete.add(sourceBase);
      }
    });

    // 4. Si cualquier nodo ancla o tabla intermedia está marcado, marcar la conexión principal
    connections.forEach((c) => {
      if (c.assocAnchorNodeId && nodesToDelete.has(c.assocAnchorNodeId)) {
        connsToDelete.add(c.id);
      }
    });
    nodes.forEach((n) => {
      if (n.assocMainConnId && nodesToDelete.has(n.id)) {
        connsToDelete.add(n.assocMainConnId);
      }
    });

    // 5. Eliminar todas las conexiones que toquen a cualquiera de los nodos marcados
    connections.forEach((c) => {
      const sourceBase = c.sourceNodeId || c.sourceId.replace(/_(top|bottom|left|right)$/, '');
      const targetBase = c.targetNodeId || c.targetId.replace(/_(top|bottom|left|right)$/, '');
      if (nodesToDelete.has(sourceBase) || nodesToDelete.has(targetBase)) {
        connsToDelete.add(c.id);
      }
    });

    return { nodesToDelete, connsToDelete };
  }

  /**
   * Ejecuta la eliminación en cascada de un nodo y retorna las listas resultantes
   */
  executeCascadeDeleteNode(
    nodeId: string,
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    selectedNodeId: string | null,
    recalculateSequenceNumbers: (conns: UmlConnection[]) => UmlConnection[],
  ): {
    remainingNodes: UmlClassNode[];
    remainingConnections: UmlConnection[];
    nextSelectedNodeId: string | null;
  } {
    const { nodesToDelete, connsToDelete } = this.computeCascadeDeleteNode(nodeId, nodes, connections);
    const remainingNodes = nodes.filter((n) => !nodesToDelete.has(n.id));
    const filteredConns = connections.filter((c) => !connsToDelete.has(c.id));
    const remainingConnections = recalculateSequenceNumbers(filteredConns);
    const nextSelectedNodeId =
      selectedNodeId === nodeId || nodesToDelete.has(selectedNodeId || '') ? null : selectedNodeId;

    return { remainingNodes, remainingConnections, nextSelectedNodeId };
  }

  /**
   * Ejecuta la eliminación en cascada de múltiples nodos seleccionados de forma atómica
   */
  executeCascadeDeleteNodes(
    nodeIds: string[],
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    recalculateSequenceNumbers: (conns: UmlConnection[]) => UmlConnection[],
  ): {
    remainingNodes: UmlClassNode[];
    remainingConnections: UmlConnection[];
  } {
    const allNodesToDelete = new Set<string>();
    const allConnsToDelete = new Set<string>();

    for (const nodeId of nodeIds) {
      const { nodesToDelete, connsToDelete } = this.computeCascadeDeleteNode(nodeId, nodes, connections);
      for (const nid of nodesToDelete) allNodesToDelete.add(nid);
      for (const cid of connsToDelete) allConnsToDelete.add(cid);
    }

    const remainingNodes = nodes.filter((n) => !allNodesToDelete.has(n.id));
    const filteredConns = connections.filter((c) => !allConnsToDelete.has(c.id));
    const remainingConnections = recalculateSequenceNumbers(filteredConns);

    return { remainingNodes, remainingConnections };
  }

  /**
   * Guarda las ediciones de un nodo saneando su estereotipo
   */
  saveEditedNode(
    nodes: UmlClassNode[],
    savedNode: UmlClassNode,
    activeDiagramType: DiagramType,
  ): UmlClassNode[] {
    const sanitizedNode = this.sanitizeNodeStereotype(savedNode, activeDiagramType);
    return nodes.map((n) => (n.id === sanitizedNode.id ? sanitizedNode : n));
  }

  /**
   * Crea un nodo según su tipo utilizando DiagramNodeFactoryService
   */
  createNode(
    type: string,
    params: {
      nodes: UmlClassNode[];
      activeDiagramType: DiagramType;
      position?: { x: number; y: number };
      stereotype?: UmlStereotype | string | null;
      scrollOffset?: { scrollLeft: number; scrollTop: number };
    },
  ): UmlClassNode {
    const { nodes, activeDiagramType, position, stereotype, scrollOffset } = params;

    switch (type) {
      case 'component':
        return this.nodeFactory.createComponentNode(nodes, position, scrollOffset);
      case 'device':
        return this.nodeFactory.createDeviceNode(nodes, position, scrollOffset);
      case 'executionEnvironment':
      case 'node':
        return this.nodeFactory.createExecutionEnvironmentNode(nodes, position, scrollOffset);
      case 'boundary_box':
        return this.nodeFactory.createBoundaryBoxNode(activeDiagramType, position, scrollOffset);
      case 'actor':
        return this.nodeFactory.createActorNode(nodes, activeDiagramType, position, scrollOffset);
      case 'use_case':
        return this.nodeFactory.createUseCaseNode(nodes, position, scrollOffset);
      case 'package':
        return this.nodeFactory.createPackageNode(nodes, position, scrollOffset);
      case 'boundary':
        return this.nodeFactory.createBoundaryNode(nodes, position, scrollOffset);
      case 'control':
        return this.nodeFactory.createControlNode(nodes, position, scrollOffset);
      case 'entity':
        return this.nodeFactory.createEntityNode(nodes, position, scrollOffset);
      case 'lifeline':
        return this.nodeFactory.createLifelineNode(nodes, activeDiagramType, position, scrollOffset);
      case 'note':
        return this.nodeFactory.createNoteNode(nodes, position, scrollOffset);
      case 'package_layer':
        return this.nodeFactory.createPackageLayerNode(nodes, position, scrollOffset);
      case 'activity_initial':
      case 'activity_final':
      case 'activity_action':
      case 'activity_decision':
      case 'activity_fork':
        return this.nodeFactory.createActivityNode(type, nodes, position, scrollOffset);
      case 'class':
      default:
        return this.nodeFactory.createClassNode(nodes, activeDiagramType, position, stereotype, scrollOffset);
    }
  }

  /**
   * Valida compatibilidad y crea un nodo de diagrama tipado
   */
  createValidatedNode(
    type: string,
    params: {
      isReadOnly: boolean;
      activeDiagramType: DiagramType;
      nodes: UmlClassNode[];
      position?: { x: number; y: number };
      stereotype?: UmlStereotype | string | null;
      scrollOffset: { scrollLeft: number; scrollTop: number };
      onIncompatible: (currentType: DiagramType) => void;
    },
  ): UmlClassNode | null {
    if (params.isReadOnly) return null;
    const validation = this.validateNodeAddition(type, params.activeDiagramType);
    if (!validation.allowed) {
      params.onIncompatible(params.activeDiagramType);
      return null;
    }
    type = validation.redirectType || type;
    return this.createNode(type, {
      nodes: params.nodes,
      activeDiagramType: params.activeDiagramType,
      position: params.position,
      stereotype: params.stereotype,
      scrollOffset: params.scrollOffset,
    });
  }

  /**
   * Helper para obtener el label legible del tipo de nodo
   */
  getNodeTypeReadableLabel(nodeType?: string): string {
    switch (nodeType) {
      case 'actor':
        return 'Actor';
      case 'use_case':
        return 'Caso de Uso';
      case 'package':
        return 'Paquete';
      case 'boundary':
        return 'Boundary';
      case 'control':
        return 'Control';
      case 'entity':
        return 'Entidad';
      case 'component':
        return 'Componente';
      case 'device':
      case 'node':
        return 'Nodo';
      default:
        return 'Clase';
    }
  }

  /**
   * Actualiza el color de los nodos seleccionados
   */
  updateNodesColor(
    nodes: UmlClassNode[],
    targetIds: string[],
    color: string | null,
    getDefaultColor?: (type?: string | null, stereotype?: string | null) => string,
  ): { anyChanged: boolean; updatedNodes: UmlClassNode[] } {
    if (targetIds.length === 0) return { anyChanged: false, updatedNodes: nodes };
    const anyChanged = nodes.some((node) => {
      if (!targetIds.includes(node.id) || node.isAnchor) return false;
      const targetColor = color !== null ? color : (getDefaultColor ? getDefaultColor(node.nodeType, node.stereotype) : '#FDFAF3');
      const currentColor = node.color || (getDefaultColor ? getDefaultColor(node.nodeType, node.stereotype) : '#FDFAF3');
      return currentColor !== targetColor;
    });
    if (!anyChanged) return { anyChanged: false, updatedNodes: nodes };

    const updatedNodes = nodes.map((node) => {
      if (targetIds.includes(node.id) && !node.isAnchor) {
        const targetColor = color !== null ? color : (getDefaultColor ? getDefaultColor(node.nodeType, node.stereotype) : '#FDFAF3');
        return { ...node, color: targetColor };
      }
      return node;
    });
    return { anyChanged: true, updatedNodes };
  }

  /**
   * Renombra un nodo con soporte para validaciones de casos especiales (boundary_box)
   */
  renameNode(
    nodes: UmlClassNode[],
    nodeId: string,
    newName: string,
  ): { anyChanged: boolean; updatedNodes: UmlClassNode[] } {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return { anyChanged: false, updatedNodes: nodes };
    let finalName = newName ?? '';
    if (isSystemBoundaryBox(node.nodeType)) {
      finalName = sanitizeBoundaryBoxName(finalName);
    }
    if (node.name === finalName) return { anyChanged: false, updatedNodes: nodes };

    const updatedNodes = nodes.map((n) => (n.id === nodeId ? { ...n, name: finalName } : n));
    return { anyChanged: true, updatedNodes };
  }

  /**
   * Saneamiento y validación de estereotipos UML según el tipo de diagrama
   */
  sanitizeNodeStereotype(savedNode: UmlClassNode, activeDiagramType: DiagramType): UmlClassNode {
    const dt = (activeDiagramType || '').toLowerCase().trim();
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
    return savedNode;
  }

  /**
   * Valida la compatibilidad de añadir un tipo de nodo según el tipo de diagrama actual
   */
  validateNodeAddition(
    nodeType: string,
    currentType: DiagramType,
  ): { allowed: boolean; redirectType?: string } {
    const isClass = !nodeType || nodeType === 'class';
    const isPureBce = nodeType === 'boundary' || nodeType === 'control' || nodeType === 'entity';
    const isActor = nodeType === 'actor';
    const isUseCase = nodeType === 'use_case';
    const isPackage = nodeType === 'package';
    const isComponent = nodeType === 'component';
    const isDeploymentNode =
      nodeType === 'device' || nodeType === 'node' || nodeType === 'executionEnvironment';
    const isLifeline = nodeType === 'lifeline';
    const isBoundaryBox = nodeType === 'boundary_box';

    switch (currentType) {
      case DiagramType.CLASS:
        // En diagramas de clases: solo clases estándar
        if (isClass) return { allowed: true };
        return { allowed: false };

      case DiagramType.USE_CASE:
        // En casos de uso: solo actores, casos de uso y recuadro delimitador del sistema
        if (isActor || isUseCase || isBoundaryBox) return { allowed: true };
        return { allowed: false };

      case DiagramType.SEQUENCE:
        // En secuencia: lifelines, actores, clases o BCE que actúan como líneas de vida
        if (isLifeline || isActor || isClass || isPureBce) return { allowed: true };
        return { allowed: false };

      case DiagramType.COMMUNICATION:
        // En comunicación: solo actores y símbolos BCE puros (boundary, control, entity)
        if (isActor || isPureBce) return { allowed: true };
        return { allowed: false };

      case DiagramType.CLASS_ANALYSIS:
        // En análisis de clases: clases (con estereotipos) y actores; no BCE puros ni casos de uso
        if (isClass || isActor) return { allowed: true };
        return { allowed: false };

      case DiagramType.PACKAGE:
        // En paquetes: paquetes, casos de uso, actores
        if (isPackage || isUseCase || isActor) return { allowed: true };
        return { allowed: false };

      case DiagramType.COMPONENT:
        if (isComponent || isBoundaryBox || isPackage) return { allowed: true };
        if (isClass) return { allowed: true, redirectType: 'component' };
        return { allowed: false };

      case DiagramType.DEPLOYMENT:
        if (isDeploymentNode || isComponent || isBoundaryBox || isPackage) return { allowed: true };
        if (isClass) return { allowed: true, redirectType: 'executionEnvironment' };
        return { allowed: false };

      case DiagramType.LAYERED:
        if (isPackage || isBoundaryBox) return { allowed: true };
        if (isClass) return { allowed: true, redirectType: 'package' };
        return { allowed: false };

      default:
        return { allowed: true };
    }
  }

  /**
   * Actualiza las dimensiones y posición de un nodo tras redimensionamiento en lienzo
   */
  updateNodeSize(
    nodes: UmlClassNode[],
    event: { node: UmlClassNode; width: number; height?: number; position: { x: number; y: number } },
  ): UmlClassNode[] {
    const isLifeline = event.node.nodeType === 'lifeline';
    const finalHeight = isLifeline ? 60 : event.height;
    return nodes.map((n) =>
      n.id === event.node.id
        ? {
            ...n,
            customWidth: event.width,
            customHeight: finalHeight,
            isCustomSize: true,
            width: event.width,
            height: finalHeight,
            position: event.position,
          }
        : n,
    );
  }

  /**
   * Actualiza el desplazamiento de etiqueta libre de un nodo
   */
  updateNodeLabelOffset(
    nodes: UmlClassNode[],
    nodeId: string,
    offset: { x: number; y: number },
  ): UmlClassNode[] {
    return nodes.map((n) => (n.id === nodeId ? { ...n, labelOffset: { ...offset } } : n));
  }

  /**
   * Procesa el drop de elementos provenientes del Toolbox o del Explorador
   */
  handleNodeDropped(
    event: { payload: DropNodePayload; position: { x: number; y: number } },
    handlers: {
      isReadOnly: boolean;
      onDropToolbox: (nodeType: string, position: { x: number; y: number }, stereotype?: UmlStereotype | string | null) => void;
      onCopyExplorer: (data: { node: UmlClassNode; sourceDiagramId?: string; sourceDiagramType?: DiagramType; position: { x: number; y: number } }) => void;
    },
  ): void {
    if (handlers.isReadOnly || !event.payload) return;
    const { payload, position } = event;
    if (payload.type === 'toolbox_node') {
      const type = payload.nodeType === 'node' ? 'executionEnvironment' : (payload.nodeType || 'class');
      handlers.onDropToolbox(type, position, payload.stereotype);
    } else if (payload.type === 'explorer_node') {
      const node = payload.nodeData || payload.node;
      if (node) {
        handlers.onCopyExplorer({
          node,
          sourceDiagramId: payload.sourceDiagramId,
          sourceDiagramType: payload.sourceDiagramType,
          position,
        });
      }
    }
  }

  /**
   * Selecciona y desplaza la vista hacia un nodo seleccionado desde el Explorador
   */
  handleSelectNodeFromExplorer(
    nodeId: string,
    nodes: UmlClassNode[],
    canvas?: any,
    onSelect?: (nodeId: string) => void,
  ): void {
    onSelect?.(nodeId);
    canvas?.select([nodeId], []);
    const node = nodes.find((n) => n.id === nodeId);
    if (node && node.position) {
      const scrollEl = canvas?.flowContainerRef?.nativeElement;
      if (scrollEl) {
        scrollEl.scrollLeft = Math.max(0, node.position.x - 200);
        scrollEl.scrollTop = Math.max(0, node.position.y - 150);
      }
    }
  }
}
