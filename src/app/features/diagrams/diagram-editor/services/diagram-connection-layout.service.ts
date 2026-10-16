import { Injectable } from '@angular/core';
import {
  DiagramType,
  UmlClassNode,
  UmlConnection,
  UmlLineStyle,
  UmlRelationshipType,
} from '../../../../core/models/diagram.model';

@Injectable({
  providedIn: 'root',
})
export class DiagramConnectionLayoutService {
  /**
   * Determina los conectores óptimos (top/bottom/left/right) entre dos nodos según su posición relativa.
   */
  getOptimalConnectorId(
    sourceNode: UmlClassNode,
    targetNode: UmlClassNode,
    getNodeWidth?: (node: UmlClassNode) => number,
    getNodeHeight?: (node: UmlClassNode) => number,
  ): { sourceId: string; targetId: string } {
    if (sourceNode.id === targetNode.id) {
      return {
        sourceId: `${sourceNode.id}_top`,
        targetId: `${targetNode.id}_right`,
      };
    }

    const sWidth = sourceNode.isAnchor ? 0 : (getNodeWidth ? getNodeWidth(sourceNode) : (sourceNode.width || 220));
    const sHeight = sourceNode.isAnchor ? 0 : (getNodeHeight ? getNodeHeight(sourceNode) : (sourceNode.height || 60));
    const tWidth = targetNode.isAnchor ? 0 : (getNodeWidth ? getNodeWidth(targetNode) : (targetNode.width || 220));
    const tHeight = targetNode.isAnchor ? 0 : (getNodeHeight ? getNodeHeight(targetNode) : (targetNode.height || 60));

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
      targetId: targetNode.id + (targetNode.isAnchor ? '' : targetSide),
    };
  }

  /**
   * Obtiene las coordenadas absolutas en lienzo del punto de anclaje de un conector en un nodo.
   */
  getConnectorPoint(
    node: UmlClassNode,
    side: string,
    getNodeHeight?: (node: UmlClassNode) => number,
  ): { x: number; y: number } {
    const w = node.isAnchor ? 0 : node.width || 220;
    const h = getNodeHeight ? getNodeHeight(node) : (node.height || 60);
    const bottomExtra =
      node.nodeType === 'actor' ||
      node.nodeType === 'boundary' ||
      node.nodeType === 'control' ||
      node.nodeType === 'entity'
        ? 38 + Math.max(0, node.labelOffset?.y || 0)
        : 0;

    switch (side) {
      case 'left':
        return { x: node.position.x, y: node.position.y + h / 2 };
      case 'right':
        return { x: node.position.x + w, y: node.position.y + h / 2 };
      case 'top':
        return { x: node.position.x + w / 2, y: node.position.y };
      case 'bottom':
        return { x: node.position.x + w / 2, y: node.position.y + h + bottomExtra };
      default:
        return { x: node.position.x + w / 2, y: node.position.y + h / 2 };
    }
  }

  /**
   * Verifica si una conexión une un nodo consigo mismo de forma reflexiva/recursiva.
   */
  isRecursiveConn(conn: UmlConnection): boolean {
    const s = conn.sourceNodeId || conn.sourceId?.replace(/_(top|bottom|left|right)$/, '');
    const t = conn.targetNodeId || conn.targetId?.replace(/_(top|bottom|left|right)$/, '');
    return !!s && s === t;
  }

  /**
   * Obtiene el lado ('top' | 'right' | 'bottom' | 'left') de un ID de conector.
   */
  getConnSide(
    connectorId: string | undefined,
    defaultSide: 'top' | 'right' | 'bottom' | 'left' = 'top',
  ): 'top' | 'right' | 'bottom' | 'left' {
    if (!connectorId) return defaultSide;
    if (connectorId.endsWith('_top')) return 'top';
    if (connectorId.endsWith('_right')) return 'right';
    if (connectorId.endsWith('_bottom')) return 'bottom';
    if (connectorId.endsWith('_left')) return 'left';
    return defaultSide;
  }

  /**
   * Recalcula las posiciones de los anclas de clase de asociación y reorienta los extremos
   * de los conectores en función del movimiento de nodos y tipo de diagrama.
   */
  recalculateConnectionEndpoints(
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    activeDiagramType: DiagramType,
    defaultLineStyle: UmlLineStyle,
    getNodeWidth: (node: UmlClassNode) => number,
    getNodeHeight: (node: UmlClassNode) => number,
  ): { updatedNodes: UmlClassNode[]; updatedConnections: UmlConnection[]; anchorMoved: boolean } {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    let anchorMoved = false;

    // 1. Recalcular posiciones de anclas
    for (const conn of connections) {
      if (conn.assocAnchorNodeId) {
        const anchorNode = nodeMap.get(conn.assocAnchorNodeId);
        const baseSourceId = conn.sourceNodeId || conn.sourceId.replace(/_(top|bottom|left|right)$/, '');
        const baseTargetId = conn.targetNodeId || conn.targetId.replace(/_(top|bottom|left|right)$/, '');
        const sourceNode = nodeMap.get(baseSourceId);
        const targetNode = nodeMap.get(baseTargetId);

        if (anchorNode && sourceNode && targetNode) {
          const optimal = this.getOptimalConnectorId(sourceNode, targetNode, getNodeWidth, getNodeHeight);
          const sSide = optimal.sourceId.split('_').pop() || 'right';
          const tSide = optimal.targetId.split('_').pop() || 'left';
          const p1 = this.getConnectorPoint(sourceNode, sSide, getNodeHeight);
          const p2 = this.getConnectorPoint(targetNode, tSide, getNodeHeight);
          const newX = Math.round((p1.x + p2.x) / 2);
          const newY = Math.round((p1.y + p2.y) / 2);
          if (!anchorNode.position || anchorNode.position.x !== newX || anchorNode.position.y !== newY) {
            anchorNode.position = { x: newX, y: newY };
            anchorMoved = true;
          }
        }
      }
    }

    const updatedNodes = anchorMoved ? nodes.map((n) => ({ ...n })) : nodes;

    // 2. Actualizar extremos de conectores
    const updatedConnections = connections
      .filter((conn) => {
        const baseSourceId = conn.sourceNodeId || conn.sourceId.replace(/_(top|bottom|left|right)$/, '');
        const baseTargetId = conn.targetNodeId || conn.targetId.replace(/_(top|bottom|left|right)$/, '');
        return nodeMap.has(baseSourceId) && nodeMap.has(baseTargetId);
      })
      .map((conn) => {
        if (conn.type === 'association_class' && conn.sourceNodeId && conn.targetNodeId) {
          const sourceNode = nodeMap.get(conn.sourceNodeId);
          const targetNode = nodeMap.get(conn.targetNodeId);
          if (sourceNode && targetNode) {
            if (sourceNode.isAnchor) {
              const optimal = this.getOptimalConnectorId(sourceNode, targetNode, getNodeWidth, getNodeHeight);
              return {
                ...conn,
                sourceId: sourceNode.id,
                targetId: optimal.targetId,
              };
            } else if (targetNode.isAnchor) {
              const optimal = this.getOptimalConnectorId(sourceNode, targetNode, getNodeWidth, getNodeHeight);
              return {
                ...conn,
                sourceId: optimal.sourceId,
                targetId: targetNode.id,
              };
            }
          }
        }

        const baseSourceId = conn.sourceNodeId || conn.sourceId.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
        const baseTargetId = conn.targetNodeId || conn.targetId.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
        const sourceNode = nodeMap.get(baseSourceId);
        const targetNode = nodeMap.get(baseTargetId);

        if (
          conn.sourceId.includes('_slot_') ||
          conn.targetId.includes('_slot_') ||
          activeDiagramType === DiagramType.SEQUENCE ||
          ['sync', 'reply', 'async', 'create', 'self'].includes(conn.type)
        ) {
          const sMatch = conn.sourceId?.match(/_slot_(\d+)$/);
          const tMatch = conn.targetId?.match(/_slot_(\d+)$/);
          const slotNum = sMatch ? sMatch[1] : (tMatch ? tMatch[1] : '0');
          return {
            ...conn,
            sourceNodeId: baseSourceId,
            targetNodeId: baseTargetId,
            sourceId: `${baseSourceId}_slot_${slotNum}`,
            targetId: `${baseTargetId}_slot_${slotNum}`,
          };
        }

        if (sourceNode && targetNode && !sourceNode.isAnchor && !targetNode.isAnchor) {
          if (baseSourceId === baseTargetId) {
            const validConnectors = [
              `${baseSourceId}_top`,
              `${baseSourceId}_right`,
              `${baseSourceId}_bottom`,
              `${baseSourceId}_left`,
            ];
            const curSource = conn.sourceId;
            const curTarget = conn.targetId;
            const hasDistinct =
              validConnectors.includes(curSource) &&
              validConnectors.includes(curTarget) &&
              curSource !== curTarget;

            return {
              ...conn,
              sourceNodeId: baseSourceId,
              targetNodeId: baseTargetId,
              sourceId: hasDistinct ? curSource : `${baseSourceId}_top`,
              targetId: hasDistinct ? curTarget : `${baseTargetId}_right`,
            };
          }

          const optimal = this.getOptimalConnectorId(sourceNode, targetNode, getNodeWidth, getNodeHeight);
          return {
            ...conn,
            sourceNodeId: baseSourceId,
            targetNodeId: baseTargetId,
            sourceId: optimal.sourceId,
            targetId: optimal.targetId,
          };
        }
        return conn;
      });

    return { updatedNodes, updatedConnections, anchorMoved };
  }

  /**
   * Construye los elementos estructurales de una clase de asociación: nodo ancla invisible,
   * nodo de clase de asociación con llaves foráneas calculadas y conexiones principal y discontinua.
   */
  buildAssociationClassElements(
    sourceNode: UmlClassNode,
    targetNode: UmlClassNode,
    timestamp = Date.now(),
  ): {
    anchorNode: UmlClassNode;
    assocNode: UmlClassNode;
    mainConnection: UmlConnection;
    dashedConnection: UmlConnection;
  } {
    const anchorId = `anchor_${timestamp}`;
    const assocNodeId = `node_${timestamp}_assoc`;
    const assocName = `${sourceNode.name}_${targetNode.name}`;

    const anchorNode: UmlClassNode = {
      id: anchorId,
      name: '',
      position: {
        x: Math.round((sourceNode.position.x + targetNode.position.x) / 2),
        y: Math.round((sourceNode.position.y + targetNode.position.y) / 2),
      },
      width: 0,
      height: 0,
      attributes: [],
      methods: [],
      isAnchor: true,
    };

    const mainConnId = `conn_${timestamp}_assoc_main`;
    const mainConnection: UmlConnection = {
      id: mainConnId,
      sourceNodeId: sourceNode.id,
      targetNodeId: targetNode.id,
      sourceId: `${sourceNode.id}_right`,
      targetId: `${targetNode.id}_left`,
      type: 'association',
      lineStyle: 'straight',
      name: assocName,
      sourceMultiplicity: '',
      targetMultiplicity: '',
      assocAnchorNodeId: anchorId,
    };

    // Extraer atributos ID de las tablas a las que se asocia
    const getEntityFk = (node: UmlClassNode): { name: string; type: string } => {
      const pkAttr = (node.attributes || []).find((a) =>
        /^(id|.*_id|.*id)$/i.test(a.name.trim()),
      ) || (node.attributes || [])[0];

      const pkType = pkAttr?.type || 'UUID';

      let base = node.name.trim();
      if (base.toLowerCase().endsWith('es') && base.length > 3) {
        base = base.slice(0, -2);
      } else if (base.toLowerCase().endsWith('s') && base.length > 2 && !base.toLowerCase().endsWith('ss')) {
        base = base.slice(0, -1);
      }
      const camelBase = base.charAt(0).toLowerCase() + base.slice(1);

      let fkName = `${camelBase}Id`;
      if (pkAttr && pkAttr.name.trim().toLowerCase() !== 'id') {
        fkName = pkAttr.name.trim();
      }

      return { name: fkName, type: pkType };
    };

    const sourceFk = getEntityFk(sourceNode);
    const targetFk = getEntityFk(targetNode);

    if (sourceFk.name.toLowerCase() === targetFk.name.toLowerCase()) {
      sourceFk.name = `${sourceNode.name.toLowerCase()}Id`;
      targetFk.name = `${targetNode.name.toLowerCase()}Id`;
    }

    const assocNode: UmlClassNode = {
      id: assocNodeId,
      name: assocName,
      position: {
        x: anchorNode.position.x - 110,
        y: anchorNode.position.y + 120,
      },
      width: 220,
      attributes: [sourceFk, targetFk],
      methods: [],
      assocMainConnId: mainConnId,
    };

    const dashedConnId = `conn_${timestamp}_assoc_dashed`;
    const dashedConnection: UmlConnection = {
      id: dashedConnId,
      sourceNodeId: anchorId,
      targetNodeId: assocNodeId,
      sourceId: anchorId,
      targetId: `${assocNodeId}_top`,
      type: 'association_class',
      lineStyle: 'straight',
      name: '«link»',
    };

    return { anchorNode, assocNode, mainConnection, dashedConnection };
  }

  /**
   * Calcula el desplazamiento ordenado y no colisionante de un mensaje de secuencia o grupo
   * de mensajes jerárquicos entre slots temporales.
   */
  computeSequenceMessageMove(
    conns: UmlConnection[],
    connectionId: string,
    targetSlot: number,
    activeDiagramType: DiagramType,
  ): UmlConnection[] {
    const movingConn = conns.find((c) => c.id === connectionId);
    if (!movingConn) return conns;

    const sMatch = movingConn.sourceId?.match(/_slot_(\d+)$/);
    const fromSlot = sMatch ? parseInt(sMatch[1], 10) : 0;
    const toSlot = Math.max(0, targetSlot);

    if (fromSlot === toSlot) return conns;

    const isSeqConn = (c: UmlConnection) =>
      activeDiagramType === DiagramType.SEQUENCE ||
      ['sync', 'reply', 'async', 'create', 'self'].includes(c.type as any);

    const getSlot = (c: UmlConnection) => {
      const m = c.sourceId?.match(/_slot_(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    };

    const movingSeqNum = movingConn.messages?.[0]?.sequenceNumber?.trim() || '';
    const isInitiator = /^\d+$/.test(movingSeqNum);

    interface MoveItem {
      conn: UmlConnection;
      originalSlot: number;
      relativeOffset: number;
      targetSlot: number;
    }

    const moveItems: MoveItem[] = [];

    if (isInitiator) {
      const groupPrefix = `${movingSeqNum}.`;
      const groupMembers = conns.filter(
        (c) =>
          isSeqConn(c) &&
          (c.id === connectionId || (c.messages?.[0]?.sequenceNumber?.trim() || '').startsWith(groupPrefix))
      );

      groupMembers.sort((a, b) => getSlot(a) - getSlot(b));

      for (const m of groupMembers) {
        const origSlot = getSlot(m);
        const relOffset = origSlot - fromSlot;
        moveItems.push({
          conn: m,
          originalSlot: origSlot,
          relativeOffset: relOffset,
          targetSlot: toSlot + relOffset,
        });
      }
    } else {
      moveItems.push({
        conn: movingConn,
        originalSlot: fromSlot,
        relativeOffset: 0,
        targetSlot: toSlot,
      });
    }

    const movingIds = new Set(moveItems.map((mi) => mi.conn.id));
    const targetSlotMap = new Map<string, number>(moveItems.map((mi) => [mi.conn.id, mi.targetSlot]));

    const deltaSlot = toSlot - fromSlot;
    const numMovedItems = moveItems.length;

    return conns.map((c) => {
      if (!isSeqConn(c)) return c;

      const currentSlot = getSlot(c);
      const baseSrc = c.sourceNodeId || c.sourceId?.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
      const baseTgt = c.targetNodeId || c.targetId?.replace(/_(top|bottom|left|right|slot_\d+)$/, '');

      let newSlot = currentSlot;

      if (movingIds.has(c.id)) {
        newSlot = targetSlotMap.get(c.id)!;
      } else {
        if (deltaSlot > 0) {
          const maxTargetSlot = Math.max(...moveItems.map((mi) => mi.targetSlot));
          if (currentSlot > fromSlot && currentSlot <= maxTargetSlot) {
            newSlot = currentSlot - numMovedItems;
          }
        } else {
          const minTargetSlot = Math.min(...moveItems.map((mi) => mi.targetSlot));
          if (currentSlot >= minTargetSlot && currentSlot < fromSlot) {
            newSlot = currentSlot + numMovedItems;
          }
        }
      }

      if (newSlot !== currentSlot) {
        return {
          ...c,
          sourceId: `${baseSrc}_slot_${newSlot}`,
          targetId: `${baseTgt}_slot_${newSlot}`,
        };
      }
      return c;
    });
  }

  /**
   * Encuentra el siguiente índice numérico de slot temporal disponible en un diagrama de secuencia.
   */
  findNextAvailableSlot(connections: UmlConnection[]): string {
    const usedSlots = new Set<number>();
    for (const c of connections) {
      const m1 = c.sourceId?.match(/_slot_(\d+)$/);
      const m2 = c.targetId?.match(/_slot_(\d+)$/);
      if (m1) usedSlots.add(parseInt(m1[1], 10));
      if (m2) usedSlots.add(parseInt(m2[1], 10));
    }
    let nextSlot = 0;
    while (usedSlots.has(nextSlot)) {
      nextSlot++;
    }
    return nextSlot.toString();
  }

  /**
   * Comprueba si un slot temporal ya contiene un mensaje en la misma fila colineal.
   */
  isSequenceSlotOccupied(
    connections: UmlConnection[],
    targetSlotNum: number,
    activeDiagramType: DiagramType,
    ignoreConnectionId?: string,
  ): boolean {
    return connections.some((c) => {
      if (ignoreConnectionId && c.id === ignoreConnectionId) return false;
      const isSeq =
        activeDiagramType === DiagramType.SEQUENCE ||
        ['sync', 'reply', 'async', 'create', 'self'].includes(c.type as any);
      if (!isSeq) return false;
      const m1 = c.sourceId?.match(/_slot_(\d+)$/);
      const m2 = c.targetId?.match(/_slot_(\d+)$/);
      return (m1 && parseInt(m1[1], 10) === targetSlotNum) || (m2 && parseInt(m2[1], 10) === targetSlotNum);
    });
  }

  /**
   * Construye una nueva conexión tipada con estilos, nombres estereotipados y mensajes predefinidos.
   */
  buildNewConnection(params: {
    sourceNode: UmlClassNode;
    targetNode: UmlClassNode;
    relType: UmlRelationshipType | string;
    sourceId: string;
    targetId: string;
    defaultLineStyle: UmlLineStyle;
    activeDiagramType: DiagramType;
    messages?: any[];
  }): UmlConnection {
    const { sourceNode, targetNode, relType, sourceId, targetId, defaultLineStyle, activeDiagramType, messages } = params;
    const isSeqRel =
      ['sync', 'reply', 'async', 'create', 'self'].includes(relType as any) ||
      activeDiagramType === DiagramType.SEQUENCE;

    const relName =
      relType === 'include'
        ? '«include»'
        : relType === 'extend'
        ? '«extend»'
        : relType === 'import'
        ? '«import»'
        : relType === 'access'
        ? '«access»'
        : relType === 'merge'
        ? '«merge»'
        : relType === 'trace'
        ? '«trace»'
        : undefined;

    return {
      id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      sourceNodeId: sourceNode.id,
      targetNodeId: targetNode.id,
      sourceId,
      targetId,
      type: relType as UmlRelationshipType,
      lineStyle: isSeqRel ? 'straight' : defaultLineStyle,
      name: relName,
      sourceMultiplicity: '',
      targetMultiplicity: '',
      messages,
    };
  }
}
