import {
  IFConnectionBuilder,
  IFConnectionBuilderRequest,
  IFConnectionBuilderResponse,
} from '@foblex/flow';

type IPoint = IFConnectionBuilderRequest['source'];

/** Clave registrada en `F_CONNECTION_BUILDERS` para mensajes horizontales de diagrama de secuencia. */
export const SEQUENCE_CONNECTION_TYPE = 'sequence';

/** Clave registrada en `F_CONNECTION_BUILDERS` para automensajes (self-messages) en secuencia. */
export const SEQUENCE_SELF_CONNECTION_TYPE = 'sequence_self';

/** Ancho horizontal del bucle rectangular de un automensaje de secuencia. */
export const SEQUENCE_SELF_LOOP_WIDTH = 46;

/** Desplazamiento vertical superior e inferior del bucle de automensaje respecto al centro del slot. */
export const SEQUENCE_SELF_TOP_OFFSET = -10;
export const SEQUENCE_SELF_BOTTOM_OFFSET = 14;

/**
 * Constructor de trazado para mensajes horizontales en diagramas de secuencia UML 2.5.
 *
 * `DiagramCanvasComponent` orienta `fOutputSide` y `fInputSide` hacia el nodo opuesto
 * (`right -> left` para mensajes hacia la derecha y `left -> right` para retornos/mensajes hacia la izquierda),
 * de modo que `@foblex/flow` entrega `source` y `target` exactamente sobre los bordes exteriores
 * de las barras de activación (`±7px` desde el eje de la línea de vida).
 */
export class CalculateSequenceLineData implements IFConnectionBuilder {
  handle(request: IFConnectionBuilderRequest): IFConnectionBuilderResponse {
    const { source, target } = request;
    const points: IPoint[] = [source, target];
    const path = `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
    const candidates: IPoint[] = [{ x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 }];

    return {
      path,
      points,
      candidates,
      secondPoint: target,
      penultimatePoint: source,
    };
  }
}

/**
 * Constructor de trazado para automensajes (self-messages) en diagramas de secuencia UML 2.5.
 *
 * Con `fOutputSide="right"` y `fInputSide="right"`, `@foblex/flow` entrega `source` directamente
 * sobre el borde derecho de la barra de activación; el bucle avanza a la derecha, desciende y
 * retorna al mismo borde derecho para que la punta de flecha apunte a la activación.
 */
export class CalculateSequenceSelfLineData implements IFConnectionBuilder {
  handle(request: IFConnectionBuilderRequest): IFConnectionBuilderResponse {
    const { source } = request;
    const edgeX = source.x;
    const outerX = edgeX + SEQUENCE_SELF_LOOP_WIDTH;
    const topY = source.y + SEQUENCE_SELF_TOP_OFFSET;
    const bottomY = source.y + SEQUENCE_SELF_BOTTOM_OFFSET;

    const p0: IPoint = { x: edgeX, y: topY };
    const p1: IPoint = { x: outerX, y: topY };
    const p2: IPoint = { x: outerX, y: bottomY };
    const p3: IPoint = { x: edgeX, y: bottomY };

    const points: IPoint[] = [p0, p1, p2, p3];
    const path = `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y}`;
    const candidates: IPoint[] = [
      { x: (p0.x + p1.x) / 2, y: p0.y },
      { x: p1.x, y: (p1.y + p2.y) / 2 },
      { x: (p2.x + p3.x) / 2, y: p2.y },
    ];

    return {
      path,
      points,
      candidates,
      secondPoint: p1,
      penultimatePoint: p2,
    };
  }
}
