import {
  DiagramType,
  UmlMessage,
  UmlMessageType,
  UmlNodeType,
} from '../../../../core/models/diagram.model';

const NON_CLASS_COLORED_NODE_TYPES = [
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
] as const;

export const EXPLICIT_SIZE_NODE_TYPES = [
  'component',
  'device',
  'node',
  'executionEnvironment',
  'boundary_box',
  'package',
] as const;

/**
 * Utilitario puro de dominio para inferir tipos de nodo UML desde identificadores/nombres,
 * resolver dimensiones y colores por defecto, y normalizar mensajes de interacción UML 2.5.
 */
export class UmlNodeNormalizerUtil {
  /**
   * Evalúa si un tipo de nodo UML es compatible con un tipo de diagrama específico.
   *
   * @param nodeType Tipo de nodo UML a evaluar.
   * @param diagramType Tipo de diagrama objetivo.
   * @returns `true` si el nodo puede insertarse o vincularse en el diagrama objetivo.
   */
  static isNodeTypeCompatible(
    nodeType: string | undefined,
    diagramType: DiagramType | string
  ): boolean {
    const type = nodeType || 'class';

    if (diagramType === DiagramType.COMMUNICATION) {
      return type === 'actor' || type === 'boundary' || type === 'control' || type === 'entity';
    }
    if (diagramType === DiagramType.CLASS_ANALYSIS) {
      return type === 'class' || type === 'actor';
    }
    if (diagramType === DiagramType.CLASS) {
      return type === 'class';
    }
    if (diagramType === DiagramType.USE_CASE) {
      return type === 'actor' || type === 'use_case';
    }
    if (diagramType === DiagramType.PACKAGE) {
      return type === 'package' || type === 'use_case' || type === 'actor';
    }
    if (diagramType === DiagramType.SEQUENCE) {
      return (
        type === 'actor' ||
        type === 'lifeline' ||
        type === 'class' ||
        type === 'boundary' ||
        type === 'control' ||
        type === 'entity'
      );
    }
    if (diagramType === DiagramType.DEPLOYMENT) {
      return (
        type === 'device' ||
        type === 'node' ||
        type === 'executionEnvironment' ||
        type === 'component' ||
        type === 'boundary_box' ||
        type === 'package' ||
        type === 'class'
      );
    }
    if (diagramType === DiagramType.COMPONENT) {
      return (
        type === 'component' || type === 'boundary_box' || type === 'package' || type === 'class'
      );
    }
    if (diagramType === DiagramType.LAYERED) {
      return type === 'package' || type === 'boundary_box' || type === 'class';
    }
    return true;
  }
  /**
   * Infiere el `nodeType` real de un nodo según su tipo declarado, prefijo de ID, nombre o tipo de diagrama.
   *
   * @param n Nodo bruto recibido de servidor, borrador local o respuesta IA.
   * @param options Opciones contextuales (ej. si pertenece a secuencia, paquete o mutación IA).
   * @returns Tipo de nodo UML normalizado.
   */
  static inferNodeType(
    n: { id?: string; name?: string; nodeType?: UmlNodeType | string },
    options?: { isSequence?: boolean; diagramType?: string; inspectNameForUseCase?: boolean },
  ): UmlNodeType | string {
    const defaultType =
      options?.diagramType === 'package'
        ? 'package'
        : options?.isSequence
        ? 'lifeline'
        : 'class';
    let nodeType: UmlNodeType | string = n.nodeType || defaultType;

    if (
      options?.inspectNameForUseCase &&
      (/^cu[-_ \d]/i.test(n.name || '') || (typeof n.name === 'string' && /caso\s+de\s+uso/i.test(n.name)))
    ) {
      return 'use_case';
    }
    if (nodeType === 'boundary_box' || n.id?.startsWith('boundary_box_') || n.id?.startsWith('bbox_')) {
      return 'boundary_box';
    }
    if (
      nodeType === 'class' ||
      (nodeType === 'package' && (n.id?.startsWith('uc_') || n.id?.startsWith('use_case_')))
    ) {
      if (n.id?.startsWith('actor_')) nodeType = 'actor';
      else if (n.id?.startsWith('use_case_') || n.id?.startsWith('uc_')) nodeType = 'use_case';
      else if (n.id?.startsWith('boundary_box_') || n.id?.startsWith('bbox_')) nodeType = 'boundary_box';
      else if (n.id?.startsWith('package_') || n.id?.startsWith('pkg_')) nodeType = 'package';
      else if (n.id?.startsWith('boundary_')) nodeType = 'boundary';
      else if (n.id?.startsWith('control_')) nodeType = 'control';
      else if (n.id?.startsWith('entity_')) nodeType = 'entity';
      else if (n.id?.startsWith('component_') || n.id?.startsWith('comp_')) nodeType = 'component';
      else if (n.id?.startsWith('device_') || n.id?.startsWith('dev_')) nodeType = 'device';
      else if (
        n.id?.startsWith('exec_env_') ||
        n.id?.startsWith('exec_') ||
        n.id?.startsWith('executionEnvironment_')
      ) {
        nodeType = 'executionEnvironment';
      } else if (n.id?.startsWith('lifeline_') || options?.isSequence) {
        nodeType = 'lifeline';
      }
    }
    return nodeType;
  }

