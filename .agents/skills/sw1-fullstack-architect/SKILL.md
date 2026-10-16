---
name: sw1-fullstack-architect
description: >-
  Estándares de arquitectura de software y mejores prácticas de desarrollo Senior para el proyecto UML Collaborative Studio.
  Aplica el rol de Arquitecto de Software Senior (Kanon), Dev Senior Backend (NestJS, PostgreSQL, WebSockets, TypeORM) y
  Dev Senior Frontend (Angular 19 Standalone, Tailwind CSS v4, @foblex/flow, Signals).
  Usar SIEMPRE que se vaya a diseñar, refactorizar, implementar, depurar o revisar código en el backend o frontend.
---

# 🏛️ Skill: Arquitectura Senior y Buenas Prácticas de Ingeniería (UML Collaborative Studio)

Esta skill define el estándar de excelencia profesional, patrones de diseño y lineamientos técnicos obligatorios para cualquier agente de Inteligencia Artificial o desarrollador humano que trabaje en este proyecto colaborativo.

---

## 🎯 1. Rol: Arquitecto de Software Senior (Kanon)

Todo cambio en el sistema debe satisfacer estrictamente los principios del **Proceso Unificado de Desarrollo de Software (PUDS)**:

1. **Bajo Acoplamiento + Alta Cohesión**:
   - Prohibido crear archivos monolíticos ("God Classes" o "God Components").
   - Ningún controlador, servicio o componente debe superar las ~300 líneas de código sin justificación arquitectónica.
   - Si un componente o servicio acumula múltiples responsabilidades (ej. renderizar UI + manejar WebSockets + calcular geometría), DEBE modularizarse en servicios de dominio especializados o componentes reutilizables independientes.

2. **Tipado Estricto (Strict TypeScript)**:
   - Prohibido el uso de `any` no tipado. Toda entidad, DTO, evento WebSocket y respuesta HTTP debe tener interfaces o tipos explícitos (`UmlLineStyle`, `UmlRelationshipType`, `DiagramAst`, etc.).

3. **Política de Cero Regresiones (Zero-Regression Rule)**:
   - Antes de dar por concluida cualquier tarea o realizar un commit:
     - Backend: `npm test` (Jest) debe pasar al 100% (22 suites, 191 tests).
     - Frontend: `npm test -- --watch=false` (Vitest) debe pasar al 100% (9 suites, 61 tests) y `npm run build` debe compilar con **0 errores**.

4. **Commits Convencionales (Conventional Commits)**:
   - Cada commit debe ser atómico y seguir el estándar:
     - `feat(scope): ...` para nuevas funcionalidades.
     - `fix(scope): ...` para corrección de defectos.
     - `refactor(scope): ...` para modularización y mejoras sin cambio de comportamiento externo.
     - `docs(scope): ...` para documentación en guías y READMEs.

5. **Documentación Viva**:
   - Todo cambio arquitectónico debe reflejarse en:
     - [`backend/guia-desarrollador/`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/backend/guia-desarrollador/README.md)
     - [`frontend/guia-desarrollador/`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/guia-desarrollador/README.md)

---

## ⚙️ 2. Rol: Senior Backend Developer (NestJS + PostgreSQL + WebSockets)

### 1. Organización Modular en `src/modules/<modulo>/`
Cada módulo (`auth`, `projects`, `diagrams`, `code-generator`, `ai-assistant`) debe respetar la estructura:
```
modules/<nombre>/
├── <nombre>.module.ts       # Declaración de providers y exports
├── controllers/             # Solo endpoints HTTP REST (Delgados / Thin Controllers)
├── dtos/                    # Clases validadas con class-validator y class-transformer
├── entities/                # Entidades o modelos de datos
├── repositories/            # Acceso a datos y consultas SQL
└── services/                # Lógica pura de negocio y transacciones (Alta Cohesión)
```

### 2. Base de Datos PostgreSQL (10 Tablas Canónicas)
- Respetar el esquema oficial [`backend/schema.sql`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/backend/schema.sql).
- Todas las claves primarias son `UUID v4` (`gen_random_uuid()`).
- Para operaciones que toquen múltiples tablas (ej. guardar diagrama + crear snapshot de versión), usar transacciones seguras con `withTransaction()`.

### 3. Seguridad y Ciclo de Peticiones
- **Seguridad Zero-Trust**: Todas las rutas están protegidas globalmente por `JwtAuthGuard`.
- Usar `@Public()` únicamente en login, registro y endpoints públicos.
- Usar `@CurrentUser()` para obtener el usuario autenticado desde el token JWT.
- Las contraseñas deben cifrarse siempre con `bcrypt` (10 salt rounds).
- Todas las excepciones de negocio deben usar clases estándar de NestJS (`NotFoundException`, `BadRequestException`, `UnauthorizedException`).

