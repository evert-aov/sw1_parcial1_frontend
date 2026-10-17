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

function drawEntityParts(
  group: Konva.Group,
  width: number,
  height: number,
  label: string,
  fill: string,
  isSelected: boolean
): void {
  const iconAreaH = Math.max(48, height - 34);
  const radius = Math.max(16, Math.min(width * 0.3, iconAreaH * 0.42));
  const centerX = width / 2;
  const centerY = iconAreaH * 0.48;
  const strokeColor = isSelected ? '#059669' : '#292524';

  const circle = new Konva.Circle({
    name: 'entity-part',
    x: centerX,
    y: centerY,
    radius,
    fill,
    stroke: strokeColor,
    strokeWidth: 2.2,
    listening: false,
  });

  // Bottom horizontal underline of the UML Entity icon (◯ with baseline)
  const baseLineY = centerY + radius + 1;
  const baseLine = new Konva.Line({
    name: 'entity-part',
    points: [centerX - radius * 1.15, baseLineY, centerX + radius * 1.15, baseLineY],
    stroke: strokeColor,
    strokeWidth: 2.4,
    lineCap: 'round',
    listening: false,
  });

  // Bottom Label Pill (matches uploaded reference 4)
  const pillW = Math.max(width, label.length * 7.2 + 20);
  const pillX = (width - pillW) / 2;
  const pillY = height - 26;

  const labelBg = new Konva.Rect({
    name: 'entity-part',
    x: pillX,
    y: pillY,
    width: pillW,
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
    name: 'entity-part',
    x: pillX + 4,
    y: pillY + 6,
    width: pillW - 8,
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

export function resizeEntityKonvaNode(
  group: Konva.Group,
  newWidth: number,
  newHeight: number,
  label: string,
  fill: string,
  isSelected: boolean
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

  group.find('.entity-part').forEach((c) => c.destroy());
  drawEntityParts(group, minW, minH, label, fill, isSelected);
}
