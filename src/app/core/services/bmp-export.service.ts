import { Injectable } from '@angular/core';
import { toCanvas } from 'html-to-image';
import { UmlClassNode, UmlConnection } from '../models/diagram.model';

@Injectable({
  providedIn: 'root',
})
export class BmpExportService {
  /**
   * Exporta una captura visual exacta del DOM del editor de diagramas a formato BMP (Windows Bitmap),
   * detectando automáticamente el bounding box de los elementos e integrando el marco UML 2.5 estilo Enterprise Architect.
   */
  async exportElementToBmp(
    element: HTMLElement,
    diagramName = 'diagrama-uml',
    diagramType?: string,
  ): Promise<void> {
    try {
      const finalCanvas = await this.generateFramedCanvas(element, diagramName, diagramType);
      const ctx = finalCanvas.getContext('2d');
      if (!ctx) {
        throw new Error('No se pudo obtener el contexto 2d del canvas.');
      }

      const imageData = ctx.getImageData(0, 0, finalCanvas.width, finalCanvas.height);
      const bmpBuffer = this.convertImageDataToBmp(imageData);

      const blob = new Blob([bmpBuffer], { type: 'image/bmp' });
      const cleanFileName = diagramName.toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
      this.triggerDownload(blob, `${cleanFileName || 'diagrama'}.bmp`);
    } catch (err) {
      console.error('Error al capturar imagen BMP del editor:', err);
      alert('Error al generar la captura BMP del diagrama.');
    }
  }

  /**
   * Exporta una captura visual exacta del DOM a formato PNG de alta resolución con marco UML 2.5.
   */
  async exportElementToPng(
    element: HTMLElement,
    diagramName = 'diagrama-uml',
    diagramType?: string,
  ): Promise<void> {
    try {
      const finalCanvas = await this.generateFramedCanvas(element, diagramName, diagramType);
      finalCanvas.toBlob((blob) => {
        if (!blob) {
          alert('Error al generar la imagen PNG.');
          return;
        }
        const cleanFileName = diagramName.toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
        this.triggerDownload(blob, `${cleanFileName || 'diagrama'}.png`);
      }, 'image/png');
    } catch (err) {
      console.error('Error al capturar imagen PNG del editor:', err);
      alert('Error al generar la captura PNG del diagrama.');
    }
  }

