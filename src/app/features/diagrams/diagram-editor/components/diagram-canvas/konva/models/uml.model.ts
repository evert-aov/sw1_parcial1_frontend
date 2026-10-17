export type DiagramType = 'class' | 'use_case' | 'communication' | 'sequence' | 'deployment';

export type UmlNodeType =
  | 'class'
  | 'actor'
  | 'use_case'
  | 'boundary'
  | 'control'
  | 'entity'
  | 'lifeline'
  | 'deployment_node';

export type UmlRelationType =
  | 'association'
  | 'generalization'
  | 'composition'
  | 'aggregation'
  | 'dependency'
  | 'trace'
  | 'sync_message'
  | 'return_message';

export interface UmlClassAttribute {
  id: string;
  visibility: '-' | '+' | '#' | '~';
  name: string;
  type: string;
}

export interface UmlClassMethod {
  id: string;
  visibility: '-' | '+' | '#' | '~';
  name: string;
  params: string;
  returnType: string;
}

export interface UmlMessageItem {
  id: string;
  sequenceNumber: string; // e.g. "1", "1.1", "2.1"
  name: string;           // e.g. "createProject(data)"
  direction: 'forward' | 'backward';
  color?: string;         // e.g. "#1F2937", "#991B1B", "#166534"
}

export interface ActivationBox {
  id: string;
  startY: number;
  height: number;
}

export interface UmlNode {
  id: string;
  type: UmlNodeType;
  name: string;
  stereotype?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  // Specific to Class Node
  attributes?: UmlClassAttribute[];
  methods?: UmlClassMethod[];
  // Specific to Lifeline Node
  isActorLifeline?: boolean;
  activations?: ActivationBox[];
}

export interface UmlRelationship {
  id: string;
  type: UmlRelationType;
  sourceId: string;
  targetId: string;
  name?: string;            // e.g. "crea", "miembros", or sequence message "1: createProject(data)"
  stereotype?: string;      // e.g. "«include»", "«extend»", "«trace»", "«HTTP/TLS»"
  sourceMultiplicity?: string; // e.g. "1", "0..*"
  targetMultiplicity?: string; // e.g. "0..*", "1..*"
  yOffset?: number;         // For Sequence diagram message vertical position
  messageColor?: string;    // Color of sequence message or communication message
  messages?: UmlMessageItem[]; // List of messages for Communication & Deployment links
}

export interface UmlDiagramPreset {
  id: DiagramType;
  title: string;
  subtitle: string;
  nodes: UmlNode[];
  relationships: UmlRelationship[];
}
