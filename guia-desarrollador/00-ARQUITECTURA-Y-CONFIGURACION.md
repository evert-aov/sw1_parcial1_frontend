# 00 - Arquitectura y Configuración del Frontend

## 1. Visión General del Sistema
El frontend es una aplicación de modelado visual de software avanzada desarrollada con **Angular 22 Standalone**, estilizada con **Tailwind CSS v4** y potenciada con **Konva.js 2D** para el renderizado vectorial de alto rendimiento de grafos de nodos y conexiones orientadas a objetos.

Puede ejecutarse tanto en **navegadores web modernos** como empaquetada como **aplicación de escritorio multiplataforma (Linux, Windows, macOS)** mediante **Electron**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ENTORNO DE EJECUCIÓN                              │
│              Navegador Web (Chrome/Firefox)  ó  Electron Runtime            │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ANGULAR 22 APLICACIÓN                             │
│                                                                             │
│  ┌─────────────────────────┐  ┌───────────────────────────────────────────┐ │
│  │     CORE SINGLETONS     │  │                ROUTING                    │ │
│  │ ├── AuthService         │  │ ├── /auth/login, /auth/register           │ │
│  │ ├── TranslationService  │  │ ├── /projects (Dashboard de proyectos)    │ │
│  │ ├── ThemeService        │  │ └── /projects/:id/editor (Editor Gráfico) │ │
│  │ └── CollaborationServ   │  └───────────────────────────────────────────┘ │
│  └─────────────────────────┘                         │                      │
│                                                      ▼                      │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                  SUBSISTEMA DIAGRAM-EDITOR (PUDS)                      │ │
│  │  ┌────────────────────────┐ ┌──────────────────┐ ┌───────────────────┐ │ │
│  │  │ DiagramAppbarComponent │ │ DiagramCanvasComp│ │ DiagramSidebarComp│ │ │
│  │  └────────────────────────┘ └──────────────────┘ └───────────────────┘ │ │
│  │  ┌───────────────────────────────────────────────────────────────────┐ │ │
│  │  │        14 Servicios de Dominio Especializados (Cohesión)          │ │ │
│  │  └───────────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Estructura de Directorios

```
frontend/
├── src/
│   ├── app/
│   │   ├── app.config.ts        # Proveedores globales (HttpClient, Routing, Interceptors)
│   │   ├── app.routes.ts        # Definición de rutas y Guards de seguridad
│   │   ├── app.ts / app.html    # Contenedor raíz con Toasts y Diálogos globales
│   │   ├── core/                # Servicios singleton, modelos y utilidades
│   │   │   ├── guards/          # AuthGuard
│   │   │   ├── i18n/            # TranslationService, TranslatePipe, diccionarios
│   │   │   ├── interceptors/    # JwtInterceptor
│   │   │   ├── models/          # Interfaces TypeScript (Diagram, Project, User)
│   │   │   └── services/        # Clientes HTTP (Diagram, Project, XMI, AI, Export)
│   │   └── features/            # Módulos visuales por caso de uso
│   │       ├── auth/            # Vistas de Login y Registro
│   │       ├── projects/        # Gestión de proyectos y modal de miembros
│   │       └── diagrams/        # Editor completo de diagramas UML
│   │           └── diagram-editor/
│   │               ├── components/  # Canvas, Appbar, Sidebar, Modales, Shared-UI
│   │               ├── directives/  # AutofocusInputDirective
│   │               └── services/    # 14 Servicios de dominio del editor
│   ├── environments/            # Variables de entorno (Web, Prod, Electron)
│   └── styles.css               # Estilos globales y tokens Tailwind CSS
├── angular.json                 # Configuración del compilador Angular
├── main.js                      # Proceso principal de Electron
└── package.json                 # Dependencias y scripts
```

---

## 3. Entornos y Variables de Configuración

Ubicados en `src/environments/`:
- **`environment.ts` (Desarrollo Web)**:
  ```typescript
  export const environment = {
    production: false,
    apiUrl: 'http://localhost:3000/api',
    wsUrl: 'http://localhost:3000',
  };
  ```
- **`environment.electron.ts` (Modo Escritorio)**:
  - Configura el soporte de persistencia local y puertos adaptativos de comunicación con el backend integrado.
- **`environment.prod.ts` (Producción)**:
  - URLs relativas o de CDN con optimización estricta de empaquetado.

---

## 4. Scripts del `package.json`

| Comando | Acción |
| :--- | :--- |
| `npm start` | Inicia el servidor de desarrollo de Angular en `http://localhost:4200`. |
| `npm run build` | Compila el bundle de producción en `dist/frontend` con tree-shaking agresivo. |
| `npm test` | Ejecuta la suite de pruebas unitarias automatizadas con **Vitest** (91 pruebas, 100% pasando). |
| `npm run electron:serve` | Compila el frontend e inicia la ventana nativa de **Electron**. |
