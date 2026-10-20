import {
  DiagramType,
  UmlClassNode,
  UmlConnection,
  UmlMessage,
} from '../../../../core/models/diagram.model';
import {
  getSequenceMessageColor,
  isSequenceConnection as isSequenceConnectionLogic,
} from '../components/diagram-canvas/nodes';

/**
 * Utilitario puro de dominio para operaciones de eliminación en cascada,
 * inversión de extremos, normalización de conexiones editadas y consultas de vecindad.
 */
export class ConnectionCascadeUtil {
  /**
   * Invierte la dirección lógica y los conectores de una relación UML.
   *
   * @param conn Conexión a invertir.
   * @returns Conexión con origen, destino y multiplicidades intercambiados.
   */
  static reverseConnection(conn: UmlConnection): UmlConnection {
    const currentS = conn.sourceNodeId || conn.sourceId?.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
    const currentT = conn.targetNodeId || conn.targetId?.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
    const sSideMatch = conn.sourceId?.match(/_(top|bottom|left|right|slot_\d+)$/);
    const tSideMatch = conn.targetId?.match(/_(top|bottom|left|right|slot_\d+)$/);
    const sSide = sSideMatch ? sSideMatch[1] : 'right';
    const tSide = tSideMatch ? tSideMatch[1] : 'left';

    conn.sourceNodeId = currentT;
    conn.targetNodeId = currentS;
    conn.from = currentT;
    conn.to = currentS;
    conn.sourceId = `${currentT}_${tSide}`;
    conn.targetId = `${currentS}_${sSide}`;

    const tempMult = conn.sourceMultiplicity;
    conn.sourceMultiplicity = conn.targetMultiplicity;
    conn.targetMultiplicity = tempMult;

    return conn;
  }

  /**
   * Invierte en el lugar los atributos de origen y destino de una conexión en edición.
   *
   * @param c Conexión mutada durante la edición en modal.
   */
  static swapConnectionDirection(c: UmlConnection): void {
    const tempSourceNodeId = c.sourceNodeId;
    const tempSourceId = c.sourceId;
    const tempSourceMult = c.sourceMultiplicity;

    c.sourceNodeId = c.targetNodeId;
    c.sourceId = c.targetId;
    c.sourceMultiplicity = c.targetMultiplicity;

    c.targetNodeId = tempSourceNodeId;
    c.targetId = tempSourceId;
    c.targetMultiplicity = tempSourceMult;
  }

  /**
   * Calcula el conjunto de nodos (incluidos nodos ancla y clases de asociación) y conexiones
   * que deben eliminarse en cascada al borrar una conexión dada.
   *
   * @param connId Identificador de la conexión a eliminar.
   * @param nodes Lista actual de nodos del diagrama.
   * @param connections Lista actual de conexiones del diagrama.
   * @returns Conjuntos `connsToDelete` y `nodesToDelete`.
   */
  static computeCascadeDelete(
    connId: string,
    nodes: UmlClassNode[],
    connections: UmlConnection[],
  ): { connsToDelete: Set<string>; nodesToDelete: Set<string> } {
    const connsToDelete = new Set<string>([connId]);
    const nodesToDelete = new Set<string>();

    const conn = connections.find((c) => c.id === connId);
    if (conn) {
      if (conn.assocAnchorNodeId) {
        nodesToDelete.add(conn.assocAnchorNodeId);
      }
      nodes.forEach((n) => {
        if (n.assocMainConnId === conn.id) {
          nodesToDelete.add(n.id);
        }
      });

      if (conn.type === 'association_class') {
        const sourceBase = conn.sourceNodeId || conn.sourceId.replace(/_(top|bottom|left|right)$/, '');
        const targetBase = conn.targetNodeId || conn.targetId.replace(/_(top|bottom|left|right)$/, '');
        const sourceNode = nodes.find((n) => n.id === sourceBase);
        const targetNode = nodes.find((n) => n.id === targetBase);
        if (sourceNode?.isAnchor) nodesToDelete.add(sourceNode.id);
        if (targetNode?.isAnchor) nodesToDelete.add(targetNode.id);
        if (sourceNode && !sourceNode.isAnchor) nodesToDelete.add(sourceNode.id);
        if (targetNode && !targetNode.isAnchor) nodesToDelete.add(targetNode.id);
      }
    }

    connections.forEach((c) => {
      if (c.type === 'association_class') {
        const sourceBase = c.sourceNodeId || c.sourceId.replace(/_(top|bottom|left|right)$/, '');
        const targetBase = c.targetNodeId || c.targetId.replace(/_(top|bottom|left|right)$/, '');
        if (nodesToDelete.has(sourceBase)) nodesToDelete.add(targetBase);
        if (nodesToDelete.has(targetBase)) nodesToDelete.add(sourceBase);
      }
    });

    connections.forEach((c) => {
      if (c.assocAnchorNodeId && nodesToDelete.has(c.assocAnchorNodeId)) {
        connsToDelete.add(c.id);
      }
    });
    nodes.forEach((n) => {
      if (n.assocMainConnId && nodesToDelete.has(n.id)) {
        connsToDelete.add(n.assocMainConnId);
      }
    });

    connections.forEach((c) => {
      const sourceBase = c.sourceNodeId || c.sourceId.replace(/_(top|bottom|left|right)$/, '');
      const targetBase = c.targetNodeId || c.targetId.replace(/_(top|bottom|left|right)$/, '');
      if (nodesToDelete.has(sourceBase) || nodesToDelete.has(targetBase)) {
        connsToDelete.add(c.id);
      }
    });

    return { connsToDelete, nodesToDelete };
  }

