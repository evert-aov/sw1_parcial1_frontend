import {
  CalculateSegmentLineData,
  IFConnectionBuilder,
  IFConnectionBuilderRequest,
  IFConnectionBuilderResponse,
} from '@foblex/flow';

type IPoint = IFConnectionBuilderRequest['source'];

/** Clave registrada en `F_CONNECTION_BUILDERS` para los estilos laterales. */
export const LATERAL_CONNECTION_TYPE = 'lateral';

const isVerticalSide = (side: string): boolean => side === 'top' || side === 'bottom';

/**
 * Constructor de trazado para los estilos «Lateral - Vertical» y «Lateral - Horizontal».
 *
 * Produce un codo único (forma de L) sin tramos de separación:
 * - Salida vertical (top/bottom) → baja/sube hasta la altura del destino y entra de lado.
 * - Salida horizontal (left/right) → avanza hasta el eje del destino y entra por arriba/abajo.
 * Si ambos extremos comparten orientación (caso degenerado) se usa un tramo intermedio
 * en el punto medio; con puntos intermedios manuales se delega en el trazado por segmentos.
 */
export class CalculateLateralLineData implements IFConnectionBuilder {
  private readonly fallback = new CalculateSegmentLineData();

  handle(request: IFConnectionBuilderRequest): IFConnectionBuilderResponse {
    const { source, sourceSide, target, targetSide, waypoints } = request;
    if (waypoints?.length) {
      return this.fallback.handle(request);
    }

    const sourceVertical = isVerticalSide(sourceSide);
    const targetVertical = isVerticalSide(targetSide);
    let corners: IPoint[];
    if (sourceVertical !== targetVertical) {
      corners = [sourceVertical ? { x: source.x, y: target.y } : { x: target.x, y: source.y }];
    } else if (sourceVertical) {
      const midY = (source.y + target.y) / 2;
      corners = [{ x: source.x, y: midY }, { x: target.x, y: midY }];
    } else {
      const midX = (source.x + target.x) / 2;
      corners = [{ x: midX, y: source.y }, { x: midX, y: target.y }];
    }

    const points = this.dedupe([source, ...corners, target]);
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const candidates = points.slice(0, -1).map((p, i) => ({
      x: (p.x + points[i + 1].x) / 2,
      y: (p.y + points[i + 1].y) / 2,
    }));
    return {
      path,
      points,
      candidates,
      secondPoint: points.length > 1 ? points[1] : target,
      penultimatePoint: points.length > 1 ? points[points.length - 2] : source,
    };
  }

  /** Elimina puntos consecutivos coincidentes para no generar tramos de longitud cero. */
  private dedupe(points: IPoint[]): IPoint[] {
    return points.filter(
      (p, i) => i === 0 || Math.abs(p.x - points[i - 1].x) > 0.5 || Math.abs(p.y - points[i - 1].y) > 0.5,
    );
  }
}
