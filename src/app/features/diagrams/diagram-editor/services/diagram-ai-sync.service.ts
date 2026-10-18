import { inject, Injectable } from '@angular/core';
import {
  DiagramType,
  UmlClassNode,
  UmlConnection,
  UmlLineStyle,
  UmlMessage,
  UmlMessageType,
  UmlNodeType,
  UmlRelationshipType,
} from '../../../../core/models/diagram.model';
import { DiagramConnectionLayoutService } from './diagram-connection-layout.service';
import { DiagramAstNormalizerService } from './diagram-ast-normalizer.service';
import { isSequenceConnection } from '../components/diagram-canvas/nodes';

export const PREDEFINED_DATA_TYPES: string[] = [
  'UUID',
  'String',
  'Integer',
  'Long',
  'Boolean',
  'Double',
  'Float',
  'BigDecimal',
  'LocalDate',
  'LocalDateTime',
  'Date',
  'Text',
  'byte[]',
];

export const PREDEFINED_RETURN_TYPES: string[] = [
  'void',
  'UUID',
  'String',
  'Integer',
  'Long',
  'Boolean',
  'Double',
  'BigDecimal',
  'LocalDate',
  'LocalDateTime',
  'List<Object>',
  'Object',
];

/**
 * Nodo crudo proveniente de IA o sincronización remota: todos los campos son opcionales
 * y puede traer coordenadas planas (`positionX` / `positionY`) en lugar de `position`.
 */
export type AiRawNode = Partial<UmlClassNode> & {
  positionX?: number;
  positionY?: number;
};

/** Conexión cruda proveniente de IA o sincronización remota. */
export type AiRawConnection = Partial<UmlConnection>;

/** Callbacks de las fases del redibujado posterior a una mutación por IA. */
export interface PostMutationCallbacks {
  updateEndpoints: () => void;
  resetCanvas?: () => void;
  fitView?: () => void;
  redrawCanvas?: () => void;
}

