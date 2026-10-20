import { Injectable, NgZone } from '@angular/core';
import Konva from 'konva';

export interface StageInitOptions {
  container: HTMLElement;
  parentContainer?: HTMLElement | null;
  initialZoom: number;
  boardWidth: number;
  boardHeight: number;
  scaledBoardWidth: number;
  scaledBoardHeight: number;
  showGrid: boolean;
  onResize?: () => void;
}

/**
 * Servicio encargado de gestionar el ciclo de vida del Konva.Stage y sus capas principales.
 *
 * Administra la creación de las 5 capas del lienzo, la cuantización de dimensiones en bloques
 * de memoria de 512px (Bucket Sizing) para prevenir picos de memoria RAM al escalar el zoom,
 * y el trazado de la cuadrícula base de fondo.
 */
@Injectable({
  providedIn: 'root',
})
export class CanvasStageManagerService {
  private stage: Konva.Stage | null = null;
  private bgLayer: Konva.Layer | null = null;
  private frameLayer: Konva.Layer | null = null;
  private relLayer: Konva.Layer | null = null;
  private nodeLayer: Konva.Layer | null = null;
  private uiLayer: Konva.Layer | null = null;
  private bgRect: Konva.Rect | null = null;
  private gridGroup: Konva.Group | null = null;
  private resizeObserver?: ResizeObserver;

  /**
   * Obtiene la instancia activa del escenario Konva.Stage.
   *
   * @returns Instancia de Konva.Stage o null si no ha sido inicializado.
   */
  getStage(): Konva.Stage | null {
    return this.stage;
  }

  /**
   * Obtiene la capa de fondo (bgLayer) que contiene el fondo y la cuadrícula.
   *
   * @returns Instancia de Konva.Layer correspondiente a bgLayer.
   */
  getBgLayer(): Konva.Layer | null {
    return this.bgLayer;
  }

  /**
   * Obtiene la capa de marcos estructurales (frameLayer) para paquetes y recuadros agrupadores.
   *
   * @returns Instancia de Konva.Layer correspondiente a frameLayer.
   */
  getFrameLayer(): Konva.Layer | null {
    return this.frameLayer;
  }

  /**
   * Obtiene la capa de relaciones y conexiones UML (relLayer).
   *
   * @returns Instancia de Konva.Layer correspondiente a relLayer.
   */
  getRelLayer(): Konva.Layer | null {
    return this.relLayer;
  }

  /**
   * Obtiene la capa de nodos UML estándar (nodeLayer).
   *
   * @returns Instancia de Konva.Layer correspondiente a nodeLayer.
   */
  getNodeLayer(): Konva.Layer | null {
    return this.nodeLayer;
  }

  /**
   * Obtiene la capa de interfaz flotante (uiLayer) para guías, transformador y selección.
   *
   * @returns Instancia de Konva.Layer correspondiente a uiLayer.
   */
  getUiLayer(): Konva.Layer | null {
    return this.uiLayer;
  }

  /**
   * Obtiene el rectángulo de fondo interactivo del lienzo.
   *
   * @returns Rectángulo Konva.Rect de fondo o null.
   */
  getBgRect(): Konva.Rect | null {
    return this.bgRect;
  }

  /**
   * Obtiene el grupo contenedor de líneas de la cuadrícula.
   *
   * @returns Grupo Konva.Group que contiene las líneas del grid o null.
   */
  getGridGroup(): Konva.Group | null {
    return this.gridGroup;
  }

