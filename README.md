# 🎨 UML/ER Collaborative Studio - Frontend

Aplicación web moderna y reactiva construida con **Angular 22 Standalone**, motor gráfico **Konva.js 2D**, **Tailwind CSS v4** y **Heroicons**. Ofrece un entorno integral para el modelado visual colaborativo de diagramas UML 2.5, asistencia de Inteligencia Artificial en caliente (**Google Gemini**), interoperabilidad bidireccional con **Enterprise Architect (XMI 2.1)** y previsualización interactiva de código generado para **Spring Boot** y **Flutter**.

> 📘 **Documentación Oficial para Desarrolladores**: Para consultar la arquitectura técnica detallada, el lienzo de nodos modulares, sincronización colaborativa y suite de componentes reutilizables, revisa la [**Guía Integral del Desarrollador del Frontend**](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/guia-desarrollador/README.md).

---

## 📌 Tabla de Contenidos
1. [Características Principales](#-características-principales)
2. [Stack Tecnológico](#-stack-tecnológico)
3. [Configuración de Conexión con Backend](#-configuración-de-conexión-con-backend)
4. [Estructura del Proyecto](#-estructura-del-proyecto)
5. [Requisitos Previos](#-requisitos-previos)
6. [Instalación y Ejecución Web](#-instalación-y-ejecución-web)
7. [Modo Escritorio (Electron) por Sistema Operativo](#-modo-escritorio-electron-por-sistema-operativo)
8. [Módulos y Componentes Clave](#-módulos-y-componentes-clave)
9. [Scripts Disponibles](#-scripts-disponibles)

---

## ✨ Características Principales

* **Lienzo Gráfico Nodal de Alto Rendimiento (Konva.js 2D)**:
  * **13 Nodos Modulares Desacoplados**: Renderers independientes para Clases, Actores, Casos de Uso, Análisis BCE, Lifelines, Componentes, Paquetes, Capas, Despliegue, Actividad y Notas.
  * **Zoom Acotado y Eficiente (15% a 125%)**: Control fino de escalado que previene picos de consumo de memoria RAM o degradación en el navegador al realizar transiciones graduales.
  * **Personalización Cromática con Persistencia**: Paleta de colores seleccionable desde la cinta de herramientas, sincronizada en tiempo real vía WebSockets y guardada en el backend.
  * **Clases Asociativas Refinadas**: Conexión reactiva por rama discontinua (*dashed stem*), espaciado simétrico de atributos (`| + atributo: tipo |`) y eliminación de estereotipos redundantes.
  * **Diagrama de Clases (Class Diagram)**:
    * Clases, interfaces, enumeraciones, paquetes y clases de asociación.
    * Gestión granular de atributos y operaciones con visibilidades (`+`, `-`, `#`, `~`), tipos de datos de base de datos/Java, modificadores (`PK`, `AutoIncrement`, `Nullable`, `Unique`) y parámetros de métodos tipados.
    * Relaciones semánticas: Asociación, Agregación, Composición, Herencia/Generalización, Realización y Dependencia con marcadores conformes al estándar UML.
  * **Diagrama de Análisis de Clases (Class Analysis Diagram)**:
    * Entorno especializado para análisis preliminar y diseño de dominio que combina la expresividad del diagrama de clases con la presencia directa de **Actores**.
    * Permite vincular actores del sistema con clases de análisis y entidades para modelar responsabilidades y trazabilidad de requerimientos.
  * **Diagrama de Casos de Uso (Use Case Diagram)**:
    * Actores modelados mediante SVG vectorial calibrado con encuadre de cabeza y cuerpo balanceado sin recortes visuales.
    * Casos de uso elípticos con soporte para estereotipos (`«include»`, `«extend»`).
    * Límites del Sistema (*System Boundary*) con agrupación visual.
    * Posicionamiento optimizado de estereotipos y etiquetas de relación, asegurando que se ubiquen por debajo del nombre del actor para evitar solapamientos.
  * **Diagrama de Secuencia (Sequence Diagram)**:
    * Líneas de vida (*Lifelines*) para objetos y actores con cabeceras estilizadas y líneas discontinuas verticales.
    * Barras de activación vertical dinámicas (*Execution Specifications / Activations*) con cálculo automático de intervalos solapados e interacciones concurrentes.
    * Mensajes síncronos (flecha sólida), asíncronos (flecha abierta), retornos (`reply` con línea discontinua), creación de objetos y llamadas reflexivas/recursivas con asignación cromática personalizable y numeración secuencial.
  * **Diagrama de Comunicación / Colaboración (Communication Diagram)**:
    * Participantes y actores con estereotipos de Robustez de Jacobson (**Boundary**, **Control**, **Entity**), visualmente calibrados con diámetros de círculos armónicos e idénticos al tamaño del Entity.
    * Conexiones con etiquetas de mensajes, orden de secuencia numérico jerárquico y flechas direccionales de llamada.
  * **Diagrama de Paquetes (Package Diagram)**:
    * Contenedores de paquetes con pestaña (*tab*) superior estilizada.
    * Relaciones de dependencia y estereotipos de importación/acceso (`«import»`, `«access»`, `«merge»`, `«trace»`).
  * **Diagrama de Capas (Layered Architecture Diagram)**:
    * Modelado de arquitecturas por niveles (Presentación, Negocio/Dominio, Datos/Persistencia, etc.).
    * Elementos: Paquetes y Nodos de Agrupación de Capa (*Boundary Box*) con etiqueta de nombre centrada en la parte superior.
    * Relaciones de dependencia e importación entre paquetes de distintos niveles de abstracción.
  * **Diagrama de Componentes (Component Diagram)**:
    * Modelado modular de subsistemas y ejecutables mediante nodos de **Componentes UML** (icono clásico de dos rectángulos incrustados y estereotipo `«component»`).
    * Cajas de agrupación (*Boundary Box*) para delinear límites de módulos y subsistemas.
    * Relaciones de componentes: **Ensamble / Ball-and-Socket** (`assembly`), **Asociación** (`association`), **Realización** (`realize`) y **Generalización** (`generalize`).
  * **Diagrama de Despliegue (Deployment Diagram)**:
    * Representación de infraestructura física y virtual mediante nodos vectoriales en **perspectiva 3D isométrica**:
      * **Nodo de Computación (`node`)**: Servidores de cómputo general.
      * **Dispositivo de Hardware (`device`)**: Dispositivos periféricos, sensores y routers.
      * **Entorno de Ejecución (`executionEnvironment`)**: Servidores de aplicaciones, JVMs, contenedores y bases de datos.
    * Cajas de delimitación de red y servidores (*Boundary Box*) con contención de nodos internos.
    * Relaciones de despliegue: Rutas de comunicación (`communication_path`), Despliegue de artefactos (`deploy`), Manifestación (`manifest`) y Dependencias de red.

* **Agrupación Jerárquica y Arrastre Recursivo de Contenedores (`boundary_box`)**:
  * **Detección Geométrica de Contención**: El motor calcula en tiempo real si un nodo se encuentra espacialmente delimitado dentro de una caja de agrupación.
  * **Arrastre Coordinado Jerárquico**: Las cajas vinculan dinámicamente sus nodos contenidos mediante `DiagramContainmentService` y el motor nodal Konva.js, permitiendo desplazar la caja contenedora y arrastrar automáticamente todos los componentes y nodos contenidos de forma fluida.
  * **Apilamiento Inteligente de `z-index` por Área Efectiva**: Los contenedores más amplios se posicionan automáticamente en capas inferiores y los elementos contenidos al frente, evitando oclusiones visuales y facilitando la interacción.

* **Motor de Interacción y Relaciones UML de Alta Precisión**:
  * **Hit Target Expandido de 40px**: Facilita la selección y edición de cualquier relación sin importar su delgadez visual (trazo elegante de 1.3px a 2.5px), ofreciendo un área de impacto invisible de 40px (±20px a cada lado) que previene clics fallidos a través de la línea hacia el lienzo.
  * **Hit-Testing SVG Robusto con Alfa No Nulo**: Implementación técnica en CSS con `stroke: rgba(0, 0, 0, 0.001)` y `pointer-events: stroke`, superando las limitaciones nativas de Chromium/WebKit donde los trazos transparentes (`alpha = 0`) son ignorados por el motor de detección de puntero.
  * **Doble Clic Inteligente por Cadencia (< 450ms) y Traversal DOM**: Permite abrir instantáneamente el modal de edición de relación (`EditConnectionModalComponent`) con un doble clic rápido en cualquier tramo de la línea (no solo en el badge central), identificando la conexión mediante recorrido ascendente del árbol SVG/DOM y soporte de atributos `data-connection-id`.
  * **Modal de Edición de Conexión en Caliente**: Configuración reactiva de nombre, tipo de relación, multiplicidad de origen/destino, estereotipos y estilos de línea.

* **Espacio de Trabajo Multi-Pestaña (Multi-Tab Workspace)**:
  * Barra de pestañas integrada en el editor que permite mantener múltiples diagramas abiertos simultáneamente (Clases, Análisis, Casos de Uso, Secuencia, Comunicación, Paquetes, Capas, Componentes, Despliegue).
  * Conmutación instantánea entre diagramas dentro del mismo proyecto sin recargar el estado, conservando el nivel de zoom y posición del viewport en cada pestaña.

* **Arrastre Directo desde la Paleta y Explorador (Drag and Drop al Lienzo)**:
  * Permite arrastrar elementos tanto desde la barra de herramientas lateral (*Toolbox*) como desde el explorador del proyecto (*Explorer*) directamente a las coordenadas exactas deseadas en el lienzo, clonando o posicionando nodos sin clics intermediarios.

* **Toolbox Inteligente y Sin Redundancias**:
  * Paleta contextual que filtra los elementos disponibles según el tipo de diagrama activo (Clases, Análisis, Capas, Componentes, Despliegue, etc.).
  * Eliminación de botones redundantes en la parte inferior para ofrecer una experiencia limpia, despejada y enfocada.

* **Internacionalización Integral (i18n Bilingüe Español / Inglés)**:
  * Sistema de traducción reactivo con cambio dinámico de idioma en tiempo real sin recargar la página.
  * Cobertura completa en lienzos, tooltips de acciones, botones flotantes de nodos, modales de confirmación y advertencias de incompatibilidad de elementos.

* **Colaboración Multiusuario en Tiempo Real**:
  * Sincronización instantánea mediante **Socket.io**.
  * Visualización de cursores remotos con identificación de usuario y color asignado.
  * Arrastre de nodos en vivo entre colaboradores.
  * Sistema de bloqueo exclusivo de nodos (`NodeLock`) para evitar conflictos de edición simultánea.
  * Chat integrado en vivo en cada sala de diagrama.

* **Copilot de Inteligencia Artificial Híbrido (Local & Multimodal)**:
  * Panel lateral flotante con historial conversacional reactivo.
  * Soporte de inferencia soberana local con **Ollama (`qwen2.5:3b`)** para mutaciones del AST sin salida de datos a internet, con respaldo cloud en **Google Gemini 2.5 Flash**.
  * Entrada visual mediante captura de cámara web (Webcam) o subida de imágenes para transformar bocetos en diagramas UML interactivos.

* **Interoperabilidad CASE (Enterprise Architect)**:
  * Exportación e importación de archivos estándar **XMI 2.1**.
  * Historial de versiones del diagrama con previsualización y restauración instantánea.

* **Explorador y Generador de Código Fullstack**:
  * Modal interactivo con árbol de archivos en tiempo real y resaltado de sintaxis.
  * **Spring Boot 3 (Java 21)** con JPA, Flyway, Docker Compose y PostgreSQL.
  * **Flutter Móvil (Clean Architecture / BLoC)** con **Asistente IA On-Device** integrado que descarga automáticamente el modelo **Qwen 2.5 GGUF** (`qwen2.5-0.5b-instruct-q4_k_m.gguf` desde Hugging Face) ejecutando inferencia 100% offline con `llama.cpp` en el dispositivo móvil, sin necesidad de apps externas.
  * Descarga directa del proyecto completo empaquetado en `.zip` o distribución en la nube mediante URLs prefirmadas de **Amazon S3**.

* **Guía Interactiva de Usuario & Chatbot Inteligente**:
  * **Sustituto del Manual Tradicional**: Asistente conversacional flotante disponible en toda la aplicación para orientar a nuevos usuarios en tiempo real.
  * **Tour Guiado en 7 Pasos**: Flujo paso a paso con controles de navegación (Anterior, Siguiente, Finalizar) cubriendo desde la creación de proyectos hasta el despliegue con Docker y Flutter.
  * **Chatbot con Búsqueda Semántica**: Respuestas instantáneas en lenguaje natural con renderizado enriquecido (Rich HTML), títulos estilizados, viñetas y alertas.
  * **Bloques de Código con Copia en 1 Clic**: Snippets de terminal para Docker, Gradle y Flutter con retroalimentación visual de copiado.
  * **Carrusel de Temas con Scroll y Flechas**: Selector horizontal con botones de desplazamiento suave, soporte de rueda de ratón (`mousewheel`) y barra de scroll estilizada (`topics-scrollbar`).

* **Gestión de Proyectos & Seguridad**:
  * Dashboard de proyectos con control de miembros y asignación de roles (`OWNER`, `EDITOR`, `VIEWER`).
  * Autenticación JWT persistente con interceptores HTTP reactivos y guardias de ruta.

---

## 🛠 Stack Tecnológico

* **Framework:** Angular 22 (Standalone Components, Signals & Reactive Forms).
* **Motor de Diagramación 2D:** Konva.js (`konva` v10+) para renderizado vectorial acelerado por Canvas 2D de alto rendimiento y bajo consumo de memoria.
* **Iconografía & Estilos:** Tailwind CSS v4 + Heroicons (`@ng-icons/heroicons`) + banderas SVG vectoriales nativas.
* **Colaboración en Tiempo Real:** `socket.io-client` para sincronización bidireccional, cursores remotos y bloqueos concurrentes.
* **Formatos, Exportación & Utilidades:** Motor de exportación ultraligero (<1MB) vía `Konva.Stage.toCanvas()`, `fast-xml-parser` (XMI 2.1 Parsing) y `highlight.js`.
* **Pruebas Automatizadas:** Vitest (91 pruebas unitarias, 100% pasando).

---

## 🌐 Configuración de Conexión con Backend

Toda la configuración de conexión con el backend y websockets está **centralizada en un único lugar** mediante los entornos de Angular:

### 1. Modo Desarrollo (`DEV`)
Edita el archivo [`src/environments/environment.ts`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/src/environments/environment.ts):

```typescript
export const environment = {
  production: false,
  // Configura aquí el host/puerto del backend para desarrollo
  apiUrl: 'http://localhost:4000/api',
  socketUrl: 'http://localhost:4000/collaboration',
};
```

### 2. Modo Producción (`PROD`)
Edita el archivo [`src/environments/environment.prod.ts`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/src/environments/environment.prod.ts):

```typescript
export const environment = {
  production: true,
  // Configura aquí el host/puerto del backend para producción
  apiUrl: 'http://localhost:3000/api',
  socketUrl: 'http://localhost:3000/collaboration',
};
```

> **Nota:** Al ejecutar `ng build` (o `npm run build`), Angular CLI sustituye automáticamente `environment.ts` por `environment.prod.ts` mediante `fileReplacements` configurado en `angular.json`.

---

## 📂 Estructura del Proyecto

```text
frontend/
├── src/
│   ├── main.ts
│   ├── styles.css                    # Configuración de Tailwind CSS v4 y temas
│   ├── environments/                 # Configuración centralizada de backend
│   │   ├── environment.ts            # Entorno de desarrollo (DEV)
│   │   └── environment.prod.ts       # Entorno de producción (PROD)
│   └── app/
│       ├── app.config.ts             # Proveedores globales (Router, HttpClient con interceptores)
│       ├── app.routes.ts             # Rutas de la aplicación y guards de autenticación
│       ├── core/                     # Servicios singleton, componentes globales y lógica compartida
│       │   ├── components/           # Componentes globales reutilizables
│       │   │   ├── theme-toggle/     # Selector de tema (Claro / Oscuro)
│       │   │   └── user-guide-chatbot/ # 🤖 Guía interactiva & Manual de usuario con Chatbot
│       │   ├── guards/               # AuthGuard
│       │   ├── interceptors/         # jwtInterceptor
│       │   ├── models/               # Modelos TypeScript (diagram, project, user, auth)
│       │   └── services/             # Servicios HTTP, WebSocket y Guía
│       │       ├── auth.service.ts
│       │       ├── diagram.service.ts
│       │       ├── project.service.ts
│       │       ├── collaboration.service.ts
│       │       ├── ai-assistant.service.ts
│       │       ├── code-generator.service.ts
│       │       ├── user-guide.service.ts
│       │       └── xmi.service.ts
│       └── features/                 # Módulos de funcionalidad (UI)
│           ├── auth/                 # Login y Registro
│           ├── projects/             # Dashboard de proyectos y gestión de miembros
│           └── diagrams/             # Editor principal de diagramas
│               └── diagram-editor/
│                   ├── components/
│                   │   ├── ai-assistant-panel/
│                   │   ├── diagram-appbar/
│                   │   ├── diagram-canvas/
│                   │   │   ├── nodes/        # Nodos especializados por tipo UML (Bajo Acoplamiento)
│                   │   │   │   ├── uml-actor-node/
│                   │   │   │   ├── uml-class-node/
│                   │   │   │   ├── uml-component-node/
│                   │   │   │   ├── uml-deployment-node/
│                   │   │   │   ├── uml-lifeline-node/
│                   │   │   │   ├── uml-package-node/
│                   │   │   │   ├── uml-robustness-node/
│                   │   │   │   └── uml-use-case-node/
│                   │   │   ├── diagram-canvas.component.html
│                   │   │   └── diagram-canvas.component.ts
│                   │   ├── diagram-context-menu/  # Menú contextual flotante interactivo
│                   │   ├── diagram-floating-label/# Etiquetas flotantes con offset arrastrable
│                   │   ├── diagram-tabs/          # Barra de pestañas multi-diagrama
│                   │   ├── diagram-toolbox/       # Paleta contextual filtrada por tipo de diagrama
│                   │   ├── diagram-sidebar/       # Panel lateral multi-diagrama UML
│                   │   ├── shared-ui/             # Suite de componentes UI reutilizables (Zoom, LineRouting, ToolButtons)
│                   │   ├── uml-svg/               # Componentes de renderizado vectorial SVG (UML 2.5)
│                   │   ├── uml-webgl/             # Canvas interactivos WebGL acelerados por GPU
│                   │   ├── spring-boot-modal/
│                   │   ├── user-profile-modal/
│                   │   ├── xmi-import-modal/
│                   │   └── xmi-versions-modal/
│                   ├── directives/
│                   │   └── autofocus-input.directive.ts # Directiva de foco automático para edición in-place
│                   ├── services/                  # Servicios de Dominio Especializados (Alta Cohesión)
│                   │   ├── diagram-ai-sync.service.ts
│                   │   ├── diagram-alignment.service.ts
│                   │   ├── diagram-clipboard.service.ts
│                   │   ├── diagram-collaboration-coordinator.service.ts # WebSocket y exclusión mutua
│                   │   ├── diagram-connection-layout.service.ts
│                   │   ├── diagram-containment.service.ts
│                   │   ├── diagram-export.service.ts
│                   │   ├── diagram-history.service.ts
│                   │   ├── diagram-hotkeys.service.ts
│                   │   ├── diagram-import.service.ts
│                   │   ├── diagram-modal.service.ts
│                   │   ├── diagram-node-factory.service.ts
│                   │   ├── diagram-persistence.service.ts
│                   │   └── diagram-viewport.service.ts
│                   ├── diagram-editor.icons.ts    # Iconografía HeroIcons optimizada para tree-shaking
│                   ├── diagram-editor.component.html
│                   └── diagram-editor.component.ts
├── angular.json
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

---

## 📋 Requisitos Previos

* **Node.js**: Versión `20.x` o `22.x`.
* **npm**: Versión `10.x` o superior.
* **Backend**: Backend API ejecutándose (por defecto en `http://localhost:4000`).

---

## 🚀 Instalación y Ejecución Web

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Iniciar servidor de desarrollo:**
   ```bash
   npm start
   # o alternativamente:
   npx ng serve
   ```
   La aplicación se abrirá en `http://localhost:4200/`.

3. **Compilar para producción (Web):**
   ```bash
   npm run build
   ```
   Los artefactos optimizados se generarán en el directorio `dist/frontend`.

---

## 🖥️ Modo Escritorio (Electron) por Sistema Operativo

La aplicación cuenta con soporte nativo de escritorio mediante **Electron**, permitiendo ejecutar el diagramador como una aplicación independiente con aceleración por hardware, ventana auto-escalable y sin interferencia de atajos del navegador.

### ⚡ Flujos de Ejecución Rápida

* **Modo Producción Local (Compilado Embebido):**
  Compila los activos de Angular con base de ruta relativa y abre la ventana nativa de Electron sirviendo los archivos locales:
  ```bash
  npm run electron:start
  ```

* **Modo Desarrollo en Caliente (Live Reload & DevTools):**
  Permite editar el código Angular y ver cambios instantáneamente en la ventana de Electron:
  ```bash
  # Terminal 1: Iniciar servidor Angular
  npm start

  # Terminal 2: Abrir ventana Electron conectada al servidor local
  npm run electron:dev
  ```

---

### 🐧 Linux (Ubuntu, Debian, Fedora, Arch, etc.)

1. **Generar paquete AppImage portable:**
   ```bash
   npm run dist:linux
   ```
   El paquete se generará en la carpeta `release/Diagramador UML-1.0.0.AppImage`.

2. **Otorgar permisos de ejecución y abrir:**
   ```bash
   chmod +x "release/Diagramador UML-1.0.0.AppImage"
   ./release/"Diagramador UML-1.0.0.AppImage"
   ```

---

### ❄️ NixOS (Linux Declarativo)

> [!NOTE]
> En NixOS, los binarios FHS estándar precompilados de Electron descargados por `npm` en `node_modules` no encuentran librerías dinámicas del sistema (`libnspr4.so`, `libnss3.so`, etc.). El proyecto ya incluye un [`shell.nix`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/shell.nix) configurado para resolver esto automáticamente.

#### Flujo Recomendado en NixOS:
Simplemente entra al entorno interactivo de Nix:
```bash
nix-shell
```
Una vez dentro de `nix-shell`, `ELECTRON_OVERRIDE_DIST_PATH` estará activo y todos los comandos estándar funcionarán con el Electron nativo de NixOS:
* **Modo desarrollo en caliente (Live Reload & DevTools):**
  ```bash
  # Terminal 1: Iniciar frontend web
  npm start

  # Terminal 2: Abrir ventana de Electron
  npm run electron:dev
  ```
* **Compilar y abrir la app de escritorio (conectada al backend local):**
  ```bash
  npm run electron:start
  ```
* **Generar el AppImage para Linux (Local):**
  ```bash
  npm run dist:linux
  ```
* **Ejecutar el AppImage generado:**
  ```bash
  npm run appimage:run
  ```

#### Ejecución Directa en 1 Línea (Sin entrar a nix-shell interactivo):
Si no deseas abrir un sub-shell, puedes usar los scripts directos `:nix`:
* **Desarrollo:** `npm run electron:dev:nix`
* **Compilar y abrir:** `npm run electron:start:nix`
* **Empaquetar AppImage:** `npm run dist:linux:nix`
* **Correr AppImage:** `npm run appimage:run`

---

### 🚀 Instrucciones para Pasar a Producción (PROD)

Cuando tu backend esté desplegado en un servidor o dominio accesible:

1. **Configurar la URL de tu backend de producción:**
   Edita [`src/environments/environment.prod.ts`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/src/environments/environment.prod.ts) con las URLs reales de tu API y WebSockets:
   ```typescript
   export const environment = {
     production: true,
     apiUrl: 'https://tu-dominio.com/api',
     socketUrl: 'https://tu-dominio.com/collaboration',
   };
   ```

2. **Compilar y empaquetar para producción:**
   * **Modo Web:**
     ```bash
     npm run build
     ```
   * **Modo Escritorio Linux (AppImage conectado a Producción):**
     ```bash
     npm run dist:linux:prod
     # O en NixOS:
     npm run dist:linux:prod:nix
     ```
   * **Modo Escritorio Windows / macOS (Producción):**
     ```bash
     npm run dist:win
     npm run dist:mac
     ```

### 🪟 Windows (Windows 10 / 11)

1. **Ejecución directa en desarrollo (PowerShell o CMD):**
   ```powershell
   npm run electron:start
   ```

2. **Empaquetado para distribución:**
   ```powershell
   npm run dist:win
   ```
   Genera automáticamente en la carpeta `release/`:
   * **Instalador NSIS:** `Diagramador UML Setup 1.0.0.exe` (crea accesos directos e instalador para el sistema).
   * **Versión Portable:** `Diagramador UML 1.0.0.exe` (ejecutable autónomo de 1 clic sin necesidad de instalación).

---

### 🍎 macOS (Intel / Apple Silicon)

1. **Ejecución directa en desarrollo:**
   ```bash
   npm run electron:start
   ```

2. **Empaquetado DMG / Aplicación nativa:**
   ```bash
   npm run dist:mac
   ```
   *(Nota: El empaquetado para macOS requiere ejecutarse en un entorno macOS con Xcode Command Line Tools instalados).*

---

## 🧩 Módulos y Componentes Clave

### 🏛️ Arquitectura Modular (Bajo Acoplamiento + Alta Cohesión)
El editor de diagramas ha sido reestructurado desde un archivo monolítico de más de 5,000 líneas hacia un ecosistema desacoplado y altamente cohesivo guiado por principios de arquitectura limpia:

1. **Orquestador Principal (`DiagramEditorComponent`)**:
   - Actúa estrictamente como coordinador de alto nivel del ciclo de vida del diagrama, orquestando las señales reactivas del canvas, la barra de herramientas y los paneles laterales.
   - Reducción drástica de complejidad delegando responsabilidades a servicios inyectables e interfaces bien tipadas.

2. **Capa de Nodos Especializados (`components/diagram-canvas/nodes/`)**:
   - **`UmlClassNodeComponent`**: Clases, interfaces, enumeraciones, atributos tipados, modificadores y métodos.
   - **`UmlPackageNodeComponent`**: Paquetes UML con pestañas superiores y soporte nativo para recuadros agrupadores (`boundary_box`) en diagramas de capas y componentes.
   - **`UmlDeploymentNodeComponent`**: Nodos físicos y virtuales con prisma 3D oblicuo conforme al estándar UML 2.5 (`node`, `device`, `executionEnvironment`).
   - **`UmlComponentNodeComponent`**: Subsistemas y componentes ejecutables con iconografía incrustada.
   - **`UmlActorNodeComponent`**: Actores vectoriales calibrados con líneas de vida opcionales para análisis.
   - **`UmlLifelineNodeComponent`**: Líneas de vida en diagramas de secuencia con especificaciones de activación temporal.
   - **`UmlUseCaseNodeComponent`**: Casos de uso elípticos con soporte para estereotipos `«include»` y `«extend»`.
   - **`UmlRobustnessNodeComponent`**: Objetos de análisis BCE de Jacobson (Boundary, Control, Entity) con dimensiones calibradas.
   - **Estilos de Host Flexibles (`host`)**: Todos los componentes de nodo cuentan con `host: { class: 'w-full h-full flex flex-col flex-1 min-h-0 min-w-0' }`, eliminando el comportamiento `display: inline` nativo de los custom elements de Angular y garantizando que el recuadro visual responda al 100% de la geometría redimensionada en el canvas.
   - **Sincronización Geométrica 3D**: Nodos de despliegue con cálculo unificado (`isDeploymentNode` y `getDeploymentHeight`) que sincroniza milimétricamente las caras superior y lateral derecha SVG con la cara frontal principal.

3. **Servicios de Dominio Desacoplados (`services/`)**:
   - **`DiagramCollaborationCoordinatorService`**: Gestión aislada de la coordinación WebSocket multiusuario, cursores remotos, salas Socket.io y bloqueo de exclusión mutua de nodos (`NodeLock`).
   - **`DiagramClipboardService`**: Operaciones de portapapeles (copiar, cortar, pegar) con validación estricta de compatibilidad entre tipos de diagramas y offset automático de pegado.
   - **`DiagramNodeFactoryService`**: Fábrica estandarizada de creación de nodos para los 9 tipos de diagramas UML con dimensiones, colores y estereotipos predeterminados.
   - **`DiagramExportService`**: Exportación de diagramas a imágenes PNG de alta resolución, BMP y estructuras AST limpias para persistencia.
   - **`DiagramAiSyncService`**: Sincronización bidireccional y normalización de diagramas generados o modificados por el Copilot IA.
   - **`DiagramHistoryService`**: Pila de deshacer/rehacer (*Undo/Redo*) con estados inmutables en memoria.
   - **`DiagramHotkeysService`**: Mapeo centralizado de atajos de teclado (`Ctrl+Z`, `Ctrl+Y`, `Ctrl+C`, `Ctrl+V`, `Del`, `Ctrl+S`, `Ctrl++`, `Ctrl+-`).
   - **`DiagramContainmentService`**: Algoritmo espacial de detección de contención para cajas de agrupación (`boundary_box`) y arrastre jerárquico.
   - **`DiagramAlignmentService`**: Algoritmos de alineación y distribución espacial automática de nodos (izquierda, centro, derecha, superior, medio, inferior).

4. **Componentes y Directivas UI Especializadas**:
   - **`DiagramContextMenuComponent`**: Menú contextual interactivo activado por clic derecho con opciones de alineación, ordenamiento z-index, bloqueo, duplicación y eliminación.
   - **`DiagramFloatingLabelComponent`**: Etiquetas flotantes arrastrables con offset independiente (`labelOffset`) para nombres de actores y objetos de robustez.
   - **`DiagramTabsComponent`**: Barra de pestañas reactiva para conmutación fluida entre múltiples diagramas abiertos.
   - **`AutofocusInputDirective`**: Directiva de auto-enfoque y selección de texto para renombrado in-place sin retrasos visuales.
   - **`diagram-editor.icons.ts`**: Centralización de iconos HeroIcons organizados por propósito y optimizados para empaquetado mínimo.
   - **`shared-ui/` (Suite de Controles Reutilizables)**:
     - **`DiagramZoomControlsComponent`**: Controles de zoom unificados (`ZoomIn`, `ZoomOut`, `1:1`, `FitView`) con variantes `grid` (sidebar) y `flex` (toolbox).
     - **`DiagramLineRoutingSelectorComponent`**: Selector estandarizado de estilo de líneas (`segment`, `straight`, `bezier`, `adaptive-curve`) con enlaces a `UML_LINE_STYLES` e i18n reactivo.
     - **`DiagramRelationshipButtonComponent`**: Botón de relación UML estilizado con previsualización SVG reactiva y esquemas de color por diagrama (`blue`, `amber`, `cyan`, `rose`).
     - **`DiagramToolItemButtonComponent`**: Tarjeta reutilizable para entidades UML con soporte de proyección de iconos, drag-and-drop y badges de interacción.
     - **`DiagramToolSectionHeaderComponent`**: Encabezado colapsable para paneles de acordeón con soporte para deselección de puntero y chevrons dinámicos.

* **`ComponentSvgComponent`**: Componente visual standalone para la representación gráfica precisa de componentes UML conforme al estándar.
* **`DeploymentNodeSvgComponent`**: Componente visual standalone para nodos tridimensionales isométricos de despliegue (`node`, `device`, `executionEnvironment`).
* **`GroupingBoundaryComponent`**: Componente standalone para cajas de delimitación y agrupación de sistemas, capas y redes con etiquetas centradas superiores y jerarquía de contención reactiva.
* **`DiagramToolboxComponent`**: Barra de herramientas contextual que filtra automáticamente los elementos y relaciones válidas para el diagrama activo (Clases, Casos de Uso, Componentes, Capas, Despliegue, etc.) y admite arrastrar elementos directamente al lienzo.
* **`DiagramTreeExplorerComponent`**: Explorador jerárquico del proyecto organizado por carpetas con soporte para arrastrar elementos directamente al canvas.
* **`EditConnectionModalComponent`**: Modal flotante reactivo activado por doble clic sobre cualquier relación para editar nombres, multiplicidades ($0..1$, $1..*$, etc.), estereotipos y tipo de relación UML.
* **`UserGuideChatbotComponent`**: Manual de usuario interactivo global tipo chatbot con tour guiado en 7 etapas, búsqueda semántica en lenguaje natural, renderizado Markdown enriquecido, bloques con copia de comandos y carrusel de temas con scroll y flechas.
* **`AiAssistantPanelComponent`**: Asistente inteligente lateral con integración de cámara web para captura en vivo y prompts en lenguaje natural.
* **`SpringBootModalComponent`**: Modal de generación de código fullstack con explorador de archivos y visor de código en tiempo real para Java/Spring Boot y Dart/Flutter.
* **`DiagramAppbarComponent`**: Barra de herramientas superior con opciones de guardado, historial de versiones XMI, exportación a imagen PNG, control de colaboradores, botón de Manual Interactivo y estado de conexión en vivo.

---

## 🛠 Scripts Disponibles

| Script | Descripción |
| :--- | :--- |
| `npm start` | Inicia el servidor de desarrollo web local en `http://localhost:4200/`. |
| `npm run build` | Compila la aplicación web optimizada para producción en `dist/frontend`. |
| `npm run watch` | Compila y escucha cambios continuos en Angular en modo desarrollo. |
| `npm test` | Ejecuta las pruebas unitarias del proyecto con Vitest (82 pruebas unitarias, 100% pasando). |
| `npm run build:electron` | Compila la aplicación para Electron apuntando al backend local (`http://localhost:4000/api`). |
| `npm run build:electron:prod` | Compila la aplicación para Electron apuntando al backend de producción. |
| `npm run electron:start` | Compila y ejecuta la aplicación de escritorio nativa conectada a local. |
| `npm run electron:dev` | Abre Electron conectado a `http://localhost:4200` con DevTools para desarrollo en caliente. |
| `npm run electron:dev:nix` | Abre Electron en modo desarrollo en caliente directamente usando NixOS nix-shell. |
| `npm run electron:start:nix` | Compila y abre Electron local directamente usando NixOS nix-shell. |
| `npm run dist:linux` | Genera el binario ejecutable `AppImage` para Linux conectado al backend local. |
| `npm run dist:linux:prod` | Genera el binario `AppImage` para Linux conectado al backend de producción. |
| `npm run appimage:run` | Ejecuta el AppImage generado en `release/` usando `appimage-run` en NixOS. |
| `npm run dist:win` | Genera el instalador NSIS `.exe` y la versión portable para Windows en `release/`. |
| `npm run dist:mac` | Genera el instalador `.dmg` para macOS en `release/`. |
