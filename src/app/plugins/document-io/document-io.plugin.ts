import { DiagramExportService } from './diagram-export.service';
import { DiagramExportService as DiagramExportServiceContract } from '../../core/plugins/contracts/diagram-export.service.contract';
import { DiagramImportService } from './diagram-import.service';
import { DiagramImportService as DiagramImportServiceContract } from '../../core/plugins/contracts/diagram-import.service.contract';
import { PluginDefinition } from '../../core/plugins/plugin.contract';
export const documentIoPlugin: PluginDefinition = {
  metadata: {
    id: 'document-io',
    version: '1.0.0',
    apiVersion: 1,
    category: 'domain',
    labelKey: 'plugins.tools.document-io',
  },
  providers: [DiagramExportService, DiagramImportService],
  capabilities: [
    {
      token: DiagramExportServiceContract,
      create: (injector) => injector.get(DiagramExportService),
    },
    {
      token: DiagramImportServiceContract,
      create: (injector) => injector.get(DiagramImportService),
    },
  ],
};
