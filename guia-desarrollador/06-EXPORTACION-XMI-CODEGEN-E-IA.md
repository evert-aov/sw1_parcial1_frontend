# 06 — Plug-ins de documentos, exportación, código e IA

## Catálogo de capacidades

Las herramientas se componen en
[editor-plugins.ts](../src/app/composition/editor-plugins.ts). Sus implementaciones son
independientes; la colaboración entre paquetes usa tokens de
[core/plugins/contracts/](../src/app/core/plugins/contracts/).

| Paquete | Responsabilidad | Contratos/slots principales |
| --- | --- | --- |
| [document-io](../src/app/plugins/document-io/) | JSON, construcción del AST y coordinación de importación/exportación. | `DiagramImportService`, `DiagramExportService` |
| [xmi](../src/app/plugins/xmi/) | Parser cliente, adaptaciones de Enterprise Architect y cliente HTTP XMI. | `XmiClientParser`, `XmiService` |
| [image-export](../src/app/plugins/image-export/) | Captura DOM y generación de imágenes PNG/BMP. | `BmpExportService` |
| [bmp-encoder](../src/app/plugins/bmp-encoder/) | Codificación binaria BMP, worker y fallback. | `BmpEncoder` |
| [code-generation](../src/app/plugins/code-generation/) | Cliente de generación y explorador/modal de código. | `CodeGeneratorService`, slot `modal` |
| [ai-assistant](../src/app/plugins/ai-assistant/) | Cliente IA y panel de prompts, imágenes y cámara. | `AiAssistantService`, slot `panel` |
| [user-guide](../src/app/plugins/user-guide/) | Guía interactiva y chatbot de ayuda. | `UserGuideService`, slot `launcher` |
| [uml-language](../src/app/plugins/uml-language/) | Operaciones, normalización y sincronización UML; editores de propiedades. | Contratos de dominio, slots `nodeEditor` y `connectionEditor` |

Los nombres de interfaz/token pueden coincidir con el servicio concreto. Desde el host o
un paquete distinto, importar siempre el archivo `*.contract.ts`, nunca la implementación.
Las herramientas opcionales se comprueban con `registry.has(token)` o por su slot antes de usarlas.

## Exportación de imágenes y viewport

`DiagramExportService` recibe un `DiagramExportCanvasTarget`; no conoce
`DiagramCanvasComponent` ni los tipos de Foblex. El host implementa:

```typescript
interface DiagramExportCanvasTarget {
  clearSelection(): void;
  getExportElement(): HTMLElement | undefined;
  prepareForExport(): () => void;
}
```

El lienzo guarda zoom y posición, normaliza el viewport y devuelve una función de restauración.
El exportador espera el renderizado, solicita la captura mediante `BmpExportService` y ejecuta
la restauración en `finally`, también ante fallos. Si no hay elemento DOM, utiliza la ruta
alternativa desde nodos/conexiones; la exportación BMP asíncrona se espera antes de restaurar.

`image-export` usa `html-to-image` y Canvas para capturas. Para BMP consume `BmpEncoder` por
contrato. `bmp-encoder` mantiene el worker y su fallback; no importar su servicio directamente
desde `image-export` ni trasladar el worker a Core.

Las regresiones están en
[diagram-export.service.spec.ts](../src/app/plugins/document-io/diagram-export.service.spec.ts),
[diagram-canvas-export.spec.ts](../src/app/features/diagrams/diagram-editor/components/diagram-canvas/diagram-canvas-export.spec.ts)
y [image-export.integration.spec.ts](../src/app/composition/image-export.integration.spec.ts).

## Documentos JSON y XMI

`UmlDiagramProject` vive en Core y permite compartir la forma del documento sin importar el
componente del editor. `document-io` resuelve los contratos XMI de forma diferida cuando se
solicita ese formato. Guardar/construir el AST no debe activar XMI, IA ni exportadores de imagen.

Los parsers están en `plugins/xmi/parsers/`, junto a `xmi-client-parser.ts` y sus pruebas.
Conservar IDs, conexiones, estereotipos, coordenadas y compatibilidad de datos existentes al
modificar la interpretación de archivos de Enterprise Architect.

## Código, IA y guía interactiva

`code-generation` contiene el cliente HTTP y `spring-boot-modal/`. El modal permite explorar
archivos generados y solicitar descargas; los templates del generador corresponden al backend.
No documentar endpoints o modelos de generación que no estén en su cliente/configuración actual.

`ai-assistant` contiene el servicio y `ai-assistant-panel/`, incluidos los helpers de medios.
Los cambios de documentos se aplican mediante `DiagramDocumentSyncService`, contrato de
`uml-language`. Esta capacidad también sirve a documentos recibidos por otras vías; no hacer
que la normalización dependa de tener IA instalada. La selección del proveedor/modelo IA
corresponde a la configuración del backend, no al núcleo del lienzo.

`user-guide` publica su launcher; la raíz y las barras lo descubren mediante el registro.
Retirar una herramienta debe eliminar su UI mediante el outlet sin afectar el documento.
Las pruebas de integración entre estos paquetes pertenecen a `composition/`.
