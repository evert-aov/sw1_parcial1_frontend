import { UmlRelationshipType } from '../../../core/models/diagram.model';

export const PACKAGE_STEREOTYPES = ['«import»', '«access»', '«merge»'] as const;

/**
 * Obtiene el formato estereotipado de la relación entre paquetes
 */
export function formatPackageRelation(relType: UmlRelationshipType | string): string | undefined {
  if (relType === 'import') return '«import»';
  if (relType === 'access') return '«access»';
  if (relType === 'merge') return '«merge»';
  return undefined;
}

/**
 * Determina si el tipo de nodo corresponde a un contenedor de paquete
 */
export function isPackageNode(nodeType?: string): boolean {
  return nodeType === 'package';
}
