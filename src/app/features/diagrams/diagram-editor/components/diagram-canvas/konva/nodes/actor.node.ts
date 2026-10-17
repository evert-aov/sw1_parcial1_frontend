import Konva from 'konva';
import { UmlNode } from '../models/uml.model';

export function createActorKonvaNode(node: UmlNode, isSelected: boolean): Konva.Group {
  const group = new Konva.Group({
    id: node.id,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    draggable: true,
    name: 'uml-node',
  });

  // Invisible hit box for smooth selection and resizing
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

  drawActorGeometry(group, node.width, node.height, node.name, isSelected);
  return group;
}

function drawActorGeometry(
  group: Konva.Group,
  width: number,
  height: number,
  label: string,
  isSelected: boolean
): void {
  const figureHeight = Math.max(48, height - 34);
  const centerX = width / 2;
  const headRadius = Math.max(9, Math.min(width * 0.16, figureHeight * 0.18));
  const headCenterY = headRadius + 4;
  const strokeColor = isSelected ? '#059669' : '#292524';

  // Stickman Head
  const head = new Konva.Circle({
    name: 'actor-part',
    x: centerX,
    y: headCenterY,
    radius: headRadius,
    fill: '#FEF9EE',
    stroke: strokeColor,
    strokeWidth: 2,
    listening: false,
  });

  const neckY = headCenterY + headRadius;
  const bodyEndY = neckY + figureHeight * 0.38;
  const armY = neckY + figureHeight * 0.12;
  const armSpan = Math.min(width * 0.35, headRadius * 2.2);
  const legEndY = Math.min(figureHeight, bodyEndY + figureHeight * 0.34);
  const legSpan = Math.min(width * 0.28, headRadius * 1.8);

  // Spine
  const spine = new Konva.Line({
    name: 'actor-part',
    points: [centerX, neckY, centerX, bodyEndY],
    stroke: strokeColor,
    strokeWidth: 2,
    lineCap: 'round',
    listening: false,
  });

  // Arms
  const arms = new Konva.Line({
    name: 'actor-part',
    points: [centerX - armSpan, armY, centerX + armSpan, armY],
    stroke: strokeColor,
    strokeWidth: 2,
    lineCap: 'round',
    listening: false,
  });

  // Left Leg
  const leftLeg = new Konva.Line({
    name: 'actor-part',
    points: [centerX, bodyEndY, centerX - legSpan, legEndY],
    stroke: strokeColor,
    strokeWidth: 2,
    lineCap: 'round',
    listening: false,
  });

  // Right Leg
  const rightLeg = new Konva.Line({
    name: 'actor-part',
    points: [centerX, bodyEndY, centerX + legSpan, legEndY],
    stroke: strokeColor,
    strokeWidth: 2,
    lineCap: 'round',
    listening: false,
  });

  // Label Pill Box at bottom (matches reference image)
  const pillWidth = Math.max(width, label.length * 7.2 + 20);
  const pillX = (width - pillWidth) / 2;
  const pillY = height - 26;

  const labelBg = new Konva.Rect({
    name: 'actor-part',
    x: pillX,
    y: pillY,
    width: pillWidth,
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
    name: 'actor-part',
    x: pillX + 4,
    y: pillY + 6,
    width: pillWidth - 8,
    text: label,
    fontSize: 12,
    fontFamily: 'Plus Jakarta Sans',
    fontStyle: 'bold',
    fill: '#1E293B',
    align: 'center',
    listening: false,
  });

  group.add(head, spine, arms, leftLeg, rightLeg, labelBg, labelText);
}

export function resizeActorKonvaNode(
  group: Konva.Group,
  newWidth: number,
  newHeight: number,
  label: string,
  isSelected: boolean
): void {
  const minW = Math.max(80, Math.round(newWidth));
  const minH = Math.max(95, Math.round(newHeight));

  group.width(minW);
  group.height(minH);

  const hitRect = group.findOne<Konva.Rect>('.hit-rect');
  if (hitRect) {
    hitRect.width(minW);
    hitRect.height(minH);
  }

  group.find('.actor-part').forEach((child) => child.destroy());
  drawActorGeometry(group, minW, minH, label, isSelected);
}
