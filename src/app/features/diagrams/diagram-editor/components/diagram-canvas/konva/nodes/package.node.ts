import Konva from 'konva';
import { UmlNode } from '../models/uml.model';

export function createPackageKonvaNode(node: UmlNode, isSelected: boolean): Konva.Group {
  const group = new Konva.Group({
    id: node.id,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    draggable: true,
    name: 'uml-node',
  });

  drawPackageGeometry(group, node, node.width, node.height, isSelected);
  return group;
}

/** Geometría calculada (pura) de todas las partes del paquete para un tamaño dado. */
interface PackageGeometry {
  tabWidth: number;
  tabHeight: number;
  bodyY: number;
  bodyHeight: number;
  titleY: number;
  titleWidth: number;
  stereoY: number;
  stereoWidth: number;
}

function computePackageGeometry(width: number, height: number): PackageGeometry {
  const tabHeight = Math.min(32, Math.max(24, Math.round(height * 0.25)));
  const tabWidth = Math.min(width - 18, Math.max(110, Math.round(width * 0.82)));
  const bodyY = tabHeight;
  return {
    tabWidth,
    tabHeight,
    bodyY,
    bodyHeight: Math.max(40, height - tabHeight),
    titleY: Math.max(5, (tabHeight - 14) / 2),
    titleWidth: tabWidth - 16,
    stereoY: bodyY + 12,
    stereoWidth: width - 20,
  };
}

function packageStrokeColor(node: UmlNode, isSelected: boolean): string {
  return isSelected ? '#059669' : node.stroke || '#1C1917';
}

function packageStereotypeText(stereotype: string): string {
  return stereotype.startsWith('«') ? stereotype : `«${stereotype}»`;
}

function drawPackageGeometry(
  group: Konva.Group,
  node: UmlNode,
  width: number,
  height: number,
  isSelected: boolean,
): void {
  const geo = computePackageGeometry(width, height);
  const strokeColor = packageStrokeColor(node, isSelected);
  const baseFill = node.fill || '#FAF1EC';

  // Drop Shadow Group / Tab & Body matching UML 2.5 package folder
  const tabRect = new Konva.Rect({
    name: 'pkg-folder-part pkg-tab',
    x: 0,
    y: 0,
    width: geo.tabWidth,
    height: geo.tabHeight,
    fill: baseFill,
    stroke: strokeColor,
    strokeWidth: isSelected ? 2 : 1.5,
    shadowColor: '#000000',
    shadowBlur: 0,
    shadowOffsetX: 4,
    shadowOffsetY: 3,
    shadowOpacity: 0.14,
  });

  const bodyRect = new Konva.Rect({
    name: 'pkg-folder-part pkg-body',
    x: 0,
    y: geo.bodyY,
    width,
    height: geo.bodyHeight,
    fill: baseFill,
    stroke: strokeColor,
    strokeWidth: isSelected ? 2 : 1.5,
    shadowColor: '#000000',
    shadowBlur: 0,
    shadowOffsetX: 5,
    shadowOffsetY: 5,
    shadowOpacity: 0.16,
  });

  const titleText = new Konva.Text({
    name: 'pkg-folder-part pkg-title',
    x: 10,
    y: geo.titleY,
    width: geo.titleWidth,
    text: node.name,
    fontSize: 13.5,
    fontFamily: 'Plus Jakarta Sans',
    fontStyle: 'bold',
    fill: '#57534E',
    align: 'left',
    listening: false,
  });

  group.add(tabRect, bodyRect, titleText);

  if (node.stereotype) {
    const stereoText = new Konva.Text({
      name: 'pkg-folder-part pkg-stereo',
      x: 10,
      y: geo.stereoY,
      width: geo.stereoWidth,
      text: packageStereotypeText(node.stereotype),
      fontSize: 11,
      fontFamily: 'JetBrains Mono',
      fontStyle: 'italic',
      fill: '#78716C',
      align: 'center',
      listening: false,
    });
    group.add(stereoText);
  }
}

/**
 * Actualiza por diff las partes existentes del paquete (sin destruir ni recrear el subárbol).
 *
 * @returns `true` si todas las partes existían y fueron actualizadas. Devuelve `false` también
 * cuando la presencia del estereotipo no coincide con la del subárbol, para forzar la reconstrucción.
 */
function updatePackageGeometry(
  group: Konva.Group,
  node: UmlNode,
  width: number,
  height: number,
  isSelected: boolean,
): boolean {
  const tab = group.findOne<Konva.Rect>('.pkg-tab');
  const body = group.findOne<Konva.Rect>('.pkg-body');
  const title = group.findOne<Konva.Text>('.pkg-title');
  const stereo = group.findOne<Konva.Text>('.pkg-stereo');
  if (!tab || !body || !title) return false;
  // El estereotipo es una parte opcional: si cambia su presencia, se reconstruye el subárbol.
  if (!!node.stereotype !== !!stereo) return false;

  const geo = computePackageGeometry(width, height);
  const strokeColor = packageStrokeColor(node, isSelected);
  const baseFill = node.fill || '#FAF1EC';
  const strokeWidth = isSelected ? 2 : 1.5;

  tab.setAttrs({
    width: geo.tabWidth,
    height: geo.tabHeight,
    fill: baseFill,
    stroke: strokeColor,
    strokeWidth,
  });
  body.setAttrs({
    y: geo.bodyY,
    width,
    height: geo.bodyHeight,
    fill: baseFill,
    stroke: strokeColor,
    strokeWidth,
  });
  title.setAttrs({ y: geo.titleY, width: geo.titleWidth, text: node.name });
  if (stereo && node.stereotype) {
    stereo.setAttrs({
      y: geo.stereoY,
      width: geo.stereoWidth,
      text: packageStereotypeText(node.stereotype),
    });
  }
  return true;
}

export function resizePackageKonvaNode(
  group: Konva.Group,
  node: UmlNode,
  newWidth: number,
  newHeight: number,
  isSelected: boolean,
): void {
  const minW = Math.max(140, Math.round(newWidth));
  const minH = Math.max(85, Math.round(newHeight));

  group.width(minW);
  group.height(minH);

  // Diff-update; solo si el subárbol no existe (nodo legado) se reconstruye.
  if (!updatePackageGeometry(group, node, minW, minH, isSelected)) {
    group.find('.pkg-folder-part').forEach((c) => c.destroy());
    drawPackageGeometry(group, node, minW, minH, isSelected);
  }
}
