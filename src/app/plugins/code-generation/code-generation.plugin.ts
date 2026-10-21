import { PluginDefinition } from '../../core/plugins/plugin.contract';
import { CodeGeneratorService } from './code-generator.service';
import { CodeGeneratorService as CodeGeneratorServiceContract } from '../../core/plugins/contracts/code-generator.service.contract';
import { SpringBootModalComponent } from './spring-boot-modal/spring-boot-modal.component';
export const codeGenerationPlugin: PluginDefinition = {
  metadata: {
    id: 'code-generation',
    version: '1.0.0',
    apiVersion: 1,
    category: 'tool',
    labelKey: 'plugins.tools.code-generation',
  },
  providers: [CodeGeneratorService],
  capabilities: [
    {
      token: CodeGeneratorServiceContract,
      create: (injector) => injector.get(CodeGeneratorService),
    },
  ],
  components: { modal: SpringBootModalComponent },
};
