import { UmlClassNode } from '../../core/models/diagram.model';
import { measureTextWidth } from '../../plugin-sdk/text-metrics';
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
  const result = Math.max(90, Math.ceil(maxNeededWidth));
  if (classDynamicWidthCache.size > 2000) classDynamicWidthCache.clear();
  classDynamicWidthCache.set(cacheKey, result);
  return result;
}