  /**
   * Inicializa el escenario Konva.Stage y construye la jerarquía de las 5 capas principales.
   *
   * @param options Configuración inicial con contenedores DOM, zoom y dimensiones del tablero.
   * @param ngZone Servicio NgZone para ejecutar la instanciación fuera de la detección de cambios de Angular.
   * @returns Instancia de Konva.Stage creada.
   */
  initStage(options: StageInitOptions, ngZone: NgZone): Konva.Stage | null {
    const {
      container,
      parentContainer,
      initialZoom,
      boardWidth,
      boardHeight,
      scaledBoardWidth,
      scaledBoardHeight,
      showGrid,
      onResize,
    } = options;
    if (!container) return null;

    const scale = Math.max(0.2, initialZoom / 100);
    const rawTargetW = Math.min(
      4096,
      Math.max(parentContainer?.clientWidth || 0, scaledBoardWidth, 2200),
    );
    const rawTargetH = Math.min(
      4096,
      Math.max(parentContainer?.clientHeight || 0, scaledBoardHeight, 1400),
    );

    // Cuantización de dimensiones a bloques de 512px (Bucket Sizing para optimizar RAM)
    const width = Math.ceil(rawTargetW / 512) * 512;
    const height = Math.ceil(rawTargetH / 512) * 512;

    // Forzar pixelRatio = 1 evita multiplicar x2.25 o x4 el consumo de RAM de las 5 capas en pantallas HiDPI
    Konva.pixelRatio = 1;
    Konva.dragDistance = 3;

    ngZone.runOutsideAngular(() => {
      this.stage = new Konva.Stage({
        container: container as HTMLDivElement,
        width,
        height,
        draggable: false,
      });

      this.stage.scale({ x: scale, y: scale });
      this.stage.position({ x: 0, y: 0 });

      // Capa de fondo estática: sin hit-testing ni hitCanvas en memoria.
      this.bgLayer = new Konva.Layer({ listening: false });
      this.bgLayer.hitGraphEnabled(false);

      this.frameLayer = new Konva.Layer({ listening: true });
      this.relLayer = new Konva.Layer();
      this.nodeLayer = new Konva.Layer();
      this.uiLayer = new Konva.Layer();

      const effectiveW = Math.max(boardWidth, Math.ceil(width / scale));
      const effectiveH = Math.max(boardHeight, Math.ceil(height / scale));

      this.bgRect = new Konva.Rect({
        x: 0,
        y: 0,
        width: effectiveW,
        height: effectiveH,
        fill: '#FAF9F5',
        listening: false,
        perfectDrawEnabled: false,
      });
      this.bgLayer.add(this.bgRect);

      this.gridGroup = new Konva.Group({ listening: false });
      this.bgLayer.add(this.gridGroup);

      this.stage.add(this.bgLayer);
      this.stage.add(this.frameLayer);
      this.stage.add(this.relLayer);
      this.stage.add(this.nodeLayer);
      this.stage.add(this.uiLayer);

      this.drawGrid(showGrid, boardWidth, boardHeight);

      if (onResize && parentContainer) {
        let resizeRafId: number | null = null;
        this.resizeObserver = new ResizeObserver(() => {
          if (resizeRafId !== null) return;
          resizeRafId = requestAnimationFrame(() => {
            resizeRafId = null;
            onResize();
          });
        });
        // Observar únicamente parentContainer (viewport externo) para evitar bucle infinito con el stage interno
        this.resizeObserver.observe(parentContainer);
      }
    });

    return this.stage;
  }

