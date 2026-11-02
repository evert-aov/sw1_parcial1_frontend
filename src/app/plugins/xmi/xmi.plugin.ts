import { QeaImportDialogComponent } from './qea-import-dialog.component';
import { PluginDefinition } from '../../core/plugins/plugin.contract';
import { XmiService } from './xmi.service';
import { XmiService as XmiServiceContract } from '../../core/plugins/contracts/xmi.service.contract';
import { XmiClientParser } from './xmi-client-parser';
import { XmiClientParser as XmiClientParserContract } from '../../core/plugins/contracts/xmi-client-parser.contract';
export const xmiPlugin: PluginDefinition = {
  metadata: {
    id: 'xmi',
    version: '1.0.0',
    apiVersion: 1,
    category: 'tool',
    labelKey: 'plugins.tools.xmi',
  },
  providers: [XmiService],
  components: { importDialog: QeaImportDialogComponent },
  capabilities: [
    { token: XmiServiceContract, create: (injector) => injector.get(XmiService) },
    { token: XmiClientParserContract, create: () => XmiClientParser },
  ],
};
