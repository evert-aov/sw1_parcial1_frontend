import { UmlClassNode } from '../../../core/models/diagram.model';

export type DeploymentNodeType = 'device' | 'executionEnvironment' | 'node';

export const DEPLOYMENT_NODE_TYPES = ['device', 'executionEnvironment', 'node'] as const;

/**
 * Determina si el tipo de nodo corresponde a la capa de despliegue físico o de infraestructura
 */
export function isDeploymentNode(nodeType?: string): boolean {
  return (
    nodeType === 'device' ||
    nodeType === 'executionEnvironment' ||
    nodeType === 'node'
  );
}

/**
 * Obtiene el estereotipo visual por defecto para el encabezado de un nodo de despliegue
 */
export function getDeploymentStereotypeLabel(nodeType?: string): string {
  switch (nodeType) {
    case 'device':
      return '«device»';
    case 'executionEnvironment':
      return '«execution environment»';
    case 'node':
    default:
      return '«node»';
  }
}
