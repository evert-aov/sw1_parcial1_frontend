/** Convierte la entrada mono en PCM de 16 kHz usando promedios y conserva fracciones entre bloques. */
class KanonPcmProcessor extends AudioWorkletProcessor {
  /** Prepara un frame de 100 ms y acumuladores sin asignaciones por muestra. */
  constructor() {
    super();
    this.samples = new Int16Array(1600);
    this.index = 0;
    this.phase = 0;
    this.sum = 0;
    this.count = 0;
  }

  /** Procesa bloques del dispositivo y transfiere frames acotados al hilo de aplicación. */
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    for (const sample of input) {
      this.sum += sample;
      this.count++;
      this.phase += 16000;
      if (this.phase >= sampleRate) {
        const value = Math.max(-1, Math.min(1, this.sum / this.count));
        this.samples[this.index++] = Math.round(value * (value < 0 ? 32768 : 32767));
        this.phase -= sampleRate;
        this.sum = 0;
        this.count = 0;
        if (this.index === this.samples.length) {
          this.port.postMessage(this.samples.buffer, [this.samples.buffer]);
          this.samples = new Int16Array(1600);
          this.index = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('kanon-pcm', KanonPcmProcessor);
