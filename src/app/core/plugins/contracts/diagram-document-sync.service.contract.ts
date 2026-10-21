import { InjectionToken, inject } from '@angular/core';
import { PluginRegistryService } from '../plugin-registry.service';
import {
  DiagramType,
  UmlClassNode,
  UmlConnection,
  UmlLineStyle,
  UmlMessage,
} from '../../models/diagram.model';
export interface DiagramDocumentSyncService {
  precalculateAnchorPositions(
    cleanNodes: UmlClassNode[],
    targetConns: UmlConnection[],
    getOptimalConnectorId: (
      sourceNode: UmlClassNode,
      targetNode: UmlClassNode,
    ) => {
      sourceId: string;
      targetId: string;
    },
    getConnectorPoint: (
      node: UmlClassNode,
      side: string,
    ) => {
      x: number;
      y: number;
    },
  ): void;
  schedulePostMutationRedraw(callbacks: {
    updateEndpoints: () => void;
    resetCanvas?: () => void;
    fitView?: () => void;
    redrawCanvas?: () => void;
  }): void;
  processDocumentMutation(params: {
    targetNodes: any[];
    targetConns: any[];
    activeDiagramType: DiagramType;
    defaultLineStyle: UmlLineStyle;
    getDefaultColorForNodeType: (nodeType?: string | null, stereotype?: string | null) => string;
    getOptimalConnectorId: (
      sourceNode: UmlClassNode,
      targetNode: UmlClassNode,
    ) => {
      sourceId: string;
      targetId: string;
    };
    getConnectorPoint: (
      node: UmlClassNode,
      side: string,
    ) => {
      x: number;
      y: number;
    };
    recalculateSequenceNumbers: (conns: UmlConnection[], preserve?: boolean) => UmlConnection[];
  }): {
    cleanNodes: UmlClassNode[];
    cleanConns: UmlConnection[];
  };
  normalizeDataType(type: string): string;
  normalizeReturnType(type: string): string;
  normalizeUmlMessage(m: any, defaultSeq?: string): UmlMessage;
  normalizeIncomingNodes(
    targetNodes: any[],
    getDefaultColor: (nodeType?: string | null, stereotype?: string | null) => string,
  ): UmlClassNode[];
  sanitizeClientConnections(
    conns: any[],
    validNodes: UmlClassNode[],
    activeDiagramType: DiagramType,
    defaultLineStyle?: UmlLineStyle,
    recalculateSeqNumbers?: (conns: UmlConnection[], preserveOrder?: boolean) => UmlConnection[],
  ): UmlConnection[];
}
export const DiagramDocumentSyncService: InjectionToken<DiagramDocumentSyncService> =
  new InjectionToken<DiagramDocumentSyncService>('DiagramDocumentSyncService', {
    providedIn: 'root',
    factory: () => inject(PluginRegistryService).resolve(DiagramDocumentSyncService),
  });
