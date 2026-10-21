# AGENTS.md — Frontend Angular 22 y microkernel

## Referencias del proyecto

Aplicar la skill [sw1-fullstack-architect](.agents/skills/sw1-fullstack-architect/SKILL.md)
para diseño, implementación, depuración y revisión de este proyecto. Consultar la
[guía del desarrollador](guia-desarrollador/README.md) y [MICROKERNEL.md](MICROKERNEL.md)
antes de modificar límites o contratos. Las instrucciones explícitas del usuario prevalecen.

## Reglas del frontend

1. **Angular 22**: componentes standalone con OnPush. Usar Signals y `input()`/`output()`
   en componentes nuevos. El arranque configura `provideZonelessChangeDetection()`.
   Verificar rangos en `package.json` y versiones instaladas en `node_modules`; Foblex tiene versión independiente.
2. **Core estable**: host de canvas, motor espacial, viewport, selección, historial,
   pestañas y orquestación. No introducir ramas por tipos concretos de nodos o formatos
   ni imports de implementaciones de plug-ins en el host.
3. **Plug-ins independientes**: nodos en `src/app/plugins/uml-*-node/`; herramientas y reglas
   en sus paquetes de dominio. Cero dependencias entre paquetes de plug-ins; consumir contratos.
4. **Contratos y composición**: interfaces, tokens, registro y outlet en `core/plugins/`.
   Registro concreto en `composition/`. Core, SDK y plug-ins no importan `features/`.
   Los contratos no exponen componentes del editor.
5. **SDK compartido**: reutilizar `src/app/plugin-sdk/ui/shared-ui/`, `ui/uml-svg/`,
   la factoría por registro y `geometry/`. No recrear los componentes WebGL eliminados.
6. **Internacionalización**: traducir textos visibles nuevos mediante `TranslatePipe` o
   `TranslationService` y definir claves en `src/app/core/i18n/translations/es.ts` y `en.ts`.
7. **Verificación**: antes de terminar ejecutar `npm test -- --watch=false` y `npm run build`.
   `pretest` ejecuta `test:architecture` y `check:architecture`; `prebuild` ejecuta el análisis.
   Debe pasar toda la suite vigente y compilar sin errores. No usar conteos históricos fijos;
   informar advertencias separadamente. Las pruebas entre implementaciones van en `composition/`.
8. **Mantenimiento**: preservar documentos/IDs, actualizar las guías al cambiar arquitectura
   y eliminar directorios vacíos tras mover archivos.

---

<!-- BEGIN:foblex-flow-agent-rules -->

## Foblex Flow (`@foblex/flow`)

Before writing any code that uses `@foblex/flow`, read the AI guide bundled with the
package: `node_modules/@foblex/flow/AI.md`. It contains the verified API surface, hard
rules (no React Flow patterns), a current `fConnector` setup, the choice between classic
app-owned records and opt-in `withFlowState()` managed records, and a checklist of common
silent failures. Domain validation, permissions, and persistence remain application
concerns in both state modes.

Additional references:

- Complete LLM-readable API reference: https://flow.foblex.com/llms-full.txt
- Docs index for agents: https://flow.foblex.com/llms.txt
- Diagnostic codes (`FFxxxx` console warnings/errors): https://flow.foblex.com/docs/errors
- Styling rules: `node_modules/@foblex/flow/STYLING.md`

<!-- END:foblex-flow-agent-rules -->
