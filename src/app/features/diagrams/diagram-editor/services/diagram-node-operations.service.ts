import { Injectable, inject } from '@angular/core';
import {
  DiagramType,
  UmlClassNode,
  UmlConnection,
  UmlStereotype,
} from '../../../../core/models/diagram.model';
import { DiagramNodeFactoryService } from './diagram-node-factory.service';
import { DiagramClipboardService } from './diagram-clipboard.service';

export interface DropNodePayload {
  type: 'toolbox_node' | 'explorer_node';
  nodeType?: string;
  stereotype?: UmlStereotype | string | null;
  nodeData?: any;
  node?: any;
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
      case 'class':
      default:
        return this.nodeFactory.createClassNode(nodes, activeDiagramType, position, stereotype, scrollOffset);
    }
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
  ): { anyChanged: boolean; updatedNodes: UmlClassNode[] } {
    if (targetIds.length === 0) return { anyChanged: false, updatedNodes: nodes };
    const newColor = color || '#FDFAF3';
    const anyChanged = nodes.some(
      (node) => targetIds.includes(node.id) && !node.isAnchor && (node.color || '#FDFAF3') !== newColor,
    );
    if (!anyChanged) return { anyChanged: false, updatedNodes: nodes };

    const updatedNodes = nodes.map((node) => {
      if (targetIds.includes(node.id) && !node.isAnchor) {
        return { ...node, color: newColor };
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
    if (node.nodeType === 'boundary_box' && (!finalName.trim() || finalName === 'ClassName')) {
      finalName = '.';
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
    if (nodeType === 'class') {
      if (currentType === DiagramType.COMMUNICATION) {
        return { allowed: false };
      }
      if (currentType === DiagramType.COMPONENT) {
        return { allowed: true, redirectType: 'component' };
      }
      if (currentType === DiagramType.DEPLOYMENT) {
        return { allowed: true, redirectType: 'executionEnvironment' };
      }
      if (currentType === DiagramType.LAYERED) {
        return { allowed: true, redirectType: 'package' };
      }
      return { allowed: true };
    }

    if (nodeType === 'actor') {
      if (currentType === DiagramType.CLASS) {
        return { allowed: false };
      }
      return { allowed: true };
    }

    if (nodeType === 'boundary' || nodeType === 'control' || nodeType === 'entity') {
      if (currentType === DiagramType.CLASS_ANALYSIS || currentType === DiagramType.CLASS) {
        return { allowed: false };
      }
      return { allowed: true };
    }

    return { allowed: true };
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
}
