import { Injectable } from '@angular/core';
import { DiagramType, UmlClassNode, UmlConnection } from '../../../../core/models/diagram.model';

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

  /**
   * Organiza automáticamente todos los nodos del lienzo usando un algoritmo de grafos
   * dirigido por fuerzas (Force-Directed Graph Layout - Fruchterman-Reingold + resolución AABB)
   * para lograr una disposición óptima, equilibrada y libre de superposiciones.
   */
  applyForceDirectedLayout(
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    getNodeWidth: (node: UmlClassNode) => number,
    getNodeHeight: (node: UmlClassNode) => number,
    activeDiagramType?: DiagramType,
  ): UmlClassNode[] {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const nonAnchorNodes = nodes.filter((n) => !n.isAnchor);
    if (nonAnchorNodes.length === 0) return [];

    // Detectar contención geométrica inicial (nodos dentro de paquetes/cajas contenedoras)
    const parentById = new Map<string, string>();
    const containerTypes = new Set([
      'package',
      'boundary_box',
      'device',
      'node',
      'executionEnvironment',
      'package_layer',
    ]);

    for (const child of nonAnchorNodes) {
      const cw = Math.max(80, getNodeWidth(child));
      const ch = Math.max(50, getNodeHeight(child));
      const cArea = cw * ch;
      const ccx = child.position.x + cw / 2;
      const ccy = child.position.y + ch / 2;

      let bestParentId: string | null = null;
      let bestParentArea = Infinity;

      for (const parent of nonAnchorNodes) {
        if (parent.id === child.id || !containerTypes.has(parent.nodeType || '')) continue;
        const pw = Math.max(120, getNodeWidth(parent));
        const ph = Math.max(80, getNodeHeight(parent));
        const pArea = pw * ph;
        if (pArea <= cArea * 1.05) continue;

        if (
          ccx >= parent.position.x - 5 &&
          ccx <= parent.position.x + pw + 5 &&
          ccy >= parent.position.y - 5 &&
          ccy <= parent.position.y + ph + 5 &&
          pArea < bestParentArea
        ) {
          bestParentArea = pArea;
          bestParentId = parent.id;
        }
      }

      if (bestParentId) {
        parentById.set(child.id, bestParentId);
      }
    }

    const topNodes = nonAnchorNodes.filter((n) => !parentById.has(n.id));
    if (topNodes.length === 0) return [];

    // Guardar posiciones originales de contenedores para propagar deltas a hijos contenidos
    const initialPos = new Map<string, { x: number; y: number }>();
    for (const n of nonAnchorNodes) {
      initialPos.set(n.id, { x: n.position.x, y: n.position.y });
    }

    const modified: UmlClassNode[] = [];

    // Caso especial: Diagrama de Secuencia (alinear participantes horizontalmente sin solaparse)
    if (
      activeDiagramType === DiagramType.SEQUENCE ||
      topNodes.every((n) => n.nodeType === 'lifeline')
    ) {
      const sorted = [...topNodes].sort((a, b) => a.position.x - b.position.x);
      let currentX = 100;
      const fixedY = 60;
      for (const n of sorted) {
        n.position = {
          x: Math.round(currentX / 20) * 20,
          y: fixedY,
        };
        modified.push(n);
        currentX += getNodeWidth(n) + 120;
      }
      return modified;
    }

    if (topNodes.length === 1) {
      const single = topNodes[0];
      single.position = {
        x: Math.max(100, Math.round(single.position.x / 20) * 20),
        y: Math.max(80, Math.round(single.position.y / 20) * 20),
      };
      return [single];
    }

    const N = topNodes.length;
    const indexById = new Map<string, number>();
    const w = new Array<number>(N);
    const h = new Array<number>(N);
    const cx = new Array<number>(N);
    const cy = new Array<number>(N);

    for (let i = 0; i < N; i++) {
      const node = topNodes[i];
      indexById.set(node.id, i);
      w[i] = Math.max(120, getNodeWidth(node));
      h[i] = Math.max(60, getNodeHeight(node));
      cx[i] = node.position.x + w[i] / 2;
      cy[i] = node.position.y + h[i] / 2;
    }

    // Resolver ID de nodo al contenedor raíz si está anidado en un paquete
    const resolveRootIndex = (rawId: string | undefined): number | undefined => {
      if (!rawId) return undefined;
      let currId = rawId.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
      let guard = 0;
      while (parentById.has(currId) && guard < 10) {
        currId = parentById.get(currId)!;
        guard++;
      }
      return indexById.get(currId);
    };

    // Construir aristas del grafo (incluyendo resolución de clases de asociación mediante su ancla)
    const edges: { u: number; v: number; type: string }[] = [];
    const anchorToMainConn = new Map<string, { u: number; v: number }>();

    for (const conn of connections) {
      const u = resolveRootIndex(conn.sourceNodeId || conn.sourceId);
      const v = resolveRootIndex(conn.targetNodeId || conn.targetId);
      if (u !== undefined && v !== undefined && u !== v) {
        edges.push({ u, v, type: conn.type || 'association' });
        if (conn.assocAnchorNodeId) {
          anchorToMainConn.set(conn.assocAnchorNodeId, { u, v });
        }
      }
    }

    for (const conn of connections) {
      const srcClean = (conn.sourceNodeId || conn.sourceId || '').replace(
        /_(top|bottom|left|right|slot_\d+)$/,
        '',
      );
      const tgtClean = (conn.targetNodeId || conn.targetId || '').replace(
        /_(top|bottom|left|right|slot_\d+)$/,
        '',
      );
      const anchorPair = anchorToMainConn.get(srcClean) || anchorToMainConn.get(tgtClean);
      if (anchorPair) {
        const assocIdx = resolveRootIndex(anchorToMainConn.has(srcClean) ? tgtClean : srcClean);
        if (assocIdx !== undefined) {
          edges.push({ u: anchorPair.u, v: assocIdx, type: 'association_class' });
          edges.push({ u: anchorPair.v, v: assocIdx, type: 'association_class' });
        }
      }
    }

    // Semilla determinista en espiral áurea si hay nodos solapados o muy juntos
    const centerX = cx.reduce((a, b) => a + b, 0) / N || 540;
    const centerY = cy.reduce((a, b) => a + b, 0) / N || 360;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        if (Math.hypot(cx[j] - cx[i], cy[j] - cy[i]) < 60) {
          const radius = 140 * Math.sqrt(j + 1);
          const angle = (j + 1) * goldenAngle;
          cx[j] = centerX + radius * Math.cos(angle);
          cy[j] = centerY + radius * Math.sin(angle);
        }
      }
    }

    // Parámetros del motor Force-Directed (Fruchterman-Reingold adaptado a cajas UML)
    const PAD_X = 110;
    const PAD_Y = 95;
    const ITERATIONS = 160;
    let temperature = Math.max(300, Math.sqrt(N) * 160);
    const cooling = 0.965;

    const fx = new Array<number>(N);
    const fy = new Array<number>(N);

    for (let iter = 0; iter < ITERATIONS; iter++) {
      fx.fill(0);
      fy.fill(0);

      // 1. Fuerza de repulsión entre todos los pares de nodos (con consciencia del tamaño de caja)
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          let dx = cx[j] - cx[i];
          let dy = cy[j] - cy[i];
          if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
            dx = Math.cos((i + j + 1) * goldenAngle);
            dy = Math.sin((i + j + 1) * goldenAngle);
          }

          const minSepX = (w[i] + w[j]) / 2 + PAD_X;
          const minSepY = (h[i] + h[j]) / 2 + PAD_Y;
          const nx = dx / minSepX;
          const ny = dy / minSepY;
          const normDist = Math.max(0.08, Math.hypot(nx, ny));

          if (normDist < 3.2) {
            const overlapBoost = normDist < 1.05 ? 2.6 : 1.0;
            const repulseMag = (950 * overlapBoost) / (normDist * normDist);
            const ux = nx / normDist;
            const uy = ny / normDist;

            fx[i] -= ux * repulseMag;
            fy[i] -= uy * repulseMag;
            fx[j] += ux * repulseMag;
            fy[j] += uy * repulseMag;
          }
        }
      }

      // 2. Fuerza de atracción elástica (Hooke) a lo largo de los conectores
      for (const edge of edges) {
        const { u, v, type } = edge;
        const dx = cx[v] - cx[u];
        const dy = cy[v] - cy[u];
        const dist = Math.max(1, Math.hypot(dx, dy));

        const idealDist =
          Math.hypot((w[u] + w[v]) / 2 + PAD_X, (h[u] + h[v]) / 2 + PAD_Y) * 0.82;
        const delta = dist - idealDist;
        const springMag = delta * 0.14;

        const ux = dx / dist;
        const uy = dy / dist;

        fx[u] += ux * springMag;
        fy[u] += uy * springMag;
        fx[v] -= ux * springMag;
        fy[v] -= uy * springMag;

        // Sesgo jerárquico: en herencia/realización la superclase/interfaz (target v) tiende a ubicarse arriba
        if (type === 'generalization' || type === 'realization') {
          fy[v] -= 22;
          fy[u] += 22;
        }
      }

      // 3. Fuerza gravitacional suave hacia el centro para mantener componentes conexas cohesionadas
      for (let i = 0; i < N; i++) {
        fx[i] += (centerX - cx[i]) * 0.035;
        fy[i] += (centerY - cy[i]) * 0.035;
      }

      // 4. Actualizar posiciones limitadas por la temperatura actual (Simulated Annealing)
      for (let i = 0; i < N; i++) {
        const mag = Math.hypot(fx[i], fy[i]);
        if (mag > 0) {
          const step = Math.min(mag, temperature);
          cx[i] += (fx[i] / mag) * step;
          cy[i] += (fy[i] / mag) * step;
        }
      }

      temperature *= cooling;
    }

    // 5. Pase determinista estricto de resolución de colisiones AABB (garantiza 0 superposiciones)
    const CLEARANCE_X = 90;
    const CLEARANCE_Y = 80;
    for (let pass = 0; pass < 60; pass++) {
      let hadOverlap = false;
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const reqX = (w[i] + w[j]) / 2 + CLEARANCE_X;
          const reqY = (h[i] + h[j]) / 2 + CLEARANCE_Y;
          const dx = cx[j] - cx[i];
          const dy = cy[j] - cy[i];
          const overlapX = reqX - Math.abs(dx);
          const overlapY = reqY - Math.abs(dy);

          if (overlapX > 0 && overlapY > 0) {
            hadOverlap = true;
            if (overlapX / reqX < overlapY / reqY) {
              const sign = dx >= 0 ? 1 : -1;
              const push = overlapX / 2 + 2;
              cx[i] -= sign * push;
              cx[j] += sign * push;
            } else {
              const sign = dy >= 0 ? 1 : -1;
              const push = overlapY / 2 + 2;
              cy[i] -= sign * push;
              cy[j] += sign * push;
            }
          }
        }
      }
      if (!hadOverlap) break;
    }

    // 6. Normalizar al cuadrante positivo del lienzo y alinear a la cuadrícula de 20px
    let minLeft = Infinity;
    let minTop = Infinity;
    for (let i = 0; i < N; i++) {
      minLeft = Math.min(minLeft, cx[i] - w[i] / 2);
      minTop = Math.min(minTop, cy[i] - h[i] / 2);
    }

    const offsetX = 100 - minLeft;
    const offsetY = 80 - minTop;

    for (let i = 0; i < N; i++) {
      const node = topNodes[i];
      const rawX = cx[i] - w[i] / 2 + offsetX;
      const rawY = cy[i] - h[i] / 2 + offsetY;
      node.position = {
        x: Math.max(40, Math.round(rawX / 20) * 20),
        y: Math.max(40, Math.round(rawY / 20) * 20),
      };
      modified.push(node);
    }

    // 7. Propagar el desplazamiento exacto a nodos hijos contenidos en paquetes
    for (const n of nonAnchorNodes) {
      if (parentById.has(n.id)) {
        let rootId = parentById.get(n.id)!;
        let guard = 0;
        while (parentById.has(rootId) && guard < 10) {
          rootId = parentById.get(rootId)!;
          guard++;
        }
        const rootParent = nodeById.get(rootId);
        if (rootParent) {
          const origParent = initialPos.get(rootParent.id);
          const origChild = initialPos.get(n.id);
          if (origParent && origChild) {
            const deltaX = rootParent.position.x - origParent.x;
            const deltaY = rootParent.position.y - origParent.y;
            n.position = {
              x: origChild.x + deltaX,
              y: origChild.y + deltaY,
            };
            modified.push(n);
          }
        }
      }
    }

    return modified;
  }
}
