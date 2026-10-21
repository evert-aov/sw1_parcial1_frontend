import { IMPORTED_SEQUENCE_PALETTE } from '../../../plugin-sdk/sequence-colors';
import { UmlMessage } from '../../../core/models/diagram.model';
import { XmiStringUtils } from './xmi-string-utils';

export class XmiBehaviorParser {
  /**
   * Paleta cromática coordinada por grupo de interacción (estilo Enterprise Architect).
   */
  public static readonly GROUP_PALETTE = IMPORTED_SEQUENCE_PALETTE;

  /**
   * Obtiene el color de acento asignado a un grupo de interacción según el número de secuencia.
   */
  public static getGroupColor(sequenceNumber?: string): string {
    const match = (sequenceNumber || '').trim().match(/^(\d+)/);
    const g = match ? parseInt(match[1], 10) : 1;
    return this.GROUP_PALETTE[(Math.max(1, g) - 1) % this.GROUP_PALETTE.length];
  }

  /**
   * Compara dos números de secuencia jerárquicos (ej. '1.2' vs '1.10') para ordenamiento natural.
   */
  public static compareSequenceNumbers(seqA?: string, seqB?: string): number {
    if (!seqA && !seqB) return 0;
    if (!seqA) return 1;
    if (!seqB) return -1;
    const partsA = seqA.trim().split('.').map((p) => parseInt(p, 10));
    const partsB = seqB.trim().split('.').map((p) => parseInt(p, 10));
    const len = Math.max(partsA.length, partsB.length);
    for (let i = 0; i < len; i++) {
      const valA = isNaN(partsA[i]) ? 0 : partsA[i];
      const valB = isNaN(partsB[i]) ? 0 : partsB[i];
      if (valA !== valB) {
        return valA - valB;
      }
    }
    return (seqA || '').localeCompare(seqB || '');
  }

  /**
   * Extrae el ordinal cronológico de SeqNo de Enterprise Architect.
   */
  public static readSequenceOrder(raw: unknown): number | undefined {
    if (raw === undefined || raw === null || String(raw).trim() === '') return undefined;
    const text = String(raw).trim();
    const match = text.match(/(?:^|;)\s*SeqNo\s*=\s*(\d+)\s*(?:;|$)/i);
    const value = match ? match[1] : text;
    if (!/^\d+$/.test(value)) return undefined;
    const order = Number(value);
    return Number.isSafeInteger(order) ? order : undefined;
  }

  /**
   * Recolecta recursivamente todos los elementos uml:Message presentes en el modelo.
   */
  public static collectUmlMessages(model: any): Map<string, any> {
    const messages = new Map<string, any>();
    const visit = (value: any): void => {
      if (!value || typeof value !== 'object') return;
      for (const message of value.message ? (Array.isArray(value.message) ? value.message : [value.message]) : []) {
        const id = message['@_xmi:id'] || message['@_id'];
        if (id) messages.set(id, message);
      }
      for (const key of ['packagedElement', 'ownedBehavior', 'nestedClassifier']) {
        const children = value[key];
        if (children) (Array.isArray(children) ? children : [children]).forEach(visit);
      }
    };
    visit(model);
    return messages;
  }

  /**
   * Parsea cadenas de mensajes textuales de comunicación (ej. '1.1: procesarPago(monto) : bool').
   */
  public static parseCommunicationMessages(rawText?: string): UmlMessage[] {
    if (!rawText) return [];
    const parts = rawText
      .split(/\r?\n|&#xA;|;/)
      .map((p) => p.trim())
      .filter(Boolean);
    const msgs: UmlMessage[] = [];
    const msgRegex = /^(\d+(?:\.\d+)*)\s*:\s*([a-zA-Z_$][a-zA-Z0-9_$]*)(?:\s*\((.*?)(?:\)|$))?(?:\s*:\s*([a-zA-Z_$][a-zA-Z0-9_$<>]*))?$/;

    for (let i = 0; i < parts.length; i++) {
      let text = parts[i];
      let isReverse = false;
      if (text.startsWith('<-') || text.startsWith('&lt;-')) {
        isReverse = true;
        text = text.replace(/^(?:<-|&lt;-)\s*/, '').trim();
      } else if (text.startsWith('->') || text.startsWith('-&gt;')) {
        text = text.replace(/^(?:->|-&gt;)\s*/, '').trim();
      }

      const match = text.match(msgRegex);
      if (match) {
        msgs.push({
          id: `msg_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
          sequenceNumber: match[1],
          functionName: match[2],
          parameters: (match[3] || '').replace(/\.\.\.$/, '').trim(),
          returnType: match[4] || '',
          direction: isReverse ? 'reverse' : 'forward',
          isReturn: isReverse,
          color: this.getGroupColor(match[1]),
          orderIndex: i,
        });
      } else {
        const colonIdx = text.indexOf(':');
        if (colonIdx > 0) {
          const seq = text.substring(0, colonIdx).trim();
          const rest = text.substring(colonIdx + 1).trim();
          const pStart = rest.indexOf('(');
          const pEnd = rest.lastIndexOf(')');
          const fn = pStart !== -1 ? rest.substring(0, pStart).trim() : rest;
          let params = '';
          if (pStart !== -1) {
            params = pEnd !== -1 ? rest.substring(pStart + 1, pEnd).trim() : rest.substring(pStart + 1).trim();
            params = params.replace(/\.\.\.$/, '').trim();
          }
          const retPart = pEnd !== -1 && rest.indexOf(':', pEnd) !== -1 ? rest.substring(rest.indexOf(':', pEnd) + 1).trim() : '';
          msgs.push({
            id: `msg_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
            sequenceNumber: seq || `${i + 1}`,
            functionName: fn || 'msg',
            parameters: params,
            returnType: retPart,
            direction: isReverse ? 'reverse' : 'forward',
            isReturn: isReverse,
            color: this.getGroupColor(seq),
            orderIndex: i,
          });
        }
      }
    }
    return msgs;
  }
}
