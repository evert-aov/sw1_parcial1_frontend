import { inject, Injectable } from '@angular/core';
import {
  DiagramType,
  sanitizeLineStyle,
  UmlClassNode,
  UmlConnection,
  UmlLineStyle,
  UmlMessage,
  UmlRelationshipType,
} from '../../../../../core/models/diagram.model';
import { DiagramConnectionLayoutService } from '../spatial-engine/diagram-connection-layout.service';
import { isSequenceConnection } from '../../components/diagram-canvas/nodes';
import {
  EXPLICIT_SIZE_NODE_TYPES,
  UmlNodeNormalizerUtil,
} from '../../utils/uml-node-normalizer.util';
import { ConnectionCascadeUtil } from '../../utils/connection-cascade.util';

export const PREDEFINED_DATA_TYPES: string[] = [
  'UUID', 'String', 'Integer', 'Long', 'Boolean', 'Double',
  'Float', 'BigDecimal', 'LocalDate', 'LocalDateTime', 'Date', 'Text', 'byte[]',
];

export const PREDEFINED_RETURN_TYPES: string[] = [
  'void', 'UUID', 'String', 'Integer', 'Long', 'Boolean',
  'Double', 'BigDecimal', 'LocalDate', 'LocalDateTime', 'List<Object>', 'Object',
];

/**
 * Servicio especializado en sincronizar, normalizar y aplicar mutaciones generadas por IA
 * o recibidas desde clientes externos sobre el grafo reactivo de nodos y conexiones UML.
 */
@Injectable({
  providedIn: 'root',
})
export class DiagramAiSyncService {
  private readonly connectionLayoutService: DiagramConnectionLayoutService;

  constructor(layoutService?: DiagramConnectionLayoutService) {
    if (layoutService) {
      this.connectionLayoutService = layoutService;
    } else {
      let injected: DiagramConnectionLayoutService | null = null;
      try {
        injected = inject(DiagramConnectionLayoutService, { optional: true });
      } catch {
        // Outside Angular DI context (e.g. unit tests with Object.create)
      }
      this.connectionLayoutService = injected ?? new DiagramConnectionLayoutService();
    }
  }

  /**
   * Precalcula la posición del nodo ancla antes de emitir a señales para que nazca en el punto medio.
   */
  precalculateAnchorPositions(
    cleanNodes: UmlClassNode[],
    targetConns: UmlConnection[],
    getOptimalConnectorId: (
      sourceNode: UmlClassNode,
      targetNode: UmlClassNode,
    ) => { sourceId: string; targetId: string },
    getConnectorPoint: (node: UmlClassNode, side: string) => { x: number; y: number },
  ): void {
    const nodeMap = new Map(cleanNodes.map((n) => [n.id, n]));
    for (const conn of targetConns) {
      if (conn.assocAnchorNodeId) {
        const anchorNode = nodeMap.get(conn.assocAnchorNodeId);
        const baseSourceId = conn.sourceNodeId || ConnectionCascadeUtil.extractBaseNodeId(conn.sourceId);
        const baseTargetId = conn.targetNodeId || ConnectionCascadeUtil.extractBaseNodeId(conn.targetId);
        const sourceNode = baseSourceId ? nodeMap.get(baseSourceId) : undefined;
        const targetNode = baseTargetId ? nodeMap.get(baseTargetId) : undefined;
        if (anchorNode && sourceNode && targetNode) {
          const optimal = getOptimalConnectorId(sourceNode, targetNode);
          const sSide = optimal.sourceId.split('_').pop() || 'right';
          const tSide = optimal.targetId.split('_').pop() || 'left';
          const p1 = getConnectorPoint(sourceNode, sSide);
          const p2 = getConnectorPoint(targetNode, tSide);
          anchorNode.position = {
            x: Math.round((p1.x + p2.x) / 2),
            y: Math.round((p1.y + p2.y) / 2),
          };
        }
      }
    }
  }

