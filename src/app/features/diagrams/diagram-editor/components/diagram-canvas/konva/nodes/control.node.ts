import Konva from 'konva';
import { UmlNode } from '../models/uml.model';

export function createControlKonvaNode(node: UmlNode, isSelected: boolean): Konva.Group {
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

  drawControlParts(group, node.width, node.height, node.name, node.fill || '#E0F2F1', isSelected);
  return group;
}

/** Geometría calculada (pura) de todas las partes del símbolo Control. */
interface ControlGeometry {
  circle: { x: number; y: number; radius: number };
  arrowPoints: number[];
  pill: { x: number; y: number; width: number };
}

function computeControlGeometry(width: number, height: number, label: string): ControlGeometry {
  const iconAreaH = Math.max(48, height - 34);
  const radius = Math.max(16, Math.min(width * 0.3, iconAreaH * 0.4));
  const centerX = width / 2;
  const centerY = iconAreaH * 0.52;

  // Top arrow head of the UML Control icon
  const topY = centerY - radius;
  const arrowSize = Math.max(6, radius * 0.28);

  const pillW = Math.max(width, label.length * 7.2 + 20);

  return {
    circle: { x: centerX, y: centerY, radius },
    arrowPoints: [
      centerX + arrowSize * 0.9,
      topY - arrowSize * 0.85,
      centerX - arrowSize * 0.3,
      topY,
      centerX + arrowSize * 0.9,
      topY + arrowSize * 0.85,
    ],
    pill: { x: (width - pillW) / 2, y: height - 26, width: pillW },
  };
}

function controlStrokeColor(isSelected: boolean): string {
  return isSelected ? '#059669' : '#292524';
}

function drawControlParts(
  group: Konva.Group,
  width: number,
  height: number,
  label: string,
  fill: string,
  isSelected: boolean,
): void {
  const geo = computeControlGeometry(width, height, label);
  const strokeColor = controlStrokeColor(isSelected);

  const circle = new Konva.Circle({
    name: 'control-part control-circle',
    x: geo.circle.x,
    y: geo.circle.y,
    radius: geo.circle.radius,
    fill,
    stroke: strokeColor,
    strokeWidth: 2.2,
    listening: false,
  });

  const arrowHead = new Konva.Line({
    name: 'control-part control-arrow',
    points: geo.arrowPoints,
    stroke: strokeColor,
    strokeWidth: 2.2,
    lineCap: 'round',
    lineJoin: 'round',
    listening: false,
  });

  // Bottom Label Pill
  const labelBg = new Konva.Rect({
    name: 'control-part control-label-bg',
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
    name: 'control-part control-label',
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

  group.add(circle, arrowHead, labelBg, labelText);
}

/**
 * Actualiza por diff las partes existentes del Control (sin destruir ni recrear el subárbol).
 *
 * @returns `true` si todas las partes existían y fueron actualizadas.
 */
function updateControlParts(
  group: Konva.Group,
  width: number,
  height: number,
  label: string,
  fill: string,
  isSelected: boolean,
): boolean {
  const circle = group.findOne<Konva.Circle>('.control-circle');
  const arrowHead = group.findOne<Konva.Line>('.control-arrow');
  const labelBg = group.findOne<Konva.Rect>('.control-label-bg');
  const labelText = group.findOne<Konva.Text>('.control-label');
  if (!circle || !arrowHead || !labelBg || !labelText) return false;

  const geo = computeControlGeometry(width, height, label);
  const strokeColor = controlStrokeColor(isSelected);

  circle.setAttrs({
    x: geo.circle.x,
    y: geo.circle.y,
    radius: geo.circle.radius,
    fill,
    stroke: strokeColor,
  });
  arrowHead.setAttrs({ points: geo.arrowPoints, stroke: strokeColor });
  labelBg.setAttrs({ x: geo.pill.x, y: geo.pill.y, width: geo.pill.width });
  labelText.setAttrs({ x: geo.pill.x + 4, y: geo.pill.y + 6, width: geo.pill.width - 8 });
  if (labelText.text() !== label) labelText.text(label);
  return true;
}

export function resizeControlKonvaNode(
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
  if (!updateControlParts(group, minW, minH, label, fill, isSelected)) {
    group.find('.control-part').forEach((c) => c.destroy());
    drawControlParts(group, minW, minH, label, fill, isSelected);
  }
}
