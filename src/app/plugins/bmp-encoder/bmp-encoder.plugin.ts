import { PluginDefinition } from '../../core/plugins/plugin.contract';
import { BmpEncoder } from '../../core/plugins/contracts/bmp-encoder.contract';
import { BmpEncoderService } from './bmp-encoder.service';

export const bmpEncoderPlugin: PluginDefinition = {
  metadata: {
    id: 'bmp-encoder',
    version: '1.0.0',
    apiVersion: 1,
    category: 'tool',
    labelKey: 'plugins.tools.bmp-encoder',
  },
  providers: [BmpEncoderService],
  capabilities: [{ token: BmpEncoder, create: (injector) => injector.get(BmpEncoderService) }],
};
