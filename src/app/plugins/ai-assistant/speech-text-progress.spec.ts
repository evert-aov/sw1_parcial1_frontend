import { describe, expect, it } from 'vitest';
import { alignSpeechText } from './speech-text-progress';

describe('Speech text alignment', () => {
  it('preserves original offsets across Markdown, code and link destinations', () => {
    const content = '**Pedido** y [detalle](https://pedido.invalid).\n```ts\npedido detalle\n```\nRelación múltiple.';
    const boundaries = alignSpeechText(content, [
      { startMs: 100, endMs: 1000, text: 'Pedido y detalle.' },
      { startMs: 1500, endMs: 2500, text: 'Relación múltiple.' },
    ]);
    expect(boundaries.map(boundary => boundary.startMs)).toEqual([100, 400, 700, 1500, 2000]);
    expect(content.slice(0, boundaries[2].endOffset)).toBe('**Pedido** y [detalle');
    expect(content.slice(0, boundaries[4].endOffset)).toBe(content.slice(0, -1));
  });

  it('does not invent alignment for unmatched speech or missing metadata', () => {
    expect(alignSpeechText('Pedido', [])).toEqual([]);
    expect(alignSpeechText('Pedido', [{ startMs: 0, endMs: 1000, text: 'Desconocido' }])).toEqual([]);
  });
});
