export const IMPORTED_SEQUENCE_PALETTE = [
  '#241C18', // 1: Negro Carbón
  '#8B0000', // 2: Guindo / Rojo Carmín Oscuro (como en EA)
  '#15803D', // 3: Verde Bosque (como en EA)
  '#1D4ED8', // 4: Azul Real
  '#7C3AED', // 5: Violeta Púrpura
  '#C2410C', // 6: Naranja Óxido
  '#0E7490', // 7: Cian Océano
  '#BE185D', // 8: Rosa / Magenta
  '#4D7C0F', // 9: Verde Oliva
  '#4338CA', // 10: Índigo Profundo
];

export function getImportedSequenceColor(sequenceNumber?: string): string {
  const match = (sequenceNumber || '').trim().match(/^(\d+)/);
  const group = match ? parseInt(match[1], 10) : 1;
  return IMPORTED_SEQUENCE_PALETTE[(Math.max(1, group) - 1) % IMPORTED_SEQUENCE_PALETTE.length];
}
