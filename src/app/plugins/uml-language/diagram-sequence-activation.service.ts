import { Injectable } from '@angular/core';
import { DiagramType, UmlClassNode, UmlConnection, UmlMessage } from '../../core/models/diagram.model';
import { isSequenceConnection as isSequenceConnectionLogic } from './logic/index';
import { ConnectionCascadeUtil } from './connection-cascade.util';

export interface SequenceActivationInterval {
  id: string;
  top: number;
  height: number;
}

interface ParsedSeqConn {
  conn: UmlConnection;
  slot: number;
  sourceId: string;
  targetId: string;
  isReply: boolean;
  groupKey: string;
  seqNum: string;
}

interface Interaction {
  id: string;
  initiatorId: string;
  conns: ParsedSeqConn[];
}

@Injectable({ providedIn: 'root' })
export class DiagramSequenceActivationService {
  /**
   * Determina si una conexión es de tipo respuesta en un diagrama de secuencia.
   */
  isReplyConnection(conn: UmlConnection): boolean {
    return conn.type === 'reply' || (!!conn.messages && conn.messages.some((m: UmlMessage) => m.isReturn));
  }

  /**
   * Determina el índice de slot más alto utilizado por cualquier conexión de secuencia.
   */
  getMaxSequenceSlotUsed(connections: UmlConnection[]): number {
    let maxSlot = -1;
    for (const c of connections) {
      if (!c.sourceId && !c.targetId) continue;
      const sMatch = c.sourceId?.match(/_slot_(\d+)$/);
      if (sMatch) {
        maxSlot = Math.max(maxSlot, parseInt(sMatch[1], 10));
      }
      const tMatch = c.targetId?.match(/_slot_(\d+)$/);
      if (tMatch) {
        maxSlot = Math.max(maxSlot, parseInt(tMatch[1], 10));
      }
    }
    return maxSlot;
  }

  /**
   * Comprueba si un slot numérico está ocupado por una conexión de secuencia.
   */
  isSequenceSlotOccupied(slot: number, connections: UmlConnection[], activeDiagramType?: DiagramType): boolean {
    return connections.some((c) => {
      if (!isSequenceConnectionLogic(c, activeDiagramType)) return false;
      const sMatch = c.sourceId?.match(/_slot_(\d+)$/);
      const tMatch = c.targetId?.match(/_slot_(\d+)$/);
      return (
        (sMatch && parseInt(sMatch[1], 10) === slot) ||
        (tMatch && parseInt(tMatch[1], 10) === slot)
      );
    });
  }

  /**
   * Determina la cantidad dinámica de slots de secuencia disponibles en la línea de vida.
   * Ofrece los slots ocupados y el siguiente slot libre disponible para nuevos mensajes.
   */
  getSequenceSlotCount(connections: UmlConnection[]): number {
    const maxSlot = this.getMaxSequenceSlotUsed(connections);
    return maxSlot < 0 ? 1 : maxSlot + 2;
  }

  /**
   * Retorna el arreglo de índices de slots numéricos disponibles para la línea de vida.
   */
  getSequenceSlots(connections: UmlConnection[]): number[] {
    const count = this.getSequenceSlotCount(connections);
    return Array.from({ length: count }, (_, index) => index);
  }

  /**
   * Calcula la longitud dinámica de la línea de vida.
   * La línea sobresale exactamente 20px por debajo del último mensaje existente.
   */
  getLifelineLength(node: UmlClassNode | undefined, connections: UmlConnection[]): number {
    const maxSlot = this.getMaxSequenceSlotUsed(connections);
    const nodeHeaderHeight = node?.nodeType === 'actor' ? 65 : 60;
    const minLength = node?.nodeType === 'actor' ? 80 : 120;

    if (maxSlot < 0) {
      return minLength;
    }

    const targetBottom = 210 + maxSlot * 50 + 20;
    return Math.max(minLength, targetBottom - nodeHeaderHeight);
  }

