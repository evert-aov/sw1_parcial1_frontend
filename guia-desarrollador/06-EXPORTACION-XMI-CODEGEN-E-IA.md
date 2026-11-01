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
| [code-generation](../src/app/plugins/code-generation/) | Cliente de generación y explorador/modal de código (excluye notas flotantes `note`). | `CodeGeneratorService`, slot `modal` |
| [ai-assistant](../src/app/plugins/ai-assistant/) | Asistente **Kanon**: chats Personal y Grupal, voz estilo Gemini, llamada grupal WebRTC, voz selectiva y sugerencias autónomas. | `AiAssistantService`, `AiAssistantCoordinator`, slots `panel` y `callBar` |
| [user-guide](../src/app/plugins/user-guide/) | Guía interactiva y superficie flotante para sugerencias autónomas de Kanon. | `UserGuideService`, slot `launcher` |
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

## Panel de conversación como sidebar

El plug-in `ai-assistant` presenta el chat a la derecha, desde el borde superior de la aplicación
hasta la barra de estado. La barra superior, las herramientas y el canvas se agrupan en la
columna izquierda; el panel de IA es su hermano en una fila flexible.
Su estilo usa superficies discretas, bordes finos y acentos violetas, con variantes clara y oscura.
El encabezado permite ampliar parcialmente el ancho, ocupar toda el área del editor y restaurar
el sidebar. También se puede arrastrar el borde izquierdo; con foco en el separador, las flechas
ajustan el ancho y `Home` recupera el tamaño inicial. En pantallas estrechas ocupa el área disponible.

Los cambios de tamaño conservan la instancia del plug-in, borrador, adjuntos e historial;
no vuelven a conectar la sala ni consultan nuevamente el catálogo. `Escape` cierra primero
el desplegable abierto y, después, permite salir del modo expandido.

Mientras el panel está abierto, el lienzo conserva su renderizado y sincronización, pero
suspende la interacción local mediante `interactionDisabled`: el host del canvas usa `inert`
y desactiva los gestos de Foblex. Al abrir se limpia la selección y se cierra el menú contextual.
El editor no despacha atajos de selección, borrado, portapapeles o historial durante el chat;
la edición y copia de texto siguen siendo nativas. `Ctrl/Cmd+I` permite cerrar el panel y
recuperar la interacción. Esta suspensión es de UI y no modifica permisos ni impide aplicar
una propuesta revisada desde el chat.

El compositor reúne:

- Botón `+`: subir imagen, pegar desde portapapeles o abrir cámara.
- Micrófono: grabar/detener un clip, manteniendo el límite existente.
- Selector de modelos: catálogo del servidor, modelo activo y proveedores no disponibles deshabilitados.
- Pestañas Personal y Grupal: Kanon responde siempre en Personal; en Grupal requiere `@Kanon` escrito o invocación hablada en un clip.
- Botón de envío y entrada multilínea; `Enter` envía y `Shift+Enter` agrega una línea.

La revisión y aplicación de propuestas conserva los permisos y estados existentes.
En Grupal, los mensajes sin invocación se comparten sin respuesta de Kanon. Personal usa un
historial privado aislado. Los adjuntos y sus respuestas usan Gemini aunque esté seleccionado Qwen.
Los textos nuevos se encuentran en los diccionarios `es.ts` y `en.ts`.

El sidebar izquierdo permite ocultar toolbox/explorador con su botón de cierre o al pulsar
la pestaña activa. Una barra estrecha mantiene accesos independientes a ambas secciones.
El host solo coordina apertura/cierre mediante outputs; no importa la implementación del chat.

## Voz y sincronización de Kanon

El altavoz del compositor alterna escucha/silencio y empieza habilitado. El chat usa Marcelo,
voz boliviana masculina fija; Gemini Live usa Puck. No hay selector de voz. La reproducción automática es selectiva: llamada
grupal o autor de una consulta de audio. Abrir el panel no activa el micrófono. En llamada el
micrófono empieza habilitado tras permiso y puede silenciarse; fuera de ella se graban clips
mediante una acción explícita. Las ondas no reservan espacio y respetan movimiento reducido.

