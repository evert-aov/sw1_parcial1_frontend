# 03 — Lienzo y plug-ins de nodos con Foblex Flow

## Contrato del nodo

[NodePlugin](../src/app/core/plugins/node-plugin.contract.ts) amplía `PluginDefinition`:

| Campo | Responsabilidad |
| --- | --- |
| `metadata` | ID, versión, `apiVersion: 1`, categoría `node` y clave i18n. |
| `nodeTypes`, `stereotypeAliases` | Tipos y alias que resuelve el registro. |
| `renderer` | Componente standalone compatible con `NodeRenderer`. |
| `create(context)` | Construcción del registro del nodo, ID, posición y valores iniciales. |
| `inputs(context)` | Adaptación del contexto del host a los inputs del renderizador. |
| `geometry` | Dimensiones, mínimos, offsets, capas y restricciones espaciales. |
| `tools` | IDs, claves i18n, iconos y diagramas admitidos en la paleta. |
| `defaultColor`, `resolveColor` | Color inicial y resolución opcional por datos del nodo. |

El renderer recibe `node: InputSignal<UmlClassNode>` y puede emitir `nodeClick`, `deleteNode`,
`tableClick`, `labelDblClick`, `commitRename` y `cancelRename`. El host conserva permisos,
selección y bloqueos. Los componentes usan OnPush y `input()`/`output()`.

## Catálogo actual

Hay 13 definiciones registrables agrupadas en ocho paquetes de renderizadores. Varias
definiciones pueden compartir componentes **dentro del mismo paquete**.

| Paquete en `src/app/plugins/` | Tipos registrados | Representación |
| --- | --- | --- |
| `uml-class-node/` | `class` | Clases con atributos, métodos y estereotipos. |
| `uml-actor-node/` | `actor` | Actor SVG y etiqueta externa. |
| `uml-use-case-node/` | `use_case` | Óvalo y texto del caso de uso. |
| `uml-package-node/` | `package`, `boundary_box` | Paquetes y cajas contenedoras. |
| `uml-robustness-node/` | `boundary`, `control`, `entity` | Notación BCE y etiquetas. |
| `uml-lifeline-node/` | `lifeline` | Cabecera, línea de vida y activaciones. |
| `uml-component-node/` | `component` | Componente y puertos. |
| `uml-deployment-node/` | `node`, `device`, `executionEnvironment` | Despliegue con perspectiva SVG. |

El catálogo fuente está en [node-plugins.ts](../src/app/composition/node-plugins.ts).
No hay componentes WebGL. La perspectiva de despliegue se conserva mediante SVG.

## Añadir un nodo

1. Crear un paquete `src/app/plugins/<dominio-del-nodo>/` con su componente, template y descriptor.
2. Usar [actor.plugin.ts](../src/app/plugins/uml-actor-node/actor.plugin.ts) como referencia
   del contrato real, adaptando geometría, contexto, iconos y fabricación al nuevo tipo.
3. Definir metadatos traducibles y añadir sus claves en ambos diccionarios de Core.
4. Registrar la definición desde `composition/node-plugins.ts`, o desde composición mediante
   `PluginRegistryService.register()` en ejecución.
5. Probar fabricación, geometría, contrato de inputs/outputs y comportamiento pertinente.
   Las pruebas que integran varios plug-ins pertenecen a `composition/`.

La factoría [DiagramNodeFactoryService](../src/app/plugin-sdk/diagram-node-factory.service.ts)
delega a `NodePluginRegistryService.require(type).create(context)`. La paleta descubre las
herramientas del registro. No añadir imports del nodo al canvas ni condiciones específicas
al HTML, a las métricas o a la factoría del host.

## Estructura Foblex

Antes de cambiar código que usa Foblex, leer la [guía instalada](../node_modules/@foblex/flow/AI.md).
La aplicación conserva sus propios registros; no instala `withFlowState()`.

- La jerarquía es `f-flow` → `f-canvas` → elementos con `fNode` y conexiones.
- `fNode` es una directiva, no un elemento `<f-node>`.
- Importar `FFlowModule` para usar sus directivas y componentes.
- Los nuevos puertos usan `fConnector`, `fConnectorId` y `fConnectorType`:
  `source`, `target` o `source-target` según el comportamiento requerido.
- `f-connection` enlaza IDs de conectores mediante `fSourceId` y `fTargetId`.
  Existen aliases heredados en el código; no inventar valores `input`/`output` para `fConnectorType`.
- Los bloques de control anidados requieren la proyección `ngProjectAs` indicada en la guía
  (`[fNodes]`, `[fConnections]` o `[fGroups]`).
- Mantener altura no nula del contenedor y habilitar `fDraggable` para la interacción.

El `fNode` permanece en el host; `PluginOutletDirective` crea el renderer hijo y mantiene
la jerarquía de inyección. No moverlo a un componente desconectado del árbol de Foblex.

## Geometría y etiquetas

Los anchos/altos, offsets de conectores, etiquetas externas y capas salen del descriptor.
Las reglas de un prisma de despliegue pertenecen a su plug-in; el host consume los números.
Las etiquetas reutilizan [diagram-floating-label](../src/app/plugin-sdk/ui/diagram-floating-label/).
Los cálculos compartidos de conexiones están en
[plugin-sdk/geometry/](../src/app/plugin-sdk/geometry/).

Al cambiar dimensiones, verificar zoom, drag, resize y conectores además del dibujo.
Las pruebas DOM no sustituyen una revisión visual de estas interacciones en navegador.
