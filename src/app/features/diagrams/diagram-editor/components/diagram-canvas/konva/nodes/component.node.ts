import Konva from 'konva';
import { UmlNode } from '../models/uml.model';

export function createComponentKonvaNode(node: UmlNode, isSelected: boolean): Konva.Group {
  const group = new Konva.Group({
    id: node.id,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    draggable: true,
    name: 'uml-node',
  });

  drawComponentGeometry(group, node, node.width, node.height, isSelected);
  return group;
}

function drawComponentGeometry(
  group: Konva.Group,
  node: UmlNode,
  width: number,
  height: number,
  isSelected: boolean
): void {
  const strokeColor = isSelected ? '#059669' : node.stroke || '#8C7F70';
  const baseFill = node.fill || '#FAF1EC';

  // Main Component Rectangle (Matching UML 2.5 style)
  const bgRect = new Konva.Rect({
    name: 'comp-part',
    x: 0,
    y: 0,
    width,
    height,
    fill: baseFill,
    stroke: strokeColor,
    strokeWidth: isSelected ? 2 : 1.25,
    shadowColor: '#000000',
    shadowBlur: 3,
    shadowOffsetX: 2,
    shadowOffsetY: 2,
    shadowOpacity: 0.14,
  });
  group.add(bgRect);

  // UML 2.5 Component Icon in the top-right corner (box with two protruding left ports)
  const iconRightMargin = 10;
  const iconTopMargin = 8;
  const bodyW = 13;
  const bodyH = 17;
  const bodyX = width - iconRightMargin - bodyW;
  const bodyY = iconTopMargin;

  const iconBody = new Konva.Rect({
    name: 'comp-part',
    x: bodyX,
    y: bodyY,
    width: bodyW,
    height: bodyH,
    fill: '#FBF9F6',
    stroke: '#78716C',
    strokeWidth: 1.1,
    listening: false,
  });

  const port1 = new Konva.Rect({
    name: 'comp-part',
    x: bodyX - 4,
    y: bodyY + 3,
    width: 8,
    height: 4,
    fill: '#FBF9F6',
    stroke: '#78716C',
    strokeWidth: 1.1,
    listening: false,
  });

  const port2 = new Konva.Rect({
    name: 'comp-part',
    x: bodyX - 4,
    y: bodyY + 10,
    width: 8,
    height: 4,
    fill: '#FBF9F6',
    stroke: '#78716C',
    strokeWidth: 1.1,
    listening: false,
  });

  group.add(iconBody, port1, port2);

  // Stereotype (e.g. «class», «table», «component», «file»)
  if (node.stereotype) {
    const stereoText = new Konva.Text({
      name: 'comp-part',
      x: 10,
      y: 9,
      width: width - 34,
      text: node.stereotype.startsWith('«') ? node.stereotype : `«${node.stereotype}»`,
      fontSize: 10.5,
      fontFamily: 'Plus Jakarta Sans',
      fontStyle: 'normal',
      fill: '#78716C',
      align: 'center',
      listening: false,
    });
    group.add(stereoText);
  }

  // Component Name
  const titleText = new Konva.Text({
    name: 'comp-part',
    x: 10,
    y: node.stereotype ? 24 : 14,
    width: width - 34,
    text: node.name,
    fontSize: 12,
    fontFamily: 'Plus Jakarta Sans',
    fontStyle: 'bold',
    fill: '#57534E',
    align: 'center',
    listening: false,
  });
  group.add(titleText);
}

export function resizeComponentKonvaNode(
  group: Konva.Group,
  node: UmlNode,
  newWidth: number,
  newHeight: number,
  isSelected: boolean
): void {
  const minW = Math.max(125, Math.round(newWidth));
  const minH = Math.max(60, Math.round(newHeight));

  group.width(minW);
  group.height(minH);

  group.find('.comp-part').forEach((c) => c.destroy());
  drawComponentGeometry(group, node, minW, minH, isSelected);
}
