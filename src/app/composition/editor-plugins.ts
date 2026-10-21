import { userGuidePlugin } from '../plugins/user-guide/user-guide.plugin';
import { bmpEncoderPlugin } from '../plugins/bmp-encoder/bmp-encoder.plugin';
import { umlLanguagePlugin } from '../plugins/uml-language/uml-language.plugin';
import { documentIoPlugin } from '../plugins/document-io/document-io.plugin';
import { xmiPlugin } from '../plugins/xmi/xmi.plugin';
import { imageExportPlugin } from '../plugins/image-export/image-export.plugin';
import { aiAssistantPlugin } from '../plugins/ai-assistant/ai-assistant.plugin';
import { codeGenerationPlugin } from '../plugins/code-generation/code-generation.plugin';
import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { EDITOR_PLUGINS } from '../core/plugins/plugin.contract';
import { NODE_PLUGINS } from './node-plugins';

/**
 * Proveedor principal de la composición del editor en producción.
 * Único punto de entrada autorizado para importar y registrar plug-ins concretos en el microkernel.
 * @returns EnvironmentProviders configurados con la lista completa de plug-ins del editor.
 */
export function provideEditorPlugins(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: EDITOR_PLUGINS,
      useValue: [
        ...NODE_PLUGINS,
        userGuidePlugin,
        bmpEncoderPlugin,
        umlLanguagePlugin,
        documentIoPlugin,
        xmiPlugin,
        imageExportPlugin,
        aiAssistantPlugin,
        codeGenerationPlugin,
      ],
    },
  ]);
}
