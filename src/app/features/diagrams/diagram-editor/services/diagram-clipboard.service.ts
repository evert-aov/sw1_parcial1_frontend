import { Injectable } from '@angular/core';
import { DiagramType, UmlClassNode, UmlConnection } from '../../../../core/models/diagram.model';

export interface ClipboardData {
  diagramType: DiagramType;
  nodes: UmlClassNode[];
  connections: UmlConnection[];
}

export interface PasteResult {
  newNodes: UmlClassNode[];
  newConnections: UmlConnection[];
  newPastedIds: string[];
}

@Injectable({
  providedIn: 'root',
})
export class DiagramClipboardService {
  private clipboardData: ClipboardData | null = null;
  private readonly storageKey = 'uml_clipboard_nodes';

  hasClipboardContent(): boolean {
    if (this.clipboardData && this.clipboardData.nodes && this.clipboardData.nodes.length > 0) {
      return true;
    }
    try {
      const stored = sessionStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed && parsed.nodes && parsed.nodes.length > 0;
      }
    } catch (_) {}
    return false;
  }

  getClipboard(): ClipboardData | null {
    if (this.clipboardData) return this.clipboardData;
    try {
      const saved = sessionStorage.getItem(this.storageKey);
      if (saved) {
        this.clipboardData = JSON.parse(saved);
        return this.clipboardData;
      }
    } catch (_) {}
    return null;
  }

  copyNodes(
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    selectedNodeIds: Set<string>,
    selectedNodeId: string | null,
    activeDiagramType: DiagramType,
  ): { copiedNodesCount: number; copiedConnsCount: number; sampleName: string } | null {
    const ids = Array.from(selectedNodeIds);
    if (selectedNodeId && !ids.includes(selectedNodeId)) ids.push(selectedNodeId);

    const nodesToCopy = nodes.filter((n) => ids.includes(n.id) && !n.isAnchor);
    if (nodesToCopy.length === 0) return null;

    const copiedNodeIdSet = new Set(nodesToCopy.map((n) => n.id));

    const connectionsToCopy = connections.filter((c) => {
      const s = c.sourceNodeId || c.sourceId?.replace(/_(top|bottom|left|right)$/, '');
      const t = c.targetNodeId || c.targetId?.replace(/_(top|bottom|left|right)$/, '');
      return s && t && copiedNodeIdSet.has(s) && copiedNodeIdSet.has(t);
    });

    this.clipboardData = {
      diagramType: activeDiagramType,
      nodes: JSON.parse(JSON.stringify(nodesToCopy)),
      connections: JSON.parse(JSON.stringify(connectionsToCopy)),
    };

    try {
      sessionStorage.setItem(this.storageKey, JSON.stringify(this.clipboardData));
    } catch (_) {}

    return {
      copiedNodesCount: nodesToCopy.length,
      copiedConnsCount: connectionsToCopy.length,
      sampleName: nodesToCopy[0].name,
    };
  }

  isPasteCompatible(clip: ClipboardData, currentType: DiagramType): boolean {
    if (currentType === DiagramType.USE_CASE) {
      return !clip.nodes.some((n) => n.nodeType !== 'actor' && n.nodeType !== 'use_case');
    } else if (currentType === DiagramType.PACKAGE) {
      return !clip.nodes.some((n) => n.nodeType !== 'package' && n.nodeType !== 'use_case' && n.nodeType !== 'actor');
    } else if (currentType === DiagramType.COMMUNICATION) {
      return !clip.nodes.some((n) => n.nodeType !== 'boundary' && n.nodeType !== 'control' && n.nodeType !== 'entity' && n.nodeType !== 'actor');
    } else if (currentType === DiagramType.SEQUENCE) {
      return !clip.nodes.some((n) => n.nodeType !== 'actor' && n.nodeType !== 'lifeline' && n.nodeType !== 'class' && n.nodeType !== 'boundary' && n.nodeType !== 'control' && n.nodeType !== 'entity');
    } else if (currentType === DiagramType.CLASS_ANALYSIS) {
      return !clip.nodes.some((n) => (n.nodeType !== 'class' && n.nodeType !== undefined) && n.nodeType !== 'actor');
    } else if (currentType === DiagramType.COMPONENT) {
      return !clip.nodes.some((n) => n.nodeType !== 'component' && n.nodeType !== 'boundary_box' && n.nodeType !== 'package');
    } else if (currentType === DiagramType.DEPLOYMENT) {
      return !clip.nodes.some((n) => n.nodeType === 'actor' || n.nodeType === 'use_case' || n.nodeType === 'lifeline');
    } else if (currentType === DiagramType.LAYERED) {
      return !clip.nodes.some((n) => n.nodeType !== 'package' && n.nodeType !== 'boundary_box');
    } else if (currentType === DiagramType.CLASS) {
      return !clip.nodes.some((n) => n.nodeType && n.nodeType !== 'class');
    }
    return true;
  }

  createPastedElements(
    clip: ClipboardData,
    currentNodes: UmlClassNode[],
    currentType: DiagramType,
    targetPos?: { x: number; y: number },
    scrollLeft = 0,
    scrollTop = 0,
  ): PasteResult {
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

      const isSameDiagram = clip.diagramType === currentType && currentNodes.some((n) => n.name === src.name);
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

    return {
      newNodes,
      newConnections,
      newPastedIds,
    };
  }

  /**
   * Valida si un nodo individual es semánticamente compatible con el tipo de diagrama destino.
   */
  isNodeCompatibleWithDiagramType(node: any, currentType: DiagramType): boolean {
    const isClassNode = !node.nodeType || node.nodeType === 'class';
    const isPureBceNode = node.nodeType === 'boundary' || node.nodeType === 'control' || node.nodeType === 'entity';

    if (currentType === DiagramType.USE_CASE) {
      return node.nodeType === 'actor' || node.nodeType === 'use_case';
    } else if (currentType === DiagramType.PACKAGE) {
      return node.nodeType === 'package' || node.nodeType === 'use_case' || node.nodeType === 'actor';
    } else if (currentType === DiagramType.COMMUNICATION) {
      return !isClassNode && (isPureBceNode || node.nodeType === 'actor');
    } else if (currentType === DiagramType.SEQUENCE) {
      return node.nodeType === 'actor' || node.nodeType === 'lifeline' || isClassNode || isPureBceNode;
    } else if (currentType === DiagramType.CLASS_ANALYSIS) {
      return !isPureBceNode && (isClassNode || node.nodeType === 'actor');
    } else if (currentType === DiagramType.COMPONENT) {
      return node.nodeType === 'component' || node.nodeType === 'boundary_box' || node.nodeType === 'package';
    } else if (currentType === DiagramType.DEPLOYMENT) {
      return (
        node.nodeType === 'device' ||
        node.nodeType === 'node' ||
        node.nodeType === 'executionEnvironment' ||
        node.nodeType === 'component' ||
        node.nodeType === 'boundary_box' ||
        node.nodeType === 'package' ||
        isClassNode
      );
    } else if (currentType === DiagramType.LAYERED) {
      return node.nodeType === 'package' || node.nodeType === 'boundary_box';
    } else if (currentType === DiagramType.CLASS) {
      return isClassNode;
    }
    return true;
  }

  /**
   * Clona y adapta un nodo arrastrado o copiado desde el explorador hacia el diagrama activo.
   */
  createExplorerCopiedNode(
    node: any,
    currentType: DiagramType,
    existingNodes: UmlClassNode[],
    isCurrentDiag: boolean,
    dropPosition?: { x: number; y: number },
    scrollOffset: { scrollLeft: number; scrollTop: number } = { scrollLeft: 0, scrollTop: 0 },
    defaultColorGetter?: (nodeType?: string | null, stereotype?: string | null) => string,
  ): UmlClassNode {
    const isBce = node.nodeType === 'boundary' || node.nodeType === 'control' || node.nodeType === 'entity';
    const isDeploymentNode = node.nodeType === 'device' || node.nodeType === 'node' || node.nodeType === 'executionEnvironment';
    const width = node.width || (node.nodeType === 'actor' ? 65 : (node.nodeType === 'use_case' ? 140 : (node.nodeType === 'package' ? 200 : (node.nodeType === 'component' ? 190 : (isDeploymentNode ? 240 : (isBce ? 90 : 220))))));
    const height = node.height || (node.nodeType === 'actor' ? 95 : (node.nodeType === 'use_case' ? 60 : (node.nodeType === 'package' ? 120 : (node.nodeType === 'component' ? 70 : (isDeploymentNode ? 150 : (isBce ? 95 : null))))));

    let posX: number;
    let posY: number;

    if (dropPosition) {
      posX = Math.max(20, Math.round(dropPosition.x - width / 2));
      posY = (currentType === DiagramType.SEQUENCE && (node.nodeType === 'actor' || node.nodeType === 'lifeline'))
        ? 50
        : Math.max(20, Math.round(dropPosition.y - (height || 80) / 2));
    } else {
      posX = isCurrentDiag && node.position?.x
        ? node.position.x + 40
        : Math.max(60, Math.round(scrollOffset.scrollLeft + 150 + Math.random() * 50));
      posY = isCurrentDiag && node.position?.y
        ? node.position.y + 40
        : Math.max(60, Math.round(scrollOffset.scrollTop + 100 + Math.random() * 50));

      if (currentType === DiagramType.SEQUENCE && (node.nodeType === 'actor' || node.nodeType === 'lifeline')) {
        posY = 50;
        const topNodes = existingNodes.filter((n) => (n.nodeType === 'lifeline' || n.nodeType === 'actor') && !n.isAnchor);
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
      const sameNameCount = existingNodes.filter((n) => n.name.startsWith(node.name)).length;
      newName = sameNameCount > 0 ? `${node.name}_Copia` : node.name;
    }

    const newNodeId = `${node.nodeType || 'node'}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const resolvedNodeType = node.nodeType || (currentType === DiagramType.USE_CASE ? 'use_case' : (currentType === DiagramType.PACKAGE ? 'package' : (currentType === DiagramType.COMMUNICATION ? 'boundary' : 'class')));
    const resolvedStereotype = node.stereotype || null;
    const resolvedWidth = width;
    const resolvedHeight = height;

    const isExplicitSizeNode = ['component', 'device', 'node', 'executionEnvironment', 'boundary_box', 'package'].includes(resolvedNodeType);
    return {
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
      color: node.color || (defaultColorGetter ? defaultColorGetter(resolvedNodeType, resolvedStereotype) : '#FFFFFF'),
      attributes: (node.attributes || []).map((a: any) => ({ ...a })),
      methods: (node.methods || []).map((m: any) => ({ ...m })),
    };
  }

  /**
   * Genera el mensaje de toast para una operación de copia
   */
  formatCopyToast(result: { copiedNodesCount: number; copiedConnsCount: number; sampleName: string }): string {
    let toast = result.copiedNodesCount === 1 ? `"${result.sampleName}" copiado` : `${result.copiedNodesCount} elementos copiados`;
    if (result.copiedConnsCount > 0) {
      toast += ` (${result.copiedConnsCount} ${result.copiedConnsCount === 1 ? 'relación' : 'relaciones'})`;
    }
    return toast;
  }

  /**
   * Genera el mensaje de toast para una operación de pegado
   */
  formatPasteToast(newNodes: UmlClassNode[], newConnections: UmlConnection[]): string {
    let toast = newNodes.length === 1 ? `"${newNodes[0].name}" pegado en el lienzo` : `${newNodes.length} elementos pegados`;
    if (newConnections.length > 0) {
      toast += ` con ${newConnections.length} ${newConnections.length === 1 ? 'relación' : 'relaciones'}`;
    }
    return toast;
  }

  /**
   * Ejecuta la validación y generación de elementos pegados
   */
  executePaste(params: {
    isReadOnly: boolean;
    activeDiagramType: DiagramType;
    nodes: UmlClassNode[];
    targetPos?: { x: number; y: number };
    scrollOffset: { scrollLeft: number; scrollTop: number };
    onIncompatible: (currentType: DiagramType) => void;
  }): { newNodes: UmlClassNode[]; newConnections: UmlConnection[]; newPastedIds: string[] } | null {
    if (params.isReadOnly) return null;
    const clip = this.getClipboard();
    if (!clip || !clip.nodes || clip.nodes.length === 0) return null;

    if (!this.isPasteCompatible(clip, params.activeDiagramType)) {
      params.onIncompatible(params.activeDiagramType);
      return null;
    }

    return this.createPastedElements(
      clip,
      params.nodes,
      params.activeDiagramType,
      params.targetPos,
      params.scrollOffset.scrollLeft,
      params.scrollOffset.scrollTop,
    );
  }

  /**
   * Ejecuta la validación y creación de un nodo arrastrado/copiado desde el explorador
   */
  executeCopyFromExplorer(params: {
    isReadOnly: boolean;
    node: UmlClassNode;
    sourceDiagramId: string;
    currentDiagramId: string | null;
    activeDiagramType: DiagramType;
    nodes: UmlClassNode[];
    position?: { x: number; y: number };
    scrollOffset: { scrollLeft: number; scrollTop: number };
    getDefaultColor: (nodeType?: string | null, stereotype?: string | null) => string;
    onIncompatible: (currentType: DiagramType) => void;
  }): UmlClassNode | null {
    if (params.isReadOnly || !params.node) return null;
    if (!this.isNodeCompatibleWithDiagramType(params.node, params.activeDiagramType)) {
      params.onIncompatible(params.activeDiagramType);
      return null;
    }
    return this.createExplorerCopiedNode(
      params.node,
      params.activeDiagramType,
      params.nodes,
      params.sourceDiagramId === params.currentDiagramId,
      params.position,
      params.scrollOffset,
      params.getDefaultColor,
    );
  }
}
