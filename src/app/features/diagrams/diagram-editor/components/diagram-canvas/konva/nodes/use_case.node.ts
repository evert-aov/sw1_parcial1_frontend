import Konva from 'konva';
import { UmlNode } from '../models/uml.model';

export function createUseCaseKonvaNode(node: UmlNode, isSelected: boolean): Konva.Group {
  const group = new Konva.Group({
    id: node.id,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    draggable: true,
    name: 'uml-node',
  });

  const strokeColor = isSelected ? '#059669' : node.stroke || '#78716C';
  const fillColor = node.fill || '#E6F2FD';

  const ellipse = new Konva.Ellipse({
    name: 'uc-ellipse',
    x: node.width / 2,
    y: node.height / 2,
    radiusX: node.width / 2,
    radiusY: node.height / 2,
    fill: fillColor,
    stroke: strokeColor,
    strokeWidth: isSelected ? 2.2 : 1.6,
    shadowColor: '#000000',
    shadowBlur: 0,
    shadowOffsetX: 3,
    shadowOffsetY: 3,
    shadowOpacity: 0.1,
  });

  const textPaddingX = Math.max(20, node.width * 0.14);
  const label = new Konva.Text({
    name: 'uc-text',
    x: textPaddingX,
    y: 0,
    width: node.width - textPaddingX * 2,
    height: node.height,
    text: node.name,
    fontSize: 12.5,
    fontFamily: 'Plus Jakarta Sans',
    fontStyle: 'bold',
    fill: '#0F172A',
    align: 'center',
    verticalAlign: 'middle',
    lineHeight: 1.25,
    listening: false,
  });

  group.add(ellipse, label);
  return group;
}

export function resizeUseCaseKonvaNode(group: Konva.Group, newWidth: number, newHeight: number): void {
  const minW = Math.max(130, Math.round(newWidth));
  const minH = Math.max(56, Math.round(newHeight));

  group.width(minW);
  group.height(minH);

  const ellipse = group.findOne<Konva.Ellipse>('.uc-ellipse');
  if (ellipse) {
    ellipse.x(minW / 2);
    ellipse.y(minH / 2);
    ellipse.radiusX(minW / 2);
    ellipse.radiusY(minH / 2);
  }

  const label = group.findOne<Konva.Text>('.uc-text');
  if (label) {
    const padX = Math.max(20, minW * 0.14);
    label.x(padX);
    label.width(minW - padX * 2);
    label.height(minH);
  }
}
