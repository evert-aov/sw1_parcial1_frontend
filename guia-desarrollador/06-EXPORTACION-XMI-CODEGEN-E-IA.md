# 06 - Exportación, Interoperabilidad XMI, Codegen e IA

## 1. Visión General
Este capítulo detalla las capacidades avanzadas de exportación gráfica, serialización XMI, generación de código fullstack y asistencia de inteligencia artificial en el cliente.

---

## 2. Exportación a Imagen de Alta Densidad (BMP / PNG) con Konva.js

Implementado en [`DiagramCanvasComponent`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/src/app/features/diagrams/diagram-editor/components/diagram-canvas/diagram-canvas.component.ts), [`DiagramExportService`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/src/app/features/diagrams/diagram-editor/services/diagram-export.service.ts) y [`BmpExportService`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/src/app/core/services/bmp-export.service.ts):

1. **Cálculo Vectorial del Bounding Box en Coordenadas de Modelo**:
   - Itera sobre todos los nodos visibles para calcular el rectángulo mínimo envolvente en coordenadas 1x:
     `minX`, `minY`, `maxX`, `maxY` incorporando bounds de relaciones y margen de seguridad (*padding* de 40px).
2. **Aislamiento de Capas y Normalización Temporal del Stage**:
   - Se desactivan temporalmente la rejilla de fondo (`gridGroup`), la marquesina de selección y los manejadores de redimensionamiento (`transformer`).
   - Se fija el fondo a blanco puro `#FFFFFF` y se normaliza el `scale` a 1x para capturar la geometría vectorial original independientemente del nivel de zoom actual del usuario.
3. **Rasterización Nativa en Konva (`stage.toCanvas`)**:
   - Invoca directamente `this.stage.toCanvas({ x: cropX, y: cropY, width: cropW, height: cropH, pixelRatio: 2 })` a resolución Retina 2x sin sobrecarga de clonación DOM.
4. **Encuadre UML 2.5 Estilo Enterprise Architect**:
   - [`generateFramedCanvasFromCanvas`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/src/app/core/services/bmp-export.service.ts) envuelve el canvas en un marco UML 2.5 con pestaña pentagonal achaflanada a 45°, prefijo estándar (`class`, `uc`, `sd`, `pkg`, etc.) y título del diagrama.
5. **Codificación Optimizada**:
   - **PNG**: Mediante `finalCanvas.toBlob(blob => ..., 'image/png')` con compresión nativa DEFLATE. Produce una descarga ultraligera (< 1 MB) que al abrirse en software de diseño (Krita, Photoshop, GIMP) despliega su resolución y peso real en memoria sin pérdida de nitidez.
   - **BMP**: Codificación directa a buffer Windows Bitmap de 24 bits asistida por Web Worker (`bmp-encoder.worker.ts`).
6. **Descarga Automática**:
   - Genera un enlace temporal `<a>` y dispara la descarga con nombre sanitizado: `{nombre_diagrama}.png` o `.bmp`.

---

## 3. Interoperabilidad XMI en el Cliente (`xmi-client-parser.ts`)

Ubicado en [`frontend/src/app/core/services/xmi-client-parser.ts`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/src/app/core/services/xmi-client-parser.ts):
- Parser ligero del lado del cliente que permite previsualizar y validar archivos `.xmi` y `.xml` exportados desde **Enterprise Architect** antes de enviarlos al backend.
- Detecta clases, atributos, visibilidades, operaciones y relaciones.
- Cuenta con suite de pruebas unitarias exhaustivas en `xmi-client-parser.spec.ts` (13 pruebas pasando).

---

## 4. Modal de Generación de Código (`SpringBootModalComponent`)

Ubicado en [`frontend/src/app/features/diagrams/diagram-editor/components/spring-boot-modal/`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/src/app/features/diagrams/diagram-editor/components/spring-boot-modal/):

1. **Explorador de Archivos en Tiempo Real**:
   - Envía el AST del diagrama al endpoint `/api/code-generator/preview`.
   - Renderiza un árbol jerárquico con carpetas y archivos generados para **Spring Boot** (`src/main/java/...`) o **Flutter** (`lib/models/...`).
2. **Visor de Código con Resaltado de Sintaxis**:
   - Permite al desarrollador hacer clic en cualquier archivo del árbol para ver su contenido en tiempo real antes de descargar.
   - Botón de copia al portapapeles con confirmación visual.
3. **Descarga de Microservicio Empaquetado**:
   - Llama al endpoint `/api/code-generator/download-zip` y descarga el archivo comprimido `.zip` listo para abrir en IntelliJ IDEA, VS Code o Android Studio y ejecutar `mvn spring-boot:run` o `flutter run`.

---

## 5. Panel de Asistente IA (`AiAssistantPanelComponent`)

Ubicado en [`frontend/src/app/features/diagrams/diagram-editor/components/ai-assistant-panel/`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/src/app/features/diagrams/diagram-editor/components/ai-assistant-panel/):

1. **Generación por Prompt Textual**:
   - El usuario ingresa un requerimiento en lenguaje natural (ej. *"Crea un diagrama de clases para un sistema de e-commerce con carrito, productos, clientes y pagos"*).
   - El panel invoca al servicio `AiAssistantService`.
   - El AST generado se inserta en el lienzo actual mediante `DiagramAiSyncService` calculando posiciones armoniosas sin solapamientos.

2. **Visión Computacional y Captura en Vivo**:
   - Integra la API `navigator.mediaDevices.getUserMedia()` para encender la cámara web del dispositivo.
   - Permite al usuario sostener un dibujo en papel o apuntar a una pizarra blanca y presionar **Capturar Foto**.
   - La imagen se convierte a Base64 y se transmite a Gemini 2.0 Flash / Pro para digitalizar el boceto automáticamente.

---

## 6. Experiencia de Usuario, Temas e Iconografía

### Restricción Multiusuario Acotada a la Pestaña *Publish*
- Cuando hay 2 o más usuarios editando simultáneamente el diagrama, las operaciones de exportación e importación masiva XMI se deshabilitan para evitar condiciones de carrera o sobreescritura de modelos en curso.
- El banner de advertencia está condicionado para visualizarse **exclusivamente cuando la pestaña activa es Publish** (`activeTab() === 'publish'`), manteniendo despejadas las demás pestañas de trabajo (*Modeling*, *Format*, *Design*).

### Alertas de Alto Contraste en Tema Oscuro
- Los toasts de advertencia (`warning`) utilizan un fondo sólido oscuro (`#231A08`), un borde ámbar nítido (`border-amber-400`) y tipografía contrastante (`text-amber-50`), garantizando legibilidad total sin importar qué nodos o colores se encuentren en el fondo del lienzo.

### Iconografía Vectorial Estandarizada (Heroicons + SVG)
- Eliminación integral de caracteres emoji en la interfaz:
  - **Selector de Idiomas**: Banderas vectoriales SVG nítidas para España y Estados Unidos.
  - **Candados y Bloqueos**: `<ng-icon name="heroLockClosed">` en banners, badges y notificaciones.
  - **Acciones y Notificaciones**: `<ng-icon name="heroCheck">`, `<ng-icon name="heroExclamationTriangle">`, `<ng-icon name="heroSparkles">`, `<ng-icon name="heroXMark">`.
  - **Manual Interactivo y Chatbot**: `<ng-icon name="heroLightBulb">`, `<ng-icon name="heroPaperAirplane">` y SVG vectoriales en alertas enriquecidas.
