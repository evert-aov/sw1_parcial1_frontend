/**
 * Resultado de leer un archivo de imagen o blob como cadena DataURL Base64.
 */
export interface Base64ImageResult {
  dataUrl: string;
  rawBase64: string;
  mimeType: string;
  fileName: string;
}

/**
 * Lee un archivo o blob de imagen y extrae su DataURL y contenido Base64 puro.
 *
 * @param file Archivo o Blob de imagen.
 * @param fallbackName Nombre por defecto cuando el blob no posee nombre.
 * @returns Promesa con los metadatos y Base64 de la imagen.
 */
export function readImageFileAsBase64(
  file: File | Blob,
  fallbackName = 'capture.png',
): Promise<Base64ImageResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const rawBase64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      const mimeType = file.type || 'image/png';
      const fileName = file instanceof File && file.name ? file.name : fallbackName;
      resolve({ dataUrl, rawBase64, mimeType, fileName });
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Convierte un Blob de audio grabado en una cadena Base64 pura (sin prefijo DataURL).
 *
 * @param blob Blob de audio grabado por MediaRecorder.
 * @returns Promesa con el contenido en Base64 puro.
 */
export function readAudioBlobAsBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(blob);
  });
}

/**
 * Captura un fotograma de un elemento `<video>` activo y lo exporta como imagen JPEG Base64.
 *
 * @param video Elemento HTMLVideoElement con stream activo.
 * @returns Objeto con `dataUrl`, `rawBase64`, `mimeType` y `fileName`, o `null` si el video no está listo.
 */
export function captureFrameFromVideo(video: HTMLVideoElement): Base64ImageResult | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  const rawBase64 = dataUrl.split(',')[1] || '';
  return {
    dataUrl,
    rawBase64,
    mimeType: 'image/jpeg',
    fileName: `camera-${Date.now()}.jpg`,
  };
}
