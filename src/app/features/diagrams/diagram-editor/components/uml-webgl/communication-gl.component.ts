import {
  Component,
  Input,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ChangeDetectionStrategy,
  signal,
  inject,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export type CommunicationElementType = 'boundary' | 'control' | 'entity' | 'actor';
export type GlBackend = 'webgpu' | 'webgl' | '2d';

/**
 * Parses CSS colors (hex, rgb, rgba, currentColor) to normalized [r, g, b, a] floats in 0..1.
 */
function parseCssColor(color: string, defaultColor: [number, number, number, number] = [0, 0, 0, 1]): [number, number, number, number] {
  if (!color || color === 'none' || color === 'transparent') {
    return [0, 0, 0, 0];
  }
  const trimmed = color.trim().toLowerCase();

  // HEX #RGB or #RGBA
  if (trimmed.startsWith('#') && (trimmed.length === 4 || trimmed.length === 5)) {
    const r = parseInt(trimmed[1] + trimmed[1], 16) / 255;
    const g = parseInt(trimmed[2] + trimmed[2], 16) / 255;
    const b = parseInt(trimmed[3] + trimmed[3], 16) / 255;
    const a = trimmed.length === 5 ? parseInt(trimmed[4] + trimmed[4], 16) / 255 : 1.0;
    return [r, g, b, a];
  }

  // HEX #RRGGBB or #RRGGBBAA
  if (trimmed.startsWith('#') && (trimmed.length === 7 || trimmed.length === 9)) {
    const r = parseInt(trimmed.substring(1, 3), 16) / 255;
    const g = parseInt(trimmed.substring(3, 5), 16) / 255;
    const b = parseInt(trimmed.substring(5, 7), 16) / 255;
    const a = trimmed.length === 9 ? parseInt(trimmed.substring(7, 9), 16) / 255 : 1.0;
    return [r, g, b, a];
  }

  // RGB / RGBA
  const rgbMatch = trimmed.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10) / 255;
    const g = parseInt(rgbMatch[2], 10) / 255;
    const b = parseInt(rgbMatch[3], 10) / 255;
    const a = rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1.0;
    return [r, g, b, a];
  }

  return defaultColor;
}

