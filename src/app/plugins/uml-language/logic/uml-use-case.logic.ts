import { UmlRelationshipType } from '../../../core/models/diagram.model';

export const USE_CASE_STEREOTYPES = ['«include»', '«extend»'] as const;

/**
 * Obtiene el formato estereotipado de la relación de caso de uso
 */
export function formatUseCaseRelation(relType: UmlRelationshipType | string): string | undefined {
  if (relType === 'include') return '«include»';
  if (relType === 'extend') return '«extend»';
  return undefined;
}

/**
 * Determina si el nodo es un límite del sistema (system boundary box)
 */
export function isSystemBoundaryBox(nodeType?: string, nodeId?: string): boolean {
  return nodeType === 'boundary_box' || (nodeId?.startsWith('boundary_box_') ?? false);
}

/**
 * Sanitiza el nombre de un límite del sistema para evitar placeholders por defecto
 */
export function sanitizeBoundaryBoxName(name?: string): string {
  if (!name || name.trim() === '' || name === 'ClassName') {
    return '';
  }
  return name.trim();
}
