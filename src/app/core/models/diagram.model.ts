export enum DiagramType {
  CLASS = 'class',
  USE_CASE = 'use_case',
  SEQUENCE = 'sequence',
  COMMUNICATION = 'communication',
  PACKAGE = 'package',
}

export interface DiagramTypeItem {
  id: DiagramType;
  label: string;
  shortLabel: string;
  folderName: string;
  icon: string;
  description: string;
  supported: boolean;
}

export const UML_DIAGRAM_TYPES: DiagramTypeItem[] = [
  { id: DiagramType.CLASS, label: 'Diagrama de Clases', shortLabel: 'Clases', folderName: 'Diagramas de Clases', icon: 'heroSquare3Stack3d', description: 'Estructura estática, atributos, métodos y relaciones UML 2.5', supported: true },
  { id: DiagramType.USE_CASE, label: 'Casos de Uso', shortLabel: 'Casos Uso', folderName: 'Casos de Uso', icon: 'heroUserGroup', description: 'Actores, casos de uso, relaciones include/extend y límites del sistema', supported: true },
  { id: DiagramType.SEQUENCE, label: 'Secuencia', shortLabel: 'Secuencia', folderName: 'Diagramas de Secuencia', icon: 'heroArrowsUpDown', description: 'Líneas de vida temporales, mensajes y activación de procesos', supported: false },
  { id: DiagramType.COMMUNICATION, label: 'Comunicación', shortLabel: 'Comunicación', folderName: 'Diagramas de Comunicación', icon: 'heroChatBubbleLeftRight', description: 'Interacción entre objetos con mensajes numerados secuenciales', supported: false },
  { id: DiagramType.PACKAGE, label: 'Paquetes', shortLabel: 'Paquetes', folderName: 'Diagramas de Paquetes', icon: 'heroFolderOpen', description: 'Organización de módulos, capas y dependencias arquitectónicas', supported: true },
];

export type UmlNodeType =
  | 'class'
  | 'actor'
  | 'use_case'
  | 'package'
  | 'boundary'
  | 'control'
  | 'entity'
  | 'lifeline';

export type UmlRelationshipType =
  | 'association'
  | 'generalization'
  | 'realization'
  | 'composition'
  | 'aggregation'
  | 'dependency'
  | 'association_class'
  | 'include'
  | 'extend'
  | 'import'
  | 'access'
  | 'merge'
  | 'trace'
  | 'message';

export type UmlLineStyle = 'segment' | 'straight' | 'bezier' | 'adaptive-curve';

export type UmlMessageType = 'sync' | 'async' | 'reply' | 'create';
export type UmlMessageDirection = 'forward' | 'reverse';

export interface UmlMessage {
  id: string;
  sequenceNumber: string;
  functionName: string;
  parameters?: string;
  returnType?: string;
  isReturn?: boolean;
  type?: UmlMessageType | string;
  direction?: UmlMessageDirection | string;
  orderIndex?: number;
  positionY?: number;
  color?: string;
}

export interface UmlRelationTypeItem {
  id: UmlRelationshipType;
  label: string;
  icon: string;
  description: string;
}

export interface UmlLineStyleItem {
  id: UmlLineStyle;
  label: string;
  shortcut?: string;
}

export const UML_RELATION_TYPES: UmlRelationTypeItem[] = [
  { id: 'association', label: 'Asociación', icon: '───', description: 'Relación estructural simple entre clases.' },
  { id: 'generalization', label: 'Generalización', icon: '─▷', description: 'Herencia: la subclase hereda de la clase.' },
  { id: 'composition', label: 'Composición', icon: '◆──', description: 'Pertenencia fuerte del todo a las partes.' },
  { id: 'aggregation', label: 'Agregación', icon: '◇──', description: 'Pertenencia débil o contenedor.' },
  { id: 'dependency', label: 'Dependencia', icon: '┈>', description: 'Uso temporal o dependencia débil.' },
  { id: 'association_class', label: 'Asociación de Clases', icon: '─*─┄[C]', description: 'Relación muchos a muchos con clases.' },
];

export const UML_USE_CASE_RELATION_TYPES: UmlRelationTypeItem[] = [
  { id: 'association', label: 'Comunicación / Asociación', icon: '───', description: 'Interacción directa entre un Actor y un Caso de Uso.' },
  { id: 'include', label: '«include»', icon: '┄«include»▷', description: 'Inclusión obligatoria del comportamiento de otro caso de uso.' },
  { id: 'extend', label: '«extend»', icon: '┄«extend»▷', description: 'Extensión opcional o condicional de un caso de uso.' },
  { id: 'generalization', label: 'Generalización', icon: '─▷', description: 'Herencia entre actores o entre casos de uso.' },
  { id: 'dependency', label: 'Dependencia', icon: '┄>', description: 'Dependencia funcional entre elementos de casos de uso.' },
];

