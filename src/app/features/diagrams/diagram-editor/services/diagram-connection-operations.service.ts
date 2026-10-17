import { Injectable, inject } from '@angular/core';
import { FCreateConnectionEvent, FReassignConnectionEvent } from '@foblex/flow';
import { ToastService } from '../../../../core/services/toast.service';
import {
  DiagramType,
  UmlClassNode,
  UmlConnection,
  UmlLineStyle,
  UmlMessage,
  UmlRelationshipType,
} from '../../../../core/models/diagram.model';
import {
  createAssociationClassBetween as createAssociationClassBetweenLogic,
  generateNextSequenceMessage as generateNextSequenceMessageLogic,
  isSequenceConnection as isSequenceConnectionLogic,
  getSequenceMessageColor,
} from '../components/diagram-canvas/nodes';
import { DiagramConnectionLayoutService } from './diagram-connection-layout.service';

export interface CreateConnectionParams {
  fOutputId: string;
  fInputId: string;
  selectedRelationType: UmlRelationshipType | null;
  activeDiagramType: DiagramType;
  defaultLineStyle: UmlLineStyle;
  nodes: UmlClassNode[];
  connections: UmlConnection[];
  isNodeLockedByOther: (nodeId: string) => boolean;
  generateNextSequenceMessage?: (
    sourceNode: UmlClassNode,
    targetNode: UmlClassNode,
    isReturn: boolean,
  ) => UmlMessage[];
}

export interface CreateConnectionResult {
  newConnection?: UmlConnection;
  isSeqRel?: boolean;
  createdAssociationClass?: {
    nodes: UmlClassNode[];
    connections: UmlConnection[];
  };
  errorMessage?: string;
}

@Injectable({
  providedIn: 'root',
})
export class DiagramConnectionOperationsService {
  private readonly layoutService: DiagramConnectionLayoutService;
  private readonly toastService?: ToastService | null;

  constructor(layoutService?: DiagramConnectionLayoutService, toastService?: ToastService) {
    if (layoutService) {
      this.layoutService = layoutService;
    } else {
      let injected: DiagramConnectionLayoutService | null = null;
      try {
        injected = inject(DiagramConnectionLayoutService, { optional: true });
      } catch {
        // Outside Angular DI context
      }
      this.layoutService = injected ?? new DiagramConnectionLayoutService();
    }

    if (toastService !== undefined) {
      this.toastService = toastService;
    } else {
      try {
        this.toastService = inject(ToastService, { optional: true });
      } catch {
        this.toastService = null;
      }
    }
  }

