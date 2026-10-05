export enum DiagramType {
  CLASS = 'class',
  USE_CASE = 'use_case',
  SEQUENCE = 'sequence',
  COMMUNICATION = 'communication',
  PACKAGE = 'package',
  COMPONENT = 'component',
  DEPLOYMENT = 'deployment',
  LAYERED = 'layered',
  CLASS_ANALYSIS = 'class_analysis',
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
  { id: DiagramType.SEQUENCE, label: 'Secuencia', shortLabel: 'Secuencia', folderName: 'Diagramas de Secuencia', icon: 'heroArrowsUpDown', description: 'Líneas de vida temporales, mensajes y activación de procesos', supported: true },
  { id: DiagramType.COMMUNICATION, label: 'Comunicación', shortLabel: 'Comunicación', folderName: 'Diagramas de Comunicación', icon: 'heroChatBubbleLeftRight', description: 'Interacción entre objetos con mensajes numerados secuenciales', supported: true },
  { id: DiagramType.PACKAGE, label: 'Paquetes', shortLabel: 'Paquetes', folderName: 'Diagramas de Paquetes', icon: 'heroFolderOpen', description: 'Organización de módulos y dependencias arquitectónicas', supported: true },
  { id: DiagramType.COMPONENT, label: 'Componentes', shortLabel: 'Componentes', folderName: 'Diagramas de Componentes', icon: 'heroCpuChip', description: 'Componentes de software, subsistemas, puertos e interfaces', supported: true },
  { id: DiagramType.DEPLOYMENT, label: 'Despliegue', shortLabel: 'Despliegue', folderName: 'Diagramas de Despliegue', icon: 'heroCube', description: 'Nodos físicos, servidores, dispositivos y artefactos en la nube', supported: true },
  { id: DiagramType.LAYERED, label: 'Capas', shortLabel: 'Capas', folderName: 'Diagramas de Capas', icon: 'heroSquares2x2', description: 'Arquitectura jerárquica por capas (Presentación, Negocio, Datos)', supported: true },
  { id: DiagramType.CLASS_ANALYSIS, label: 'Análisis de Clases', shortLabel: 'Análisis Clases', folderName: 'Análisis de Clases', icon: 'heroSparkles', description: 'Diagrama de clases UML con inclusión de actores', supported: true },
];

export type UmlStereotype =
  | 'class'
  | 'entity'
  | 'control'
  | 'view'
  | 'implement'
  | 'process'
  | 'realization'
  | 'service'
  | 'specification'
  | 'subsystem'
  | 'node'
  | 'device'
  | 'executionEnvironment';

export const UML_PREDEFINED_STEREOTYPES: { value: UmlStereotype; label: string }[] = [
  { value: 'class', label: '«class»' },
  { value: 'entity', label: '«entity»' },
  { value: 'control', label: '«control»' },
  { value: 'view', label: '«view»' },
  { value: 'implement', label: '«implement»' },
  { value: 'process', label: '«process»' },
  { value: 'realization', label: '«realization»' },
  { value: 'service', label: '«service»' },
  { value: 'specification', label: '«specification»' },
  { value: 'subsystem', label: '«subsystem»' },
  { value: 'node', label: '«node»' },
  { value: 'device', label: '«device»' },
  { value: 'executionEnvironment', label: '«executionEnvironment»' },
];

export type UmlNodeType =
  | 'class'
  | 'actor'
  | 'use_case'
  | 'package'
  | 'boundary'
  | 'control'
  | 'entity'
  | 'lifeline'
  | 'component'
  | 'node'
  | 'device'
  | 'executionEnvironment'
  | 'boundary_box';

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
  | 'message'
  | 'sync'
  | 'reply'
  | 'async'
  | 'create'
  | 'self'
  | 'assembly';

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

export const UML_COMMUNICATION_RELATION_TYPES: UmlRelationTypeItem[] = [
  { id: 'association', label: 'Enlace de Comunicación', icon: '───', description: 'Enlace entre objetos que transporta mensajes numerados secuenciales.' },
];

