import { SpeechCue } from '../../core/plugins/contracts/ai-assistant.service.contract';

export interface SpeechTextBoundary {
  startMs: number;
  endOffset: number;
}

/** Obtiene palabras comparables conservando sus posiciones en el Markdown original. */
function words(text: string): { value: string; end: number }[] {
  return [...text.matchAll(/[\p{L}\p{N}]+/gu)].map(match => ({
    value: match[0].normalize('NFKC').toLocaleLowerCase(),
    end: match.index! + match[0].length,
  }));
}

/**
 * Alinea el texto original con las frases de TTS, omitiendo código y destinos de enlaces.
 * Distribuye palabras dentro de cada frase: Edge proporciona tiempos de frase, no de palabra.
 * Los offsets conservan Markdown y contenido original; el final de audio revela lo no pronunciado.
 */
export function alignSpeechText(content: string, cues: SpeechCue[]): SpeechTextBoundary[] {
  const readable = content
    .replace(/```[\s\S]*?(?:```|$)/g, match => ' '.repeat(match.length))
    .replace(/\]\([^)]*\)/g, match => ' '.repeat(match.length))
    .replace(/<[^>]+>/g, match => ' '.repeat(match.length));
  const source = words(readable);
  const boundaries: SpeechTextBoundary[] = [];
  let cursor = 0;
  for (const cue of cues) {
    const spoken = words(cue.text);
    for (let index = 0; index < spoken.length; index++) {
      const match = source.findIndex((word, position) => position >= cursor && word.value === spoken[index].value);
      if (match < 0) continue;
      boundaries.push({
        startMs: cue.startMs + Math.max(0, cue.endMs - cue.startMs) * index / spoken.length,
        endOffset: source[match].end,
      });
      cursor = match + 1;
    }
  }
  return boundaries;
}
