/**
 * Utilidades de manipulación de cadenas, decodificación UTF-8 / Mojibake
 * y mapeo de tipos primitivos para el parser XMI.
 */

export class XmiStringUtils {
  /**
   * Corrige Mojibake UTF-8 y decodifica entidades HTML y numéricas de Enterprise Architect.
   */
  public static fixUtf8Mojibake(str: string): string {
    if (!str || typeof str !== 'string') return str || '';

    // Decodificar entidades numéricas y HTML generadas por Enterprise Architect (ej. &#243;, &#237;, &aacute;, etc.)
    if (str.includes('&')) {
      str = str
        .replace(/&#(\d+);/g, (_, code) => {
          const num = parseInt(code, 10);
          return !isNaN(num) && num > 0 ? String.fromCharCode(num) : _;
        })
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
          const num = parseInt(hex, 16);
          return !isNaN(num) && num > 0 ? String.fromCharCode(num) : _;
        })
        .replace(/&aacute;/gi, 'á')
        .replace(/&eacute;/gi, 'é')
        .replace(/&iacute;/gi, 'í')
        .replace(/&oacute;/gi, 'ó')
        .replace(/&uacute;/gi, 'ú')
        .replace(/&ntilde;/gi, 'ñ')
        .replace(/&Aacute;/g, 'Á')
        .replace(/&Eacute;/g, 'É')
        .replace(/&Iacute;/g, 'Í')
        .replace(/&Oacute;/g, 'Ó')
        .replace(/&Uacute;/g, 'Ú')
        .replace(/&Ntilde;/g, 'Ñ');
    }

    if (!/Ã[\x80-\xBF]|Â[\x80-\xBF]/.test(str)) return str;
    try {
      const bytes = new Uint8Array(str.length);
      for (let i = 0; i < str.length; i++) {
        bytes[i] = str.charCodeAt(i) & 0xff;
      }
      const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      if (!decoded.includes('\uFFFD')) {
        return decoded;
      }
    } catch {
      // fallback
    }
    return str;
  }

  /**
   * Limpia el prefijo del tipo generado por EA (ej: EAJava_int -> int).
   */
  public static cleanTypeName(raw: string): string {
    if (!raw) return 'String';
    return raw.replace(/^EAJava_/, '').replace(/^uml:/, '');
  }

  /**
   * Normaliza los tipos de datos comunes hacia tipos canónicos de modelado.
   */
  public static mapType(type: string): string {
    const lower = (type || '').toLowerCase().trim();
    if (lower === 'uuid') return 'UUID';
    if (lower === 'string' || lower === 'text' || lower === 'varchar') return 'String';
    if (lower === 'int' || lower === 'integer') return 'Integer';
    if (lower === 'long' || lower === 'bigint') return 'Long';
    if (lower === 'bool' || lower === 'boolean') return 'Boolean';
    if (lower === 'double') return 'Double';
    if (lower === 'float') return 'Float';
    if (lower === 'bigdecimal' || lower === 'decimal' || lower === 'numeric') return 'BigDecimal';
    if (lower === 'localdate' || lower === 'date') return 'LocalDate';
    if (lower === 'localdatetime' || lower === 'timestamp') return 'LocalDateTime';
    if (lower === 'void') return 'void';
    return type || 'String';
  }

  /**
   * Convierte un valor de color numérico BGR de Enterprise Architect a formato HEX RGB (#RRGGBB).
   */
  public static eaColorToHex(val: number): string {
    const r = val & 0xff;
    const g = (val >> 8) & 0xff;
    const b = (val >> 16) & 0xff;
    return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  }
}
