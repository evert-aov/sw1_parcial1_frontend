import { Injectable, OnDestroy, signal } from '@angular/core';
import { ChatAttachment } from '../../core/plugins/contracts/ai-assistant.service.contract';
import {
  captureFrameFromVideo,
  readAudioBlobAsBase64,
  readImageFileAsBase64,
} from './ai-assistant-panel/ai-assistant-media.util';

const DEFAULT_WAVEFORM_LEVELS = [16, 22, 30, 18, 36, 26, 20, 32, 24, 28, 19, 16];

/** Captura local de medios con análisis de nivel de voz reactivo; desconoce proveedores IA. */
@Injectable()
export class ChatMediaService implements OnDestroy {
  readonly attachment = signal<ChatAttachment | null>(null);
  readonly imagePreview = signal<string | null>(null);
  readonly recording = signal(false);
  readonly seconds = signal(0);
  readonly levels = signal<number[]>(DEFAULT_WAVEFORM_LEVELS);
  readonly cameraOpen = signal(false);
  readonly error = signal('');
  readonly busy = signal(false);

  private recorder?: MediaRecorder;
  private microphone?: MediaStream;
  private camera?: MediaStream;
  private audioContext?: AudioContext;
  private timer?: ReturnType<typeof setInterval>;
  private levelTimer?: ReturnType<typeof setInterval>;
  private pendingResolve?: (attachment: ChatAttachment | null) => void;
  private generation = 0;
  private discarded = false;
  private suppressAttachSignal = false;
  private destroyed = false;

