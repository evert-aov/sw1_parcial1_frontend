import { UmlClassNode } from '../../../../../../../core/models/diagram.model';

export type RobustnessType = 'boundary' | 'control' | 'entity';

/**
 * Determina si el tipo de nodo pertenece a la arquitectura de robustez BCE
 */
export function isBceNodeType(nodeType?: string): boolean {
  return nodeType === 'boundary' || nodeType === 'control' || nodeType === 'entity';
}

/**
 * Valida las reglas arquitectónicas de PUDS para diagramas de robustez / análisis BCE:
 * 1. Los Actores solo deben comunicarse con Objetos de Borde (Boundary).
 * 2. Los Objetos de Borde (Boundary) solo pueden comunicarse con Controladores (Control), no con Entidades directamente.
 * 3. Los Controladores (Control) pueden comunicarse con Borde, otros Controladores y Entidades.
 * 4. Las Entidades (Entity) solo deben recibir comunicación de Controladores.
 */
export function validateRobustnessConnection(
  sourceNodeType: string,
  targetNodeType: string,
): { isValid: boolean; warning?: string } {
  if (sourceNodeType === 'actor') {
    if (targetNodeType !== 'boundary') {
      return {
        isValid: false,
        warning: 'Un Actor solo debe interactuar directamente con elementos de tipo Borde (Boundary).',
      };
    }
  }

  if (sourceNodeType === 'boundary') {
    if (targetNodeType === 'entity') {
      return {
        isValid: false,
        warning: 'Un elemento de Borde (Boundary) no debe conectarse directamente con una Entidad. Debe mediar un Controlador.',
      };
    }
  }

  if (sourceNodeType === 'entity') {
    if (targetNodeType === 'boundary') {
      return {
        isValid: false,
        warning: 'Una Entidad no debe comunicarse directamente con un elemento de Borde (Boundary).',
      };
    }
  }

  return { isValid: true };
}
