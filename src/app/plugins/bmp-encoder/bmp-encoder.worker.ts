/// <reference lib="webworker" />

export interface BmpWorkerRequest {
  id: string;
  width: number;
  height: number;
  buffer: ArrayBuffer;
}

export interface BmpWorkerResponse {
  id: string;
  success: boolean;
  bmpBuffer?: ArrayBuffer;
  error?: string;
}

/**
 * Codifica datos RGBA de píxeles a formato Windows Bitmap (BMP 24-bit BGR sin comprimir)
 * de forma asíncrona dentro de un Web Worker, liberando el hilo principal de la UI.
 */
export function convertRgbaToBmpBuffer(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): ArrayBuffer {
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
  view.setInt32(18, width, true); // Ancho en píxeles
  view.setInt32(22, height, true); // Alto en píxeles (positivo = bottom-to-top)
  view.setUint16(26, 1, true); // Planos de color = 1
  view.setUint16(28, 24, true); // Bits por píxel (24 bits = RGB)
  view.setUint32(30, 0, true); // Compresión (0 = BI_RGB)
  view.setUint32(34, pixelArraySize, true); // Tamaño del arreglo de píxeles
  view.setInt32(38, 3780, true); // Resolución horizontal (~96 DPI)
  view.setInt32(42, 3780, true); // Resolución vertical (~96 DPI)
  view.setUint32(46, 0, true); // Colores en la paleta (0 = 2^24)
  view.setUint32(50, 0, true); // Colores importantes

  // 3. PIXEL DATA (Bottom-to-top, formato BGR con padding de 4 bytes)
  const pixelOffset = fileHeaderSize + infoHeaderSize;
  const uint8View = new Uint8Array(buffer);

  for (let y = 0; y < height; y++) {
    const srcRow = height - 1 - y; // De abajo hacia arriba
    const destRowOffset = pixelOffset + y * rowSize;

    for (let x = 0; x < width; x++) {
      const srcIdx = (srcRow * width + x) * 4;
      const r = data[srcIdx];
      const g = data[srcIdx + 1];
      const b = data[srcIdx + 2];
      const a = data[srcIdx + 3] / 255;

      // Mezcla con fondo blanco puro (#FFFFFF) en caso de transparencia
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

addEventListener('message', ({ data }: MessageEvent<BmpWorkerRequest>) => {
  try {
    const { id, width, height, buffer } = data;
    const uint8Data = new Uint8Array(buffer);
    const bmpBuffer = convertRgbaToBmpBuffer(uint8Data, width, height);

    const response: BmpWorkerResponse = {
      id,
      success: true,
      bmpBuffer,
    };
    postMessage(response, [bmpBuffer]);
  } catch (error) {
    const response: BmpWorkerResponse = {
      id: data?.id || '',
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
    postMessage(response);
  }
});
