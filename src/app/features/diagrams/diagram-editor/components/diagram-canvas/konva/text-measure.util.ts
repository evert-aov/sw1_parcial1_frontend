/**
 * Medición de texto con Canvas 2D nativo.
 *
 * Evita instanciar `Konva.Text` huérfanos (fuera de Stage) solo para conocer el ancho de una cadena,
 * lo que generaba presión de GC en cada render completo del diagrama.
 */

let measureContext: CanvasRenderingContext2D | null | undefined;

/** Obtiene (y memoiza) un contexto 2D reutilizable; `null` si el entorno no soporta canvas. */
function getMeasureContext(): CanvasRenderingContext2D | null {
  if (measureContext !== undefined) return measureContext;
  try {
    measureContext = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  } catch {
    measureContext = null;
  }
  return measureContext ?? null;
}

export interface TextMeasureStyle {
  fontSize: number;
  fontFamily: string;
  fontStyle?: 'normal' | 'bold' | 'italic' | string;
}

/**
 * Calcula el ancho en píxeles de un texto para la fuente indicada.
 *
 * @param text Cadena a medir.
 * @param style Tamaño, familia y estilo de fuente.
 * @returns Ancho en px. Si no hay contexto 2D disponible, retorna una estimación proporcional al tamaño.
 */
export function measureTextWidth(text: string, style: TextMeasureStyle): number {
  const ctx = getMeasureContext();
  const metrics = ctx
    ? (() => {
        ctx.font = `${style.fontStyle ?? 'normal'} ${style.fontSize}px "${style.fontFamily}"`;
        return ctx.measureText(text);
      })()
    : undefined;
  if (metrics && Number.isFinite(metrics.width) && metrics.width > 0) {
    return metrics.width;
  }
  return text.length * style.fontSize * 0.6;
}