### 4. Colaboración en Tiempo Real (Socket.IO)
- La sincronización se gestiona en [`CollaborationGateway`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/backend/src/modules/projects/gateways/collaboration.gateway.ts).
- Las conexiones se aíslan por salas: `project_${projectId}`.
- Exclusión mutua (*Node Locking*): Antes de editar un nodo, el cliente debe adquirir el candado con `lock_node`. Si otro usuario lo tiene, emitir `lock_rejected`.
- En desconexión (`handleDisconnect`), liberar inmediatamente todos los bloqueos del usuario.

### 5. Interoperabilidad XMI y Codegen
- El parser y exportador XMI 2.1 debe mantener compatibilidad estricta con Enterprise Architect (Sparx Systems).
- Las plantillas de generación de código residen en `templates/` y se compilan mediante `Mustache`.

---

## 🎨 3. Rol: Senior Frontend Developer (Angular 19 + Tailwind CSS v4 + @foblex/flow)

### 1. Componentes Standalone y Reactividad Fina
- **100% Standalone**: `standalone: true`. Prohibido el uso de `NgModule`.
- **Angular Signals**: Usar `signal()`, `computed()` y `effect()`. Usar `input()` y `output()` en componentes nuevos en lugar de `@Input()` / `@Output()`.
- **ChangeDetectionStrategy.OnPush**: Obligatorio en todos los componentes para máximo rendimiento de renderizado.

### 2. Arquitectura del Editor de Diagramas (`diagram-editor`)
- `DiagramEditorComponent` actúa como **coordinador**, NO como implementador monolítico.
- Delegar a los **14 servicios especializados**:
  - Persistencia: `DiagramPersistenceService`.
  - WebSocket y presencia: `DiagramCollaborationCoordinatorService`.
  - Historial (Undo/Redo): `DiagramHistoryService`.
  - Portapapeles (Copiar/Pegar): `DiagramClipboardService`.
  - Atajos de teclado: `DiagramHotkeysService`.
  - Distribución y alineación: `DiagramAlignmentService`.
  - Detección espacial de contención: `DiagramContainmentService`.
  - Navegación de cámara y zoom: `DiagramViewportService`.
  - Modales: `DiagramModalService`.
  - Creación de nodos: `DiagramNodeFactoryService`.

### 3. Lienzo y Nodos Modulares (`diagram-canvas`)
- Cada tipo de nodo UML tiene su componente standalone propio en [`diagram-canvas/nodes/`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/src/app/features/diagrams/diagram-editor/components/diagram-canvas/nodes/):
  - `UmlClassNodeComponent`
  - `UmlUseCaseNodeComponent`
  - `UmlActorNodeComponent`
  - `UmlRobustnessNodeComponent`
  - `UmlLifelineNodeComponent`
  - `UmlPackageNodeComponent`
  - `UmlComponentNodeComponent`
  - `UmlDeploymentNodeComponent`
- Si se añade un nuevo tipo de entidad UML, crear un componente nuevo en `nodes/` y registrarlo en `UML_CANVAS_NODE_COMPONENTS`. No ensuciar el HTML de `diagram-canvas`.

### 4. Suite UI Reutilizable (`shared-ui/`)
- En barras laterales, cajas de herramientas o modales, USAR SIEMPRE la suite [`shared-ui/`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/src/app/features/diagrams/diagram-editor/components/shared-ui/):
  - Zoom: `<app-diagram-zoom-controls [variant]="'grid' | 'flex'">`
  - Enrutamiento de líneas: `<app-diagram-line-routing-selector>`
  - Botón de relación UML: `<app-diagram-relationship-button>`
  - Botón de entidad draggable: `<app-diagram-tool-item-button>`
  - Cabecera de acordeón: `<app-diagram-tool-section-header>`

### 5. Internacionalización Obligatoria (i18n)
- Prohibido hardcodear textos visibles en español o inglés en el HTML.
- Usar siempre `{{ 'clave.traduccion' | translate }}` o `[title]="'clave.traduccion' | translate"`.
- Toda nueva clave debe registrarse simultáneamente en [`es.ts`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/src/app/core/i18n/translations/es.ts) y [`en.ts`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/src/app/core/i18n/translations/en.ts).

### 6. Estilos y Tema Oscuro (Tailwind CSS v4)
- Todas las vistas deben admitir modo claro y oscuro con variantes `dark:`.
- Usar la paleta semántica del proyecto: `slate-900` / `[#14182E]` para fondos oscuros, `border-slate-200` / `dark:border-slate-700`.

---

## 🔍 4. Lista de Verificación Pre-Entrega (Checklist)

Antes de considerar cualquier desarrollo finalizado, verificar:
- [ ] ¿El código cumple con Bajo Acoplamiento y Alta Cohesión?
- [ ] ¿No hay tipos `any` inseguros?
- [ ] ¿El backend pasa `npm test` (191 tests aprobados)?
- [ ] ¿El frontend pasa `npm test -- --watch=false` (61 tests aprobados)?
- [ ] ¿El frontend compila limpiamente con `npm run build` (0 errores)?
- [ ] ¿Los nuevos textos tienen traducción en `es.ts` y `en.ts`?
- [ ] ¿Los cambios de arquitectura quedaron documentados en `guia-desarrollador/`?
- [ ] ¿El commit sigue el estándar de Conventional Commits?
