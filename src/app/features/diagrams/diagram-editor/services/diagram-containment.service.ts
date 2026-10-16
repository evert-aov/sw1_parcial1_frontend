import { Injectable } from '@angular/core';
import { UmlClassNode } from '../../../../core/models/diagram.model';

@Injectable({
  providedIn: 'root',
})
export class DiagramContainmentService {
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
}
