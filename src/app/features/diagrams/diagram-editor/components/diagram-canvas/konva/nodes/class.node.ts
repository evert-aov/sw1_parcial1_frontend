import Konva from 'konva';
import { UmlNode } from '../models/uml.model';

export function createClassKonvaNode(node: UmlNode, isSelected: boolean): Konva.Group {
  const group = new Konva.Group({
    id: node.id,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    draggable: true,
    name: 'uml-node',
  });

  const bgFill = node.fill || '#FCFBF7';
  const strokeColor = isSelected ? '#059669' : node.stroke || '#78716C';
  const headerHeight = node.stereotype ? 44 : 34;

  // Main Card Drop Shadow & Background
  const bgRect = new Konva.Rect({
    name: 'bg-rect',
    x: 0,
    y: 0,
    width: node.width,
    height: node.height,
    fill: bgFill,
    stroke: strokeColor,
    strokeWidth: isSelected ? 2 : 1.3,
    shadowColor: '#000000',
    shadowBlur: 0,
    shadowOffsetX: 4,
    shadowOffsetY: 4,
    shadowOpacity: 0.12,
  });
  group.add(bgRect);

  // Stereotype if present
  if (node.stereotype) {
    const stereoText = new Konva.Text({
      name: 'stereo-text',
      x: 8,
      y: 6,
      width: node.width - 16,
      text: `«${node.stereotype}»`,
      fontSize: 11,
      fontFamily: 'JetBrains Mono',
      fontStyle: 'italic',
      fill: '#57534E',
      align: 'center',
      listening: false,
    });
    group.add(stereoText);
  }

  // Class Title
  const titleText = new Konva.Text({
    name: 'title-text',
    x: 8,
    y: node.stereotype ? 21 : 10,
    width: node.width - 16,
    text: node.name,
    fontSize: 14,
    fontFamily: 'Plus Jakarta Sans',
    fontStyle: 'bold',
    fill: '#1C1917',
    align: 'center',
    listening: false,
  });
  group.add(titleText);

  // Divider line below title
  const headerLine = new Konva.Line({
    name: 'header-line',
    points: [0, headerHeight, node.width, headerHeight],
    stroke: strokeColor,
    strokeWidth: 1.1,
    listening: false,
  });
  group.add(headerLine);

  // Render Attributes
  const attrs = node.attributes || [];
  let currentY = headerHeight + 8;

  attrs.forEach((attr) => {
    const attrGroup = new Konva.Group({
      x: 10,
      y: currentY,
      listening: false,
      name: 'attr-row',
    });

    const prefix = `${attr.visibility} ${attr.name}`;
    const nameText = new Konva.Text({
      x: 0,
      y: 0,
      text: prefix,
      fontSize: 12,
      fontFamily: 'Plus Jakarta Sans',
      fontStyle: 'bold',
      fill: '#292524',
    });

    const typeText = new Konva.Text({
      x: nameText.width() + 3,
      y: 0,
      text: `: ${attr.type}`,
      fontSize: 12,
      fontFamily: 'Plus Jakarta Sans',
      fontStyle: 'normal',
      fill: '#57534E',
    });

    attrGroup.add(nameText);
    attrGroup.add(typeText);
    group.add(attrGroup);
    currentY += 20;
  });

  // Render Methods if any exist
  const methods = node.methods || [];
  if (methods.length > 0) {
    currentY += 4;
    const methodDivider = new Konva.Line({
      name: 'method-line',
      points: [0, currentY, node.width, currentY],
      stroke: strokeColor,
      strokeWidth: 1,
      listening: false,
    });
    group.add(methodDivider);
    currentY += 8;

    methods.forEach((m) => {
      const mText = new Konva.Text({
        x: 10,
        y: currentY,
        width: node.width - 20,
        text: `${m.visibility} ${m.name}(${m.params}): ${m.returnType}`,
        fontSize: 11.5,
        fontFamily: 'JetBrains Mono',
        fill: '#292524',
        listening: false,
        ellipsis: true,
        wrap: 'none',
      });
      group.add(mText);
      currentY += 19;
    });
  }

  return group;
}

export function resizeClassKonvaNode(group: Konva.Group, newWidth: number, newHeight: number): void {
  const minW = Math.max(150, Math.round(newWidth));
  const minH = Math.max(80, Math.round(newHeight));

  group.width(minW);
  group.height(minH);

  const bgRect = group.findOne<Konva.Rect>('.bg-rect');
  if (bgRect) {
    bgRect.width(minW);
    bgRect.height(minH);
  }

  const titleText = group.findOne<Konva.Text>('.title-text');
  if (titleText) {
    titleText.width(minW - 16);
  }

  const stereoText = group.findOne<Konva.Text>('.stereo-text');
  if (stereoText) {
    stereoText.width(minW - 16);
  }

  const headerLine = group.findOne<Konva.Line>('.header-line');
  if (headerLine) {
    const pts = headerLine.points();
    headerLine.points([0, pts[1], minW, pts[3]]);
  }

  const methodLine = group.findOne<Konva.Line>('.method-line');
  if (methodLine) {
    const pts = methodLine.points();
    methodLine.points([0, pts[1], minW, pts[3]]);
  }
}