  /**
   * Redibujado secuencial de tres fases tras mutaciones estructurales por IA.
   */
  schedulePostMutationRedraw(callbacks: {
    updateEndpoints: () => void;
    resetCanvas?: () => void;
    fitView?: () => void;
    redrawCanvas?: () => void;
  }): void {
    requestAnimationFrame(() => {
      callbacks.updateEndpoints();
      requestAnimationFrame(() => {
        callbacks.updateEndpoints();
        callbacks.resetCanvas?.();
        setTimeout(() => {
          callbacks.updateEndpoints();
          callbacks.fitView?.();
          setTimeout(() => {
            callbacks.redrawCanvas?.();
          }, 80);
        }, 80);
      });
    });
  }

  /**
   * Procesa la mutación completa por IA: valida nodos, precalcula anclas y sanitiza conexiones.
   */
  processAiMutation(params: {
    targetNodes: any[];
    targetConns: any[];
    activeDiagramType: DiagramType;
    defaultLineStyle: UmlLineStyle;
    getDefaultColorForNodeType: (nodeType?: string | null, stereotype?: string | null) => string;
    getOptimalConnectorId: (
      sourceNode: UmlClassNode,
      targetNode: UmlClassNode,
    ) => { sourceId: string; targetId: string };
    getConnectorPoint: (node: UmlClassNode, side: string) => { x: number; y: number };
    recalculateSequenceNumbers: (conns: UmlConnection[], preserve?: boolean) => UmlConnection[];
  }): { cleanNodes: UmlClassNode[]; cleanConns: UmlConnection[] } {
    const cleanNodes = this.applyAiNodesMutation(
      params.targetNodes,
      params.getDefaultColorForNodeType,
    );
    this.precalculateAnchorPositions(
      cleanNodes,
      params.targetConns,
      params.getOptimalConnectorId,
      params.getConnectorPoint,
    );
    const cleanConns = this.sanitizeClientConnections(
      params.targetConns,
      cleanNodes,
      params.activeDiagramType,
      params.defaultLineStyle,
      params.recalculateSequenceNumbers,
    );
    return { cleanNodes, cleanConns };
  }

  /** Normaliza un tipo de dato de atributo al catálogo predefinido. */
  normalizeDataType(type: string): string {
    if (!type) return 'String';
    const found = PREDEFINED_DATA_TYPES.find((t) => t.toLowerCase() === type.trim().toLowerCase());
    return found || 'String';
  }

  /** Normaliza un tipo de retorno de método al catálogo predefinido. */
  normalizeReturnType(type: string): string {
    if (!type) return 'void';
    const found = PREDEFINED_RETURN_TYPES.find(
      (rt) => rt.toLowerCase() === type.trim().toLowerCase(),
    );
    return found || 'void';
  }

  /** Normaliza un mensaje de secuencia o comunicación delegando en `UmlNodeNormalizerUtil`. */
  public normalizeUmlMessage(m: any, defaultSeq = '1'): UmlMessage {
    return UmlNodeNormalizerUtil.normalizeUmlMessage(m, defaultSeq);
  }

