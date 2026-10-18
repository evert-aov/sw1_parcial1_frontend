import Konva from 'konva';
import { UmlNode } from '../models/uml.model';

export function createComponentKonvaNode(node: UmlNode, isSelected: boolean): Konva.Group {
  const group = new Konva.Group({
    id: node.id,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    draggable: true,
    name: 'uml-node',
  });

  drawComponentGeometry(group, node, node.width, node.height, isSelected);
  return group;
}

/** Geometría calculada (pura) de todas las partes del componente para un tamaño dado. */
interface ComponentGeometry {
  bodyX: number;
  bodyY: number;
  bodyW: number;
  bodyH: number;
  textWidth: number;
  stereoY: number;
  titleY: number;
}

function computeComponentGeometry(width: number, hasStereotype: boolean): ComponentGeometry {
  // UML 2.5 Component Icon in the top-right corner (box with two protruding left ports)
  const iconRightMargin = 10;
  const iconTopMargin = 8;
  const bodyW = 13;
  const bodyH = 17;
  return {
    bodyX: width - iconRightMargin - bodyW,
    bodyY: iconTopMargin,
    bodyW,
    bodyH,
    textWidth: width - 34,
    stereoY: 9,
    titleY: hasStereotype ? 24 : 14,
  };
}

function componentStrokeColor(node: UmlNode, isSelected: boolean): string {
  return isSelected ? '#059669' : node.stroke || '#8C7F70';
}

function componentStereotypeText(stereotype: string): string {
  return stereotype.startsWith('«') ? stereotype : `«${stereotype}»`;
}

function drawComponentGeometry(
  group: Konva.Group,
  node: UmlNode,
  width: number,
  height: number,
  isSelected: boolean,
): void {
  const geo = computeComponentGeometry(width, !!node.stereotype);
  const strokeColor = componentStrokeColor(node, isSelected);
  const baseFill = node.fill || '#FAF1EC';

  // Main Component Rectangle (Matching UML 2.5 style)
  const bgRect = new Konva.Rect({
    name: 'comp-part comp-bg',
    x: 0,
    y: 0,
    width,
    height,
    fill: baseFill,
    stroke: strokeColor,
    strokeWidth: isSelected ? 2 : 1.25,
    shadowColor: '#000000',
    shadowBlur: 3,
    shadowOffsetX: 2,
    shadowOffsetY: 2,
    shadowOpacity: 0.14,
  });
  group.add(bgRect);

  const iconBody = new Konva.Rect({
    name: 'comp-part comp-icon-body',
    x: geo.bodyX,
    y: geo.bodyY,
    width: geo.bodyW,
    height: geo.bodyH,
    fill: '#FBF9F6',
    stroke: '#78716C',
    strokeWidth: 1.1,
    listening: false,
  });

  const port1 = new Konva.Rect({
    name: 'comp-part comp-port1',
    x: geo.bodyX - 4,
    y: geo.bodyY + 3,
    width: 8,
    height: 4,
    fill: '#FBF9F6',
    stroke: '#78716C',
    strokeWidth: 1.1,
    listening: false,
  });

  const port2 = new Konva.Rect({
    name: 'comp-part comp-port2',
    x: geo.bodyX - 4,
    y: geo.bodyY + 10,
    width: 8,
    height: 4,
    fill: '#FBF9F6',
    stroke: '#78716C',
    strokeWidth: 1.1,
    listening: false,
  });

  group.add(iconBody, port1, port2);

  // Stereotype (e.g. «class», «table», «component», «file»)
  if (node.stereotype) {
    const stereoText = new Konva.Text({
      name: 'comp-part comp-stereo',
      x: 10,
      y: geo.stereoY,
      width: geo.textWidth,
      text: componentStereotypeText(node.stereotype),
      fontSize: 10.5,
      fontFamily: 'Plus Jakarta Sans',
      fontStyle: 'normal',
      fill: '#78716C',
      align: 'center',
      listening: false,
    });
    group.add(stereoText);
  }

  // Component Name
  const titleText = new Konva.Text({
    name: 'comp-part comp-title',
    x: 10,
    y: geo.titleY,
    width: geo.textWidth,
    text: node.name,
    fontSize: 12,
    fontFamily: 'Plus Jakarta Sans',
    fontStyle: 'bold',
    fill: '#57534E',
    align: 'center',
    listening: false,
  });
  group.add(titleText);
}

/**
 * Actualiza por diff las partes existentes del componente (sin destruir ni recrear el subárbol).
 *
 * @returns `true` si todas las partes existían y fueron actualizadas. Devuelve `false` también
 * cuando la presencia del estereotipo no coincide con la del subárbol, para forzar la reconstrucción.
 */
function updateComponentGeometry(
  group: Konva.Group,
  node: UmlNode,
  width: number,
  height: number,
  isSelected: boolean,
): boolean {
  const bg = group.findOne<Konva.Rect>('.comp-bg');
  const iconBody = group.findOne<Konva.Rect>('.comp-icon-body');
  const port1 = group.findOne<Konva.Rect>('.comp-port1');
  const port2 = group.findOne<Konva.Rect>('.comp-port2');
  const stereo = group.findOne<Konva.Text>('.comp-stereo');
  const title = group.findOne<Konva.Text>('.comp-title');
  if (!bg || !iconBody || !port1 || !port2 || !title) return false;
  // El estereotipo es una parte opcional: si cambia su presencia, se reconstruye el subárbol.
  if (!!node.stereotype !== !!stereo) return false;

  const geo = computeComponentGeometry(width, !!node.stereotype);

  bg.setAttrs({
    width,
    height,
    fill: node.fill || '#FAF1EC',
    stroke: componentStrokeColor(node, isSelected),
    strokeWidth: isSelected ? 2 : 1.25,
  });
  iconBody.setAttrs({ x: geo.bodyX, y: geo.bodyY });
  port1.setAttrs({ x: geo.bodyX - 4, y: geo.bodyY + 3 });
  port2.setAttrs({ x: geo.bodyX - 4, y: geo.bodyY + 10 });
  if (stereo && node.stereotype) {
    stereo.setAttrs({
      y: geo.stereoY,
      width: geo.textWidth,
      text: componentStereotypeText(node.stereotype),
    });
  }
  title.setAttrs({ y: geo.titleY, width: geo.textWidth, text: node.name });
  return true;
}

export function resizeComponentKonvaNode(
  group: Konva.Group,
  node: UmlNode,
  newWidth: number,
  newHeight: number,
  isSelected: boolean,
): void {
  const minW = Math.max(125, Math.round(newWidth));
  const minH = Math.max(60, Math.round(newHeight));

  group.width(minW);
  group.height(minH);

  // Diff-update; solo si el subárbol no existe (nodo legado) se reconstruye.
  if (!updateComponentGeometry(group, node, minW, minH, isSelected)) {
    group.find('.comp-part').forEach((c) => c.destroy());
    drawComponentGeometry(group, node, minW, minH, isSelected);
  }
}
