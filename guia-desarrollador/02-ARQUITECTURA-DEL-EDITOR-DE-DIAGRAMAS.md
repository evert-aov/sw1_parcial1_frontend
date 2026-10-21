# 02 — Arquitectura microkernel del editor de diagramas

## Host estable

[DiagramEditorComponent](../src/app/features/diagrams/diagram-editor/diagram-editor.component.ts)
coordina el documento, el lienzo, las pestañas, el guardado y la colaboración. El host mantiene
el camino mínimo del editor: renderizado genérico, selección, drag, viewport e historial.
Los nodos UML y las herramientas se incorporan mediante contratos y registro.

El host no importa renderizadores concretos ni introduce ramas por `nodeType` o por formato
de exportación. Los cambios de un tipo UML pertenecen a su descriptor/renderizador o a la
capacidad de dominio responsable. La geometría se consulta mediante `NodeGeometry`.

## Distribución de responsabilidades

Los directorios de servicios del host conservan parte de los nombres anteriores. Sus barrels
pueden reexportar contratos o servicios del SDK; no indican que la implementación siga allí.

| Responsabilidad | Ubicación actual |
| --- | --- |
| Toolbar, atajos, menú contextual, interacción, modales y pestañas | `features/diagrams/diagram-editor/services/orchestration/` |
| Persistencia, historial y selección | `features/diagrams/diagram-editor/services/state-persistence/` |
| Geometría del lienzo, drag, viewport, contención y alineación | `features/diagrams/diagram-editor/services/spatial-engine/` |
| Redimensionamiento genérico | `features/diagrams/diagram-editor/services/uml-domain/diagram-node-resize.service.ts` |
| Coordinación de colaboración | `features/diagrams/diagram-editor/services/collaboration-ai-io/diagram-collaboration-coordinator.service.ts` |
| Factoría de nodos por registro | `plugin-sdk/diagram-node-factory.service.ts` |
| Layout compartido de conexiones | `plugin-sdk/geometry/diagram-connection-layout.service.ts` |
| Operaciones UML, portapapeles, activaciones, normalización y sincronización de documentos | `plugins/uml-language/` |
| Importación/exportación JSON y coordinación de formatos | `plugins/document-io/` |
| Herramientas específicas | Sus paquetes en `plugins/`; ver [capítulo 06](06-EXPORTACION-XMI-CODEGEN-E-IA.md). |

`DiagramDocumentSyncService` pertenece a `uml-language`. La normalización del documento y
el guardado no requieren instalar el asistente IA. Este último es un consumidor opcional.

## Composición, registro y resolución

1. [app.config.ts](../src/app/app.config.ts) instala `provideEditorPlugins()`.
2. [composition/editor-plugins.ts](../src/app/composition/editor-plugins.ts) reúne nodos y
   herramientas. [composition/node-plugins.ts](../src/app/composition/node-plugins.ts) define
   el catálogo de nodos. Estas son las entradas de producción que importan implementaciones.
3. `PluginRegistryService` recibe `EDITOR_PLUGINS`. Sin ese provider, el catálogo está vacío.
4. El registro valida IDs, versión del contrato y colisiones; crea un injector por plug-in.
5. `resolve(token)` crea y conserva una instancia de la capacidad cuando se necesita.
6. `unregister(id)` retira la definición, ejecuta `deactivate` y destruye el injector.

`activate`/`deactivate` son síncronos. El registro detecta ciclos de resolución; los consumers
que retengan servicios deben finalizar su operación antes de desregistrar el proveedor.
No hay carga remota ni descubrimiento automático de archivos por colocar una carpeta en `plugins/`.

## Renderizado de extensiones

El canvas consulta `NodePluginRegistryService.forNode(node)` y entrega su `renderer`, injector
e inputs a `PluginOutletDirective`. La directiva conserva el injector del elemento padre,
necesario para que los conectores encuentren su `fNode`, y aplica el entorno del plug-in.

Las herramientas visuales se descubren por ID y slot: `ai-assistant/panel`,
`code-generation/modal`, `user-guide/launcher` y los editores de `uml-language`.
El host comprueba su disponibilidad antes de mostrarlas. Los plug-ins no buscan otros
plug-ins por ID: sus colaboraciones se expresan con tokens de capacidades.

El canvas puede arrancar sin extensiones. Si un documento contiene un nodo sin renderizador
registrado, conserva los datos y muestra el fallback del host; no elimina el documento.

## Gobernanza y pruebas

[scripts/check-plugin-boundaries.mjs](../scripts/check-plugin-boundaries.mjs) analiza archivos
TypeScript, incluidos specs, importaciones de tipos, alias, reexportaciones e imports dinámicos
con ruta literal. Impide dependencias entre paquetes de plug-ins y referencias a `features/`
desde Core, SDK y plug-ins. Además detecta comparaciones de la propiedad `nodeType` y switches
sobre ese tipo fuera de plug-ins/composición en producción.

El análisis no reemplaza la revisión semántica: no detecta todas las formas posibles de
acoplamiento por cadenas ni toda lógica de formatos. Revisar esas reglas también al cambiar código.

Las pruebas en [composition/](../src/app/composition/) verifican el arranque sin plug-ins,
extensiones desconocidas, conectores y providers, guardado sin herramientas opcionales e
integración de exportación. Las pruebas de una implementación residen en su paquete.
