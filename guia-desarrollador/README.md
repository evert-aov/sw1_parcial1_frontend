# 📖 Guía Integral del Desarrollador - Frontend (Angular 19 Standalone + Tailwind CSS + WebSockets + Electron)

Bienvenido a la **Guía Integral del Desarrollador del Frontend**. Este documento ha sido elaborado por el Arquitecto de Software para brindar una referencia exhaustiva, detallada y práctica sobre la implementación del cliente web y de escritorio.

---

## 🗺️ Mapa de Contenidos

La guía está estructurada en **7 capítulos modulares**:

| Capítulo | Documento | Descripción Temática |
| :--- | :--- | :--- |
| **00** | [Arquitectura y Configuración](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/guia-desarrollador/00-ARQUITECTURA-Y-CONFIGURACION.md) | Visión global, stack tecnológico, Angular 19 Standalone, Signals, Tailwind CSS v4, entorno Electron y scripts. |
| **01** | [Core, Servicios e Internacionalización](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/guia-desarrollador/01-CORE-SERVICIOS-E-I18N.md) | Sistema i18n reactivo (`TranslatePipe`), `ThemeService` (Dark/Light), `AuthGuard`, `JwtInterceptor` y clientes HTTP. |
| **02** | [Arquitectura del Editor de Diagramas](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/guia-desarrollador/02-ARQUITECTURA-DEL-EDITOR-DE-DIAGRAMAS.md) | Desacoplamiento de `DiagramEditorComponent` en 14 servicios de dominio especializados (Bajo Acoplamiento + Alta Cohesión). |
| **03** | [Lienzo y Nodos Modulares (Konva.js)](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/guia-desarrollador/03-LIENZO-Y-NODOS-MODULARES.md) | Arquitectura del lienzo `DiagramCanvasComponent` con Konva.js, transformaciones espaciales y los 13 renderers de nodos UML modulares. |
| **04** | [Colaboración en Tiempo Real y WebSockets](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/guia-desarrollador/04-COLABORACION-TIEMPO-REAL-Y-WEBSOCKETS.md) | Coordinación Socket.IO, sincronización de cursores, bloqueo visual de nodos concurrentes y reconexión suave. |
| **05** | [Suite UI Reutilizable y Componentes Compartidos](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/guia-desarrollador/05-SUITE-UI-REUTILIZABLE-Y-ESTILOS.md) | Suite `shared-ui/` (Zoom, LineRouting, ToolItem, RelationshipButtons), renderizado SVG (`uml-svg/`) y WebGL. |
| **06** | [Exportación, Interoperabilidad XMI, Codegen e IA](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/guia-desarrollador/06-EXPORTACION-XMI-CODEGEN-E-IA.md) | Exportación a imagen de alta definición (BMP/PNG), importación XMI 2.1, generación de código y asistente IA con cámara. |

---

## ⚡ Guía de Inicio Rápido (Onboarding)

### 1. Prerrequisitos
* **Node.js**: `v20.x` o superior.
* **NPM**: `v10.x` o superior.
* **Backend**: Debe estar en ejecución en `http://localhost:3000`.

### 2. Instalación y Ejecución Web
```bash
cd frontend

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo en http://localhost:4200
npm start

# Ejecutar pruebas unitarias automatizadas con Vitest (82 tests pasando)
npm test -- --watch=false

# Compilar para producción (0 errores)
npm run build
```

### 3. Ejecución en Modo Escritorio (Electron)
```bash
# Iniciar frontend empaquetado como aplicación de escritorio nativa
npm run electron:serve
```

---

## 📐 Principios de Diseño que Rigen este Frontend
1. **Componentes Standalone Puros**: No se utilizan `NgModule`. Todos los componentes declaran explícitamente sus dependencias en `imports: [...]`.
2. **Reactividad Fina con Angular Signals**: Estado reactivo mediante `signal()`, `computed()` y `effect()`, minimizando ciclos de detección de cambios pesados (`ChangeDetectionStrategy.OnPush`).
3. **Bajo Acoplamiento en Nodos**: Cada nodo UML (`uml-class-node`, `uml-use-case-node`, etc.) tiene su propio template y lógica aislada sin contaminar el lienzo general.
4. **Accesibilidad e Internacionalización por Defecto**: Todas las etiquetas visuales se canalizan mediante `TranslatePipe`.
