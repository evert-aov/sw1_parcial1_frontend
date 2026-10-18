import Konva from 'konva';
import { ActivationBox, UmlNode } from '../models/uml.model';

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

/** Geometría calculada (pura) de las partes de la línea de vida para un tamaño dado. */
interface LifelineGeometry {
  centerX: number;
  headerH: number;
  /** Cabecera de actor (monigote + píldora); solo se usa si `isActorLifeline`. */
  actor: {
    head: { x: number; y: number };
    spine: number[];
    arms: number[];
    legL: number[];
    legR: number[];
    pill: { x: number; y: number; width: number };
    pillText: { x: number; y: number; width: number };
  };
  /** Cabecera de participante (caja + título subrayado). */
  participant: {
    box: { width: number; height: number };
    title: { x: number; y: number; width: number };
  };
  stem: number[];
  bars: { x: number; y: number; height: number }[];
}

type ActivationWithLegacyTop = ActivationBox & { top?: number };

function computeLifelineGeometry(node: UmlNode, width: number, height: number): LifelineGeometry {
  const centerX = width / 2;
  const headerH = node.isActorLifeline ? 78 : 48;

  const activations: ActivationBox[] =
    node.activations && node.activations.length > 0
      ? node.activations
      : [{ id: 'act-default', startY: headerH + 28, height: Math.max(60, height - headerH - 65) }];

  const bars = activations.map((act) => {
    // `top` es un campo legado que aún puede venir en diagramas antiguos.
    const actStart = act.startY ?? (act as ActivationWithLegacyTop).top ?? headerH + 28;
    const clampedStart = Math.min(height - 25, Math.max(headerH + 8, actStart));
    const clampedH = Math.max(20, Math.min(act.height, height - clampedStart - 8));
    return { x: centerX - 6, y: clampedStart, height: clampedH };
  });

  return {
    centerX,
    headerH,
    actor: {
      head: { x: centerX, y: 14 },
      spine: [centerX, 24, centerX, 42],
      arms: [centerX - 14, 30, centerX + 14, 30],
      legL: [centerX, 42, centerX - 11, 56],
      legR: [centerX, 42, centerX + 11, 56],
      pill: { x: 4, y: 58, width: width - 8 },
      pillText: { x: 6, y: 63, width: width - 12 },
    },
    participant: {
      box: { width, height: headerH },
      title: { x: 6, y: 17, width: width - 12 },
    },
    stem: [centerX, headerH + 2, centerX, height],
    bars,
  };
}

function lifelineBarFill(node: UmlNode): string {
  return node.isActorLifeline ? '#FDF3E1' : '#DCEEF2';
}

function createLifelineBar(
  bar: { x: number; y: number; height: number },
  fill: string,
): Konva.Rect {
  return new Konva.Rect({
    name: 'lifeline-part lifeline-activation',
    x: bar.x,
    y: bar.y,
    width: 12,
    height: bar.height,
    fill,
    stroke: '#78716C',
    strokeWidth: 1.2,
    listening: false,
  });
}

