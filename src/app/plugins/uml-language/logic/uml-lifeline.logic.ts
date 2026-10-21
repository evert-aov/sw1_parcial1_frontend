import { getImportedSequenceColor } from '../../../plugin-sdk/sequence-colors';
import { DiagramType, UmlClassNode, UmlConnection, UmlMessage } from '../../../core/models/diagram.model';

export const SEQUENCE_PALETTE = [
  '#0284C7', // Grupo 1: Azul cielo
  '#7C3AED', // Grupo 2: Violeta
  '#059669', // Grupo 3: Esmeralda
  '#D97706', // Grupo 4: Ámbar
  '#DC2626', // Grupo 5: Rojo carmesí
  '#0891B2', // Grupo 6: Cyan
  '#4F46E5', // Grupo 7: Índigo
  '#C026D3', // Grupo 8: Magenta
] as const;

export const SEQUENCE_RELATIONSHIP_TYPES = ['sync', 'reply', 'async', 'create', 'self'] as const;

/**
 * Determina si un tipo de relación pertenece a la semántica de interacción secuencial
 */
export function isSequenceRelationshipType(type?: string | null): boolean {
  return !!type && (SEQUENCE_RELATIONSHIP_TYPES as readonly string[]).includes(type);
}

/**
 * Determina si una conexión o tipo de relación actúa como enlace de secuencia
 */
export function isSequenceConnection(
  conn: { type?: string | null } | string | null | undefined,
  activeDiagramType?: DiagramType | null,
): boolean {
  if (activeDiagramType === DiagramType.COMMUNICATION) {
    return false;
  }
  const connType = typeof conn === 'string' ? conn : conn?.type;
  return activeDiagramType === DiagramType.SEQUENCE || isSequenceRelationshipType(connType);
}

/**
 * Obtiene el color de paleta correspondiente al número de secuencia de un mensaje
 */
export function getSequenceMessageColor(sequenceNumber?: string | null): string {
  const match = (sequenceNumber || '').trim().match(/^(\d+)(?:\.|$)/);
  if (match) {
    const g = parseInt(match[1], 10);
    return SEQUENCE_PALETTE[(Math.max(1, g) - 1) % SEQUENCE_PALETTE.length];
  }
  return SEQUENCE_PALETTE[0];
}

/**
 * Genera el modelo inicial para un nuevo mensaje de secuencia
 */
export function generateNextSequenceMessage(
  sourceNode?: UmlClassNode,
  targetNode?: UmlClassNode,
  isReturn: boolean = false,
): UmlMessage[] {
  return [
    {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      sequenceNumber: '',
      functionName: 'msj',
      parameters: '',
      returnType: '',
      isReturn,
      direction: 'forward',
      orderIndex: 0,
      color: '#0284C7',
    },
  ];
}

/**
 * Encuentra el siguiente índice numérico de slot temporal disponible en un diagrama de secuencia.
 */
