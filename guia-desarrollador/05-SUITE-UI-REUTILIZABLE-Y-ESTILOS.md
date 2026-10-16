# 05 - Suite UI Reutilizable y Componentes Compartidos

## 1. Visión General
Para evitar la duplicación de código en los paneles del editor (`diagram-sidebar` y `diagram-toolbox`), se implementó la suite **`shared-ui/`** en [`frontend/src/app/features/diagrams/diagram-editor/components/shared-ui/`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/src/app/features/diagrams/diagram-editor/components/shared-ui/).

La suite exporta de manera unificada la constante `SHARED_DIAGRAM_UI_COMPONENTS` en `shared-ui/index.ts`, simplificando la importación en cualquier componente Angular.

---

## 2. Componentes de la Suite `shared-ui/`

### 1. `DiagramZoomControlsComponent` (`<app-diagram-zoom-controls>`)
- **Propósito**: Controles de navegación y escala de la cámara en el lienzo.
- **Entradas (`Inputs`)**:
  - `variant`: `'grid'` (diseño en cuadrícula de 4 columnas para barra lateral) o `'flex'` (diseño en fila horizontal para barra flotante).
- **Salidas (`Outputs`)**:
  - `(zoomIn)`: Aumenta la escala.
  - `(zoomOut)`: Disminuye la escala.
  - `(resetView)`: Restaura la escala a 1:1 (100%).
  - `(fitView)`: Ajusta la cámara para enfocar todos los nodos en pantalla.
- **Ejemplo de Uso**:
  ```html
  <app-diagram-zoom-controls
    variant="grid"
    (zoomIn)="onZoomIn()"
    (zoomOut)="onZoomOut()"
    (resetView)="onResetView()"
    (fitView)="onFitView()"
  />
  ```

### 2. `DiagramLineRoutingSelectorComponent` (`<app-diagram-line-routing-selector>`)
- **Propósito**: Selector desplegable con estilos de enrutamiento de líneas.
- **Entradas (`Inputs`)**:
  - `selectedStyle`: `UmlLineStyle` (`'segment'`, `'straight'`, `'bezier'`, `'adaptive-curve'`).
- **Salidas (`Outputs`)**:
  - `(styleChange)`: Emite el nuevo estilo tipado estrictamente como `UmlLineStyle`.
- **Ejemplo de Uso**:
  ```html
  <app-diagram-line-routing-selector
    [selectedStyle]="defaultLineStyle()"
    (styleChange)="onSetLineStyle($event)"
  />
  ```

### 3. `DiagramRelationshipButtonComponent` (`<app-diagram-relationship-button>`)
- **Propósito**: Botón estilizado para seleccionar el tipo de conexión activa con previsualización SVG reactiva.
- **Entradas (`Inputs`)**:
  - `relationship`: Objeto `UmlRelationTypeItem` (opcional).
  - `relationshipId`, `label`, `description`: Valores directos (opcional).
  - `isSelected`: Booleano para activar el resalte visual.
  - `themeColor`: `'blue'` (por defecto), `'amber'`, `'cyan'`, `'rose'`.
- **Salidas (`Outputs`)**:
  - `(select)`: Emite el ID de la relación seleccionada (`UmlRelationshipType`).
- **Ejemplo de Uso**:
  ```html
  @for (rel of currentRelations(); track rel.id) {
    <app-diagram-relationship-button
      themeColor="amber"
      [relationship]="rel"
      [isSelected]="selectedRelationType() === rel.id"
      (select)="onSelectRelation($event)"
    />
  }
  ```

### 4. `DiagramToolItemButtonComponent` (`<app-diagram-tool-item-button>`)
- **Propósito**: Tarjeta reutilizable para entidades UML con soporte completo de Drag-and-Drop y click directo.
- **Entradas (`Inputs`)**:
  - `label`: Nombre de la herramienta (ej. "Caso de Uso").
  - `description`: Descripción breve o tooltip.
  - `themeColor`: Esquema cromático (`sky`, `blue`, `amber`, `emerald`, `indigo`, etc.).
  - `isReadOnly`: Deshabilita el botón si el usuario no tiene permisos de edición.
- **Proyección de Contenido**: Proyecta el icono o ilustración SVG mediante `<ng-content select="[icon]">`.
- **Ejemplo de Uso**:
  ```html
  <app-diagram-tool-item-button
    themeColor="sky"
    [label]="'editor.toolbox.useCase' | translate"
    [description]="'editor.toolbox.useCaseDesc' | translate"
    [isReadOnly]="isReadOnly()"
    (buttonClick)="onAddElement('use_case')"
    (dragStart)="onToolboxDragStart('use_case', $event)"
  >
    <app-use-case-svg icon width="24" height="15" />
  </app-diagram-tool-item-button>
  ```

### 5. `DiagramToolSectionHeaderComponent` (`<app-diagram-tool-section-header>`)
- **Propósito**: Cabecera desplegable para secciones colapsables (acordeón).
- **Entradas (`Inputs`)**:
  - `title`: Título de la sección.
  - `isOpen`: Estado booleano de apertura.
  - `actionText` / `actionTitle`: Texto de acción rápida (ej. "Deseleccionar").
- **Salidas (`Outputs`)**:
  - `(toggle)`: Alterna la visibilidad.
  - `(actionClick)`: Ejecuta la acción rápida sin colapsar la sección.

---

## 3. Renderizado Gráfico Vectorial y Acelerado

1. **`uml-svg/`**:
   - Colección de componentes SVG puros (`<app-actor-svg>`, `<app-relationship-svg>`, `<app-use-case-svg>`, `<app-component-svg>`, etc.) que garantizan nitidez perfecta en cualquier factor de escala y resolución de pantalla.
2. **`uml-webgl/`**:
   - Renderers acelerados por hardware en WebGL para diagramas densos con cientos de nodos concurrentes.