  /**
   * Calcula las cajas de activación rectangulares de una línea de vida o actor según las interacciones y respuestas.
   */
  getNodeActivations(
    node: UmlClassNode,
    connections: UmlConnection[],
    activeDiagramType?: DiagramType,
  ): SequenceActivationInterval[] {
    const isSeq = activeDiagramType === DiagramType.SEQUENCE || node.nodeType === 'lifeline';
    if (!isSeq && node.nodeType !== 'actor') {
      return [];
    }

    const headerHeight = node.nodeType === 'actor' ? 65 : 60;
    const allSeqConns: ParsedSeqConn[] = [];

    for (const c of connections) {
      if (!isSequenceConnectionLogic(c, activeDiagramType)) continue;

      const baseSrc = c.sourceNodeId || ConnectionCascadeUtil.extractBaseNodeId(c.sourceId);
      const baseTgt = c.targetNodeId || ConnectionCascadeUtil.extractBaseNodeId(c.targetId);
      if (!baseSrc || !baseTgt) continue;

      const sMatch = c.sourceId?.match(/_slot_(\d+)$/);
      const tMatch = c.targetId?.match(/_slot_(\d+)$/);
      const slot = sMatch ? parseInt(sMatch[1], 10) : tMatch ? parseInt(tMatch[1], 10) : 0;
      const isReply = this.isReplyConnection(c);

      let seqNum = '';
      if (c.messages && c.messages.length > 0 && c.messages[0].sequenceNumber) {
        seqNum = c.messages[0].sequenceNumber.trim();
      } else if (c.name) {
        seqNum = c.name.trim();
      }

      let groupKey = '';
      const match = seqNum.match(/^(\d+)(?:[.:\s]|$)/);
      if (match) {
        groupKey = match[1];
      }

      allSeqConns.push({
        conn: c,
        slot,
        sourceId: baseSrc,
        targetId: baseTgt,
        isReply,
        groupKey,
        seqNum,
      });
    }

    if (allSeqConns.length === 0) {
      if (node.activations && node.activations.length > 0) {
        return node.activations.map((a: any, i: number) => ({
          id: a.id || `act_manual_${i}`,
          top: a.startY ?? a.top ?? 40,
          height: a.height ?? 60,
        }));
      }
      return [];
    }

    allSeqConns.sort((a, b) => a.slot - b.slot);

    const interactions: Interaction[] = [];
    const keyedGroups = new Map<string, ParsedSeqConn[]>();
    const unkeyedConns: ParsedSeqConn[] = [];

    for (const sc of allSeqConns) {
      if (sc.groupKey) {
        if (!keyedGroups.has(sc.groupKey)) {
          keyedGroups.set(sc.groupKey, []);
        }
        keyedGroups.get(sc.groupKey)!.push(sc);
      } else {
        unkeyedConns.push(sc);
      }
    }

    for (const [key, grp] of keyedGroups.entries()) {
      grp.sort((a, b) => a.slot - b.slot);
      interactions.push({
        id: `keyed_${key}`,
        initiatorId: grp[0].sourceId,
        conns: grp,
      });
    }

    if (unkeyedConns.length > 0) {
      let currentInter: Interaction | null = null;
      let replySeenToInitiator = false;

      for (const sc of unkeyedConns) {
        const isNewInitiatorCall =
          currentInter &&
          (replySeenToInitiator ||
            (sc.sourceId === currentInter.initiatorId &&
              sc.slot - currentInter.conns[currentInter.conns.length - 1].slot >= 2) ||
            (sc.sourceId !== currentInter.initiatorId &&
              !currentInter.conns.some((prev) => prev.targetId === sc.sourceId || prev.sourceId === sc.sourceId)));

        if (!currentInter || isNewInitiatorCall) {
          if (currentInter) {
            interactions.push(currentInter);
          }
          currentInter = {
            id: `unkeyed_${sc.slot}`,
            initiatorId: sc.sourceId,
            conns: [sc],
          };
          replySeenToInitiator = sc.isReply && sc.targetId === sc.sourceId;
        } else {
          currentInter.conns.push(sc);
          if (sc.isReply && sc.targetId === currentInter.initiatorId) {
            replySeenToInitiator = true;
          }
        }
      }

      if (currentInter) {
        interactions.push(currentInter);
      }
    }

    const intervals: { id: string; minSlot: number; maxSlot: number }[] = [];

    for (const inter of interactions) {
      const conns = inter.conns;
      const isActorInitiator =
        (node.nodeType === 'actor' || node.id === inter.initiatorId) && node.id === inter.initiatorId;

      if (isActorInitiator) {
        const myOutgoingCalls = conns.filter((c) => c.sourceId === node.id && !c.isReply);
        if (myOutgoingCalls.length === 0) continue;

        const startSlot = Math.min(...myOutgoingCalls.map((c) => c.slot));
        const replyToInitiator = conns.find(
          (c) => c.isReply && c.targetId === node.id && c.slot > startSlot,
        );
        const endSlot = replyToInitiator ? replyToInitiator.slot : startSlot;

        intervals.push({
          id: `act_${node.id}_${inter.id}_${startSlot}_${endSlot}`,
          minSlot: startSlot,
          maxSlot: endSlot,
        });
      } else {
        const myConns = conns.filter((c) => c.sourceId === node.id || c.targetId === node.id);
        if (myConns.length === 0) {
          continue;
        }

        const incomingCalls = conns.filter((c) => c.targetId === node.id && !c.isReply);
        const effectiveIncoming =
          incomingCalls.length > 0 ? incomingCalls : conns.filter((c) => c.targetId === node.id);

        if (effectiveIncoming.length > 0) {
          const sortedIncoming = [...effectiveIncoming].sort((a, b) => a.slot - b.slot);

          for (let i = 0; i < sortedIncoming.length; i++) {
            const inc = sortedIncoming[i];
            const incSlot = inc.slot;
            const nextIncSlot = i + 1 < sortedIncoming.length ? sortedIncoming[i + 1].slot : Infinity;

            const relevantConns = conns.filter(
              (c) =>
                (c.sourceId === node.id || (c.targetId === node.id && c.isReply)) &&
                c.slot >= incSlot &&
                c.slot < nextIncSlot,
            );

            let endSlot = incSlot;
            if (relevantConns.length > 0) {
              endSlot = Math.max(...relevantConns.map((c) => c.slot));
            }

            intervals.push({
              id: `act_${node.id}_${inter.id}_${incSlot}_${endSlot}`,
              minSlot: incSlot,
              maxSlot: endSlot,
            });
          }
        }

        const orphanOutgoing = conns.filter(
          (c) => c.sourceId === node.id && !intervals.some((inv) => c.slot >= inv.minSlot && c.slot <= inv.maxSlot),
        );
        for (const out of orphanOutgoing) {
          intervals.push({
            id: `act_${node.id}_${inter.id}_${out.slot}_${out.slot}`,
            minSlot: out.slot,
            maxSlot: out.slot,
          });
        }
      }
    }

    intervals.sort((a, b) => a.minSlot - b.minSlot);

    const mergedIntervals: { id: string; minSlot: number; maxSlot: number }[] = [];
    for (const inv of intervals) {
      if (mergedIntervals.length === 0) {
        mergedIntervals.push({ ...inv });
      } else {
        const prev = mergedIntervals[mergedIntervals.length - 1];
        if (inv.minSlot <= prev.maxSlot) {
          prev.maxSlot = Math.max(prev.maxSlot, inv.maxSlot);
          prev.id = `${prev.id}_${inv.maxSlot}`;
        } else {
          mergedIntervals.push({ ...inv });
        }
      }
    }

    const selfSlotsForNode = new Set<number>(
      allSeqConns
        .filter((sc) => sc.sourceId === node.id && (sc.targetId === node.id || sc.conn.type === 'self'))
        .map((sc) => sc.slot),
    );

    return mergedIntervals.map((inv) => {
      // Posición del centro de la flecha del mensaje en la línea discontinua vertical
      const startArrow = 157 + inv.minSlot * 50 - headerHeight;
      const endArrow = 157 + inv.maxSlot * 50 - headerHeight;
      const startsWithSelf = selfSlotsForNode.has(inv.minSlot);
      const endsWithSelf = selfSlotsForNode.has(inv.maxSlot);

      let top: number;
      let height: number;

      if (inv.minSlot === inv.maxSlot) {
        if (startsWithSelf) {
          // Automensaje puntual: cubre el tramo superior (-10px) y el retorno inferior (+14px)
          top = Math.max(0, startArrow - 14);
          height = 34;
        } else {
          // Mensaje puntual: la flecha incide exactamente en el centro de la barra
          top = Math.max(0, startArrow - 12);
          height = 24;
        }
      } else {
        // Intervalo continuo: inicia antes de la llamada inicial y termina después del retorno/último mensaje
        const topPad = startsWithSelf ? 14 : 10;
        const bottomPad = endsWithSelf ? 20 : 10;
        top = Math.max(0, startArrow - topPad);
        height = endArrow - startArrow + topPad + bottomPad;
      }

      return {
        id: inv.id,
        top,
        height,
      };
    });
  }

