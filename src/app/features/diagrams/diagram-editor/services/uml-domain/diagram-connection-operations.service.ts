import { Injectable, inject } from '@angular/core';
import { FCreateConnectionEvent, FReassignConnectionEvent } from '@foblex/flow';
import { ToastService } from '../../../../../core/services/toast.service';
import {
  DiagramType,
  UmlClassNode,
  UmlConnection,
  UmlLineStyle,
  UmlMessage,
  UmlRelationshipType,
} from '../../../../../core/models/diagram.model';
import {
  createAssociationClassBetween as createAssociationClassBetweenLogic,
  generateNextSequenceMessage as generateNextSequenceMessageLogic,
  isSequenceConnection as isSequenceConnectionLogic,
} from '../../components/diagram-canvas/nodes';
import { DiagramConnectionLayoutService } from '../spatial-engine/diagram-connection-layout.service';
import { ConnectionCascadeUtil } from '../../utils/connection-cascade.util';

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

/**
 * Servicio de operaciones de dominio sobre conexiones UML:
 * creación por arrastre o doble clic, reasignación de puertos, edición,
 * inversión direccional y borrado en cascada.
 */
@Injectable({
  providedIn: 'root',
})
export class DiagramConnectionOperationsService {
  private readonly layoutService: DiagramConnectionLayoutService;
  private readonly toastService?: ToastService | null;
  private lastSourceSetTimestamp = 0;

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
   * Procesa la creación de una conexión entre dos puertos o slots temporales.
   *
   * @param params Parámetros de entrada del evento de conexión.
   * @returns Resultado con la nueva conexión, clase de asociación o mensaje de error.
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

    if (isSeqRel && (!fOutputId.includes('_slot_') || !fInputId.includes('_slot_'))) {
      return {};
    }

