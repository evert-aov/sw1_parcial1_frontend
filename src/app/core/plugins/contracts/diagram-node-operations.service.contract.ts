import { InjectionToken, inject } from '@angular/core';
import { PluginRegistryService } from '../plugin-registry.service';
import {
  DiagramType,
  UmlClassNode,
  UmlConnection,
  UmlStereotype,
} from '../../models/diagram.model';
import { DiagramClipboardService } from './diagram-clipboard.service.contract';
export interface DropNodePayload {
  type: 'toolbox_node' | 'explorer_node';
  nodeType?: string;
  stereotype?: UmlStereotype | string | null;
  nodeData?: UmlClassNode;
  node?: UmlClassNode;
  sourceDiagramId?: string;
  sourceDiagramType?: DiagramType;
}
export interface DiagramNodeOperationsService {
  computeCascadeDeleteNode(
    nodeId: string,
    nodes: UmlClassNode[],
    connections: UmlConnection[],
  ): {
    nodesToDelete: Set<string>;
    connsToDelete: Set<string>;
  };
  executeCascadeDeleteNode(
    nodeId: string,
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    selectedNodeId: string | null,
    recalculateSequenceNumbers: (conns: UmlConnection[]) => UmlConnection[],
  ): {
    remainingNodes: UmlClassNode[];
    remainingConnections: UmlConnection[];
    nextSelectedNodeId: string | null;
  };
  saveEditedNode(
    nodes: UmlClassNode[],
    savedNode: UmlClassNode,
    activeDiagramType: DiagramType,
  ): UmlClassNode[];
  createNode(
    type: string,
    params: {
      nodes: UmlClassNode[];
      activeDiagramType: DiagramType;
      position?: {
        x: number;
        y: number;
      };
      stereotype?: UmlStereotype | string | null;
      scrollOffset?: {
        scrollLeft: number;
        scrollTop: number;
      };
    },
  ): UmlClassNode;
  createValidatedNode(
    type: string,
    params: {
      isReadOnly: boolean;
      activeDiagramType: DiagramType;
      nodes: UmlClassNode[];
      position?: {
        x: number;
        y: number;
      };
      stereotype?: UmlStereotype | string | null;
      scrollOffset: {
        scrollLeft: number;
        scrollTop: number;
      };
      onIncompatible: (currentType: DiagramType) => void;
    },
  ): UmlClassNode | null;
  getNodeTypeReadableLabel(nodeType?: string): string;
  updateNodesColor(
    nodes: UmlClassNode[],
    targetIds: string[],
    color: string | null,
  ): {
    anyChanged: boolean;
    updatedNodes: UmlClassNode[];
  };
  renameNode(
    nodes: UmlClassNode[],
    nodeId: string,
    newName: string,
  ): {
    anyChanged: boolean;
    updatedNodes: UmlClassNode[];
  };
  sanitizeNodeStereotype(savedNode: UmlClassNode, activeDiagramType: DiagramType): UmlClassNode;
  validateNodeAddition(
    nodeType: string,
    currentType: DiagramType,
  ): {
    allowed: boolean;
    redirectType?: string;
  };
  updateNodeSize(
    nodes: UmlClassNode[],
    event: {
      node: UmlClassNode;
      width: number;
      height?: number;
      position: {
        x: number;
        y: number;
      };
    },
  ): UmlClassNode[];
  updateNodeLabelOffset(
    nodes: UmlClassNode[],
    nodeId: string,
    offset: {
      x: number;
      y: number;
    },
  ): UmlClassNode[];
  handleNodeDropped(
    event: {
      payload: DropNodePayload;
      position: {
        x: number;
        y: number;
      };
    },
    handlers: {
      isReadOnly: boolean;
      onDropToolbox: (
        nodeType: string,
        position: {
          x: number;
          y: number;
        },
        stereotype?: UmlStereotype | string | null,
      ) => void;
      onCopyExplorer: (data: {
        node: UmlClassNode;
        sourceDiagramId?: string;
        sourceDiagramType?: DiagramType;
        position: {
          x: number;
          y: number;
        };
      }) => void;
    },
  ): void;
  handleSelectNodeFromExplorer(
    nodeId: string,
    nodes: UmlClassNode[],
    canvas?: any,
    onSelect?: (nodeId: string) => void,
  ): void;
}
export const DiagramNodeOperationsService: InjectionToken<DiagramNodeOperationsService> =
  new InjectionToken<DiagramNodeOperationsService>('DiagramNodeOperationsService', {
    providedIn: 'root',
    factory: () => inject(PluginRegistryService).resolve(DiagramNodeOperationsService),
  });
