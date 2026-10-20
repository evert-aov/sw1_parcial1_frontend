import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  GLSL_FS,
  GLSL_VS,
  WGSL_SHADER,
  parseCssColor,
  renderCommunication2D,
} from './communication-gl.shaders';

export type CommunicationElementType = 'boundary' | 'control' | 'entity' | 'actor';
export type GlBackend = 'webgpu' | 'webgl' | '2d';

/**
 * Componente de renderizado acelerado por GPU (WebGPU / WebGL / Canvas 2D) para
 * estereotipos de análisis y diagramas de comunicación UML (boundary, control, entity, actor).
 */
@Component({
  selector: 'app-communication-gl',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        position: relative;
        box-sizing: border-box;
        max-width: 100%;
        max-height: 100%;
      }
      canvas {
        display: block;
        width: 100% !important;
        height: 100% !important;
        max-width: 100% !important;
        max-height: 100% !important;
        pointer-events: none;
        object-fit: contain;
      }
    `,
  ],
  host: {
    '[style.width]': 'computedWidth',
    '[style.height]': 'computedHeight',
    '[style.display]': "width === '100%' ? 'flex' : 'inline-flex'",
    class: 'shrink-0',
  },
  template: `
    <canvas #glCanvas [class]="className || 'w-full h-full'"></canvas>
  `,
})
export class CommunicationGlComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() type: CommunicationElementType = 'boundary';
  @Input() width: number | string = '100%';
  @Input() height: number | string = '100%';
  @Input() fillColor: string = '#D2EEF3';
  @Input() strokeColor: string = '#241C18';
  @Input() strokeWidth: number = 1.35;
  @Input() zoom: number = 100;
  @Input() className: string = '';

  @ViewChild('glCanvas', { static: true })
  private readonly canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly activeBackend = signal<GlBackend>('webgl');

  private readonly elRef = inject(ElementRef);
  private readonly ngZone = inject(NgZone);
  private resizeObserver?: ResizeObserver;
  private animFrameId?: number;

  private gpuDevice?: any;
  private gpuPipeline?: any;
  private gpuUniformBuffer?: any;
  private gpuBindGroup?: any;
  private gpuContext?: any;

  private glContext?: WebGLRenderingContext | WebGL2RenderingContext;
  private glProgram?: WebGLProgram;
  private glBuffer?: WebGLBuffer;
  private glUniformLocs: { [name: string]: WebGLUniformLocation | null } = {};

  /**
   * Indica si el componente utiliza dimensiones personalizadas explícitas.
   *
   * @returns `true` cuando width o height difieren de `'100%'`.
   */
  get isCustomSize(): boolean {
    return this.width !== '100%' || this.height !== '100%';
  }

  /**
   * Ancho CSS calculado para el host del componente.
   *
   * @returns Valor CSS de ancho.
   */
  get computedWidth(): string {
    if (typeof this.width === 'number') return `${this.width}px`;
    return this.width;
  }

  /**
   * Alto CSS calculado para el host del componente.
   *
   * @returns Valor CSS de alto.
   */
  get computedHeight(): string {
    if (typeof this.height === 'number') return `${this.height}px`;
    return this.height;
  }

  /**
   * Inicializa el motor gráfico al montar la vista.
   */
  ngAfterViewInit(): void {
    this.initRenderer();
  }

  /**
   * Re-evalúa dimensiones y programa un repintado ante cambios en los inputs.
   *
   * @param _changes Cambios detectados en las propiedades de entrada.
   */
  ngOnChanges(_changes: SimpleChanges): void {
    if (this.canvasRef?.nativeElement) {
      this.updateCanvasDimensions();
      this.requestRender();
    }
  }

  /**
   * Libera recursos de animación, observadores de tamaño y buffers de GPU al destruir el componente.
   */
  ngOnDestroy(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    this.cleanupWebGl();
  }

  private async initRenderer(): Promise<void> {
    const canvas = this.canvasRef.nativeElement;

    if (typeof navigator !== 'undefined' && 'gpu' in navigator && (navigator as any).gpu) {
      try {
        const adapter = await (navigator as any).gpu.requestAdapter();
        if (adapter) {
          const device = await adapter.requestDevice();
          if (device) {
            const context = canvas.getContext('webgpu') as any;
            if (context) {
              const format = (navigator as any).gpu.getPreferredCanvasFormat();
              context.configure({
                device,
                format,
                alphaMode: 'premultiplied',
              });

              const shaderModule = device.createShaderModule({ code: WGSL_SHADER });
              const pipeline = device.createRenderPipeline({
                layout: 'auto',
                vertex: {
                  module: shaderModule,
                  entryPoint: 'vs_main',
                },
                fragment: {
                  module: shaderModule,
                  entryPoint: 'fs_main',
                  targets: [
                    {
                      format,
                      blend: {
                        color: {
                          srcFactor: 'one',
                          dstFactor: 'one-minus-src-alpha',
                          operation: 'add',
                        },
                        alpha: {
                          srcFactor: 'one',
                          dstFactor: 'one-minus-src-alpha',
                          operation: 'add',
                        },
                      },
                    },
                  ],
                },
                primitive: { topology: 'triangle-list' },
              });

              const uniformBuffer = device.createBuffer({
                size: 64,
                usage: 0x0040 | 0x0008,
              });

              const bindGroup = device.createBindGroup({
                layout: pipeline.getBindGroupLayout(0),
                entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
              });

              this.gpuDevice = device;
              this.gpuPipeline = pipeline;
              this.gpuUniformBuffer = uniformBuffer;
              this.gpuBindGroup = bindGroup;
              this.gpuContext = context;
              this.activeBackend.set('webgpu');

              this.setupResizeObserver();
              this.updateCanvasDimensions();
              this.requestRender();
              return;
            }
          }
        }
      } catch {
        // Fallback a WebGL
      }
    }

    try {
      const gl = (canvas.getContext('webgl2', {
        alpha: true,
        antialias: true,
        premultipliedAlpha: true,
      }) ||
        canvas.getContext('webgl', {
          alpha: true,
          antialias: true,
          premultipliedAlpha: true,
        })) as WebGLRenderingContext | WebGL2RenderingContext | null;

      if (gl) {
        const vs = this.compileShader(gl, gl.VERTEX_SHADER, GLSL_VS);
        const fs = this.compileShader(gl, gl.FRAGMENT_SHADER, GLSL_FS);
        if (vs && fs) {
          const program = gl.createProgram();
          if (program) {
            gl.attachShader(program, vs);
            gl.attachShader(program, fs);
            gl.linkProgram(program);

            if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
              this.glContext = gl;
              this.glProgram = program;

              const posLoc = gl.getAttribLocation(program, 'a_position');
              const buffer = gl.createBuffer();
              gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
              gl.bufferData(
                gl.ARRAY_BUFFER,
                new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
                gl.STATIC_DRAW
              );
              gl.enableVertexAttribArray(posLoc);
              gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
              this.glBuffer = buffer;

              this.glUniformLocs = {
                u_resolution: gl.getUniformLocation(program, 'u_resolution'),
                u_fillColor: gl.getUniformLocation(program, 'u_fillColor'),
                u_strokeColor: gl.getUniformLocation(program, 'u_strokeColor'),
                u_strokeWidth: gl.getUniformLocation(program, 'u_strokeWidth'),
                u_elementType: gl.getUniformLocation(program, 'u_elementType'),
              };

              this.activeBackend.set('webgl');
              this.setupResizeObserver();
              this.updateCanvasDimensions();
              this.requestRender();
              return;
            }
          }
        }
      }
    } catch {
      // Fallback a Canvas 2D
    }

    this.activeBackend.set('2d');
    this.setupResizeObserver();
    this.updateCanvasDimensions();
    this.requestRender();
  }

  private compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  private setupResizeObserver(): void {
    const hostEl = this.elRef?.nativeElement;
    if (!hostEl || typeof ResizeObserver === 'undefined') {
      this.updateCanvasDimensions();
      this.render();
      return;
    }

    this.resizeObserver = new ResizeObserver(() => {
      this.ngZone.runOutsideAngular(() => {
        this.updateCanvasDimensions();
        this.render();
      });
    });

    this.resizeObserver.observe(hostEl);
  }

  private updateCanvasDimensions(): void {
    const canvas = this.canvasRef?.nativeElement;
    const host = this.elRef?.nativeElement;
    if (!canvas || !host) return;

    const rect = host.getBoundingClientRect();
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    let targetW = rect.width;
    let targetH = rect.height;

    if (typeof this.width === 'number') {
      targetW = this.width;
    } else if (typeof this.width === 'string' && this.width.endsWith('px')) {
      targetW = parseFloat(this.width);
    }

    if (typeof this.height === 'number') {
      targetH = this.height;
    } else if (typeof this.height === 'string' && this.height.endsWith('px')) {
      targetH = parseFloat(this.height);
    }

    targetW = Math.max(16, Math.round(targetW || 48));
    targetH = Math.max(16, Math.round(targetH || 48));

    const isSmallIcon = targetW <= 32 && targetH <= 32;
    const zoomFactor = Math.max(1, (this.zoom || 100) / 100);
    const minRes = isSmallIcon ? 48 : 256;

    const pixelW = Math.max(minRes, Math.round(targetW * dpr * zoomFactor));
    const pixelH = Math.max(minRes, Math.round(targetH * dpr * zoomFactor));

    if (canvas.width !== pixelW || canvas.height !== pixelH) {
      canvas.width = pixelW;
      canvas.height = pixelH;
    }
  }

  private requestRender(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    this.animFrameId = requestAnimationFrame(() => {
      this.render();
    });
  }

  private resolveColors(): {
    fill: [number, number, number, number];
    stroke: [number, number, number, number];
  } {
    let strokeStr = this.strokeColor;
    if (
      strokeStr === 'currentColor' &&
      typeof window !== 'undefined' &&
      this.canvasRef?.nativeElement
    ) {
      strokeStr = window.getComputedStyle(this.canvasRef.nativeElement).color || '#241C18';
    }

    const fill = parseCssColor(this.fillColor, [0.82, 0.93, 0.95, 1.0]);
    const stroke = parseCssColor(strokeStr, [0.14, 0.11, 0.09, 1.0]);
    return { fill, stroke };
  }

  private getTypeIndex(): number {
    switch (this.type) {
      case 'boundary':
        return 0.0;
      case 'control':
        return 1.0;
      case 'entity':
        return 2.0;
      case 'actor':
        return 3.0;
      default:
        return 0.0;
    }
  }

  private render(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas || canvas.width === 0 || canvas.height === 0) return;

    const backend = this.activeBackend();
    const { fill, stroke } = this.resolveColors();
    const typeIdx = this.getTypeIndex();

    if (backend === 'webgpu' && this.gpuDevice) {
      this.renderWebGpu(canvas, fill, stroke, typeIdx);
    } else if (backend === 'webgl' && this.glContext && this.glProgram) {
      this.renderWebGl(canvas, fill, stroke, typeIdx);
    } else {
      renderCommunication2D(canvas, this.type, fill, stroke, this.strokeWidth);
    }
  }

  private renderWebGpu(
    canvas: HTMLCanvasElement,
    fill: [number, number, number, number],
    stroke: [number, number, number, number],
    typeIdx: number
  ): void {
    const uniforms = new Float32Array([
      canvas.width,
      canvas.height,
      fill[0],
      fill[1],
      fill[2],
      fill[3],
      stroke[0],
      stroke[1],
      stroke[2],
      stroke[3],
      this.strokeWidth,
      typeIdx,
      0.0,
      0.0,
    ]);

    this.gpuDevice.queue.writeBuffer(this.gpuUniformBuffer, 0, uniforms.buffer);

    const encoder = this.gpuDevice.createCommandEncoder();
    const view = this.gpuContext.getCurrentTexture().createView();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view,
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    pass.setPipeline(this.gpuPipeline);
    pass.setBindGroup(0, this.gpuBindGroup);
    pass.draw(6);
    pass.end();
    this.gpuDevice.queue.submit([encoder.finish()]);
  }

  private renderWebGl(
    canvas: HTMLCanvasElement,
    fill: [number, number, number, number],
    stroke: [number, number, number, number],
    typeIdx: number
  ): void {
    const gl = this.glContext!;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.glProgram!);

    gl.uniform2f(this.glUniformLocs['u_resolution'], canvas.width, canvas.height);
    gl.uniform4fv(this.glUniformLocs['u_fillColor'], fill);
    gl.uniform4fv(this.glUniformLocs['u_strokeColor'], stroke);
    gl.uniform1f(this.glUniformLocs['u_strokeWidth'], this.strokeWidth);
    gl.uniform1f(this.glUniformLocs['u_elementType'], typeIdx);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private cleanupWebGl(): void {
    if (this.glContext && this.glProgram) {
      this.glContext.deleteProgram(this.glProgram);
      if (this.glBuffer) {
        this.glContext.deleteBuffer(this.glBuffer);
      }
    }
    if (this.gpuDevice && this.gpuUniformBuffer) {
      try {
        this.gpuUniformBuffer.destroy();
      } catch {
        // Ignorar errores al liberar buffer GPU
      }
    }
  }
}
