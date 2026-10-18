import { Injectable } from '@angular/core';
import {
  DiagramDto,
  UmlAttribute,
  UmlClassNode,
  UmlConnection,
  UmlLineStyle,
  UmlMethod,
  UmlNodeType,
  UmlRelationshipType,
} from '../../../../core/models/diagram.model';

/** Nodo tal como llega del servidor (DTO + campos de tamaño personalizado persistidos). */
export type RawServerNode = DiagramDto['nodes'][number] & {
  customWidth?: number | null;
  customHeight?: number | null;
  isCustomSize?: boolean;
};

export type RawServerConnection = DiagramDto['connections'][number];

export interface NormalizeNodesOptions {
  /** Tipo del diagrama (`sequence`, `package`, ...); condiciona el tipo de nodo por defecto. */
  diagramType?: string;
  getDefaultColor?: (nodeType?: string, stereotype?: string | null) => string;
  normalizeDataType?: (type: string) => string;
  normalizeReturnType?: (type: string) => string;
}

export interface ResolveNodeTypeContext {
  isSequence?: boolean;
  /** Si es `true`, un nodo sin tipo explícito en un diagrama de paquetes se resuelve como `package`. */
  isPackageDiagram?: boolean;
}

/** Tipos cuyo tamaño siempre se considera fijado explícitamente (no auto-ajustable). */
export const EXPLICIT_SIZE_NODE_TYPES: readonly string[] = [
  'component',
  'device',
  'node',
  'executionEnvironment',
  'boundary_box',
  'package',
];

/** Prefijos de ID usados para inferir el tipo de nodos persistidos sin `nodeType` fiable. Orden significativo. */
const NODE_TYPE_ID_PREFIXES: ReadonlyArray<readonly [string, UmlNodeType | string]> = [
  ['actor_', 'actor'],
  ['use_case_', 'use_case'],
  ['boundary_box_', 'boundary_box'],
  ['package_', 'package'],
  ['boundary_', 'boundary'],
  ['control_', 'control'],
  ['entity_', 'entity'],
  ['component_', 'component'],
  ['device_', 'device'],
  ['exec_env_', 'executionEnvironment'],
  ['exec_', 'executionEnvironment'],
  ['lifeline_', 'lifeline'],
];

const SIDE_SUFFIX = /_(top|bottom|left|right)$/;
const SLOT_SUFFIX = /_slot_\d+$/;

/**
 * Único responsable de las transformaciones de AST compartidas entre importación, exportación,
 * persistencia y sincronización por IA: normalización de tipos de nodo, posiciones, extremos de
 * conectores y mapeo servidor → modelo local.
 */
@Injectable({
  providedIn: 'root',
})
export class DiagramAstNormalizerService {
  /**
   * Indica si el tipo de nodo tiene tamaño explícito (no auto-ajustable).
   */
  isExplicitSizeNodeType(nodeType: string | null | undefined): boolean {
    return !!nodeType && EXPLICIT_SIZE_NODE_TYPES.includes(nodeType);
  }

  /**
   * Resuelve el tipo canónico de un nodo. Un tipo declarado distinto de `class` se respeta; si es
   * `class` (o falta), se infiere por prefijo de ID y, en su defecto, por el tipo de diagrama.
   */
  resolveNodeType(
    id: string | undefined,
    declaredType: string | null | undefined,
    ctx: ResolveNodeTypeContext = {},
  ): UmlNodeType | string {
    if (declaredType && declaredType !== 'class') return declaredType;

    const nodeId = id ?? '';
    for (const [prefix, type] of NODE_TYPE_ID_PREFIXES) {
      if (nodeId.startsWith(prefix)) return type;
    }
    if (ctx.isSequence) return 'lifeline';
    if (ctx.isPackageDiagram) return 'package';
    return declaredType || 'class';
  }

  /**
   * Elimina el sufijo de lado (`_top|_bottom|_left|_right`) y, opcionalmente, de ranura (`_slot_N`)
   * del identificador de un conector para obtener el ID del nodo base.
   */
  extractBaseNodeId(
    rawId: string | undefined | null,
    options: { stripSlot?: boolean } = {},
  ): string {
    if (!rawId) return '';
    const withoutSide = rawId.replace(SIDE_SUFFIX, '');
    return options.stripSlot ? withoutSide.replace(SLOT_SUFFIX, '') : withoutSide;
  }

  /**
   * Resuelve los IDs de nodo origen/destino de una conexión, priorizando los campos explícitos.
   */
  resolveConnectionNodeIds(
    conn: Pick<UmlConnection, 'sourceNodeId' | 'targetNodeId' | 'sourceId' | 'targetId'>,
  ): { sourceNodeId: string; targetNodeId: string } {
    return {
      sourceNodeId: conn.sourceNodeId || this.extractBaseNodeId(conn.sourceId, { stripSlot: true }),
      targetNodeId: conn.targetNodeId || this.extractBaseNodeId(conn.targetId, { stripSlot: true }),
    };
  }

  /**
   * Normaliza la posición de un nodo crudo, que puede venir como `position` o como `positionX/Y`.
   */
  resolveNodePosition(
    raw: { position?: { x?: number; y?: number }; positionX?: number; positionY?: number },
    fallback: { x: number; y: number },
  ): { x: number; y: number } {
    return {
      x: raw.position?.x ?? raw.positionX ?? fallback.x,
      y: raw.position?.y ?? raw.positionY ?? fallback.y,
    };
  }