  /**
   * Genera un HTMLCanvasElement con el encuadre exacto Enterprise Architect (UML 2.5 Frame).
   * 1. Detecta automáticamente el bounding box que cubre los elementos del diagrama (sin exportar el lienzo vacío).
   * 2. Agrega el marco UML 2.5 con la pestaña superior izquierda (estilo pentagonal con chaflán a 45°).
   * 3. Incluye el tipo de diagrama (uc, class, sd, comm, pkg) y el nombre del diagrama.
   * 4. Añade un margen exterior limpio de 24px igual a Enterprise Architect.
   */
  async generateFramedCanvas(
    element: HTMLElement,
    diagramName = 'diagrama-uml',
    diagramType?: string,
  ): Promise<HTMLCanvasElement> {
    if (!element) {
      throw new Error('No se encontró el contenedor del lienzo para capturar.');
    }

    // 1. Sanitizar elementos SVG del DOM antes de capturar:
    // Ocultar círculos de arrastre temporales de Foblex (f-connection-drag-handle-end / start)
    // para evitar que se rendericen como puntos negros en el destino de las relaciones.
    const cleanupFns: Array<() => void> = [];

    const handleCircles = element.querySelectorAll<SVGCircleElement>(
      'f-connection circle, f-connection-for-create circle, [f-connection-drag-handle-end], [f-connection-drag-handle-start], .f-connection-drag-handle'
    );
    handleCircles.forEach((circle) => {
      const origDisplay = circle.style.display;
      const origVisibility = circle.style.visibility;
      const origR = circle.getAttribute('r');
      const origFill = circle.getAttribute('fill');

      circle.style.display = 'none';
      circle.style.visibility = 'hidden';
      circle.setAttribute('display', 'none');
      circle.setAttribute('visibility', 'hidden');
      circle.setAttribute('r', '0');
      circle.setAttribute('fill', 'none');

      cleanupFns.push(() => {
        circle.style.display = origDisplay;
        circle.style.visibility = origVisibility;
        if (origR !== null) circle.setAttribute('r', origR);
        else circle.removeAttribute('r');
        if (origFill !== null) circle.setAttribute('fill', origFill);
        else circle.removeAttribute('fill');
        circle.removeAttribute('display');
        circle.removeAttribute('visibility');
      });
    });

    // Asegurar atributos inline explícitos en marcadores UML para que no adopten relleno negro por defecto de SVG
    const hollowMarkers = element.querySelectorAll<SVGPolygonElement>('.uml-marker-hollow');
    hollowMarkers.forEach((poly) => {
      const origFill = poly.getAttribute('fill');
      const origStroke = poly.getAttribute('stroke');
      poly.setAttribute('fill', '#FFFFFF');
      poly.setAttribute('stroke', '#1A202C');
      cleanupFns.push(() => {
        if (origFill !== null) poly.setAttribute('fill', origFill);
        else poly.removeAttribute('fill');
        if (origStroke !== null) poly.setAttribute('stroke', origStroke);
        else poly.removeAttribute('stroke');
      });
    });

    const openMarkers = element.querySelectorAll<SVGPolylineElement>('.uml-marker-open');
    openMarkers.forEach((pline) => {
      const origFill = pline.getAttribute('fill');
      const origStroke = pline.getAttribute('stroke');
      pline.setAttribute('fill', 'none');
      pline.setAttribute('stroke', '#1A202C');
      cleanupFns.push(() => {
        if (origFill !== null) pline.setAttribute('fill', origFill);
        else pline.removeAttribute('fill');
        if (origStroke !== null) pline.setAttribute('stroke', origStroke);
        else pline.removeAttribute('stroke');
      });
    });

    const filledMarkers = element.querySelectorAll<SVGPolygonElement>('.uml-marker-filled');
    filledMarkers.forEach((poly) => {
      const origFill = poly.getAttribute('fill');
      const origStroke = poly.getAttribute('stroke');
      poly.setAttribute('fill', '#1A202C');
      poly.setAttribute('stroke', '#1A202C');
      cleanupFns.push(() => {
        if (origFill !== null) poly.setAttribute('fill', origFill);
        else poly.removeAttribute('fill');
        if (origStroke !== null) poly.setAttribute('stroke', origStroke);
        else poly.removeAttribute('stroke');
      });
    });

    // Ocultar rutas de selección invisible fConnectionSelection para que no superpongan trazos
    const selectionPaths = element.querySelectorAll<SVGPathElement>(
      'path[fConnectionSelection], path.f-connection-selection'
    );
    selectionPaths.forEach((path) => {
      const origDisp = path.style.display;
      path.style.display = 'none';
      path.setAttribute('display', 'none');
      cleanupFns.push(() => {
        path.style.display = origDisp;
        path.removeAttribute('display');
      });
    });

    // Asegurar que las relaciones con líneas discontinuas (dependency, include, extend, realization, association_class)
    // tengan stroke-dasharray explícito en sus elementos SVG para que html-to-image las preserve
    const dashedConfigs = [
      { classKey: 'uml-relation-dependency', dash: '6, 4' },
      { classKey: 'uml-relation-include', dash: '6, 4' },
      { classKey: 'uml-relation-extend', dash: '6, 4' },
      { classKey: 'uml-relation-realization', dash: '6, 4' },
      { classKey: 'uml-relation-association_class', dash: '4, 4' },
    ];

    dashedConfigs.forEach(({ classKey, dash }) => {
      const connEls = element.querySelectorAll<HTMLElement>(`.${classKey}`);
      connEls.forEach((conn) => {
        const paths = conn.querySelectorAll<SVGPathElement>('path');
        paths.forEach((path) => {
          if (
            path.hasAttribute('fConnectionSelection') ||
            path.classList.contains('f-connection-selection') ||
            path.closest('marker') ||
            path.closest('svg[fMarker]')
          ) {
            return;
          }

          const origDash = path.getAttribute('stroke-dasharray');
          const origStyleDash = path.style.strokeDasharray;
          const origFill = path.getAttribute('fill');
          const origStroke = path.getAttribute('stroke');
          const origWidth = path.getAttribute('stroke-width');

          path.setAttribute('stroke-dasharray', dash);
          path.style.setProperty('stroke-dasharray', dash, 'important');
          path.setAttribute('fill', 'none');
          path.style.setProperty('fill', 'none', 'important');
          if (!origStroke || origStroke === 'none') {
            path.setAttribute('stroke', '#2D3748');
            path.style.setProperty('stroke', '#2D3748', 'important');
          }
          if (!origWidth) {
            path.setAttribute('stroke-width', '1.5');
            path.style.setProperty('stroke-width', '1.5px', 'important');
          }

          cleanupFns.push(() => {
            if (origDash !== null) path.setAttribute('stroke-dasharray', origDash);
            else path.removeAttribute('stroke-dasharray');
            path.style.strokeDasharray = origStyleDash;
            if (origFill !== null) path.setAttribute('fill', origFill);
            else path.removeAttribute('fill');
            if (origStroke !== null) path.setAttribute('stroke', origStroke);
            else path.removeAttribute('stroke');
            if (origWidth !== null) path.setAttribute('stroke-width', origWidth);
            else path.removeAttribute('stroke-width');
          });
        });
      });
    });

    // 2. Renderizar el DOM del lienzo a un Canvas HTML5 a 2x de resolución con fondo blanco puro
    let rawCanvas: HTMLCanvasElement;
    try {
      rawCanvas = await toCanvas(element, {
        backgroundColor: '#FFFFFF',
        pixelRatio: 2,
        cacheBust: true,
        filter: (domNode: HTMLElement) => {
          const classList = domNode.classList;
          // Filtrar drag handles interactivos temporales de Foblex, manejadores de resize y puntos conectores
          if (
            classList?.contains('f-connection-drag-handle') ||
            classList?.contains('f-resize-handle') ||
            classList?.contains('uml-resize-handle') ||
            domNode.hasAttribute?.('f-connection-drag-handle-start') ||
            domNode.hasAttribute?.('f-connection-drag-handle-end') ||
            domNode.hasAttribute?.('fResizeHandle') ||
            classList?.contains('uml-connector-point')
          ) {
            return false;
          }

          // Filtrar controles flotantes de UI (cursores remotos, botones de acción flotantes)
          if (
            classList &&
            (classList.contains('pointer-events-none') ||
              (classList.contains('z-40') && domNode.tagName === 'BUTTON'))
          ) {
            return false;
          }
          return true;
        },
      });
    } finally {
      // Restaurar el DOM original de manera limpia
      cleanupFns.forEach((fn) => fn());
    }

    // 2. Detectar el bounding box exacto del contenido diagramado (excluyendo el espacio vacío)
    const bbox = this.findContentBoundingBox(rawCanvas);
    const contentW = bbox.maxX - bbox.minX + 1;
    const contentH = bbox.maxY - bbox.minY + 1;

    // 3. Parámetros del marco UML 2.5 idéntico a Enterprise Architect (en escala 2x)
    const outerMargin = 24;      // Margen exterior de 24px exacto de EA
    const innerPadLeft = 48;     // Espacio interior izquierdo entre marco y elementos
    const innerPadRight = 48;    // Espacio interior derecho
    const innerPadBottom = 36;   // Espacio interior inferior
    const innerPadTop = 84;      // Espacio interior superior (deja respiro suficiente bajo la pestaña)
    const tabHeight = 54;        // Altura de la pestaña de título UML
    const chamfer = 20;          // Chaflán diagonal a 45° en esquina inferior derecha de la pestaña

    // 4. Formatear título con prefijo UML estándar
    const prefix = this.getDiagramPrefix(diagramType);
    let cleanName = diagramName.trim().replace(new RegExp(`^${prefix}\\s*[:\\-]?\\s*`, 'i'), '');
    cleanName = cleanName.replace(/^(uc|class|sd|comm|pkg)\s*[:\-]?\s*/i, '');
    const fullTitle = `${prefix} ${cleanName || diagramName.trim() || 'Diagram'}`;

    // Calcular ancho necesario para la pestaña
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    let textWidth = 200;
    if (tempCtx) {
      tempCtx.font = 'bold 20px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
      textWidth = tempCtx.measureText(fullTitle).width;
    }
    const tabWidth = Math.max(220, Math.ceil(textWidth + 36 + chamfer));

    // Dimensiones totales del marco y del canvas final
    const frameW = Math.max(contentW + innerPadLeft + innerPadRight, tabWidth + 60);
    const frameH = contentH + innerPadTop + innerPadBottom;

    const totalW = frameW + outerMargin * 2;
    const totalH = frameH + outerMargin * 2;

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = totalW;
    finalCanvas.height = totalH;

    const ctx = finalCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('No se pudo inicializar el contexto 2d del canvas final.');
    }

