---
name: sw1-fullstack-architect
description: >-
  Diseñar, implementar, depurar o revisar UML Collaborative Studio con Angular 22,
  arquitectura microkernel, Foblex Flow y Tailwind CSS v4; mantener sus contratos
  con NestJS 12, PostgreSQL, Socket.IO y el chat grupal FastAPI cuando la tarea afecte esa integración.
---

# Arquitectura de UML Collaborative Studio

Aplicar esta skill al trabajar en este proyecto. Su ámbito es el frontend y la integración
fullstack que requiera la tarea; no autoriza cambios en backend, despliegues ni commits ajenos
al encargo. Las instrucciones explícitas del usuario prevalecen sobre esta guía.

## Referencias y versiones

Desde esta carpeta, la raíz del frontend está tres niveles arriba:

- [Guía del desarrollador](../../../guia-desarrollador/README.md): entrada y capítulos por área.
- [Arquitectura microkernel](../../../MICROKERNEL.md): límites, contratos y ciclo de vida.
- [package.json](../../../package.json): rangos declarados y scripts disponibles.
  Consultar `node_modules/<paquete>/package.json` para las versiones instaladas y el lockfile
  si existe; este checkout no contiene uno.

El frontend usa **Angular 22**, standalone, Signals y `provideZonelessChangeDetection()`.
Foblex Flow tiene versión independiente (actualmente 19); no confundirla con Angular.
Comprobar los engines del Angular instalado al elegir Node. No conservar cifras históricas
como requisito fijo de cantidad de pruebas o servicios.

## Decidir dónde implementar

| Responsabilidad | Ubicación relativa a `src/app/` |
| --- | --- |
| Contratos, tokens, registro y outlet | `core/plugins/` |
| Modelos de documento y DTO compartidos | `core/models/` |
| Sesión, HTTP base, colaboración, i18n y tema | `core/` |
| Canvas, viewport, drag, selección, historial, pestañas y orquestación | `features/diagrams/diagram-editor/` |
| Factoría por registro, geometría compartida, UI y utilidades de autoría | `plugin-sdk/` |
| Renderizadores y comportamiento de cada familia de nodos | `plugins/uml-*-node/` |
| Reglas UML, portapapeles, normalización y sincronización de documentos | `plugins/uml-language/` |
| JSON, XMI, imágenes, BMP, generación de código, IA y guía | Paquete de dominio correspondiente en `plugins/`. |
| Catálogo de extensiones e integración entre implementaciones | `composition/` |

## Límites obligatorios

- El host no importa implementaciones de plug-ins ni añade ramas por tipos concretos de nodo
  o formato de exportación. Consultar descriptores, geometría y capacidades mediante el registro.
- Un plug-in consume su propio paquete, Core, SDK y bibliotecas externas. Cero importaciones
  entre paquetes de plug-ins; tampoco búsquedas de otro plug-in por ID como sustituto del contrato.
- Core, SDK y plug-ins no importan `features/`. Los contratos no exponen componentes concretos.
- Las implementaciones se reúnen desde `composition/`. Los specs obedecen los límites;
  las pruebas que integran varios paquetes se alojan en composición.
- Usar `UmlDiagramProject` de `core/models/diagram.model.ts` para documentos compartidos.
  Para captura de lienzo usar `DiagramExportCanvasTarget`; restaurar el viewport incluso ante error.
- Preservar AST, identificadores y formatos existentes. Eliminar directorios vacíos tras mover archivos.

## Extender el microkernel

Para un nodo, leer el [capítulo de nodos](../../../guia-desarrollador/03-LIENZO-Y-NODOS-MODULARES.md).
Crear un descriptor `NodePlugin` con metadatos, tipos, renderer, geometría, herramientas,
`create()` e `inputs()`. Registrar desde `composition/node-plugins.ts` o mediante el registro
en ejecución. No añadir un catálogo paralelo de componentes o botones al host.

Para una herramienta, leer el [capítulo de capacidades](../../../guia-desarrollador/06-EXPORTACION-XMI-CODEGEN-E-IA.md).
Definir interfaz e `InjectionToken<T>` en Core y publicar la capacidad en `PluginDefinition`.
Los providers de la definición tienen un `EnvironmentInjector` propio; la resolución es diferida.
Los componentes públicos se exponen por slots y se renderizan con `PluginOutletDirective`.

Comprobar disponibilidad de capacidades opcionales antes de resolverlas. No exigir IA, XMI
ni exportadores para guardar el documento. Los hooks `activate`/`deactivate` son síncronos;
liberar recursos y terminar operaciones que retengan servicios antes de retirar su proveedor.
El registro dinámico actual usa código local de confianza; no implica carga remota ni sandbox.

