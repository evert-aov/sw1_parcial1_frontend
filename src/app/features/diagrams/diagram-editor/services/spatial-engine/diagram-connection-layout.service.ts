import { Injectable } from '@angular/core';
import {
  DiagramType,
  sanitizeLineStyle,
  UmlClassNode,
  UmlConnection,
  UmlLineStyle,
  UmlRelationshipType,
} from '../../../../../core/models/diagram.model';
import {
  buildAssociationClassElements as buildAssociationClassElementsLogic,
  computeSequenceMessageMove as computeSequenceMessageMoveLogic,
  findNextAvailableSlot as findNextAvailableSlotLogic,
  formatPackageRelation,
  formatUseCaseRelation,
  getActorBottomExtra,
  isSequenceConnection as isSequenceConnectionLogic,
  isSequenceSlotOccupied as isSequenceSlotOccupiedLogic,
  recalculateSequenceNumbers as recalculateSequenceNumbersLogic,
} from '../../components/diagram-canvas/nodes';

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

    const sPos = sourceNode.position || { x: 50, y: 50 };
    const tPos = targetNode.position || { x: 200, y: 200 };
    const sX = Number.isFinite(sPos.x) ? sPos.x : 50;
    const sY = Number.isFinite(sPos.y) ? sPos.y : 50;
    const tX = Number.isFinite(tPos.x) ? tPos.x : 200;
    const tY = Number.isFinite(tPos.y) ? tPos.y : 200;

    const sCenter = { x: sX + sWidth / 2, y: sY + sHeight / 2 };
    const tCenter = { x: tX + tWidth / 2, y: tY + tHeight / 2 };

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

    const pos = node.position || { x: 50, y: 50 };
    const posX = Number.isFinite(pos.x) ? pos.x : 50;
    const posY = Number.isFinite(pos.y) ? pos.y : 50;

    switch (side) {
      case 'left':
        return { x: posX, y: posY + h / 2 };
      case 'right':
        return { x: posX + w, y: posY + h / 2 };
      case 'top':
        return { x: posX + w / 2, y: posY };
      case 'bottom':
        return { x: posX + w / 2, y: posY + h + bottomExtra };
      default:
        return { x: posX + w / 2, y: posY + h / 2 };
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
          const midX = Math.round((p1.x + p2.x) / 2);
          const midY = Math.round((p1.y + p2.y) / 2);
          const safeX = Number.isFinite(midX) ? midX : 100;
          const safeY = Number.isFinite(midY) ? midY : 100;
          if (!anchorNode.position || anchorNode.position.x !== safeX || anchorNode.position.y !== safeY) {
            anchorNode.position = { x: safeX, y: safeY };
            anchorMoved = true;
          }
        }
      }
    }

    const updatedNodes = anchorMoved ? nodes.map((n) => ({ ...n })) : nodes;

    // 2. Actualizar extremos de conectores
    const updatedConnections = connections
      .filter((conn) => {
        const baseSourceId = conn.sourceNodeId || conn.sourceId.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
        const baseTargetId = conn.targetNodeId || conn.targetId.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
        return nodeMap.has(baseSourceId) && nodeMap.has(baseTargetId);
      })
      .map((conn) => {
        const isSeqRel = isSequenceConnectionLogic(conn, activeDiagramType);
        const safeLineStyle = sanitizeLineStyle(
          conn.lineStyle,
          isSeqRel ? 'straight' : defaultLineStyle,
        );

        if (conn.type === 'association_class' && conn.sourceNodeId && conn.targetNodeId) {
          const sourceNode = nodeMap.get(conn.sourceNodeId);
          const targetNode = nodeMap.get(conn.targetNodeId);
          if (sourceNode && targetNode) {
            if (sourceNode.isAnchor) {
              const optimal = this.getOptimalConnectorId(sourceNode, targetNode, getNodeWidth, getNodeHeight);
              return {
                ...conn,
                lineStyle: safeLineStyle,
                sourceId: sourceNode.id,
                targetId: optimal.targetId,
              };
            } else if (targetNode.isAnchor) {
              const optimal = this.getOptimalConnectorId(sourceNode, targetNode, getNodeWidth, getNodeHeight);
              return {
                ...conn,
                lineStyle: safeLineStyle,
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
          isSeqRel
        ) {
          const sMatch = conn.sourceId?.match(/_slot_(\d+)$/);
          const tMatch = conn.targetId?.match(/_slot_(\d+)$/);
          const slotNum = sMatch ? sMatch[1] : (tMatch ? tMatch[1] : '0');
          return {
            ...conn,
            lineStyle: safeLineStyle,
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
              lineStyle: safeLineStyle,
              sourceNodeId: baseSourceId,
              targetNodeId: baseTargetId,
              sourceId: hasDistinct ? curSource : `${baseSourceId}_top`,
              targetId: hasDistinct ? curTarget : `${baseTargetId}_right`,
            };
          }

          const optimal = this.getOptimalConnectorId(sourceNode, targetNode, getNodeWidth, getNodeHeight);
          return {
            ...conn,
            lineStyle: safeLineStyle,
            sourceNodeId: baseSourceId,
            targetNodeId: baseTargetId,
            sourceId: optimal.sourceId,
            targetId: optimal.targetId,
          };
        }
        return {
          ...conn,
          lineStyle: safeLineStyle,
        };
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
    return buildAssociationClassElementsLogic(sourceNode, targetNode, timestamp);
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
    return computeSequenceMessageMoveLogic(conns, connectionId, targetSlot, activeDiagramType);
  }

  /**
   * Encuentra el siguiente índice numérico de slot temporal disponible en un diagrama de secuencia.
   */
  findNextAvailableSlot(connections: UmlConnection[]): string {
    return findNextAvailableSlotLogic(connections);
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
    return isSequenceSlotOccupiedLogic(connections, targetSlotNum, activeDiagramType, ignoreConnectionId);
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
    const isSeqRel = isSequenceConnectionLogic(relType, activeDiagramType);

    const relName =
      formatUseCaseRelation(relType) ||
      formatPackageRelation(relType) ||
      (relType === 'trace' ? '«trace»' : undefined);

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

  /**
   * Recalcula la numeración secuencial jerárquica (o cronológica) de los mensajes en diagramas de secuencia
   */
  recalculateSequenceNumbers(
    connectionsList: UmlConnection[],
    nodes: UmlClassNode[],
    activeDiagramType: DiagramType,
    preserveSequenceNumbers = false,
  ): UmlConnection[] {
    return recalculateSequenceNumbersLogic(
      connectionsList,
      nodes,
      activeDiagramType,
      preserveSequenceNumbers,
    );
  }
}
