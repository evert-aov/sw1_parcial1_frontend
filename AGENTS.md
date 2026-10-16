# 🤖 AGENTS.md - Directivas para Agentes de IA en el Frontend

Este archivo es leído por los agentes de IA que operen dentro del workspace del **Frontend**.

---

## 🎯 Skill Obligatoria: `sw1-fullstack-architect`

Lee y aplica estrictamente la skill del proyecto:
👉 [**`.agents/skills/sw1-fullstack-architect/SKILL.md`**](file:///frontend/.agents/skills/sw1-fullstack-architect/SKILL.md)

---

## 🎨 Reglas del Dev Senior Frontend (Angular 19 + Tailwind CSS + @foblex/flow)

1. **Standalone Puro**: Todos los componentes deben ser `standalone: true` con `ChangeDetectionStrategy.OnPush`.
2. **Reactividad con Signals**: Usa `signal()`, `computed()`, `effect()`, `input()` y `output()`.
3. **Internacionalización Obligatoria**: Nunca hardcodear cadenas visibles. Usa siempre `{{ 'clave' | translate }}` y define las claves en `src/app/core/i18n/translations/es.ts` y `en.ts`.
4. **Lienzo Nodal Modular**: Cada nodo UML se implementa como componente independiente en `src/app/features/diagrams/diagram-editor/components/diagram-canvas/nodes/`.
5. **Suite de UI Reutilizable**: Usa los componentes compartidos de `src/app/features/diagrams/diagram-editor/components/shared-ui/` (`DiagramZoomControlsComponent`, `DiagramLineRoutingSelectorComponent`, `DiagramRelationshipButtonComponent`, etc.).
6. **Consultar la Guía**: Antes de modificar código, consulta [`guia-desarrollador/README.md`](file:///frontend/guia-desarrollador/README.md).
7. **Verificación Estricta**: Antes de terminar, ejecuta `npm test -- --watch=false` (61 tests pasando) y `npm run build` (0 errores).

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