`ChatSpeechService` consume `speechPlayback` del contrato del Core. El paquete privado contiene
MPEG Base64 y frases con marcas temporales de Edge TTS. Las respuestas nuevas con reproducción
automática se revelan progresivamente dentro de la misma burbuja según `audio.currentTime`, sin
subtítulos separados. `speech-text-progress.ts` alinea palabras con el Markdown original e interpola
su avance dentro de cada frase: no son marcas exactas por palabra ni streaming del modelo.
El historial, las respuestas sin audio y los fallos conservan el texto completo. Al terminar,
detener o silenciar se muestra el contenido original completo y se libera la cola.

`historyLoaded` distingue un array vacío provisional de una página recibida por HTTP o Socket.IO.
La primera página confirmada establece el piso de secuencia y nunca se reproduce, independientemente
de la fecha de los mensajes. Reabrir el panel o cambiar de ámbito establece un nuevo punto de partida;
la llamada mantiene su propia observación cuando sigue activa. No se usa el reloj del navegador
para decidir si un mensaje del historial es nuevo.

El control de repetir está oculto por `showReplayControls = false`; `playSpeech()` y `play()`
permanecen disponibles. Si el navegador bloquea la primera reproducción automática, se conserva
un botón para autorizar ese audio pendiente. No se muestra como acción habitual del historial.
Ver [reporte de reproducción progresiva](../docs/kanon-progressive-speech/README.md).

`ConversationRealtimeService` comparte el socket autenticado `/conversations` con la llamada.
`ConversationStateService` fusiona `conversation_changed.snapshot` inmediatamente por ámbito y
revisión, incluso en pestaña oculta mientras el navegador ejecute código. Una respuesta HTTP
atrasada o ACK de envío no degrada un estado ya confirmado. Sin snapshot se conserva recuperación
REST, lectura inicial, paginación y respaldo de 30 segundos (pausado en panel oculto).

La llamada consume los mismos snapshots y serializa su respaldo; no hace una consulta HTTP por
cada notificación. Su señalización usa `type: offer | answer | ice` y `data`. Se mantiene el
consentimiento individual para transcripción y el aislamiento Personal/Grupal.

Los cambios permanecen en el plug-in y su contrato, sin dependencias nuevas del host del lienzo.
Ver [Kanon: entrega, voz y reporte](../../ia/docs/kanon-realtime/README.md).

## Audio nativo de llamada

`VoiceCallService` mantiene la llamada humana WebRTC y coordina una sesión Gemini Live por
participante que autoriza a Kanon. Abrir el chat no abre micrófono ni sesión Live. Después del
permiso del navegador y del evento `ready`, `LiveAudioService` conecta el micrófono a
`public/audio/kanon-pcm-processor.js` mediante AudioWorklet.

El procesador convierte a PCM mono 16 kHz, agrupa 100 ms (1600 muestras) y entrega buffers al
hilo principal. Este los codifica en Base64 y los envía por el socket autenticado. No se utiliza
SpeechRecognition del navegador ni se crean clips HTTP para cada intervención. El audio humano
entre pares sigue usando WebRTC; el canal Live solo transporta la relación con Kanon.

Gemini devuelve PCM 24 kHz, programado en Web Audio con cola acotada a ocho segundos. El altavoz
local controla la ganancia; silenciar el micrófono corta el envío y la pista humana. Retirar
consentimiento detiene la captura y cierra la sesión Live, conservando la llamada entre usuarios.
Las interrupciones identifican el socket de origen para cancelar únicamente su audio pendiente.

`live_event.message` actualiza el texto en su propia burbuja. `ConversationStateService` conserva
ese texto ante snapshots provisionales y acepta el texto durable al finalizar el turno. Los avisos
Live no disparan consultas REST de historial. `ChatSpeechService` omite `speechMode: live`, evitando
una segunda reproducción Edge TTS. Audio y transcripciones llegan incrementalmente; no hay marcas
exactas por palabra para garantizar alineación labial o temporal precisa.

La sesión termina al colgar, desconectar, retirar consentimiento, expirar permisos o alcanzar el
plazo de FastAPI. Ante error, el panel indica que Kanon está sin conexión Live; permite retirar y
volver a habilitar su permiso para iniciar otra sesión. El texto del chat y las notas de voz
continúan disponibles. La llamada requiere HTTPS o localhost y soporte AudioWorklet.

Ver [reporte de integración, configuración y limitaciones](../../ia/docs/gemini-live/README.md).
