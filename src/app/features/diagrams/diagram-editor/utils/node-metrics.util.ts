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

const classDynamicWidthCache = new Map<string, number>();

function getClassDynamicWidthCacheKey(node: UmlClassNode): string {
  const attrs = node.attributes;
  const methods = node.methods;
  const attrsHash = attrs && attrs.length > 0
    ? attrs.map((a) => `${a.name || ''}:${a.type || ''}`).join('|')
    : '0';
  const methodsHash = methods && methods.length > 0
    ? methods.map((m) => `${m.name || ''}:${m.parameters || ''}:${m.returnType || ''}`).join('|')
    : '0';
  return `${node.id || ''}#${node.name || ''}#${node.stereotype || ''}#${attrsHash}#${methodsHash}`;
}

/**
 * Calcula el ancho dinámico óptimo y simétrico para una clase UML.
 * Garantiza que el espacio desde el borde izquierdo al símbolo '+/-' (10px de padding)
 * sea exactamente igual al espacio desde el final de ': tipo' / ': void' al borde derecho (10px).
 */
export function calculateClassDynamicWidth(node: UmlClassNode): number {
  const cacheKey = getClassDynamicWidthCacheKey(node);
  const cached = classDynamicWidthCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const padW = 20; // 10px padding-left + 10px padding-right simétrico

  const bodyFont = '12px "Plus Jakarta Sans", system-ui, sans-serif';
  const boldBodyFont = 'bold 12px "Plus Jakarta Sans", system-ui, sans-serif';
  const headerFont = 'bold 14px "Plus Jakarta Sans", system-ui, sans-serif';
  const stereotypeFont = 'italic 11px "JetBrains Mono", monospace';

  // 1. Encabezado de la clase
  const nameW = measureTextWidth(node.name || '', headerFont) + 4;
  const isAssocStereotype =
    (node.stereotype || '').toLowerCase() === 'associationclass' ||
    (node.stereotype || '').toLowerCase() === '«associationclass»';
  const stereotypeW = node.stereotype && !isAssocStereotype ? measureTextWidth(`«${node.stereotype}»`, stereotypeFont) : 0;
  const headerContentW = Math.max(nameW, stereotypeW);
  let maxNeededWidth = headerContentW + padW;

  // 2. Atributos: | 10px | [-] nombre : tipo | 10px |
  for (const attr of node.attributes || []) {
    const attrNameW = measureTextWidth(`${attr.visibility || '-'} ${attr.name || ''}`, boldBodyFont);
    const attrTypeW = measureTextWidth(`: ${attr.type || ''}`, bodyFont);
    const attrRowW = padW + attrNameW + 3 + attrTypeW;
    if (attrRowW > maxNeededWidth) {
      maxNeededWidth = attrRowW;
    }
  }

  // 3. Métodos: | 10px | [+] nombre(params): retorno | 10px |
  const methodFont = '11.5px "JetBrains Mono", monospace';
  for (const m of node.methods || []) {
    const sigText = `${m.visibility || '+'} ${m.name || ''}(${m.parameters || ''}): ${m.returnType || 'void'}`;
    const methodRowW = padW + measureTextWidth(sigText, methodFont);
    if (methodRowW > maxNeededWidth) {
      maxNeededWidth = methodRowW;
    }
  }

  // Ancho mínimo base de 90px
  const result = Math.max(90, Math.ceil(maxNeededWidth));
  if (classDynamicWidthCache.size > 2000) classDynamicWidthCache.clear();
  classDynamicWidthCache.set(cacheKey, result);
  return result;
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
  if (node.nodeType === 'package_layer') {
    const manualW = node.customWidth || (node.isCustomSize ? (node.width || 0) : 0) || node.width;
    if (manualW && manualW > 0) return Math.max(240, manualW);
    return 420;
  }
  if (node.nodeType === 'package') {
    const manualW = node.customWidth || (node.isCustomSize ? (node.width || 0) : 0) || node.width;
    if (manualW && manualW > 0) return Math.max(140, manualW);
    return 200;
  }
  if (node.nodeType === 'note') {
    const manualW = node.customWidth || (node.isCustomSize ? (node.width || 0) : 0) || node.width;
    if (manualW && manualW > 0) return Math.max(135, manualW);
    const lines = (node.name || '').split('\n');
    const longest = lines.reduce((max, l) => Math.max(max, l.length), 12);
    return Math.max(185, Math.min(340, longest * 6.8 + 32));
  }
  if (node.nodeType === 'activity_initial' || node.nodeType === 'activity_final') {
    return 44;
  }
  if (node.nodeType === 'activity_action') {
    const manualW = node.customWidth || (node.isCustomSize ? (node.width || 0) : 0) || node.width;
    return Math.max(110, manualW || 155);
  }
  if (node.nodeType === 'activity_decision') {
    return 65;
  }
  if (node.nodeType === 'activity_fork') {
    const manualW = node.customWidth || (node.isCustomSize ? (node.width || 0) : 0) || node.width;
    return Math.max(120, manualW || 220);
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
  if (node.nodeType === 'package_layer') return node.customHeight || (node.isCustomSize ? node.height : null) || node.height || 200;
  if (node.nodeType === 'note') {
    if (node.customHeight && node.customHeight > 0) return node.customHeight;
    const lines = (node.name || '').split('\n');
    const estimated = Math.max(lines.length, Math.ceil((node.name || '').length / 28));
    return Math.max(76, estimated * 18 + 32);
  }
  if (node.nodeType === 'activity_initial' || node.nodeType === 'activity_final') return 48;
  if (node.nodeType === 'activity_action') return node.customHeight || (node.isCustomSize ? node.height : null) || node.height || 62;
  if (node.nodeType === 'activity_decision') return 65;
  if (node.nodeType === 'activity_fork') return 14;
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

/**
 * Limpia todas las cachés en memoria asociadas al cálculo de métricas de texto y nodos.
 */
export function clearNodeMetricsCache(): void {
  textWidthCache.clear();
  classDynamicWidthCache.clear();
}
