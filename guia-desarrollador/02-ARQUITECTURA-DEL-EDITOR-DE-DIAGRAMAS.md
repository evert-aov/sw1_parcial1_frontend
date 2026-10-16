# 02 - Arquitectura del Editor de Diagramas

## 1. Visión General de la Modularización
Originalmente, el componente principal del editor acumulaba miles de líneas de código mezclando responsabilidades heterogéneas. Para cumplir con el principio de **Bajo Acoplamiento y Alta Cohesión**, el editor fue refactorizado y desacoplado en:
1. **Un Coordinador Ligero**: [`DiagramEditorComponent`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/src/app/features/diagrams/diagram-editor/diagram-editor.component.ts).
2. **Componentes Visuales Especializados**: `diagram-appbar`, `diagram-canvas`, `diagram-sidebar`, `diagram-toolbox`, modales y menús contextuales.
3. **14 Servicios de Dominio**: Cada uno encapsula una única responsabilidad funcional (Single Responsibility Principle).

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
│                    14 SERVICIOS DE DOMINIO ESPECIALIZADOS                   │
│                                                                             │
│ 1. DiagramPersistenceService        8. DiagramNodeFactoryService            │
│ 2. DiagramCollaborationCoordinator  9. DiagramConnectionLayoutService       │
│ 3. DiagramHistoryService           10. DiagramContainmentService            │
│ 4. DiagramClipboardService         11. DiagramViewportService               │
│ 5. DiagramHotkeysService           12. DiagramExportService                 │
│ 6. DiagramAlignmentService         13. DiagramImportService                 │
│ 7. DiagramModalService             14. DiagramAiSyncService                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Los 14 Servicios de Dominio Especializados

### 1. `DiagramPersistenceService`
- Gestiona el guardado periódico y manual del AST del diagrama.
- Detecta cambios sucios (`isDirty`) y emite notificaciones de guardado automático.
- Serializa el estado visual completo para su envío a la base de datos PostgreSQL.

### 2. `DiagramCollaborationCoordinatorService`
- Desacopla la coordinación de WebSockets multiusuario.
- Gestiona el estado de cursores remotos de los colaboradores.
- Solicita y libera bloqueos de nodos (`lockNode`, `unlockNode`) y refleja candados visuales de otros usuarios en el lienzo.

### 3. `DiagramHistoryService`
- Implementa el patrón **Command / Memento** para el soporte de **Deshacer (Undo)** y **Rehacer (Redo)**.
- Mantiene pilas de estados inmutables en memoria con límite configurable para optimizar la memoria RAM.

### 4. `DiagramClipboardService`
- Proporciona copiar (`Ctrl+C`), cortar (`Ctrl+X`) y pegar (`Ctrl+V`) para nodos y relaciones seleccionadas, asignando nuevos identificadores UUID y recalculando offsets espaciales para que los elementos pegados no se solapen.

### 5. `DiagramHotkeysService`
- Centraliza la captura de atajos de teclado globales:
  - `Ctrl+Z` / `Ctrl+Y`: Deshacer / Rehacer.
  - `Ctrl+S`: Guardar diagrama.
  - `Delete` / `Backspace`: Eliminar elementos seleccionados.
  - `Ctrl++` / `Ctrl+-`: Control de zoom.
  - `Ctrl+A`: Seleccionar todo.

### 6. `DiagramAlignmentService`
- Algoritmos matemáticos de distribución espacial de nodos seleccionados:
  - Alinear a la izquierda, centro horizontal o derecha.
  - Alinear a la parte superior, medio vertical o inferior.
  - Distribuir uniformemente el espaciado horizontal y vertical.

### 7. `DiagramModalService`
- Gestiona el estado de apertura, cierre y payload de todos los modales auxiliares:
  - Edición de clases y entidades UML (`EditNodeModalComponent` con arquitectura en 2 pestañas: Modelo/Atributos y Estilo/Dimensiones).
  - Edición de conexiones y multiplicidades (`EditConnectionModalComponent`).
  - Modal de microservicios Spring Boot / Flutter.
  - Modal de importación/exportación JSON y XMI.
  - Perfil de usuario.
- Expone la señal computada reactiva `isAnyModalOpen`, utilizada por el editor y el servicio de atajos para aislar completamente el lienzo (`pointer-events-none`) y desactivar atajos destructivos mientras cualquier modal está desplegado.

### 8. `DiagramNodeFactoryService`
- Factoría de creación de nodos según el tipo de diagrama activo:
  - Genera instancias con estilos, dimensiones mínimas, puertos de conexión y estereotipos correctos para clases, casos de uso, actores, componentes, etc.

### 9. `DiagramConnectionLayoutService`
- Calcula los puntos de anclaje geométrico entre nodos origen y destino (`f-connection`).
- Aplica los estilos de enrutamiento: ortogonal, directo (recta), curva Bézier y curva adaptativa redondeada.

### 10. `DiagramContainmentService`
- Algoritmo de detección espacial de contención.
- Permite que las cajas de delimitación (`boundary_box`) y paquetes (`package`) detecten qué nodos están dentro de su área delimitadora, moviéndolos jerárquicamente en bloque al arrastrar la caja contenedora.

### 11. `DiagramViewportService`
- Controla la escala de zoom (de 0.2x a 3.0x), el desplazamiento de paneo (`panX`, `panY`), escala 1:1 y la función **Ajustar a la Vista (Fit View)** calculando la caja envolvente (*Bounding Box*) de todos los nodos presentes.

### 12. `DiagramExportService`
- Orquesta la exportación del lienzo a formatos visuales: PNG de alta densidad (2x / 3x) y BMP sin pérdida.

### 13. `DiagramImportService`
- Carga y reconstruye diagramas a partir de archivos JSON o estructuras AST serializadas.

### 14. `DiagramAiSyncService`
- Coordina la inyección de nodos generados por el asistente de IA o reconocidos por visión computacional en el lienzo actual con cálculo de colisiones espaciales.