    // 5. Rellenar fondo blanco puro
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, totalW, totalH);

    // 6. Dibujar rectángulo del marco exterior UML 2.5
    const frameX = outerMargin;
    const frameY = outerMargin;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(frameX, frameY, frameW, frameH);

    // 7. Dibujar pestaña UML 2.5 con esquina recortada a 45° (chamfer)
    ctx.beginPath();
    ctx.moveTo(frameX, frameY);
    ctx.lineTo(frameX + tabWidth, frameY);
    ctx.lineTo(frameX + tabWidth, frameY + tabHeight - chamfer);
    ctx.lineTo(frameX + tabWidth - chamfer, frameY + tabHeight);
    ctx.lineTo(frameX, frameY + tabHeight);
    ctx.closePath();

    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 8. Dibujar texto del título del diagrama en la pestaña
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 20px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(fullTitle, frameX + 16, frameY + tabHeight / 2 - 1);

    // 9. Dibujar el contenido diagramado recortado exactamente a su bounding box
    const destX = frameX + innerPadLeft;
    const destY = frameX + innerPadTop;
    ctx.drawImage(
      rawCanvas,
      bbox.minX,
      bbox.minY,
      contentW,
      contentH,
      destX,
      destY,
      contentW,
      contentH,
    );

    return finalCanvas;
  }

  /**
   * Detecta el Bounding Box exacto del contenido (elementos dibujados) en el canvas renderizado.
   */
  private findContentBoundingBox(canvas: HTMLCanvasElement): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { minX: 0, minY: 0, maxX: canvas.width - 1, maxY: canvas.height - 1 };
    }
    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y++) {
      const rowOffset = y * width * 4;
      for (let x = 0; x < width; x++) {
        const idx = rowOffset + x * 4;
        const a = data[idx + 3];
        if (a > 20) {
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          // Píxel no blanco
          if (r < 250 || g < 250 || b < 250) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
    }

    if (maxX < minX || maxY < minY) {
      return { minX: 0, minY: 0, maxX: Math.min(600, width - 1), maxY: Math.min(400, height - 1) };
    }

    const pad = 16;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(width - 1, maxX + pad);
    maxY = Math.min(height - 1, maxY + pad);

    return { minX, minY, maxX, maxY };
  }

  /**
   * Mapea el tipo de diagrama a su prefijo canónico UML 2.5 estilo Enterprise Architect.
   */
  private getDiagramPrefix(diagramType?: string): string {
    const type = (diagramType || '').toLowerCase();
    if (type.includes('use_case') || type === 'use-case' || type === 'uc') {
      return 'uc';
    }
    if (type.includes('sequence') || type === 'sd') {
      return 'sd';
    }
    if (type.includes('communication') || type === 'comm') {
      return 'comm';
    }
    if (type.includes('package') || type === 'pkg') {
      return 'pkg';
    }
    return 'class';
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  }

  /**
   * Exporta el diagrama UML a formato Windows Bitmap (.bmp) mediante renderizado de fallback canvas 2D.
   */
  exportToBmp(
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    diagramName = 'diagrama-uml',
    diagramType?: string,
  ): void {
    const canvas = this.drawFallbackCanvas(nodes, connections, diagramName, diagramType);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rawImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const bmpBuffer = this.convertImageDataToBmp(rawImageData);

    const blob = new Blob([bmpBuffer], { type: 'image/bmp' });
    const cleanFileName = diagramName.toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
    this.triggerDownload(blob, `${cleanFileName || 'diagrama'}.bmp`);
  }

  /**
   * Exporta el diagrama UML a formato PNG mediante renderizado de fallback canvas 2D.
   */
  exportToPng(
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    diagramName = 'diagrama-uml',
    diagramType?: string,
  ): void {
    const canvas = this.drawFallbackCanvas(nodes, connections, diagramName, diagramType);
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const cleanFileName = diagramName.toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
      this.triggerDownload(blob, `${cleanFileName || 'diagrama'}.png`);
    }, 'image/png');
  }

  /**
   * Dibuja los nodos y conexiones con marco UML 2.5 en un Canvas 2D como fallback.
   */
  private drawFallbackCanvas(
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    diagramName: string,
    diagramType?: string,
  ): HTMLCanvasElement | null {
    const validNodes = nodes.filter((n) => !n.isAnchor);

    if (validNodes.length === 0) {
      alert('No hay elementos en el diagrama para exportar.');
      return null;
    }

    // 1. Calcular Bounding Box del contenido
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of validNodes) {
      const w = node.width || 220;
      const h = this.calculateNodeHeight(node);
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + w);
      maxY = Math.max(maxY, node.position.y + h);
    }

    const contentW = maxX - minX;
    const contentH = maxY - minY;

    // 2. Parámetros del marco UML 2.5 (en unidades lógicas 1x)
    const outerMargin = 24;
    const innerPadLeft = 48;
    const innerPadRight = 48;
    const innerPadBottom = 36;
    const innerPadTop = 84;
    const tabHeight = 54;
    const chamfer = 20;

    const prefix = this.getDiagramPrefix(diagramType);
    let cleanName = diagramName.trim().replace(new RegExp(`^${prefix}\\s*[:\\-]?\\s*`, 'i'), '');
    cleanName = cleanName.replace(/^(uc|class|sd|comm|pkg)\s*[:\-]?\s*/i, '');
    const fullTitle = `${prefix} ${cleanName || diagramName.trim() || 'Diagram'}`;

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    let textWidth = 200;
    if (tempCtx) {
      tempCtx.font = 'bold 20px system-ui, -apple-system, sans-serif';
      textWidth = tempCtx.measureText(fullTitle).width;
    }
    const tabWidth = Math.max(220, Math.ceil(textWidth + 36 + chamfer));

    const frameW = Math.max(contentW + innerPadLeft + innerPadRight, tabWidth + 60);
    const frameH = contentH + innerPadTop + innerPadBottom;

    const totalW = frameW + outerMargin * 2;
    const totalH = frameH + outerMargin * 2;

    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = totalW * scale;
    canvas.height = totalH * scale;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      alert('No se pudo inicializar el contexto de dibujo Canvas.');
      return null;
    }

    ctx.scale(scale, scale);

    // Fondo blanco puro
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, totalW, totalH);

    // Marco exterior UML 2.5
    const frameX = outerMargin;
    const frameY = outerMargin;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(frameX, frameY, frameW, frameH);

    // Pestaña con chaflán
    ctx.beginPath();
    ctx.moveTo(frameX, frameY);
    ctx.lineTo(frameX + tabWidth, frameY);
    ctx.lineTo(frameX + tabWidth, frameY + tabHeight - chamfer);
    ctx.lineTo(frameX + tabWidth - chamfer, frameY + tabHeight);
    ctx.lineTo(frameX, frameY + tabHeight);
    ctx.closePath();

    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Texto de la pestaña
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 20px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(fullTitle, frameX + 16, frameY + tabHeight / 2 - 1);

    // Offset para el contenido dentro del marco
    const offsetX = frameX + innerPadLeft - minX;
    const offsetY = frameY + innerPadTop - minY;

    // Mapa de posiciones de nodos
    const nodeMap = new Map<string, { x: number; y: number; w: number; h: number; name: string }>();
    for (const node of validNodes) {
      const w = node.width || 220;
      const h = this.calculateNodeHeight(node);
      nodeMap.set(node.id, {
        x: node.position.x + offsetX,
        y: node.position.y + offsetY,
        w,
        h,
        name: node.name,
      });
    }

    // Dibujar conexiones
    for (const conn of connections) {
      const source = this.resolveConnectionNode(conn.sourceNodeId || conn.sourceId, nodeMap);
      const target = this.resolveConnectionNode(conn.targetNodeId || conn.targetId, nodeMap);

      if (source && target && source !== target) {
        this.drawConnection(ctx, source, target, conn);
      }
    }

    // Dibujar nodos
    for (const node of validNodes) {
      const nInfo = nodeMap.get(node.id);
      if (nInfo) {
        this.drawClassNode(ctx, node, nInfo.x, nInfo.y, nInfo.w, nInfo.h);
      }
    }

    return canvas;
  }

  private calculateNodeHeight(node: UmlClassNode): number {
    const headerHeight = 32;
    const attrCount = (node.attributes || []).length;
    const attrHeight = attrCount > 0 ? (attrCount * 18 + 12) : 24;
    const methodCount = (node.methods || []).length;
    const methodHeight = methodCount > 0 ? (methodCount * 18 + 14) : 0;
    return headerHeight + attrHeight + methodHeight;
  }

  private resolveConnectionNode(
    idOrPort: string,
    nodeMap: Map<string, { x: number; y: number; w: number; h: number; name: string }>,
  ): { x: number; y: number; w: number; h: number; name: string } | undefined {
    if (!idOrPort) return undefined;
    const cleanId = idOrPort.replace(/_(top|bottom|left|right)$/, '').trim();
    return nodeMap.get(cleanId);
  }

  private drawConnection(
    ctx: CanvasRenderingContext2D,
    source: { x: number; y: number; w: number; h: number },
    target: { x: number; y: number; w: number; h: number },
    conn: UmlConnection,
  ): void {
    const sCenter = { x: source.x + source.w / 2, y: source.y + source.h / 2 };
    const tCenter = { x: target.x + target.w / 2, y: target.y + target.h / 2 };

    const start = this.getRectIntersection(sCenter, tCenter, source);
    const end = this.getRectIntersection(tCenter, sCenter, target);

    ctx.save();
    ctx.strokeStyle = '#2A201B';
    ctx.lineWidth = 1.6;

    if (
      conn.type === 'dependency' ||
      conn.type === 'realization' ||
      conn.type === 'include' ||
      conn.type === 'extend' ||
      conn.type === 'association_class'
    ) {
      ctx.setLineDash(conn.type === 'association_class' ? [4, 4] : [6, 4]);
    } else {
      ctx.setLineDash([]);
    }

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    ctx.setLineDash([]);
    this.drawRelationshipMarker(ctx, start, end, conn.type);
    this.drawMultiplicityAndLabels(ctx, start, end, conn);

    ctx.restore();
  }

  private drawRelationshipMarker(
    ctx: CanvasRenderingContext2D,
    start: { x: number; y: number },
    end: { x: number; y: number },
    type: string,
  ): void {
    const angle = Math.atan2(end.y - start.y, end.x - start.x);

    if (type === 'generalization' || type === 'realization') {
      const arrowLength = 14;
      const arrowWidth = 9;

      const p1 = { x: end.x, y: end.y };
      const p2 = {
        x: end.x - arrowLength * Math.cos(angle) + arrowWidth * Math.sin(angle),
        y: end.y - arrowLength * Math.sin(angle) - arrowWidth * Math.cos(angle),
      };
      const p3 = {
        x: end.x - arrowLength * Math.cos(angle) - arrowWidth * Math.sin(angle),
        y: end.y - arrowLength * Math.sin(angle) + arrowWidth * Math.cos(angle),
      };

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.closePath();
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.stroke();
    } else if (type === 'composition' || type === 'aggregation') {
      const diamondLen = 14;
      const diamondWidth = 7;
      const oppAngle = angle + Math.PI;

      const p1 = { x: start.x, y: start.y };
      const p2 = {
        x: start.x + (diamondLen / 2) * Math.cos(oppAngle) + diamondWidth * Math.sin(oppAngle),
        y: start.y + (diamondLen / 2) * Math.sin(oppAngle) - diamondWidth * Math.cos(oppAngle),
      };
      const p3 = {
        x: start.x + diamondLen * Math.cos(oppAngle),
        y: start.y + diamondLen * Math.sin(oppAngle),
      };
      const p4 = {
        x: start.x + (diamondLen / 2) * Math.cos(oppAngle) - diamondWidth * Math.sin(oppAngle),
        y: start.y + (diamondLen / 2) * Math.sin(oppAngle) + diamondWidth * Math.cos(oppAngle),
      };

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.lineTo(p4.x, p4.y);
      ctx.closePath();

      ctx.fillStyle = type === 'composition' ? '#2A201B' : '#FFFFFF';
      ctx.fill();
      ctx.stroke();
    } else if (type === 'dependency' || type === 'include' || type === 'extend') {
      const arrowLength = 10;
      const arrowAngle = Math.PI / 6;

      ctx.beginPath();
      ctx.moveTo(
        end.x - arrowLength * Math.cos(angle - arrowAngle),
        end.y - arrowLength * Math.sin(angle - arrowAngle),
      );
      ctx.lineTo(end.x, end.y);
      ctx.lineTo(
        end.x - arrowLength * Math.cos(angle + arrowAngle),
        end.y - arrowLength * Math.sin(angle + arrowAngle),
      );
      ctx.stroke();
    }
  }

  private drawMultiplicityAndLabels(
    ctx: CanvasRenderingContext2D,
    start: { x: number; y: number },
    end: { x: number; y: number },
    conn: UmlConnection,
  ): void {
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const isInheritance = conn.type === 'generalization' || conn.type === 'realization';

    if (conn.sourceMultiplicity && !isInheritance) {
      const pos = this.interpolatePoint(start, end, 0.18);
      this.drawBadge(ctx, pos.x, pos.y - 10, conn.sourceMultiplicity, '#0284C7', '#E0F2FE');
    }

    if (conn.name) {
      const mid = this.interpolatePoint(start, end, 0.5);
      this.drawBadge(ctx, mid.x, mid.y - 12, conn.name, '#475569', '#F8FAFC');
    }

    if (conn.targetMultiplicity && !isInheritance) {
      const pos = this.interpolatePoint(start, end, 0.82);
      this.drawBadge(ctx, pos.x, pos.y - 10, conn.targetMultiplicity, '#0284C7', '#E0F2FE');
    }
  }

  private drawBadge(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    text: string,
    textColor: string,
    bgColor: string,
  ): void {
    const textWidth = ctx.measureText(text).width;
    const padX = 4;
    const padY = 2;
    const rectW = textWidth + padX * 2;
    const rectH = 14;

    ctx.save();
    ctx.fillStyle = bgColor;
    ctx.strokeStyle = textColor;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.roundRect(x - rectW / 2, y - rectH / 2, rectW, rectH, 3);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  private drawClassNode(
    ctx: CanvasRenderingContext2D,
    node: UmlClassNode,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    ctx.save();

    ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 4;

    ctx.fillStyle = '#FFFDF9';
    ctx.strokeStyle = '#796354';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.stroke();

    ctx.shadowColor = 'transparent';

    const headerHeight = 30;
    ctx.fillStyle = '#FFFDF9';
    ctx.beginPath();
    ctx.rect(x, y, w, headerHeight);
    ctx.fill();
    ctx.strokeStyle = '#796354';
    ctx.beginPath();
    ctx.moveTo(x, y + headerHeight);
    ctx.lineTo(x + w, y + headerHeight);
    ctx.stroke();

    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = '#241C18';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.name, x + w / 2, y + headerHeight / 2);

    let currentY = y + headerHeight + 12;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const attributes = node.attributes || [];
    for (const attr of attributes) {
      ctx.fillStyle = '#241C18';
      ctx.fillText(`- ${attr.name}: ${attr.type}`, x + 10, currentY);
      currentY += 18;
    }

    const methods = node.methods || [];
    if (methods.length > 0) {
      currentY += 2;
      ctx.strokeStyle = '#796354';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, currentY);
      ctx.lineTo(x + w, currentY);
      ctx.stroke();

      currentY += 12;
      for (const m of methods) {
        ctx.fillStyle = '#241C18';
        const params = m.parameters ? `(${m.parameters})` : '()';
        const ret = m.returnType ? `: ${m.returnType}` : ': void';
        ctx.fillText(`+ ${m.name}${params}${ret}`, x + 10, currentY);
        currentY += 18;
      }
    }

    ctx.restore();
  }

  private getRectIntersection(
    center: { x: number; y: number },
    target: { x: number; y: number },
    rect: { x: number; y: number; w: number; h: number },
  ): { x: number; y: number } {
    const dx = target.x - center.x;
    const dy = target.y - center.y;
    if (dx === 0 && dy === 0) return center;

    const hw = rect.w / 2;
    const hh = rect.h / 2;
    const rCenter = { x: rect.x + hw, y: rect.y + hh };

    const slope = dy / (dx || 0.0001);

    if (Math.abs(dy * hw) < Math.abs(dx * hh)) {
      const ix = dx > 0 ? rCenter.x + hw : rCenter.x - hw;
      const iy = rCenter.y + (ix - rCenter.x) * slope;
      return { x: ix, y: iy };
    } else {
      const iy = dy > 0 ? rCenter.y + hh : rCenter.y - hh;
      const ix = rCenter.x + (iy - rCenter.y) / slope;
      return { x: ix, y: iy };
    }
  }

  private interpolatePoint(
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    t: number,
  ): { x: number; y: number } {
    return {
      x: p1.x + (p2.x - p1.x) * t,
      y: p1.y + (p2.y - p1.y) * t,
    };
  }

  /**
   * Codifica un objeto ImageData (RGBA) a un ArrayBuffer con la estructura binaria de un archivo BMP de 24 bits.
   */
  convertImageDataToBmp(imageData: ImageData): ArrayBuffer {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    const bytesPerPixel = 3;
    const rowSize = Math.floor((width * bytesPerPixel + 3) / 4) * 4;
    const pixelArraySize = rowSize * height;
    const fileHeaderSize = 14;
    const infoHeaderSize = 40;
    const fileSize = fileHeaderSize + infoHeaderSize + pixelArraySize;

    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);

    // 1. BITMAPFILEHEADER (14 bytes)
    view.setUint8(0, 0x42); // 'B'
    view.setUint8(1, 0x4d); // 'M'
    view.setUint32(2, fileSize, true); // Tamaño total del archivo
    view.setUint16(6, 0, true); // Reservado 1
    view.setUint16(8, 0, true); // Reservado 2
    view.setUint32(10, fileHeaderSize + infoHeaderSize, true); // Offset a los datos de píxeles

    // 2. BITMAPINFOHEADER (40 bytes)
    view.setUint32(14, infoHeaderSize, true); // Tamaño de este encabezado
    view.setInt32(18, width, true); // Ancho de la imagen en píxeles
    view.setInt32(22, height, true); // Alto de la imagen en píxeles (positivo = bottom-to-top)
    view.setUint16(26, 1, true); // Planos de color = 1
    view.setUint16(28, 24, true); // Bits por píxel (24 bits = RGB)
    view.setUint32(30, 0, true); // Compresión (0 = BI_RGB sin comprimir)
    view.setUint32(34, pixelArraySize, true); // Tamaño del arreglo de píxeles
    view.setInt32(38, 3780, true); // Resolución horizontal (~96 DPI, estándar Enterprise Architect)
    view.setInt32(42, 3780, true); // Resolución vertical (~96 DPI, estándar Enterprise Architect)
    view.setUint32(46, 0, true); // Colores en la paleta (0 = 2^24)
    view.setUint32(50, 0, true); // Colores importantes

    // 3. PIXEL DATA (De abajo hacia arriba, formato BGR con padding de 4 bytes)
    const pixelOffset = fileHeaderSize + infoHeaderSize;
    const uint8View = new Uint8Array(buffer);

    for (let y = 0; y < height; y++) {
      const srcRow = height - 1 - y; // Bottom-to-top
      const destRowOffset = pixelOffset + y * rowSize;

      for (let x = 0; x < width; x++) {
        const srcIdx = (srcRow * width + x) * 4;
        const r = data[srcIdx];
        const g = data[srcIdx + 1];
        const b = data[srcIdx + 2];
        const a = data[srcIdx + 3] / 255;

        // Mezcla con fondo blanco puro en caso de transparencia
        const blendedR = Math.round(r * a + 255 * (1 - a));
        const blendedG = Math.round(g * a + 255 * (1 - a));
        const blendedB = Math.round(b * a + 255 * (1 - a));

        const destIdx = destRowOffset + x * 3;
        uint8View[destIdx] = blendedB; // B
        uint8View[destIdx + 1] = blendedG; // G
        uint8View[destIdx + 2] = blendedR; // R
      }
    }

    return buffer;
  }
}
