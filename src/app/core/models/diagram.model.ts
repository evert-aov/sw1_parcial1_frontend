export type UmlRelationshipType =
  | 'association'
  | 'generalization'
  | 'realization'
  | 'composition'
  | 'aggregation'
  | 'dependency'
  | 'association_class';

export type UmlLineStyle = 'segment' | 'straight' | 'bezier' | 'adaptive-curve';

export interface UmlAttribute {
  name: string;
  type: string;
  orderIndex?: number;
}

export interface UmlMethod {
  name: string;
  parameters: string;
  returnType: string;
  orderIndex?: number;
}

export interface UmlClassNode {
  id: string;
  name: string;
  position: { x: number; y: number };
  width: number;
  height?: number;
  attributes: UmlAttribute[];
  methods: UmlMethod[];
  isAnchor?: boolean;
  assocMainConnId?: string;
}

export interface UmlConnection {
  id: string;
  from: string;
  to: string;
  sourceId: string;
  targetId: string;
  type: UmlRelationshipType;
  lineStyle?: UmlLineStyle;
  name?: string;
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
  assocAnchorNodeId?: string;
}

export interface DiagramDto {
  id: string;
  projectId: string | null;
  name: string;
  version: string;
  defaultLineStyle: UmlLineStyle;
  nodes: {
    id: string;
    name: string;
    positionX: number;
    positionY: number;
    width?: number;
    height?: number | null;
    isAnchor?: boolean;
    assocMainConnId?: string | null;
    attributes?: UmlAttribute[];
    methods?: UmlMethod[];
  }[];
  connections: {
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    sourceId: string;
    targetId: string;
    type: string;
    lineStyle?: string;
    name?: string | null;
    sourceMultiplicity?: string;
    targetMultiplicity?: string;
    assocAnchorNodeId?: string | null;
  }[];
  updatedAt: string;
  createdAt: string;
}

export interface SaveDiagramAstRequest {
  defaultLineStyle?: UmlLineStyle;
  nodes: {
    id: string;
    name: string;
    positionX: number;
    positionY: number;
    width?: number;
    height?: number | null;
    isAnchor?: boolean;
    assocMainConnId?: string | null;
    attributes?: UmlAttribute[];
    methods?: UmlMethod[];
  }[];
  connections: {
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    sourceId: string;
    targetId: string;
    type: string;
    lineStyle?: string;
    name?: string | null;
    sourceMultiplicity?: string;
    targetMultiplicity?: string;
    assocAnchorNodeId?: string | null;
  }[];
}