@Injectable({
  providedIn: 'root',
})
export class DiagramAiSyncService {
  private readonly connectionLayoutService: DiagramConnectionLayoutService;
  // Normalizador sin estado: se instancia directamente para seguir siendo válido fuera de DI.
  private readonly astNormalizer = new DiagramAstNormalizerService();

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
   * Precalcula la posición del ancla antes de emitir a señales para que nazca en el punto medio
   */
  precalculateAnchorPositions(
    cleanNodes: UmlClassNode[],
    targetConns: AiRawConnection[],
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
        const baseSourceId =
          conn.sourceNodeId || this.astNormalizer.extractBaseNodeId(conn.sourceId);
        const baseTargetId =
          conn.targetNodeId || this.astNormalizer.extractBaseNodeId(conn.targetId);
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
   * Redibujado secuencial de tres fases tras mutaciones estructurales por IA
   * (Fase 1: cálculo de extremos; Fase 2: reset del layout DOM; Fase 3: encuadre y refresco final).
   *
   * La cadena es cancelable: tanto mediante el `AbortSignal` opcional como con la función
   * de cancelación retornada, que libera los rAF/setTimeout pendientes.
   *
   * @param callbacks Acciones de cada fase.
   * @param signal Señal de aborto opcional (p. ej. al destruir el componente).
   * @returns Función que cancela las fases aún no ejecutadas.
   */
  schedulePostMutationRedraw(callbacks: PostMutationCallbacks, signal?: AbortSignal): () => void {
    let raf1: number | undefined;
    let raf2: number | undefined;
    let t1: ReturnType<typeof setTimeout> | undefined;
    let t2: ReturnType<typeof setTimeout> | undefined;

    const cancel = (): void => {
      if (raf1 !== undefined) cancelAnimationFrame(raf1);
      if (raf2 !== undefined) cancelAnimationFrame(raf2);
      if (t1 !== undefined) clearTimeout(t1);
      if (t2 !== undefined) clearTimeout(t2);
      raf1 = raf2 = t1 = t2 = undefined;
    };

    signal?.addEventListener('abort', cancel, { once: true });
    const isAborted = (): boolean => !!signal?.aborted;

    raf1 = requestAnimationFrame(() => {
      if (isAborted()) return;
      callbacks.updateEndpoints();
      raf2 = requestAnimationFrame(() => {
        if (isAborted()) return;
        callbacks.updateEndpoints();
        callbacks.resetCanvas?.();
        t1 = setTimeout(() => {
          if (isAborted()) return;
          callbacks.updateEndpoints();
          callbacks.fitView?.();
          t2 = setTimeout(() => {
            if (!isAborted()) callbacks.redrawCanvas?.();
          }, 80);
        }, 80);
      });
    });

    return cancel;
  }

  /**
   * Procesa la mutación completa por IA: valida nodos, precalcula anclas y sanitiza conexiones.
   */
  processAiMutation(params: {
    targetNodes: AiRawNode[];
    targetConns: AiRawConnection[];
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

  normalizeDataType(type: string): string {
    if (!type) return 'String';
    const found = PREDEFINED_DATA_TYPES.find((t) => t.toLowerCase() === type.trim().toLowerCase());
    return found || 'String';
  }

  normalizeReturnType(type: string): string {
    if (!type) return 'void';
    const found = PREDEFINED_RETURN_TYPES.find(
      (rt) => rt.toLowerCase() === type.trim().toLowerCase(),
    );
    return found || 'void';
  }

  public normalizeUmlMessage(m: any, defaultSeq = '1'): UmlMessage {
    let seq = String(m.sequenceNumber || '').trim();
    let fn = String(m.functionName || '').trim();
    let params = String(m.parameters ?? '').trim();
    let returnType = m.returnType ? String(m.returnType).trim() : undefined;
    const rawText = String(m.name || m.text || m.label || '').trim();

    // 1. Limpiar fn si contiene números de secuencia, tipo de retorno o parámetros entre paréntesis
    if (fn) {
      // 1a. ¿Prefijo de secuencia? Ej: "1.1 register(data)" o "1: login(user)" o "1 - test"
      const fnSeqMatch = fn.match(/^(\d+(?:\.\d+)*)\s*[:.\s-]\s*(.*)$/);
      if (fnSeqMatch) {
        if (!seq) seq = fnSeqMatch[1];
        fn = fnSeqMatch[2].trim();
      } else if (/^\d+(\.\d+)*$/.test(fn)) {
        if (!seq) seq = fn;
        fn = '';
      }

      // 1b. ¿Tipo de retorno al final? Ej: "getUser(id): User"
      const fnRetMatch = fn.match(/^(.*?)\s*:\s*([a-zA-Z0-9_\[\]<>]+)$/);
      if (fnRetMatch) {
        fn = fnRetMatch[1].trim();
        if (!returnType) returnType = fnRetMatch[2].trim();
      }

      // 1c. ¿Paréntesis con parámetros? Ej: "register(data)" o "logout()"
      const fnParenMatch = fn.match(/^(.*?)\((.*?)\)$/);
      if (fnParenMatch) {
        fn = fnParenMatch[1].trim();
        if (!params && fnParenMatch[2] !== undefined) {
          params = fnParenMatch[2].trim();
        }
      }

      fn = fn.replace(/\(\)/g, '').trim();
      fn = fn.replace(/^(\d+(?:\.\d+)*)\s*[:.\s-]\s*/, '').trim();
    }

    // 2. Si fn quedó vacío o es el placeholder por defecto ('msj', 'mensaje'), intentar extraer de rawText
    if ((!fn || fn.toLowerCase() === 'msj' || fn.toLowerCase() === 'mensaje') && rawText) {
      let candidate = rawText;

      const rawSeqMatch = candidate.match(/^(\d+(?:\.\d+)*)\s*[:.\s-]\s*(.*)$/);
      if (rawSeqMatch) {
        if (!seq) seq = rawSeqMatch[1];
        candidate = rawSeqMatch[2].trim();
      } else if (/^\d+(\.\d+)*$/.test(candidate)) {
        if (!seq) seq = candidate;
        candidate = '';
      }

      const rawRetMatch = candidate.match(/^(.*?)\s*:\s*([a-zA-Z0-9_\[\]<>]+)$/);
      if (rawRetMatch) {
        candidate = rawRetMatch[1].trim();
        if (!returnType) returnType = rawRetMatch[2].trim();
      }

      const rawParenMatch = candidate.match(/^(.*?)\((.*?)\)$/);
      if (rawParenMatch) {
        candidate = rawParenMatch[1].trim();
        if (!params && rawParenMatch[2] !== undefined) {
          params = rawParenMatch[2].trim();
        }
      }

      candidate = candidate.replace(/\(\)/g, '').trim();
      candidate = candidate.replace(/^(\d+(?:\.\d+)*)\s*[:.\s-]\s*/, '').trim();

      if (candidate && candidate.toLowerCase() !== 'msj' && candidate.toLowerCase() !== 'mensaje') {
        fn = candidate;
      }
    }

    // 3. Fallback final para fn
    if (!fn || fn.toLowerCase() === 'msj' || fn.toLowerCase() === 'mensaje') {
      const fallbackName =
        m.name && m.name !== 'msj' && m.name !== 'mensaje()' && m.name !== 'mensaje'
          ? m.name
              .replace(/\(\)/g, '')
              .replace(/^(\d+(?:\.\d+)*)\s*[:.\s-]\s*/, '')
              .trim()
          : '';
      fn = fallbackName || 'msj';
    }

    // 4. Limpieza de parámetros
    if (params) {
      params = params.trim();
      if (params.startsWith('(') && params.endsWith(')')) {
        params = params.slice(1, -1).trim();
      }
    }

    if (!seq) seq = defaultSeq;

    const isReturn = m.type === 'reply' || !!m.isReturn;
    // En comunicación, direction es relativo al enlace; reply no implica invertir
    // un conector de secuencia que ya tiene los extremos dirigidos.
    const direction =
      m.direction === 'forward' || m.direction === 'reverse'
        ? m.direction
        : isReturn
          ? 'reverse'
          : 'forward';

    return {
      id: m.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sequenceNumber: seq,
      functionName: fn,
      parameters: params,
      returnType,
      direction,
      type: isReturn ? 'reply' : (m.type as UmlMessageType) || 'sync',
      isReturn,
      orderIndex:
        typeof m.orderIndex === 'number' && Number.isFinite(m.orderIndex)
          ? m.orderIndex
          : undefined,
      positionY:
        typeof m.positionY === 'number' && Number.isFinite(m.positionY) ? m.positionY : undefined,
      color: m.color || undefined,
    };
  }

  applyAiNodesMutation(
    targetNodes: AiRawNode[],
    getDefaultColor: (nodeType?: string | null, stereotype?: string | null) => string,
  ): UmlClassNode[] {
    return targetNodes.map((n, i) => {
      let nodeType: UmlNodeType | string = n.nodeType || 'class';
      if (
        /^cu[-_ \d]/i.test(n.name || '') ||
        (typeof n.name === 'string' && /caso\s+de\s+uso/i.test(n.name))
      ) {
        nodeType = 'use_case';
      } else if (
        nodeType === 'boundary_box' ||
        n.id?.startsWith('boundary_box_') ||
        n.id?.startsWith('bbox_')
      ) {
        nodeType = 'boundary_box';
      } else if (
        nodeType === 'class' ||
        (nodeType === 'package' && (n.id?.startsWith('uc_') || n.id?.startsWith('use_case_')))
      ) {
        if (n.id?.startsWith('actor_')) nodeType = 'actor';
        else if (n.id?.startsWith('use_case_') || n.id?.startsWith('uc_')) nodeType = 'use_case';
        else if (n.id?.startsWith('package_') || n.id?.startsWith('pkg_')) nodeType = 'package';
        else if (n.id?.startsWith('boundary_box_') || n.id?.startsWith('bbox_'))
          nodeType = 'boundary_box';
        else if (n.id?.startsWith('boundary_')) nodeType = 'boundary';
        else if (n.id?.startsWith('control_')) nodeType = 'control';
        else if (n.id?.startsWith('entity_')) nodeType = 'entity';
        else if (n.id?.startsWith('lifeline_')) nodeType = 'lifeline';
        else if (n.id?.startsWith('comp_') || n.id?.startsWith('component_'))
          nodeType = 'component';
        else if (n.id?.startsWith('dev_') || n.id?.startsWith('device_')) nodeType = 'device';
        else if (n.id?.startsWith('exec_') || n.id?.startsWith('executionEnvironment_'))
          nodeType = 'executionEnvironment';
      }
      const isExplicitSizeNode = this.astNormalizer.isExplicitSizeNodeType(nodeType);
      const isManuallyResized =
        !!n.isCustomSize ||
        (!!n.customHeight && n.customHeight > 0) ||
        isExplicitSizeNode ||
        (!!(n.height && n.height > 0) && nodeType === 'class');
      let defaultWidth = 220;
      let defaultHeight: number | undefined = undefined;
      if (nodeType === 'actor') {
        defaultWidth = 65;
        defaultHeight = 95;
      } else if (nodeType === 'use_case') {
        defaultWidth = 150;
        defaultHeight = 65;
      } else if (nodeType === 'package') {
        defaultWidth = 200;
        defaultHeight = 120;
      } else if (nodeType === 'component') {
        defaultWidth = 190;
        defaultHeight = 70;
      } else if (nodeType === 'node' || nodeType === 'device') {
        defaultWidth = 230;
        defaultHeight = 140;
      } else if (nodeType === 'executionEnvironment') {
        defaultWidth = 240;
        defaultHeight = 160;
      } else if (nodeType === 'boundary_box') {
        defaultWidth = 280;
        defaultHeight = 200;
      } else if (['boundary', 'control', 'entity'].includes(nodeType)) {
        defaultWidth = 70;
        defaultHeight = 70;
      } else if (nodeType === 'lifeline') {
        defaultWidth = 120;
        defaultHeight = 60;
      }

      const isBce = ['boundary', 'control', 'entity'].includes(nodeType);
      const resolvedW = n.isAnchor ? 0 : isBce ? 70 : n.width || defaultWidth;
      const resolvedH = n.isAnchor
        ? 0
        : nodeType === 'lifeline'
          ? 60
          : isBce
            ? 70
            : n.height || defaultHeight;

      return {
        id: n.id || `class_ai_${Date.now()}_${i}`,
        name:
          n.name ||
          (n.isAnchor ? '' : nodeType === 'boundary_box' ? 'BoundaryBox' : `Clase_${i + 1}`),
        position: this.astNormalizer.resolveNodePosition(n, {
          x: 100 + (i % 3) * 260,
          y: 100 + Math.floor(i / 3) * 220,
        }),
        width: resolvedW,
        height: resolvedH,
        customWidth: n.customWidth || (isExplicitSizeNode ? resolvedW : undefined),
        customHeight: n.customHeight || (isExplicitSizeNode ? resolvedH : undefined),
        isCustomSize: isManuallyResized,
        color:
          !n.color ||
          ((n.color === '#FFFDDD' || n.color === '#FDFAF3') &&
            [
              'device',
              'executionEnvironment',
              'component',
              'node',
              'boundary_box',
              'boundary',
              'control',
              'entity',
              'lifeline',
              'actor',
              'use_case',
              'package',
            ].includes(nodeType))
            ? getDefaultColor(nodeType, n.stereotype)
            : n.color,
        nodeType,
        stereotype: n.stereotype || null,
        activations: n.activations || [],
        labelOffset: n.labelOffset,
        isAnchor: !!n.isAnchor,
        assocMainConnId: n.assocMainConnId,
        attributes: (n.attributes || []).map((a) => ({
          ...a,
          name: a.name,
          type: this.normalizeDataType(a.type),
          nullable: a.nullable !== undefined ? a.nullable : true,
          unique: a.unique !== undefined ? a.unique : false,
          length: a.length !== undefined ? a.length : 255,
          defaultValue: a.defaultValue ?? a.default ?? null,
        })),
        methods: (n.methods || []).map((m) => ({
          name: m.name,
          parameters: m.parameters || '',
          returnType: this.normalizeReturnType(m.returnType),
        })),
      };
    });
  }

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
      this.astNormalizer.extractBaseNodeId(rawId, { stripSlot: true });

    const isSeqDiagram = activeDiagramType === DiagramType.SEQUENCE;
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
        (c.sourceId && c.sourceId.includes('_slot_')) ||
        (c.targetId && c.targetId.includes('_slot_'));

      if (isSeqConn) {
        // EN DIAGRAMAS DE SECUENCIA: CADA MENSAJE DEBE SER SU PROPIA CONEXIÓN
        const rawMsgs =
          c.messages && c.messages.length > 0
            ? c.messages
            : c.name
              ? [{ name: c.name, type: c.type }]
              : [{ functionName: 'msj', type: c.type || 'sync' }];

        rawMsgs.forEach((m: any, mIdx: number) => {
          const norm = this.normalizeUmlMessage(m, `${seqConns.length + 1}`);
          const isMsgReverse = norm.direction === 'reverse';

          let effectiveSource = s;
          let effectiveTarget = t;
          if (isMsgReverse && !['reply'].includes(c.type) && !c.isReturn && mIdx > 0) {
            effectiveSource = t;
            effectiveTarget = s;
          }

          norm.direction = 'forward';
          seqConns.push({
            ...c,
            id:
              rawMsgs.length === 1 && c.id
                ? c.id
                : `msg_${Date.now()}_${seqConns.length}_${Math.random().toString(36).substring(2, 5)}`,
            sourceNodeId: effectiveSource,
            targetNodeId: effectiveTarget,
            type: norm.type || (isMsgReverse ? 'reply' : 'sync'),
            lineStyle: 'straight',
            sourceMultiplicity: '',
            targetMultiplicity: '',
            messages: [norm],
          });
        });
      } else if (isCommDiagram) {
        // EN DIAGRAMAS DE COMUNICACIÓN: Una sola línea de asociación entre cada par de objetos
        const pairKey = [s, t].sort().join('___');
        const rawMsgs =
          c.messages && c.messages.length > 0 ? c.messages : c.name ? [{ name: c.name }] : [];

        if (commMergedMap.has(pairKey)) {
          const existing = commMergedMap.get(pairKey);
          const isReversedPair =
            (existing.sourceNodeId || extractBaseNodeId(existing.sourceId)) !== s;

          const normalizedNewMsgs = rawMsgs.map((m: any, mIdx: number) => {
            const norm = this.normalizeUmlMessage(
              m,
              `${(existing.messages || []).length + mIdx + 1}`,
            );
            if (isReversedPair) {
              norm.direction = norm.direction === 'reverse' ? 'forward' : 'reverse';
            }
            return norm;
          });

          existing.messages = existing.messages || [];
          for (const nm of normalizedNewMsgs) {
            const exists = existing.messages.some(
              (em: any) =>
                em.sequenceNumber === nm.sequenceNumber && em.functionName === nm.functionName,
            );
            if (!exists) {
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
        // OTROS DIAGRAMAS
        otherConns.push({
          ...c,
          sourceNodeId: s,
          targetNodeId: t,
        });
      }
    }

    // 2. Asignar slots únicos y ordenados para diagramas de secuencia
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
        while (usedSlots.has(nextFreeSlot)) {
          nextFreeSlot++;
        }
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

    // 3. Procesar conexiones de comunicación
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
          const na = pa[k] || 0;
          const nb = pb[k] || 0;
          if (na !== nb) return na - nb;
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
        lineStyle: (c.lineStyle as UmlLineStyle) || 'straight',
        name: sortedMessages.length > 0 ? undefined : c.name || undefined,
        sourceMultiplicity: '',
        targetMultiplicity: '',
        assocAnchorNodeId: undefined,
        messages: sortedMessages.length > 0 ? sortedMessages : undefined,
      };
    });

    // 4. Procesar otros diagramas
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
          if (sourceNode.isAnchor) {
            const optimal = this.connectionLayoutService.getOptimalConnectorId(
              sourceNode,
              targetNode,
            );
            sourceId = sourceNode.id;
            targetId = optimal.targetId;
          } else if (targetNode.isAnchor) {
            const optimal = this.connectionLayoutService.getOptimalConnectorId(
              sourceNode,
              targetNode,
            );
            sourceId = optimal.sourceId;
            targetId = targetNode.id;
          } else {
            const optimal = this.connectionLayoutService.getOptimalConnectorId(
              sourceNode,
              targetNode,
            );
            sourceId = optimal.sourceId;
            targetId = optimal.targetId;
          }
        } else if (!sourceNode.isAnchor && !targetNode.isAnchor) {
          const optimal = this.connectionLayoutService.getOptimalConnectorId(
            sourceNode,
            targetNode,
          );
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
        lineStyle: (c.lineStyle as UmlLineStyle) || defaultLineStyle,
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
