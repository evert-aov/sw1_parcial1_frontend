import { PluginDefinition } from '../../core/plugins/plugin.contract';
import { BmpExportService } from './bmp-export.service';
import { BmpExportService as BmpExportServiceContract } from '../../core/plugins/contracts/bmp-export.service.contract';
export const imageExportPlugin: PluginDefinition = {
  metadata: {
    id: 'image-export',
    version: '1.0.0',
    apiVersion: 1,
    category: 'tool',
    labelKey: 'plugins.tools.image-export',
  },
  providers: [BmpExportService],
  capabilities: [
    { token: BmpExportServiceContract, create: (injector) => injector.get(BmpExportService) },
  ],
};