  /**
   * Normaliza y sanea la lista de nodos generada por IA con dimensiones y colores consistentes.
   */
  applyAiNodesMutation(
    targetNodes: any[],
    getDefaultColor: (nodeType?: string | null, stereotype?: string | null) => string,
  ): UmlClassNode[] {
    return targetNodes.map((n, i) => {
      const nodeType = UmlNodeNormalizerUtil.inferNodeType(n, { inspectNameForUseCase: true });
      const isExplicitSizeNode = (EXPLICIT_SIZE_NODE_TYPES as readonly string[]).includes(nodeType);
      const isManuallyResized =
        !!n.isCustomSize ||
        (!!n.customHeight && n.customHeight > 0) ||
        isExplicitSizeNode ||
        (!!(n.height && n.height > 0) && nodeType === 'class');

      const { defaultWidth, defaultHeight } = UmlNodeNormalizerUtil.getDefaultDimensions(nodeType, {
        width: 70,
        height: 70,
      });
      const adjDefaultW = nodeType === 'use_case' ? 150 : nodeType === 'lifeline' ? 120 : defaultWidth;
      const adjDefaultH = nodeType === 'use_case' ? 65 : defaultHeight;

      const isBce = ['boundary', 'control', 'entity'].includes(nodeType);
      const resolvedW = n.isAnchor ? 0 : isBce ? 70 : n.width || adjDefaultW;
      const resolvedH = n.isAnchor
        ? 0
        : nodeType === 'lifeline'
        ? 60
        : isBce
        ? 70
        : n.height || adjDefaultH;

      return {
        id: n.id || `class_ai_${Date.now()}_${i}`,
        name:
          n.name ||
          (n.isAnchor ? '' : nodeType === 'boundary_box' ? 'BoundaryBox' : `Clase_${i + 1}`),
        position: {
          x: n.position?.x ?? n.positionX ?? 100 + (i % 3) * 260,
          y: n.position?.y ?? n.positionY ?? 100 + Math.floor(i / 3) * 220,
        },
        width: resolvedW,
        height: resolvedH,
        customWidth: n.customWidth || (isExplicitSizeNode ? resolvedW : undefined),
        customHeight: n.customHeight || (isExplicitSizeNode ? resolvedH : undefined),
        isCustomSize: isManuallyResized,
        color: UmlNodeNormalizerUtil.resolveNodeColor(n.color, nodeType, n.stereotype, getDefaultColor),
        nodeType,
        stereotype: n.stereotype || null,
        activations: n.activations || [],
        labelOffset: n.labelOffset,
        isAnchor: !!n.isAnchor,
        assocMainConnId: n.assocMainConnId,
        attributes: (n.attributes || []).map((a: any) => ({
          ...a,
          name: a.name,
          type: this.normalizeDataType(a.type),
          nullable: a.nullable !== undefined ? a.nullable : true,
          unique: a.unique !== undefined ? a.unique : false,
          length: a.length !== undefined ? a.length : 255,
          defaultValue: a.defaultValue ?? a.default ?? null,
        })),
        methods: (n.methods || []).map((m: any) => ({
          name: m.name,
          parameters: m.parameters || '',
          returnType: this.normalizeReturnType(m.returnType),
        })),
      };
    });
  }

