export function fixUtf8Mojibake(str: string): string {
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