    const baseSourceId = ConnectionCascadeUtil.extractBaseNodeId(fOutputId);
    const baseTargetId = ConnectionCascadeUtil.extractBaseNodeId(fInputId);

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
        return { errorMessage: 'Las clases de asociación conectan dos tablas distintas.' };
      }
      return {
        createdAssociationClass: this.createAssociationClassBetween(sourceNode, targetNode, nodes, connections),
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
          const slotNum = sMatch
            ? sMatch[1]
            : tMatch
            ? tMatch[1]
            : this.layoutService.findNextAvailableSlot(connections);
          const isSlotOccupied = this.layoutService.isSequenceSlotOccupied(
            connections,
            parseInt(slotNum, 10),
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
        const valid = [
          `${baseSourceId}_top`, `${baseSourceId}_top_start`, `${baseSourceId}_top_end`,
          `${baseSourceId}_right`, `${baseSourceId}_right_start`, `${baseSourceId}_right_end`,
          `${baseSourceId}_bottom`, `${baseSourceId}_bottom_start`, `${baseSourceId}_bottom_end`,
          `${baseSourceId}_left`, `${baseSourceId}_left_start`, `${baseSourceId}_left_end`,
        ];
        if (!(valid.includes(sourceId) && valid.includes(targetId) && sourceId !== targetId)) {
          sourceId = `${baseSourceId}_top_end`;
          targetId = `${baseTargetId}_right_start`;
        }
      } else {
        const isSourceSpecificPort = /_((top|bottom|left|right)(_start|_end)?)$/.test(fOutputId);
        const isTargetSpecificPort = /_((top|bottom|left|right)(_start|_end)?)$/.test(fInputId);

        if (isSourceSpecificPort && isTargetSpecificPort) {
          sourceId = fOutputId;
          targetId = fInputId;
        } else {
          const optimal = this.layoutService.getOptimalConnectorId(sourceNode, targetNode);
          sourceId = isSourceSpecificPort ? fOutputId : optimal.sourceId;
          targetId = isTargetSpecificPort ? fInputId : optimal.targetId;
        }
      }
    }

    const messages =
      isSeqRel && sourceNode && targetNode
        ? (generateNextSequenceMessage || this.generateNextSequenceMessage.bind(this))(
            sourceNode,
            targetNode,
            relType === 'reply',
          )
        : undefined;

    return {
      newConnection: this.layoutService.buildNewConnection({
        sourceNode: sourceNode || ({ id: baseSourceId } as UmlClassNode),
        targetNode: targetNode || ({ id: baseTargetId } as UmlClassNode),
        relType,
        sourceId,
        targetId,
        defaultLineStyle,
        activeDiagramType,
        messages,
      }),
      isSeqRel,
    };
  }

  /**
   * Crea una clase de asociación intermedia conectada a la línea entre `sourceNode` y `targetNode`.
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
   * Reasigna el puerto de origen o destino de una conexión existente.
   */
  processReassignConnection(
    list: UmlConnection[],
    event: { connectionId: string; nextSourceId?: string; nextTargetId?: string },
    activeDiagramType: DiagramType,
  ): { updatedList: UmlConnection[]; isOccupied?: boolean } {
    let isOccupied = false;

    const updatedList = list.map((c) => {
      if (c.id !== event.connectionId) return c;
      let sId = event.nextSourceId || c.sourceId;
      let tId = event.nextTargetId || c.targetId;
      if (isSequenceConnectionLogic(c, activeDiagramType)) {
        const sMatch = event.nextSourceId?.match(/_slot_(\d+)$/);
        const tMatch = event.nextTargetId?.match(/_slot_(\d+)$/);
        const slotNum = sMatch ? sMatch[1] : tMatch ? tMatch[1] : null;
        if (slotNum !== null) {
          if (this.layoutService.isSequenceSlotOccupied(list, parseInt(slotNum, 10), activeDiagramType, event.connectionId)) {
            isOccupied = true;
            return c;
          }
          const baseSrc = ConnectionCascadeUtil.extractBaseNodeId(sId);
          const baseTgt = ConnectionCascadeUtil.extractBaseNodeId(tId);
          sId = `${baseSrc}_slot_${slotNum}`;
          tId = `${baseTgt}_slot_${slotNum}`;
        }
      }
      return { ...c, sourceId: sId, targetId: tId };
    });

    return { updatedList, isOccupied };
  }

  /** Invierte la dirección de una conexión delegando en `ConnectionCascadeUtil`. */
  reverseConnection(conn: UmlConnection): UmlConnection {
    return ConnectionCascadeUtil.reverseConnection(conn);
  }

  /** Calcula los nodos y conexiones que deben eliminarse en cascada al borrar una conexión. */
  computeCascadeDelete(
    connId: string,
    nodes: UmlClassNode[],
    connections: UmlConnection[],
  ): { connsToDelete: Set<string>; nodesToDelete: Set<string> } {
    return ConnectionCascadeUtil.computeCascadeDelete(connId, nodes, connections);
  }

  /** Ejecuta la eliminación en cascada de una conexión y retorna las listas resultantes. */
  executeCascadeDeleteConnection(
    connId: string,
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    recalculateSequenceNumbers: (conns: UmlConnection[]) => UmlConnection[],
  ): { remainingNodes: UmlClassNode[]; remainingConnections: UmlConnection[] } {
    const { connsToDelete, nodesToDelete } = this.computeCascadeDelete(connId, nodes, connections);
    const remainingNodes = nodesToDelete.size > 0 ? nodes.filter((n) => !nodesToDelete.has(n.id)) : nodes;
    const remainingConnections = recalculateSequenceNumbers(
      connections.filter((c) => !connsToDelete.has(c.id)),
    );
    return { remainingNodes, remainingConnections };
  }

  /** Guarda y procesa la conexión editada. */
  saveEditedConnection(
    connections: UmlConnection[],
    savedConn: UmlConnection,
    activeDiagramType: DiagramType,
    normalizeUmlMessage?: (m: any, defaultSeq?: string) => UmlMessage,
  ): { updatedConnections: UmlConnection[]; isSeq: boolean } {
    const { isSeq, prepared } = this.prepareSavedEditedConnection(savedConn, activeDiagramType, normalizeUmlMessage);
    const updatedConnections = connections.map((c) =>
      c.id === prepared.id
        ? { ...prepared, messages: prepared.messages ? [...prepared.messages] : undefined }
        : c,
    );
    return { updatedConnections, isSeq };
  }

  /** Prepara la conexión editada antes de persistir. */
  prepareSavedEditedConnection(
    edited: UmlConnection,
    activeDiagramType: DiagramType,
    normalizeUmlMessage?: (m: any, defaultSeq?: string) => UmlMessage,
  ): { isSeq: boolean; prepared: UmlConnection } {
    return ConnectionCascadeUtil.prepareSavedEditedConnection(edited, activeDiagramType, normalizeUmlMessage);
  }

  /** Determina si una conexión toca al nodo actualmente seleccionado. */
  isConnectionSelected(connId: string, connections: UmlConnection[], selectedNodeId: string | null): boolean {
    return ConnectionCascadeUtil.isConnectionSelected(connId, connections, selectedNodeId);
  }

  /** Determina si una conexión debe verse atenuada respecto a la selección. */
  isConnectionDimmed(
    connId: string,
    connections: UmlConnection[],
    selectedNodeId: string | null,
    hasMultipleSelected: boolean,
  ): boolean {
    return ConnectionCascadeUtil.isConnectionDimmed(connId, connections, selectedNodeId, hasMultipleSelected);
  }

  /** Determina si el diamante UML debe dibujarse en el inicio de la relación. */
  isDiamondAtStart(conn: UmlConnection): boolean {
    return ConnectionCascadeUtil.isDiamondAtStart(conn);
  }

  /** Invierte la dirección de una conexión en edición. */
  swapConnectionDirection(c: UmlConnection): void {
    ConnectionCascadeUtil.swapConnectionDirection(c);
  }

  /** Determina si un nodo es vecino inmediato del nodo seleccionado. */
  isNeighborNode(
    nodeId: string,
    connections: UmlConnection[],
    selectedNodeId: string | null,
    hasMultipleSelected: boolean,
  ): boolean {
    return ConnectionCascadeUtil.isNeighborNode(nodeId, connections, selectedNodeId, hasMultipleSelected);
  }

  /** Procesa la creación de conexiones al hacer clic de nodo a nodo (modo dos clics). */
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
      return currentSource === targetNodeId
        ? { error: 'Las clases de asociación conectan dos tablas distintas.' }
        : { isAssocClass: true };
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

    const messages = isSeqRel
      ? (generateNextSequenceMessage || this.generateNextSequenceMessage.bind(this))(
          sourceNode,
          targetNode,
          activeRel === 'reply',
        )
      : undefined;

    return {
      newConn: this.layoutService.buildNewConnection({
        sourceNode,
        targetNode,
        relType: activeRel,
        sourceId,
        targetId,
        defaultLineStyle,
        activeDiagramType,
        messages,
      }),
      isSeqRel,
    };
  }

  /** Genera un mensaje de secuencia autoincremetal por defecto. */
  generateNextSequenceMessage(
    sourceNode?: UmlClassNode,
    targetNode?: UmlClassNode,
    isReturn = false,
  ): UmlMessage[] {
    return generateNextSequenceMessageLogic(sourceNode, targetNode, isReturn);
  }

  /** Maneja el ciclo completo del evento `onTableClick`. */
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
      this.lastSourceSetTimestamp = Date.now();
      options.setSourceNodeId(nodeId);
      options.onMouseMove(event);
      return;
    }

    // Prevenir auto-conexión por doble disparo de eventos en el mismo tick de clic
    if (options.currentSource === nodeId && Date.now() - this.lastSourceSetTimestamp < 350) {
      return;
    }
    this.lastSourceSetTimestamp = 0;

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
        options.onApplyAssociationClass(
          this.createAssociationClassBetween(sourceNode, targetNode, options.nodes, options.connections),
        );
      }
      return;
    }

    if (result.newConn) {
      options.onApplyNewConnection(result.newConn, !!result.isSeqRel);
    }
  }

  /** Maneja el ciclo completo del evento `onConnectionCreated`. */
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
    const sourceId = event.sourceId || event.fOutputId;
    const targetId = event.targetId || event.fInputId;
    if (options.isReadOnly || !sourceId || !targetId) return;

    const result = this.processCreateConnection({
      fOutputId: sourceId,
      fInputId: targetId,
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

  /** Maneja el evento `onConnectionReassigned`. */
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
      this.toastService?.warning(
        '⚠️ No se pueden colocar dos mensajes en la misma posición temporal (fila colineal).',
      );
      return;
    }
    options.onApplyReassigned(updatedList);
  }

  /** Maneja el evento `onSequenceMessageMove`. */
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
