import { InjectionToken, inject } from '@angular/core';
import {
  DiagramType,
  UmlClassNode,
  UmlConnection,
  UmlAttribute,
  UmlMessage,
  UmlRelationshipType,
} from '../../models/diagram.model';
import { PluginRegistryService } from '../plugin-registry.service';
export interface RelationshipRules {
  isBceNodeType(nodeType?: string): boolean;
  validateRobustnessConnection(
    sourceNodeType: string,
    targetNodeType: string,
  ): {
    isValid: boolean;
    warning?: string;
  };
  formatPackageRelation(relType: UmlRelationshipType | string): string | undefined;
  isPackageNode(nodeType?: string): boolean;
  isDeploymentNode(nodeType?: string): boolean;
  getDeploymentStereotypeLabel(nodeType?: string): string;
  formatUseCaseRelation(relType: UmlRelationshipType | string): string | undefined;
  isSystemBoundaryBox(nodeType?: string, nodeId?: string): boolean;
  sanitizeBoundaryBoxName(name?: string): string;
  isActorNode(node?: UmlClassNode | null): boolean;
  getActorBottomExtra(node: UmlClassNode): number;
  getEntityFk(node: UmlClassNode): {
    name: string;
    type: string;
  };
  buildAssociationClassElements(
    sourceNode: UmlClassNode,
    targetNode: UmlClassNode,
    timestamp?: number,
  ): {
    anchorNode: UmlClassNode;
    assocNode: UmlClassNode;
    mainConnection: UmlConnection;
    dashedConnection: UmlConnection;
  };
  createAssociationClassBetween(
    sourceNode: UmlClassNode,
    targetNode: UmlClassNode,
    currentNodes: UmlClassNode[],
    currentConns: UmlConnection[],
  ): {
    nodes: UmlClassNode[];
    connections: UmlConnection[];
  };
  isClassLikeNode(nodeType?: string): boolean;
  isComponentNode(nodeType?: string): boolean;
  getComponentDimensions(node: UmlClassNode): {
    width: number;
    height: number;
  };
  isSequenceRelationshipType(type?: string | null): boolean;
  isSequenceConnection(
    conn:
      | {
          type?: string | null;
        }
      | string
      | null
      | undefined,
    activeDiagramType?: DiagramType | null,
  ): boolean;
  getSequenceMessageColor(sequenceNumber?: string | null): string;
  generateNextSequenceMessage(
    sourceNode?: UmlClassNode,
    targetNode?: UmlClassNode,
    isReturn?: boolean,
  ): UmlMessage[];
  findNextAvailableSlot(connections: UmlConnection[]): string;
  isSequenceSlotOccupied(
    connections: UmlConnection[],
    targetSlotNum: number,
    activeDiagramType: DiagramType,
    ignoreConnectionId?: string,
  ): boolean;
  computeSequenceMessageMove(
    conns: UmlConnection[],
    connectionId: string,
    targetSlot: number,
    activeDiagramType: DiagramType,
  ): UmlConnection[];
  recalculateSequenceNumbers(
    connectionsList: UmlConnection[],
    nodes: UmlClassNode[],
    activeDiagramType: DiagramType,
    preserveSequenceNumbers?: boolean,
  ): UmlConnection[];
}
export const RELATIONSHIP_RULES: InjectionToken<RelationshipRules> =
  new InjectionToken<RelationshipRules>('Relationship rules', {
    providedIn: 'root',
    factory: () => inject(PluginRegistryService).resolve(RELATIONSHIP_RULES),
  });