  /**
   * Procesa la creación de una conexión entre dos puertos/slots
   */
  processCreateConnection(params: CreateConnectionParams): CreateConnectionResult {
    const {
      fOutputId,
      fInputId,
      selectedRelationType,
      activeDiagramType,
      defaultLineStyle,
      nodes,
      connections,
      isNodeLockedByOther,
      generateNextSequenceMessage,
    } = params;

    const relType = selectedRelationType || 'association';
    const isSeqRel = isSequenceConnectionLogic(relType, activeDiagramType);

    if (isSeqRel) {
      const sHasSlot = fOutputId.includes('_slot_');
      const tHasSlot = fInputId.includes('_slot_');
      if (!sHasSlot || !tHasSlot) {
        return {};
      }
    }

    const baseSourceId = fOutputId.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
    const baseTargetId = fInputId.replace(/_(top|bottom|left|right|slot_\d+)$/, '');

    if (isNodeLockedByOther(baseSourceId) || isNodeLockedByOther(baseTargetId)) {
      return {
        errorMessage: '🔒 No se pueden crear conexiones hacia/desde una tabla que está siendo editada.',
      };
    }

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const sourceNode = nodeMap.get(baseSourceId);
    const targetNode = nodeMap.get(baseTargetId);

    if (relType === 'association_class' && sourceNode && targetNode) {
      if (baseSourceId === baseTargetId) {
        return {
          errorMessage: 'Las clases de asociación conectan dos tablas distintas.',
        };
      }
      const assocResult = this.createAssociationClassBetween(sourceNode, targetNode, nodes, connections);
      return {
        createdAssociationClass: assocResult,
      };
    }

    let sourceId = fOutputId;
    let targetId = fInputId;

    if (sourceNode && targetNode) {
      if (isSeqRel || sourceId.includes('_slot_') || targetId.includes('_slot_')) {
        if (baseSourceId === baseTargetId) {
          sourceId = `${baseSourceId}_right`;
          targetId = `${baseTargetId}_right`;
        } else {
          const sMatch = sourceId.match(/_slot_(\d+)$/);
          const tMatch = targetId.match(/_slot_(\d+)$/);
          let slotNum: string;
          if (sMatch) {
            slotNum = sMatch[1];
          } else if (tMatch) {
            slotNum = tMatch[1];
          } else {
            slotNum = this.layoutService.findNextAvailableSlot(connections);
          }

          const targetSlotNum = parseInt(slotNum, 10);
          const isSlotOccupied = this.layoutService.isSequenceSlotOccupied(
            connections,
            targetSlotNum,
            activeDiagramType,
          );

          if (isSlotOccupied) {
            return {
              errorMessage:
                '⚠️ No se permite colocar dos mensajes en la misma posición temporal (fila colineal). Cada mensaje debe ubicarse en una posición distinta.',
            };
          }

          sourceId = `${baseSourceId}_slot_${slotNum}`;
          targetId = `${baseTargetId}_slot_${slotNum}`;
        }
      } else if (baseSourceId === baseTargetId) {
        const validConnectors = [
          `${baseSourceId}_top`,
          `${baseSourceId}_right`,
          `${baseSourceId}_bottom`,
          `${baseSourceId}_left`,
        ];
        const isDistinctConnectors =
          validConnectors.includes(sourceId) &&
          validConnectors.includes(targetId) &&
          sourceId !== targetId;

        if (!isDistinctConnectors) {
          sourceId = `${baseSourceId}_top`;
          targetId = `${baseTargetId}_right`;
        }
      } else {
        const optimal = this.layoutService.getOptimalConnectorId(sourceNode, targetNode);
        sourceId = optimal.sourceId;
        targetId = optimal.targetId;
      }
    }

    let messages: UmlMessage[] | undefined = undefined;
    if (isSeqRel && sourceNode && targetNode) {
      const isReturn = relType === 'reply';
      messages = generateNextSequenceMessage
        ? generateNextSequenceMessage(sourceNode, targetNode, isReturn)
        : this.generateNextSequenceMessage(sourceNode, targetNode, isReturn);
    }

    const newConnection = this.layoutService.buildNewConnection({
      sourceNode: sourceNode || ({ id: baseSourceId } as any),
      targetNode: targetNode || ({ id: baseTargetId } as any),
      relType,
      sourceId,
      targetId,
      defaultLineStyle,
      activeDiagramType,
      messages,
    });

    return {
      newConnection,
      isSeqRel,
    };
  }

  /**
   * Crea una clase de asociación intermedia conectada a la línea entre source y target
   */
  createAssociationClassBetween(
    sourceNode: UmlClassNode,
    targetNode: UmlClassNode,
    currentNodes: UmlClassNode[],
    currentConns: UmlConnection[],
  ): { nodes: UmlClassNode[]; connections: UmlConnection[] } {
    return createAssociationClassBetweenLogic(sourceNode, targetNode, currentNodes, currentConns);
  }

  /**
   * Reasigna el origen o destino de una conexión existente
   */
  processReassignConnection(
    list: UmlConnection[],
    event: { connectionId: string; nextSourceId?: string; nextTargetId?: string },
    activeDiagramType: DiagramType,
  ): { updatedList: UmlConnection[]; isOccupied?: boolean } {
    const isSeq = activeDiagramType === DiagramType.SEQUENCE;
    let isOccupied = false;

    const reassigned = list.map((c) => {
      if (c.id === event.connectionId) {
        let sId = event.nextSourceId || c.sourceId;
        let tId = event.nextTargetId || c.targetId;
        if (isSequenceConnectionLogic(c, activeDiagramType)) {
          const sMatch = event.nextSourceId ? event.nextSourceId.match(/_slot_(\d+)$/) : null;
          const tMatch = event.nextTargetId ? event.nextTargetId.match(/_slot_(\d+)$/) : null;
          const slotNum = sMatch ? sMatch[1] : (tMatch ? tMatch[1] : null);
          if (slotNum !== null) {
            const targetSlotNum = parseInt(slotNum, 10);
            const slotOccupied = this.layoutService.isSequenceSlotOccupied(
              list,
              targetSlotNum,
              activeDiagramType,
              event.connectionId,
            );
            if (slotOccupied) {
              isOccupied = true;
              return c;
            }
            const baseSrc = sId.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
            const baseTgt = tId.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
            sId = `${baseSrc}_slot_${slotNum}`;
            tId = `${baseTgt}_slot_${slotNum}`;
          }
        }
        return {
          ...c,
          sourceId: sId,
          targetId: tId,
        };
      }
      return c;
    });

    return { updatedList: reassigned, isOccupied };
  }