export function findNextAvailableSlot(connections: UmlConnection[]): string {
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
export function isSequenceSlotOccupied(
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
 * Calcula el desplazamiento ordenado y no colisionante de un mensaje de secuencia o grupo
 * de mensajes jerárquicos entre slots temporales.
 */
export function computeSequenceMessageMove(
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
        (c.id === connectionId || (c.messages?.[0]?.sequenceNumber?.trim() || '').startsWith(groupPrefix)),
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
    const baseSrc = c.sourceNodeId || c.sourceId?.replace(/_((top|bottom|left|right)(_start|_end)?|slot_\d+)$/, '');
    const baseTgt = c.targetNodeId || c.targetId?.replace(/_((top|bottom|left|right)(_start|_end)?|slot_\d+)$/, '');

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
 * Recalcula la numeración secuencial jerárquica (o cronológica) de los mensajes en diagramas de secuencia
 */
export function recalculateSequenceNumbers(
  connectionsList: UmlConnection[],
  nodes: UmlClassNode[],
  activeDiagramType: DiagramType,
  preserveSequenceNumbers = false,
): UmlConnection[] {
  const isSeq = activeDiagramType === DiagramType.SEQUENCE;
  if (!isSeq) {
    return connectionsList;
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  interface SeqConnMeta {
    conn: UmlConnection;
    slot: number;
    index: number;
  }

  const seqMetas: SeqConnMeta[] = [];
  connectionsList.forEach((c, idx) => {
    const isConnSeq =
      isSeq || ['sync', 'reply', 'async', 'create', 'self'].includes(c.type as any);
    if (isConnSeq) {
      const sMatch = c.sourceId?.match(/_slot_(\d+)$/);
      const tMatch = c.targetId?.match(/_slot_(\d+)$/);
      const hasExplicitSlot = Boolean(sMatch || tMatch);
      const slot = sMatch
        ? parseInt(sMatch[1], 10)
        : tMatch
        ? parseInt(tMatch[1], 10)
        : c.messages?.[0]?.orderIndex ?? idx;
      seqMetas.push({ conn: c, slot, index: idx, hasExplicitSlot } as SeqConnMeta & { hasExplicitSlot: boolean });
    }
  });

  if (seqMetas.length === 0) {
    return connectionsList;
  }

  // Ordenar cronológicamente de arriba hacia abajo según el slot
  seqMetas.sort((a, b) => a.slot - b.slot || a.index - b.index);

  let currentGroup = 0;
  let childIndex = 0;

  const updatedConnMap = new Map<string, UmlConnection>();

  let globalOrderIndex = 0;
  for (const meta of seqMetas as Array<SeqConnMeta & { hasExplicitSlot?: boolean }>) {
    const c = meta.conn;
    const baseSourceId = c.sourceNodeId || c.sourceId?.replace(/_((top|bottom|left|right)(_start|_end)?|slot_\d+)$/, '');
    const sourceNode = nodeMap.get(baseSourceId);

    // Una nueva interacción/grupo inicia cuando el Actor envía un mensaje hacia una línea de vida
    const isActorSource = sourceNode?.nodeType === 'actor';

    let seqNum: string;
    if (isActorSource || currentGroup === 0) {
      currentGroup++;
      childIndex = 0;
      seqNum = `${currentGroup}`;
    } else {
      childIndex++;
      seqNum = `${currentGroup}.${childIndex}`;
    }

    // Cargar/importar no debe convertir etiquetas EA explícitas en grupos por actor.
    const explicitNumber = c.messages?.[0]?.sequenceNumber?.trim();
    if (preserveSequenceNumbers && explicitNumber) seqNum = explicitNumber;
    const color = preserveSequenceNumbers
      ? getImportedSequenceColor(seqNum)
      : SEQUENCE_PALETTE[(currentGroup - 1) % SEQUENCE_PALETTE.length];

    const slotY = meta.hasExplicitSlot ? 200 + meta.slot * 35 : undefined;
    const connMsgType = (['sync', 'reply', 'async', 'create'].includes(c.type) ? c.type : 'sync') as UmlMessage['type'];

    let updatedMessages: UmlMessage[];
    if (c.messages && c.messages.length > 0) {
      updatedMessages = c.messages.map((m: UmlMessage, mIdx: number) => {
        if (mIdx === 0) {
          return {
            ...m,
            sequenceNumber: seqNum,
            direction: m.direction ?? 'forward',
            type: (m.type ?? connMsgType) as UmlMessage['type'],
            isReturn: m.isReturn ?? c.type === 'reply',
            orderIndex: globalOrderIndex++,
            positionY: slotY ?? m.positionY,
            color,
          };
        }
        return { ...m, orderIndex: globalOrderIndex++ };
      });
    } else {
      updatedMessages = [
        {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          sequenceNumber: seqNum,
          functionName: 'msj',
          parameters: '',
          returnType: '',
          isReturn: c.type === 'reply',
          direction: 'forward',
          orderIndex: globalOrderIndex++,
          positionY: slotY,
          type: connMsgType,
          color,
        },
      ];
    }

    const updatedConn: UmlConnection = {
      ...c,
      name: c.name && /^\d+(\.\d+)*$/.test(c.name.trim()) ? seqNum : c.name,
      messages: updatedMessages,
    };

    updatedConnMap.set(c.id, updatedConn);
  }

  return connectionsList.map((c) => updatedConnMap.get(c.id) || c);
}
