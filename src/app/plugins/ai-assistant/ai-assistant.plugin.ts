import { ConversationRealtimeService } from './conversation-realtime.service';
import { PluginDefinition } from '../../core/plugins/plugin.contract';
import { AiAssistantService } from './ai-assistant.service';
import { AiAssistantService as AiAssistantServiceContract } from '../../core/plugins/contracts/ai-assistant.service.contract';
import { AiAssistantPanelComponent } from './ai-assistant-panel/ai-assistant-panel.component';
export const aiAssistantPlugin: PluginDefinition = {
  metadata: {
    id: 'ai-assistant',
    version: '1.0.0',
    apiVersion: 1,
    category: 'tool',
    labelKey: 'plugins.tools.ai-assistant',
  },
  providers: [AiAssistantService, ConversationRealtimeService],
  capabilities: [
    { token: AiAssistantServiceContract, create: (injector) => injector.get(AiAssistantService) },
  ],
  components: { panel: AiAssistantPanelComponent },
};