function drawLifelineGeometry(
  group: Konva.Group,
  node: UmlNode,
  width: number,
  height: number,
  isSelected: boolean,
): void {
  const geo = computeLifelineGeometry(node, width, height);
  const strokeColor = isSelected ? '#059669' : '#78716C';

  if (node.isActorLifeline) {
    // Draw Actor stickman at top of lifeline (matches reference image 3)
    const head = new Konva.Circle({
      name: 'lifeline-part lifeline-head',
      x: geo.actor.head.x,
      y: geo.actor.head.y,
      radius: 10,
      fill: '#FEF9EE',
      stroke: '#292524',
      strokeWidth: 1.8,
      listening: false,
    });
    const lineAttrs = (name: string, points: number[]): Konva.LineConfig => ({
      name: `lifeline-part ${name}`,
      points,
      stroke: '#292524',
      strokeWidth: 1.8,
      listening: false,
    });
    const spine = new Konva.Line(lineAttrs('lifeline-spine', geo.actor.spine));
    const arms = new Konva.Line(lineAttrs('lifeline-arms', geo.actor.arms));
    const legL = new Konva.Line(lineAttrs('lifeline-leg-l', geo.actor.legL));
    const legR = new Konva.Line(lineAttrs('lifeline-leg-r', geo.actor.legR));
    const pillBg = new Konva.Rect({
      name: 'lifeline-part lifeline-pill-bg',
      x: geo.actor.pill.x,
      y: geo.actor.pill.y,
      width: geo.actor.pill.width,
      height: 20,
      cornerRadius: 5,
      fill: '#FFFFFF',
      stroke: '#E2E8F0',
      strokeWidth: 1,
      listening: false,
    });
    const pillTxt = new Konva.Text({
      name: 'lifeline-part lifeline-pill-text',
      x: geo.actor.pillText.x,
      y: geo.actor.pillText.y,
      width: geo.actor.pillText.width,
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
      name: 'lifeline-part lifeline-header-box',
      x: 0,
      y: 0,
      width: geo.participant.box.width,
      height: geo.participant.box.height,
      fill: node.fill || '#E0F2F1',
      stroke: strokeColor,
      strokeWidth: 1.4,
      listening: false,
    });
    const title = new Konva.Text({
      name: 'lifeline-part lifeline-title',
      x: geo.participant.title.x,
      y: geo.participant.title.y,
      width: geo.participant.title.width,
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
    name: 'lifeline-part lifeline-stem',
    points: geo.stem,
    stroke: '#78716C',
    strokeWidth: 1.5,
    dash: [5, 5],
    listening: false,
  });
  group.add(stem);

  // Execution Specification / Activation Bars
  const barFill = lifelineBarFill(node);
  geo.bars.forEach((bar) => group.add(createLifelineBar(bar, barFill)));
}

/**
 * Actualiza por diff las partes existentes de la línea de vida (sin destruir ni recrear
 * la cabecera ni el tallo). Las barras de activación tienen cantidad variable, así que se
 * reconcilian: se reutilizan las existentes, se crean las que falten y se destruyen las sobrantes.
 *
 * @returns `true` si todas las partes fijas existían y fueron actualizadas.
 */
function updateLifelineGeometry(
  group: Konva.Group,
  node: UmlNode,
  width: number,
  height: number,
  isSelected: boolean,
): boolean {
  const stem = group.findOne<Konva.Line>('.lifeline-stem');
  if (!stem) return false;

  if (node.isActorLifeline) {
    const head = group.findOne<Konva.Circle>('.lifeline-head');
    const spine = group.findOne<Konva.Line>('.lifeline-spine');
    const arms = group.findOne<Konva.Line>('.lifeline-arms');
    const legL = group.findOne<Konva.Line>('.lifeline-leg-l');
    const legR = group.findOne<Konva.Line>('.lifeline-leg-r');
    const pillBg = group.findOne<Konva.Rect>('.lifeline-pill-bg');
    const pillTxt = group.findOne<Konva.Text>('.lifeline-pill-text');
    if (!head || !spine || !arms || !legL || !legR || !pillBg || !pillTxt) return false;

    const geo = computeLifelineGeometry(node, width, height);
    head.setAttrs({ x: geo.actor.head.x, y: geo.actor.head.y });
    spine.setAttrs({ points: geo.actor.spine });
    arms.setAttrs({ points: geo.actor.arms });
    legL.setAttrs({ points: geo.actor.legL });
    legR.setAttrs({ points: geo.actor.legR });
    pillBg.setAttrs({ x: geo.actor.pill.x, y: geo.actor.pill.y, width: geo.actor.pill.width });
    pillTxt.setAttrs({
      x: geo.actor.pillText.x,
      y: geo.actor.pillText.y,
      width: geo.actor.pillText.width,
    });
    if (pillTxt.text() !== node.name) pillTxt.text(node.name);
    applyStemAndBars(group, stem, node, geo);
    return true;
  }

  const headerBox = group.findOne<Konva.Rect>('.lifeline-header-box');
  const title = group.findOne<Konva.Text>('.lifeline-title');
  if (!headerBox || !title) return false;

  const geo = computeLifelineGeometry(node, width, height);
  headerBox.setAttrs({
    width: geo.participant.box.width,
    height: geo.participant.box.height,
    fill: node.fill || '#E0F2F1',
    stroke: isSelected ? '#059669' : '#78716C',
  });
  title.setAttrs({
    x: geo.participant.title.x,
    y: geo.participant.title.y,
    width: geo.participant.title.width,
  });
  if (title.text() !== node.name) title.text(node.name);
  applyStemAndBars(group, stem, node, geo);
  return true;
}

function applyStemAndBars(
  group: Konva.Group,
  stem: Konva.Line,
  node: UmlNode,
  geo: LifelineGeometry,
): void {
  stem.setAttrs({ points: geo.stem });

  const barFill = lifelineBarFill(node);
  const existing = group.find<Konva.Rect>('.lifeline-activation');
  geo.bars.forEach((bar, index) => {
    const rect = existing[index];
    if (rect) {
      rect.setAttrs({ x: bar.x, y: bar.y, height: bar.height, fill: barFill });
    } else {
      group.add(createLifelineBar(bar, barFill));
    }
  });
  for (let i = geo.bars.length; i < existing.length; i++) existing[i].destroy();
}

export function resizeLifelineKonvaNode(
  group: Konva.Group,
  node: UmlNode,
  newWidth: number,
  newHeight: number,
  isSelected: boolean,
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

  // Diff-update; solo si el subárbol no existe (nodo legado) se reconstruye.
  if (!updateLifelineGeometry(group, node, minW, minH, isSelected)) {
    group.find('.lifeline-part').forEach((c) => c.destroy());
    drawLifelineGeometry(group, node, minW, minH, isSelected);
  }
}
