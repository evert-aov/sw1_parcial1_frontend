import Konva from 'konva';
import { UmlNode } from '../models/uml.model';

export function createLifelineKonvaNode(node: UmlNode, isSelected: boolean): Konva.Group {
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

  drawLifelineGeometry(group, node, node.width, node.height, isSelected);
  return group;
}

function drawLifelineGeometry(
  group: Konva.Group,
  node: UmlNode,
  width: number,
  height: number,
  isSelected: boolean
): void {
  const centerX = width / 2;
  const headerH = node.isActorLifeline ? 78 : 48;
  const strokeColor = isSelected ? '#059669' : '#78716C';

  if (node.isActorLifeline) {
    // Draw Actor stickman at top of lifeline (matches reference image 3)
    const r = 10;
    const head = new Konva.Circle({
      name: 'lifeline-part',
      x: centerX,
      y: 14,
      radius: r,
      fill: '#FEF9EE',
      stroke: '#292524',
      strokeWidth: 1.8,
      listening: false,
    });
    const spine = new Konva.Line({
      name: 'lifeline-part',
      points: [centerX, 24, centerX, 42],
      stroke: '#292524',
      strokeWidth: 1.8,
      listening: false,
    });
    const arms = new Konva.Line({
      name: 'lifeline-part',
      points: [centerX - 14, 30, centerX + 14, 30],
      stroke: '#292524',
      strokeWidth: 1.8,
      listening: false,
    });
    const legL = new Konva.Line({
      name: 'lifeline-part',
      points: [centerX, 42, centerX - 11, 56],
      stroke: '#292524',
      strokeWidth: 1.8,
      listening: false,
    });
    const legR = new Konva.Line({
      name: 'lifeline-part',
      points: [centerX, 42, centerX + 11, 56],
      stroke: '#292524',
      strokeWidth: 1.8,
      listening: false,
    });
    const pillBg = new Konva.Rect({
      name: 'lifeline-part',
      x: 4,
      y: 58,
      width: width - 8,
      height: 20,
      cornerRadius: 5,
      fill: '#FFFFFF',
      stroke: '#E2E8F0',
      strokeWidth: 1,
      listening: false,
    });
    const pillTxt = new Konva.Text({
      name: 'lifeline-part',
      x: 6,
      y: 63,
      width: width - 12,
      text: node.name,
      fontSize: 11,
      fontFamily: 'Plus Jakarta Sans',
      fontStyle: 'bold',
      fill: '#1E293B',
      align: 'center',
      listening: false,
    });
    group.add(head, spine, arms, legL, legR, pillBg, pillTxt);
  } else {
    // Draw Participant Header Box (Underlined title inside light cyan box)
    const headerBox = new Konva.Rect({
      name: 'lifeline-part',
      x: 0,
      y: 0,
      width,
      height: headerH,
      fill: node.fill || '#E0F2F1',
      stroke: strokeColor,
      strokeWidth: 1.4,
      listening: false,
    });
    const title = new Konva.Text({
      name: 'lifeline-part',
      x: 6,
      y: 17,
      width: width - 12,
      text: node.name,
      fontSize: 12,
      fontFamily: 'Plus Jakarta Sans',
      fontStyle: 'bold',
      textDecoration: 'underline',
      fill: '#1E293B',
      align: 'center',
      listening: false,
    });
    group.add(headerBox, title);
  }

  // Vertical Dashed Stem
  const stem = new Konva.Line({
    name: 'lifeline-part',
    points: [centerX, headerH + 2, centerX, height],
    stroke: '#78716C',
    strokeWidth: 1.5,
    dash: [5, 5],
    listening: false,
  });
  group.add(stem);

  // Execution Specification / Activation Bars
  const activations =
    node.activations && node.activations.length > 0
      ? node.activations
      : [{ id: 'act-default', startY: headerH + 28, height: Math.max(60, height - headerH - 65) }];

  const barFill = node.isActorLifeline ? '#FDF3E1' : '#DCEEF2';
  activations.forEach((act) => {
    const actStart = act.startY ?? (act as any).top ?? headerH + 28;
    const clampedStart = Math.min(height - 25, Math.max(headerH + 8, actStart));
    const clampedH = Math.max(20, Math.min(act.height, height - clampedStart - 8));
    const bar = new Konva.Rect({
      name: 'lifeline-part',
      x: centerX - 6,
      y: clampedStart,
      width: 12,
      height: clampedH,
      fill: barFill,
      stroke: '#78716C',
      strokeWidth: 1.2,
      listening: false,
    });
    group.add(bar);
  });
}

export function resizeLifelineKonvaNode(
  group: Konva.Group,
  node: UmlNode,
  newWidth: number,
  newHeight: number,
  isSelected: boolean
): void {
  const minW = Math.max(115, Math.round(newWidth));
  const minH = Math.max(220, Math.round(newHeight));

  group.width(minW);
  group.height(minH);

  const hitRect = group.findOne<Konva.Rect>('.hit-rect');
  if (hitRect) {
    hitRect.width(minW);
    hitRect.height(minH);
  }

  group.find('.lifeline-part').forEach((c) => c.destroy());
  drawLifelineGeometry(group, node, minW, minH, isSelected);
}