  /**
   * Ordena las líneas de vida y actores de izquierda a derecha según su coordenada X.
   *
   * @param nodes Lista de nodos del diagrama.
   * @returns Nueva lista con los participantes de secuencia alineados horizontalmente.
   */
  sortLifelinesLeftToRight(nodes: UmlClassNode[]): UmlClassNode[] {
    const seqNodes = nodes.filter(
      (n) => (n.nodeType === 'lifeline' || n.nodeType === 'actor') && !n.isAnchor,
    );
    if (seqNodes.length <= 1) return nodes;

    const sortedSeq = [...seqNodes].sort((a, b) => (a.position?.x || 0) - (b.position?.x || 0));
    let nextMinX = Math.max(60, sortedSeq[0]?.position?.x || 80);
    const updatedMap = new Map<string, UmlClassNode>();

    for (const sn of sortedSeq) {
      const currentX = sn.position?.x || nextMinX;
      const finalX = Math.max(nextMinX, currentX);
      const width = sn.width || (sn.nodeType === 'actor' ? 65 : 160);
      updatedMap.set(sn.id, {
        ...sn,
        position: { x: finalX, y: 50 },
      });
      nextMinX = finalX + width + 40;
    }

    return nodes.map((n) => updatedMap.get(n.id) || n);
  }