const GLSL_VS = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = vec2((a_position.x + 1.0) * 0.5, (1.0 - a_position.y) * 0.5);
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const GLSL_FS = `
#ifdef GL_ES
precision mediump float;
#endif

varying vec2 v_uv;

uniform vec2 u_resolution;
uniform vec4 u_fillColor;
uniform vec4 u_strokeColor;
uniform float u_strokeWidth;
uniform float u_elementType;

float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

float sdCircle(vec2 p, vec2 c, float r) {
  return length(p - c) - r;
}

void main() {
  float vbWidth = 48.0;
  float vbHeight = (u_elementType > 2.5) ? 68.0 : 48.0;

  float scaleX = u_resolution.x / vbWidth;
  float scaleY = u_resolution.y / vbHeight;
  float scale = min(scaleX, scaleY);
  if (scale <= 0.0) {
    gl_FragColor = vec4(0.0);
    return;
  }

  vec2 offset = vec2((u_resolution.x - vbWidth * scale) * 0.5, (u_resolution.y - vbHeight * scale) * 0.5);
  vec2 pixelCoord = v_uv * u_resolution;
  vec2 p = (pixelCoord - offset) / scale;

  if (p.x < -3.0 || p.x > vbWidth + 3.0 || p.y < -3.0 || p.y > vbHeight + 3.0) {
    gl_FragColor = vec4(0.0);
    return;
  }

  float distFill = 999.0;
  float distStroke = 999.0;

  if (u_elementType < 0.5) {
    // BOUNDARY: Circulo centrado en cx=26, cy=24, r=17.5 + linea vertical izquierda + enlace
    float dCirc = sdCircle(p, vec2(26.0, 24.0), 17.5);
    distFill = dCirc;
    float dCircStroke = abs(dCirc);
    float dVert = sdSegment(p, vec2(4.0, 8.0), vec2(4.0, 40.0));
    float dHoriz = sdSegment(p, vec2(4.0, 24.0), vec2(8.5, 24.0));
    distStroke = min(dCircStroke, min(dVert, dHoriz));
  } else if (u_elementType < 1.5) {
    // CONTROL: Circulo cx=24, cy=24, r=17.5 + flecha directriz angular superior
    float dCirc = sdCircle(p, vec2(24.0, 24.0), 17.5);
    distFill = dCirc;
    float dCircStroke = abs(dCirc);
    float dArr1 = sdSegment(p, vec2(31.0, 2.0), vec2(21.0, 6.5));
    float dArr2 = sdSegment(p, vec2(21.0, 6.5), vec2(29.0, 12.5));
    distStroke = min(dCircStroke, min(dArr1, dArr2));
  } else if (u_elementType < 2.5) {
    // ENTITY: Circulo centrado cx=24, cy=24, r=18 + base tangente horizontal y=42
    float dCirc = sdCircle(p, vec2(24.0, 24.0), 18.0);
    distFill = dCirc;
    float dCircStroke = abs(dCirc);
    float dBase = sdSegment(p, vec2(4.0, 42.0), vec2(44.0, 42.0));
    distStroke = min(dCircStroke, dBase);
  } else {
    // ACTOR: Cabeza, columna, brazos, piernas (vbHeight=68.0)
    float dHead = sdCircle(p, vec2(24.0, 12.0), 9.5);
    distFill = dHead;
    float dHeadStroke = abs(dHead);
    float dTorso = sdSegment(p, vec2(24.0, 21.5), vec2(24.0, 43.0));
    float dArms = sdSegment(p, vec2(7.0, 31.0), vec2(41.0, 31.0));
    float dLeg1 = sdSegment(p, vec2(24.0, 43.0), vec2(10.0, 63.0));
    float dLeg2 = sdSegment(p, vec2(24.0, 43.0), vec2(38.0, 63.0));
    distStroke = min(dHeadStroke, min(dTorso, min(dArms, min(dLeg1, dLeg2))));
  }

  float aa = 1.0 / max(scale, 1.0);
  float halfThick = u_strokeWidth * 0.5;

  float fillAlpha = clamp(0.5 - distFill / aa, 0.0, 1.0);
  float strokeAlpha = clamp(0.5 - (distStroke - halfThick) / aa, 0.0, 1.0);

  vec4 fillCol = u_fillColor * (fillAlpha * u_fillColor.a);
  vec4 strokeCol = u_strokeColor * (strokeAlpha * u_strokeColor.a);

  vec4 finalColor = strokeCol + fillCol * (1.0 - strokeAlpha * u_strokeColor.a);
  gl_FragColor = finalColor;
}
`;

