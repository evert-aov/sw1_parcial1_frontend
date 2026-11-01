import { ConversationRealtimeService } from './conversation-realtime.service';
import { PluginDefinition } from '../../core/plugins/plugin.contract';
import { AiAssistantService } from './ai-assistant.service';
import { ChatSpeechService } from './chat-speech.service';
import { KanonSuggestionService } from './kanon-suggestion.service';
import { LiveAudioService } from './live-audio.service';
import { VoiceCallService } from './voice-call.service';
import { AiAssistantCoordinatorService } from './ai-assistant-coordinator.service';
import {
  AiAssistantCoordinator as AiAssistantCoordinatorContract,
  AiAssistantService as AiAssistantServiceContract,
} from '../../core/plugins/contracts/ai-assistant.service.contract';
import { AiAssistantPanelComponent } from './ai-assistant-panel/ai-assistant-panel.component';
import { VoiceCallBarComponent } from './voice-call-bar/voice-call-bar.component';

export const aiAssistantPlugin: PluginDefinition = {
  metadata: {
    id: 'ai-assistant',
    version: '1.1.0',
    apiVersion: 1,
    category: 'tool',
    labelKey: 'plugins.tools.ai-assistant',
  },
  providers: [
    AiAssistantService,
    ConversationRealtimeService,
    ChatSpeechService,
    KanonSuggestionService,
    VoiceCallService,
    LiveAudioService,
    AiAssistantCoordinatorService,
  ],
  capabilities: [
    { token: AiAssistantServiceContract, create: (injector) => injector.get(AiAssistantService) },
    {
      token: AiAssistantCoordinatorContract,
      create: (injector) => injector.get(AiAssistantCoordinatorService),
    },
  ],
  components: {
    panel: AiAssistantPanelComponent,
    callBar: VoiceCallBarComponent,
  },
};
