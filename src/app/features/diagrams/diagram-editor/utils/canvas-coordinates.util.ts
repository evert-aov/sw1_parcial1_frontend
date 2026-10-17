/**
 * Utilidades matemáticas para coordenadas y eventos del lienzo Foblex Flow.
 */

export function calculateCanvasCoordinates(
  event: MouseEvent,
  flowElement?: HTMLElement | null,
  transform?: { scale?: number; position?: { x: number; y: number } } | null,
): { x: number; y: number } | null {
  if (!flowElement) return null;

  const rect = flowElement.getBoundingClientRect();
  const rawX = event.clientX - rect.left;
  const rawY = event.clientY - rect.top;

  const scale = transform?.scale || 1;
  const posX = transform?.position?.x || 0;
  const posY = transform?.position?.y || 0;

  return {
    x: Math.round((rawX - posX) / scale),
    y: Math.round((rawY - posY) / scale),
  };
}

export function isDragMovement(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  threshold = 5,
): boolean {
  return Math.hypot(endX - startX, endY - startY) > threshold;
}