const WGSL_SHADER = `
struct Uniforms {
  resolution: vec2f,
  fillColor: vec4f,
  strokeColor: vec4f,
  strokeWidth: f32,
  elementType: f32,
  pad: vec2f,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var pos = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f( 1.0, -1.0),
    vec2f(-1.0,  1.0),
    vec2f(-1.0,  1.0),
    vec2f( 1.0, -1.0),
    vec2f( 1.0,  1.0)
  );
  var out: VertexOutput;
  out.position = vec4f(pos[vertexIndex], 0.0, 1.0);
  out.uv = vec2f((pos[vertexIndex].x + 1.0) * 0.5, (1.0 - pos[vertexIndex].y) * 0.5);
  return out;
}

fn sdSegment(p: vec2f, a: vec2f, b: vec2f) -> f32 {
  let pa = p - a;
  let ba = b - a;
  let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

fn sdCircle(p: vec2f, c: vec2f, r: f32) -> f32 {
  return length(p - c) - r;
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  var vbWidth = 48.0;
  var vbHeight = 48.0;
  if (u.elementType > 2.5) {
    vbHeight = 68.0;
  }

  let scaleX = u.resolution.x / vbWidth;
  let scaleY = u.resolution.y / vbHeight;
  let scale = min(scaleX, scaleY);
  if (scale <= 0.0) {
    return vec4f(0.0, 0.0, 0.0, 0.0);
  }

  let offset = vec2f((u.resolution.x - vbWidth * scale) * 0.5, (u.resolution.y - vbHeight * scale) * 0.5);
  let pixelCoord = uv * u.resolution;
  let p = (pixelCoord - offset) / scale;

  if (p.x < -3.0 || p.x > vbWidth + 3.0 || p.y < -3.0 || p.y > vbHeight + 3.0) {
    return vec4f(0.0, 0.0, 0.0, 0.0);
  }

  var distFill = 999.0;
  var distStroke = 999.0;

  if (u.elementType < 0.5) {
    let dCirc = sdCircle(p, vec2f(26.0, 24.0), 17.5);
    distFill = dCirc;
    let dCircStroke = abs(dCirc);
    let dVert = sdSegment(p, vec2f(4.0, 8.0), vec2f(4.0, 40.0));
    let dHoriz = sdSegment(p, vec2f(4.0, 24.0), vec2f(8.5, 24.0));
    distStroke = min(dCircStroke, min(dVert, dHoriz));
  } else if (u.elementType < 1.5) {
    let dCirc = sdCircle(p, vec2f(24.0, 24.0), 17.5);
    distFill = dCirc;
    let dCircStroke = abs(dCirc);
    let dArr1 = sdSegment(p, vec2f(31.0, 2.0), vec2f(21.0, 6.5));
    let dArr2 = sdSegment(p, vec2f(21.0, 6.5), vec2f(29.0, 12.5));
    distStroke = min(dCircStroke, min(dArr1, dArr2));
  } else if (u.elementType < 2.5) {
    let dCirc = sdCircle(p, vec2f(24.0, 24.0), 18.0);
    distFill = dCirc;
    let dCircStroke = abs(dCirc);
    let dBase = sdSegment(p, vec2f(4.0, 42.0), vec2f(44.0, 42.0));
    distStroke = min(dCircStroke, dBase);
  } else {
    let dHead = sdCircle(p, vec2f(24.0, 12.0), 9.5);
    distFill = dHead;
    let dHeadStroke = abs(dHead);
    let dTorso = sdSegment(p, vec2f(24.0, 21.5), vec2f(24.0, 43.0));
    let dArms = sdSegment(p, vec2f(7.0, 31.0), vec2f(41.0, 31.0));
    let dLeg1 = sdSegment(p, vec2f(24.0, 43.0), vec2f(10.0, 63.0));
    let dLeg2 = sdSegment(p, vec2f(24.0, 43.0), vec2f(38.0, 63.0));
    distStroke = min(dHeadStroke, min(dTorso, min(dArms, min(dLeg1, dLeg2))));
  }

  let aa = 1.0 / max(scale, 1.0);
  let halfThick = u.strokeWidth * 0.5;

  let fillAlpha = clamp(0.5 - distFill / aa, 0.0, 1.0);
  let strokeAlpha = clamp(0.5 - (distStroke - halfThick) / aa, 0.0, 1.0);

  let fillCol = u.fillColor * (fillAlpha * u.fillColor.a);
  let strokeCol = u.strokeColor * (strokeAlpha * u.strokeColor.a);

  return strokeCol + fillCol * (1.0 - strokeAlpha * u.strokeColor.a);
}
`;

