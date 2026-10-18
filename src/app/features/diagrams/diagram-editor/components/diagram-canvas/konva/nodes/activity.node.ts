import Konva from 'konva';
import { UmlNode } from '../models/uml.model';

export function createActivityKonvaNode(node: UmlNode, isSelected: boolean): Konva.Group {
  const group = new Konva.Group({
    id: node.id,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    draggable: true,
    name: 'uml-node',
  });

  drawActivityNodeGeometry(group, node, node.width, node.height, isSelected);
  return group;
}

function drawActivityNodeGeometry(
  group: Konva.Group,
  node: UmlNode,
  width: number,
  height: number,
  isSelected: boolean
): void {
  const strokeColor = isSelected ? '#059669' : '#292524';

  // Invisible hit box for smooth selection and resizing
  const hitRect = new Konva.Rect({
    name: 'act-part',
    x: 0,
    y: 0,
    width,
    height,
    fill: 'rgba(0,0,0,0.001)',
    stroke: isSelected ? '#10B981' : 'transparent',
    strokeWidth: isSelected ? 1 : 0,
    dash: [4, 4],
  });
  group.add(hitRect);

  if (node.type === 'activity_initial') {
    // Label "Initial" above black filled circle
    const centerX = width / 2;
    const radius = Math.max(10, Math.min(width, height - 18) * 0.34);
    const circleY = height - radius - 4;

    const label = new Konva.Text({
      name: 'act-part',
      x: -20,
      y: 0,
      width: width + 40,
      text: node.name || 'Initial',
      fontSize: 11.5,
      fontFamily: 'Plus Jakarta Sans',
      fill: '#57534E',
      align: 'center',
      listening: false,
    });

    const circle = new Konva.Circle({
      name: 'act-part',
      x: centerX,
      y: circleY,
      radius,
      fill: '#0A0A0A',
      stroke: isSelected ? '#059669' : '#0A0A0A',
      strokeWidth: isSelected ? 2 : 1,
      shadowColor: '#000000',
      shadowBlur: 3,
      shadowOffsetX: 2,
      shadowOffsetY: 2,
      shadowOpacity: 0.2,
      listening: false,
    });

    group.add(label, circle);
    return;
  }

  if (node.type === 'activity_final') {
    // Bullseye: Soft green outer ring + black inner circle + "Final" label below
    const centerX = width / 2;
    const outerRadius = Math.max(12, Math.min(width, height - 18) * 0.36);
    const circleY = outerRadius + 4;

    const outerCircle = new Konva.Circle({
      name: 'act-part',
      x: centerX,
      y: circleY,
      radius: outerRadius,
      fill: '#C5DF9B',
      stroke: strokeColor,
      strokeWidth: isSelected ? 2 : 1.5,
      shadowColor: '#000000',
      shadowBlur: 3,
      shadowOffsetX: 2,
      shadowOffsetY: 2,
      shadowOpacity: 0.16,
      listening: false,
    });

    const innerCircle = new Konva.Circle({
      name: 'act-part',
      x: centerX,
      y: circleY,
      radius: Math.max(5, outerRadius * 0.46),
      fill: '#0A0A0A',
      listening: false,
    });

    const label = new Konva.Text({
      name: 'act-part',
      x: -20,
      y: circleY + outerRadius + 5,
      width: width + 40,
      text: node.name || 'Final',
      fontSize: 11.5,
      fontFamily: 'Plus Jakarta Sans',
      fill: '#57534E',
      align: 'center',
      listening: false,
    });

    group.add(outerCircle, innerCircle, label);
    return;
  }

  if (node.type === 'activity_action') {
    // Rounded cream/gold gradient Action box
    const actionFill = node.fill || '#F7F1DF';
    const actionRect = new Konva.Rect({
      name: 'act-part',
      x: 0,
      y: 0,
      width,
      height,
      cornerRadius: 12,
      fill: actionFill,
      stroke: strokeColor,
      strokeWidth: isSelected ? 2.1 : 1.5,
      shadowColor: '#000000',
      shadowBlur: 3,
      shadowOffsetX: 2,
      shadowOffsetY: 2,
      shadowOpacity: 0.15,
      listening: false,
    });

    const actionText = new Konva.Text({
      name: 'act-part',
      x: 8,
      y: 0,
      width: width - 16,
      height,
      text: node.name,
      fontSize: 12.5,
      fontFamily: 'Plus Jakarta Sans',
      fontStyle: 'bold',
      fill: '#57534E',
      align: 'center',
      verticalAlign: 'middle',
      listening: false,
    });

    group.add(actionRect, actionText);
    return;
  }

  if (node.type === 'activity_decision') {
    // Green Diamond with label to the left
    const cx = width / 2;
    const cy = height / 2;

    const diamond = new Konva.Line({
      name: 'act-part',
      points: [cx, 2, width - 2, cy, cx, height - 2, 2, cy],
      closed: true,
      fill: node.fill || '#C5DF9B',
      stroke: strokeColor,
      strokeWidth: isSelected ? 2 : 1.4,
      shadowColor: '#000000',
      shadowBlur: 3,
      shadowOffsetX: 2,
      shadowOffsetY: 2,
      shadowOpacity: 0.16,
      listening: false,
    });

    const sideLabel = new Konva.Text({
      name: 'act-part',
      x: -95,
      y: cy - 7,
      width: 88,
      text: node.name,
      fontSize: 11.5,
      fontFamily: 'Plus Jakarta Sans',
      fill: '#57534E',
      align: 'right',
      listening: false,
    });

    group.add(diamond, sideLabel);
    return;
  }

  if (node.type === 'activity_fork') {
    // Horizontal dark Synchronization Bar (Fork / Join)
    const barHeight = Math.max(6, Math.min(10, height));
    const barY = (height - barHeight) / 2;

    const forkBar = new Konva.Rect({
      name: 'act-part',
      x: 0,
      y: barY,
      width,
      height: barHeight,
      cornerRadius: 2,
      fill: '#3F3F3F',
      stroke: isSelected ? '#059669' : '#262626',
      strokeWidth: isSelected ? 1.8 : 1,
      shadowColor: '#000000',
      shadowBlur: 3,
      shadowOffsetX: 2,
      shadowOffsetY: 2,
      shadowOpacity: 0.2,
      listening: false,
    });

    group.add(forkBar);
  }
}

export function resizeActivityKonvaNode(
  group: Konva.Group,
  node: UmlNode,
  newWidth: number,
  newHeight: number,
  isSelected: boolean
): void {
  const minW = node.type === 'activity_fork' ? 120 : node.type === 'activity_action' ? 110 : 36;
  const minH = node.type === 'activity_fork' ? 14 : node.type === 'activity_action' ? 50 : 36;

  const w = Math.max(minW, Math.round(newWidth));
  const h = Math.max(minH, Math.round(newHeight));

  group.width(w);
  group.height(h);

  group.find('.act-part').forEach((c) => c.destroy());
  drawActivityNodeGeometry(group, node, w, h, isSelected);
}