  /**
   * Prepara y normaliza una conexión editada desde el modal antes de persistirla en el estado.
   *
   * @param edited Conexión modificada.
   * @param activeDiagramType Tipo de diagrama activo.
   * @param normalizeUmlMessage Función opcional de normalización de mensajes UML.
   * @returns Indicador de secuencia y conexión normalizada.
   */
  static prepareSavedEditedConnection(
    edited: UmlConnection,
    activeDiagramType: DiagramType,
    normalizeUmlMessage?: (m: any, defaultSeq?: string) => UmlMessage,
  ): { isSeq: boolean; prepared: UmlConnection } {
    const isSeq = isSequenceConnectionLogic(edited, activeDiagramType);

    if (isSeq || edited.type === 'generalization' || edited.type === 'realization') {
      edited.sourceMultiplicity = '';
      edited.targetMultiplicity = '';
    }

    if (isSeq && edited.messages && edited.messages.length > 0) {
      if (normalizeUmlMessage) {
        const norm = normalizeUmlMessage(edited.messages[0], edited.messages[0].sequenceNumber || '1');
        norm.orderIndex = 0;
        edited.messages = [norm];
      }
      const m = edited.messages[0];
      m.color = getSequenceMessageColor(m.sequenceNumber);
    }

    return { isSeq, prepared: edited };
  }

  /**
   * Determina si una conexión incide sobre el nodo actualmente seleccionado.
   */
  static isConnectionSelected(
    connId: string,
    connections: UmlConnection[],
    selectedNodeId: string | null,
  ): boolean {
    if (!selectedNodeId) return false;
    const conn = connections.find((c) => c.id === connId);
    if (!conn) return false;
    const s = conn.sourceNodeId || conn.sourceId?.replace(/_(top|bottom|left|right)$/, '');
    const t = conn.targetNodeId || conn.targetId?.replace(/_(top|bottom|left|right)$/, '');
    return s === selectedNodeId || t === selectedNodeId;
  }

  /**
   * Determina si una conexión debe mostrarse atenuada cuando otro nodo no relacionado está seleccionado.
   */
  static isConnectionDimmed(
    connId: string,
    connections: UmlConnection[],
    selectedNodeId: string | null,
    hasMultipleSelected: boolean,
  ): boolean {
    if (hasMultipleSelected) return false;
    if (!selectedNodeId) return false;
    const conn = connections.find((c) => c.id === connId);
    if (!conn) return false;
    const s = conn.sourceNodeId || conn.sourceId?.replace(/_(top|bottom|left|right)$/, '');
    const t = conn.targetNodeId || conn.targetId?.replace(/_(top|bottom|left|right)$/, '');
    return s !== selectedNodeId && t !== selectedNodeId;
  }

  /**
   * Determina si el rombo de agregación/composición debe renderizarse en el extremo inicial.
   */
  static isDiamondAtStart(conn: UmlConnection): boolean {
    const sMult = (conn.sourceMultiplicity || '').trim();
    const tMult = (conn.targetMultiplicity || '').trim();
    const isTargetOne = tMult === '1' || tMult === '0..1';
    const isSourceMany = sMult.includes('*') || sMult.toLowerCase().includes('n');
    return !(isTargetOne && isSourceMany);
  }

  /**
   * Determina si un nodo es vecino inmediato del nodo seleccionado.
   */
  static isNeighborNode(
    nodeId: string,
    connections: UmlConnection[],
    selectedNodeId: string | null,
    hasMultipleSelected: boolean,
  ): boolean {
    if (hasMultipleSelected) return false;
    if (!selectedNodeId || nodeId === selectedNodeId) return false;
    return connections.some((c) => {
      const s = c.sourceNodeId || c.sourceId?.replace(/_(top|bottom|left|right)$/, '');
      const t = c.targetNodeId || c.targetId?.replace(/_(top|bottom|left|right)$/, '');
      return (s === selectedNodeId && t === nodeId) || (t === selectedNodeId && s === nodeId);
    });
  }
}
