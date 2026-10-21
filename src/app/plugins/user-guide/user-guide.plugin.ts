import { PluginDefinition } from '../../core/plugins/plugin.contract';
import { UserGuideService as UserGuideContract } from '../../core/plugins/contracts/user-guide.contract';
import { UserGuideService } from './user-guide.service';
import { UserGuideChatbotComponent } from './chatbot/user-guide-chatbot.component';
export const userGuidePlugin: PluginDefinition = {
  metadata: {
    id: 'user-guide',
    apiVersion: 1,
    version: '1.0.0',
    category: 'tool',
    labelKey: 'plugins.tools.user-guide',
  },
  providers: [UserGuideService],
  components: { launcher: UserGuideChatbotComponent },
  capabilities: [
    { token: UserGuideContract, create: (injector) => injector.get(UserGuideService) },
  ],
};
