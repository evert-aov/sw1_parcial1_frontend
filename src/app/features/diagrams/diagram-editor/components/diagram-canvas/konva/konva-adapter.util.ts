import {
  UmlClassNode,
  UmlConnection,
  UmlRelationshipType,
  DiagramType,
  UmlAttribute,
  UmlMethod,
  UmlMessage,
} from '../../../../../../core/models/diagram.model';
import {
  UmlNode,
  UmlNodeType,
  UmlRelationship,
  UmlRelationType,
  UmlClassAttribute,
  UmlClassMethod,
  UmlMessageItem,
  ActivationBox,
} from './models/uml.model';
import { getNodeWidth, getNodeHeight } from '../../../utils/node-metrics.util';
import { DiagramSequenceActivationService } from '../../../services/diagram-sequence-activation.service';

/**
 * Paleta de colores para grupos de mensajes de secuencia (1.x, 2.x, etc.)
 */
export function getSequenceGroupColor(seqNum?: string | null): string {
  const match = (seqNum || '').trim().match(/^(\d+)(?:\.|$)/);
  if (match) {
    const g = parseInt(match[1], 10);
    const palette = ['#1F2937', '#991B1B', '#166534', '#1E40AF', '#7C3AED', '#D97706'];
    return palette[(Math.max(1, g) - 1) % palette.length];
  }
  return '#1F2937';
}

/**
 * Normaliza la visibilidad de UML canónico a los 4 caracteres estándar: '-', '+', '#', '~'.
 */
function normalizeVisibility(vis?: string | null): '-' | '+' | '#' | '~' {
  if (!vis) return '+';
  if (vis === 'private' || vis === '-') return '-';
  if (vis === 'public' || vis === '+') return '+';
  if (vis === 'protected' || vis === '#') return '#';
  if (vis === 'package' || vis === '~') return '~';
  return '+';
}

/**
 * Mapea el tipo de nodo del sistema canónico a los tipos soportados por el renderer de Konva.
 */
function mapNodeTypeToKonva(nodeType?: string | null): UmlNodeType {
  const nt = (nodeType || 'class').toLowerCase();
  if (nt === 'actor') return 'actor';
  if (nt === 'use_case' || nt === 'usecase') return 'use_case';
  if (nt === 'boundary') return 'boundary';
  if (nt === 'control') return 'control';
  if (nt === 'entity') return 'entity';
  if (nt === 'lifeline') return 'lifeline';
  if (nt === 'device' || nt === 'executionenvironment' || nt === 'deployment_node' || nt === 'node') {
    return 'deployment_node';
  }
  return 'class';
}

/**
 * Mapea el tipo de relación canónica a los tipos soportados por el renderer de Konva.
 */
function mapRelationshipTypeToKonva(type?: UmlRelationshipType | string | null): UmlRelationType {
  const t = (type || 'association').toLowerCase();
  if (t === 'generalization' || t === 'inheritance') return 'generalization';
  if (t === 'composition') return 'composition';
  if (t === 'aggregation') return 'aggregation';
  if (t === 'dependency' || t === 'include' || t === 'extend' || t === 'realization') return 'dependency';
  if (t === 'trace') return 'trace';
  if (t === 'sync' || t === 'sync_message' || t === 'message' || t === 'async' || t === 'create' || t === 'self') return 'sync_message';
  if (t === 'reply' || t === 'return_message') return 'return_message';
  return 'association';
}

/**
 * Convierte un UmlClassNode canónico en un UmlNode para Konva.
 */
export function toKonvaNode(
  node: UmlClassNode,
  activeDiagramType?: DiagramType,
  connections?: UmlConnection[],
  sequenceActivationService?: DiagramSequenceActivationService,
): UmlNode {
  const isSequenceDiag = activeDiagramType === DiagramType.SEQUENCE || node.nodeType === 'lifeline';

  if (isSequenceDiag) {
    const isActorLifeline = node.nodeType === 'actor' || (node.stereotype || '').toLowerCase().includes('actor');
    const width = isActorLifeline ? 120 : Math.max(130, node.width || node.customWidth || getNodeWidth(node) || 150);

    let lifelineHeight = node.height || node.customHeight;
    if (!lifelineHeight && sequenceActivationService && connections) {
      lifelineHeight = sequenceActivationService.getLifelineLength(node, connections);
    }
    const height = Math.max(420, lifelineHeight || 490);

    let activations: ActivationBox[] | undefined = undefined;
    if (sequenceActivationService && connections) {
      const rawActs = sequenceActivationService.getNodeActivations(node, connections, activeDiagramType);
      if (rawActs.length > 0) {
        activations = rawActs.map((a) => ({
          id: a.id,
          startY: a.top,
          height: a.height,
        }));
      }
    } else if (node.activations && node.activations.length > 0) {
      activations = node.activations.map((a: any, i: number) => ({
        id: a.id || `act_${i}`,
        startY: a.top ?? a.startY ?? 110,
        height: a.height ?? 60,
      }));
    }

    const y = node.position ? node.position.y : 30;

    return {
      id: node.id,
      type: 'lifeline',
      name: node.name || (isActorLifeline ? 'Ingeniero Anfitrión' : 'Participante'),
      stereotype: node.stereotype || undefined,
      x: node.position ? node.position.x : 50,
      y,
      width,
      height,
      fill: node.color || (isActorLifeline ? undefined : '#E0F2F1'),
      stroke: undefined,
      attributes: [],
      methods: [],
      isActorLifeline,
      activations,
    };
  }

  const width = Math.max(90, node.width || node.customWidth || getNodeWidth(node) || 160);
  const height = Math.max(50, node.height || node.customHeight || getNodeHeight(node) || 90);

  const attributes: UmlClassAttribute[] = (node.attributes || []).map((a: UmlAttribute, i: number) => ({
    id: `attr_${i}`,
    name: a.name || '',
    type: a.type || 'String',
    visibility: normalizeVisibility(a.visibility),
  }));

  const methods: UmlClassMethod[] = (node.methods || []).map((m: UmlMethod, i: number) => ({
    id: `m_${i}`,
    name: m.name || '',
    params: m.parameters || '',
    returnType: m.returnType || 'void',
    visibility: normalizeVisibility(m.visibility),
  }));

  return {
    id: node.id,
    type: mapNodeTypeToKonva(node.nodeType),
    name: node.name || 'Clase',
    stereotype: node.stereotype || undefined,
    x: node.position ? node.position.x : 100,
    y: node.position ? node.position.y : 100,
    width,
    height,
    fill: node.color || undefined,
    stroke: undefined,
    attributes,
    methods,
    isActorLifeline: node.nodeType === 'actor',
  };
}

