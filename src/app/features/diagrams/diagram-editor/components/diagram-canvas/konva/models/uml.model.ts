export type DiagramType =
  | 'class'
  | 'component'
  | 'activity'
  | 'use_case'
  | 'communication'
  | 'sequence'
  | 'deployment'
  | 'package'
  | 'layered'
  | 'class_analysis';

export type UmlNodeType =
  | 'class'
  | 'actor'
  | 'use_case'
  | 'boundary'
  | 'control'
  | 'entity'
  | 'lifeline'
  | 'deployment_node'
  | 'component'
  | 'package'
  | 'package_layer'
  | 'activity_initial'
  | 'activity_final'
  | 'activity_action'
  | 'activity_decision'
  | 'activity_fork'
  | 'note'; // Nodo tipo Nota UML 2.5 (rectángulo con esquina superior derecha doblada)

export type UmlRelationType =
  | 'association'
  | 'association_class' // Clase de Asociación UML 2.5 (Relación N:M con línea punteada al centro hacia una Clase)
  | 'generalization'
  | 'composition'
  | 'aggregation'
  | 'dependency'
  | 'trace'
  | 'sync_message'
  | 'return_message'
  | 'assembly'      // Conector de ensamblaje (Interfaz requerida ──(◯── Interfaz provista)
  | 'control_flow'  // Flujo de control de Diagrama de Actividad (con soporte de [Guard])
  | 'note_anchor';  // Línea punteada de anclaje de Nota UML (- - -)

export type UmlLineStyle =
  | 'direct'
  | 'auto_routing'
  | 'custom'
  | 'bezier'
  | 'tree_vertical'
  | 'tree_horizontal'
  | 'lateral_vertical'
  | 'lateral_horizontal'
  | 'orthogonal_square'
  | 'orthogonal_rounded'
  | 'segment'
  | 'straight'
  | 'adaptive-curve';

export interface LineStyleOption {
  id: UmlLineStyle;
  label: string;
  shortcut?: string;
  group: 'primary' | 'tree' | 'lateral' | 'orthogonal';
}

export const LINE_STYLE_OPTIONS: LineStyleOption[] = [
  { id: 'direct', label: 'Direct', shortcut: 'Control+Shift+D', group: 'primary' },
  { id: 'auto_routing', label: 'Auto Routing', shortcut: 'Control+Shift+A', group: 'primary' },
  { id: 'custom', label: 'Custom Line', shortcut: 'Control+Shift+C', group: 'primary' },
  { id: 'bezier', label: 'Bezier', group: 'primary' },
  { id: 'tree_vertical', label: 'Tree Style - Vertical', group: 'tree' },
  { id: 'tree_horizontal', label: 'Tree Style - Horizontal', group: 'tree' },
  { id: 'lateral_vertical', label: 'Lateral - Vertical', group: 'lateral' },
  { id: 'lateral_horizontal', label: 'Lateral - Horizontal', group: 'lateral' },
  { id: 'orthogonal_square', label: 'Orthogonal - Square', group: 'orthogonal' },
  { id: 'orthogonal_rounded', label: 'Orthogonal - Rounded', group: 'orthogonal' },
];

export type StudioInteractionMode = 'select' | 'pan' | 'connect';

export type InspectorDockPosition = 'right' | 'left' | 'bottom' | 'floating';

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
  isCustomSize?: boolean;
  customWidth?: number;
  customHeight?: number;
  // Specific to Lifeline Node
  isActorLifeline?: boolean;
  activations?: ActivationBox[];
}

export interface UmlRelationship {
  id: string;
  type: UmlRelationType;
  sourceId: string;
  targetId: string;
  associationClassNodeId?: string;        // ID of the Class node attached to the midpoint of this association (Association Class N:M)
  lineStyle?: UmlLineStyle;               // Routing style ('direct' | 'auto_routing' | 'custom' | 'bezier' | 'tree_vertical' | ...)
  waypoints?: { x: number; y: number }[]; // Custom bend points for 'custom' lineStyle
  name?: string;                          // e.g. "crea", "[Guard A]", or sequence message "1: createProject(data)"
  stereotype?: string;                    // e.g. "«include»", "«extend»", "«trace»", "«HTTP/TLS»"
  sourceMultiplicity?: string;            // e.g. "1", "0..*"
  targetMultiplicity?: string;            // e.g. "0..*", "1..*"
  yOffset?: number;                       // For Sequence diagram message vertical position
  messageColor?: string;                  // Color of sequence message or communication message
  messages?: UmlMessageItem[];            // List of messages for Communication & Deployment links
}

export interface UmlDiagramPreset {
  id: DiagramType;
  title: string;
  subtitle: string;
  nodes: UmlNode[];
  relationships: UmlRelationship[];
}

export interface NodeToolMetadata {
  type: UmlNodeType;
  label: string;
  subtitle: string;
  icon: string;
}

export interface RelationToolMetadata {
  type: UmlRelationType;
  label: string;
  badge: string;
}
