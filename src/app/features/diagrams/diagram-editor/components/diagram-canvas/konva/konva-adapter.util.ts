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
  if (nt === 'component') return 'component';
  if (nt === 'package') return 'package';
  if (nt === 'package_layer' || nt === 'boundary_box') return 'package_layer';
  if (nt === 'note') return 'note';
  if (nt === 'activity_initial') return 'activity_initial';
  if (nt === 'activity_final') return 'activity_final';
  if (nt === 'activity_action') return 'activity_action';
  if (nt === 'activity_decision') return 'activity_decision';
  if (nt === 'activity_fork') return 'activity_fork';
  if (nt === 'device' || nt === 'executionenvironment' || nt === 'deployment_node' || nt === 'node') {
    return 'deployment_node';
  }
  return 'class';
}

function mapLineStyleToKonva(lineStyle?: string | null): any {
  if (!lineStyle) return 'direct';
  const ls = lineStyle.toLowerCase();
  if (ls === 'straight') return 'direct';
  if (ls === 'segment') return 'orthogonal_square';
  if (ls === 'adaptive-curve') return 'orthogonal_rounded';
  return ls;
}

/**
 * Mapea el tipo de relación canónica a los tipos soportados por el renderer de Konva.
 */
function mapRelationshipTypeToKonva(type?: UmlRelationshipType | string | null): UmlRelationType {
  const t = (type || 'association').toLowerCase();
  if (t === 'association_class') return 'association_class';
  if (t === 'generalization' || t === 'inheritance') return 'generalization';
  if (t === 'composition') return 'composition';
  if (t === 'aggregation') return 'aggregation';
  if (t === 'dependency' || t === 'include' || t === 'extend' || t === 'realization') return 'dependency';
  if (t === 'trace') return 'trace';
  if (t === 'sync' || t === 'sync_message' || t === 'message' || t === 'async' || t === 'create' || t === 'self') return 'sync_message';
  if (t === 'reply' || t === 'return_message') return 'return_message';
  if (t === 'assembly') return 'assembly';
  if (t === 'control_flow') return 'control_flow';
  if (t === 'note_anchor') return 'note_anchor';
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
  const kType = mapNodeTypeToKonva(node.nodeType);
  const isSequenceDiag = activeDiagramType === DiagramType.SEQUENCE || kType === 'lifeline';

  if (isSequenceDiag) {
    const isActorLifeline = node.nodeType === 'actor' || (node.stereotype || '').toLowerCase().includes('actor');
    const width = isActorLifeline ? 120 : Math.max(130, node.width || node.customWidth || getNodeWidth(node) || 150);

    const y = node.position ? node.position.y : 30;

    // Calcular la posición Y más baja de todos los mensajes de secuencia
    let maxMsgY = 220;
    if (connections && connections.length > 0) {
      for (const c of connections) {
        const sMatch = c.sourceId?.match(/_slot_(\d+)$/);
        const tMatch = c.targetId?.match(/_slot_(\d+)$/);
        const slot = sMatch ? parseInt(sMatch[1], 10) : tMatch ? parseInt(tMatch[1], 10) : 0;
        const msgY = c.messages?.[0]?.positionY ?? (160 + slot * 50);
        if (msgY > maxMsgY) {
          maxMsgY = msgY;
        }
      }
    }

    const requiredStemHeight = Math.max(490, (maxMsgY - y) + 110);
    const computedServiceHeight = sequenceActivationService && connections
      ? sequenceActivationService.getLifelineLength(node, connections)
      : 0;

    const height = Math.max(
      node.height || 0,
      node.customHeight || 0,
      computedServiceHeight,
      requiredStemHeight
    );

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

  // Dimensiones según el tipo específico de nodo UML
  let defaultW = 160;
  let defaultH = 90;

  switch (kType) {
    case 'component':
      defaultW = 190;
      defaultH = 75;
      break;
    case 'package':
      defaultW = 200;
      defaultH = 120;
      break;
    case 'package_layer':
      defaultW = 420;
      defaultH = 200;
      break;
    case 'note':
      defaultW = 185;
      defaultH = 76;
      break;
    case 'actor':
      defaultW = 65;
      defaultH = 95;
      break;
    case 'use_case':
      defaultW = 140;
      defaultH = 60;
      break;
    case 'boundary':
    case 'control':
    case 'entity':
      defaultW = 70;
      defaultH = 70;
      break;
    case 'deployment_node':
      defaultW = 220;
      defaultH = 140;
      break;
    case 'activity_initial':
    case 'activity_final':
      defaultW = 44;
      defaultH = 48;
      break;
    case 'activity_action':
      defaultW = 155;
      defaultH = 62;
      break;
    case 'activity_decision':
      defaultW = 65;
      defaultH = 65;
      break;
    case 'activity_fork':
      defaultW = 220;
      defaultH = 14;
      break;
    default:
      defaultW = 195;
      defaultH = 90;
      break;
  }

  const isCustomW = !!node.isCustomSize && ((!!node.customWidth && node.customWidth > 0) || (!!node.width && node.width > 0));
  const isCustomH = !!node.isCustomSize && ((!!node.customHeight && node.customHeight > 0) || (!!node.height && node.height > 0));
  const customW = node.customWidth || node.width;
  const customH = node.customHeight || node.height;
  const width = Math.max(36, (isCustomW ? customW! : 0) || getNodeWidth(node) || defaultW);
  const height = Math.max(14, (isCustomH ? customH! : 0) || getNodeHeight(node) || defaultH);

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

  // La clase asociativa no debe tener estereotipo visible según la especificación del usuario
  const isAssocStereotype =
    (node.stereotype || '').toLowerCase() === 'associationclass' ||
    (node.stereotype || '').toLowerCase() === '«associationclass»';
  const stereotype = isAssocStereotype ? undefined : (node.stereotype || undefined);

  return {
    id: node.id,
    type: kType,
    name: node.name || 'Elemento',
    stereotype,
    x: node.position ? node.position.x : 100,
    y: node.position ? node.position.y : 100,
    width,
    height,
    fill: node.color || undefined,
    stroke: undefined,
    attributes,
    methods,
    isCustomSize: node.isCustomSize,
    customWidth: node.customWidth || (node.isCustomSize ? node.width : undefined),
    customHeight: node.customHeight || (node.isCustomSize ? node.height : undefined),
    isActorLifeline: node.nodeType === 'actor',
  };
}

/**
 * Convierte un UmlConnection canónico en un UmlRelationship para Konva.
 */
export function toKonvaRelationship(
  conn: UmlConnection,
  activeDiagramType?: DiagramType,
  allNodes?: UmlClassNode[],
  allConnections?: UmlConnection[],
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

  let assocClassNodeId = conn.associationClassNodeId;

  // Heurística 1: Buscar nodo en allNodes que declare assocMainConnId === conn.id
  if (!assocClassNodeId && allNodes) {
    const assocNode = allNodes.find((n) => n.assocMainConnId === conn.id && !n.isAnchor);
    if (assocNode) {
      assocClassNodeId = assocNode.id;
    }
  }

  // Heurística 2: Si conn tiene assocAnchorNodeId, buscar la conexión discontinua que apunta a la clase
  if (!assocClassNodeId && conn.assocAnchorNodeId && allConnections) {
    const dashed = allConnections.find((c) => {
      const srcBase = c.sourceNodeId || c.sourceId?.replace(/_(top|right|bottom|left|slot_\d+)$/, '');
      return srcBase === conn.assocAnchorNodeId;
    });
    if (dashed) {
      const tgtBase = dashed.targetNodeId || dashed.targetId?.replace(/_(top|right|bottom|left|slot_\d+)$/, '');
      if (tgtBase && !allNodes?.some((n) => n.id === tgtBase && n.isAnchor)) {
        assocClassNodeId = tgtBase;
      }
    }
  }

  // Heurística 3: Si conn.assocAnchorNodeId apunta directamente a un nodo no ancla
  if (!assocClassNodeId && conn.assocAnchorNodeId && allNodes) {
    const byAnchor = allNodes.find((n) => n.id === conn.assocAnchorNodeId && !n.isAnchor);
    if (byAnchor) {
      assocClassNodeId = byAnchor.id;
    }
  }

  // Heurística 4: Buscar nodo asociativo por coincidencia de nombre Source_Target o Target_Source
  if (!assocClassNodeId && allNodes) {
    const srcNode = allNodes.find((n) => n.id === sourceId);
    const tgtNode = allNodes.find((n) => n.id === targetId);
    if (srcNode && tgtNode) {
      const match = allNodes.find((n) => {
        if (n.isAnchor) return false;
        const isStereo =
          n.stereotype === 'associationClass' ||
          (n.stereotype || '').toLowerCase().includes('associationclass');
        const isNameMatch =
          n.name === `${srcNode.name}_${tgtNode.name}` ||
          n.name === `${tgtNode.name}_${srcNode.name}`;
        return isStereo || isNameMatch;
      });
      if (match) {
        assocClassNodeId = match.id;
      }
    }
  }

  if (!assocClassNodeId && connAny.assocNodeId) {
    assocClassNodeId = connAny.assocNodeId;
  }

  const isAssocRel = !!assocClassNodeId || conn.type === 'association_class';
  const relType = isAssocRel ? 'association_class' : mapRelationshipTypeToKonva(conn.type);
  const lineStyle = mapLineStyleToKonva(conn.lineStyle);

  return {
    id: conn.id,
    type: relType,
    sourceId,
    targetId,
    associationClassNodeId: assocClassNodeId,
    lineStyle,
    waypoints: conn.waypoints,
    name: conn.name,
    stereotype: connAny.stereotype || (['include', 'extend', 'trace', 'assembly'].includes(conn.type) ? `«${conn.type}»` : undefined),
    sourceMultiplicity: conn.sourceMultiplicity,
    targetMultiplicity: conn.targetMultiplicity,
    messages: messages.length > 0 ? messages : undefined,
  };
}