  /**
   * Sanitiza, desempaca y ordena las conexiones entrantes según el tipo de diagrama activo.
   */
  sanitizeClientConnections(
    conns: any[],
    validNodes: UmlClassNode[],
    activeDiagramType: DiagramType,
    defaultLineStyle: UmlLineStyle = 'straight',
    recalculateSeqNumbers?: (conns: UmlConnection[], preserveOrder?: boolean) => UmlConnection[],
  ): UmlConnection[] {
    const nodeMap = new Map(validNodes.map((n) => [n.id, n]));
    const nodeIds = new Set(validNodes.map((n) => n.id));
    const extractBaseNodeId = (rawId?: string) =>
      ConnectionCascadeUtil.extractBaseNodeId(rawId);

    const isCommDiagram = activeDiagramType === DiagramType.COMMUNICATION;
    const seqConns: any[] = [];
    const commMergedMap = new Map<string, any>();
    const otherConns: any[] = [];

    for (const c of conns) {
      const s = c.sourceNodeId || extractBaseNodeId(c.sourceId);
      const t = c.targetNodeId || extractBaseNodeId(c.targetId);
      if (!nodeIds.has(s) || !nodeIds.has(t)) continue;

      const isSeqConn =
        isSequenceConnection(c, activeDiagramType) ||
        Boolean(c.sourceId?.includes('_slot_') || c.targetId?.includes('_slot_'));

      if (isSeqConn) {
        const rawMsgs =
          c.messages && c.messages.length > 0
            ? c.messages
            : c.name
            ? [{ name: c.name, type: c.type }]
            : [{ functionName: 'msj', type: c.type || 'sync' }];

        rawMsgs.forEach((m: any, mIdx: number) => {
          const norm = this.normalizeUmlMessage(m, `${seqConns.length + 1}`);
          const isMsgReverse = norm.direction === 'reverse';
          const swap = isMsgReverse && c.type !== 'reply' && !c.isReturn && mIdx > 0;
          norm.direction = 'forward';
          seqConns.push({
            ...c,
            id:
              rawMsgs.length === 1 && c.id
                ? c.id
                : `msg_${Date.now()}_${seqConns.length}_${Math.random().toString(36).substring(2, 5)}`,
            sourceNodeId: swap ? t : s,
            targetNodeId: swap ? s : t,
            type: norm.type || (isMsgReverse ? 'reply' : 'sync'),
            lineStyle: 'straight',
            sourceMultiplicity: '',
            targetMultiplicity: '',
            messages: [norm],
          });
        });
      } else if (isCommDiagram) {
        const pairKey = [s, t].sort().join('___');
        const rawMsgs =
          c.messages && c.messages.length > 0 ? c.messages : c.name ? [{ name: c.name }] : [];

        if (commMergedMap.has(pairKey)) {
          const existing = commMergedMap.get(pairKey);
          const isReversedPair = (existing.sourceNodeId || extractBaseNodeId(existing.sourceId)) !== s;
          const normalizedNewMsgs = rawMsgs.map((m: any, mIdx: number) => {
            const norm = this.normalizeUmlMessage(m, `${(existing.messages || []).length + mIdx + 1}`);
            if (isReversedPair) {
              norm.direction = norm.direction === 'reverse' ? 'forward' : 'reverse';
            }
            return norm;
          });
          existing.messages = existing.messages || [];
          for (const nm of normalizedNewMsgs) {
            if (
              !existing.messages.some(
                (em: any) => em.sequenceNumber === nm.sequenceNumber && em.functionName === nm.functionName,
              )
            ) {
              existing.messages.push(nm);
            }
          }
        } else {
          const normalizedMsgs = rawMsgs.map((m: any, mIdx: number) =>
            this.normalizeUmlMessage(m, `${mIdx + 1}`),
          );
          commMergedMap.set(pairKey, {
            ...c,
            sourceNodeId: s,
            targetNodeId: t,
            messages: normalizedMsgs.length > 0 ? normalizedMsgs : undefined,
          });
        }
      } else {
        otherConns.push({ ...c, sourceNodeId: s, sourceId: c.sourceId, targetNodeId: t, targetId: c.targetId });
      }
    }

    const usedSlots = new Set<number>();
    let nextFreeSlot = 0;
    seqConns.sort((a, b) => {
      const order = (c: any) => {
        const match = c.sourceId?.match(/_slot_(\d+)$/) || c.targetId?.match(/_slot_(\d+)$/);
        return match ? Number(match[1]) : c.messages?.[0]?.orderIndex;
      };
      return (order(a) ?? conns.length) - (order(b) ?? conns.length);
    });

    const normalizedSeqConns: UmlConnection[] = seqConns.map((conn) => {
      const sMatch = conn.sourceId?.match(/_slot_(\d+)$/);
      const tMatch = conn.targetId?.match(/_slot_(\d+)$/);
      let slot = sMatch ? parseInt(sMatch[1], 10) : tMatch ? parseInt(tMatch[1], 10) : -1;
      if (slot < 0 || usedSlots.has(slot)) {
        while (usedSlots.has(nextFreeSlot)) nextFreeSlot++;
        slot = nextFreeSlot;
      }
      usedSlots.add(slot);
      nextFreeSlot = Math.max(nextFreeSlot, slot + 1);
      const msg = conn.messages[0];
      return {
        id: conn.id || `msg_${Date.now()}_${slot}`,
        sourceNodeId: conn.sourceNodeId,
        targetNodeId: conn.targetNodeId,
        sourceId: `${conn.sourceNodeId}_slot_${slot}`,
        targetId: `${conn.targetNodeId}_slot_${slot}`,
        type: (conn.type as UmlRelationshipType) || (msg?.isReturn ? 'reply' : 'sync'),
        lineStyle: 'straight',
        name: undefined,
        sourceMultiplicity: '',
        targetMultiplicity: '',
        assocAnchorNodeId: undefined,
        messages: [msg],
      };
    });

    const normalizedCommConns: UmlConnection[] = Array.from(commMergedMap.values()).map((c) => {
      const sourceNodeId = c.sourceNodeId || extractBaseNodeId(c.sourceId);
      const targetNodeId = c.targetNodeId || extractBaseNodeId(c.targetId);
      const sortedMessages = (c.messages || []).slice().sort((a: any, b: any) => {
        const parseSeq = (str: string) =>
          String(str || '')
            .split('.')
            .map((n) => parseInt(n, 10) || 0);
        const pa = parseSeq(a.sequenceNumber);
        const pb = parseSeq(b.sequenceNumber);
        for (let k = 0; k < Math.max(pa.length, pb.length); k++) {
          const diff = (pa[k] || 0) - (pb[k] || 0);
          if (diff !== 0) return diff;
        }
        return 0;
      });
      return {
        id: c.id || `conn_comm_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        sourceNodeId,
        targetNodeId,
        sourceId: c.sourceId || `${sourceNodeId}_right`,
        targetId: c.targetId || `${targetNodeId}_left`,
        type: (c.type as UmlRelationshipType) || 'association',
        lineStyle: sanitizeLineStyle(c.lineStyle, 'straight'),
        name: sortedMessages.length > 0 ? undefined : c.name || undefined,
        sourceMultiplicity: '',
        targetMultiplicity: '',
        assocAnchorNodeId: undefined,
        messages: sortedMessages.length > 0 ? sortedMessages : undefined,
      };
    });

    const normalizedOtherConns: UmlConnection[] = otherConns.map((c) => {
      const sourceNodeId = c.sourceNodeId || extractBaseNodeId(c.sourceId);
      const targetNodeId = c.targetNodeId || extractBaseNodeId(c.targetId);
      const sourceNode = nodeMap.get(sourceNodeId);
      const targetNode = nodeMap.get(targetNodeId);
      let sourceId = c.sourceId;
      let targetId = c.targetId;

      if (sourceNode && targetNode) {
        if (sourceNodeId === targetNodeId) {
          sourceId = sourceId || `${sourceNodeId}_top`;
          targetId = targetId || `${targetNodeId}_right`;
        } else if (c.type === 'association_class') {
          const optimal = this.connectionLayoutService.getOptimalConnectorId(sourceNode, targetNode);
          sourceId = sourceNode.isAnchor ? sourceNode.id : optimal.sourceId;
          targetId = targetNode.isAnchor ? targetNode.id : optimal.targetId;
        } else if (!sourceNode.isAnchor && !targetNode.isAnchor) {
          const optimal = this.connectionLayoutService.getOptimalConnectorId(sourceNode, targetNode);
          sourceId = optimal.sourceId;
          targetId = optimal.targetId;
        }
      }

      return {
        id: c.id || `conn_ai_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        sourceNodeId,
        targetNodeId,
        sourceId: sourceId || `${sourceNodeId}_right`,
        targetId: targetId || `${targetNodeId}_left`,
        type: (c.type as UmlRelationshipType) || 'association',
        lineStyle: sanitizeLineStyle(c.lineStyle, defaultLineStyle),
        name: c.name || undefined,
        sourceMultiplicity: c.sourceMultiplicity || '',
        targetMultiplicity: c.targetMultiplicity || '',
        assocAnchorNodeId: c.assocAnchorNodeId || undefined,
        messages: c.messages,
      };
    });

    const combined = [...normalizedSeqConns, ...normalizedCommConns, ...normalizedOtherConns];
    if (activeDiagramType === DiagramType.SEQUENCE && recalculateSeqNumbers) {
      return recalculateSeqNumbers(combined, true);
    }
    return combined;
  }
}
