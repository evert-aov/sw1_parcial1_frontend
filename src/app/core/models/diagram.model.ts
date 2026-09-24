export type DiagramType = 'class' | 'use_case' | 'communication' | 'sequence' | 'package';

export interface DiagramTypeItem {
  id: DiagramType;
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
  supported: boolean;
}

export const UML_DIAGRAM_TYPES: DiagramTypeItem[] = [
  { id: 'class', label: 'Diagrama de Clases', shortLabel: 'Clases', icon: 'heroSquare3Stack3d', description: 'Estructura estática, atributos, métodos y relaciones UML 2.5', supported: true },
  { id: 'use_case', label: 'Casos de Uso', shortLabel: 'Casos Uso', icon: 'heroUserGroup', description: 'Actores, casos de uso, relaciones include/extend y límites del sistema', supported: false },
  { id: 'sequence', label: 'Secuencia', shortLabel: 'Secuencia', icon: 'heroArrowsUpDown', description: 'Líneas de vida temporales, mensajes y activación de procesos', supported: false },
  { id: 'communication', label: 'Comunicación', shortLabel: 'Comunicación', icon: 'heroChatBubbleLeftRight', description: 'Interacción entre objetos con mensajes numerados secuenciales', supported: false },
  { id: 'package', label: 'Paquetes', shortLabel: 'Paquetes', icon: 'heroFolderOpen', description: 'Organización de módulos, capas y dependencias arquitectónicas', supported: false },
];

export type UmlRelationshipType =
  | 'association'
  | 'generalization'
  | 'realization'
  | 'composition'
  | 'aggregation'
  | 'dependency'
  | 'association_class';

export type UmlLineStyle = 'segment' | 'straight' | 'bezier' | 'adaptive-curve';

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
  { id: 'association', label: 'Association', icon: '───', description: 'Relación estructural simple entre dos clases' },
  { id: 'generalization', label: 'Generalization', icon: '─▷', description: 'Herencia: la subclase hereda de la superclase' },
  { id: 'composition', label: 'Composition', icon: '◆──', description: 'Pertenencia fuerte del todo a las partes' },
  { id: 'aggregation', label: 'Aggregation', icon: '◇──', description: 'Pertenencia débil o contenedor independiente' },
  { id: 'dependency', label: 'Dependency', icon: '┈>', description: 'Uso temporal o dependencia débil' },
  { id: 'association_class', label: 'Association Class', icon: '─*─┄[C]', description: 'Relación muchos a muchos con clase intermedia' },
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