export const UML_DEPLOYMENT_RELATION_TYPES: UmlRelationTypeItem[] = [
  { id: 'association', label: 'Asociación / Enlace', icon: '───', description: 'Canal de comunicación o enlace físico/lógico entre nodos y componentes.' },
  { id: 'generalization', label: 'Generalización', icon: '─▷', description: 'Especialización o herencia entre nodos o componentes.' },
  { id: 'realization', label: 'Realización / Manifestación', icon: '┄▷', description: 'Manifestación o despliegue de componentes y artefactos.' },
];

export const UML_COMPONENT_RELATION_TYPES: UmlRelationTypeItem[] = [
  { id: 'assembly', label: 'Ensamble (Assembly)', icon: '─(O─', description: 'Conector de ensamble entre interfaz requerida y provista.' },
  { id: 'dependency', label: 'Dependencia («use»)', icon: '┈>', description: 'Dependencia o uso entre componentes o paquetes.' },
  { id: 'association', label: 'Asociación', icon: '───', description: 'Asociación o enlace estructural entre componentes.' },
  { id: 'realization', label: 'Realización', icon: '┄▷', description: 'Realización de interfaz por un componente.' },
  { id: 'generalization', label: 'Generalización', icon: '─▷', description: 'Especialización o herencia entre componentes.' },
];

export const UML_SEQUENCE_RELATION_TYPES: UmlRelationTypeItem[] = [
  { id: 'sync', label: 'Llamada Síncrona', icon: '──►', description: 'Mensaje síncrono que bloquea la ejecución hasta que retorna.' },
  { id: 'reply', label: 'Mensaje de Retorno', icon: '┄┄>', description: 'Retorno punteado del flujo de control o resultado.' },
  { id: 'async', label: 'Mensaje Asíncrono', icon: '──>', description: 'Llamada asíncrona sin bloqueo.' },
  { id: 'create', label: 'Creación de Instancia', icon: '┄«create»▷', description: 'Crea una nueva instancia de objeto.' },
  { id: 'self', label: 'Auto-Llamada', icon: '┌─┐', description: 'Llamada interna sobre la misma línea de vida.' },
];

export const ALL_UML_RELATION_TYPES: UmlRelationTypeItem[] = [
  ...UML_RELATION_TYPES,
  { id: 'assembly', label: 'Ensamble (Assembly)', icon: '─(O─', description: 'Conector de ensamble entre interfaz requerida y provista.' },
  { id: 'include', label: '«include»', icon: '┄«include»▷', description: 'Inclusión obligatoria del comportamiento de otro caso de uso.' },
  { id: 'extend', label: '«extend»', icon: '┄«extend»▷', description: 'Extensión opcional o condicional de un caso de uso.' },
  { id: 'import', label: '«import»', icon: '┄«import»▷', description: 'Importación pública del contenido de un paquete.' },
  { id: 'access', label: '«access»', icon: '┄«access»▷', description: 'Importación privada del contenido de un paquete.' },
  { id: 'merge', label: '«merge»', icon: '┄«merge»▷', description: 'Fusión de definiciones complementarias de paquetes.' },
  { id: 'trace', label: '«trace»', icon: '┄«trace»▷', description: 'Trazabilidad conceptual o histórica entre paquetes.' },
  ...UML_SEQUENCE_RELATION_TYPES,
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
  stereotype?: string | null;
  activations?: any[];
  labelOffset?: { x: number; y: number };
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
    stereotype?: string | null;
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
    stereotype?: string | null;
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

export function hexToRgb(hex: string | null | undefined): { r: number; g: number; b: number } {
  let clean = (hex || '#FFFDDD').replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num) || clean.length !== 6) {
    return { r: 255, g: 253, b: 221 };
  }
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: any) => {
    const n = Math.round(Number(v) || 0);
    return Math.max(0, Math.min(255, n));
  };
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}
