import { CommunicationElementType } from './communication-gl.component';

/**
 * Convierte colores CSS (hex, rgb, rgba) a flotantes normalizados [r, g, b, a] en el rango 0..1.
 *
 * @param color Cadena de color CSS a evaluar.
 * @param defaultColor Vector RGBA de respaldo.
 * @returns Tupla normalizada [r, g, b, a].
 */
export function parseCssColor(
  color: string,
  defaultColor: [number, number, number, number] = [0, 0, 0, 1]
): [number, number, number, number] {
  if (!color || color === 'none' || color === 'transparent') {
    return [0, 0, 0, 0];
  }
  const trimmed = color.trim().toLowerCase();

  if (trimmed.startsWith('#') && (trimmed.length === 4 || trimmed.length === 5)) {
    const r = parseInt(trimmed[1] + trimmed[1], 16) / 255;
    const g = parseInt(trimmed[2] + trimmed[2], 16) / 255;
    const b = parseInt(trimmed[3] + trimmed[3], 16) / 255;
    const a = trimmed.length === 5 ? parseInt(trimmed[4] + trimmed[4], 16) / 255 : 1.0;
    return [r, g, b, a];
  }

  if (trimmed.startsWith('#') && (trimmed.length === 7 || trimmed.length === 9)) {
    const r = parseInt(trimmed.substring(1, 3), 16) / 255;
    const g = parseInt(trimmed.substring(3, 5), 16) / 255;
    const b = parseInt(trimmed.substring(5, 7), 16) / 255;
    const a = trimmed.length === 9 ? parseInt(trimmed.substring(7, 9), 16) / 255 : 1.0;
    return [r, g, b, a];
  }

  const rgbMatch = trimmed.match(
    /^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/
  );
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10) / 255;
    const g = parseInt(rgbMatch[2], 10) / 255;
    const b = parseInt(rgbMatch[3], 10) / 255;
    const a = rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1.0;
    return [r, g, b, a];
  }

  return defaultColor;
}

export const GLSL_VS = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = vec2((a_position.x + 1.0) * 0.5, (1.0 - a_position.y) * 0.5);
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const GLSL_FS = `
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
    float dCirc = sdCircle(p, vec2(26.0, 24.0), 17.5);
    distFill = dCirc;
    float dCircStroke = abs(dCirc);
    float dVert = sdSegment(p, vec2(4.0, 8.0), vec2(4.0, 40.0));
    float dHoriz = sdSegment(p, vec2(4.0, 24.0), vec2(8.5, 24.0));
    distStroke = min(dCircStroke, min(dVert, dHoriz));
  } else if (u_elementType < 1.5) {
    float dCirc = sdCircle(p, vec2(24.0, 24.0), 17.5);
    distFill = dCirc;
    float dCircStroke = abs(dCirc);
    float dArr1 = sdSegment(p, vec2(31.0, 2.0), vec2(21.0, 6.5));
    float dArr2 = sdSegment(p, vec2(21.0, 6.5), vec2(29.0, 12.5));
    distStroke = min(dCircStroke, min(dArr1, dArr2));
  } else if (u_elementType < 2.5) {
    float dCirc = sdCircle(p, vec2(24.0, 24.0), 18.0);
    distFill = dCirc;
    float dCircStroke = abs(dCirc);
    float dBase = sdSegment(p, vec2(4.0, 42.0), vec2(44.0, 42.0));
    distStroke = min(dCircStroke, dBase);
  } else {
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

export const WGSL_SHADER = `
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

/**
 * Renderiza el elemento UML de comunicación en un contexto Canvas 2D de respaldo.
 *
 * @param canvas Elemento canvas HTML de destino.
 * @param type Tipo de elemento UML ('boundary' | 'control' | 'entity' | 'actor').
 * @param fill Color de relleno normalizado [r, g, b, a].
 * @param stroke Color de borde normalizado [r, g, b, a].
 * @param strokeWidth Grosor del trazo.
 */
export function renderCommunication2D(
  canvas: HTMLCanvasElement,
  type: CommunicationElementType,
  fill: [number, number, number, number],
  stroke: [number, number, number, number],
  strokeWidth: number
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const vbWidth = 48.0;
  const vbHeight = type === 'actor' ? 68.0 : 48.0;
  const scale = Math.min(canvas.width / vbWidth, canvas.height / vbHeight);
  const offsetX = (canvas.width - vbWidth * scale) * 0.5;
  const offsetY = (canvas.height - vbHeight * scale) * 0.5;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  ctx.fillStyle = `rgba(${Math.round(fill[0] * 255)}, ${Math.round(fill[1] * 255)}, ${Math.round(fill[2] * 255)}, ${fill[3]})`;
  ctx.strokeStyle = `rgba(${Math.round(stroke[0] * 255)}, ${Math.round(stroke[1] * 255)}, ${Math.round(stroke[2] * 255)}, ${stroke[3]})`;
  ctx.lineWidth = Math.max(0.8, strokeWidth);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (type === 'boundary') {
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
  } else if (type === 'control') {
    ctx.beginPath();
    ctx.arc(24, 24, 17.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(31, 2.0);
    ctx.lineTo(21, 6.5);
    ctx.lineTo(29, 12.5);
    ctx.stroke();
  } else if (type === 'entity') {
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