## Angular, Foblex y UI

- Componentes nuevos: `standalone: true`, `ChangeDetectionStrategy.OnPush`, `input()` y `output()`.
  Usar `signal()`/`computed()` para estado; reservar `effect()` para efectos necesarios.
- En modo zoneless, notificar cambios visibles con Signals o `markForCheck()` cuando proceda.
  No asumir que un callback de Foblex/RxJS actualizará una propiedad ordinaria en pantalla.
- Antes de modificar código Foblex, leer `node_modules/@foblex/flow/AI.md`; para estilos,
  `node_modules/@foblex/flow/STYLING.md`. No inventar APIs de React Flow.
- Mantener `f-flow` → `f-canvas` → `fNode`/conexiones. El host conserva `fNode` y el outlet
  conserva el injector del elemento padre. Usar `FFlowModule` y la proyección documentada.
- Los conectores nuevos usan `fConnectorId` y `fConnectorType` (`source`, `target`, `source-target`).
  El editor conserva registros propios; no asumir que usa `withFlowState()`.
- Reutilizar `plugin-sdk/ui/shared-ui/`, SVG y etiquetas flotantes. Los componentes WebGL se eliminaron.
- Todo texto visible nuevo, incluidos tooltips y notificaciones, usa i18n y claves en
  `src/app/core/i18n/translations/es.ts` y `en.ts`. Respetar los temas claro/oscuro existentes.
- Tipar DTO, eventos y contratos; validar datos externos con tipos explícitos o `unknown`.
  Evitar ampliar usos heredados de `any` al añadir capacidades.

## Integración backend cuando corresponda

Consultar primero los contratos y la documentación del backend de la misma revisión.
Mantener controladores HTTP delgados, servicios de negocio, DTO validados y persistencia
transaccional cuando una operación abarque varias escrituras. No extrapolar versiones,
conteos de tablas, endpoints o reglas de autenticación desde una guía vieja.

La colaboración cliente usa sesiones de diagrama (`join_room`), cursores, bloqueos y reconexión;
ver el [capítulo de colaboración](../../../guia-desarrollador/04-COLABORACION-TIEMPO-REAL-Y-WEBSOCKETS.md).
El backend valida permisos y concurrencia; el indicador de bloqueo de un renderer no reemplaza
esa validación. Mantener compatibilidad XMI y payloads de generación/IA al cambiar contratos.
Ejecutar la suite backend únicamente cuando se trabaje en ese workspace o en su integración.

## Chat grupal y FastAPI

Consultar la [guía del backend](../../../../backend/guia-desarrollador/README.md) y la
[guía de IA](../../../../ia/guia-desarrollador/README.md) al modificar esta integración.
El plug-in `ai-assistant` consume contratos del Core; no llama directamente a proveedores ni a MongoDB.
NestJS autentica al usuario y autoriza el diagrama; FastAPI mantiene historial, contexto y modelos.
Las credenciales pertenecen a `ia/.env`; no copiarlas al frontend ni al entorno del backend.

Conservar una sola sincronización de historial por sala, sin peticiones solapadas, y cancelarla
al cerrar el panel o cambiar de diagrama. No introducir dependencias reactivas incidentales
que vuelvan a conectar el chat al cambiar sus propias Signals de carga/modelos.

El alcance actual incluye texto, imágenes y clips de voz; no llamadas ni edge-tts. Las propuestas
se revisan antes de aplicar y NestJS comprueba contrato, permisos, revisión y recibo idempotente.
Distinguir errores de validación, permisos y conflicto en la UI con claves traducidas.
No presentar una respuesta del modelo como confirmación de que el diagrama ya fue modificado.

## Verificación y entrega

Para cambios de código, ejecutar desde el frontend:

```sh
npm run test:architecture
npm run check:architecture
npm test -- --watch=false
npm run build
```

`pretest` incluye pruebas del verificador y análisis de límites; `prebuild` incluye el análisis.
Se requiere la suite vigente completa y cero errores de compilación. Informar advertencias
por separado; no aumentar budgets para esconderlas. El análisis AST no demuestra por sí solo
independencia semántica: revisar acoplamientos por cadenas y lógica específica introducida en el host.

Para cambios solo documentales, revisar enlaces, rutas, versiones y comandos contra el código.
Si otra instrucción aplicable exige tests/build, ejecutarlos también. No declarar pruebas no ejecutadas.
Actualizar `MICROKERNEL.md` y el capítulo correspondiente cuando cambien límites o contratos.
No crear commits salvo que se soliciten; si se solicita uno, usar Conventional Commits.
