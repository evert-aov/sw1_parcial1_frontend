import { InjectionToken, inject } from '@angular/core';
import { PluginRegistryService } from '../plugin-registry.service';
import { DiagramType, UmlClassNode, UmlConnection } from '../../models/diagram.model';
export interface SequenceActivationInterval {
  id: string;
  top: number;
  height: number;
}
export interface DiagramSequenceActivationService {
  isReplyConnection(conn: UmlConnection): boolean;
  getMaxSequenceSlotUsed(connections: UmlConnection[]): number;
  isSequenceSlotOccupied(
    slot: number,
    connections: UmlConnection[],
    activeDiagramType?: DiagramType,
  ): boolean;
  getLifelineLength(node: UmlClassNode | undefined, connections: UmlConnection[]): number;
  getNodeActivations(
    node: UmlClassNode,
    connections: UmlConnection[],
    activeDiagramType?: DiagramType,
  ): SequenceActivationInterval[];
  sortLifelinesLeftToRight(nodes: UmlClassNode[]): UmlClassNode[];
  recalculateSequenceActivationBars(
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    activeDiagramType: DiagramType,
  ): {
    changed: boolean;
    updatedNodes: UmlClassNode[];
  };
  syncTimelineForSequenceNodes(
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    activeDiagramType: DiagramType,
  ): {
    changed: boolean;
    updatedNodes: UmlClassNode[];
  };
}
export const DiagramSequenceActivationService: InjectionToken<DiagramSequenceActivationService> =
  new InjectionToken<DiagramSequenceActivationService>('DiagramSequenceActivationService', {
    providedIn: 'root',
    factory: () => inject(PluginRegistryService).resolve(DiagramSequenceActivationService),
  });
