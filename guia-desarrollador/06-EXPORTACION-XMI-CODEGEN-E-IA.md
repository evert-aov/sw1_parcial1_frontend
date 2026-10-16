# 06 - Exportación, Interoperabilidad XMI, Codegen e IA

## 1. Visión General
Este capítulo detalla las capacidades avanzadas de exportación gráfica, serialización XMI, generación de código fullstack y asistencia de inteligencia artificial en el cliente.

---

## 2. Exportación a Imagen de Alta Densidad (BMP / PNG)

Implementado en [`BmpExportService`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/src/app/core/services/bmp-export.service.ts):

1. **Cálculo del Bounding Box Real**:
   - Itera sobre todos los nodos visibles para calcular el rectángulo mínimo envolvente:
     `minX`, `minY`, `maxX`, `maxY` con margen de seguridad (*padding* de 40px).
2. **Clonación del DOM y Aislamiento de Estilos**:
   - Clona el contenido del lienzo (`f-canvas`) en un nodo temporal en memoria.
   - Resuelve fuentes web, variables CSS de Tailwind y estilos computados para que no dependan del tema activo.
3. **Rasterización a Canvas HTML5**:
   - Renderiza el contenido vectorial a un elemento `<canvas>` con factor de escala de alta resolución (2x para pantallas Retina / alta densidad).
4. **Codificación a Formato Deseado**:
   - **PNG**: Mediante `canvas.toBlob('image/png')`.
   - **BMP**: Generación binaria directa con cabecera BMP de 54 bytes (DIB header) y datos de píxeles RGB de 24 bits sin compresión con pérdida.
5. **Descarga Automática**:
   - Crea un enlace temporal `<a>` y dispara la descarga con nombre sugerido: `{proyecto}_{diagrama}_{fecha}.bmp`.

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
