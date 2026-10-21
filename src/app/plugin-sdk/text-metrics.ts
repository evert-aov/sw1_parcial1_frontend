
let measureCanvasCtx: CanvasRenderingContext2D | null = null;
const textWidthCache = new Map<string, number>();

/**
 * Fallback heurístico ponderado por tipo de carácter para entornos sin Canvas (ej: SSR o tests).
 */
function fallbackTextWidth(text: string, isBold: boolean = false, fontSize: number = 11): number {
  if (!text) return 0;
  let total = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === ' ' || ch === ':' || ch === '.' || ch === ',' || ch === ';' || ch === "'" || ch === '!') {
      total += 3.2;
    } else if (ch === '(' || ch === ')' || ch === '[' || ch === ']' || ch === '{' || ch === '}') {
      total += 3.8;
    } else if (ch === '-' || ch === '+') {
      total += 5.5;
    } else if (ch >= 'A' && ch <= 'Z') {
      total += isBold ? 7.2 : 6.6;
    } else if (ch >= '0' && ch <= '9') {
      total += isBold ? 6.4 : 5.8;
    } else if (ch === 'i' || ch === 'l' || ch === 'j' || ch === 't' || ch === 'r' || ch === 'f') {
      total += isBold ? 3.8 : 3.4;
    } else if (ch === 'm' || ch === 'w') {
      total += isBold ? 9.2 : 8.5;
    } else {
      total += isBold ? 6.2 : 5.6;
    }
  }
  return total * (fontSize / 11);
}

/**
 * Mide el ancho exacto en píxeles de un texto usando CanvasRenderingContext2D del navegador.
 */
export function measureTextWidth(text: string, font: string = '11px ui-sans-serif, system-ui, -apple-system, sans-serif'): number {
  if (!text) return 0;
  const cacheKey = `${font}::${text}`;
  const cached = textWidthCache.get(cacheKey);
  if (cached !== undefined) return cached;

  if (typeof document !== 'undefined') {
    if (!measureCanvasCtx) {
      const canvas = document.createElement('canvas');
      measureCanvasCtx = canvas.getContext('2d');
    }
    if (measureCanvasCtx) {
      measureCanvasCtx.font = font;
      const w = measureCanvasCtx.measureText(text).width;
      if (textWidthCache.size > 2000) textWidthCache.clear();
      textWidthCache.set(cacheKey, w);
      return w;
    }
  }

  const isBold = font.includes('bold') || font.includes('700') || font.includes('600');
  const sizeMatch = font.match(/(\d+(?:\.\d+)?)px/);
  const fontSize = sizeMatch ? parseFloat(sizeMatch[1]) : 11;
  const fallback = fallbackTextWidth(text, isBold, fontSize);
  return fallback;
}

