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

function activityStrokeColor(isSelected: boolean): string {
  return isSelected ? '#059669' : '#292524';
}

/** Atributos del hit box invisible que dependen de la selección. */
function activityHitSelectionAttrs(isSelected: boolean): Konva.RectConfig {
  return {
    stroke: isSelected ? '#10B981' : 'transparent',
    strokeWidth: isSelected ? 1 : 0,
  };
}

function drawActivityNodeGeometry(
  group: Konva.Group,
  node: UmlNode,
  width: number,
  height: number,
  isSelected: boolean,
): void {
  const strokeColor = activityStrokeColor(isSelected);

  // Invisible hit box for smooth selection and resizing
  const hitRect = new Konva.Rect({
    name: 'act-part act-hit',
    x: 0,
    y: 0,
    width,
    height,
    fill: 'rgba(0,0,0,0.001)',
    ...activityHitSelectionAttrs(isSelected),
    dash: [4, 4],
  });
  group.add(hitRect);

  if (node.type === 'activity_initial') {
    // Label "Initial" above black filled circle
    const geo = computeInitialGeometry(width, height);

    const label = new Konva.Text({
      name: 'act-part act-initial-label',
      x: geo.label.x,
      y: geo.label.y,
      width: geo.label.width,
      text: node.name || 'Initial',
      fontSize: 11.5,
      fontFamily: 'Plus Jakarta Sans',
      fill: '#57534E',
      align: 'center',
      listening: false,
    });

    const circle = new Konva.Circle({
      name: 'act-part act-initial-circle',
      x: geo.circle.x,
      y: geo.circle.y,
      radius: geo.circle.radius,
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
    const geo = computeFinalGeometry(width, height);

    const outerCircle = new Konva.Circle({
      name: 'act-part act-final-outer',
      x: geo.outer.x,
      y: geo.outer.y,
      radius: geo.outer.radius,
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
      name: 'act-part act-final-inner',
      x: geo.inner.x,
      y: geo.inner.y,
      radius: geo.inner.radius,
      fill: '#0A0A0A',
      listening: false,
    });

    const label = new Konva.Text({
      name: 'act-part act-final-label',
      x: geo.label.x,
      y: geo.label.y,
      width: geo.label.width,
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
    const actionRect = new Konva.Rect({
      name: 'act-part act-action-rect',
      x: 0,
      y: 0,
      width,
      height,
      cornerRadius: 12,
      fill: node.fill || '#F7F1DF',
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
      name: 'act-part act-action-text',
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
    const geo = computeDecisionGeometry(width, height);

    const diamond = new Konva.Line({
      name: 'act-part act-decision-diamond',
      points: geo.diamondPoints,
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
      name: 'act-part act-decision-label',
      x: -95,
      y: geo.labelY,
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
    const geo = computeForkGeometry(width, height);

    const forkBar = new Konva.Rect({
      name: 'act-part act-fork-bar',
      x: 0,
      y: geo.barY,
      width,
      height: geo.barHeight,
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

// ---------------------------------------------------------------------------
// Geometría pura por tipo de nodo (compartida entre draw y update)
// ---------------------------------------------------------------------------

function computeInitialGeometry(width: number, height: number) {
  const radius = Math.max(10, Math.min(width, height - 18) * 0.34);
  return {
    label: { x: -20, y: 0, width: width + 40 },
    circle: { x: width / 2, y: height - radius - 4, radius },
  };
}

function computeFinalGeometry(width: number, height: number) {
  const outerRadius = Math.max(12, Math.min(width, height - 18) * 0.36);
  const circleY = outerRadius + 4;
  return {
    outer: { x: width / 2, y: circleY, radius: outerRadius },
    inner: { x: width / 2, y: circleY, radius: Math.max(5, outerRadius * 0.46) },
    label: { x: -20, y: circleY + outerRadius + 5, width: width + 40 },
  };
}

function computeDecisionGeometry(width: number, height: number) {
  const cx = width / 2;
  const cy = height / 2;
  return {
    diamondPoints: [cx, 2, width - 2, cy, cx, height - 2, 2, cy],
    labelY: cy - 7,
  };
}

function computeForkGeometry(width: number, height: number) {
  const barHeight = Math.max(6, Math.min(10, height));
  return { barHeight, barY: (height - barHeight) / 2 };
}

/**
 * Actualiza por diff las partes existentes del nodo de actividad (sin destruir ni recrear
 * el subárbol). Cada tipo tiene partes con nombre semántico propio.
 *
 * @returns `true` si todas las partes esperadas existían y fueron actualizadas.
 */
function updateActivityNodeGeometry(
  group: Konva.Group,
  node: UmlNode,
  width: number,
  height: number,
  isSelected: boolean,
): boolean {
  const hitRect = group.findOne<Konva.Rect>('.act-hit');
  if (!hitRect) return false;

  const strokeColor = activityStrokeColor(isSelected);

  if (node.type === 'activity_initial') {
    const label = group.findOne<Konva.Text>('.act-initial-label');
    const circle = group.findOne<Konva.Circle>('.act-initial-circle');
    if (!label || !circle) return false;

    const geo = computeInitialGeometry(width, height);
    hitRect.setAttrs({ width, height, ...activityHitSelectionAttrs(isSelected) });
    label.setAttrs({ x: geo.label.x, y: geo.label.y, width: geo.label.width });
    const text = node.name || 'Initial';
    if (label.text() !== text) label.text(text);
    circle.setAttrs({
      x: geo.circle.x,
      y: geo.circle.y,
      radius: geo.circle.radius,
      stroke: isSelected ? '#059669' : '#0A0A0A',
      strokeWidth: isSelected ? 2 : 1,
    });
    return true;
  }

  if (node.type === 'activity_final') {
    const outer = group.findOne<Konva.Circle>('.act-final-outer');
    const inner = group.findOne<Konva.Circle>('.act-final-inner');
    const label = group.findOne<Konva.Text>('.act-final-label');
    if (!outer || !inner || !label) return false;

    const geo = computeFinalGeometry(width, height);
    hitRect.setAttrs({ width, height, ...activityHitSelectionAttrs(isSelected) });
    outer.setAttrs({
      x: geo.outer.x,
      y: geo.outer.y,
      radius: geo.outer.radius,
      stroke: strokeColor,
      strokeWidth: isSelected ? 2 : 1.5,
    });
    inner.setAttrs({ x: geo.inner.x, y: geo.inner.y, radius: geo.inner.radius });
    label.setAttrs({ x: geo.label.x, y: geo.label.y, width: geo.label.width });
    const text = node.name || 'Final';
    if (label.text() !== text) label.text(text);
    return true;
  }

  if (node.type === 'activity_action') {
    const rect = group.findOne<Konva.Rect>('.act-action-rect');
    const text = group.findOne<Konva.Text>('.act-action-text');
    if (!rect || !text) return false;

    hitRect.setAttrs({ width, height, ...activityHitSelectionAttrs(isSelected) });
    rect.setAttrs({
      width,
      height,
      fill: node.fill || '#F7F1DF',
      stroke: strokeColor,
      strokeWidth: isSelected ? 2.1 : 1.5,
    });
    text.setAttrs({ width: width - 16, height });
    if (text.text() !== node.name) text.text(node.name);
    return true;
  }

  if (node.type === 'activity_decision') {
    const diamond = group.findOne<Konva.Line>('.act-decision-diamond');
    const label = group.findOne<Konva.Text>('.act-decision-label');
    if (!diamond || !label) return false;

    const geo = computeDecisionGeometry(width, height);
    hitRect.setAttrs({ width, height, ...activityHitSelectionAttrs(isSelected) });
    diamond.setAttrs({
      points: geo.diamondPoints,
      fill: node.fill || '#C5DF9B',
      stroke: strokeColor,
      strokeWidth: isSelected ? 2 : 1.4,
    });
    label.setAttrs({ y: geo.labelY });
    if (label.text() !== node.name) label.text(node.name);
    return true;
  }

  if (node.type === 'activity_fork') {
    const bar = group.findOne<Konva.Rect>('.act-fork-bar');
    if (!bar) return false;

    const geo = computeForkGeometry(width, height);
    hitRect.setAttrs({ width, height, ...activityHitSelectionAttrs(isSelected) });
    bar.setAttrs({
      y: geo.barY,
      width,
      height: geo.barHeight,
      stroke: isSelected ? '#059669' : '#262626',
      strokeWidth: isSelected ? 1.8 : 1,
    });
    return true;
  }

  // Tipos sin geometría propia: solo el hit box.
  hitRect.setAttrs({ width, height, ...activityHitSelectionAttrs(isSelected) });
  return true;
}

export function resizeActivityKonvaNode(
  group: Konva.Group,
  node: UmlNode,
  newWidth: number,
  newHeight: number,
  isSelected: boolean,
): void {
  const minW = node.type === 'activity_fork' ? 120 : node.type === 'activity_action' ? 110 : 36;
  const minH = node.type === 'activity_fork' ? 14 : node.type === 'activity_action' ? 50 : 36;

  const w = Math.max(minW, Math.round(newWidth));
  const h = Math.max(minH, Math.round(newHeight));

  group.width(w);
  group.height(h);

  // Diff-update; solo si el subárbol no existe (nodo legado) se reconstruye.
  if (!updateActivityNodeGeometry(group, node, w, h, isSelected)) {
    group.find('.act-part').forEach((c) => c.destroy());
    drawActivityNodeGeometry(group, node, w, h, isSelected);
  }
}
