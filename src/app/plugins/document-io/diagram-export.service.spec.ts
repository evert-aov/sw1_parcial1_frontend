import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiagramType } from '../../core/models/diagram.model';
import { BmpExportService } from '../../core/plugins/contracts/bmp-export.service.contract';
import { ConnectionCascadeUtil } from '../../core/plugins/contracts/connection-cascade.util.contract';
import type { DiagramExportCanvasTarget } from '../../core/plugins/contracts/diagram-export.service.contract';
import { UmlNodeNormalizerUtil } from '../../core/plugins/contracts/uml-node-normalizer.util.contract';
import { PluginRegistryService } from '../../core/plugins/plugin-registry.service';
import { ToastService } from '../../core/services/toast.service';
import { DiagramExportService } from './diagram-export.service';

describe('DiagramExportService host contract', () => {
  const images = {
    exportElementToBmp: vi.fn(),
    exportElementToPng: vi.fn(),
    exportToBmp: vi.fn(),
    exportToPng: vi.fn(),
  };
  let service: DiagramExportService;
  let target: DiagramExportCanvasTarget;
  let restore = vi.fn<() => void>();
  let element: HTMLElement;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    TestBed.configureTestingModule({
      providers: [
        DiagramExportService,
        { provide: UmlNodeNormalizerUtil, useValue: {} },
        { provide: ConnectionCascadeUtil, useValue: {} },
        { provide: ToastService, useValue: null },
      ],
    });
    TestBed.inject(PluginRegistryService).register({
      metadata: { id: 'test-images', version: '1', apiVersion: 1, category: 'tool', labelKey: 'test' },
      capabilities: [{ token: BmpExportService, create: () => images as unknown as BmpExportService }],
    });
    service = TestBed.inject(DiagramExportService);
    element = document.createElement('div');
    restore = vi.fn();
    target = {
      clearSelection: vi.fn(),
      getExportElement: () => element,
      prepareForExport: vi.fn(() => restore),
    };
  });

  afterEach(() => vi.unstubAllGlobals());

  it.each(['png', 'bmp'] as const)('restores the host after %s capture without accessing Foblex', async (format) => {
    await service.exportDiagramImage(target, format, 'sample', DiagramType.CLASS, [], []);
    const capture = format === 'png' ? images.exportElementToPng : images.exportElementToBmp;
    expect(capture).toHaveBeenCalledWith(element, 'sample', DiagramType.CLASS);
    expect(target.clearSelection).toHaveBeenCalledOnce();
    expect(target.prepareForExport).toHaveBeenCalledOnce();
    expect(restore).toHaveBeenCalledOnce();
    expect(restore.mock.invocationCallOrder[0]).toBeGreaterThan(capture.mock.invocationCallOrder[0]);
  });

  it('restores the host and propagates capture failures', async () => {
    images.exportElementToPng.mockRejectedValueOnce(new Error('capture failed'));
    await expect(service.exportDiagramImage(target, 'png', 'sample', DiagramType.CLASS, [], []))
      .rejects.toThrow('capture failed');
    expect(restore).toHaveBeenCalledOnce();
  });

  it('awaits fallback BMP export before restoring when no DOM element is available', async () => {
    target.getExportElement = () => undefined;
    let finish!: () => void;
    images.exportToBmp.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    const pending = service.exportDiagramImage(target, 'bmp', 'sample', DiagramType.CLASS, [], []);
    await Promise.resolve();
    expect(images.exportToBmp).toHaveBeenCalledWith([], [], 'sample', DiagramType.CLASS);
    expect(restore).not.toHaveBeenCalled();
    finish();
    await pending;
    expect(restore).toHaveBeenCalledOnce();
  });

  it('supports export without an installed canvas', async () => {
    await service.exportDiagramImage(undefined, 'png', 'sample', DiagramType.CLASS, [], []);
    expect(images.exportToPng).toHaveBeenCalledWith([], [], 'sample', DiagramType.CLASS);
    expect(restore).not.toHaveBeenCalled();
  });
});
