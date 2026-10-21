import { DiagramDocumentSyncService } from './diagram-document-sync.service';
import { DiagramDocumentSyncService as DocumentSyncContract } from '../../core/plugins/contracts/diagram-document-sync.service.contract';
import { DiagramClipboardService } from './diagram-clipboard.service';
import { DiagramClipboardService as ClipboardContract } from '../../core/plugins/contracts/diagram-clipboard.service.contract';
import { EditNodeModalComponent } from './edit-node-modal/edit-node-modal.component';
import { EditConnectionModalComponent } from './edit-connection-modal/edit-connection-modal.component';
import { relationshipRules } from './relationship-rules';
import { RELATIONSHIP_RULES } from '../../core/plugins/contracts/relationship-rules.contract';
import { UmlNodeNormalizerUtil } from './uml-node-normalizer.util';
import { UmlNodeNormalizerUtil as UmlNodeNormalizerUtilContract } from '../../core/plugins/contracts/uml-node-normalizer.util.contract';
import { ConnectionCascadeUtil } from './connection-cascade.util';
import { ConnectionCascadeUtil as ConnectionCascadeUtilContract } from '../../core/plugins/contracts/connection-cascade.util.contract';
import { DiagramSequenceActivationService } from './diagram-sequence-activation.service';
import { DiagramSequenceActivationService as DiagramSequenceActivationServiceContract } from '../../core/plugins/contracts/diagram-sequence-activation.service.contract';
import { DiagramConnectionOperationsService } from './diagram-connection-operations.service';
import { DiagramConnectionOperationsService as DiagramConnectionOperationsServiceContract } from '../../core/plugins/contracts/diagram-connection-operations.service.contract';
import { DiagramNodeOperationsService } from './diagram-node-operations.service';
import { DiagramNodeOperationsService as DiagramNodeOperationsServiceContract } from '../../core/plugins/contracts/diagram-node-operations.service.contract';
import { PluginDefinition } from '../../core/plugins/plugin.contract';
export const umlLanguagePlugin: PluginDefinition = {
  metadata: {
    id: 'uml-language',
    version: '1.0.0',
    apiVersion: 1,
    category: 'domain',
    labelKey: 'plugins.tools.uml-language',
  },
  components: {
    nodeEditor: EditNodeModalComponent,
    connectionEditor: EditConnectionModalComponent,
  },
  providers: [
    DiagramDocumentSyncService,
    DiagramClipboardService,
    DiagramSequenceActivationService,
    DiagramConnectionOperationsService,
    DiagramNodeOperationsService,
  ],
  capabilities: [
    { token: DocumentSyncContract, create: (injector) => injector.get(DiagramDocumentSyncService) },
    { token: ClipboardContract, create: (injector) => injector.get(DiagramClipboardService) },
    { token: RELATIONSHIP_RULES, create: () => relationshipRules },
    { token: UmlNodeNormalizerUtilContract, create: () => UmlNodeNormalizerUtil },
    { token: ConnectionCascadeUtilContract, create: () => ConnectionCascadeUtil },
    {
      token: DiagramSequenceActivationServiceContract,
      create: (injector) => injector.get(DiagramSequenceActivationService),
    },
    {
      token: DiagramConnectionOperationsServiceContract,
      create: (injector) => injector.get(DiagramConnectionOperationsService),
    },
    {
      token: DiagramNodeOperationsServiceContract,
      create: (injector) => injector.get(DiagramNodeOperationsService),
    },
  ],
};
