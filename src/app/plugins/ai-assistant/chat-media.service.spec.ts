import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { ChatMediaService } from './chat-media.service';

describe('Chat media lifecycle', () => {
  it('stops permission requests that resolve after the panel was destroyed', async () => {
    let resolveStream!: (stream: MediaStream) => void;
    const pending = new Promise<MediaStream>(resolve => { resolveStream = resolve; });
    const stop = vi.fn();
    const original = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: () => pending } });
    const media = new ChatMediaService();
    try {
      const capture = media.toggleRecording();
      media.ngOnDestroy();
      resolveStream({ getTracks: () => [{ stop }] } as unknown as MediaStream);
      await capture;
      expect(stop).toHaveBeenCalledOnce();
      expect(media.recording()).toBe(false);
      expect(media.attachment()).toBeNull();
    } finally {
      if (original) Object.defineProperty(navigator, 'mediaDevices', original);
      else Reflect.deleteProperty(navigator, 'mediaDevices');
    }
  });

  it('rejects oversized images and active SVG attachments before FileReader runs', async () => {
    const media = new ChatMediaService();
    await media.attachImage(new Blob(['<svg/>'], { type: 'image/svg+xml' }), 'image.svg');
    expect(media.error()).toBe('chat.invalidMedia');
    expect(media.attachment()).toBeNull();
    await media.attachImage(new Blob([new Uint8Array(5_000_001)], { type: 'image/png' }), 'large.png');
    expect(media.attachment()).toBeNull();
  });
});
