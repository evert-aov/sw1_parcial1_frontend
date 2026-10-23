import { Injectable, OnDestroy, signal } from '@angular/core';
import { ChatAttachment } from '../../core/plugins/contracts/ai-assistant.service.contract';
import { captureFrameFromVideo, readAudioBlobAsBase64, readImageFileAsBase64 } from './ai-assistant-panel/ai-assistant-media.util';

/** Captura local de medios; no conoce el historial, permisos de proyectos ni proveedores IA. */
@Injectable()
export class ChatMediaService implements OnDestroy {
  readonly attachment = signal<ChatAttachment | null>(null);
  readonly imagePreview = signal<string | null>(null);
  readonly recording = signal(false);
  readonly seconds = signal(0);
  readonly cameraOpen = signal(false);
  readonly error = signal('');
  readonly busy = signal(false);
  private recorder?: MediaRecorder;
  private microphone?: MediaStream;
  private camera?: MediaStream;
  private timer?: ReturnType<typeof setInterval>;
  private generation = 0;
  private discarded = false;
  private destroyed = false;

  /** Valida tamaño y formato antes de convertir la imagen seleccionada o pegada. */
  async attachImage(blob: Blob, name: string): Promise<void> {
    if (blob.size > 5_000_000 || !['image/png', 'image/jpeg', 'image/webp'].includes(blob.type)) {
      this.error.set('chat.invalidMedia'); return;
    }
    const generation = this.generation;
    this.busy.set(true);
    try {
      const image = await readImageFileAsBase64(blob, name);
      if (this.destroyed || generation !== this.generation) return;
      this.attachment.set({ kind: 'image', data: image.rawBase64, mimeType: image.mimeType, name: image.fileName.slice(0, 160) });
      this.imagePreview.set(image.dataUrl);
      this.error.set('');
    } catch { this.error.set('chat.mediaError'); }
    finally { if (generation === this.generation) this.busy.set(false); }
  }

  /** Descarta el adjunto local sin modificar mensajes ya publicados. */
  clear(): void { this.attachment.set(null); this.imagePreview.set(null); }

  /** Solicita micrófono solo por acción explícita y limita la grabación a un minuto. */
  async toggleRecording(): Promise<void> {
    if (this.recording()) { this.stopRecording(); return; }
    if (this.busy()) return;
    const generation = this.generation;
    this.busy.set(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (this.destroyed || generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); return; }
      this.microphone = stream;
      const recorder = new MediaRecorder(stream);
      this.recorder = recorder;
      const chunks: Blob[] = [];
      this.discarded = false;
      this.seconds.set(0);
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        if (!this.discarded && !this.destroyed && generation === this.generation) {
          void this.attachAudio(new Blob(chunks, { type: recorder.mimeType }), generation);
        }
      };
      recorder.start();
      this.recording.set(true);
      this.error.set('');
      this.timer = setInterval(() => {
        this.seconds.update(seconds => seconds + 1);
        if (this.seconds() >= 60) this.stopRecording();
      }, 1000);
    } catch { this.microphone?.getTracks().forEach(track => track.stop()); this.error.set('chat.microphoneError'); }
    finally { if (generation === this.generation) this.busy.set(false); }
  }

  /** Finaliza el clip y libera el micrófono incluso si el navegador cancela la captura. */
  stopRecording(discard = false): void {
    this.discarded = discard;
    clearInterval(this.timer);
    if (this.recorder?.state === 'recording') this.recorder.stop();
    this.microphone?.getTracks().forEach(track => track.stop());
    this.recording.set(false);
  }

  /** Abre una captura de fotografía independiente del chat de voz. */
  async openCamera(video: HTMLVideoElement): Promise<void> {
    const generation = this.generation;
    this.cameraOpen.set(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (this.destroyed || !this.cameraOpen() || generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); return; }
      this.camera = stream;
      video.srcObject = stream;
      await video.play();
    } catch { this.error.set('chat.cameraError'); this.closeCamera(); }
  }

  /** Captura un fotograma de la cámara y valida su tamaño antes de adjuntarlo. */
  capture(video: HTMLVideoElement): void {
    const image = captureFrameFromVideo(video);
    if (image && image.rawBase64.length <= 6_666_668) {
      this.attachment.set({ kind: 'image', data: image.rawBase64, mimeType: image.mimeType, name: image.fileName });
      this.imagePreview.set(image.dataUrl);
    } else { this.error.set('chat.invalidMedia'); }
    this.closeCamera();
  }

  /** Cierra la cámara y detiene todos sus tracks. */
  closeCamera(): void { this.cameraOpen.set(false); this.camera?.getTracks().forEach(track => track.stop()); this.camera = undefined; }

  /** Invalida capturas pendientes al cambiar de diagrama sin destruir el servicio. */
  reset(): void { this.generation++; this.stopRecording(true); this.closeCamera(); this.clear(); this.busy.set(false); }

  /** Libera permisos activos y rechaza capturas que finalicen después del desmontaje. */
  ngOnDestroy(): void { this.destroyed = true; this.reset(); }

  /** Convierte un clip válido sin confundirlo con una llamada en tiempo real. */
  private async attachAudio(blob: Blob, generation: number): Promise<void> {
    if (!blob.size || blob.size > 5_000_000) { this.error.set('chat.invalidMedia'); return; }
    this.busy.set(true);
    try {
      const data = await readAudioBlobAsBase64(blob);
      if (this.destroyed || generation !== this.generation) return;
      this.attachment.set({ kind: 'audio', data, mimeType: blob.type, name: 'voice-clip' });
      this.imagePreview.set(null);
    } catch { this.error.set('chat.mediaError'); }
    finally { if (generation === this.generation) this.busy.set(false); }
  }
}
