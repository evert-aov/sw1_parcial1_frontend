import { Injectable } from '@angular/core';
import { DiagramType, UmlClassNode, UmlConnection, UmlMessage } from '../../../../core/models/diagram.model';
import { isSequenceConnection as isSequenceConnectionLogic } from '../components/diagram-canvas/nodes';

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
   * Calcula la longitud dinámica de la línea de vida para asegurar que abarque todos los mensajes más holgura.
   */
  getLifelineLength(node: UmlClassNode | undefined, connections: UmlConnection[]): number {
    const maxSlot = this.getMaxSequenceSlotUsed(connections);
    const count = Math.max(4, maxSlot + 1 + 3);
    const nodeHeaderHeight = node?.nodeType === 'actor' ? 95 : 60;
    const targetBottom = 160 + (count - 1) * 50 + 40;
    const minLength = node?.nodeType === 'actor' ? 80 : 120;
    return Math.max(minLength, targetBottom - nodeHeaderHeight);
  }

  /**
   * Calcula las cajas de activación rectangulares de una línea de vida según las interacciones y respuestas.
   */
  getNodeActivations(
    node: UmlClassNode,
    connections: UmlConnection[],
    activeDiagramType?: DiagramType,
  ): SequenceActivationInterval[] {
    if (activeDiagramType !== DiagramType.SEQUENCE && node.nodeType !== 'lifeline') {
      return [];
    }

    const headerHeight = node.nodeType === 'actor' ? 95 : 60;
    const allSeqConns: ParsedSeqConn[] = [];

    for (const c of connections) {
      if (!isSequenceConnectionLogic(c, activeDiagramType)) continue;

      const baseSrc = c.sourceNodeId || c.sourceId?.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
      const baseTgt = c.targetNodeId || c.targetId?.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
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
      const dotMatch = seqNum.match(/^(\d+)(?:\.|$)/);
      if (dotMatch) {
        groupKey = dotMatch[1];
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
      const interMinSlot = Math.min(...conns.map((c) => c.slot));
      const interMaxSlot = Math.max(...conns.map((c) => c.slot));

      const isActorInitiator = node.nodeType === 'actor' && node.id === inter.initiatorId;

      if (isActorInitiator) {
        const startSlot = interMinSlot;
        const replyToInitiator = conns.find(
          (c) => c.isReply && c.targetId === node.id && c.slot > startSlot,
        );
        const endSlot = replyToInitiator ? replyToInitiator.slot : interMaxSlot;

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
        const effectiveIncoming = incomingCalls.length > 0 ? incomingCalls : conns.filter((c) => c.targetId === node.id);

        if (effectiveIncoming.length > 0) {
          const sortedIncoming = [...effectiveIncoming].sort((a, b) => a.slot - b.slot);

          for (let i = 0; i < sortedIncoming.length; i++) {
            const inc = sortedIncoming[i];
            const incSlot = inc.slot;
            const nextIncSlot = i + 1 < sortedIncoming.length ? sortedIncoming[i + 1].slot : Infinity;

            const myOutgoing = conns.filter(
              (c) => c.sourceId === node.id && c.slot >= incSlot && c.slot < nextIncSlot,
            );

            let endSlot = incSlot;
            if (myOutgoing.length > 0) {
              endSlot = Math.max(...myOutgoing.map((c) => c.slot));
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

    return mergedIntervals.map((inv) => {
      const slotYStart = 160 + inv.minSlot * 50 - headerHeight;
      const slotYEnd = 160 + inv.maxSlot * 50 - headerHeight;
      const top = Math.max(0, slotYStart - 4);
      const height = slotYEnd - slotYStart + 22;
      return {
        id: inv.id,
        top,
        height,
      };
    });
  }
}
