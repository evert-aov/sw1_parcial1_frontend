import { Injectable } from '@angular/core';
import { DiagramType, UmlClassNode } from '../../../../core/models/diagram.model';

@Injectable({
  providedIn: 'root',
})
export class DiagramContainmentService {
  readonly lastNodeDragPos = new Map<string, { x: number; y: number }>();
  readonly currentDragDescendantIds = new Set<string>();
  isDraggingNode = false;

  /** Índice padre → hijos directos, calculado una vez al iniciar el arrastre (O(n²) amortizado por gesto). */
  private containmentIndex: Map<string, string[]> | null = null;

  /**
   * Determina si un nodo hijo se encuentra geométricamente dentro de los límites de un nodo contenedor (Package/Subsystem).
   */
  isNodeInsideParent(
    child: UmlClassNode,
    parent: UmlClassNode,
    getNodeWidth: (n: UmlClassNode) => number,
    getNodeHeight: (n: UmlClassNode) => number,
  ): boolean {
    if (child.id === parent.id || child.isAnchor || parent.isAnchor) return false;
    const parentW = getNodeWidth(parent);
    const parentH = getNodeHeight(parent) || 60;
    const childW = getNodeWidth(child);
    const childH = getNodeHeight(child) || 60;

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

  /**
   * Pre-indexa la contención geométrica: `parentId → childIds` (hijos directos por geometría).
   * Permite resolver descendientes con un BFS sobre el índice, sin recalcular geometría por nivel.
   */
  buildContainmentIndex(
    allNodes: UmlClassNode[],
    getNodeWidth: (n: UmlClassNode) => number,
    getNodeHeight: (n: UmlClassNode) => number,
  ): Map<string, string[]> {
    const index = new Map<string, string[]>();
    for (const parent of allNodes) {
      if (parent.isAnchor) continue;
      for (const child of allNodes) {
        if (this.isNodeInsideParent(child, parent, getNodeWidth, getNodeHeight)) {
          const children = index.get(parent.id);
          if (children) children.push(child.id);
          else index.set(parent.id, [child.id]);
        }
      }
    }
    return index;
  }

  /**
   * Resuelve los descendientes transitivos de un nodo usando un índice de contención ya construido.
   */
  getDescendantsFromIndex(parentNodeId: string, index: Map<string, string[]>): Set<string> {
    const descendants = new Set<string>();
    const visited = new Set<string>([parentNodeId]);
    const queue: string[] = [parentNodeId];
    for (let head = 0; head < queue.length; head++) {
      for (const childId of index.get(queue[head]) ?? []) {
        if (!visited.has(childId)) {
          visited.add(childId);
          descendants.add(childId);
          queue.push(childId);
        }
      }
    }
    return descendants;
  }

  /**
   * Obtiene todos los IDs de nodos descendientes jerárquicos de forma recursiva (BFS).
   */
  getDescendantNodeIds(
    parentNodeId: string,
    allNodes: UmlClassNode[],
    getNodeWidth: (n: UmlClassNode) => number,
    getNodeHeight: (n: UmlClassNode) => number,
  ): Set<string> {
    const descendants = new Set<string>();
    const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
    const parent = nodeMap.get(parentNodeId);
    if (!parent) return descendants;

    const queue: UmlClassNode[] = [parent];
    const visited = new Set<string>([parentNodeId]);

    for (let head = 0; head < queue.length; head++) {
      const current = queue[head];
      for (const candidate of allNodes) {
        if (
          !visited.has(candidate.id) &&
          this.isNodeInsideParent(candidate, current, getNodeWidth, getNodeHeight)
        ) {
          visited.add(candidate.id);
          descendants.add(candidate.id);
          queue.push(candidate);
        }
      }
    }
    return descendants;
  }

  /**
   * Recopila todos los IDs de descendientes a partir de un conjunto de IDs raíz.
   */
  collectDescendantsForRoots(
    rootIds: Iterable<string>,
    allNodes: UmlClassNode[],
    getNodeWidth: (n: UmlClassNode) => number,
    getNodeHeight: (n: UmlClassNode) => number,
  ): Set<string> {
    const result = new Set<string>();
    for (const rootId of rootIds) {
      const descendants = this.getDescendantNodeIds(rootId, allNodes, getNodeWidth, getNodeHeight);
      for (const id of descendants) {
        result.add(id);
      }
    }
    return result;
  }

  /**
   * Inicia un ciclo de arrastre recopilando los descendientes de los nodos a mover.
   */
  startDrag(
    rootIds: Iterable<string>,
    allNodes: UmlClassNode[],
    getNodeWidth: (n: UmlClassNode) => number,
    getNodeHeight: (n: UmlClassNode) => number,
  ): void {
    this.isDraggingNode = true;
    this.currentDragDescendantIds.clear();
    this.containmentIndex = this.buildContainmentIndex(allNodes, getNodeWidth, getNodeHeight);
    for (const rootId of rootIds) {
      for (const id of this.getDescendantsFromIndex(rootId, this.containmentIndex)) {
        this.currentDragDescendantIds.add(id);
      }
    }
  }

  /**
   * Limpia el estado de arrastre y las posiciones temporales.
   */
  resetDragState(): void {
    this.isDraggingNode = false;
    this.containmentIndex = null;
    this.lastNodeDragPos.clear();
    this.currentDragDescendantIds.clear();
  }

  /**
   * Procesa el cambio de posición de un nodo durante arrastre manual individual o múltiple,
   * propagando deltas a selección y descendientes jerárquicos.
   */
  processNodePositionChange(params: {
    node: UmlClassNode;
    newPosition: { x: number; y: number };
    nodes: UmlClassNode[];
    selectedNodeIds: Set<string>;
    selectedNodeId: string | null;
    activeDiagramType: DiagramType;
    getNodeWidth: (n: UmlClassNode) => number;
    getNodeHeight: (n: UmlClassNode) => number;
    onStartDrag: () => void;
    onSelectNode: (id: string) => void;
    sendNodeDrag: (id: string, pos: { x: number; y: number }) => void;
  }): { shouldRedraw: boolean } {
    const {
      node,
      nodes,
      selectedNodeIds,
      selectedNodeId,
      activeDiagramType,
      getNodeWidth,
      getNodeHeight,
      onStartDrag,
      onSelectNode,
      sendNodeDrag,
    } = params;

    let targetPos = params.newPosition;
    const isSequenceNode =
      activeDiagramType === DiagramType.SEQUENCE || node.nodeType === 'lifeline';
    if (isSequenceNode) {
      targetPos = { x: Math.round(targetPos.x), y: 50 };
    }

    if (!this.isDraggingNode) {
      const rootsToTrace = new Set<string>([node.id]);
      if (selectedNodeIds.has(node.id)) {
        for (const id of selectedNodeIds) {
          rootsToTrace.add(id);
        }
      }
      this.startDrag(rootsToTrace, nodes, getNodeWidth, getNodeHeight);
      onStartDrag();
    }

    if (!selectedNodeIds.has(node.id) && selectedNodeId !== node.id) {
      onSelectNode(node.id);
    }

    const last = this.lastNodeDragPos.get(node.id);
    if (last && last.x === targetPos.x && last.y === targetPos.y) {
      return { shouldRedraw: false };
    }

    let shouldRedraw = false;
    if (last) {
      const dx = targetPos.x - last.x;
      const dy = isSequenceNode ? 0 : targetPos.y - last.y;

      if (dx !== 0 || dy !== 0) {
        // 1. Mover nodos seleccionados explícitamente (selección múltiple)
        if (selectedNodeIds.size > 1 && selectedNodeIds.has(node.id)) {
          for (const other of nodes) {
            if (other.id !== node.id && selectedNodeIds.has(other.id) && !other.isAnchor) {
              const otherIsSeq =
                activeDiagramType === DiagramType.SEQUENCE || other.nodeType === 'lifeline';
              const otherY = otherIsSeq ? 50 : Math.round(other.position.y + dy);
              other.position = { x: Math.round(other.position.x + dx), y: otherY };
              sendNodeDrag(other.id, other.position);
            }
          }
        }

        // 2. Mover nodos descendientes jerárquicos contenidos (agrupación visual padre-hijo)
        if (this.currentDragDescendantIds.size > 0) {
          for (const other of nodes) {
            if (
              this.currentDragDescendantIds.has(other.id) &&
              other.id !== node.id &&
              !selectedNodeIds.has(other.id) &&
              !other.isAnchor
            ) {
              const otherIsSeq =
                activeDiagramType === DiagramType.SEQUENCE || other.nodeType === 'lifeline';
              const otherY = otherIsSeq ? 50 : Math.round(other.position.y + dy);
              other.position = { x: Math.round(other.position.x + dx), y: otherY };
              sendNodeDrag(other.id, other.position);
            }
          }
        }

        if (
          (selectedNodeIds.size > 1 && selectedNodeIds.has(node.id)) ||
          this.currentDragDescendantIds.size > 0
        ) {
          shouldRedraw = true;
        }
      }
    }

    this.lastNodeDragPos.set(node.id, { x: targetPos.x, y: targetPos.y });
    node.position = targetPos;
    sendNodeDrag(node.id, targetPos);

    return { shouldRedraw };
  }

  /**
   * Procesa el movimiento por lote de nodos (ej: evento FMoveNodesEvent del flow canvas)
   */
  processMoveNodes(params: {
    eventNodes: Array<{ id: string; position: { x: number; y: number } }>;
    nodes: UmlClassNode[];
    activeDiagramType: DiagramType;
    getNodeWidth: (n: UmlClassNode) => number;
    getNodeHeight: (n: UmlClassNode) => number;
    onStartDrag: () => void;
    sendNodeDrag: (id: string, pos: { x: number; y: number }) => void;
  }): { anyMoved: boolean } {
    const {
      eventNodes,
      nodes,
      activeDiagramType,
      getNodeWidth,
      getNodeHeight,
      onStartDrag,
      sendNodeDrag,
    } = params;

    if (!this.isDraggingNode) {
      this.startDrag(
        eventNodes.map((n) => n.id),
        nodes,
        getNodeWidth,
        getNodeHeight,
      );
      onStartDrag();
    }

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const eventNodeIds = new Set(eventNodes.map((n) => n.id));
    let anyMoved = false;

    for (const item of eventNodes) {
      const node = nodeMap.get(item.id);
      if (node) {
        const isSequenceNode =
          activeDiagramType === DiagramType.SEQUENCE || node.nodeType === 'lifeline';
        const targetX = Math.round(item.position.x);
        const targetY = isSequenceNode ? 50 : Math.round(item.position.y);
        const dx = targetX - node.position.x;
        const dy = isSequenceNode ? 0 : targetY - node.position.y;
        if (dx !== 0 || dy !== 0) {
          node.position = { x: targetX, y: targetY };
          this.lastNodeDragPos.set(node.id, { x: targetX, y: targetY });
          anyMoved = true;
          sendNodeDrag(node.id, node.position);

          if (this.currentDragDescendantIds.size > 0) {
            const descendantsOfThisNode = this.containmentIndex
              ? this.getDescendantsFromIndex(node.id, this.containmentIndex)
              : this.getDescendantNodeIds(node.id, nodes, getNodeWidth, getNodeHeight);
            for (const descId of descendantsOfThisNode) {
              if (!eventNodeIds.has(descId)) {
                const descNode = nodeMap.get(descId);
                if (descNode && !descNode.isAnchor) {
                  const dY =
                    activeDiagramType === DiagramType.SEQUENCE || descNode.nodeType === 'lifeline'
                      ? 50
                      : Math.round(descNode.position.y + dy);
                  descNode.position = { x: Math.round(descNode.position.x + dx), y: dY };
                  sendNodeDrag(descNode.id, descNode.position);
                }
              }
            }
          }
        }
      }
    }

    return { anyMoved };
  }
}
