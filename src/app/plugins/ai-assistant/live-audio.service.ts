import { Injectable, signal } from '@angular/core';

/** Captura PCM para Gemini Live y reproduce su audio nativo sin Edge TTS ni MediaRecorder. */
@Injectable()
export class LiveAudioService {
  readonly playing = signal(false);
  private context?: AudioContext;
  private output?: GainNode;
  private source?: MediaStreamAudioSourceNode;
  private processor?: AudioWorkletNode;
  private sink?: GainNode;
  private readonly scheduled = new Map<AudioBufferSourceNode, string>();
  private nextTime = 0;
  private captureGeneration = 0;
  private muted = false;
  private worklet?: Promise<void>;

  /** Reanuda el contexto desde la acción explícita de entrar a llamada. */
  async prepare(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext();
      this.output = this.context.createGain();
      this.output.gain.value = this.muted ? 0 : 1;
      this.output.connect(this.context.destination);
    }
    await this.context.resume();
  }

  /** Conecta solo el micrófono autorizado; el llamador decide si cada frame puede enviarse. */
  async capture(stream: MediaStream, receive: (data: string) => void): Promise<void> {
    this.stopCapture();
    const generation = this.captureGeneration;
    await this.prepare();
    const context = this.context!;
    this.worklet ??= context.audioWorklet.addModule(new URL('audio/kanon-pcm-processor.js', document.baseURI).href);
    await this.worklet;
    if (generation !== this.captureGeneration || context !== this.context) return;
    this.source = context.createMediaStreamSource(stream);
    this.processor = new AudioWorkletNode(context, 'kanon-pcm');
    this.sink = context.createGain();
    this.sink.gain.value = 0;
    this.source.connect(this.processor);
    this.processor.connect(this.sink);
    this.sink.connect(context.destination);
    this.processor.port.onmessage = event => {
      if (generation !== this.captureGeneration || !(event.data instanceof ArrayBuffer)) return;
      const bytes = new Uint8Array(event.data);
      if (bytes.length !== 3200) return;
      receive(btoa(String.fromCharCode(...bytes)));
    };
  }

  /** Programa PCM mono de 24 kHz y limita la cola para no acumular memoria ante retrasos. */
  play(data: string, sourceId: string): void {
    const context = this.context;
    if (!context || !this.output) return;
    if (data.length > 180000 || this.nextTime - context.currentTime > 8) throw new Error('Live output capacity exceeded');
    const bytes = Uint8Array.from(atob(data), character => character.charCodeAt(0));
    if (!bytes.length || bytes.length % 2) throw new Error('Invalid PCM');
    const samples = new DataView(bytes.buffer);
    const buffer = context.createBuffer(1, bytes.length / 2, 24000);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < channel.length; i++) channel[i] = samples.getInt16(i * 2, true) / 32768;
    const node = context.createBufferSource();
    node.buffer = buffer;
    node.connect(this.output);
    this.scheduled.set(node, sourceId);
    this.playing.set(!this.muted);
    node.onended = () => {
      this.scheduled.delete(node);
      node.disconnect();
      this.playing.set(!this.muted && this.scheduled.size > 0);
    };
    const start = Math.max(context.currentTime + 0.02, this.nextTime);
    node.start(start);
    this.nextTime = start + buffer.duration;
  }

  /** Aplica silencio local sin desactivar el micrófono ni cambiar el consentimiento. */
  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.output) this.output.gain.value = muted ? 0 : 1;
    this.playing.set(!muted && this.scheduled.size > 0);
  }

  /** Descarta el audio pendiente del hablante interrumpido o de toda la llamada. */
  interrupt(sourceId?: string): void {
    for (const [node, owner] of this.scheduled) {
      if (sourceId && owner !== sourceId) continue;
      node.onended = null;
      node.stop();
      node.disconnect();
      this.scheduled.delete(node);
    }
    if (!this.scheduled.size) this.nextTime = 0;
    this.playing.set(!this.muted && this.scheduled.size > 0);
  }

  /** Retira captura y callbacks al revocar permiso, silenciar la sesión o desconectar. */
  stopCapture(): void {
    this.captureGeneration++;
    if (this.processor) { this.processor.port.onmessage = null; this.processor.disconnect(); }
    this.source?.disconnect();
    this.sink?.disconnect();
    this.processor = undefined;
    this.source = undefined;
    this.sink = undefined;
  }

  /** Libera recursos de Web Audio al colgar; no conserva grabaciones del micrófono. */
  close(): void {
    this.stopCapture();
    this.interrupt();
    void this.context?.close().catch(() => undefined);
    this.context = undefined;
    this.output = undefined;
    this.worklet = undefined;
  }
}
