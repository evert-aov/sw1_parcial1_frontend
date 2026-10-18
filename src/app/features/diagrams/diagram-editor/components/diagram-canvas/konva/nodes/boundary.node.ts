import Konva from 'konva';
import { UmlNode } from '../models/uml.model';

export function createBoundaryKonvaNode(node: UmlNode, isSelected: boolean): Konva.Group {
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

  drawBoundaryParts(group, node.width, node.height, node.name, node.fill || '#E0F2F1', isSelected);
  return group;
}

/** Geometría calculada (pura) de todas las partes del símbolo Boundary. */
interface BoundaryGeometry {
  vBar: number[];
  hStem: number[];
  circle: { x: number; y: number; radius: number };
  pill: { x: number; y: number; width: number };
}

function computeBoundaryGeometry(width: number, height: number, label: string): BoundaryGeometry {
  const iconAreaH = Math.max(46, height - 34);
  const radius = Math.max(16, Math.min(width * 0.28, iconAreaH * 0.42));
  const centerX = width * 0.56;
  const centerY = iconAreaH * 0.5;

  // Left vertical bar of the Boundary symbol (├─◯)
  const barX = centerX - radius - Math.max(12, radius * 0.45);

  const pillW = Math.max(width, label.length * 7.2 + 20);

  return {
    vBar: [barX, centerY - radius * 0.85, barX, centerY + radius * 0.85],
    hStem: [barX, centerY, centerX - radius, centerY],
    circle: { x: centerX, y: centerY, radius },
    pill: { x: (width - pillW) / 2, y: height - 26, width: pillW },
  };
}

function boundaryStrokeColor(isSelected: boolean): string {
  return isSelected ? '#059669' : '#292524';
}

function drawBoundaryParts(
  group: Konva.Group,
  width: number,
  height: number,
  label: string,
  fill: string,
  isSelected: boolean,
): void {
  const geo = computeBoundaryGeometry(width, height, label);
  const strokeColor = boundaryStrokeColor(isSelected);

  const vBar = new Konva.Line({
    name: 'boundary-part boundary-vbar',
    points: geo.vBar,
    stroke: strokeColor,
    strokeWidth: 2.2,
    lineCap: 'round',
    listening: false,
  });

  // Horizontal stem connecting vertical bar to circle
  const hStem = new Konva.Line({
    name: 'boundary-part boundary-stem',
    points: geo.hStem,
    stroke: strokeColor,
    strokeWidth: 2.2,
    listening: false,
  });

  // Boundary Circle
  const circle = new Konva.Circle({
    name: 'boundary-part boundary-circle',
    x: geo.circle.x,
    y: geo.circle.y,
    radius: geo.circle.radius,
    fill,
    stroke: strokeColor,
    strokeWidth: 2.2,
    listening: false,
  });

  // Bottom Label Pill
  const labelBg = new Konva.Rect({
    name: 'boundary-part boundary-label-bg',
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
    name: 'boundary-part boundary-label',
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

  group.add(vBar, hStem, circle, labelBg, labelText);
}

/**
 * Actualiza por diff las partes existentes del Boundary (sin destruir ni recrear el subárbol).
 *
 * @returns `true` si todas las partes existían y fueron actualizadas.
 */
function updateBoundaryParts(
  group: Konva.Group,
  width: number,
  height: number,
  label: string,
  fill: string,
  isSelected: boolean,
): boolean {
  const vBar = group.findOne<Konva.Line>('.boundary-vbar');
  const hStem = group.findOne<Konva.Line>('.boundary-stem');
  const circle = group.findOne<Konva.Circle>('.boundary-circle');
  const labelBg = group.findOne<Konva.Rect>('.boundary-label-bg');
  const labelText = group.findOne<Konva.Text>('.boundary-label');
  if (!vBar || !hStem || !circle || !labelBg || !labelText) return false;

  const geo = computeBoundaryGeometry(width, height, label);
  const strokeColor = boundaryStrokeColor(isSelected);

  vBar.setAttrs({ points: geo.vBar, stroke: strokeColor });
  hStem.setAttrs({ points: geo.hStem, stroke: strokeColor });
  circle.setAttrs({
    x: geo.circle.x,
    y: geo.circle.y,
    radius: geo.circle.radius,
    fill,
    stroke: strokeColor,
  });
  labelBg.setAttrs({ x: geo.pill.x, y: geo.pill.y, width: geo.pill.width });
  labelText.setAttrs({ x: geo.pill.x + 4, y: geo.pill.y + 6, width: geo.pill.width - 8 });
  if (labelText.text() !== label) labelText.text(label);
  return true;
}

export function resizeBoundaryKonvaNode(
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
  if (!updateBoundaryParts(group, minW, minH, label, fill, isSelected)) {
    group.find('.boundary-part').forEach((c) => c.destroy());
    drawBoundaryParts(group, minW, minH, label, fill, isSelected);
  }
}