export const UML_PACKAGE_RELATION_TYPES: UmlRelationTypeItem[] = [
  { id: 'dependency', label: 'Dependencia', icon: '┈>', description: 'Dependencia débil o uso entre paquetes.' },
  { id: 'import', label: '«import»', icon: '┄«import»▷', description: 'Importación pública del contenido de un paquete.' },
  { id: 'access', label: '«access»', icon: '┄«access»▷', description: 'Importación privada del contenido de un paquete.' },
  { id: 'merge', label: '«merge»', icon: '┄«merge»▷', description: 'Fusión de definiciones complementarias de paquetes.' },
  { id: 'trace', label: '«trace»', icon: '┄«trace»▷', description: 'Trazabilidad conceptual o histórica entre paquetes.' },
  { id: 'generalization', label: 'Generalización', icon: '─▷', description: 'Especialización o herencia entre paquetes.' },
];

export const ALL_UML_RELATION_TYPES: UmlRelationTypeItem[] = [
  ...UML_RELATION_TYPES,
  { id: 'include', label: '«include»', icon: '┄«include»▷', description: 'Inclusión obligatoria del comportamiento de otro caso de uso.' },
  { id: 'extend', label: '«extend»', icon: '┄«extend»▷', description: 'Extensión opcional o condicional de un caso de uso.' },
  { id: 'import', label: '«import»', icon: '┄«import»▷', description: 'Importación pública del contenido de un paquete.' },
  { id: 'access', label: '«access»', icon: '┄«access»▷', description: 'Importación privada del contenido de un paquete.' },
  { id: 'merge', label: '«merge»', icon: '┄«merge»▷', description: 'Fusión de definiciones complementarias de paquetes.' },
  { id: 'trace', label: '«trace»', icon: '┄«trace»▷', description: 'Trazabilidad conceptual o histórica entre paquetes.' },
];


export const UML_LINE_STYLES: UmlLineStyleItem[] = [
  { id: 'segment', label: 'Custom Line (EA Default / Segmentos)', shortcut: 'Ctrl+Shift+C' },
  { id: 'straight', label: 'Direct (Directa / Recta)', shortcut: 'Ctrl+Shift+D' },
  { id: 'bezier', label: 'Bezier (Curva Suave)' },
  { id: 'adaptive-curve', label: 'Orthogonal - Rounded (Curva Adaptativa)' },
];

export const UML_MULTIPLICITY_OPTIONS: string[] = ['1', '0..1', '1..*', '0..*', '*', 'n', 'm'];

export const UML_PREDEFINED_TYPES: string[] = [
  'UUID', 'String', 'Integer', 'Long', 'Boolean', 'Double',
  'Float', 'BigDecimal', 'LocalDate', 'LocalDateTime', 'Date', 'Text', 'byte[]'
];

export const UML_PREDEFINED_RETURN_TYPES: string[] = [
  'void', 'String', 'Integer', 'Long', 'Boolean', 'Double',
  'Float', 'BigDecimal', 'LocalDate', 'LocalDateTime', 'Date', 'UUID', 'List<T>', 'Set<T>', 'byte[]'
];

export interface UmlAttribute {
  name: string;
  type: string;
  orderIndex?: number;
  nullable?: boolean;
  unique?: boolean;
  length?: number | null;
  defaultValue?: string | null;
  default?: string | null;
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
  customWidth?: number;
  customHeight?: number;
  isCustomSize?: boolean;
  color?: string | null;
  attributes: UmlAttribute[];
  methods: UmlMethod[];
  isAnchor?: boolean;
  assocMainConnId?: string;
  nodeType?: UmlNodeType;
  activations?: any[];
}

export interface UmlConnection {
  id: string;
  sourceNodeId?: string;
  targetNodeId?: string;
  sourceId: string;
  targetId: string;
  from?: string;
  to?: string;
  type: UmlRelationshipType;
  lineStyle?: UmlLineStyle;
  name?: string;
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
  assocAnchorNodeId?: string;
  messages?: UmlMessage[];
}

export interface DiagramDto {
  id: string;
  projectId: string | null;
  name: string;
  type?: DiagramType;
  version: string;
  defaultLineStyle: UmlLineStyle;
  nodes: {
    id: string;
    name: string;
    positionX: number;
    positionY: number;
    width?: number;
    height?: number | null;
    color?: string | null;
    isAnchor?: boolean;
    assocMainConnId?: string | null;
    nodeType?: UmlNodeType | string;
    activations?: any[];
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
    messages?: UmlMessage[];
  }[];
  updatedAt: string;
  createdAt: string;
}

export interface SaveDiagramAstRequest {
  type?: DiagramType;
  defaultLineStyle?: UmlLineStyle;
  nodes: {
    id: string;
    name: string;
    positionX: number;
    positionY: number;
    width?: number;
    height?: number | null;
    color?: string | null;
    isAnchor?: boolean;
    assocMainConnId?: string | null;
    nodeType?: UmlNodeType | string;
    activations?: any[];
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
    messages?: UmlMessage[];
  }[];
}
