import { Injectable } from '@angular/core';
import { UmlClassNode } from '../../../../../core/models/diagram.model';

export type AlignmentDirection = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export type DistributionDirection = 'horizontal' | 'vertical';

@Injectable({
  providedIn: 'root',
})
export class DiagramAlignmentService {
  /**
   * Alinea los nodos seleccionados en la dirección indicada.
   * Retorna los nodos que sufrieron cambios de posición.
   */
  alignNodes(
    nodes: UmlClassNode[],
    selectedNodeIds: Set<string>,
    direction: AlignmentDirection,
    getNodeWidth: (node: UmlClassNode) => number,
    getNodeHeight: (node: UmlClassNode) => number,
  ): UmlClassNode[] {
    const selected = nodes.filter((n) => selectedNodeIds.has(n.id) && !n.isAnchor);
    if (selected.length < 2) return [];

    const modified: UmlClassNode[] = [];

    if (direction === 'left') {
      const minX = Math.min(...selected.map((n) => n.position.x));
      for (const n of selected) {
        n.position = { x: minX, y: n.position.y };
        modified.push(n);
      }
    } else if (direction === 'center') {
      const centers = selected.map((n) => n.position.x + getNodeWidth(n) / 2);
      const avgCenter = Math.round(centers.reduce((a, b) => a + b, 0) / centers.length);
      for (const n of selected) {
        n.position = { x: Math.round(avgCenter - getNodeWidth(n) / 2), y: n.position.y };
        modified.push(n);
      }
    } else if (direction === 'right') {
      const maxRight = Math.max(...selected.map((n) => n.position.x + getNodeWidth(n)));
      for (const n of selected) {
        n.position = { x: Math.round(maxRight - getNodeWidth(n)), y: n.position.y };
        modified.push(n);
      }
    } else if (direction === 'top') {
      const minY = Math.min(...selected.map((n) => n.position.y));
      for (const n of selected) {
        n.position = { x: n.position.x, y: minY };
        modified.push(n);
      }
    } else if (direction === 'middle') {
      const middles = selected.map((n) => n.position.y + getNodeHeight(n) / 2);
      const avgMiddle = Math.round(middles.reduce((a, b) => a + b, 0) / middles.length);
      for (const n of selected) {
        n.position = { x: n.position.x, y: Math.round(avgMiddle - getNodeHeight(n) / 2) };
        modified.push(n);
      }
    } else if (direction === 'bottom') {
      const maxBottom = Math.max(...selected.map((n) => n.position.y + getNodeHeight(n)));
      for (const n of selected) {
        n.position = { x: n.position.x, y: Math.round(maxBottom - getNodeHeight(n)) };
        modified.push(n);
      }
    }

    return modified;
  }

  /**
   * Distribuye equitativamente los nodos seleccionados horizontal o verticalmente.
   * Retorna los nodos que sufrieron cambios de posición.
   */
  distributeNodes(
    nodes: UmlClassNode[],
    selectedNodeIds: Set<string>,
    direction: DistributionDirection,
    getNodeWidth: (node: UmlClassNode) => number,
    getNodeHeight: (node: UmlClassNode) => number,
  ): UmlClassNode[] {
    const selected = nodes.filter((n) => selectedNodeIds.has(n.id) && !n.isAnchor);
    if (selected.length < 3) return [];

    const modified: UmlClassNode[] = [];

    if (direction === 'horizontal') {
      selected.sort((a, b) => a.position.x - b.position.x);
      const first = selected[0];
      const last = selected[selected.length - 1];
      const totalWidth = selected.slice(1, -1).reduce((sum, n) => sum + getNodeWidth(n), 0);
      const span = last.position.x - (first.position.x + getNodeWidth(first));
      const spacing = Math.max(20, Math.round((span - totalWidth) / (selected.length - 1)));

      let currentX = first.position.x + getNodeWidth(first) + spacing;
      for (let i = 1; i < selected.length - 1; i++) {
        selected[i].position = { x: currentX, y: selected[i].position.y };
        modified.push(selected[i]);
        currentX += getNodeWidth(selected[i]) + spacing;
      }
    } else {
      selected.sort((a, b) => a.position.y - b.position.y);
      const first = selected[0];
      const last = selected[selected.length - 1];
      const totalHeight = selected.slice(1, -1).reduce((sum, n) => sum + getNodeHeight(n), 0);
      const span = last.position.y - (first.position.y + getNodeHeight(first));
      const spacing = Math.max(20, Math.round((span - totalHeight) / (selected.length - 1)));

      let currentY = first.position.y + getNodeHeight(first) + spacing;
      for (let i = 1; i < selected.length - 1; i++) {
        selected[i].position = { x: selected[i].position.x, y: currentY };
        modified.push(selected[i]);
        currentY += getNodeHeight(selected[i]) + spacing;
      }
    }

    return modified;
  }

  /**
   * Ajusta los nodos a la cuadrícula (grid snapping).
   * Retorna los nodos modificados.
   */
  snapToGrid(
    nodes: UmlClassNode[],
    selectedNodeIds: Set<string>,
    gridSize = 20,
  ): UmlClassNode[] {
    const targets = selectedNodeIds.size > 0
      ? nodes.filter((n) => selectedNodeIds.has(n.id) && !n.isAnchor)
      : nodes.filter((n) => !n.isAnchor);

    if (targets.length === 0) return [];

    const modified: UmlClassNode[] = [];
    for (const n of targets) {
      n.position = {
        x: Math.round(n.position.x / gridSize) * gridSize,
        y: Math.round(n.position.y / gridSize) * gridSize,
      };
      modified.push(n);
    }

    return modified;
  }
}
