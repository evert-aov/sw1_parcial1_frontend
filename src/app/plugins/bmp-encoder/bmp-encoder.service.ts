import { Injectable } from '@angular/core';
import { BmpEncoder } from '../../core/plugins/contracts/bmp-encoder.contract';
import { BmpWorkerRequest, BmpWorkerResponse, convertRgbaToBmpBuffer } from './bmp-encoder.worker';
@Injectable()
export class BmpEncoderService implements BmpEncoder {
  /**
   * Codifica un ImageData en formato BMP utilizando un Web Worker en segundo plano si está disponible,
   * o recurriendo a un fallback síncrono si los Workers fallan o no están soportados.
   * @param imageData Datos crudos de píxeles RGBA del lienzo.
   * @returns Promesa que resuelve al ArrayBuffer en formato BMP.
   */
  async encodeImageDataToBmp(imageData: ImageData): Promise<ArrayBuffer> {
    if (typeof Worker !== 'undefined' && typeof window !== 'undefined') {
      try {
        return await this.encodeViaWorker(imageData);
      } catch (err) {
        console.warn('Fallo en codificación BMP con Web Worker, aplicando fallback síncrono:', err);
      }
    }
    return this.convertImageDataToBmp(imageData);
  }

  /**
   * Ejecuta la codificación BMP en un hilo de Web Worker independiente para evitar bloquear el UI thread.
   * @param imageData Datos de píxeles.
   * @returns Promesa con el búfer BMP generado.
   */
  private encodeViaWorker(imageData: ImageData): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      let worker: Worker | null = null;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      try {
        worker = new Worker(new URL('./bmp-encoder.worker', import.meta.url), {
          type: 'module',
        });
      } catch (e) {
        return reject(e);
      }

      const id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Math.random());

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (worker) {
          worker.terminate();
          worker = null;
        }
      };

      // Timeout de seguridad de 30 segundos
      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('BMP worker timeout'));
      }, 30000);

      worker.onmessage = (event: MessageEvent<BmpWorkerResponse>) => {
        const res = event.data;
        if (res && res.id === id) {
          cleanup();
          if (res.success && res.bmpBuffer) {
            resolve(res.bmpBuffer);
          } else {
            reject(new Error(res.error || 'Error desconocido en Web Worker BMP'));
          }
        }
      };

      worker.onerror = (err) => {
        cleanup();
        reject(err);
      };

      // Copia del buffer de datos para transferir la propiedad al Worker sin alterar el canvas original
      const pixelBuffer = imageData.data.buffer.slice(0);
      const request: BmpWorkerRequest = {
        id,
        width: imageData.width,
        height: imageData.height,
        buffer: pixelBuffer,
      };

      worker.postMessage(request, [pixelBuffer]);
    });
  }

  /**
   * Codifica de forma síncrona los datos de imagen RGBA a un ArrayBuffer BMP válido.
   * @param imageData Datos de píxeles.
   * @returns Búfer binario con cabeceras BMP y píxeles BGR.
   */
  convertImageDataToBmp(imageData: ImageData): ArrayBuffer {
    return convertRgbaToBmpBuffer(imageData.data, imageData.width, imageData.height);
  }
}
