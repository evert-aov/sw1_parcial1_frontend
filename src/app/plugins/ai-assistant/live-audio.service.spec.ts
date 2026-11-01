import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveAudioService } from './live-audio.service';

/** Prueba PCM, liberación y silencio con Web Audio sustituido, sin acceso al micrófono. */
describe('Gemini Live audio', () => {
  let service: LiveAudioService;
  let channel: Float32Array;
  let processor: { port: { onmessage: ((event: { data: ArrayBuffer }) => void) | null }; disconnect: ReturnType<typeof vi.fn> };
  const nodes: { stop: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn> }[] = [];
  const gain = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
  const close = vi.fn();
  let context: { currentTime: number; audioWorklet: { addModule: ReturnType<typeof vi.fn> } };

  beforeEach(() => {
    nodes.length = 0;
    close.mockReset().mockResolvedValue(undefined);
    vi.stubGlobal('AudioContext', class {
      currentTime = 0;
      destination = {};
      audioWorklet = { addModule: vi.fn().mockResolvedValue(undefined) };
      close = close;
      resume = vi.fn().mockResolvedValue(undefined);
      /** Expone el reloj para simular contrapresión de reproducción. */
      constructor() { context = this; }
      /** Crea salida silenciable sin hardware. */
      createGain() { return gain; }
      /** Simula una fuente PCM programable. */
      createBufferSource() {
        const node = { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null, buffer: null };
        nodes.push(node);
        return node;
      }
      /** Conserva muestras decodificadas para comprobar endian y amplitud. */
      createBuffer(_channels: number, length: number, rate: number) {
        channel = new Float32Array(length);
        return { getChannelData: () => channel, duration: length / rate };
      }
      /** Crea una fuente de captura sustituida. */
      createMediaStreamSource() { return { connect: vi.fn(), disconnect: vi.fn() }; }
    });
    vi.stubGlobal('AudioWorkletNode', class {
      port = { onmessage: null };
      connect = vi.fn();
      disconnect = vi.fn();
      /** Conserva el puerto del doble para simular frames del worklet. */
      constructor() { processor = this; }
    });
    TestBed.configureTestingModule({ providers: [LiveAudioService] });
    service = TestBed.inject(LiveAudioService);
  });
  afterEach(() => { service.close(); TestBed.resetTestingModule(); vi.unstubAllGlobals(); });

  it('decodes little-endian PCM, schedules output and honors local mute', async () => {
    await service.prepare();
    service.play(btoa(String.fromCharCode(0, 128, 255, 127)), 'caller');
    expect(channel[0]).toBe(-1);
    expect(channel[1]).toBeCloseTo(1, 3);
    expect(service.playing()).toBe(true);
    service.setMuted(true);
    expect(gain.gain.value).toBe(0);
    expect(service.playing()).toBe(false);
    service.setMuted(false);
    expect(service.playing()).toBe(true);
    service.interrupt('caller');
    expect(nodes[0].stop).toHaveBeenCalledOnce();
    expect(service.playing()).toBe(false);
    expect(() => service.play('YQ==', 'caller')).toThrow('Invalid PCM');
  });

  it('forwards only bounded worklet frames and releases capture on revoke', async () => {
    const receive = vi.fn();
    await service.capture({} as MediaStream, receive);
    processor.port.onmessage?.({ data: new ArrayBuffer(3200) });
    expect(receive).toHaveBeenCalledOnce();
    processor.port.onmessage?.({ data: new ArrayBuffer(64000) });
    expect(receive).toHaveBeenCalledOnce();
    service.stopCapture();
    expect(processor.port.onmessage).toBeNull();
    expect(processor.disconnect).toHaveBeenCalledOnce();
  });

  it('does not start capture after a pending worklet load was cancelled', async () => {
    await service.prepare();
    let resolve!: () => void;
    context.audioWorklet.addModule.mockReturnValue(new Promise<void>(done => { resolve = done; }));
    const pending = service.capture({} as MediaStream, vi.fn());
    await Promise.resolve();
    await Promise.resolve();
    service.stopCapture();
    resolve();
    await pending;
    expect(close).not.toHaveBeenCalled();
  });
});
