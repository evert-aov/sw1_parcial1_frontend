import Konva from 'konva';
import { UmlNode } from '../models/uml.model';

export function createDeploymentKonvaNode(node: UmlNode, isSelected: boolean): Konva.Group {
  const group = new Konva.Group({
    id: node.id,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    draggable: true,
    name: 'uml-node',
  });

  drawDeploymentCube(group, node, node.width, node.height, isSelected);
  return group;
}

function drawDeploymentCube(
  group: Konva.Group,
  node: UmlNode,
  width: number,
  height: number,
  isSelected: boolean
): void {
  const depth = 14;
  const frontW = width - depth;
  const frontH = height - depth;
  const strokeColor = isSelected ? '#059669' : '#64748B';
  const baseFill = node.fill || '#F1F5F9';

  // Top 3D Face
  const topFace = new Konva.Line({
    name: 'deploy-part',
    points: [0, depth, depth, 0, width, 0, frontW, depth],
    closed: true,
    fill: '#E2E8F0',
    stroke: strokeColor,
    strokeWidth: 1.4,
  });

  // Right 3D Face
  const rightFace = new Konva.Line({
    name: 'deploy-part',
    points: [frontW, depth, width, 0, width, frontH, frontW, height],
    closed: true,
    fill: '#CBD5E1',
    stroke: strokeColor,
    strokeWidth: 1.4,
  });

  // Front Face
  const frontFace = new Konva.Rect({
    name: 'deploy-part',
    x: 0,
    y: depth,
    width: frontW,
    height: frontH,
    fill: baseFill,
    stroke: strokeColor,
    strokeWidth: isSelected ? 2 : 1.4,
    shadowColor: '#000000',
    shadowBlur: 0,
    shadowOffsetX: 3,
    shadowOffsetY: 3,
    shadowOpacity: 0.08,
  });

  const stereo = new Konva.Text({
    name: 'deploy-part',
    x: 8,
    y: depth + 10,
    width: frontW - 16,
    text: `«${node.stereotype || 'device'}»`,
    fontSize: 11,
    fontFamily: 'JetBrains Mono',
    fontStyle: 'italic',
    fill: '#475569',
    align: 'center',
    listening: false,
  });

  const title = new Konva.Text({
    name: 'deploy-part',
    x: 8,
    y: depth + 28,
    width: frontW - 16,
    text: node.name,
    fontSize: 13.5,
    fontFamily: 'Plus Jakarta Sans',
    fontStyle: 'bold',
    fill: '#0F172A',
    align: 'center',
    listening: false,
  });

  group.add(topFace, rightFace, frontFace, stereo, title);
}

export function resizeDeploymentKonvaNode(
  group: Konva.Group,
  node: UmlNode,
  newWidth: number,
  newHeight: number,
  isSelected: boolean
): void {
  const minW = Math.max(150, Math.round(newWidth));
  const minH = Math.max(90, Math.round(newHeight));

  group.width(minW);
  group.height(minH);

  group.find('.deploy-part').forEach((c) => c.destroy());
  drawDeploymentCube(group, node, minW, minH, isSelected);
}
