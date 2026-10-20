# 02 - Arquitectura del Editor de Diagramas

## 1. Visión General de la Modularización

Para cumplir estrictamente con los principios de **Bajo Acoplamiento, Alta Cohesión y Responsabilidad Única (SRP)**, el editor de diagramas está estructurado en una jerarquía desacoplada de 3 niveles:

1. **Un Coordinador Ligero**: [`DiagramEditorComponent`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/src/app/features/diagrams/diagram-editor/diagram-editor.component.ts) que actúa como orquestador de alto nivel del ciclo de vida y eventos globales.
2. **Componentes Visuales Especializados**: `diagram-appbar`, `diagram-canvas`, `diagram-sidebar`, `diagram-toolbox`, modales y menús contextuales.
3. **5 Módulos de Servicios por Responsabilidad**: Ubicados en [`services/`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/src/app/features/diagrams/diagram-editor/services/), cada uno con su propio barrel (`index.ts`) y unificados a través del barrel raíz `services/index.ts`.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DIAGRAM-EDITOR COMPONENT                          │
│                   Coordinador de Ciclo de Vida y Eventos                    │
└──────┬──────────────┬──────────────┬──────────────┬─────────────────────────┘
       │              │              │              │
       ▼              ▼              ▼              ▼
┌──────────────┐┌──────────────┐┌──────────────┐┌──────────────┐
│DiagramAppbar ││DiagramCanvas ││DiagramSidebar││DiagramToolbox│
└──────────────┘└──────────────┘└──────────────┘└──────────────┘
       │              │              │              │
       └──────────────┴──────┬───────┴──────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              5 PAQUETES MODULARES DE SERVICIOS DE DOMINIO                   │
│                                                                             │
│ 1. ORCHESTRATION           2. STATE & PERSISTENCE    3. SPATIAL ENGINE      │
│    - ToolbarService           - PersistenceService      - GeometryService   │
│    - HotkeysService           - HistoryService          - DragService       │
│    - ModalService             - ClipboardService        - ConnLayoutService │
│    - ContextMenuService       - SelectionService        - AssemblyService   │
│    - InteractionService                                 - ContainmentService│
│    - TabManagerService                                  - AlignmentService  │
│                                                         - ViewportService   │
│                                                                             │
│ 4. UML DOMAIN              5. COLLABORATION, AI & IO                        │
│    - NodeOperationsService    - CollaborationCoordinatorService             │
│    - NodeFactoryService       - AiSyncService                               │
│    - NodeResizeService        - ExportService                               │
│    - ConnOperationsService    - ImportService                               │
│    - SequenceActivationService                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Los 5 Módulos de Responsabilidad

### 📦 Módulo 1: `orchestration/` (Orquestación y UI)
Gestiona la interacción del usuario, la interfaz de herramientas, la navegación por pestañas y la interceptación de atajos de teclado y menús:

1. **`DiagramToolbarService`**: Controla el modo activo de la barra de herramientas (selección, conexión, tipo de línea, estilo de conector), el estado de las herramientas activas y la sincronización con el canvas.
2. **`DiagramHotkeysService`**: Centraliza la captura de atajos de teclado globales (`Ctrl+Z`, `Ctrl+Y`, `Ctrl+S`, `Ctrl+A`, `Delete`, `Ctrl++`, `Ctrl+-`), suspendiendo atajos destructivos cuando hay modales abiertos.
3. **`DiagramModalService`**: Orquesta el ciclo de vida de los modales (`EditNodeModalComponent`, `EditConnectionModalComponent`, `SpringBootModalComponent`, export/import XMI/JSON) y expone el signal computado `isAnyModalOpen` para aislar el canvas.
4. **`DiagramContextMenuService`**: Gestiona la posición, visibilidad y acciones disponibles del menú contextual al hacer clic derecho sobre nodos, conexiones o fondo del lienzo.
5. **`DiagramCanvasInteractionService`**: Desacopla la lógica de interacción de clics, arrastres rápidos y selección en el lienzo visual.
6. **`DiagramTabManagerService`**: Administra la apertura, cierre y cambio de pestañas entre múltiples diagramas en el mismo proyecto.
7. **`DiagramEditorContext` (Util)**: Provee tipos de contexto y validaciones para la orquestación.

### 📦 Módulo 2: `state-persistence/` (Estado, Historial y Persistencia)
Garantiza la integridad de datos, serialización, deshacer/rehacer y portapapeles:

1. **`DiagramPersistenceService`**: Gestiona el guardado periódico y manual del AST del diagrama, rastreo de cambios sucios (`isDirty`), autosave debounced y sincronización con PostgreSQL.
2. **`DiagramHistoryService`**: Implementa el patrón **Command / Memento** para el soporte de **Deshacer (Undo)** y **Rehacer (Redo)** con pilas inmutables de estados en memoria.
3. **`DiagramClipboardService`**: Proporciona copiar (`Ctrl+C`), cortar (`Ctrl+X`) y pegar (`Ctrl+V`) para nodos y relaciones seleccionadas, asignando nuevos UUIDs y calculando desplazamientos ortogonales.
4. **`DiagramSelectionService`**: Administra el conjunto de nodos y conexiones seleccionadas actualmente (`selectedNodes`, `selectedConnections`), selección múltiple con Shift/Ctrl y selección en área (*marquee selection*).

