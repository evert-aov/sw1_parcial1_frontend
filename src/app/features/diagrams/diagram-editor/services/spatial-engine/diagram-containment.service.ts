import { inject } from '@angular/core';
import { NodePluginRegistryService } from '../../../../../core/plugins/node-plugin-registry.service';
import { Injectable } from '@angular/core';
import { DiagramType, UmlClassNode } from '../../../../../core/models/diagram.model';

@Injectable({
  providedIn: 'root',
})
export class DiagramContainmentService {
  private readonly nodePlugins = inject(NodePluginRegistryService);
  readonly lastNodeDragPos = new Map<string, { x: number; y: number }>();
  readonly currentDragDescendantIds = new Set<string>();
  isDraggingNode = false;

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

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const candidate of allNodes) {
        if (!visited.has(candidate.id) && this.isNodeInsideParent(candidate, current, getNodeWidth, getNodeHeight)) {
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
    const collected = this.collectDescendantsForRoots(rootIds, allNodes, getNodeWidth, getNodeHeight);
    for (const id of collected) {
      this.currentDragDescendantIds.add(id);
    }
  }

  /**
   * Limpia el estado de arrastre y las posiciones temporales.
   */
  resetDragState(): void {
    this.isDraggingNode = false;
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

    const rawPosX = params.newPosition?.x;
    const rawPosY = params.newPosition?.y;
    const curPosX = Number.isFinite(node.position?.x) ? node.position.x : 50;
    const curPosY = Number.isFinite(node.position?.y) ? node.position.y : 50;
    const validX = Number.isFinite(rawPosX) ? Math.round(rawPosX) : curPosX;
    const validY = Number.isFinite(rawPosY) ? Math.round(rawPosY) : curPosY;
    const isSequenceNode = activeDiagramType === DiagramType.SEQUENCE || this.nodePlugins.forNode(node)?.geometry.lockY;
    let targetPos = { x: validX, y: isSequenceNode ? 50 : validY };

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
              const otherIsSeq = activeDiagramType === DiagramType.SEQUENCE || this.nodePlugins.forNode(other)?.geometry.lockY;
              const oPosX = Number.isFinite(other.position?.x) ? other.position.x : 50;
              const oPosY = Number.isFinite(other.position?.y) ? other.position.y : 50;
              const otherY = otherIsSeq ? 50 : Math.round(oPosY + dy);
              other.position = { x: Math.round(oPosX + dx), y: otherY };
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
              const otherIsSeq = activeDiagramType === DiagramType.SEQUENCE || this.nodePlugins.forNode(other)?.geometry.lockY;
              const oPosX = Number.isFinite(other.position?.x) ? other.position.x : 50;
              const oPosY = Number.isFinite(other.position?.y) ? other.position.y : 50;
              const otherY = otherIsSeq ? 50 : Math.round(oPosY + dy);
              other.position = { x: Math.round(oPosX + dx), y: otherY };
              sendNodeDrag(other.id, other.position);
            }
          }
        }

        if ((selectedNodeIds.size > 1 && selectedNodeIds.has(node.id)) || this.currentDragDescendantIds.size > 0) {
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
        const isSequenceNode = activeDiagramType === DiagramType.SEQUENCE || this.nodePlugins.forNode(node)?.geometry.lockY;
        const curX = Number.isFinite(node.position?.x) ? node.position.x : 50;
        const curY = Number.isFinite(node.position?.y) ? node.position.y : 50;
        const targetX = Number.isFinite(item.position?.x) ? Math.round(item.position.x) : curX;
        const targetY = isSequenceNode ? 50 : (Number.isFinite(item.position?.y) ? Math.round(item.position.y) : curY);
        const dx = targetX - curX;
        const dy = isSequenceNode ? 0 : targetY - curY;
        if (dx !== 0 || dy !== 0) {
          node.position = { x: targetX, y: targetY };
          this.lastNodeDragPos.set(node.id, { x: targetX, y: targetY });
          anyMoved = true;
          sendNodeDrag(node.id, node.position);

          if (this.currentDragDescendantIds.size > 0) {
            const descendantsOfThisNode = this.getDescendantNodeIds(node.id, nodes, getNodeWidth, getNodeHeight);
            for (const descId of descendantsOfThisNode) {
              if (!eventNodeIds.has(descId)) {
                const descNode = nodeMap.get(descId);
                if (descNode && !descNode.isAnchor) {
                  const dCurX = Number.isFinite(descNode.position?.x) ? descNode.position.x : 50;
                  const dCurY = Number.isFinite(descNode.position?.y) ? descNode.position.y : 50;
                  const dY = (activeDiagramType === DiagramType.SEQUENCE || this.nodePlugins.forNode(descNode)?.geometry.lockY)
                    ? 50
                    : Math.round(dCurY + dy);
                  descNode.position = { x: Math.round(dCurX + dx), y: dY };
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
