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

  drawActorGeometry(group, node.width, node.height, node.name, isSelected, node.fill);
  return group;
}

/** Geometría calculada (pura) de todas las partes del actor para un tamaño y etiqueta dados. */
interface ActorGeometry {
  head: { x: number; y: number; radius: number };
  spine: number[];
  arms: number[];
  leftLeg: number[];
  rightLeg: number[];
  pill: { x: number; y: number; width: number };
}

function computeActorGeometry(width: number, height: number, label: string): ActorGeometry {
  const figureHeight = Math.max(48, height - 34);
  const centerX = width / 2;
  const headRadius = Math.max(9, Math.min(width * 0.16, figureHeight * 0.18));
  const headCenterY = headRadius + 4;

  const neckY = headCenterY + headRadius;
  const bodyEndY = neckY + figureHeight * 0.38;
  const armY = neckY + figureHeight * 0.12;
  const armSpan = Math.min(width * 0.35, headRadius * 2.2);
  const legEndY = Math.min(figureHeight, bodyEndY + figureHeight * 0.34);
  const legSpan = Math.min(width * 0.28, headRadius * 1.8);

  // Label Pill Box at bottom (matches reference image)
  const pillWidth = Math.max(width, label.length * 7.2 + 20);

  return {
    head: { x: centerX, y: headCenterY, radius: headRadius },
    spine: [centerX, neckY, centerX, bodyEndY],
    arms: [centerX - armSpan, armY, centerX + armSpan, armY],
    leftLeg: [centerX, bodyEndY, centerX - legSpan, legEndY],
    rightLeg: [centerX, bodyEndY, centerX + legSpan, legEndY],
    pill: { x: (width - pillWidth) / 2, y: height - 26, width: pillWidth },
  };
}

function actorStrokeColor(isSelected: boolean): string {
  return isSelected ? '#059669' : '#292524';
}

function drawActorGeometry(
  group: Konva.Group,
  width: number,
  height: number,
  label: string,
  isSelected: boolean,
  fill?: string,
): void {
  const geo = computeActorGeometry(width, height, label);
  const strokeColor = actorStrokeColor(isSelected);

  const lineAttrs = (name: string, points: number[]): Konva.LineConfig => ({
    name: `actor-part ${name}`,
    points,
    stroke: strokeColor,
    strokeWidth: 2,
    lineCap: 'round',
    listening: false,
  });

  // Stickman Head
  const head = new Konva.Circle({
    name: 'actor-part actor-head',
    x: geo.head.x,
    y: geo.head.y,
    radius: geo.head.radius,
    fill: fill || '#FEF2DD',
    stroke: strokeColor,
    strokeWidth: 2,
    listening: false,
  });

  const spine = new Konva.Line(lineAttrs('actor-spine', geo.spine));
  const arms = new Konva.Line(lineAttrs('actor-arms', geo.arms));
  const leftLeg = new Konva.Line(lineAttrs('actor-left-leg', geo.leftLeg));
  const rightLeg = new Konva.Line(lineAttrs('actor-right-leg', geo.rightLeg));

  const labelBg = new Konva.Rect({
    name: 'actor-part actor-label-bg',
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
    name: 'actor-part actor-label',
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

  group.add(head, spine, arms, leftLeg, rightLeg, labelBg, labelText);
}

/**
 * Actualiza por diff las partes existentes del actor (sin destruir ni recrear el subárbol).
 *
 * @returns `true` si todas las partes existían y fueron actualizadas.
 */
function updateActorGeometry(
  group: Konva.Group,
  width: number,
  height: number,
  label: string,
  isSelected: boolean,
  fill?: string,
): boolean {
  const head = group.findOne<Konva.Circle>('.actor-head');
  const spine = group.findOne<Konva.Line>('.actor-spine');
  const arms = group.findOne<Konva.Line>('.actor-arms');
  const leftLeg = group.findOne<Konva.Line>('.actor-left-leg');
  const rightLeg = group.findOne<Konva.Line>('.actor-right-leg');
  const labelBg = group.findOne<Konva.Rect>('.actor-label-bg');
  const labelText = group.findOne<Konva.Text>('.actor-label');
  if (!head || !spine || !arms || !leftLeg || !rightLeg || !labelBg || !labelText) return false;

  const geo = computeActorGeometry(width, height, label);
  const strokeColor = actorStrokeColor(isSelected);

  head.setAttrs({
    x: geo.head.x,
    y: geo.head.y,
    radius: geo.head.radius,
    stroke: strokeColor,
    ...(fill ? { fill } : {}),
  });
  spine.setAttrs({ points: geo.spine, stroke: strokeColor });
  arms.setAttrs({ points: geo.arms, stroke: strokeColor });
  leftLeg.setAttrs({ points: geo.leftLeg, stroke: strokeColor });
  rightLeg.setAttrs({ points: geo.rightLeg, stroke: strokeColor });
  labelBg.setAttrs({ x: geo.pill.x, y: geo.pill.y, width: geo.pill.width });
  labelText.setAttrs({ x: geo.pill.x + 4, y: geo.pill.y + 6, width: geo.pill.width - 8 });
  if (labelText.text() !== label) labelText.text(label);
  return true;
}

export function resizeActorKonvaNode(
  group: Konva.Group,
  newWidth: number,
  newHeight: number,
  label: string,
  isSelected: boolean,
  fill?: string,
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

  // Diff-update; solo si el subárbol no existe (nodo legado) se reconstruye.
  if (!updateActorGeometry(group, minW, minH, label, isSelected, fill)) {
    group.find('.actor-part').forEach((child) => child.destroy());
    drawActorGeometry(group, minW, minH, label, isSelected, fill);
  }
}
