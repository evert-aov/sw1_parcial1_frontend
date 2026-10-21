import { InjectionToken, inject } from '@angular/core';
import { PluginRegistryService } from '../plugin-registry.service';
import { DiagramType, UmlClassNode, UmlConnection, UmlMessage } from '../../models/diagram.model';
export interface ConnectionCascadeUtil {
  extractBaseNodeId(id: string | null | undefined): string;
  reverseConnection(conn: UmlConnection): UmlConnection;
  swapConnectionDirection(c: UmlConnection): void;
  computeCascadeDelete(
    connId: string,
    nodes: UmlClassNode[],
    connections: UmlConnection[],
  ): {
    connsToDelete: Set<string>;
    nodesToDelete: Set<string>;
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
  isNeighborNode(
    nodeId: string,
    connections: UmlConnection[],
    selectedNodeId: string | null,
    hasMultipleSelected: boolean,
  ): boolean;
}
export const ConnectionCascadeUtil: InjectionToken<ConnectionCascadeUtil> =
  new InjectionToken<ConnectionCascadeUtil>('ConnectionCascadeUtil', {
    providedIn: 'root',
    factory: () => inject(PluginRegistryService).resolve(ConnectionCascadeUtil),
  });
