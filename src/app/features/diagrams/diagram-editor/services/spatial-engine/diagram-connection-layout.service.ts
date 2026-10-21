import { Injectable } from '@angular/core';
import {
  DiagramType,
  sanitizeLineStyle,
  UmlClassNode,
  UmlConnection,
  UmlLineStyle,
  UmlRelationshipType,
} from '../../../../../core/models/diagram.model';
import { ConnectionCascadeUtil } from '../../utils/connection-cascade.util';
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
   * Determina los conectores óptimos y adaptativos (12 puntos perimetrales) entre dos nodos
   * basándose en la posición relativa, las bandas de solapamiento (overlap) y dispersión paralela.
   */
  getOptimalConnectorId(
    sourceNode: UmlClassNode,
    targetNode: UmlClassNode,
    getNodeWidth?: (node: UmlClassNode) => number,
    getNodeHeight?: (node: UmlClassNode) => number,
    connectionIndex = 0,
    totalConnections = 1,
  ): { sourceId: string; targetId: string } {
    if (sourceNode.id === targetNode.id) {
      return {
        sourceId: `${sourceNode.id}_top_end`,
        targetId: `${targetNode.id}_right_start`,
      };
    }

    if (sourceNode.isAnchor) {
      return {
        sourceId: sourceNode.id,
        targetId: this.getOptimalConnectorId(targetNode, sourceNode, getNodeWidth, getNodeHeight).sourceId,
      };
    }
    if (targetNode.isAnchor) {
      return {
        sourceId: this.getOptimalConnectorId(sourceNode, targetNode, getNodeWidth, getNodeHeight).sourceId,
        targetId: targetNode.id,
      };
    }

    const sWidth = getNodeWidth ? getNodeWidth(sourceNode) : (sourceNode.width || 220);
    const sHeight = getNodeHeight ? getNodeHeight(sourceNode) : (sourceNode.height || 60);
    const tWidth = getNodeWidth ? getNodeWidth(targetNode) : (targetNode.width || 220);
    const tHeight = getNodeHeight ? getNodeHeight(targetNode) : (targetNode.height || 60);

    const sPos = sourceNode.position || { x: 50, y: 50 };
    const tPos = targetNode.position || { x: 200, y: 200 };
    const sLeft = Number.isFinite(sPos.x) ? sPos.x : 50;
    const sTop = Number.isFinite(sPos.y) ? sPos.y : 50;
    const sRight = sLeft + sWidth;
    const sBottom = sTop + sHeight;

    const tLeft = Number.isFinite(tPos.x) ? tPos.x : 200;
    const tTop = Number.isFinite(tPos.y) ? tPos.y : 200;
    const tRight = tLeft + tWidth;
    const tBottom = tTop + tHeight;

    const sCx = (sLeft + sRight) / 2;
    const sCy = (sTop + sBottom) / 2;
    const tCx = (tLeft + tRight) / 2;
    const tCy = (tTop + tBottom) / 2;

    const dx = tCx - sCx;
    const dy = tCy - sCy;
    const goingRight = dx >= 0;
    const goingDown = dy >= 0;

    const horizGap = goingRight ? tLeft - sRight : sLeft - tRight;
    const vertGap = goingDown ? tTop - sBottom : sTop - tBottom;

    const padY = Math.min(16, sHeight * 0.2, tHeight * 0.2);
    const overlapTop = Math.max(sTop + padY, tTop + padY);
    const overlapBottom = Math.min(sBottom - padY, tBottom - padY);
    const hasVerticalBandOverlap = horizGap >= 12 && overlapBottom >= overlapTop;

    const padX = Math.min(18, sWidth * 0.2, tWidth * 0.2);
    const overlapLeft = Math.max(sLeft + padX, tLeft + padX);
    const overlapRight = Math.min(sRight - padX, tRight - padX);

    let sourceSide: string;
    let targetSide: string;
    let sourceSlot = '';
    let targetSlot = '';

    // 1. Predominantemente horizontal o banda de solapamiento horizontal
    if (hasVerticalBandOverlap || (horizGap >= vertGap && Math.abs(dx) >= Math.abs(dy))) {
      sourceSide = goingRight ? '_right' : '_left';
      targetSide = goingRight ? '_left' : '_right';

      if (overlapBottom >= overlapTop) {
        const sharedY = Math.max(overlapTop, Math.min(overlapBottom, (sCy + tCy) / 2));
        const ratioS = (sharedY - sTop) / (sHeight || 1);
        const ratioT = (sharedY - tTop) / (tHeight || 1);
        sourceSlot = ratioS < 0.38 ? '_start' : (ratioS > 0.62 ? '_end' : '');
        targetSlot = ratioT < 0.38 ? '_start' : (ratioT > 0.62 ? '_end' : '');
      } else {
        if (goingDown) {
          sourceSlot = '_end';
          targetSlot = '_start';
        } else {
          sourceSlot = '_start';
          targetSlot = '_end';
        }
      }
    } else {
      // 2. Predominantemente vertical o columna de solapamiento vertical
      sourceSide = goingDown ? '_bottom' : '_top';
      targetSide = goingDown ? '_top' : '_bottom';

      if (overlapRight >= overlapLeft) {
        const sharedX = Math.max(overlapLeft, Math.min(overlapRight, (sCx + tCx) / 2));
        const ratioS = (sharedX - sLeft) / (sWidth || 1);
        const ratioT = (sharedX - tLeft) / (tWidth || 1);
        sourceSlot = ratioS < 0.38 ? '_start' : (ratioS > 0.62 ? '_end' : '');
        targetSlot = ratioT < 0.38 ? '_start' : (ratioT > 0.62 ? '_end' : '');
      } else {
        if (goingRight) {
          sourceSlot = '_end';
          targetSlot = '_start';
        } else {
          sourceSlot = '_start';
          targetSlot = '_end';
        }
      }
    }

    // Dispersión para relaciones paralelas entre el mismo par de nodos
    if (totalConnections === 2) {
      const slotCycle = ['_start', '_end'];
      const slotIndex = connectionIndex % 2;
      sourceSlot = slotCycle[slotIndex];
      targetSlot = slotCycle[slotIndex];
    } else if (totalConnections > 2) {
      const slotCycle = ['_start', '', '_end'];
      const slotIndex = connectionIndex % 3;
      sourceSlot = slotCycle[slotIndex];
      targetSlot = slotCycle[slotIndex];
    }

    return {
      sourceId: `${sourceNode.id}${sourceSide}${sourceSlot}`,
      targetId: `${targetNode.id}${targetSide}${targetSlot}`,
    };
  }

  /**
   * Obtiene las coordenadas absolutas en lienzo del punto de anclaje de un conector en un nodo.
   * Soporta los 12 puntos perimetrales del nodo (_start, centro, _end).
   */
  getConnectorPoint(
    node: UmlClassNode,
    sideOrConnectorId: string,
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

    const normalized = sideOrConnectorId.startsWith(node.id)
      ? sideOrConnectorId.slice(node.id.length).replace(/^_/, '')
      : sideOrConnectorId;

    switch (normalized) {
      case 'left_start':
        return { x: posX, y: posY + h * 0.25 };
      case 'left':
        return { x: posX, y: posY + h * 0.5 };
      case 'left_end':
        return { x: posX, y: posY + h * 0.75 };

      case 'right_start':
        return { x: posX + w, y: posY + h * 0.25 };
      case 'right':
        return { x: posX + w, y: posY + h * 0.5 };
      case 'right_end':
        return { x: posX + w, y: posY + h * 0.75 };

      case 'top_start':
        return { x: posX + w * 0.25, y: posY };
      case 'top':
        return { x: posX + w * 0.5, y: posY };
      case 'top_end':
        return { x: posX + w * 0.75, y: posY };

      case 'bottom_start':
        return { x: posX + w * 0.25, y: posY + h + bottomExtra };
      case 'bottom':
        return { x: posX + w * 0.5, y: posY + h + bottomExtra };
      case 'bottom_end':
        return { x: posX + w * 0.75, y: posY + h + bottomExtra };

      default: {
        if (normalized.includes('top')) return { x: posX + w / 2, y: posY };
        if (normalized.includes('bottom')) return { x: posX + w / 2, y: posY + h + bottomExtra };
        if (normalized.includes('left')) return { x: posX, y: posY + h / 2 };
        if (normalized.includes('right')) return { x: posX + w, y: posY + h / 2 };
        return { x: posX + w / 2, y: posY + h / 2 };
      }
    }
  }

  /**
   * Verifica si una conexión une un nodo consigo mismo de forma reflexiva/recursiva.
   */
  isRecursiveConn(conn: UmlConnection): boolean {
    const s = conn.sourceNodeId || ConnectionCascadeUtil.extractBaseNodeId(conn.sourceId);
    const t = conn.targetNodeId || ConnectionCascadeUtil.extractBaseNodeId(conn.targetId);
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
    if (connectorId.includes('_top')) return 'top';
    if (connectorId.includes('_right')) return 'right';
    if (connectorId.includes('_bottom')) return 'bottom';
    if (connectorId.includes('_left')) return 'left';
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
        const baseSourceId = conn.sourceNodeId || ConnectionCascadeUtil.extractBaseNodeId(conn.sourceId);
        const baseTargetId = conn.targetNodeId || ConnectionCascadeUtil.extractBaseNodeId(conn.targetId);
        const sourceNode = nodeMap.get(baseSourceId);
        const targetNode = nodeMap.get(baseTargetId);

        if (anchorNode && sourceNode && targetNode) {
          const optimal = this.getOptimalConnectorId(sourceNode, targetNode, getNodeWidth, getNodeHeight);
          const sSide = optimal.sourceId.slice(sourceNode.id.length).replace(/^_/, '') || 'right';
          const tSide = optimal.targetId.slice(targetNode.id.length).replace(/^_/, '') || 'left';
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
        const baseSourceId = conn.sourceNodeId || ConnectionCascadeUtil.extractBaseNodeId(conn.sourceId);
        const baseTargetId = conn.targetNodeId || ConnectionCascadeUtil.extractBaseNodeId(conn.targetId);
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

        const baseSourceId = conn.sourceNodeId || ConnectionCascadeUtil.extractBaseNodeId(conn.sourceId);
        const baseTargetId = conn.targetNodeId || ConnectionCascadeUtil.extractBaseNodeId(conn.targetId);
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
              `${baseSourceId}_top_start`,
              `${baseSourceId}_top_end`,
              `${baseSourceId}_right`,
              `${baseSourceId}_right_start`,
              `${baseSourceId}_right_end`,
              `${baseSourceId}_bottom`,
              `${baseSourceId}_bottom_start`,
              `${baseSourceId}_bottom_end`,
              `${baseSourceId}_left`,
              `${baseSourceId}_left_start`,
              `${baseSourceId}_left_end`,
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
              sourceId: hasDistinct ? curSource : `${baseSourceId}_top_end`,
              targetId: hasDistinct ? curTarget : `${baseTargetId}_right_start`,
            };
          }

          // Agrupación y separación de relaciones paralelas entre los dos mismos nodos
          const pairConns = connections.filter((c) => {
            const cs = c.sourceNodeId || ConnectionCascadeUtil.extractBaseNodeId(c.sourceId);
            const ct = c.targetNodeId || ConnectionCascadeUtil.extractBaseNodeId(c.targetId);
            return (
              (cs === baseSourceId && ct === baseTargetId) ||
              (cs === baseTargetId && ct === baseSourceId)
            );
          });
          const connIndex = pairConns.findIndex((c) => c.id === conn.id);

          const optimal = this.getOptimalConnectorId(
            sourceNode,
            targetNode,
            getNodeWidth,
            getNodeHeight,
            Math.max(0, connIndex),
            pairConns.length,
          );
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
