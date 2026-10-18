import Konva from 'konva';
import { UmlNode } from '../models/uml.model';

export function createEntityKonvaNode(node: UmlNode, isSelected: boolean): Konva.Group {
  const group = new Konva.Group({
    id: node.id,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    draggable: true,
    name: 'uml-node',
  });

  const hitRect = new Konva.Rect({
    name: 'hit-rect',
    x: 0,
    y: 0,
    width: node.width,
    height: node.height,
    fill: 'rgba(0,0,0,0.001)',
    stroke: isSelected ? '#10B981' : 'transparent',
    strokeWidth: isSelected ? 1 : 0,
    dash: [4, 4],
  });
  group.add(hitRect);

  drawEntityParts(group, node.width, node.height, node.name, node.fill || '#E0F2F1', isSelected);
  return group;
}

/** Geometría calculada (pura) de todas las partes del símbolo Entity. */
interface EntityGeometry {
  circle: { x: number; y: number; radius: number };
  baseLinePoints: number[];
  pill: { x: number; y: number; width: number };
}

function computeEntityGeometry(width: number, height: number, label: string): EntityGeometry {
  const iconAreaH = Math.max(48, height - 34);
  const radius = Math.max(16, Math.min(width * 0.3, iconAreaH * 0.42));
  const centerX = width / 2;
  const centerY = iconAreaH * 0.48;

  // Bottom horizontal underline of the UML Entity icon (◯ with baseline)
  const baseLineY = centerY + radius + 1;

  const pillW = Math.max(width, label.length * 7.2 + 20);

  return {
    circle: { x: centerX, y: centerY, radius },
    baseLinePoints: [centerX - radius * 1.15, baseLineY, centerX + radius * 1.15, baseLineY],
    pill: { x: (width - pillW) / 2, y: height - 26, width: pillW },
  };
}

function entityStrokeColor(isSelected: boolean): string {
  return isSelected ? '#059669' : '#292524';
}

function drawEntityParts(
  group: Konva.Group,
  width: number,
  height: number,
  label: string,
  fill: string,
  isSelected: boolean,
): void {
  const geo = computeEntityGeometry(width, height, label);
  const strokeColor = entityStrokeColor(isSelected);

  const circle = new Konva.Circle({
    name: 'entity-part entity-circle',
    x: geo.circle.x,
    y: geo.circle.y,
    radius: geo.circle.radius,
    fill,
    stroke: strokeColor,
    strokeWidth: 2.2,
    listening: false,
  });

  const baseLine = new Konva.Line({
    name: 'entity-part entity-baseline',
    points: geo.baseLinePoints,
    stroke: strokeColor,
    strokeWidth: 2.4,
    lineCap: 'round',
    listening: false,
  });

  // Bottom Label Pill (matches uploaded reference 4)
  const labelBg = new Konva.Rect({
    name: 'entity-part entity-label-bg',
    x: geo.pill.x,
    y: geo.pill.y,
    width: geo.pill.width,
    height: 24,
    cornerRadius: 6,
    fill: '#FFFFFF',
    stroke: '#E2E8F0',
    strokeWidth: 1.2,
    shadowColor: '#000000',
    shadowBlur: 4,
    shadowOffsetY: 1,
    shadowOpacity: 0.06,
    listening: false,
  });

  const labelText = new Konva.Text({
    name: 'entity-part entity-label',
    x: geo.pill.x + 4,
    y: geo.pill.y + 6,
    width: geo.pill.width - 8,
    text: label,
    fontSize: 12,
    fontFamily: 'Plus Jakarta Sans',
    fontStyle: 'bold',
    fill: '#1E293B',
    align: 'center',
    listening: false,
  });

  group.add(circle, baseLine, labelBg, labelText);
}

/**
 * Actualiza por diff las partes existentes del Entity (sin destruir ni recrear el subárbol).
 *
 * @returns `true` si todas las partes existían y fueron actualizadas.
 */
function updateEntityParts(
  group: Konva.Group,
  width: number,
  height: number,
  label: string,
  fill: string,
  isSelected: boolean,
): boolean {
  const circle = group.findOne<Konva.Circle>('.entity-circle');
  const baseLine = group.findOne<Konva.Line>('.entity-baseline');
  const labelBg = group.findOne<Konva.Rect>('.entity-label-bg');
  const labelText = group.findOne<Konva.Text>('.entity-label');
  if (!circle || !baseLine || !labelBg || !labelText) return false;

  const geo = computeEntityGeometry(width, height, label);
  const strokeColor = entityStrokeColor(isSelected);

  circle.setAttrs({
    x: geo.circle.x,
    y: geo.circle.y,
    radius: geo.circle.radius,
    fill,
    stroke: strokeColor,
  });
  baseLine.setAttrs({ points: geo.baseLinePoints, stroke: strokeColor });
  labelBg.setAttrs({ x: geo.pill.x, y: geo.pill.y, width: geo.pill.width });
  labelText.setAttrs({ x: geo.pill.x + 4, y: geo.pill.y + 6, width: geo.pill.width - 8 });
  if (labelText.text() !== label) labelText.text(label);
  return true;
}

export function resizeEntityKonvaNode(
  group: Konva.Group,
  newWidth: number,
  newHeight: number,
  label: string,
  fill: string,
  isSelected: boolean,
): void {
  const minW = Math.max(95, Math.round(newWidth));
  const minH = Math.max(90, Math.round(newHeight));

  group.width(minW);
  group.height(minH);

  const hitRect = group.findOne<Konva.Rect>('.hit-rect');
  if (hitRect) {
    hitRect.width(minW);
    hitRect.height(minH);
  }

  // Diff-update; solo si el subárbol no existe (nodo legado) se reconstruye.
  if (!updateEntityParts(group, minW, minH, label, fill, isSelected)) {
    group.find('.entity-part').forEach((c) => c.destroy());
    drawEntityParts(group, minW, minH, label, fill, isSelected);
  }
}
