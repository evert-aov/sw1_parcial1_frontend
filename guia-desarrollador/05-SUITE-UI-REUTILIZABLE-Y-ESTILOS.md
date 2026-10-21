# 05 — SDK, UI reutilizable y estilos

## Ubicación y límites

Los controles compartidos viven en
[plugin-sdk/ui/shared-ui/](../src/app/plugin-sdk/ui/shared-ui/). Su barrel exporta
`SHARED_DIAGRAM_UI_COMPONENTS`; también se pueden importar componentes individualmente.
Host y plug-ins consumen el SDK. El SDK no importa implementaciones de plug-ins ni `features/`.

La UI específica de una capacidad permanece en su paquete: los editores UML están en
`plugins/uml-language/`, el panel IA en `plugins/ai-assistant/` y el modal de código en
`plugins/code-generation/`. El host los monta con `PluginOutletDirective`.

## Controles disponibles

| Componente | Entradas principales | Salidas |
| --- | --- | --- |
| `DiagramZoomControlsComponent` | `variant`: `grid` o `flex` | `zoomIn`, `zoomOut`, `resetView`, `fitView` |
| `DiagramLineRoutingSelectorComponent` | `selectedStyle: UmlLineStyle` | `styleChange` |
| `DiagramRelationshipButtonComponent` | `relationship` o `relationshipId`, `label`, `description`, `isSelected`, `themeColor` | `selectRelation`, `select` |
| `DiagramToolItemButtonComponent` | `label`, `description`, `disabled`, `draggable`, `dragType`, `themeColor` | `itemClick`, `itemDragStart` |
| `DiagramToolSectionHeaderComponent` | `title`, `isOpen`, `icon`, `actionText`, `actionTitle` | `toggle`, `actionClick` |

Ejemplo de integración de los controles del viewport:

```html
<app-diagram-zoom-controls
  variant="grid"
  (zoomIn)="onZoomIn()"
  (zoomOut)="onZoomOut()"
  (resetView)="onResetView()"
  (fitView)="onFitView()"
/>
```

Los manejadores pertenecen al consumidor y delegan al viewport. Para la paleta de nodos,
obtener herramientas, etiquetas e iconos del descriptor `NodePlugin.tools`; no mantener un
catálogo paralelo de botones para cada tipo en el host.

`UmlLineStyle` y `sanitizeLineStyle()` están en
[diagram.model.ts](../src/app/core/models/diagram.model.ts). El valor por defecto del selector
es `orthogonal_square`. Algunos valores antiguos como `segment` y `adaptive-curve` se
normalizan por compatibilidad; usar los valores canónicos al crear datos nuevos.

## Primitivas gráficas

- [uml-svg/](../src/app/plugin-sdk/ui/uml-svg/): iconos y figuras vectoriales reutilizables.
- [diagram-floating-label/](../src/app/plugin-sdk/ui/diagram-floating-label/): etiquetas desplazables.
- [autofocus-input.directive.ts](../src/app/plugin-sdk/ui/autofocus-input.directive.ts): foco de edición.
- [text-metrics.ts](../src/app/plugin-sdk/text-metrics.ts): medición compartida de texto.

Los renderizadores concretos y sus reglas de tamaño pertenecen a `plugins/uml-*-node/`.
Los componentes WebGL fueron eliminados; no restaurar importaciones ni catálogos de esa implementación.

## Angular 22, estilos e idioma

Los componentes nuevos deben declarar `standalone: true`, OnPush y APIs `input()`/`output()`.
La suite compartida conserva algunos `@Input()`/`@Output()` existentes; esta documentación
no implica que todos hayan sido migrados a inputs funcionales.

El proyecto usa `provideZonelessChangeDetection()`. Derivar estado con `computed()`, modificar
Signals con `set()`/`update()` y mantener coherencia de cambios desde callbacks de Foblex.
Evitar suscripciones permanentes o efectos que reescriban su propia dependencia.

Los estilos globales y Tailwind v4 están en [src/styles.css](../src/styles.css). Reutilizar
las variantes claro/oscuro y la paleta existente. Para estilos internos de Foblex, consultar
[STYLING.md](../node_modules/@foblex/flow/STYLING.md): el encapsulamiento del componente puede
impedir que sus reglas alcancen esos elementos.

Todo texto visible nuevo debe pasar por `TranslatePipe` o `TranslationService`, con claves
simétricas en español e inglés. Los títulos y tooltips enviados a controles compartidos también
se traducen. No aumentar presupuestos de CSS para ocultar una regresión de estilos.
