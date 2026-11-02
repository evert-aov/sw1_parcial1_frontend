import { Injectable, Injector, inject } from '@angular/core';
import { toCanvas } from 'html-to-image';
import JSZip from 'jszip';
import { DiagramType, UmlClassNode, UmlConnection, UmlLineStyle, UmlMessage } from '../../core/models/diagram.model';
import { DiagramSequenceActivationService } from '../../core/plugins/contracts/diagram-sequence-activation.service.contract';
import { ToastService } from '../../core/services/toast.service';
import { BmpEncoder } from '../../core/plugins/contracts/bmp-encoder.contract';

@Injectable({
  providedIn: 'root',
})
export class BmpExportService {
  private readonly encoder = inject(BmpEncoder);
  private readonly injector = inject(Injector);
  private readonly toastService?: ToastService | null;

  constructor(toastService?: ToastService) {
    if (toastService !== undefined) {
      this.toastService = toastService;
    } else {
      try {
        this.toastService = inject(ToastService, { optional: true });
      } catch {
        this.toastService = null;
      }
    }
  }

  /**
   * Codifica los datos de un ImageData en un ArrayBuffer BMP.
   * Utiliza un Web Worker en segundo plano cuando está disponible en el entorno del navegador,
   * liberando el hilo principal (Main Thread) para mantener la interfaz a 60 FPS sin bloqueos.
   * Si los Web Workers no están disponibles o fallan, recurre de forma transparente al fallback síncrono.
   */
  encodeImageDataToBmp(imageData: ImageData): Promise<ArrayBuffer> {
    return this.encoder.encodeImageDataToBmp(imageData);
  }

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
      const bmpBuffer = await this.encodeImageDataToBmp(imageData);

