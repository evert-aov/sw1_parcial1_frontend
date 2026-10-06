import { UmlClassNode } from '../../../../core/models/diagram.model';

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

/**
 * Calcula el ancho dinámico óptimo y simétrico para una clase UML.
 * Garantiza que el espacio desde el borde izquierdo al símbolo '+/-' (10px de padding)
 * sea exactamente igual al espacio desde el final de ': tipo' / ': void' al borde derecho (10px).
 */
export function calculateClassDynamicWidth(node: UmlClassNode): number {
  const padW = 20; // 10px padding-left + 10px padding-right (px-2.5 de Tailwind)
  const symW = 6;  // Ancho estimado del símbolo '-' o '+'
  const mrW = 6;   // Margen derecho del símbolo mr-1.5 (6px)
  const mlW = 2;   // Margen izquierdo antes del tipo ml-0.5 (2px)

  const bodyFont = '11px ui-sans-serif, system-ui, -apple-system, sans-serif';
  const headerFont = 'bold 12px ui-sans-serif, system-ui, -apple-system, sans-serif';
  const stereotypeFont = 'italic 9.5px ui-sans-serif, system-ui, -apple-system, sans-serif';

  // 1. Encabezado de la clase
  const nameW = measureTextWidth(node.name || '', headerFont);
  const stereotypeW = node.stereotype ? measureTextWidth(`«${node.stereotype}»`, stereotypeFont) : 0;
  const headerContentW = Math.max(nameW, stereotypeW);
  // Padding horizontal (20px) + margen para icono de bloqueo o botón eliminar (20px)
  let maxNeededWidth = headerContentW + padW + 20;

  // 2. Atributos
  // Estructura visual: | (10px) [-] (6px) [nombre] (2px) [: tipo] (10px) |
  for (const attr of node.attributes || []) {
    const attrNameW = measureTextWidth(attr.name || '', bodyFont);
    const attrTypeW = measureTextWidth(`: ${attr.type || ''}`, bodyFont);
    const attrRowW = padW + symW + mrW + attrNameW + mlW + attrTypeW;
    if (attrRowW > maxNeededWidth) {
      maxNeededWidth = attrRowW;
    }
  }

  // 3. Métodos
  // Estructura visual: | (10px) [+] (6px) [nombre(parametros)] (2px) [: tipoRetorno] (10px) |
  for (const m of node.methods || []) {
    const sigText = `${m.name || ''}(${m.parameters || ''})`;
    const sigW = measureTextWidth(sigText, bodyFont);
    const retW = measureTextWidth(`: ${m.returnType || 'void'}`, bodyFont);
    const methodRowW = padW + symW + mrW + sigW + mlW + retW;
    if (methodRowW > maxNeededWidth) {
      maxNeededWidth = methodRowW;
    }
  }

  // Ancho mínimo base de 90px para asegurar interacción táctil/puntero adecuada
  return Math.max(90, Math.ceil(maxNeededWidth));
}
