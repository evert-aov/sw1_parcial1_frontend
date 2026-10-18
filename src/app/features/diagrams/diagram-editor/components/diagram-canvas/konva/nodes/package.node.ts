import Konva from 'konva';
import { UmlNode } from '../models/uml.model';

export function createPackageKonvaNode(node: UmlNode, isSelected: boolean): Konva.Group {
  const group = new Konva.Group({
    id: node.id,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    draggable: true,
    name: 'uml-node',
  });

  drawPackageGeometry(group, node, node.width, node.height, isSelected);
  return group;
}

function drawPackageGeometry(
  group: Konva.Group,
  node: UmlNode,
  width: number,
  height: number,
  isSelected: boolean
): void {
  const strokeColor = isSelected ? '#059669' : node.stroke || '#1C1917';
  const tabHeight = Math.min(32, Math.max(24, Math.round(height * 0.25)));
  const tabWidth = Math.min(width - 18, Math.max(110, Math.round(width * 0.82)));
  const bodyY = tabHeight;
  const bodyHeight = Math.max(40, height - tabHeight);

  const baseFill = node.fill || '#FAF1EC';

  // Drop Shadow Group / Tab & Body matching UML 2.5 package folder
  const tabRect = new Konva.Rect({
    name: 'pkg-folder-part',
    x: 0,
    y: 0,
    width: tabWidth,
    height: tabHeight,
    fill: baseFill,
    stroke: strokeColor,
    strokeWidth: isSelected ? 2 : 1.5,
    shadowColor: '#000000',
    shadowBlur: 0,
    shadowOffsetX: 4,
    shadowOffsetY: 3,
    shadowOpacity: 0.14,
  });

  const bodyRect = new Konva.Rect({
    name: 'pkg-folder-part',
    x: 0,
    y: bodyY,
    width,
    height: bodyHeight,
    fill: baseFill,
    stroke: strokeColor,
    strokeWidth: isSelected ? 2 : 1.5,
    shadowColor: '#000000',
    shadowBlur: 0,
    shadowOffsetX: 5,
    shadowOffsetY: 5,
    shadowOpacity: 0.16,
  });

  const titleText = new Konva.Text({
    name: 'pkg-folder-part',
    x: 10,
    y: Math.max(5, (tabHeight - 14) / 2),
    width: tabWidth - 16,
    text: node.name,
    fontSize: 13.5,
    fontFamily: 'Plus Jakarta Sans',
    fontStyle: 'bold',
    fill: '#57534E',
    align: 'left',
    listening: false,
  });

  group.add(tabRect, bodyRect, titleText);

  if (node.stereotype) {
    const stereoText = new Konva.Text({
      name: 'pkg-folder-part',
      x: 10,
      y: bodyY + 12,
      width: width - 20,
      text: node.stereotype.startsWith('«') ? node.stereotype : `«${node.stereotype}»`,
      fontSize: 11,
      fontFamily: 'JetBrains Mono',
      fontStyle: 'italic',
      fill: '#78716C',
      align: 'center',
      listening: false,
    });
    group.add(stereoText);
  }
}

export function resizePackageKonvaNode(
  group: Konva.Group,
  node: UmlNode,
  newWidth: number,
  newHeight: number,
  isSelected: boolean
): void {
  const minW = Math.max(140, Math.round(newWidth));
  const minH = Math.max(85, Math.round(newHeight));

  group.width(minW);
  group.height(minH);

  group.find('.pkg-folder-part').forEach((c) => c.destroy());
  drawPackageGeometry(group, node, minW, minH, isSelected);
}