  /**
   * Actualiza las dimensiones físicas y escala del escenario Konva aplicando cuantización (Bucket Sizing).
   *
   * @param params Dimensiones actuales del contenedor, tablero y nivel de zoom activo.
   * @returns Objeto indicando si las dimensiones o la escala sufrieron cambios.
   */
  updateStageDimensions(params: {
    container?: HTMLElement | null;
    parentContainer?: HTMLElement | null;
    zoomLevel: number;
    boardWidth: number;
    boardHeight: number;
    scaledBoardWidth: number;
    scaledBoardHeight: number;
    showGrid: boolean;
  }): { dimensionsChanged: boolean; scaleChanged: boolean } {
    if (!this.stage) return { dimensionsChanged: false, scaleChanged: false };

    const {
      parentContainer,
      zoomLevel,
      boardWidth,
      boardHeight,
      scaledBoardWidth,
      scaledBoardHeight,
      showGrid,
    } = params;
    const scale = Math.max(0.2, zoomLevel / 100);
    const rawTargetW = Math.min(
      4096,
      Math.max(parentContainer?.clientWidth || 0, scaledBoardWidth),
    );
    const rawTargetH = Math.min(
      4096,
      Math.max(parentContainer?.clientHeight || 0, scaledBoardHeight),
    );

    const targetW = Math.ceil(rawTargetW / 512) * 512;
    const targetH = Math.ceil(rawTargetH / 512) * 512;

    let dimensionsChanged = false;
    let scaleChanged = false;

    if (targetW > 0 && targetH > 0) {
      if (this.stage.width() !== targetW || this.stage.height() !== targetH) {
        this.stage.width(targetW);
        this.stage.height(targetH);
        dimensionsChanged = true;
      }

      scaleChanged = this.stage.scaleX() !== scale || this.stage.scaleY() !== scale;
      if (scaleChanged) {
        this.stage.scale({ x: scale, y: scale });
        this.stage.position({ x: 0, y: 0 });
      }

      if (dimensionsChanged || scaleChanged) {
        this.drawGrid(showGrid, boardWidth, boardHeight);
        this.stage.batchDraw();
      }
    }

    return { dimensionsChanged, scaleChanged };
  }

  /**
   * Dibuja o limpia las líneas guía de cuadrícula (Grid) sobre la capa de fondo
   * utilizando un único Konva.Shape vectorizado en lugar de cientos de nodos Konva.Line.
   *
   * @param showGrid Indica si las líneas de la cuadrícula deben ser visibles.
   * @param boardWidth Ancho nominal de la pizarra.
   * @param boardHeight Alto nominal de la pizarra.
   */
  drawGrid(showGrid: boolean, boardWidth: number, boardHeight: number): void {
    if (!this.gridGroup || !this.bgLayer || !this.stage) return;
    this.gridGroup.destroyChildren();

    const targetW = this.stage.width();
    const targetH = this.stage.height();
    const scale = Math.max(0.25, this.stage.scaleX() || 1);

    const effectiveW = Math.min(8000, Math.max(boardWidth, Math.ceil(targetW / scale)));
    const effectiveH = Math.min(6000, Math.max(boardHeight, Math.ceil(targetH / scale)));

    if (this.bgRect) {
      this.bgRect.position({ x: 0, y: 0 });
      this.bgRect.width(effectiveW);
      this.bgRect.height(effectiveH);
    }

    if (showGrid) {
      const step = 28;
      const majorStep = step * 4;
      const gridShape = new Konva.Shape({
        listening: false,
        perfectDrawEnabled: false,
        sceneFunc: (ctx) => {
          // 1. Líneas secundarias en un solo path nativo
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(120, 113, 108, 0.05)';
          ctx.lineWidth = 1;
          for (let x = 0; x <= effectiveW; x += step) {
            if (x % majorStep === 0) continue;
            ctx.moveTo(x, 0);
            ctx.lineTo(x, effectiveH);
          }
          for (let y = 0; y <= effectiveH; y += step) {
            if (y % majorStep === 0) continue;
            ctx.moveTo(0, y);
            ctx.lineTo(effectiveW, y);
          }
          ctx.stroke();

          // 2. Líneas principales en un solo path nativo
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(120, 113, 108, 0.15)';
          ctx.lineWidth = 1;
          for (let x = 0; x <= effectiveW; x += majorStep) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, effectiveH);
          }
          for (let y = 0; y <= effectiveH; y += majorStep) {
            ctx.moveTo(0, y);
            ctx.lineTo(effectiveW, y);
          }
          ctx.stroke();
        },
      });
      this.gridGroup.add(gridShape);
    }

    this.bgLayer.batchDraw();
  }

  /**
   * Libera y destruye todos los observadores, capas y recursos de Konva.
   */
  destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }
    if (this.stage) {
      this.stage.destroy();
      this.stage = null;
    }
    this.bgLayer = null;
    this.frameLayer = null;
    this.relLayer = null;
    this.nodeLayer = null;
    this.uiLayer = null;
    this.bgRect = null;
    this.gridGroup = null;
  }
}