  /**
   * Resuelve el color efectivo de un nodo aplicando el color semántico por defecto cuando corresponde.
   *
   * @param currentColor Color actual almacenado en el nodo.
   * @param nodeType Tipo de nodo UML.
   * @param stereotype Estereotipo opcional del nodo.
   * @param getDefaultColor Función proveedora de color por defecto.
   * @returns Color hexadecimal resuelto.
   */
  static resolveNodeColor(
    currentColor: string | null | undefined,
    nodeType: string,
    stereotype?: string | null,
    getDefaultColor?: (nodeType?: any, stereotype?: any) => string,
  ): string | undefined {
    const isLegacyClassDefault = currentColor === '#FFFDDD' || currentColor === '#FDFAF3';
    const isSpecialNode = (NON_CLASS_COLORED_NODE_TYPES as readonly string[]).includes(nodeType);
    if ((!currentColor || (isLegacyClassDefault && isSpecialNode)) && getDefaultColor) {
      return getDefaultColor(nodeType, stereotype);
    }
    return currentColor || undefined;
  }

  /**
   * Obtiene las dimensiones por defecto (`width` y `height`) para un tipo de nodo UML.
   *
   * @param nodeType Tipo de nodo UML.
   * @param bceDimensions Dimensiones para nodos de robustez BCE.
   * @returns Dimensiones iniciales por defecto.
   */
  static getDefaultDimensions(
    nodeType: string,
    bceDimensions: { width: number; height: number } = { width: 90, height: 95 },
  ): { defaultWidth: number; defaultHeight: number | undefined } {
    switch (nodeType) {
      case 'actor':
        return { defaultWidth: 65, defaultHeight: 95 };
      case 'use_case':
        return { defaultWidth: 140, defaultHeight: undefined };
      case 'boundary_box':
        return { defaultWidth: 280, defaultHeight: 200 };
      case 'package':
        return { defaultWidth: 200, defaultHeight: 120 };
      case 'component':
        return { defaultWidth: 190, defaultHeight: 70 };
      case 'device':
      case 'node':
        return { defaultWidth: 230, defaultHeight: 140 };
      case 'executionEnvironment':
        return { defaultWidth: 240, defaultHeight: 160 };
      case 'boundary':
      case 'control':
      case 'entity':
        return { defaultWidth: bceDimensions.width, defaultHeight: bceDimensions.height };
      case 'lifeline':
        return { defaultWidth: 140, defaultHeight: 60 };
      default:
        return { defaultWidth: 220, defaultHeight: undefined };
    }
  }

  /**
   * Normaliza un mensaje de secuencia o comunicación UML 2.5 extrayendo numeración,
   * firma de operación, parámetros, tipo de retorno y dirección.
   *
   * @param m Objeto crudo del mensaje.
   * @param defaultSeq Número de secuencia por defecto si no se especifica.
   * @returns Mensaje `UmlMessage` normalizado e inmutable.
   */
  static normalizeUmlMessage(m: any, defaultSeq = '1'): UmlMessage {
    let seq = String(m.sequenceNumber || '').trim();
    let fn = String(m.functionName || '').trim();
    let params = String(m.parameters ?? '').trim();
    let returnType = m.returnType ? String(m.returnType).trim() : undefined;
    const rawText = String(m.name || m.text || m.label || '').trim();

    const extractParts = (inputStr: string): string => {
      let current = inputStr;
      const seqMatch = current.match(/^(\d+(?:\.\d+)*)\s*[:.\s-]\s*(.*)$/);
      if (seqMatch) {
        if (!seq) seq = seqMatch[1];
        current = seqMatch[2].trim();
      } else if (/^\d+(\.\d+)*$/.test(current)) {
        if (!seq) seq = current;
        current = '';
      }

      const retMatch = current.match(/^(.*?)\s*:\s*([a-zA-Z0-9_\[\]<>]+)$/);
      if (retMatch) {
        current = retMatch[1].trim();
        if (!returnType) returnType = retMatch[2].trim();
      }

      const parenMatch = current.match(/^(.*?)\((.*?)\)$/);
      if (parenMatch) {
        current = parenMatch[1].trim();
        if (!params && parenMatch[2] !== undefined) {
          params = parenMatch[2].trim();
        }
      }

      return current
        .replace(/\(\)/g, '')
        .replace(/^(\d+(?:\.\d+)*)\s*[:.\s-]\s*/, '')
        .trim();
    };

    if (fn) {
      fn = extractParts(fn);
    }

    if ((!fn || fn.toLowerCase() === 'msj' || fn.toLowerCase() === 'mensaje') && rawText) {
      const candidate = extractParts(rawText);
      if (candidate && candidate.toLowerCase() !== 'msj' && candidate.toLowerCase() !== 'mensaje') {
        fn = candidate;
      }
    }

    if (!fn || fn.toLowerCase() === 'msj' || fn.toLowerCase() === 'mensaje') {
      const fallbackName =
        m.name && m.name !== 'msj' && m.name !== 'mensaje()' && m.name !== 'mensaje'
          ? m.name.replace(/\(\)/g, '').replace(/^(\d+(?:\.\d+)*)\s*[:.\s-]\s*/, '').trim()
          : '';
      fn = fallbackName || 'msj';
    }

    if (params) {
      params = params.trim();
      if (params.startsWith('(') && params.endsWith(')')) {
        params = params.slice(1, -1).trim();
      }
    }

    if (!seq) seq = defaultSeq;

    const isReturn = m.type === 'reply' || !!m.isReturn;
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
        typeof m.orderIndex === 'number' && Number.isFinite(m.orderIndex) ? m.orderIndex : undefined,
      positionY:
        typeof m.positionY === 'number' && Number.isFinite(m.positionY) ? m.positionY : undefined,
      color: m.color || undefined,
    };
  }
}
