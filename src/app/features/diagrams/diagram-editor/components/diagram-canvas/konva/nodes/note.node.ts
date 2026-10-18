import Konva from 'konva';
import { UmlNode } from '../models/uml.model';

/**
 * Computes automatic bounds so multi-line note text never clips vertically
 */
export function computeNoteAutoBounds(node: UmlNode): { width: number; height: number } {
  const lines = (node.name || '').split('\n');
  const longestLineChars = lines.reduce((max, l) => Math.max(max, l.length), 12);
  const minW = Math.max(node.width || 185, Math.min(340, longestLineChars * 6.8 + 32));
  const estimatedLines = Math.max(lines.length, Math.ceil((node.name || '').length / 28));
  const minH = Math.max(node.height || 76, estimatedLines * 18 + 32);
  return { width: minW, height: minH };
}

export function createNoteKonvaNode(node: UmlNode, isSelected: boolean): Konva.Group {
  const bounds = computeNoteAutoBounds(node);
  const group = new Konva.Group({
    id: node.id,
    x: node.x,
    y: node.y,
    width: bounds.width,
    height: bounds.height,
    draggable: true,
    name: 'uml-node',
  });

  drawNoteGeometry(group, node, bounds.width, bounds.height, isSelected);
  return group;
}

const NOTE_FOLD_SIZE = 16;

/** Geometría calculada (pura) de todas las partes de la nota para un tamaño dado. */
interface NoteGeometry {
  bodyPoints: number[];
  flapPoints: number[];
  headerWidth: number;
  bodyTextWidth: number;
  bodyTextHeight: number;
}

function computeNoteGeometry(width: number, height: number): NoteGeometry {
  const foldSize = NOTE_FOLD_SIZE;
  return {
    bodyPoints: [0, 0, width - foldSize, 0, width, foldSize, width, height, 0, height],
    flapPoints: [width - foldSize, 0, width - foldSize, foldSize, width, foldSize],
    headerWidth: width - foldSize - 14,
    bodyTextWidth: width - 20,
    bodyTextHeight: Math.max(24, height - 30),
  };
}

function noteStrokeColor(node: UmlNode, isSelected: boolean): string {
  return isSelected ? '#059669' : node.stroke || '#A89F81';
}

function noteHeaderText(node: UmlNode): string {
  return node.stereotype ? `«${node.stereotype}»` : '«note»';
}

function noteBodyText(node: UmlNode): string {
  return node.name || 'Escribe el contenido de la nota aquí...';
}

function drawNoteGeometry(
  group: Konva.Group,
  node: UmlNode,
  width: number,
  height: number,
  isSelected: boolean,
): void {
  const geo = computeNoteGeometry(width, height);
  const strokeColor = noteStrokeColor(node, isSelected);
  const baseFill = node.fill || '#FEF9C3';

  // Polygon with top-right corner cut for the dog-ear fold
  const noteBody = new Konva.Line({
    name: 'note-part note-body',
    points: geo.bodyPoints,
    closed: true,
    fillLinearGradientStartPoint: { x: 0, y: 0 },
    fillLinearGradientEndPoint: { x: width, y: height },
    fillLinearGradientColorStops: [0, '#FFFBEB', 1, baseFill],
    stroke: strokeColor,
    strokeWidth: isSelected ? 2.1 : 1.4,
    shadowColor: '#000000',
    shadowBlur: 4,
    shadowOffsetX: 3,
    shadowOffsetY: 3,
    shadowOpacity: 0.14,
  });

  // Dog-ear folded corner triangle at top-right
  const foldFlap = new Konva.Line({
    name: 'note-part note-flap',
    points: geo.flapPoints,
    closed: true,
    fill: '#FDE68A',
    stroke: strokeColor,
    strokeWidth: isSelected ? 1.8 : 1.3,
    lineJoin: 'round',
    listening: false,
  });

  // Subtle top header tag «note»
  const headerTag = new Konva.Text({
    name: 'note-part note-header',
    x: 10,
    y: 7,
    width: geo.headerWidth,
    text: noteHeaderText(node),
    fontSize: 10,
    fontFamily: 'JetBrains Mono',
    fontStyle: 'italic',
    fill: '#854D0E',
    listening: false,
  });

  // Editable Note Body Text
  const bodyText = new Konva.Text({
    name: 'note-part note-text',
    x: 10,
    y: 23,
    width: geo.bodyTextWidth,
    height: geo.bodyTextHeight,
    text: noteBodyText(node),
    fontSize: 12,
    fontFamily: 'Plus Jakarta Sans',
    fontStyle: 'normal',
    fill: '#292524',
    lineHeight: 1.35,
    wrap: 'word',
    listening: false,
  });

  group.add(noteBody, foldFlap, headerTag, bodyText);
}

/**
 * Actualiza por diff las partes existentes de la nota (sin destruir ni recrear el subárbol).
 *
 * @returns `true` si todas las partes existían y fueron actualizadas.
 */
function updateNoteGeometry(
  group: Konva.Group,
  node: UmlNode,
  width: number,
  height: number,
  isSelected: boolean,
): boolean {
  const body = group.findOne<Konva.Line>('.note-body');
  const flap = group.findOne<Konva.Line>('.note-flap');
  const header = group.findOne<Konva.Text>('.note-header');
  const text = group.findOne<Konva.Text>('.note-text');
  if (!body || !flap || !header || !text) return false;

  const geo = computeNoteGeometry(width, height);
  const strokeColor = noteStrokeColor(node, isSelected);

  body.setAttrs({
    points: geo.bodyPoints,
    fillLinearGradientEndPoint: { x: width, y: height },
    fillLinearGradientColorStops: [0, '#FFFBEB', 1, node.fill || '#FEF9C3'],
    stroke: strokeColor,
    strokeWidth: isSelected ? 2.1 : 1.4,
  });
  flap.setAttrs({
    points: geo.flapPoints,
    stroke: strokeColor,
    strokeWidth: isSelected ? 1.8 : 1.3,
  });
  header.setAttrs({ width: geo.headerWidth, text: noteHeaderText(node) });
  text.setAttrs({
    width: geo.bodyTextWidth,
    height: geo.bodyTextHeight,
    text: noteBodyText(node),
  });
  return true;
}

export function resizeNoteKonvaNode(
  group: Konva.Group,
  node: UmlNode,
  newWidth: number,
  newHeight: number,
  isSelected: boolean,
): void {
  const minW = Math.max(135, Math.round(newWidth));
  const minH = Math.max(65, Math.round(newHeight));

  group.width(minW);
  group.height(minH);

  // Diff-update; solo si el subárbol no existe (nodo legado) se reconstruye.
  if (!updateNoteGeometry(group, node, minW, minH, isSelected)) {
    group.find('.note-part').forEach((c) => c.destroy());
    drawNoteGeometry(group, node, minW, minH, isSelected);
  }
}