### 📦 Módulo 3: `spatial-engine/` (Motor Espacial, Geometría y Layout)
Calcula métricas matemáticas 2D, transformaciones de cámara, enrutamiento y contención física:

1. **`DiagramCanvasGeometryService`**: Cálculos de cajas delimitadoras (*bounding boxes*), centros, intersecciones, distancias ortogonales y proyecciones de pantalla a canvas (`screenToCanvas`).
2. **`DiagramCanvasDragService`**: Gestiona el arrastre fluido de nodos individuales o agrupaciones, aplicando restricciones de límites del lienzo.
3. **`DiagramConnectionLayoutService`**: Calcula los puntos de anclaje geométrico entre nodos origen y destino (`f-connection`), aplicando enrutamiento ortogonal, directo, Bézier y redondeado.
4. **`DiagramAssemblyConnectionService`**: Soporta la conexión de puertos e interfaces ensamble de componentes UML (`provided` / `required` socket & lollipop).
5. **`DiagramContainmentService`**: Algoritmo de detección espacial de contención. Permite que las cajas de delimitación (`boundary_box`) y paquetes (`package`) detecten qué nodos están dentro de su área delimitadora, moviéndolos jerárquicamente en bloque al arrastrar el contenedor.
6. **`DiagramAlignmentService`**: Algoritmos matemáticos de alineación (izquierda, centro, derecha, arriba, medio, abajo) y distribución equiespaciada horizontal/vertical.
7. **`DiagramViewportService`**: Controla el zoom (0.2x a 3.0x), paneo (`panX`, `panY`), escala 1:1 y la función **Ajustar a la Vista (Fit View)** calculando el bounding box global.

### 📦 Módulo 4: `uml-domain/` (Dominio y Semántica UML)
Encapsula la semántica UML formal, tipos de nodos, conexiones válidas y validación estructural:

1. **`DiagramNodeOperationsService`**: Operaciones CRUD sobre nodos del AST: creación, actualización de propiedades, atributos, métodos y eliminación en cascada de conexiones asociadas.
2. **`DiagramNodeFactoryService`**: Factoría que instancia la estructura de datos correcta para cada tipo de nodo UML (clases, casos de uso, actores, robustez BCE, componentes, despliegue, paquetes).
3. **`DiagramNodeResizeService`**: Gestiona el redimensionamiento dinámico interactivo con cálculo de dimensiones mínimas según el contenido y etiquetas.
4. **`DiagramConnectionOperationsService`**: Validación semántica de conexiones UML (generalización, agregación, composición, asociación, dependencia, realización, mensaje de secuencia).
5. **`DiagramSequenceActivationService`**: Gestiona la activación, anidamiento y cálculo de altura de los bloques de activación en líneas de vida para diagramas de Secuencia.

### 📦 Módulo 5: `collaboration-ai-io/` (Colaboración, IA e Interoperabilidad)
Comunicaciones externas en tiempo real, sincronización inteligente de IA y formatos de archivo:

1. **`DiagramCollaborationCoordinatorService`**: Coordina la sesión multiusuario vía Socket.IO, sincroniza cursores remotos, solicita y libera bloqueos de nodos (`lockNode`, `unlockNode`) y renderiza indicadores de concurrencia.
2. **`DiagramAiSyncService`**: Coordina la inyección de nodos generados por el asistente de IA o reconocidos por visión computacional en el lienzo con algoritmo de evasión de colisiones.
3. **`DiagramExportService`**: Orquesta la exportación del lienzo a formatos visuales: PNG de alta densidad (2x / 3x) y BMP sin pérdida vía Web Workers.
4. **`DiagramImportService`**: Carga y reconstruye diagramas a partir de archivos JSON o estructuras AST serializadas.

---

## 3. Patrón de Exportación Barrel (`index.ts`)

Cada paquete contiene un archivo `index.ts` que exporta todos sus servicios:
```typescript
// services/orchestration/index.ts
export * from './diagram-toolbar.service';
export * from './diagram-hotkeys.service';
// ...
```

Y la raíz `services/index.ts` re-exporta los 5 módulos:
```typescript
// services/index.ts
export * from './orchestration';
export * from './state-persistence';
export * from './spatial-engine';
export * from './uml-domain';
export * from './collaboration-ai-io';
```

Esto permite a los componentes (`DiagramEditorComponent`, `DiagramCanvasComponent`) importar cualquier servicio limpiamente desde `'./services'` o `'../../services'` sin rutas relativas frágiles.
