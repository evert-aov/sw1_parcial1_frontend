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

function drawNoteGeometry(
  group: Konva.Group,
  node: UmlNode,
  width: number,
  height: number,
  isSelected: boolean
): void {
  const foldSize = 16;
  const strokeColor = isSelected ? '#059669' : node.stroke || '#A89F81';
  const baseFill = node.fill || '#FEF9C3';

  // Polygon with top-right corner cut for the dog-ear fold
  const noteBody = new Konva.Line({
    name: 'note-part',
    points: [
      0,
      0,
      width - foldSize,
      0,
      width,
      foldSize,
      width,
      height,
      0,
      height,
    ],
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
    name: 'note-part',
    points: [
      width - foldSize,
      0,
      width - foldSize,
      foldSize,
      width,
      foldSize,
    ],
    closed: true,
    fill: '#FDE68A',
    stroke: strokeColor,
    strokeWidth: isSelected ? 1.8 : 1.3,
    lineJoin: 'round',
    listening: false,
  });

  // Subtle top header tag «note»
  const headerTag = new Konva.Text({
    name: 'note-part',
    x: 10,
    y: 7,
    width: width - foldSize - 14,
    text: node.stereotype ? `«${node.stereotype}»` : '«note»',
    fontSize: 10,
    fontFamily: 'JetBrains Mono',
    fontStyle: 'italic',
    fill: '#854D0E',
    listening: false,
  });

  // Editable Note Body Text
  const bodyText = new Konva.Text({
    name: 'note-part',
    x: 10,
    y: 23,
    width: width - 20,
    height: Math.max(24, height - 30),
    text: node.name || 'Escribe el contenido de la nota aquí...',
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

export function resizeNoteKonvaNode(
  group: Konva.Group,
  node: UmlNode,
  newWidth: number,
  newHeight: number,
  isSelected: boolean
): void {
  const minW = Math.max(135, Math.round(newWidth));
  const minH = Math.max(65, Math.round(newHeight));

  group.width(minW);
  group.height(minH);

  group.find('.note-part').forEach((c) => c.destroy());
  drawNoteGeometry(group, node, minW, minH, isSelected);
}
