import Konva from 'konva';
import { UmlNode } from '../models/uml.model';

/**
 * Automatically computes the minimum required width and height of a Class Node
 * so that all attributes, methods, stereotypes, and class names fit cleanly without clipping.
 */
export function computeClassAutoBounds(node: UmlNode): { width: number; height: number } {
  const headerHeight = node.stereotype ? 44 : 34;
  const attrs = node.attributes || [];
  const methods = node.methods || [];

  // Ancho del título de la clase
  const titleMeasure = new Konva.Text({
    text: node.name || 'Clase',
    fontSize: 14,
    fontFamily: 'Plus Jakarta Sans',
    fontStyle: 'bold',
  });
  let maxContentWidth = titleMeasure.width() + 4;

  // Ancho del estereotipo si está presente
  if (node.stereotype) {
    const stereoStr = node.stereotype.startsWith('«') ? node.stereotype : `«${node.stereotype}»`;
    const stereoMeasure = new Konva.Text({
      text: stereoStr,
      fontSize: 11,
      fontFamily: 'JetBrains Mono',
      fontStyle: 'italic',
    });
    maxContentWidth = Math.max(maxContentWidth, stereoMeasure.width());
  }

  // Ancho de atributos: | 10px | [-] nombre : tipo | 10px | -> Espaciado exactamente simétrico a ambos lados
  for (const attr of attrs) {
    const nameMeasure = new Konva.Text({
      text: `${attr.visibility} ${attr.name}`,
      fontSize: 12,
      fontFamily: 'Plus Jakarta Sans',
      fontStyle: 'bold',
    });
    const typeMeasure = new Konva.Text({
      text: `: ${attr.type}`,
      fontSize: 12,
      fontFamily: 'Plus Jakarta Sans',
      fontStyle: 'normal',
    });
    const attrW = nameMeasure.width() + 3 + typeMeasure.width();
    if (attrW > maxContentWidth) {
      maxContentWidth = attrW;
    }
  }

  // Ancho de métodos
  for (const m of methods) {
    const mMeasure = new Konva.Text({
      text: `${m.visibility} ${m.name}(${m.params}): ${m.returnType}`,
      fontSize: 11.5,
      fontFamily: 'JetBrains Mono',
    });
    const mW = mMeasure.width();
    if (mW > maxContentWidth) {
      maxContentWidth = mW;
    }
  }

  // Espaciado simétrico idéntico en ambos bordes: 10px a la izquierda + contenido + 10px a la derecha
  const calculatedWidth = Math.max(90, Math.ceil(maxContentWidth + 20));

  // Si el usuario redimensionó manualmente el nodo con transformer, respetar su tamaño personalizado
  const customW = node.isCustomSize && ((node.customWidth && node.customWidth > 0) || (node.width && node.width > 0))
    ? (node.customWidth || node.width || 0)
    : 0;
  const autoWidth = customW > 0
    ? Math.max(calculatedWidth, customW)
    : calculatedWidth;

  // Altura requerida basada en encabezado, atributos y métodos
  let requiredHeight = headerHeight + 14 + attrs.length * 20;
  if (methods.length > 0) {
    requiredHeight += 14 + methods.length * 19;
  }
  const customH = node.isCustomSize && ((node.customHeight && node.customHeight > 0) || (node.height && node.height > 0))
    ? (node.customHeight || node.height || 0)
    : 0;
  const autoHeight = customH > 0
    ? Math.max(customH, requiredHeight + 6)
    : Math.max(80, requiredHeight + 6);

  return { width: autoWidth, height: autoHeight };
}

export function createClassKonvaNode(node: UmlNode, isSelected: boolean): Konva.Group {
  const bounds = computeClassAutoBounds(node);
  const finalW = bounds.width;
  const finalH = bounds.height;

  const group = new Konva.Group({
    id: node.id,
    x: node.x,
    y: node.y,
    width: finalW,
    height: finalH,
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
    width: finalW,
    height: finalH,
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
      width: finalW - 16,
      text: node.stereotype.startsWith('«') ? node.stereotype : `«${node.stereotype}»`,
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
    width: finalW - 16,
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
    points: [0, headerHeight, finalW, headerHeight],
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
      name: 'attr-name',
      x: 0,
      y: 0,
      text: prefix,
      fontSize: 12,
      fontFamily: 'Plus Jakarta Sans',
      fontStyle: 'bold',
      fill: '#292524',
    });

    const typeText = new Konva.Text({
      name: 'attr-type',
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
      points: [0, currentY, finalW, currentY],
      stroke: strokeColor,
      strokeWidth: 1,
      listening: false,
    });
    group.add(methodDivider);
    currentY += 8;

    methods.forEach((m) => {
      const mText = new Konva.Text({
        name: 'method-text',
        x: 10,
        y: currentY,
        width: finalW - 20,
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

export function resizeClassKonvaNode(
  group: Konva.Group,
  newWidth: number,
  newHeight: number,
  node?: UmlNode
): void {
  let minAllowedW = 90;
  let minAllowedH = 60;
  if (node) {
    const minBounds = computeClassAutoBounds({
      ...node,
      isCustomSize: false,
      customWidth: 0,
      customHeight: 0,
      width: 0,
      height: 0,
    });
    minAllowedW = minBounds.width;
    minAllowedH = minBounds.height;
  }
  const minW = Math.max(minAllowedW, Math.round(newWidth));
  const minH = Math.max(minAllowedH, Math.round(newHeight));

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

  // Únicamente actualizar métodos con ellipsis. No tocar los textos de atributos
  // porque nameText y typeText tienen dimensiones intrínsecas yuxtapuestas y alterar su ancho
  // hacía que typeText desbordara el borde derecho del bg-rect generando un marco invisible en el Transformer.
  group.find<Konva.Text>('.method-text').forEach((t) => {
    t.width(minW - 20);
  });
}
