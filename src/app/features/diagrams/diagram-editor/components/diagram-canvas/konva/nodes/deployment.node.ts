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

/** Vértices (puros) del cubo 3D para un tamaño dado. */
function computeCubeGeometry(width: number, height: number) {
  const depth = 14;
  const frontW = width - depth;
  const frontH = height - depth;
  return {
    depth,
    frontW,
    frontH,
    topPoints: [0, depth, depth, 0, width, 0, frontW, depth],
    rightPoints: [frontW, depth, width, 0, width, frontH, frontW, height],
  };
}

/**
 * Actualiza por diff las caras y textos del cubo existente (sin destruir ni recrear el subárbol).
 *
 * @returns `true` si todas las partes existían y fueron actualizadas.
 */
function updateDeploymentCube(
  group: Konva.Group,
  node: UmlNode,
  width: number,
  height: number,
  isSelected: boolean,
): boolean {
  const top = group.findOne<Konva.Line>('.deploy-top');
  const right = group.findOne<Konva.Line>('.deploy-right');
  const front = group.findOne<Konva.Rect>('.deploy-front');
  const stereo = group.findOne<Konva.Text>('.deploy-stereo');
  const title = group.findOne<Konva.Text>('.deploy-title');
  if (!top || !right || !front || !stereo || !title) return false;

  const { frontW, frontH, topPoints, rightPoints } = computeCubeGeometry(width, height);
  const strokeColor = isSelected ? '#059669' : '#64748B';

  top.setAttrs({ points: topPoints, stroke: strokeColor });
  right.setAttrs({ points: rightPoints, stroke: strokeColor });
  front.setAttrs({
    width: frontW,
    height: frontH,
    stroke: strokeColor,
    strokeWidth: isSelected ? 2 : 1.4,
    fill: node.fill || '#F1F5F9',
  });
  stereo.setAttrs({ width: frontW - 16, text: `«${node.stereotype || 'device'}»` });
  title.setAttrs({ width: frontW - 16, text: node.name });
  return true;
}

function drawDeploymentCube(
  group: Konva.Group,
  node: UmlNode,
  width: number,
  height: number,
  isSelected: boolean,
): void {
  const { depth, frontW, frontH, topPoints, rightPoints } = computeCubeGeometry(width, height);
  const strokeColor = isSelected ? '#059669' : '#64748B';
  const baseFill = node.fill || '#F1F5F9';

  // Top 3D Face
  const topFace = new Konva.Line({
    name: 'deploy-part deploy-top',
    points: topPoints,
    closed: true,
    fill: '#E2E8F0',
    stroke: strokeColor,
    strokeWidth: 1.4,
  });

  // Right 3D Face
  const rightFace = new Konva.Line({
    name: 'deploy-part deploy-right',
    points: rightPoints,
    closed: true,
    fill: '#CBD5E1',
    stroke: strokeColor,
    strokeWidth: 1.4,
  });

  // Front Face
  const frontFace = new Konva.Rect({
    name: 'deploy-part deploy-front',
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
    name: 'deploy-part deploy-stereo',
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
    name: 'deploy-part deploy-title',
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
  isSelected: boolean,
): void {
  const minW = Math.max(150, Math.round(newWidth));
  const minH = Math.max(90, Math.round(newHeight));

  group.width(minW);
  group.height(minH);

  // Diff-update; solo si el subárbol no existe (nodo legado) se reconstruye.
  if (!updateDeploymentCube(group, node, minW, minH, isSelected)) {
    group.find('.deploy-part').forEach((c) => c.destroy());
    drawDeploymentCube(group, node, minW, minH, isSelected);
  }
}
