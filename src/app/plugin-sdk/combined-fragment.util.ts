/** Operadores UML 2.5 admitidos para fragmentos combinados en diagramas de secuencia. */
export const COMBINED_FRAGMENT_OPERATORS = [
  'alt',
  'opt',
  'loop',
  'break',
  'par',
  'critical',
  'neg',
  'ref',
] as const;

export type CombinedFragmentOperator = (typeof COMBINED_FRAGMENT_OPERATORS)[number];

/** Representación estructurada de un fragmento combinado UML 2.5 (operador, operandos y divisores en %). */
export interface CombinedFragmentData {
  operator: string;
  operands: string[];
  /** Posiciones verticales acumuladas en porcentaje (0..100) de cada línea divisoria (longitud = operands.length - 1). */
  dividers: number[];
}

const KNOWN_OPERATORS = new Set<string>([
  ...COMBINED_FRAGMENT_OPERATORS,
  'seq',
  'strict',
  'assert',
  'ignore',
  'consider',
]);

const DIVIDER_LINE_RE = /^---+(?:\s*(\d+(?:\.\d+)?))?$/;

/**
 * Calcula divisores equiespaciados por defecto para una cantidad dada de operandos.
 */
export function buildDefaultDividers(operandCount: number): number[] {
  if (operandCount <= 1) return [];
  const step = 100 / operandCount;
  return Array.from({ length: operandCount - 1 }, (_, i) => Math.round((i + 1) * step * 10) / 10);
}

/**
 * Normaliza un arreglo de divisores en porcentaje para que respete el orden creciente y los márgenes mínimos.
 */
export function normalizeFragmentDividers(dividers: number[] | undefined, operandCount: number): number[] {
  const needed = Math.max(0, operandCount - 1);
  if (needed === 0) return [];
  if (!dividers || dividers.length !== needed) {
    return buildDefaultDividers(operandCount);
  }
  const minGap = 10;
  const result: number[] = [];
  for (let i = 0; i < needed; i++) {
    const raw = Number(dividers[i]);
    const minVal = i === 0 ? 18 : result[i - 1] + minGap;
    const maxVal = 100 - (needed - i) * minGap;
    const clamped = Number.isFinite(raw) ? Math.min(maxVal, Math.max(minVal, raw)) : (minVal + maxVal) / 2;
    result.push(Math.round(clamped * 10) / 10);
  }
  return result;
}

/**
 * Normaliza una condición de guarda para mostrarla entre corchetes `[...]`.
 * Si la entrada está vacía devuelve una cadena vacía.
 */
export function normalizeFragmentGuard(guard: string): string {
  const trimmed = (guard || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) return trimmed;
  return `[${trimmed.replace(/^\[+|\]+$/g, '').trim()}]`;
}

/**
 * Parsea el nombre persistido de un nodo `combined_fragment` en su operador, guardas y posiciones de divisores.
 * Formato canónico: `alt\n[condición]\n---50\n[else]` (compatible con `---` sin porcentaje).
 */
export function parseCombinedFragment(rawName?: string | null): CombinedFragmentData {
  const text = (rawName || '').trim();
  if (!text) {
    return { operator: 'alt', operands: ['[condición]', '[else]'], dividers: [50] };
  }

  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const firstLine = lines[0] || '';
  const firstLower = firstLine.toLowerCase();

  let operator = 'alt';
  let bodyLines: string[];

  if (KNOWN_OPERATORS.has(firstLower)) {
    operator = firstLower;
    bodyLines = lines.slice(1);
  } else {
    const inlineMatch = firstLine.match(/^([a-z]+)\s+(\[.*\])$/i);
    if (inlineMatch && KNOWN_OPERATORS.has(inlineMatch[1].toLowerCase())) {
      operator = inlineMatch[1].toLowerCase();
      bodyLines = [inlineMatch[2], ...lines.slice(1)];
    } else {
      bodyLines = lines;
    }
  }

  const hasDividerLine = bodyLines.some((l) => DIVIDER_LINE_RE.test(l));
  let operands: string[];
  let parsedDividers: number[] | undefined;

  if (bodyLines.every((l) => !l)) {
    operands = operator === 'alt' || operator === 'par' ? ['[condición]', '[else]'] : ['[condición]'];
  } else if (hasDividerLine) {
    operands = [];
    const rawDividers: Array<number | null> = [];
    let currentLines: string[] = [];

    for (const line of bodyLines) {
      const m = line.match(DIVIDER_LINE_RE);
      if (m) {
        const joined = currentLines.join(' ').trim();
        operands.push(joined ? normalizeFragmentGuard(joined) : '');
        rawDividers.push(m[1] !== undefined ? parseFloat(m[1]) : null);
        currentLines = [];
      } else if (line) {
        currentLines.push(line);
      }
    }
    const tail = currentLines.join(' ').trim();
    operands.push(tail ? normalizeFragmentGuard(tail) : '');

    if (rawDividers.every((d) => d !== null && Number.isFinite(d))) {
      parsedDividers = rawDividers as number[];
    }
  } else {
    const nonEmpty = bodyLines.filter((l) => l.length > 0);
    operands = nonEmpty.map((l) => normalizeFragmentGuard(l));
  }

  if (operands.length === 0) {
    operands = ['[condición]'];
  }

  return {
    operator,
    operands,
    dividers: normalizeFragmentDividers(parsedDividers, operands.length),
  };
}

/**
 * Serializa el operador, guardas y posiciones de divisores de un fragmento combinado en `node.name`.
 */
export function serializeCombinedFragment(
  operator: string,
  operands: string[],
  dividers?: number[],
): string {
  const cleanOp = (operator || 'alt').trim().toLowerCase() || 'alt';
  const cleanOperands = (operands || []).map((g) => normalizeFragmentGuard(g));
  if (cleanOperands.length === 0) {
    return cleanOp === 'alt' || cleanOp === 'par'
      ? `${cleanOp}\n[condición]\n---50\n[else]`
      : `${cleanOp}\n[condición]`;
  }
  const normalizedDividers = normalizeFragmentDividers(dividers, cleanOperands.length);
  const parts: string[] = [cleanOp];
  for (let i = 0; i < cleanOperands.length; i++) {
    parts.push(cleanOperands[i]);
    if (i < normalizedDividers.length) {
      parts.push(`---${normalizedDividers[i]}`);
    }
  }
  return parts.join('\n');
}

/**
 * Genera una etiqueta compacta de una línea para el explorador lateral y tooltips.
 */
export function formatCombinedFragmentSummary(rawName?: string | null): string {
  const { operator, operands } = parseCombinedFragment(rawName);
  const firstGuard = operands[0] || '';
  return firstGuard ? `${operator} ${firstGuard}` : operator;
}