@Component({
  selector: 'app-communication-gl',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
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
  `],
  host: {
    '[style.width]': 'computedWidth',
    '[style.height]': 'computedHeight',
    '[style.display]': "width === '100%' ? 'flex' : 'inline-flex'",
    'class': 'shrink-0'
  },
  template: `
    <canvas #glCanvas [class]="className || 'w-full h-full'"></canvas>
  `
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

  // WebGPU state
  private gpuDevice?: any;
  private gpuPipeline?: any;
  private gpuUniformBuffer?: any;
  private gpuBindGroup?: any;
  private gpuContext?: any;

  // WebGL state
  private glContext?: WebGLRenderingContext | WebGL2RenderingContext;
  private glProgram?: WebGLProgram;
  private glBuffer?: WebGLBuffer;
  private glUniformLocs: { [name: string]: WebGLUniformLocation | null } = {};

  get isCustomSize(): boolean {
    return this.width !== '100%' || this.height !== '100%';
  }

  get computedWidth(): string {
    if (typeof this.width === 'number') return `${this.width}px`;
    return this.width;
  }

  get computedHeight(): string {
    if (typeof this.height === 'number') return `${this.height}px`;
    return this.height;
  }

  ngAfterViewInit(): void {
    this.initRenderer();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.canvasRef?.nativeElement) {
      this.updateCanvasDimensions();
      this.requestRender();
    }
  }

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

    // 1. Intentar WebGPU si está disponible
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
                  targets: [{
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
                  }],
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
      } catch (e) {
        // Fallback a WebGL
      }
    }

    // 2. Intentar WebGL / WebGL2
    try {
      const gl = (canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true }) ||
                  canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true })) as
                  WebGLRenderingContext | WebGL2RenderingContext | null;

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
    } catch (_) {
      // Fallback a Canvas 2D
    }

    // 3. Fallback a Canvas 2D
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
    // Para nodos en el lienzo, usar resolución mínima de 256px para nitidez Retina y al hacer zoom
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

  private resolveColors(): { fill: [number, number, number, number]; stroke: [number, number, number, number] } {
    let strokeStr = this.strokeColor;
    if (strokeStr === 'currentColor' && typeof window !== 'undefined' && this.canvasRef?.nativeElement) {
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
      this.render2D(canvas, fill, stroke);
    }
  }

  private renderWebGpu(
    canvas: HTMLCanvasElement,
    fill: [number, number, number, number],
    stroke: [number, number, number, number],
    typeIdx: number
  ): void {
    const uniforms = new Float32Array([
      canvas.width, canvas.height,
      fill[0], fill[1], fill[2], fill[3],
      stroke[0], stroke[1], stroke[2], stroke[3],
      this.strokeWidth,
      typeIdx,
      0.0, 0.0,
    ]);

    this.gpuDevice.queue.writeBuffer(this.gpuUniformBuffer, 0, uniforms.buffer);

    const encoder = this.gpuDevice.createCommandEncoder();
    const view = this.gpuContext.getCurrentTexture().createView();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view,
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
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

  private render2D(
    canvas: HTMLCanvasElement,
    fill: [number, number, number, number],
    stroke: [number, number, number, number]
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const vbWidth = 48.0;
    const vbHeight = this.type === 'actor' ? 68.0 : 48.0;
    const scale = Math.min(canvas.width / vbWidth, canvas.height / vbHeight);
    const offsetX = (canvas.width - vbWidth * scale) * 0.5;
    const offsetY = (canvas.height - vbHeight * scale) * 0.5;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    ctx.fillStyle = `rgba(${Math.round(fill[0] * 255)}, ${Math.round(fill[1] * 255)}, ${Math.round(fill[2] * 255)}, ${fill[3]})`;
    ctx.strokeStyle = `rgba(${Math.round(stroke[0] * 255)}, ${Math.round(stroke[1] * 255)}, ${Math.round(stroke[2] * 255)}, ${stroke[3]})`;
    ctx.lineWidth = Math.max(0.8, this.strokeWidth);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (this.type === 'boundary') {
      ctx.beginPath();
      ctx.arc(26, 24, 17.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(4, 8);
      ctx.lineTo(4, 40);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(4, 24);
      ctx.lineTo(8.5, 24);
      ctx.stroke();
    } else if (this.type === 'control') {
      ctx.beginPath();
      ctx.arc(24, 24, 17.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(31, 2.0);
      ctx.lineTo(21, 6.5);
      ctx.lineTo(29, 12.5);
      ctx.stroke();
    } else if (this.type === 'entity') {
      ctx.beginPath();
      ctx.arc(24, 24, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(4, 42);
      ctx.lineTo(44, 42);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(24, 12, 9.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(24, 21.5);
      ctx.lineTo(24, 43);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(7, 31);
      ctx.lineTo(41, 31);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(24, 43);
      ctx.lineTo(10, 63);
      ctx.moveTo(24, 43);
      ctx.lineTo(38, 63);
      ctx.stroke();
    }

    ctx.restore();
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
      } catch (_) {}
    }
  }
}
