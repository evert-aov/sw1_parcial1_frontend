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

export function getDefaultColorForNodeType(nodeType?: string | null, stereotype?: string | null): string {
  const nt = nodeType || 'class';
  const st = stereotype || '';

  if (nt === 'device' || st === 'device') return '#F3FAF7';
  if (nt === 'executionEnvironment' || st === 'executionEnvironment') return '#CDE5F5';
  if (nt === 'component' || st === 'component' || nt === 'package' || nt === 'boundary_box') return '#FAF1EC';
  if (nt === 'boundary' || nt === 'control' || nt === 'entity' || nt === 'lifeline' || st === 'UI' || st === 'Entity.' || st === 'Controller.' || st === 'boundary' || st === 'control' || st === 'entity') return '#DDF4F5';
  if (nt === 'use_case') return '#E5F2FE';
  if (nt === 'actor') return '#FEF2DD';
  if (nt === 'node') return '#F3FAF7';
  return '#FDFAF3';
}

export function getDynamicNodeWidth(node: UmlClassNode): number {
  if (node.isAnchor) return 0;
  if (node.nodeType === 'actor') return 65;
  if (node.nodeType === 'lifeline') {
    const nameLen = (node.name || '').length;
    return Math.max(160, Math.round(nameLen * 8.5 + 44));
  }
  if (node.nodeType === 'use_case') {
    const nameLen = (node.name || '').length;
    return Math.min(260, Math.max(140, Math.round(nameLen * 7.5 + 40)));
  }
  if (node.nodeType === 'package') {
    const tabTitle = node.name ? node.name.split('\n')[0].trim() : 'Paquete';
    const bodyText = (node.attributes && node.attributes.length > 0 && node.attributes[0]?.name)
      ? node.attributes[0].name
      : (node.name && node.name.includes('\n') ? node.name.split('\n').slice(1).join('\n').trim() : '');
    const maxLen = Math.max(tabTitle.length, bodyText.length);
    return Math.max(180, Math.round(maxLen * 7.5 + 40));
  }
  if (node.nodeType === 'boundary' || node.nodeType === 'control' || node.nodeType === 'entity') {
    return 70;
  }
  return calculateClassDynamicWidth(node);
}

export function getNodeWidth(node: UmlClassNode): number {
  if (node.isAnchor) return 0;
  if (node.nodeType === 'use_case') {
    const dynamicW = getDynamicNodeWidth(node);
    const manualW = (node.isCustomSize && (node.customWidth || node.width)) ? (node.customWidth || node.width || 0) : (node.customWidth || 0);
    return Math.max(dynamicW, manualW || 0);
  }
  if (node.nodeType === 'actor') {
    const manualW = node.customWidth || (node.isCustomSize ? (node.width || 0) : 0);
    if (manualW && manualW > 0) {
      return Math.max(50, manualW);
    }
    return 65;
  }
  if (node.nodeType === 'lifeline') {
    const manualW = node.customWidth || node.width || 0;
    return Math.max(getDynamicNodeWidth(node), manualW);
  }
  if (node.nodeType === 'package') {
    const manualW = node.customWidth || (node.isCustomSize ? (node.width || 0) : 0) || node.width;
    if (manualW && manualW > 0) {
      return Math.max(120, manualW);
    }
    return getDynamicNodeWidth(node);
  }
  if (node.nodeType === 'boundary' || node.nodeType === 'control' || node.nodeType === 'entity') {
    const manualW = node.customWidth || (node.isCustomSize ? (node.width || 0) : 0);
    if (manualW && manualW > 0) {
      return Math.max(50, manualW);
    }
    return 70;
  }
  if (node.nodeType === 'component') {
    const manualW = node.customWidth || (node.isCustomSize ? (node.width || 0) : 0) || node.width;
    if (manualW && manualW > 0) {
      return Math.max(140, manualW);
    }
    const nameLen = (node.name || '').length;
    return Math.max(180, Math.round(nameLen * 8.5 + 50));
  }
  if (node.nodeType === 'device' || node.nodeType === 'node' || node.nodeType === 'executionEnvironment') {
    const manualW = node.customWidth || (node.isCustomSize ? (node.width || 0) : 0) || node.width;
    if (manualW && manualW > 0) {
      return Math.max(160, manualW);
    }
    const nameLen = (node.name || '').length;
    return Math.max(230, Math.round(nameLen * 8.5 + 50));
  }
  if (node.nodeType === 'boundary_box') {
    const manualW = node.customWidth || (node.isCustomSize ? (node.width || 0) : 0) || node.width;
    if (manualW && manualW > 0) {
      return Math.max(120, manualW);
    }
    return 280;
  }
  const dynamicW = getDynamicNodeWidth(node);
  const manualW = (node.isCustomSize && node.customWidth) ? node.customWidth : 0;
  return Math.max(dynamicW, manualW);
}

export function getNodeHeight(node: UmlClassNode): number {
  if (node.isAnchor) return 0;
  if (node.nodeType === 'lifeline') return 60;
  if (node.customHeight && node.customHeight > 0) return node.customHeight;
  if (node.isCustomSize && node.height && node.height > 0) return node.height;
  if (node.nodeType === 'actor') return node.customHeight || (node.isCustomSize ? node.height : null) || node.height || 95;

  if (node.nodeType === 'package') return node.customHeight || node.height || 120;
  if (node.nodeType === 'boundary_box') {
    return node.customHeight || (node.isCustomSize ? node.height : null) || node.height || 200;
  }
  if (node.nodeType === 'component') {
    return node.customHeight || (node.isCustomSize ? node.height : null) || node.height || 70;
  }
  if (node.nodeType === 'device' || node.nodeType === 'node' || node.nodeType === 'executionEnvironment') {
    return node.customHeight || (node.isCustomSize ? node.height : null) || node.height || (node.nodeType === 'executionEnvironment' ? 160 : 140);
  }
  if (node.nodeType === 'boundary' || node.nodeType === 'control' || node.nodeType === 'entity') {
    return node.customHeight || (node.isCustomSize ? node.height : null) || node.height || 70;
  }
  if (node.nodeType === 'use_case') {
    const manualH = (node.isCustomSize && (node.customHeight || node.height)) ? (node.customHeight || node.height || 0) : (node.customHeight || 0);
    const w = getNodeWidth(node);
    const nameLen = (node.name || '').length;
    const usableWidth = Math.max(50, w - 24);
    const charsPerLine = Math.max(8, Math.floor(usableWidth / 6.8));
    const lines = Math.max(1, Math.ceil(nameLen / charsPerLine));
    const dynamicH = Math.max(60, 45 + (lines - 1) * 18);
    return Math.max(dynamicH, manualH || 0);
  }
  const headerH = 34;
  const attrCount = (node.attributes || []).length;
  const methodCount = (node.methods || []).length;
  const attrH = attrCount > 0 ? attrCount * 22 + 12 : 28;
  const methodH = methodCount > 0 ? methodCount * 22 + 12 : 0;
  return headerH + attrH + methodH;
}

export function computeBoardWidth(nodes: UmlClassNode[], minWidth = 2200): number {
  let max = minWidth;
  for (const node of nodes) {
    if (node.position && node.position.x + 350 > max) {
      max = node.position.x + 350;
    }
  }
  return max;
}

export function computeBoardHeight(nodes: UmlClassNode[], minHeight = 1400): number {
  let max = minHeight;
  for (const node of nodes) {
    if (node.position && node.position.y + 350 > max) {
      max = node.position.y + 350;
    }
  }
  return max;
}