  /**
   * Recalcula las barras de activación (`activations`) almacenadas en cada nodo de secuencia
   * a partir de los slots de los mensajes entrantes y salientes.
   *
   * @param nodes Lista de nodos del diagrama.
   * @param connections Lista de conexiones del diagrama.
   * @param activeDiagramType Tipo de diagrama activo.
   * @returns Objeto indicando si hubo cambios y la lista actualizada de nodos.
   */
  recalculateSequenceActivationBars(
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    activeDiagramType: DiagramType,
  ): { changed: boolean; updatedNodes: UmlClassNode[] } {
    if (activeDiagramType !== DiagramType.SEQUENCE) {
      return { changed: false, updatedNodes: nodes };
    }

    const seqConns = connections.filter((c) => isSequenceConnectionLogic(c, activeDiagramType));
    if (seqConns.length === 0) {
      return { changed: false, updatedNodes: nodes };
    }

    let changed = false;
    const updatedNodes = nodes.map((n) => {
      if ((n.nodeType !== 'lifeline' && n.nodeType !== 'actor') || n.isAnchor) {
        return n;
      }

      const acts = this.getNodeActivations(n, connections, activeDiagramType);
      const nextActivations = acts.map((a) => ({
        id: a.id,
        startY: a.top,
        height: a.height,
      }));

      const prev = n.activations || [];
      if (
        prev.length !== nextActivations.length ||
        prev.some(
          (p, idx) =>
            p.startY !== nextActivations[idx].startY || p.height !== nextActivations[idx].height,
        )
      ) {
        changed = true;
        return { ...n, activations: nextActivations };
      }
      return n;
    });

    return { changed, updatedNodes };
  }

  /**
   * Sincroniza la posición vertical (`y = 50`) y las barras de activación de los nodos de secuencia.
   *
   * @param nodes Lista de nodos del diagrama.
   * @param connections Lista de conexiones del diagrama.
   * @param activeDiagramType Tipo de diagrama activo.
   * @returns Objeto indicando si hubo modificaciones y los nodos sincronizados.
   */
  syncTimelineForSequenceNodes(
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    activeDiagramType: DiagramType,
  ): { changed: boolean; updatedNodes: UmlClassNode[] } {
    if (activeDiagramType !== DiagramType.SEQUENCE) {
      return { changed: false, updatedNodes: nodes };
    }

    let posChanged = false;
    const alignedNodes = nodes.map((n) => {
      if ((n.nodeType === 'lifeline' || n.nodeType === 'actor') && !n.isAnchor && n.position.y !== 50) {
        posChanged = true;
        return { ...n, position: { x: n.position.x, y: 50 } };
      }
      return n;
    });

    const actResult = this.recalculateSequenceActivationBars(alignedNodes, connections, activeDiagramType);
    return {
      changed: posChanged || actResult.changed,
      updatedNodes: actResult.updatedNodes,
    };
  }
}
