import { InjectionToken, inject } from '@angular/core';
import { PluginRegistryService } from '../plugin-registry.service';
import { DiagramType, UmlClassNode, UmlConnection } from '../../models/diagram.model';
export interface ClipboardData {
  diagramType: DiagramType;
  nodes: UmlClassNode[];
  connections: UmlConnection[];
}
export interface PasteResult {
  newNodes: UmlClassNode[];
  newConnections: UmlConnection[];
  newPastedIds: string[];
}
export interface DiagramClipboardService {
  hasClipboardContent(): boolean;
  getClipboard(): ClipboardData | null;
  copyNodes(
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    selectedNodeIds: Set<string>,
    selectedNodeId: string | null,
    activeDiagramType: DiagramType,
  ): {
    copiedNodesCount: number;
    copiedConnsCount: number;
    sampleName: string;
  } | null;
  isPasteCompatible(clip: ClipboardData, currentType: DiagramType): boolean;
  createPastedElements(
    clip: ClipboardData,
    currentNodes: UmlClassNode[],
    currentType: DiagramType,
    targetPos?: {
      x: number;
      y: number;
    },
    scrollLeft?: number,
    scrollTop?: number,
  ): PasteResult;
  isNodeCompatibleWithDiagramType(node: any, currentType: DiagramType): boolean;
  createExplorerCopiedNode(
    node: any,
    currentType: DiagramType,
    existingNodes: UmlClassNode[],
    isCurrentDiag: boolean,
    dropPosition?: {
      x: number;
      y: number;
    },
    scrollOffset?: {
      scrollLeft: number;
      scrollTop: number;
    },
    defaultColorGetter?: (nodeType?: string | null, stereotype?: string | null) => string,
  ): UmlClassNode;
  formatCopyToast(result: {
    copiedNodesCount: number;
    copiedConnsCount: number;
    sampleName: string;
  }): string;
  formatPasteToast(newNodes: UmlClassNode[], newConnections: UmlConnection[]): string;
  executePaste(params: {
    isReadOnly: boolean;
    activeDiagramType: DiagramType;
    nodes: UmlClassNode[];
    targetPos?: {
      x: number;
      y: number;
    };
    scrollOffset: {
      scrollLeft: number;
      scrollTop: number;
    };
    onIncompatible: (currentType: DiagramType) => void;
  }): {
    newNodes: UmlClassNode[];
    newConnections: UmlConnection[];
    newPastedIds: string[];
  } | null;
  executeCopyFromExplorer(params: {
    isReadOnly: boolean;
    node: UmlClassNode;
    sourceDiagramId: string;
    currentDiagramId: string | null;
    activeDiagramType: DiagramType;
    nodes: UmlClassNode[];
    position?: {
      x: number;
      y: number;
    };
    scrollOffset: {
      scrollLeft: number;
      scrollTop: number;
    };
    getDefaultColor: (nodeType?: string | null, stereotype?: string | null) => string;
    onIncompatible: (currentType: DiagramType) => void;
  }): UmlClassNode | null;
}
export const DiagramClipboardService: InjectionToken<DiagramClipboardService> =
  new InjectionToken<DiagramClipboardService>('DiagramClipboardService', {
    providedIn: 'root',
    factory: () => inject(PluginRegistryService).resolve(DiagramClipboardService),
  });
