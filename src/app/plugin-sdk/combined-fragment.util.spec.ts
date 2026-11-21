import { describe, expect, it } from 'vitest';
import {
  formatCombinedFragmentSummary,
  parseCombinedFragment,
  serializeCombinedFragment,
} from './combined-fragment.util';

describe('combined-fragment.util', () => {
  it('parses default alt fragment with 50% divider when name is empty', () => {
    expect(parseCombinedFragment('')).toEqual({
      operator: 'alt',
      operands: ['[condición]', '[else]'],
      dividers: [50],
    });
  });

  it('parses operator and multiple operands separated by --- or ---pct', () => {
    expect(parseCombinedFragment('alt\n[usuario existe]\n---\n[else]')).toEqual({
      operator: 'alt',
      operands: ['[usuario existe]', '[else]'],
      dividers: [50],
    });

    expect(parseCombinedFragment('alt\n[eqw]\n---64.5\n[eqwe]')).toEqual({
      operator: 'alt',
      operands: ['[eqw]', '[eqwe]'],
      dividers: [64.5],
    });
  });

  it('normalizes guards without brackets and persists custom divider positions', () => {
    const serialized = serializeCombinedFragment('alt', ['eqw', 'eqwe'], [38]);
    expect(serialized).toBe('alt\n[eqw]\n---38\n[eqwe]');
    expect(parseCombinedFragment(serialized)).toEqual({
      operator: 'alt',
      operands: ['[eqw]', '[eqwe]'],
      dividers: [38],
    });
  });

  it('formats a compact summary label for explorer and tooltips', () => {
    expect(formatCombinedFragmentSummary('alt\n[usuario existe]\n---50\n[else]')).toBe(
      'alt [usuario existe]',
    );
  });
});