/**
 * Convierte un UmlConnection canónico en un UmlRelationship para Konva.
 */
export function toKonvaRelationship(
  conn: UmlConnection,
  activeDiagramType?: DiagramType,
): UmlRelationship {
  const sourceId = conn.sourceNodeId || conn.sourceId.replace(/_(top|right|bottom|left|slot_\d+)$/, '');
  const targetId = conn.targetNodeId || conn.targetId.replace(/_(top|right|bottom|left|slot_\d+)$/, '');

  const isSequenceDiag = activeDiagramType === DiagramType.SEQUENCE;
  const isSeqConnType = ['sync', 'reply', 'async', 'create', 'self', 'sync_message', 'return_message'].includes(conn.type as string);
  const isSeq = isSequenceDiag || isSeqConnType;

  if (isSeq) {
    const isReply = conn.type === 'reply' || (conn.type as string) === 'return_message' ||
      (!!conn.messages && conn.messages.some((m) => m.isReturn || m.type === 'reply'));
    const relType: UmlRelationType = isReply ? 'return_message' : 'sync_message';

    const sMatch = conn.sourceId?.match(/_slot_(\d+)$/);
    const tMatch = conn.targetId?.match(/_slot_(\d+)$/);
    const slot = sMatch ? parseInt(sMatch[1], 10) : tMatch ? parseInt(tMatch[1], 10) : 0;
    const yOffset = conn.messages?.[0]?.positionY ?? (160 + slot * 50);

    let msgLabel = '';
    let messageColor: string | undefined = undefined;

    if (conn.messages && conn.messages.length > 0) {
      const msg = conn.messages[0];
      const seqNum = msg.sequenceNumber ? `${msg.sequenceNumber}: ` : '';
      const fn = (msg.functionName || (msg as any).name || conn.name || 'msj').trim();
      if (msg.sequenceNumber && (fn.startsWith(`${msg.sequenceNumber}:`) || fn.startsWith(`${msg.sequenceNumber} `))) {
        msgLabel = fn;
      } else {
        const pStr = msg.parameters !== undefined && msg.parameters !== null && msg.parameters !== ''
          ? `(${msg.parameters})`
          : (fn.includes('(') ? '' : '()');
        msgLabel = `${seqNum}${fn}${pStr}`;
      }
      messageColor = msg.color || getSequenceGroupColor(msg.sequenceNumber);
    } else if (conn.name) {
      msgLabel = conn.name;
      messageColor = getSequenceGroupColor(conn.name);
    } else {
      msgLabel = isReply ? '1: return' : '1: call()';
      messageColor = '#1F2937';
    }

    return {
      id: conn.id,
      type: relType,
      sourceId,
      targetId,
      name: msgLabel,
      messageColor,
      yOffset,
    };
  }

  const messages: UmlMessageItem[] = (conn.messages || []).map((msg: UmlMessage, i: number) => ({
    id: msg.id || `msg_${i}`,
    sequenceNumber: msg.sequenceNumber || `${i + 1}`,
    name: msg.functionName || (msg as any).name || '',
    direction: (msg.direction as 'forward' | 'backward') || 'forward',
    color: msg.color || getSequenceGroupColor(msg.sequenceNumber),
  }));

  const connAny = conn as any;

  return {
    id: conn.id,
    type: mapRelationshipTypeToKonva(conn.type),
    sourceId,
    targetId,
    name: conn.name,
    stereotype: connAny.stereotype || undefined,
    sourceMultiplicity: conn.sourceMultiplicity,
    targetMultiplicity: conn.targetMultiplicity,
    messages: messages.length > 0 ? messages : undefined,
  };
}