  /**
   * Invierte la dirección de una conexión
   */
  reverseConnection(conn: UmlConnection): UmlConnection {
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
   * Calcula los nodos y conexiones que deben eliminarse en cascada al borrar una conexión
   */
  computeCascadeDelete(
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

    // Propagar relaciones association_class en cascada
    connections.forEach((c) => {
      if (c.type === 'association_class') {
        const sourceBase = c.sourceNodeId || c.sourceId.replace(/_(top|bottom|left|right)$/, '');
        const targetBase = c.targetNodeId || c.targetId.replace(/_(top|bottom|left|right)$/, '');
        if (nodesToDelete.has(sourceBase)) nodesToDelete.add(targetBase);
        if (nodesToDelete.has(targetBase)) nodesToDelete.add(sourceBase);
      }
    });

    // Si cualquier nodo ancla o tabla intermedia está marcado, marcar la conexión principal
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
   * Ejecuta la eliminación en cascada de una conexión y retorna las listas resultantes
   */
  executeCascadeDeleteConnection(
    connId: string,
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    recalculateSequenceNumbers: (conns: UmlConnection[]) => UmlConnection[],
  ): {
    remainingNodes: UmlClassNode[];
    remainingConnections: UmlConnection[];
  } {
    const { connsToDelete, nodesToDelete } = this.computeCascadeDelete(connId, nodes, connections);
    const remainingNodes = nodesToDelete.size > 0 ? nodes.filter((n) => !nodesToDelete.has(n.id)) : nodes;
    const remainingConnections = recalculateSequenceNumbers(connections.filter((c) => !connsToDelete.has(c.id)));
    return { remainingNodes, remainingConnections };
  }

  /**
   * Guarda y procesa la conexión editada
   */
  saveEditedConnection(
    connections: UmlConnection[],
    savedConn: UmlConnection,
    activeDiagramType: DiagramType,
    normalizeUmlMessage?: (m: any, defaultSeq?: string) => UmlMessage,
  ): { updatedConnections: UmlConnection[]; isSeq: boolean } {
    const { isSeq, prepared } = this.prepareSavedEditedConnection(
      savedConn,
      activeDiagramType,
      normalizeUmlMessage,
    );
    const updatedConnections = connections.map((c) =>
      c.id === prepared.id
        ? { ...prepared, messages: prepared.messages ? [...prepared.messages] : undefined }
        : c,
    );
    return { updatedConnections, isSeq };
  }

  /**
   * Prepara la conexión editada antes de persistir
   */
  prepareSavedEditedConnection(
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
   * Determina si una conexión toca al nodo actualmente seleccionado
   */
  isConnectionSelected(connId: string, connections: UmlConnection[], selectedNodeId: string | null): boolean {
    if (!selectedNodeId) return false;
    const conn = connections.find((c) => c.id === connId);
    if (!conn) return false;
    const s = conn.sourceNodeId || conn.sourceId?.replace(/_(top|bottom|left|right)$/, '');
    const t = conn.targetNodeId || conn.targetId?.replace(/_(top|bottom|left|right)$/, '');
    return s === selectedNodeId || t === selectedNodeId;
  }

  /**
   * Determina si una conexión debe verse atenuada respecto a la selección
   */
  isConnectionDimmed(
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
   * Determina si el diamante UML debe dibujarse en el inicio de la relación
   */
  isDiamondAtStart(conn: UmlConnection): boolean {
    const sMult = (conn.sourceMultiplicity || '').trim();
    const tMult = (conn.targetMultiplicity || '').trim();
    const isTargetOne = tMult === '1' || tMult === '0..1';
    const isSourceMany = sMult.includes('*') || sMult.toLowerCase().includes('n');

    if (isTargetOne && isSourceMany) {
      return false;
    }
    return true;
  }

  /**
   * Invierte la dirección de una conexión en edición
   */
  swapConnectionDirection(c: UmlConnection): void {
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
   * Determina si un nodo es vecino inmediato del nodo seleccionado
   */
  isNeighborNode(
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

  /**
   * Procesa la creación de conexiones al hacer clic de nodo a nodo (modo dos clics)
   */
  processTableClickConnection(params: {
    currentSource: string;
    targetNodeId: string;
    activeRel: UmlRelationshipType;
    activeDiagramType: DiagramType;
    nodes: UmlClassNode[];
    connections: UmlConnection[];
    defaultLineStyle: UmlLineStyle;
    getOptimalConnectorId: (sourceNode: UmlClassNode, targetNode: UmlClassNode) => { sourceId: string; targetId: string };
    generateNextSequenceMessage?: (sourceNode: UmlClassNode, targetNode: UmlClassNode, isReturn: boolean) => UmlMessage[];
  }): { isAssocClass?: boolean; newConn?: UmlConnection; isSeqRel?: boolean; error?: string } {
    const {
      currentSource,
      targetNodeId,
      activeRel,
      activeDiagramType,
      nodes,
      connections,
      defaultLineStyle,
      getOptimalConnectorId,
      generateNextSequenceMessage,
    } = params;

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const sourceNode = nodeMap.get(currentSource);
    const targetNode = nodeMap.get(targetNodeId);

    if (!sourceNode || !targetNode) return {};

    if (activeRel === 'association_class') {
      if (currentSource === targetNodeId) {
        return { error: 'Las clases de asociación conectan dos tablas distintas.' };
      }
      return { isAssocClass: true };
    }

    const isSeqRel = isSequenceConnectionLogic(activeRel, activeDiagramType);

    let sourceId: string;
    let targetId: string;
    if (currentSource === targetNodeId) {
      sourceId = isSeqRel ? `${currentSource}_right` : `${currentSource}_top`;
      targetId = `${targetNodeId}_right`;
    } else if (isSeqRel) {
      const nextSlot = this.layoutService.findNextAvailableSlot(connections);
      sourceId = `${currentSource}_slot_${nextSlot}`;
      targetId = `${targetNodeId}_slot_${nextSlot}`;
    } else {
      const optimal = getOptimalConnectorId(sourceNode, targetNode);
      sourceId = optimal.sourceId;
      targetId = optimal.targetId;
    }

    let messages: UmlMessage[] | undefined = undefined;
    if (isSeqRel) {
      const isReturn = activeRel === 'reply';
      messages = generateNextSequenceMessage
        ? generateNextSequenceMessage(sourceNode, targetNode, isReturn)
        : this.generateNextSequenceMessage(sourceNode, targetNode, isReturn);
    }

    const newConn = this.layoutService.buildNewConnection({
      sourceNode,
      targetNode,
      relType: activeRel,
      sourceId,
      targetId,
      defaultLineStyle,
      activeDiagramType,
      messages,
    });

    return { newConn, isSeqRel };
  }

  generateNextSequenceMessage(
    sourceNode?: UmlClassNode,
    targetNode?: UmlClassNode,
    isReturn: boolean = false,
  ): UmlMessage[] {
    return generateNextSequenceMessageLogic(sourceNode, targetNode, isReturn);
  }

  /**
   * Maneja el ciclo completo del evento onTableClick
   */
  handleTableClick(
    nodeId: string,
    event: MouseEvent,
    options: {
      isReadOnly: boolean;
      isLocked: boolean;
      activeRel: UmlRelationshipType | null;
      currentSource: string | null;
      setSourceNodeId: (id: string | null) => void;
      onMouseMove: (e: MouseEvent) => void;
      activeDiagramType: DiagramType;
      nodes: UmlClassNode[];
      connections: UmlConnection[];
      defaultLineStyle: UmlLineStyle;
      getOptimalConnectorId: (sourceNode: UmlClassNode, targetNode: UmlClassNode) => { sourceId: string; targetId: string };
      generateNextSequenceMessage: (sourceNode: UmlClassNode, targetNode: UmlClassNode, isReturn: boolean) => UmlMessage[];
      onApplyNewConnection: (newConn: UmlConnection, isSeqRel: boolean) => void;
      onApplyAssociationClass: (assocResult: { nodes: UmlClassNode[]; connections: UmlConnection[] }) => void;
    },
  ): void {
    if (options.isReadOnly || options.isLocked || !options.activeRel) return;

    event.stopPropagation();
    event.preventDefault();

    if (options.currentSource === null) {
      options.setSourceNodeId(nodeId);
      options.onMouseMove(event);
      return;
    }

    const result = this.processTableClickConnection({
      currentSource: options.currentSource,
      targetNodeId: nodeId,
      activeRel: options.activeRel,
      activeDiagramType: options.activeDiagramType,
      nodes: options.nodes,
      connections: options.connections,
      defaultLineStyle: options.defaultLineStyle,
      getOptimalConnectorId: options.getOptimalConnectorId,
      generateNextSequenceMessage: options.generateNextSequenceMessage,
    });

    if (result.error) {
      this.toastService?.warning(result.error);
      options.setSourceNodeId(null);
      return;
    }

    if (result.isAssocClass) {
      const nodeMap = new Map(options.nodes.map((n) => [n.id, n]));
      const sourceNode = nodeMap.get(options.currentSource);
      const targetNode = nodeMap.get(nodeId);
      if (sourceNode && targetNode) {
        const assocResult = this.createAssociationClassBetween(
          sourceNode,
          targetNode,
          options.nodes,
          options.connections,
        );
        options.onApplyAssociationClass(assocResult);
      }
      return;
    }

    if (result.newConn) {
      options.onApplyNewConnection(result.newConn, !!result.isSeqRel);
    }
  }

  /**
   * Maneja el ciclo completo del evento onConnectionCreated
   */
  handleConnectionCreated(
    event: FCreateConnectionEvent,
    options: {
      isReadOnly: boolean;
      selectedRelationType: UmlRelationshipType | null;
      activeDiagramType: DiagramType;
      defaultLineStyle: UmlLineStyle;
      nodes: UmlClassNode[];
      connections: UmlConnection[];
      isNodeLockedByOther: (nodeId: string) => boolean;
      generateNextSequenceMessage: (src: UmlClassNode, tgt: UmlClassNode, isReturn: boolean) => UmlMessage[];
      onApplyNewConnection: (newConn: UmlConnection, isSeqRel: boolean) => void;
      onApplyAssocClass: (result: { nodes: UmlClassNode[]; connections: UmlConnection[] }) => void;
    },
  ): void {
    if (options.isReadOnly || !event.fInputId) return;

    const result = this.processCreateConnection({
      fOutputId: event.fOutputId,
      fInputId: event.fInputId,
      selectedRelationType: options.selectedRelationType,
      activeDiagramType: options.activeDiagramType,
      defaultLineStyle: options.defaultLineStyle,
      nodes: options.nodes,
      connections: options.connections,
      isNodeLockedByOther: options.isNodeLockedByOther,
      generateNextSequenceMessage: options.generateNextSequenceMessage,
    });

    if (result.errorMessage) {
      this.toastService?.warning(result.errorMessage);
      return;
    }

    if (result.createdAssociationClass) {
      options.onApplyAssocClass(result.createdAssociationClass);
      return;
    }

    if (result.newConnection) {
      options.onApplyNewConnection(result.newConnection, !!result.isSeqRel);
    }
  }

  /**
   * Maneja el evento onConnectionReassigned
   */
  handleConnectionReassigned(
    event: FReassignConnectionEvent,
    options: {
      isReadOnly: boolean;
      connections: UmlConnection[];
      activeDiagramType: DiagramType;
      onApplyReassigned: (updatedList: UmlConnection[]) => void;
    },
  ): void {
    if (options.isReadOnly) return;
    const { updatedList, isOccupied } = this.processReassignConnection(
      options.connections,
      event,
      options.activeDiagramType,
    );
    if (isOccupied) {
      this.toastService?.warning('⚠️ No se pueden colocar dos mensajes en la misma posición temporal (fila colineal).');
      return;
    }
    options.onApplyReassigned(updatedList);
  }

  /**
   * Maneja el evento onSequenceMessageMove
   */
  handleSequenceMessageMove(
    event: { connectionId: string; targetSlot: number },
    options: {
      isReadOnly: boolean;
      connections: UmlConnection[];
      activeDiagramType: DiagramType;
      onApplyMoved: (updatedList: UmlConnection[]) => void;
    },
  ): void {
    if (options.isReadOnly) return;
    const movingConn = options.connections.find((c) => c.id === event.connectionId);
    if (!movingConn) return;

    const moved = this.layoutService.computeSequenceMessageMove(
      options.connections,
      event.connectionId,
      event.targetSlot,
      options.activeDiagramType,
    );
    options.onApplyMoved(moved);
  }
}