      const blob = new Blob([bmpBuffer], { type: 'image/bmp' });
      const cleanFileName = diagramName.toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
      this.triggerDownload(blob, `${cleanFileName || 'diagrama'}.bmp`);
    } catch (err) {
      console.error('Error al capturar imagen BMP del editor:', err);
      this.toastService?.error('Error al generar la captura BMP del diagrama.');
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
          this.toastService?.error('Error al generar la imagen PNG.');
          return;
        }
        const cleanFileName = diagramName.toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
        this.triggerDownload(blob, `${cleanFileName || 'diagrama'}.png`);
      }, 'image/png');
    } catch (err) {
      console.error('Error al capturar imagen PNG del editor:', err);
      this.toastService?.error('Error al generar la captura PNG del diagrama.');
    }
  }

  /**
   * Exporta una captura visual exacta del DOM a formato SVG con marco UML 2.5 de alta resolución.
   */
  async exportElementToSvg(
    element: HTMLElement,
    diagramName = 'diagrama-uml',
    diagramType?: string,
  ): Promise<void> {
    try {
      const finalCanvas = await this.generateFramedCanvas(element, diagramName, diagramType);
      const dataUrl = finalCanvas.toDataURL('image/png');
      const totalW = finalCanvas.width;
      const totalH = finalCanvas.height;

      const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">
  <image width="${totalW}" height="${totalH}" href="${dataUrl}" xlink:href="${dataUrl}" />
</svg>`;

      const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const cleanFileName = diagramName.toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
      this.triggerDownload(blob, `${cleanFileName || 'diagrama'}.svg`);
    } catch (err) {
      console.error('Error al capturar imagen SVG del editor:', err);
      this.toastService?.error('Error al generar la captura SVG del diagrama.');
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
      // Proteger círculos legítimos que forman parte del conector visual (ej. el círculo "Ball" de la relación Assembly)
      if (
        circle.closest('[fConnectionContent]') ||
        circle.closest('[fconnectioncontent]') ||
        circle.closest('.f-connection-content') ||
        circle.closest('.uml-assembly-connector') ||
        circle.classList.contains('uml-assembly-circle')
      ) {
        return;
      }

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

    // Asegurar atributos explícitos en conectores de Ensamble UML (Assembly / Ball and Socket)
    const assemblyContainers = element.querySelectorAll<HTMLElement>(
      '.uml-assembly-connector, [fConnectionContent] .uml-assembly-connector, .uml-relation-assembly [fConnectionContent]'
    );
    assemblyContainers.forEach((conn) => {
      // Círculo central (Ball): exclusivamente el círculo dentro del contenido de ensamble, ignorando drag-handles
      const circles = conn.querySelectorAll<SVGCircleElement>('circle');
      circles.forEach((circle) => {
        if (
          circle.classList.contains('f-connection-drag-handle') ||
          circle.hasAttribute('f-connection-drag-handle-start') ||
          circle.hasAttribute('f-connection-drag-handle-end')
        ) {
          return;
        }
        const origFill = circle.getAttribute('fill');
        const origStroke = circle.getAttribute('stroke');
        const origStrokeWidth = circle.getAttribute('stroke-width');
        const origR = circle.getAttribute('r');
        const origDisplay = circle.style.display;
        const origVisibility = circle.style.visibility;

        circle.setAttribute('fill', '#FFFFFF');
        circle.setAttribute('stroke', '#94A3B8');
        circle.setAttribute('stroke-width', '2');
        circle.setAttribute('r', '10');
        circle.style.display = 'inline';
        circle.style.visibility = 'visible';

        cleanupFns.push(() => {
          if (origFill !== null) circle.setAttribute('fill', origFill);
          else circle.removeAttribute('fill');
          if (origStroke !== null) circle.setAttribute('stroke', origStroke);
          else circle.removeAttribute('stroke');
          if (origStrokeWidth !== null) circle.setAttribute('stroke-width', origStrokeWidth);
          else circle.removeAttribute('stroke-width');
          if (origR !== null) circle.setAttribute('r', origR);
          else circle.removeAttribute('r');
          circle.style.display = origDisplay;
          circle.style.visibility = origVisibility;
        });
      });

      // Arco semicircular (Socket)
      const socketPaths = conn.querySelectorAll<SVGPathElement>('path.uml-assembly-socket, svg path:not([f-connection-path])');
      socketPaths.forEach((path) => {
        if (path.hasAttribute('f-connection-path') || path.hasAttribute('fConnectionPath')) {
          return;
        }
        const origFill = path.getAttribute('fill');
        const origStroke = path.getAttribute('stroke');
        const origStrokeWidth = path.getAttribute('stroke-width');

        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#94A3B8');
        path.setAttribute('stroke-width', '2');

        cleanupFns.push(() => {
          if (origFill !== null) path.setAttribute('fill', origFill);
          else path.removeAttribute('fill');
          if (origStroke !== null) path.setAttribute('stroke', origStroke);
          else path.removeAttribute('stroke');
          if (origStrokeWidth !== null) path.setAttribute('stroke-width', origStrokeWidth);
          else path.removeAttribute('stroke-width');
        });
      });

      // Línea de conexión principal
      const connPaths = conn.querySelectorAll<SVGPathElement>('path[f-connection-path], path[fConnectionPath]');
      connPaths.forEach((path) => {
        const origStroke = path.getAttribute('stroke');
        const origStrokeWidth = path.getAttribute('stroke-width');

        path.setAttribute('stroke', '#94A3B8');
        path.setAttribute('stroke-width', '2');

        cleanupFns.push(() => {
          if (origStroke !== null) path.setAttribute('stroke', origStroke);
          else path.removeAttribute('stroke');
          if (origStrokeWidth !== null) path.setAttribute('stroke-width', origStrokeWidth);
          else path.removeAttribute('stroke-width');
        });
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

    // Asegurar fill="none" en todos los trazados de conexión para evitar que adopten el relleno negro por defecto de SVG en navegadores/html-to-image
    const allConnectionPaths = element.querySelectorAll<SVGPathElement>(
      'f-connection path, f-connection-for-create path, .f-connection-path, path[f-connection-path], path[fConnectionPath]'
    );
    allConnectionPaths.forEach((path) => {
      if (
        path.closest('f-marker') ||
        path.closest('svg[fMarker]') ||
        path.closest('.uml-marker-filled') ||
        path.classList.contains('uml-marker-filled')
      ) {
        return;
      }
      const origFill = path.getAttribute('fill');
      const origStyleFill = path.style.fill;

      path.setAttribute('fill', 'none');
      path.style.fill = 'none';

      cleanupFns.push(() => {
        if (origFill !== null) path.setAttribute('fill', origFill);
        else path.removeAttribute('fill');
        path.style.fill = origStyleFill;
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
      { classKey: 'uml-relation-import', dash: '6, 4' },
      { classKey: 'uml-relation-access', dash: '6, 4' },
      { classKey: 'uml-relation-merge', dash: '6, 4' },
      { classKey: 'uml-relation-trace', dash: '6, 4' },
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
        cacheBust: false,
        skipFonts: true,
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

          // Preservar siempre las líneas de vida y sus elementos SVG
          if (
            classList?.contains('uml-lifeline-vertical-line') ||
            classList?.contains('uml-lifeline-svg') ||
            domNode.closest?.('.uml-lifeline-vertical-line')
          ) {
            return true;
          }

          // Filtrar controles flotantes de UI (cursores remotos, botones de acción flotantes)
          if (
            classList &&
            ((classList.contains('pointer-events-none') && (classList.contains('remote-cursor') || classList.contains('remote-user-tag') || classList.contains('collaborator-cursor') || classList.contains('remote-selection'))) ||
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
    cleanName = cleanName.replace(/^(uc|class|cd|sd|comm|pkg|cmp|dep|layered|arch|analysis)\s*[:\-]?\s*/i, '');
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
  getDiagramPrefix(diagramType?: string): string {
    const type = (diagramType || '').toLowerCase().trim();
    if (type.includes('use_case') || type.includes('use-case') || type === 'uc' || type.includes('caso')) {
      return 'uc';
    }
    if (type.includes('sequence') || type.includes('secuencia') || type === 'sd') {
      return 'sd';
    }
    if (type.includes('communication') || type.includes('comunic') || type === 'comm') {
      return 'comm';
    }
    if (type.includes('package') || type.includes('paquete') || type === 'pkg') {
      return 'pkg';
    }
    if (type.includes('component') || type.includes('componente') || type === 'cmp') {
      return 'cmp';
    }
    if (type.includes('deployment') || type.includes('despliegue') || type === 'dep') {
      return 'dep';
    }
    if (type.includes('layered') || type.includes('capa') || type === 'arch') {
      return 'layered';
    }
    if (type.includes('analysis') || type.includes('analisis') || type.includes('análisis')) {
      return 'analysis';
    }
    return 'class';
  }

  /**
   * Dispara la descarga del archivo generado en el navegador del usuario.
   * @param blob Contenido binario del archivo a descargar.
   * @param filename Nombre del archivo para la descarga.
   */
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
  async exportToBmp(
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    diagramName = 'diagrama-uml',
    diagramType?: string,
  ): Promise<void> {
    const canvas = this.drawFallbackCanvas(nodes, connections, diagramName, diagramType);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rawImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const bmpBuffer = await this.encodeImageDataToBmp(rawImageData);

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
   * Exporta el diagrama UML a formato vectorial SVG con marco UML 2.5 escalable.
   */
  exportToSvg(
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    diagramName = 'diagrama-uml',
    diagramType?: string,
  ): void {
    const svgString = this.generateSvgString(nodes, connections, diagramName, diagramType);
    if (!svgString) return;

    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const cleanFileName = diagramName.toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
    this.triggerDownload(blob, `${cleanFileName || 'diagrama'}.svg`);
  }

  /**
   * Genera el código XML del archivo SVG vectorial para el diagrama UML, incluyendo el marco UML 2.5.
   */
  generateSvgString(
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    diagramName = 'diagrama-uml',
    diagramType?: string,
  ): string {
    const validNodes = (nodes || []).filter((n) => !n.isAnchor);
    if (validNodes.length === 0) {
      this.toastService?.warning('No hay elementos en el diagrama para exportar.');
      return '';
    }

    const prefix = this.getDiagramPrefix(diagramType);
    const isCommunication =
      prefix === 'comm' ||
      (diagramType || '').toLowerCase().includes('comm');

    const isSequence =
      !isCommunication &&
      (prefix === 'sd' ||
        (diagramType || '').toLowerCase().includes('seq') ||
        (diagramType || '').toLowerCase().includes('sequence') ||
        (!diagramType && validNodes.some((n) => n.nodeType === 'lifeline')));

    let maxSlot = -1;
    if (isSequence) {
      for (const c of connections || []) {
        const sMatch = c.sourceId?.match(/_slot_(\d+)$/);
        const tMatch = c.targetId?.match(/_slot_(\d+)$/);
        if (sMatch) maxSlot = Math.max(maxSlot, parseInt(sMatch[1], 10));
        if (tMatch) maxSlot = Math.max(maxSlot, parseInt(tMatch[1], 10));
      }
      if (maxSlot < 0 && (connections || []).length > 0) {
        maxSlot = connections.length - 1;
      }
      if (maxSlot < 0) maxSlot = 2;
    }
    const seqLifelineLength = isSequence ? Math.max(120, 170 + maxSlot * 50) : 0;

    // 1. Calcular Bounding Box del contenido
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of validNodes) {
      const isActor = node.nodeType === 'actor' || node.name?.toLowerCase().includes('actor');
      const w =
        isSequence && isActor
          ? (node.width || 90)
          : isCommunication
            ? (node.width || 180)
            : (node.width || (isSequence ? 160 : 220));
      const h = this.calculateNodeHeight(node, isSequence, seqLifelineLength, isCommunication);
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + w);
      maxY = Math.max(maxY, node.position.y + h);
    }

    const contentW = maxX - minX;
    const contentH = maxY - minY;

    // 2. Parámetros del marco UML 2.5
    const outerMargin = 24;
    const innerPadLeft = 48;
    const innerPadRight = 48;
    const innerPadBottom = 36;
    const innerPadTop = 84;
    const tabHeight = 54;
    const chamfer = 20;

    let cleanName = diagramName.trim().replace(new RegExp(`^${prefix}\\s*[:\\-]?\\s*`, 'i'), '');
    cleanName = cleanName.replace(/^(uc|class|cd|sd|comm|pkg|cmp|dep|layered|arch|analysis)\s*[:\\-]?\s*/i, '');
    const fullTitle = `${prefix} ${cleanName || diagramName.trim() || 'Diagram'}`;

    const charWidth = 11.5;
    const textWidth = fullTitle.length * charWidth;
    const tabWidth = Math.max(220, Math.ceil(textWidth + 36 + chamfer));

    const frameW = Math.max(contentW + innerPadLeft + innerPadRight, tabWidth + 60);
    const frameH = contentH + innerPadTop + innerPadBottom;

    const totalW = frameW + outerMargin * 2;
    const totalH = frameH + outerMargin * 2;

    const frameX = outerMargin;
    const frameY = outerMargin;

    const offsetX = frameX + innerPadLeft - minX;
    const offsetY = frameY + innerPadTop - minY;

    const nodeMap = new Map<string, { x: number; y: number; w: number; h: number; name: string }>();
    for (const node of validNodes) {
      const isActor = node.nodeType === 'actor' || node.name?.toLowerCase().includes('actor');
      const w =
        isSequence && isActor
          ? (node.width || 90)
          : isCommunication
            ? (node.width || 180)
            : (node.width || (isSequence ? 160 : 220));
      const h = this.calculateNodeHeight(node, isSequence, seqLifelineLength, isCommunication);
      nodeMap.set(node.id, {
        x: node.position.x + offsetX,
        y: node.position.y + offsetY,
        w,
        h,
        name: node.name,
      });
    }

    const svgParts: string[] = [];
    svgParts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
    svgParts.push(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">`,
    );
    svgParts.push(`<style>
      .uml-text { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
      .uml-code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    </style>`);

    // Fondo blanco
    svgParts.push(`<rect width="${totalW}" height="${totalH}" fill="#FFFFFF" />`);

    // Marco exterior UML 2.5
    svgParts.push(
      `<rect x="${frameX}" y="${frameY}" width="${frameW}" height="${frameH}" fill="#FFFFFF" stroke="#000000" stroke-width="1.5" />`,
    );

    // Pestaña con chaflán UML 2.5
    const tabPath = `M ${frameX} ${frameY} L ${frameX + tabWidth} ${frameY} L ${frameX + tabWidth} ${frameY + tabHeight - chamfer} L ${frameX + tabWidth - chamfer} ${frameY + tabHeight} L ${frameX} ${frameY + tabHeight} Z`;
    svgParts.push(
      `<path d="${tabPath}" fill="#FFFFFF" stroke="#000000" stroke-width="1.5" />`,
    );

    // Título en la pestaña
    svgParts.push(
      `<text x="${frameX + 16}" y="${frameY + tabHeight / 2 + 7}" class="uml-text" font-size="20" font-weight="bold" fill="#000000">${this.escapeXml(fullTitle)}</text>`,
    );

    if (isSequence) {
      this.renderSvgSequenceDiagram(svgParts, validNodes, connections || [], nodeMap, seqLifelineLength);
    } else if (isCommunication) {
      this.renderSvgCommunicationDiagram(svgParts, validNodes, connections || [], nodeMap);
    } else {
      // Conexiones estándar
      svgParts.push('<g id="connections">');
      for (const conn of connections || []) {
        const source = this.resolveConnectionNode(conn.sourceNodeId || conn.sourceId, nodeMap);
        const target = this.resolveConnectionNode(conn.targetNodeId || conn.targetId, nodeMap);
        if (source && target && source !== target) {
          svgParts.push(this.renderSvgConnection(source, target, conn));
        }
      }
      svgParts.push('</g>');

      // Nodos estándar
      svgParts.push('<g id="nodes">');
      for (const node of validNodes) {
        const nInfo = nodeMap.get(node.id);
        if (nInfo) {
          svgParts.push(this.renderSvgNode(node, nInfo.x, nInfo.y, nInfo.w, nInfo.h));
        }
      }
      svgParts.push('</g>');
    }

    svgParts.push('</svg>');
    return svgParts.join('\n');
  }

  /**
   * Genera un Blob PNG para un diagrama dado, priorizando la captura del elemento DOM si se provee,
   * o utilizando el renderizado en canvas 2D si no está disponible.
   */
  async generatePngBlob(
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    diagramName = 'diagrama-uml',
    diagramType?: string,
    element?: HTMLElement,
  ): Promise<Blob | null> {
    if (element) {
      try {
        const finalCanvas = await this.generateFramedCanvas(element, diagramName, diagramType);
        return new Promise<Blob | null>((resolve) => {
          finalCanvas.toBlob((blob) => resolve(blob), 'image/png');
        });
      } catch (err) {
        console.warn('Fallback a canvas offscreen para generación de PNG:', err);
      }
    }

    const canvas = this.drawFallbackCanvas(nodes, connections, diagramName, diagramType);
    if (!canvas) return null;

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  }

  /**
   * Empaqueta todas las imágenes de los diagramas del proyecto en un archivo comprimido .ZIP (PNG o SVG).
   */
  async exportProjectImagesToZip(
    diagrams: Array<{
      id?: string;
      name: string;
      type?: string;
      defaultLineStyle?: UmlLineStyle;
      captureCanvas?: boolean;
      nodes: UmlClassNode[];
      connections: UmlConnection[];
    }>,
    format: 'png' | 'svg',
    projectName = 'proyecto',
    activeDiagramCanvas?: HTMLElement,
    activeDiagramId?: string,
    captureDiagram?: (index: number) => Promise<{ element: HTMLElement; dispose: () => void }>,
  ): Promise<void> {
    if (!diagrams || diagrams.length === 0) {
      this.toastService?.warning('No hay diagramas en el proyecto para exportar.');
      return;
    }

    const zip = new JSZip();
    let exportedCount = 0;

    for (let i = 0; i < diagrams.length; i++) {
      const capture = await captureDiagram?.(i);
      try {
      const diag = diagrams[i];
      const connections = diag.connections.map(connection => ({
        ...connection,
        lineStyle: connection.lineStyle ?? diag.defaultLineStyle,
      }));
      const cleanName = diag.name.toLowerCase().replace(/[^a-z0-9_-]+/g, '_') || `diagrama_${i + 1}`;
      const filename = `${cleanName}.${format}`;

      if (format === 'svg') {
        const isCurrentActive = diag.captureCanvas !== false && activeDiagramId && diag.id === activeDiagramId;
        const elToUse = capture?.element ?? (isCurrentActive ? activeDiagramCanvas : undefined);
        let svgString: string | null = null;
        if (elToUse) {
          try {
            const finalCanvas = await this.generateFramedCanvas(elToUse, diag.name, diag.type);
            const dataUrl = finalCanvas.toDataURL('image/png');
            svgString = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${finalCanvas.width}" height="${finalCanvas.height}" viewBox="0 0 ${finalCanvas.width} ${finalCanvas.height}">
  <image width="${finalCanvas.width}" height="${finalCanvas.height}" href="${dataUrl}" xlink:href="${dataUrl}" />
</svg>`;
          } catch (e) {
            if (capture) throw e;
            console.warn('Fallback a generador SVG vectorial:', e);
          }
        }
        if (!svgString) {
          svgString = this.generateSvgString(diag.nodes, connections, diag.name, diag.type);
        }
        if (svgString) {
          zip.file(filename, svgString);
          exportedCount++;
        }
      } else {
        const isCurrentActive = diag.captureCanvas !== false && activeDiagramId && diag.id === activeDiagramId;
        const elToUse = capture?.element ?? (isCurrentActive ? activeDiagramCanvas : undefined);
        let pngBlob: Blob | null;
        if (capture) {
          const canvas = await this.generateFramedCanvas(capture.element, diag.name, diag.type);
          pngBlob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
          if (!pngBlob) throw new Error('PNG capture failed');
        } else {
          pngBlob = await this.generatePngBlob(diag.nodes, connections, diag.name, diag.type, elToUse);
        }
        if (pngBlob) {
          const arrayBuffer = await pngBlob.arrayBuffer();
          zip.file(filename, arrayBuffer);
          exportedCount++;
        }
      }
      } catch (error) {
        console.error('[ZIP diagram failed]', { index: i + 1, id: diagrams[i].id, name: diagrams[i].name, format, error });
        throw error;
      } finally { capture?.dispose(); }
    }

    if (exportedCount === 0) {
      this.toastService?.error('No se pudo exportar ningún diagrama.');
      return;
    }

    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const cleanProjectName = projectName.toLowerCase().replace(/[^a-z0-9_-]+/g, '_') || 'proyecto';
    this.triggerDownload(zipBlob, `${cleanProjectName}_diagramas_${format}.zip`);
    this.toastService?.success(`Se exportaron ${exportedCount} diagramas en ${cleanProjectName}_diagramas_${format}.zip`);
  }

  /**
   * Renderiza una conexión UML en formato SVG.
   */
  private renderSvgConnection(
    source: { x: number; y: number; w: number; h: number },
    target: { x: number; y: number; w: number; h: number },
    conn: UmlConnection,
  ): string {
    const points = this.calculateConnectionPoints(source, target, conn);
    const start = points[0];
    const end = points[points.length - 1];

    let dashAttr = '';
    if (
      conn.type === 'dependency' ||
      conn.type === 'realization' ||
      conn.type === 'include' ||
      conn.type === 'extend'
    ) {
      dashAttr = 'stroke-dasharray="6,4"';
    } else if (conn.type === 'association_class') {
      dashAttr = 'stroke-dasharray="4,4"';
    }

    const elements: string[] = [];
    if (points.length === 2) {
      elements.push(
        `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="#2A201B" stroke-width="1.6" ${dashAttr} />`,
      );
    } else {
      const pathD = 'M ' + points.map((p) => `${p.x} ${p.y}`).join(' L ');
      elements.push(
        `<path d="${pathD}" fill="none" stroke="#2A201B" stroke-width="1.6" ${dashAttr} />`,
      );
    }

    // Marcador en el extremo final
    const prevPoint = points[points.length - 2];
    elements.push(this.renderSvgRelationshipMarker(start, end, conn.type, points[1], prevPoint));

    // Si tiene mensajes de comunicación (ej. diagrama de comunicación)
    if (conn.messages && conn.messages.length > 0) {
      elements.push(this.renderSvgCommMessages(points, conn.messages));
    } else {
      elements.push(this.renderSvgMultiplicityAndLabels(start, end, conn, points));
    }

    return elements.filter(Boolean).join('\n');
  }


  /**
   * Renderiza los mensajes de un enlace de comunicación a lo largo de la arista en SVG
   * (peso normal; el tipo de retorno con opacidad reducida, igual que la plataforma).
   */
  private renderSvgCommMessages(
    points: { x: number; y: number }[],
    messages: UmlMessage[],
  ): string {
    const mid = this.getPolylineMidpoint(points);
    const forwardMsgs = messages.filter((m) => (m.direction || 'forward') !== 'reverse');
    const reverseMsgs = messages.filter((m) => m.direction === 'reverse');
    const lines: string[] = [];

    forwardMsgs.forEach((msg, i) => {
      const color = msg.color || this.getSequenceMessageColor(msg.sequenceNumber);
      const parts = this.buildCommMessageParts(msg, false);
      const y = mid.y - 8 - (forwardMsgs.length - 1 - i) * 16;
      lines.push(this.renderSvgTextParts(mid.x, y, parts, color));
    });
    reverseMsgs.forEach((msg, i) => {
      const color = msg.color || this.getSequenceMessageColor(msg.sequenceNumber);
      const parts = this.buildCommMessageParts(msg, true);
      lines.push(this.renderSvgTextParts(mid.x, mid.y + 18 + i * 16, parts, color));
    });

    return lines.join('\n');
  }

  /**
   * Construye los tramos de texto de un mensaje de comunicación con su flecha direccional.
   */
  private buildCommMessageParts(msg: UmlMessage, reverse: boolean): { text: string; opacity: number }[] {
    const num = msg.sequenceNumber ? `${msg.sequenceNumber}: ` : '';
    const main = `${num}${msg.functionName || 'message'}(${msg.parameters || ''})`;
    const parts: { text: string; opacity: number }[] = [];
    if (reverse) parts.push({ text: '← ', opacity: 1 });
    parts.push({ text: main, opacity: 1 });
    if (msg.returnType) parts.push({ text: ` : ${msg.returnType}`, opacity: 0.75 });
    if (!reverse) parts.push({ text: ' →', opacity: 1 });
    return parts;
  }

  /**
   * Renderiza el extremo o punta de flecha de la relación en SVG.
   */
  private renderSvgRelationshipMarker(
    start: { x: number; y: number },
    end: { x: number; y: number },
    type: string,
    second: { x: number; y: number } = end,
    penultimate: { x: number; y: number } = start,
  ): string {
    const angle = Math.atan2(end.y - penultimate.y, end.x - penultimate.x);
    const startAngle = Math.atan2(second.y - start.y, second.x - start.x);

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

      return `<polygon points="${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}" fill="#FFFFFF" stroke="#2A201B" stroke-width="1.6" />`;
    }

    if (type === 'composition' || type === 'aggregation') {
      const diamondLen = 14;
      const diamondWidth = 7;
      const oppAngle = startAngle + Math.PI;

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

      const fill = type === 'composition' ? '#2A201B' : '#FFFFFF';
      return `<polygon points="${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}" fill="${fill}" stroke="#2A201B" stroke-width="1.6" />`;
    }

    if (type === 'dependency' || type === 'include' || type === 'extend') {
      const arrowLength = 10;
      const arrowAngle = Math.PI / 6;
      const p1 = {
        x: end.x - arrowLength * Math.cos(angle - arrowAngle),
        y: end.y - arrowLength * Math.sin(angle - arrowAngle),
      };
      const p2 = {
        x: end.x - arrowLength * Math.cos(angle + arrowAngle),
        y: end.y - arrowLength * Math.sin(angle + arrowAngle),
      };

      return `<polyline points="${p1.x},${p1.y} ${end.x},${end.y} ${p2.x},${p2.y}" fill="none" stroke="#2A201B" stroke-width="1.6" />`;
    }

    if (type === 'assembly') {
      const mid = this.interpolatePoint(start, end, 0.5);
      const normalAngle = angle + Math.PI / 2;
      const p1 = {
        x: mid.x + 11 * Math.cos(normalAngle),
        y: mid.y + 11 * Math.sin(normalAngle),
      };
      const p2 = {
        x: mid.x + 11 * Math.cos(normalAngle + Math.PI),
        y: mid.y + 11 * Math.sin(normalAngle + Math.PI),
      };

      return `<circle cx="${mid.x}" cy="${mid.y}" r="8" fill="#FFFFFF" stroke="#94A3B8" stroke-width="2" />
        <path d="M ${p1.x} ${p1.y} A 11 11 0 0 1 ${p2.x} ${p2.y}" fill="none" stroke="#94A3B8" stroke-width="2" />`;
    }

    return '';
  }

  /**
   * Renderiza multiplicidades y etiquetas de conexión en SVG como texto limpio (sin recuadros ni píldoras).
   */
  private renderSvgMultiplicityAndLabels(
    start: { x: number; y: number },
    end: { x: number; y: number },
    conn: UmlConnection,
    points?: { x: number; y: number }[],
  ): string {
    const isInheritance = conn.type === 'generalization' || conn.type === 'realization';
    const badges: string[] = [];

    if (conn.sourceMultiplicity && !isInheritance) {
      const pos = points && points.length > 1
        ? this.interpolatePoint(points[0], points[1], 0.25)
        : this.interpolatePoint(start, end, 0.18);
      badges.push(this.renderSvgBadge(pos.x, pos.y - 8, conn.sourceMultiplicity, '#0284C7'));
    }

    if (conn.name) {
      const mid = points && points.length > 1
        ? this.getPolylineMidpoint(points)
        : this.interpolatePoint(start, end, 0.5);
      badges.push(this.renderSvgBadge(mid.x, mid.y - 10, conn.name, '#475569'));
    }

    if (conn.targetMultiplicity && !isInheritance) {
      const lastIdx = points && points.length > 1 ? points.length - 1 : 1;
      const pA = points && points.length > 1 ? points[lastIdx - 1] : start;
      const pB = points && points.length > 1 ? points[lastIdx] : end;
      const pos = this.interpolatePoint(pA, pB, 0.75);
      badges.push(this.renderSvgBadge(pos.x, pos.y - 8, conn.targetMultiplicity, '#0284C7'));
    }

    return badges.join('\n');
  }

  /**
   * Renderiza una etiqueta de texto nítida en SVG sin fondo ni bordes de recuadro.
   */
  private renderSvgBadge(
    x: number,
    y: number,
    text: string,
    textColor: string,
  ): string {
    return `<text x="${x}" y="${y + 3.5}" class="uml-code" font-size="11" font-weight="normal" fill="${textColor}" text-anchor="middle" paint-order="stroke" stroke="#FFFFFF" stroke-width="3" stroke-linejoin="round">${this.escapeXml(text)}</text>`;
  }

  /**
   * Renderiza un nodo de clase UML en formato SVG.
   * Si la clase no contiene atributos, el compartimiento de métodos sigue inmediatamente
   * a la cabecera sin dejar espacios vacíos ni líneas divisorias redundantes.
   */
  private renderSvgClassNode(
    node: UmlClassNode,
    x: number,
    y: number,
    w: number,
    h: number,
  ): string {
    const parts: string[] = [];
    parts.push(`<g id="class-${node.id}">`);

    // Caja principal con estilo EA suave
    parts.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="#FAF6F0" stroke="#796354" stroke-width="1.4" />`,
    );

    const hasStereotype = !!node.stereotype;
    const headerH = hasStereotype ? 36 : 30;

    // Cabecera
    parts.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${headerH}" rx="2" fill="#EFE8DD" />`,
    );
    parts.push(
      `<line x1="${x}" y1="${y + headerH}" x2="${x + w}" y2="${y + headerH}" stroke="#796354" stroke-width="1" />`,
    );

    if (hasStereotype) {
      parts.push(
        `<text x="${x + w / 2}" y="${y + 13}" class="uml-text" font-size="10" font-style="italic" fill="#5C4D42" text-anchor="middle">&lt;&lt;${this.escapeXml(node.stereotype || '')}&gt;&gt;</text>`,
      );
      parts.push(
        `<text x="${x + w / 2}" y="${y + 27}" class="uml-text" font-size="12" font-weight="bold" fill="#241C18" text-anchor="middle">${this.escapeXml(node.name)}</text>`,
      );
    } else {
      parts.push(
        `<text x="${x + w / 2}" y="${y + 19}" class="uml-text" font-size="13" font-weight="bold" fill="#241C18" text-anchor="middle">${this.escapeXml(node.name)}</text>`,
      );
    }

    const attrs = node.attributes || [];
    const methods = node.methods || [];
    let currentY = y + headerH;

    // Atributos (sólo si existen)
    if (attrs.length > 0) {
      currentY += 14;
      for (const attr of attrs) {
        parts.push(
          `<text x="${x + 10}" y="${currentY}" class="uml-code" font-size="11" fill="#241C18">- ${this.escapeXml(attr.name)}: ${this.escapeXml(attr.type)}</text>`,
        );
        currentY += 18;
      }
    }

    // Métodos (sólo si existen)
    if (methods.length > 0) {
      if (attrs.length > 0) {
        currentY += 4;
        parts.push(
          `<line x1="${x}" y1="${currentY}" x2="${x + w}" y2="${currentY}" stroke="#796354" stroke-width="1" />`,
        );
        currentY += 14;
      } else {
        currentY += 14;
      }

      for (const m of methods) {
        const params = m.parameters ? `(${m.parameters})` : '()';
        const ret = m.returnType ? `: ${m.returnType}` : ': void';
        parts.push(
          `<text x="${x + 10}" y="${currentY}" class="uml-code" font-size="11" fill="#241C18">+ ${this.escapeXml(m.name)}${this.escapeXml(params)}${this.escapeXml(ret)}</text>`,
        );
        currentY += 18;
      }
    }

    parts.push('</g>');
    return parts.join('\n');
  }

  /**
   * Renderiza todos los elementos de un diagrama de comunicación en SVG:
   * nodos rectangulares subrayados y conexiones ortogonales con mensajes secuenciales y flechas direccionales.
   */
  private renderSvgCommunicationDiagram(
    svgParts: string[],
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    nodeMap: Map<string, { x: number; y: number; w: number; h: number; name: string }>,
  ): void {
    // 1. Conexiones y mensajes
    svgParts.push('<g id="comm-connections">');
    for (const conn of connections || []) {
      const source = this.resolveConnectionNode(conn.sourceNodeId || conn.sourceId, nodeMap);
      const target = this.resolveConnectionNode(conn.targetNodeId || conn.targetId, nodeMap);
      if (source && target && source !== target) {
        svgParts.push(this.renderSvgConnection(source, target, conn));
      }
    }
    svgParts.push('</g>');

    // 2. Nodos de comunicación (objetos con nombre subrayado)
    svgParts.push('<g id="comm-nodes">');
    for (const node of nodes) {
      const nInfo = nodeMap.get(node.id);
      if (!nInfo) continue;
      const isActor = node.nodeType === 'actor' || node.name?.toLowerCase().includes('actor');
      if (isActor) {
        svgParts.push(this.renderSvgActorNode(node, nInfo.x, nInfo.y, nInfo.w));
      } else {
        svgParts.push(this.renderSvgCommNode(node, nInfo.x, nInfo.y, nInfo.w, nInfo.h));
      }
    }
    svgParts.push('</g>');
  }

  /**
   * Renderiza un nodo de objeto de comunicación UML en SVG (caja con nombre subrayado).
   */
  private renderSvgCommNode(
    node: UmlClassNode,
    x: number,
    y: number,
    w: number,
    h: number,
  ): string {
    const parts: string[] = [];
    parts.push(`<g id="comm-node-${node.id}">`);
    parts.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${node.color || '#DDF4F5'}" stroke="#796354" stroke-width="1.4" />`,
    );
    parts.push(
      `<text x="${x + w / 2}" y="${y + h / 2 + 4}" class="uml-text" font-size="12" font-weight="bold" text-decoration="underline" fill="#241C18" text-anchor="middle">${this.escapeXml(node.name)}</text>`,
    );
    parts.push('</g>');
    return parts.join('\n');
  }

  /**
   * Escapa caracteres especiales en strings para su inclusión segura en XML/SVG.
   */
  private escapeXml(unsafe: string): string {
    return (unsafe || '').replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  }

  /**
   * Renderiza un nodo en SVG adaptándolo a su tipo (Actor, Caso de Uso o Clase).
   */
  private renderSvgNode(
    node: UmlClassNode,
    x: number,
    y: number,
    w: number,
    h: number,
  ): string {
    const isActor = node.nodeType === 'actor' || node.name?.toLowerCase().includes('actor');
    if (isActor) {
      return this.renderSvgActorNode(node, x, y, w);
    }
    if (node.nodeType === 'use_case') {
      return this.renderSvgUseCaseNode(node, x, y, w, h);
    }
    return this.renderSvgClassNode(node, x, y, w, h);
  }

  /**
   * Renderiza un Actor UML (figura humana stick figure) en SVG.
   */
  private renderSvgActorNode(node: UmlClassNode, x: number, y: number, w: number): string {
    const cx = x + w / 2;
    const parts: string[] = [];
    parts.push(`<g id="actor-${node.id}">`);
    parts.push(
      `<circle cx="${cx}" cy="${y + 12}" r="10" fill="${node.color || '#FEF2DD'}" stroke="#241C18" stroke-width="1.5" />`,
    );
    parts.push(
      `<line x1="${cx}" y1="${y + 22}" x2="${cx}" y2="${y + 42}" stroke="#241C18" stroke-width="1.5" />`,
    );
    parts.push(
      `<line x1="${cx - 16}" y1="${y + 30}" x2="${cx + 16}" y2="${y + 30}" stroke="#241C18" stroke-width="1.5" stroke-linecap="round" />`,
    );
    parts.push(
      `<line x1="${cx}" y1="${y + 42}" x2="${cx - 12}" y2="${y + 60}" stroke="#241C18" stroke-width="1.5" stroke-linecap="round" />`,
    );
    parts.push(
      `<line x1="${cx}" y1="${y + 42}" x2="${cx + 12}" y2="${y + 60}" stroke="#241C18" stroke-width="1.5" stroke-linecap="round" />`,
    );
    parts.push(
      `<text x="${cx}" y="${y + 74}" class="uml-text" font-size="12" font-weight="bold" fill="#241C18" text-anchor="middle">${this.escapeXml(node.name)}</text>`,
    );
    parts.push(`</g>`);
    return parts.join('\n');
  }

  /**
   * Renderiza una cabecera de línea de vida en SVG (con nombre subrayado estilo Enterprise Architect).
   */
  private renderSvgLifelineHeader(node: UmlClassNode, x: number, y: number, w: number): string {
    const parts: string[] = [];
    parts.push(`<g id="lifeline-${node.id}">`);
    parts.push(
      `<rect x="${x}" y="${y}" width="${w}" height="60" fill="${node.color || '#DDF4F5'}" stroke="#796354" stroke-width="1.4" />`,
    );
    parts.push(
      `<text x="${x + w / 2}" y="${y + 34}" class="uml-text" font-size="12" font-weight="bold" text-decoration="underline" fill="#241C18" text-anchor="middle">${this.escapeXml(node.name)}</text>`,
    );
    parts.push(`</g>`);
    return parts.join('\n');
  }

  /**
   * Renderiza un caso de uso (elipse UML) en SVG.
   */
  private renderSvgUseCaseNode(
    node: UmlClassNode,
    x: number,
    y: number,
    w: number,
    h: number,
  ): string {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rx = w / 2;
    const ry = h / 2;
    const parts: string[] = [];
    parts.push(`<g id="usecase-${node.id}">`);
    parts.push(
      `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${node.color || '#E5F2FE'}" stroke="#2563EB" stroke-width="1.5" />`,
    );
    parts.push(
      `<text x="${cx}" y="${cy + 4}" class="uml-text" font-size="12" font-weight="bold" fill="#1E293B" text-anchor="middle">${this.escapeXml(node.name)}</text>`,
    );
    parts.push(`</g>`);
    return parts.join('\n');
  }


  /**
   * Calcula la geometría de un diagrama de secuencia con las mismas constantes que la plataforma:
   * cabeceras de 60px (65px para actores), mensaje del slot N en `y + 157 + N * 50` y barras de
   * activación continuas obtenidas del servicio de secuencia (o de `node.activations` si no existe).
   */
  private buildSequenceLayout(
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    nodeMap: Map<string, { x: number; y: number; w: number; h: number; name: string }>,
  ): {
    lifelines: { cx: number; topY: number; bottomY: number }[];
    activations: { x: number; y: number; h: number; fill: string }[];
    messages: {
      startX: number;
      endX: number;
      y: number;
      isForward: boolean;
      isReply: boolean;
      color: string;
      parts: { text: string; opacity: number }[];
    }[];
  } {
    const lifelines: { cx: number; topY: number; bottomY: number }[] = [];
    const activations: { x: number; y: number; h: number; fill: string }[] = [];
    const messages: {
      startX: number;
      endX: number;
      y: number;
      isForward: boolean;
      isReply: boolean;
      color: string;
      parts: { text: string; opacity: number }[];
    }[] = [];

    let sequenceService: DiagramSequenceActivationService | null = null;
    try {
      sequenceService = this.injector.get(DiagramSequenceActivationService);
    } catch {
      sequenceService = null;
    }

    for (const node of nodes) {
      const nInfo = nodeMap.get(node.id);
      if (!nInfo) continue;
      const cx = nInfo.x + nInfo.w / 2;
      const isActor = node.nodeType === 'actor' || node.name?.toLowerCase().includes('actor');
      const headerH = isActor ? 65 : 60;
      lifelines.push({ cx, topY: nInfo.y + headerH, bottomY: nInfo.y + nInfo.h });

      let intervals: { top: number; height: number }[] = [];
      if (sequenceService) {
        try {
          intervals = sequenceService
            .getNodeActivations(node, connections, DiagramType.SEQUENCE)
            .map((a) => ({ top: a.top, height: a.height }));
        } catch {
          intervals = [];
        }
      }
      if (intervals.length === 0 && node.activations?.length) {
        intervals = node.activations.map((a) => ({ top: a.startY, height: a.height }));
      }
      const fill = node.color || (isActor ? '#FEF2DD' : '#DDF4F5');
      for (const iv of intervals) {
        activations.push({ x: cx - 7, y: nInfo.y + headerH + iv.top, h: iv.height, fill });
      }
    }

    for (let idx = 0; idx < connections.length; idx++) {
      const conn = connections[idx];
      const source = this.resolveConnectionNode(conn.sourceNodeId || conn.sourceId, nodeMap);
      const target = this.resolveConnectionNode(conn.targetNodeId || conn.targetId, nodeMap);
      if (!source || !target) continue;

      const sMatch = conn.sourceId?.match(/_slot_(\d+)$/);
      const tMatch = conn.targetId?.match(/_slot_(\d+)$/);
      const slot = sMatch ? parseInt(sMatch[1], 10) : tMatch ? parseInt(tMatch[1], 10) : idx;
      const y = source.y + 157 + slot * 50;

      const srcX = source.x + source.w / 2;
      const tgtX = target.x + target.w / 2;
      const isForward = tgtX >= srcX;
      const startX = isForward ? srcX + 7 : srcX - 7;
      const endX = isForward ? tgtX - 7 : tgtX + 7;

      const isReply = conn.type === 'reply' || !!conn.messages?.some((m) => m.isReturn);
      const color = conn.messages?.[0]?.color || (isReply ? '#2563EB' : '#059669');

      const msg = conn.messages?.[0];
      const parts: { text: string; opacity: number }[] = [];
      if (msg) {
        const num = msg.sequenceNumber ? `${msg.sequenceNumber}: ` : `${idx + 1}: `;
        const fn = msg.functionName || '';
        const params = isReply ? (msg.parameters ? `(${msg.parameters})` : '') : `(${msg.parameters || ''})`;
        parts.push({ text: `${num}${fn}${params}`, opacity: 1 });
        if (msg.returnType) parts.push({ text: ` : ${msg.returnType}`, opacity: 0.75 });
      } else {
        parts.push({ text: conn.name || `${idx + 1}: message()`, opacity: 1 });
      }

      messages.push({ startX, endX, y, isForward, isReply, color, parts });
    }

    return { lifelines, activations, messages };
  }

  /**
   * Renderiza todos los elementos de un diagrama de secuencia en SVG:
   * líneas de vida, activaciones, cabeceras y mensajes horizontales.
   */
  private renderSvgSequenceDiagram(
    svgParts: string[],
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    nodeMap: Map<string, { x: number; y: number; w: number; h: number; name: string }>,
    seqLifelineLength: number,
  ): void {
    void seqLifelineLength;
    const layout = this.buildSequenceLayout(nodes, connections, nodeMap);

    svgParts.push('<g id="sequence-lifelines">');
    for (const l of layout.lifelines) {
      svgParts.push(
        `<line x1="${l.cx}" y1="${l.topY}" x2="${l.cx}" y2="${l.bottomY}" stroke="#796354" stroke-width="1.5" stroke-dasharray="6,4" />`,
      );
    }
    svgParts.push('</g>');

    svgParts.push('<g id="sequence-activations">');
    for (const a of layout.activations) {
      svgParts.push(
        `<rect x="${a.x}" y="${a.y}" width="14" height="${a.h}" fill="${a.fill}" stroke="#796354" stroke-width="1" />`,
      );
    }
    svgParts.push('</g>');

    svgParts.push('<g id="sequence-messages">');
    for (const m of layout.messages) {
      const dash = m.isReply ? 'stroke-dasharray="6,4"' : '';
      svgParts.push(
        `<line x1="${m.startX}" y1="${m.y}" x2="${m.endX}" y2="${m.y}" stroke="${m.color}" stroke-width="1.8" ${dash} />`,
      );
      if (m.isReply) {
        const arrowAngle = m.isForward ? Math.PI : 0;
        const p1x = m.endX + 8 * Math.cos(arrowAngle - 0.5);
        const p1y = m.y + 8 * Math.sin(arrowAngle - 0.5);
        const p2x = m.endX + 8 * Math.cos(arrowAngle + 0.5);
        const p2y = m.y + 8 * Math.sin(arrowAngle + 0.5);
        svgParts.push(
          `<polyline points="${p1x},${p1y} ${m.endX},${m.y} ${p2x},${p2y}" fill="none" stroke="${m.color}" stroke-width="1.8" stroke-linecap="round" />`,
        );
      } else {
        const arrowDir = m.isForward ? -8 : 8;
        svgParts.push(
          `<polygon points="${m.endX},${m.y} ${m.endX + arrowDir},${m.y - 5} ${m.endX + arrowDir},${m.y + 5}" fill="${m.color}" stroke="${m.color}" stroke-width="1" />`,
        );
      }
      svgParts.push(this.renderSvgTextParts((m.startX + m.endX) / 2, m.y - 6, m.parts, m.color));
    }
    svgParts.push('</g>');

    svgParts.push('<g id="sequence-headers">');
    for (const node of nodes) {
      const nInfo = nodeMap.get(node.id);
      if (!nInfo) continue;
      const isActor = node.nodeType === 'actor' || node.name?.toLowerCase().includes('actor');
      if (isActor) {
        svgParts.push(this.renderSvgActorNode(node, nInfo.x, nInfo.y, nInfo.w));
      } else {
        svgParts.push(this.renderSvgLifelineHeader(node, nInfo.x, nInfo.y, nInfo.w));
      }
    }
    svgParts.push('</g>');
  }

  /**
   * Renderiza texto monoespaciado de peso normal (como la plataforma) compuesto por tramos con opacidad propia.
   */
  private renderSvgTextParts(
    x: number,
    y: number,
    parts: { text: string; opacity: number }[],
    color: string,
  ): string {
    const spans = parts
      .map((p) =>
        p.opacity < 1
          ? `<tspan fill-opacity="${p.opacity}">${this.escapeXml(p.text)}</tspan>`
          : this.escapeXml(p.text),
      )
      .join('');
    return `<text x="${x}" y="${y}" class="uml-code" font-size="11" font-weight="normal" fill="${color}" text-anchor="middle" xml:space="preserve">${spans}</text>`;
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
      this.toastService?.warning('No hay elementos en el diagrama para exportar.');
      return null;
    }

    const prefix = this.getDiagramPrefix(diagramType);
    const isCommunication =
      prefix === 'comm' ||
      (diagramType || '').toLowerCase().includes('comm');

    const isSequence =
      !isCommunication &&
      (prefix === 'sd' ||
        (diagramType || '').toLowerCase().includes('seq') ||
        (diagramType || '').toLowerCase().includes('sequence') ||
        (!diagramType && validNodes.some((n) => n.nodeType === 'lifeline')));

    let maxSlot = -1;
    if (isSequence) {
      for (const c of connections || []) {
        const sMatch = c.sourceId?.match(/_slot_(\d+)$/);
        const tMatch = c.targetId?.match(/_slot_(\d+)$/);
        if (sMatch) maxSlot = Math.max(maxSlot, parseInt(sMatch[1], 10));
        if (tMatch) maxSlot = Math.max(maxSlot, parseInt(tMatch[1], 10));
      }
      if (maxSlot < 0 && (connections || []).length > 0) {
        maxSlot = connections.length - 1;
      }
      if (maxSlot < 0) maxSlot = 2;
    }
    const seqLifelineLength = isSequence ? Math.max(120, 170 + maxSlot * 50) : 0;

    // 1. Calcular Bounding Box del contenido
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of validNodes) {
      const isActor = node.nodeType === 'actor' || node.name?.toLowerCase().includes('actor');
      const w =
        isSequence && isActor
          ? (node.width || 90)
          : isCommunication
            ? (node.width || 180)
            : (node.width || (isSequence ? 160 : 220));
      const h = this.calculateNodeHeight(node, isSequence, seqLifelineLength, isCommunication);
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

    let cleanName = diagramName.trim().replace(new RegExp(`^${prefix}\\s*[:\\-]?\\s*`, 'i'), '');
    cleanName = cleanName.replace(/^(uc|class|cd|sd|comm|pkg|cmp|dep|layered|arch|analysis)\s*[:\-]?\s*/i, '');
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
      this.toastService?.error('No se pudo inicializar el contexto de dibujo Canvas.');
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
      const isActor = node.nodeType === 'actor' || node.name?.toLowerCase().includes('actor');
      const w =
        isSequence && isActor
          ? (node.width || 90)
          : isCommunication
            ? (node.width || 180)
            : (node.width || (isSequence ? 160 : 220));
      const h = this.calculateNodeHeight(node, isSequence, seqLifelineLength, isCommunication);
      nodeMap.set(node.id, {
        x: node.position.x + offsetX,
        y: node.position.y + offsetY,
        w,
        h,
        name: node.name,
      });
    }

    if (isSequence) {
      this.drawFallbackSequenceDiagram(ctx, validNodes, connections || [], nodeMap, seqLifelineLength);
    } else if (isCommunication) {
      this.drawFallbackCommunicationDiagram(ctx, validNodes, connections || [], nodeMap);
    } else {
      // Dibujar conexiones
      for (const conn of connections || []) {
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
          this.drawNode(ctx, node, nInfo.x, nInfo.y, nInfo.w, nInfo.h);
        }
      }
    }

    return canvas;
  }

  /**
   * Dibuja un diagrama de comunicación en el contexto 2D de canvas (fallback para PNG/BMP).
   */
  private drawFallbackCommunicationDiagram(
    ctx: CanvasRenderingContext2D,
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    nodeMap: Map<string, { x: number; y: number; w: number; h: number; name: string }>,
  ): void {
    // 1. Conexiones
    for (const conn of connections || []) {
      const source = this.resolveConnectionNode(conn.sourceNodeId || conn.sourceId, nodeMap);
      const target = this.resolveConnectionNode(conn.targetNodeId || conn.targetId, nodeMap);

      if (source && target && source !== target) {
        this.drawConnection(ctx, source, target, conn);
      }
    }

    // 2. Nodos
    for (const node of nodes) {
      const nInfo = nodeMap.get(node.id);
      if (!nInfo) continue;
      const isActor = node.nodeType === 'actor' || node.name?.toLowerCase().includes('actor');
      if (isActor) {
        this.drawActorNode(ctx, node, nInfo.x, nInfo.y, nInfo.w);
      } else {
        this.drawCommNode(ctx, node, nInfo.x, nInfo.y, nInfo.w, nInfo.h);
      }
    }
  }

  /**
   * Dibuja un nodo objeto de comunicación en Canvas 2D (caja con nombre subrayado).
   */
  private drawCommNode(
    ctx: CanvasRenderingContext2D,
    node: UmlClassNode,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    ctx.save();
    ctx.fillStyle = node.color || '#DDF4F5';
    ctx.strokeStyle = '#796354';
    ctx.lineWidth = 1.4;

    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = '#241C18';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.name, x + w / 2, y + h / 2);

    // Subrayado
    const textWidth = ctx.measureText(node.name).width;
    ctx.strokeStyle = '#241C18';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x + w / 2 - textWidth / 2, y + h / 2 + 8);
    ctx.lineTo(x + w / 2 + textWidth / 2, y + h / 2 + 8);
    ctx.stroke();

    ctx.restore();
  }


  /**
   * Dibuja texto monoespaciado de peso normal centrado, compuesto por tramos con opacidad propia.
   */
  private drawTextParts(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    parts: { text: string; opacity: number }[],
    color: string,
    baseline: CanvasTextBaseline = 'alphabetic',
  ): void {
    ctx.save();
    ctx.font = 'normal 11px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = baseline;
    const widths = parts.map((p) => ctx.measureText(p.text).width);
    let cursor = x - widths.reduce((a, b) => a + b, 0) / 2;
    parts.forEach((p, i) => {
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = color;
      ctx.fillText(p.text, cursor, y);
      cursor += widths[i];
    });
    ctx.restore();
  }

  /**
   * Dibuja un diagrama de secuencia en el contexto 2D de canvas (fallback para PNG/BMP).
   */
  private drawFallbackSequenceDiagram(
    ctx: CanvasRenderingContext2D,
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    nodeMap: Map<string, { x: number; y: number; w: number; h: number; name: string }>,
    seqLifelineLength: number,
  ): void {
    void seqLifelineLength;
    const layout = this.buildSequenceLayout(nodes, connections, nodeMap);
    ctx.save();

    ctx.strokeStyle = '#796354';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    for (const l of layout.lifelines) {
      ctx.beginPath();
      ctx.moveTo(l.cx, l.topY);
      ctx.lineTo(l.cx, l.bottomY);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    ctx.lineWidth = 1;
    for (const a of layout.activations) {
      ctx.fillStyle = a.fill;
      ctx.strokeStyle = '#796354';
      ctx.fillRect(a.x, a.y, 14, a.h);
      ctx.strokeRect(a.x, a.y, 14, a.h);
    }

    for (const m of layout.messages) {
      ctx.strokeStyle = m.color;
      ctx.fillStyle = m.color;
      ctx.lineWidth = 1.8;
      ctx.setLineDash(m.isReply ? [6, 4] : []);
      ctx.beginPath();
      ctx.moveTo(m.startX, m.y);
      ctx.lineTo(m.endX, m.y);
      ctx.stroke();
      ctx.setLineDash([]);

      if (m.isReply) {
        const arrowAngle = m.isForward ? Math.PI : 0;
        ctx.beginPath();
        ctx.moveTo(m.endX + 8 * Math.cos(arrowAngle - 0.5), m.y + 8 * Math.sin(arrowAngle - 0.5));
        ctx.lineTo(m.endX, m.y);
        ctx.lineTo(m.endX + 8 * Math.cos(arrowAngle + 0.5), m.y + 8 * Math.sin(arrowAngle + 0.5));
        ctx.stroke();
      } else {
        const arrowDir = m.isForward ? -8 : 8;
        ctx.beginPath();
        ctx.moveTo(m.endX, m.y);
        ctx.lineTo(m.endX + arrowDir, m.y - 5);
        ctx.lineTo(m.endX + arrowDir, m.y + 5);
        ctx.closePath();
        ctx.fill();
      }

      this.drawTextParts(ctx, (m.startX + m.endX) / 2, m.y - 6, m.parts, m.color);
    }

    for (const node of nodes) {
      const nInfo = nodeMap.get(node.id);
      if (!nInfo) continue;
      const isActor = node.nodeType === 'actor' || node.name?.toLowerCase().includes('actor');
      if (isActor) {
        this.drawActorNode(ctx, node, nInfo.x, nInfo.y, nInfo.w);
      } else {
        this.drawLifelineHeader(ctx, node, nInfo.x, nInfo.y, nInfo.w);
      }
    }

    ctx.restore();
  }

  /**
   * Dibuja un nodo en Canvas adaptándolo a su tipo (Actor, Caso de Uso o Clase).
   */
  private drawNode(
    ctx: CanvasRenderingContext2D,
    node: UmlClassNode,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const isActor = node.nodeType === 'actor' || node.name?.toLowerCase().includes('actor');
    if (isActor) {
      this.drawActorNode(ctx, node, x, y, w);
      return;
    }
    if (node.nodeType === 'use_case') {
      this.drawUseCaseNode(ctx, node, x, y, w, h);
      return;
    }
    this.drawClassNode(ctx, node, x, y, w, h);
  }

  /**
   * Dibuja un Actor en Canvas 2D.
   */
  private drawActorNode(
    ctx: CanvasRenderingContext2D,
    node: UmlClassNode,
    x: number,
    y: number,
    w: number,
  ): void {
    const cx = x + w / 2;
    ctx.save();
    ctx.strokeStyle = '#241C18';
    ctx.lineWidth = 1.5;

    // Cabeza
    ctx.beginPath();
    ctx.arc(cx, y + 12, 10, 0, Math.PI * 2);
    ctx.fillStyle = node.color || '#FEF2DD';
    ctx.fill();
    ctx.stroke();

    // Tronco
    ctx.beginPath();
    ctx.moveTo(cx, y + 22);
    ctx.lineTo(cx, y + 42);
    ctx.stroke();

    // Brazos
    ctx.beginPath();
    ctx.moveTo(cx - 16, y + 30);
    ctx.lineTo(cx + 16, y + 30);
    ctx.stroke();

    // Piernas
    ctx.beginPath();
    ctx.moveTo(cx, y + 42);
    ctx.lineTo(cx - 12, y + 60);
    ctx.moveTo(cx, y + 42);
    ctx.lineTo(cx + 12, y + 60);
    ctx.stroke();

    // Etiqueta
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillStyle = '#241C18';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(node.name, cx, y + 68);

    ctx.restore();
  }

  /**
   * Dibuja una cabecera de línea de vida en Canvas 2D.
   */
  private drawLifelineHeader(
    ctx: CanvasRenderingContext2D,
    node: UmlClassNode,
    x: number,
    y: number,
    w: number,
  ): void {
    ctx.save();
    ctx.fillStyle = node.color || '#DDF4F5';
    ctx.strokeStyle = '#796354';
    ctx.lineWidth = 1.4;

    ctx.fillRect(x, y, w, 60);
    ctx.strokeRect(x, y, w, 60);

    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillStyle = '#241C18';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.name, x + w / 2, y + 30);

    ctx.restore();
  }

  /**
   * Dibuja un caso de uso (elipse) en Canvas 2D.
   */
  private drawUseCaseNode(
    ctx: CanvasRenderingContext2D,
    node: UmlClassNode,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rx = w / 2;
    const ry = h / 2;

    ctx.save();
    ctx.fillStyle = node.color || '#E5F2FE';
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillStyle = '#1E293B';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.name, cx, cy);

    ctx.restore();
  }

  /**
   * Obtiene el color de la paleta para un número de secuencia en diagramas de comunicación/secuencia.
   */
  private getSequenceMessageColor(sequenceNumber?: string | null): string {
    const palette = ['#0284C7', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0891B2', '#4F46E5', '#C026D3'];
    const match = (sequenceNumber || '').trim().match(/^(\d+)(?:\.|$)/);
    if (match) {
      const g = parseInt(match[1], 10);
      return palette[(Math.max(1, g) - 1) % palette.length];
    }
    return palette[0];
  }


  /**
   * Calcula los vértices de una conexión replicando el trazado de la plataforma:
   * anclaje en el centro del lado indicado por el puerto (`_top`, `_right`, `_bottom`, `_left`),
   * o en la intersección con el borde si no hay puerto, y codo en L / tramo en Z (estilo lateral).
   */
  private calculateConnectionPoints(
    source: { x: number; y: number; w: number; h: number },
    target: { x: number; y: number; w: number; h: number },
    conn: UmlConnection,
  ): { x: number; y: number }[] {
    type Side = 'top' | 'right' | 'bottom' | 'left';
    const sCenter = { x: source.x + source.w / 2, y: source.y + source.h / 2 };
    const tCenter = { x: target.x + target.w / 2, y: target.y + target.h / 2 };

    const getPortSide = (portId?: string): Side | null => {
      if (!portId) return null;
      if (portId.includes('_top')) return 'top';
      if (portId.includes('_right')) return 'right';
      if (portId.includes('_bottom')) return 'bottom';
      if (portId.includes('_left')) return 'left';
      return null;
    };
    const anchor = (box: { x: number; y: number; w: number; h: number }, side: Side) => {
      switch (side) {
        case 'top': return { x: box.x + box.w / 2, y: box.y };
        case 'bottom': return { x: box.x + box.w / 2, y: box.y + box.h };
        case 'left': return { x: box.x, y: box.y + box.h / 2 };
        default: return { x: box.x + box.w, y: box.y + box.h / 2 };
      }
    };
    const inferSide = (p: { x: number; y: number }, box: { x: number; y: number; w: number; h: number }): Side => {
      const d: [Side, number][] = [
        ['top', Math.abs(p.y - box.y)],
        ['bottom', Math.abs(p.y - (box.y + box.h))],
        ['left', Math.abs(p.x - box.x)],
        ['right', Math.abs(p.x - (box.x + box.w))],
      ];
      return d.sort((a, b) => a[1] - b[1])[0][0];
    };

    const sPort = getPortSide(conn.sourceId);
    const tPort = getPortSide(conn.targetId);
    const start = sPort ? anchor(source, sPort) : this.getRectIntersection(sCenter, tCenter, source);
    const end = tPort ? anchor(target, tPort) : this.getRectIntersection(tCenter, sCenter, target);

    const style = conn.lineStyle || 'orthogonal_square';
    if (style === 'straight' || style === 'bezier') {
      return [start, end];
    }

    const sSide = sPort ?? inferSide(start, source);
    const tSide = tPort ?? inferSide(end, target);
    const sV = sSide === 'top' || sSide === 'bottom';
    const tV = tSide === 'top' || tSide === 'bottom';

    let corners: { x: number; y: number }[];
    if (sV !== tV) {
      corners = [sV ? { x: start.x, y: end.y } : { x: end.x, y: start.y }];
    } else if (sV) {
      const midY = (start.y + end.y) / 2;
      corners = [{ x: start.x, y: midY }, { x: end.x, y: midY }];
    } else {
      const midX = (start.x + end.x) / 2;
      corners = [{ x: midX, y: start.y }, { x: midX, y: end.y }];
    }

    const raw = [start, ...corners, end];
    const points = raw.filter(
      (p, i) => i === 0 || Math.abs(p.x - raw[i - 1].x) > 0.5 || Math.abs(p.y - raw[i - 1].y) > 0.5,
    );
    return points.length >= 2 ? points : [start, end];
  }

  /**
   * Obtiene el punto medio de una línea poligonal ortogonal.
   */
  private getPolylineMidpoint(points: { x: number; y: number }[]): { x: number; y: number } {
    if (points.length <= 2) {
      return this.interpolatePoint(points[0], points[points.length - 1], 0.5);
    }
    let totalLen = 0;
    const lens: number[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const segLen = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
      lens.push(segLen);
      totalLen += segLen;
    }
    let targetDist = totalLen * 0.5;
    for (let i = 0; i < points.length - 1; i++) {
      if (targetDist <= lens[i]) {
        const t = lens[i] > 0 ? targetDist / lens[i] : 0;
        return this.interpolatePoint(points[i], points[i + 1], t);
      }
      targetDist -= lens[i];
    }
    return points[Math.floor(points.length / 2)];
  }

  /**
   * Calcula la altura estimada requerida para renderizar una clase UML en el canvas de fallback.
   * Si la clase no tiene atributos, no se reserva espacio de atributos.
   * @param node Nodo de clase UML a calcular.
   * @param isSequence Indica si el diagrama es de secuencia.
   * @param seqLifelineLength Longitud calculada de las líneas de vida en secuencia.
   * @param isCommunication Indica si el diagrama es de comunicación.
   * @returns Altura calculada en píxeles.
   */
  private calculateNodeHeight(
    node: UmlClassNode,
    isSequence = false,
    seqLifelineLength = 0,
    isCommunication = false,
  ): number {
    if (isSequence) {
      return 60 + seqLifelineLength;
    }
    const isActor = node.nodeType === 'actor' || node.name?.toLowerCase().includes('actor');
    if (isActor) {
      return 85;
    }
    if (isCommunication) {
      return node.height || 44;
    }
    if (node.nodeType === 'use_case') {
      return 50;
    }
    const headerHeight = node.stereotype ? 38 : 32;
    const attrCount = (node.attributes || []).length;
    const attrHeight = attrCount > 0 ? attrCount * 18 + 12 : 0;
    const methodCount = (node.methods || []).length;
    const methodHeight = methodCount > 0 ? methodCount * 18 + 14 : 0;
    return Math.max(headerHeight + attrHeight + methodHeight, node.height || 44);
  }

  /**
   * Obtiene la información geométrica del nodo de origen o destino a partir de su ID o identificador de puerto.
   * @param idOrPort Cadena identificadora del nodo o conector.
   * @param nodeMap Mapa con los límites y posición de cada nodo.
   * @returns Dimensiones y posición del nodo resuelto, o undefined si no existe.
   */
  private resolveConnectionNode(
    idOrPort: string,
    nodeMap: Map<string, { x: number; y: number; w: number; h: number; name: string }>,
  ): { x: number; y: number; w: number; h: number; name: string } | undefined {
    if (!idOrPort) return undefined;
    const cleanId = idOrPort.replace(/_((top|bottom|left|right)(_start|_end)?|slot_\d+)$/, '').trim();
    return nodeMap.get(cleanId);
  }

  /**
   * Dibuja una línea de relación entre dos nodos en el contexto 2D del canvas.
   * Soporta trazados ortogonales con quiebres y mensajes direccionales de comunicación.
   * @param ctx Contexto 2D del canvas.
   * @param source Bounding box del nodo de origen.
   * @param target Bounding box del nodo de destino.
   * @param conn Datos del conector UML.
   */
  private drawConnection(
    ctx: CanvasRenderingContext2D,
    source: { x: number; y: number; w: number; h: number },
    target: { x: number; y: number; w: number; h: number },
    conn: UmlConnection,
  ): void {
    const points = this.calculateConnectionPoints(source, target, conn);
    const start = points[0];
    const end = points[points.length - 1];

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
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    ctx.setLineDash([]);
    const prevPoint = points[points.length - 2];
    this.drawRelationshipMarker(ctx, start, end, conn.type, points[1], prevPoint);

    if (conn.messages && conn.messages.length > 0) {
      this.drawCommMessages(ctx, points, conn.messages);
    } else {
      this.drawMultiplicityAndLabels(ctx, start, end, conn, points);
    }

    ctx.restore();
  }


  /**
   * Dibuja los mensajes secuenciales de comunicación a lo largo de la arista en Canvas 2D (peso normal).
   */
  private drawCommMessages(
    ctx: CanvasRenderingContext2D,
    points: { x: number; y: number }[],
    messages: UmlMessage[],
  ): void {
    const mid = this.getPolylineMidpoint(points);
    const forwardMsgs = messages.filter((m) => (m.direction || 'forward') !== 'reverse');
    const reverseMsgs = messages.filter((m) => m.direction === 'reverse');

    forwardMsgs.forEach((msg, i) => {
      const color = msg.color || this.getSequenceMessageColor(msg.sequenceNumber);
      const y = mid.y - 8 - (forwardMsgs.length - 1 - i) * 16;
      this.drawTextParts(ctx, mid.x, y, this.buildCommMessageParts(msg, false), color, 'middle');
    });
    reverseMsgs.forEach((msg, i) => {
      const color = msg.color || this.getSequenceMessageColor(msg.sequenceNumber);
      this.drawTextParts(ctx, mid.x, mid.y + 18 + i * 16, this.buildCommMessageParts(msg, true), color, 'middle');
    });
  }

  /**
   * Dibuja los extremos y puntas de flecha de la relación según el estándar UML (herencia, agregación, composición, etc.).
   * @param ctx Contexto 2D del canvas.
   * @param start Coordenada inicial de la conexión.
   * @param end Coordenada final de la conexión.
   * @param type Tipo de relación UML.
   */
  private drawRelationshipMarker(
    ctx: CanvasRenderingContext2D,
    start: { x: number; y: number },
    end: { x: number; y: number },
    type: string,
    second: { x: number; y: number } = end,
    penultimate: { x: number; y: number } = start,
  ): void {
    const angle = Math.atan2(end.y - penultimate.y, end.x - penultimate.x);
    const startAngle = Math.atan2(second.y - start.y, second.x - start.x);

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
      const oppAngle = startAngle + Math.PI;

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
    } else if (type === 'assembly') {
      const mid = this.interpolatePoint(start, end, 0.5);
      const normalAngle = angle + Math.PI / 2;

      ctx.save();
      // 1. Círculo interno (Ball)
      ctx.beginPath();
      ctx.arc(mid.x, mid.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 2. Semicírculo exterior (Socket)
      ctx.beginPath();
      ctx.arc(mid.x, mid.y, 11, normalAngle, normalAngle + Math.PI);
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * Renderiza multiplicidades y etiquetas textuales adyacentes a la línea de conexión como texto limpio (sin recuadro).
   * @param ctx Contexto 2D del canvas.
   * @param start Punto de inicio de la línea.
   * @param end Punto final de la línea.
   * @param conn Datos de la conexión que contiene multiplicidades y etiquetas.
   * @param points Vértices calculados de la conexión.
   */
  private drawMultiplicityAndLabels(
    ctx: CanvasRenderingContext2D,
    start: { x: number; y: number },
    end: { x: number; y: number },
    conn: UmlConnection,
    points?: { x: number; y: number }[],
  ): void {
    const isInheritance = conn.type === 'generalization' || conn.type === 'realization';

    if (conn.sourceMultiplicity && !isInheritance) {
      const pos = points && points.length > 1
        ? this.interpolatePoint(points[0], points[1], 0.25)
        : this.interpolatePoint(start, end, 0.18);
      this.drawBadge(ctx, pos.x, pos.y - 8, conn.sourceMultiplicity, '#0284C7');
    }

    if (conn.name) {
      const mid = points && points.length > 1
        ? this.getPolylineMidpoint(points)
        : this.interpolatePoint(start, end, 0.5);
      this.drawBadge(ctx, mid.x, mid.y - 10, conn.name, '#475569');
    }

    if (conn.targetMultiplicity && !isInheritance) {
      const lastIdx = points && points.length > 1 ? points.length - 1 : 1;
      const pA = points && points.length > 1 ? points[lastIdx - 1] : start;
      const pB = points && points.length > 1 ? points[lastIdx] : end;
      const pos = this.interpolatePoint(pA, pB, 0.75);
      this.drawBadge(ctx, pos.x, pos.y - 8, conn.targetMultiplicity, '#0284C7');
    }
  }

  /**
   * Dibuja una etiqueta de texto nítida directamente sobre el lienzo sin recuadro ni fondo de píldora.
   * @param ctx Contexto 2D del canvas.
   * @param x Coordenada X central.
   * @param y Coordenada Y central.
   * @param text Texto a mostrar.
   * @param textColor Color de la tipografía.
   */
  private drawBadge(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    text: string,
    textColor: string,
  ): void {
    ctx.save();
    ctx.font = 'normal 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    if (typeof ctx.strokeText === 'function') {
      ctx.strokeText(text, x, y);
    }
    ctx.fillStyle = textColor;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  /**
   * Dibuja una caja de clase UML con su cabecera, atributos y métodos en el canvas 2D de fallback.
   * Si no posee atributos, los métodos se dibujan inmediatamente debajo de la cabecera sin espacio vacío.
   * @param ctx Contexto 2D del canvas.
   * @param node Nodo de clase UML.
   * @param x Posición horizontal.
   * @param y Posición vertical.
   * @param w Ancho de la caja.
   * @param h Alto de la caja.
   */
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

    const hasStereotype = !!node.stereotype;
    const headerHeight = hasStereotype ? 36 : 30;

    ctx.fillStyle = '#EFE8DD';
    ctx.beginPath();
    ctx.rect(x, y, w, headerHeight);
    ctx.fill();
    ctx.strokeStyle = '#796354';
    ctx.beginPath();
    ctx.moveTo(x, y + headerHeight);
    ctx.lineTo(x + w, y + headerHeight);
    ctx.stroke();

    if (hasStereotype) {
      ctx.font = 'italic 10px sans-serif';
      ctx.fillStyle = '#5C4D42';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`<<${node.stereotype}>>`, x + w / 2, y + 12);

      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#241C18';
      ctx.fillText(node.name, x + w / 2, y + 26);
    } else {
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#241C18';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.name, x + w / 2, y + headerHeight / 2);
    }

    const attributes = node.attributes || [];
    const methods = node.methods || [];
    let currentY = y + headerHeight;

    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    if (attributes.length > 0) {
      currentY += 12;
      for (const attr of attributes) {
        ctx.fillStyle = '#241C18';
        ctx.fillText(`- ${attr.name}: ${attr.type}`, x + 10, currentY);
        currentY += 18;
      }
    }

    if (methods.length > 0) {
      if (attributes.length > 0) {
        currentY += 2;
        ctx.strokeStyle = '#796354';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, currentY);
        ctx.lineTo(x + w, currentY);
        ctx.stroke();
        currentY += 12;
      } else {
        currentY += 12;
      }

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

  /**
   * Calcula la intersección entre la recta trazada entre dos puntos y el perímetro de un rectángulo delimitador.
   * @param center Punto de origen interno del elemento.
   * @param target Punto objetivo hacia el que se dirige la recta.
   * @param rect Límites del rectángulo.
   * @returns Punto sobre el borde del rectángulo donde cruza la recta.
   */
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

  /**
   * Interpola linealmente una posición intermedia entre dos puntos dados.
   * @param p1 Punto de inicio.
   * @param p2 Punto final.
   * @param t Factor de interpolación paramétrica (0 a 1).
   * @returns Punto interpolado en las coordenadas resultantes.
   */
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
    return this.encoder.convertImageDataToBmp(imageData);
  }
}
