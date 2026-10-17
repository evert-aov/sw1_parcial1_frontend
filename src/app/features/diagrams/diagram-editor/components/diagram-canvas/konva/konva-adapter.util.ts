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
} from './models/uml.model';
import { getNodeWidth, getNodeHeight } from '../../../utils/node-metrics.util';

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
  if (t === 'sync_message' || t === 'message') return 'sync_message';
  if (t === 'return_message') return 'return_message';
  return 'association';
}

/**
 * Convierte un UmlClassNode canónico en un UmlNode para Konva.
 */
export function toKonvaNode(node: UmlClassNode): UmlNode {
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
export function toKonvaRelationship(conn: UmlConnection): UmlRelationship {
  const sourceId = conn.sourceNodeId || conn.sourceId.replace(/_(top|right|bottom|left)$/, '');
  const targetId = conn.targetNodeId || conn.targetId.replace(/_(top|right|bottom|left)$/, '');

  const messages: UmlMessageItem[] = (conn.messages || []).map((msg: UmlMessage, i: number) => ({
    id: msg.id || `msg_${i}`,
    sequenceNumber: msg.sequenceNumber || `${i + 1}`,
    name: msg.functionName || (msg as any).name || '',
    direction: (msg.direction as 'forward' | 'backward') || 'forward',
    color: msg.color,
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
    yOffset: connAny.sequenceOrder ? 160 + connAny.sequenceOrder * 50 : undefined,
    messages: messages.length > 0 ? messages : undefined,
  };
}
