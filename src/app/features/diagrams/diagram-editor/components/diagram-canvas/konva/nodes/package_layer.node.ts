import Konva from 'konva';
import { UmlNode } from '../models/uml.model';

export function createPackageLayerKonvaNode(node: UmlNode, isSelected: boolean): Konva.Group {
  const group = new Konva.Group({
    id: node.id,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    draggable: true,
    name: 'uml-node',
  });

  drawPackageLayerGeometry(group, node, node.width, node.height, isSelected);
  return group;
}

function drawPackageLayerGeometry(
  group: Konva.Group,
  node: UmlNode,
  width: number,
  height: number,
  isSelected: boolean
): void {
  const strokeColor = isSelected ? '#059669' : node.stroke || '#9CA3AF';
  const fillColor = node.fill || 'rgba(248, 250, 252, 0.65)';
  const isBoundary =
    (node.type as string) === 'boundary_box' ||
    (node.id || '').startsWith('boundary_box_') ||
    (node.id || '').startsWith('bbox_');

  const containerRect = new Konva.Rect({
    name: 'pkg-part',
    x: 0,
    y: 0,
    width,
    height,
    fill: fillColor,
    stroke: strokeColor,
    strokeWidth: isSelected ? 2 : 1.35,
    dash: isBoundary ? [6, 4] : undefined,
    shadowColor: '#000000',
    shadowBlur: 4,
    shadowOffsetX: 2,
    shadowOffsetY: 2,
    shadowOpacity: 0.1,
  });

  const titleText = new Konva.Text({
    name: 'pkg-part',
    x: 12,
    y: 7,
    width: width - 24,
    text: node.name,
    fontSize: 11.5,
    fontFamily: 'Plus Jakarta Sans',
    fontStyle: 'bold',
    fill: '#78716C',
    align: isBoundary ? 'left' : 'center',
    listening: false,
  });

  group.add(containerRect, titleText);
}

export function resizePackageLayerKonvaNode(
  group: Konva.Group,
  node: UmlNode,
  newWidth: number,
  newHeight: number,
  isSelected: boolean
): void {
  const minW = Math.max(160, Math.round(newWidth));
  const minH = Math.max(80, Math.round(newHeight));

  group.width(minW);
  group.height(minH);

  group.find('.pkg-part').forEach((c) => c.destroy());
  drawPackageLayerGeometry(group, node, minW, minH, isSelected);
}