  /** Valida tamaño y formato antes de convertir la imagen seleccionada o pegada. */
  async attachImage(blob: Blob, name: string): Promise<void> {
    if (blob.size > 5_000_000 || !['image/png', 'image/jpeg', 'image/webp'].includes(blob.type)) {
      this.error.set('chat.invalidMedia');
      return;
    }
    const generation = this.generation;
    this.busy.set(true);
    try {
      const image = await readImageFileAsBase64(blob, name);
      if (this.destroyed || generation !== this.generation) return;
      this.attachment.set({
        kind: 'image',
        data: image.rawBase64,
        mimeType: image.mimeType,
        name: image.fileName.slice(0, 160),
      });
      this.imagePreview.set(image.dataUrl);
      this.error.set('');
    } catch {
      this.error.set('chat.mediaError');
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }

  /** Descarta el adjunto local sin modificar mensajes ya publicados. */
  clear(): void {
    this.attachment.set(null);
    this.imagePreview.set(null);
  }

  /** Solicita micrófono solo por acción explícita, activa barras de voz en vivo y limita a 60 s. */
  async toggleRecording(): Promise<void> {
    if (this.recording()) {
      this.stopRecording();
      return;
    }
    if (this.busy()) return;
    const generation = this.generation;
    this.busy.set(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (this.destroyed || generation !== this.generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.microphone = stream;
      const recorder = new MediaRecorder(stream);
      this.recorder = recorder;
      const chunks: Blob[] = [];
      this.discarded = false;
      this.suppressAttachSignal = false;
      this.seconds.set(0);
      this.startWaveformMeter(stream);

      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        this.stopWaveformMeter();
        if (this.discarded || this.destroyed || generation !== this.generation) {
          this.resolvePending(null);
          return;
        }
        const mime = recorder.mimeType || 'audio/webm';
        void this.attachAudio(new Blob(chunks, { type: mime }), generation, this.suppressAttachSignal);
      };
      recorder.start();
      this.recording.set(true);
      this.error.set('');
      this.timer = setInterval(() => {
        this.seconds.update((seconds) => seconds + 1);
        if (this.seconds() >= 60) this.stopRecording();
      }, 1000);
    } catch {
      this.microphone?.getTracks().forEach((track) => track.stop());
      this.stopWaveformMeter();
      this.error.set('chat.microphoneError');
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }

  /** Finaliza el clip en curso y devuelve directamente el adjunto listo para envío en un toque. */
  finishRecordingForSend(): Promise<ChatAttachment | null> {
    if (!this.recording() || this.recorder?.state !== 'recording') {
      return Promise.resolve(this.attachment()?.kind === 'audio' ? this.attachment() : null);
    }
    return new Promise<ChatAttachment | null>((resolve) => {
      this.pendingResolve = resolve;
      this.suppressAttachSignal = true;
      this.stopRecording(false);
    });
  }

  /** Cancela la grabación en vivo descartando el audio capturado. */
  cancelRecording(): void {
    this.stopRecording(true);
  }

  /** Finaliza el clip y libera el micrófono incluso si el navegador cancela la captura. */
  stopRecording(discard = false): void {
    this.discarded = discard;
    clearInterval(this.timer);
    this.stopWaveformMeter();
    if (this.recorder?.state === 'recording') {
      this.recorder.stop();
    } else if (discard) {
      this.resolvePending(null);
    }
    this.microphone?.getTracks().forEach((track) => track.stop());
    this.recording.set(false);
  }

  /** Abre una captura de fotografía independiente del chat de voz. */
  async openCamera(video: HTMLVideoElement): Promise<void> {
    const generation = this.generation;
    this.cameraOpen.set(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (this.destroyed || !this.cameraOpen() || generation !== this.generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.camera = stream;
      video.srcObject = stream;
      await video.play();
    } catch {
      this.error.set('chat.cameraError');
      this.closeCamera();
    }
  }

  /** Captura un fotograma de la cámara y valida su tamaño antes de adjuntarlo. */
  capture(video: HTMLVideoElement): void {
    const image = captureFrameFromVideo(video);
    if (image && image.rawBase64.length <= 6_666_668) {
      this.attachment.set({
        kind: 'image',
        data: image.rawBase64,
        mimeType: image.mimeType,
        name: image.fileName,
      });
      this.imagePreview.set(image.dataUrl);
    } else {
      this.error.set('chat.invalidMedia');
    }
    this.closeCamera();
  }

  /** Cierra la cámara y detiene todos sus tracks. */
  closeCamera(): void {
    this.cameraOpen.set(false);
    this.camera?.getTracks().forEach((track) => track.stop());
    this.camera = undefined;
  }

  /** Invalida capturas pendientes al cambiar de diagrama sin destruir el servicio. */
  reset(): void {
    this.generation++;
    this.stopRecording(true);
    this.closeCamera();
    this.clear();
    this.busy.set(false);
  }

  /** Libera permisos activos y rechaza capturas que finalicen después del desmontaje. */
  ngOnDestroy(): void {
    this.destroyed = true;
    this.reset();
  }

  /** Inicializa el medidor de espectro de audio en tiempo real para las barras estilo Gemini. */
  private startWaveformMeter(stream: MediaStream): void {
    this.stopWaveformMeter();
    try {
      const AudioCtx =
        (globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
          .AudioContext ||
        (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      this.audioContext = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);
      const bins = new Uint8Array(analyser.frequencyBinCount);
      this.levelTimer = setInterval(() => {
        analyser.getByteFrequencyData(bins);
        const bars = Array.from({ length: 12 }, (_, idx) => {
          const sample = bins[Math.min(idx + 1, bins.length - 1)] || 0;
          return Math.max(14, Math.min(100, Math.round((sample / 255) * 92 + 12)));
        });
        this.levels.set(bars);
      }, 65);
    } catch {
      this.stopWaveformMeter();
    }
  }

  /** Detiene el muestreo del espectro de voz y cierra el AudioContext auxiliar. */
  private stopWaveformMeter(): void {
    clearInterval(this.levelTimer);
    this.levelTimer = undefined;
    this.levels.set(DEFAULT_WAVEFORM_LEVELS);
    if (this.audioContext) {
      void this.audioContext.close().catch(() => {});
      this.audioContext = undefined;
    }
  }

  /** Resuelve cualquier promesa pendiente de envío inmediato en un toque. */
  private resolvePending(value: ChatAttachment | null): void {
    const resolver = this.pendingResolve;
    this.pendingResolve = undefined;
    this.suppressAttachSignal = false;
    resolver?.(value);
  }

  /** Convierte un clip válido en base64 para adjuntarlo o enviarlo inmediatamente. */
  private async attachAudio(blob: Blob, generation: number, directReturn = false): Promise<void> {
    if (!blob.size || blob.size > 5_000_000) {
      this.error.set('chat.invalidMedia');
      this.resolvePending(null);
      return;
    }
    this.busy.set(true);
    try {
      const data = await readAudioBlobAsBase64(blob);
      if (this.destroyed || generation !== this.generation) {
        this.resolvePending(null);
        return;
      }
      const clip: ChatAttachment = {
        kind: 'audio',
        data,
        mimeType: blob.type || 'audio/webm',
        name: 'voice-clip',
      };
      if (directReturn && this.pendingResolve) {
        this.resolvePending(clip);
      } else {
        this.attachment.set(clip);
        this.imagePreview.set(null);
        this.resolvePending(clip);
      }
    } catch {
      this.error.set('chat.mediaError');
      this.resolvePending(null);
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }
}
