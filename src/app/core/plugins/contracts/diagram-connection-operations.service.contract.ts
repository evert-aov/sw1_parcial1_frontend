import { InjectionToken, inject } from '@angular/core';
import { PluginRegistryService } from '../plugin-registry.service';
import { FCreateConnectionEvent, FReassignConnectionEvent } from '@foblex/flow';
import { ToastService } from '../../services/toast.service';
import {
  DiagramType,
  UmlClassNode,
  UmlConnection,
  UmlLineStyle,
  UmlMessage,
  UmlRelationshipType,
} from '../../models/diagram.model';
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
export interface DiagramConnectionOperationsService {
  processCreateConnection(params: CreateConnectionParams): CreateConnectionResult;
  createAssociationClassBetween(
    sourceNode: UmlClassNode,
    targetNode: UmlClassNode,
    currentNodes: UmlClassNode[],
    currentConns: UmlConnection[],
  ): {
    nodes: UmlClassNode[];
    connections: UmlConnection[];
  };
  processReassignConnection(
    list: UmlConnection[],
    event: {
      connectionId: string;
      nextSourceId?: string;
      nextTargetId?: string;
    },
    activeDiagramType: DiagramType,
  ): {
    updatedList: UmlConnection[];
    isOccupied?: boolean;
  };
  reverseConnection(conn: UmlConnection): UmlConnection;
  computeCascadeDelete(
    connId: string,
    nodes: UmlClassNode[],
    connections: UmlConnection[],
  ): {
    connsToDelete: Set<string>;
    nodesToDelete: Set<string>;
  };
  executeCascadeDeleteConnection(
    connId: string,
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    recalculateSequenceNumbers: (conns: UmlConnection[]) => UmlConnection[],
  ): {
    remainingNodes: UmlClassNode[];
    remainingConnections: UmlConnection[];
  };
  saveEditedConnection(
    connections: UmlConnection[],
    savedConn: UmlConnection,
    activeDiagramType: DiagramType,
    normalizeUmlMessage?: (m: any, defaultSeq?: string) => UmlMessage,
  ): {
    updatedConnections: UmlConnection[];
    isSeq: boolean;
  };
  prepareSavedEditedConnection(
    edited: UmlConnection,
    activeDiagramType: DiagramType,
    normalizeUmlMessage?: (m: any, defaultSeq?: string) => UmlMessage,
  ): {
    isSeq: boolean;
    prepared: UmlConnection;
  };
  isConnectionSelected(
    connId: string,
    connections: UmlConnection[],
    selectedNodeId: string | null,
  ): boolean;
  isConnectionDimmed(
    connId: string,
    connections: UmlConnection[],
    selectedNodeId: string | null,
    hasMultipleSelected: boolean,
  ): boolean;
  isDiamondAtStart(conn: UmlConnection): boolean;
  swapConnectionDirection(c: UmlConnection): void;
  isNeighborNode(
    nodeId: string,
    connections: UmlConnection[],
    selectedNodeId: string | null,
    hasMultipleSelected: boolean,
  ): boolean;
  processTableClickConnection(params: {
    currentSource: string;
    targetNodeId: string;
    activeRel: UmlRelationshipType;
    activeDiagramType: DiagramType;
    nodes: UmlClassNode[];
    connections: UmlConnection[];
    defaultLineStyle: UmlLineStyle;
    getOptimalConnectorId: (
      sourceNode: UmlClassNode,
      targetNode: UmlClassNode,
    ) => {
      sourceId: string;
      targetId: string;
    };
    generateNextSequenceMessage?: (
      sourceNode: UmlClassNode,
      targetNode: UmlClassNode,
      isReturn: boolean,
    ) => UmlMessage[];
  }): {
    isAssocClass?: boolean;
    newConn?: UmlConnection;
    isSeqRel?: boolean;
    error?: string;
  };
  generateNextSequenceMessage(
    sourceNode?: UmlClassNode,
    targetNode?: UmlClassNode,
    isReturn?: boolean,
  ): UmlMessage[];
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
      getOptimalConnectorId: (
        sourceNode: UmlClassNode,
        targetNode: UmlClassNode,
      ) => {
        sourceId: string;
        targetId: string;
      };
      generateNextSequenceMessage: (
        sourceNode: UmlClassNode,
        targetNode: UmlClassNode,
        isReturn: boolean,
      ) => UmlMessage[];
      onApplyNewConnection: (newConn: UmlConnection, isSeqRel: boolean) => void;
      onApplyAssociationClass: (assocResult: {
        nodes: UmlClassNode[];
        connections: UmlConnection[];
      }) => void;
    },
  ): void;
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
      generateNextSequenceMessage: (
        src: UmlClassNode,
        tgt: UmlClassNode,
        isReturn: boolean,
      ) => UmlMessage[];
      onApplyNewConnection: (newConn: UmlConnection, isSeqRel: boolean) => void;
      onApplyAssocClass: (result: { nodes: UmlClassNode[]; connections: UmlConnection[] }) => void;
    },
  ): void;
  handleConnectionReassigned(
    event: FReassignConnectionEvent,
    options: {
      isReadOnly: boolean;
      connections: UmlConnection[];
      activeDiagramType: DiagramType;
      onApplyReassigned: (updatedList: UmlConnection[]) => void;
    },
  ): void;
  handleSequenceMessageMove(
    event: {
      connectionId: string;
      targetSlot: number;
    },
    options: {
      isReadOnly: boolean;
      connections: UmlConnection[];
      activeDiagramType: DiagramType;
      onApplyMoved: (updatedList: UmlConnection[]) => void;
    },
  ): void;
}
export const DiagramConnectionOperationsService: InjectionToken<DiagramConnectionOperationsService> =
  new InjectionToken<DiagramConnectionOperationsService>('DiagramConnectionOperationsService', {
    providedIn: 'root',
    factory: () => inject(PluginRegistryService).resolve(DiagramConnectionOperationsService),
  });