  /**
   * Convierte los nodos del servidor al modelo local canónico (`UmlClassNode[]`).
   */
  normalizeNodes(
    raw: RawServerNode[] | undefined | null,
    options: NormalizeNodesOptions = {},
  ): UmlClassNode[] {
    const isSequence = options.diagramType === 'sequence';
    const isPackageDiagram = options.diagramType === 'package';

    return (raw || []).map((n) => {
      const initialType =
        n.nodeType || (isPackageDiagram ? 'package' : isSequence ? 'lifeline' : 'class');
      const nodeType = this.resolveNodeType(n.id, initialType, { isSequence });

      const isBce = nodeType === 'boundary' || nodeType === 'control' || nodeType === 'entity';
      const isLifeline = nodeType === 'lifeline';
      const isExplicitSizeNode = this.isExplicitSizeNodeType(nodeType);
      const hasExplicitDbHeight = !!(n.height && n.height > 0);
      const hasCustomFlag =
        !!n.isCustomSize ||
        (!!n.customHeight && n.customHeight > 0) ||
        (!!n.customWidth && n.customWidth > 0);
      const isManuallyResized =
        hasCustomFlag ||
        isExplicitSizeNode ||
        (hasExplicitDbHeight &&
          (nodeType === 'class' || isBce || nodeType === 'actor' || nodeType === 'use_case'));

      let nodeName = n.name || '';
      if (nodeType === 'boundary_box' && (nodeName === 'ClassName' || !nodeName.trim())) {
        nodeName = '.';
      }

      let nodeColor = n.color;
      if (!nodeColor && options.getDefaultColor) {
        nodeColor = options.getDefaultColor(nodeType, n.stereotype);
      }

      const resolvedWidth = n.width || this.defaultWidthFor(nodeType, isBce, isLifeline);
      const defaultHeight = this.defaultHeightFor(nodeType, isBce, isLifeline);
      const resolvedHeight = isLifeline ? 60 : n.height || defaultHeight;

      return {
        id: n.id,
        name: nodeName,
        position: { x: n.positionX, y: n.positionY },
        width: resolvedWidth,
        height: resolvedHeight,
        customWidth: isManuallyResized ? n.customWidth || resolvedWidth : undefined,
        customHeight: isManuallyResized ? n.customHeight || resolvedHeight : undefined,
        isCustomSize: isManuallyResized,
        color: nodeColor,
        isAnchor: n.isAnchor,
        nodeType,
        stereotype: n.stereotype || null,
        assocMainConnId: n.assocMainConnId || undefined,
        activations: n.activations || [],
        attributes: (n.attributes || []).map((a): UmlAttribute => ({
          name: a.name,
          type: options.normalizeDataType ? options.normalizeDataType(a.type) : a.type,
          orderIndex: a.orderIndex,
          nullable: a.nullable !== undefined ? a.nullable : true,
          unique: a.unique !== undefined ? a.unique : false,
          length: a.length !== undefined ? a.length : 255,
          defaultValue: a.defaultValue ?? a.default ?? null,
          default: a.default ?? a.defaultValue ?? null,
        })),
        methods: (n.methods || []).map((m): UmlMethod => ({
          name: m.name,
          parameters: m.parameters,
          returnType: options.normalizeReturnType
            ? options.normalizeReturnType(m.returnType)
            : m.returnType,
        })),
      };
    });
  }

  /**
   * Convierte las conexiones del servidor al modelo local canónico (`UmlConnection[]`).
   */
  normalizeConnections(
    raw: RawServerConnection[] | undefined | null,
    isSequence = false,
  ): UmlConnection[] {
    return (raw || []).map((c) => ({
      id: c.id,
      sourceNodeId: c.sourceNodeId || undefined,
      targetNodeId: c.targetNodeId || undefined,
      sourceId: c.sourceId,
      targetId: c.targetId,
      type: c.type as UmlRelationshipType,
      lineStyle: (c.lineStyle as UmlLineStyle) || 'segment',
      name: c.name || undefined,
      sourceMultiplicity: isSequence ? '' : c.sourceMultiplicity || '',
      targetMultiplicity: isSequence ? '' : c.targetMultiplicity || '',
      assocAnchorNodeId: c.assocAnchorNodeId || undefined,
      messages: c.messages || [],
    }));
  }

  private defaultWidthFor(nodeType: string, isBce: boolean, isLifeline: boolean): number {
    switch (nodeType) {
      case 'actor':
        return 65;
      case 'use_case':
        return 140;
      case 'boundary_box':
        return 280;
      case 'package':
        return 200;
      case 'component':
        return 190;
      case 'device':
      case 'node':
        return 230;
      case 'executionEnvironment':
        return 240;
      default:
        return isBce ? 90 : isLifeline ? 140 : 220;
    }
  }

  private defaultHeightFor(
    nodeType: string,
    isBce: boolean,
    isLifeline: boolean,
  ): number | undefined {
    if (isLifeline) return 60;
    if (isBce) return 95;
    switch (nodeType) {
      case 'actor':
        return 95;
      case 'boundary_box':
        return 200;
      case 'component':
        return 70;
      case 'device':
      case 'node':
        return 140;
      case 'executionEnvironment':
        return 160;
      case 'package':
        return 120;
      default:
        return undefined;
    }
  }
}
