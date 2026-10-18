import { UmlClassNode } from '../../../../../../core/models/diagram.model';
import { UmlNode } from './models/uml.model';

type NodeLike = UmlClassNode | UmlNode;

/** Tipos (en minúsculas) de nodos que actúan como contenedores estructurales de fondo. */
export const CONTAINER_NODE_TYPES: ReadonlySet<string> = new Set<string>([
  'boundary_box',
  'package_layer',
  'package',
  'device',
  'executionenvironment',
  'execution_environment',
  'exec_env',
  'deployment_node',
  'node',
  'subsystem',
]);

/** Contenedores que se dibujan siempre al fondo (peso Z = 0). */
const BACKGROUND_NODE_TYPES: ReadonlySet<string> = new Set<string>(['boundary_box', 'package_layer']);

/** Contenedores de infraestructura de despliegue (peso Z = 2). */
const DEPLOYMENT_CONTAINER_TYPES: ReadonlySet<string> = new Set<string>([
  'device',
  'executionenvironment',
  'execution_environment',
  'exec_env',
  'deployment_node',
  'node',
  'subsystem',
]);

/** Tipos que siempre se dibujan por encima de los contenedores (peso Z = 100). */
const TOP_NODE_TYPES: ReadonlySet<string> = new Set<string>(['component', 'artifact']);

const BACKGROUND_ID_PREFIXES = ['boundary_box_', 'bbox_'];
const PACKAGE_ID_PREFIX = 'package_';

/**
 * Obtiene el tipo normalizado (minúsculas) de un nodo, ya sea del modelo de AST (`nodeType`)
 * o del modelo Konva (`type`).
 */
export function resolveNodeKind(node: NodeLike): string {
  const nodeType = 'nodeType' in node ? node.nodeType : undefined;
  const type = 'type' in node ? node.type : undefined;
  return (nodeType || type || '').toLowerCase();
}

function startsWithAny(id: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => id.startsWith(prefix));
}

/**
 * Determina si un nodo actúa como contenedor estructural de fondo.
 *
 * @param node Nodo UML a evaluar (modelo AST o Konva).
 * @returns `true` si el nodo es un contenedor estructural.
 */
export function isContainerNode(node?: NodeLike | null): boolean {
  if (!node) return false;
  const kind = resolveNodeKind(node);
  const id = (node.id || '').toLowerCase();
  return (
    CONTAINER_NODE_TYPES.has(kind) ||
    startsWithAny(id, BACKGROUND_ID_PREFIXES) ||
    id.startsWith(PACKAGE_ID_PREFIX)
  );
}

/**
 * Obtiene el peso de ordenamiento de profundidad Z para un nodo.
 *
 * @param node Nodo UML a evaluar.
 * @returns Peso numérico en el eje Z (0: fondo, 100: tope).
 */
export function getNodeZWeight(node: NodeLike): number {
  const kind = resolveNodeKind(node);
  const id = (node.id || '').toLowerCase();
  if (BACKGROUND_NODE_TYPES.has(kind) || startsWithAny(id, BACKGROUND_ID_PREFIXES)) return 0;
  if (kind === 'package' || id.startsWith(PACKAGE_ID_PREFIX)) return 1;
  if (DEPLOYMENT_CONTAINER_TYPES.has(kind)) return 2;
  if (TOP_NODE_TYPES.has(kind)) return 100;
  return 10;
}
