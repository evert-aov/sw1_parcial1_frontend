# 🎨 UML/ER Collaborative Studio - Frontend

La arquitectura actual del editor y los pasos para crear plug-ins están en [Arquitectura microkernel](MICROKERNEL.md).
El [mapa de directorios y flujos](guia-desarrollador/07-MAPA-DE-DIRECTORIOS-Y-FLUJOS.md) explica las responsabilidades de cada carpeta con diagramas de apoyo.

Aplicación web moderna y reactiva construida con **Angular 22**, **Foblex Flow (`@foblex/flow`)** y **Tailwind CSS v4**. Ofrece un entorno integral para el modelado visual colaborativo de diagramas de clases UML, asistencia de Inteligencia Artificial en caliente (**Google Gemini**), interoperabilidad con **Enterprise Architect (XMI 2.1)** y previsualización interactiva de código generado para **Spring Boot** y **Flutter**.

> 📘 **Documentación Oficial para Desarrolladores**: Para consultar la arquitectura técnica detallada, el lienzo de nodos modulares, sincronización colaborativa y suite de componentes reutilizables, revisa la [**Guía Integral del Desarrollador del Frontend**](guia-desarrollador/README.md).

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

* **Soporte Multidiagrama UML 2.5 Completo (@foblex/flow & SVG)**:
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
  * **Arrastre Coordinado Nativo con `fNodeParentId`**: Las cajas vinculan dinámicamente sus nodos hijos mediante la directiva `fNodeParentId` de `@foblex/flow`, permitiendo desplazar la caja contenedora y arrastrar automáticamente todos los componentes y nodos contenidos de forma fluida.
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
* **Motor de Diagramación:** `@foblex/flow` v19 + `@foblex/2d`.
* **Renderizado SVG:** Componentes vectoriales personalizados para Actores, Jacobson Robustness (Boundary, Control, Entity), Activaciones y Marcadores UML.
* **Colaboración:** `socket.io-client`.
* **Estilos & Diseño:** Tailwind CSS v4 + Heroicons (`@ng-icons/heroicons`).
* **Formatos & Utilidades:** `fast-xml-parser` (XMI Parsing), `html-to-image` (Exportación PNG).
* **Pruebas:** Vitest.

---

## 🌐 Configuración de Conexión con Backend

Toda la configuración de conexión con el backend y websockets está **centralizada en un único lugar** mediante los entornos de Angular:

### 1. Modo Desarrollo (`DEV`)
Edita el archivo [`src/environments/environment.ts`](src/environments/environment.ts):

```typescript
export const environment = {
  production: false,
  // Configura aquí el host/puerto del backend para desarrollo
  apiUrl: 'http://localhost:4000/api',
  socketUrl: 'http://localhost:4000/collaboration',
};
```

### 2. Modo Producción (`PROD`)
Edita el archivo [`src/environments/environment.prod.ts`](src/environments/environment.prod.ts):

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
│   ├── app/
│   │   ├── app.config.ts          # Angular 22 zoneless y provideEditorPlugins()
│   │   ├── app.routes.ts          # Router con hash y guards
│   │   ├── core/
│   │   │   ├── plugins/           # Registro, outlet, contratos y tokens
│   │   │   ├── models/            # AST y UmlDiagramProject
│   │   │   ├── services/          # Sesión, HTTP base, colaboración y tema
│   │   │   └── i18n/              # Traducciones es/en
│   │   ├── composition/           # Catálogos concretos y pruebas de integración
│   │   ├── plugin-sdk/
│   │   │   ├── geometry/          # Layout compartido de conexiones
│   │   │   ├── ui/                # Controles, SVG y etiquetas flotantes
│   │   │   └── diagram-node-factory.service.ts
│   │   ├── plugins/
│   │   │   ├── uml-class-node/
│   │   │   ├── uml-actor-node/
│   │   │   ├── uml-use-case-node/
│   │   │   ├── uml-package-node/
│   │   │   ├── uml-robustness-node/
│   │   │   ├── uml-lifeline-node/
│   │   │   ├── uml-component-node/
│   │   │   ├── uml-deployment-node/
│   │   │   ├── uml-language/      # Reglas UML y sincronización de documentos
│   │   │   ├── document-io/       # JSON y coordinación de formatos
│   │   │   ├── xmi/
│   │   │   ├── image-export/
│   │   │   ├── bmp-encoder/
│   │   │   ├── code-generation/
│   │   │   ├── ai-assistant/
│   │   │   └── user-guide/
│   │   └── features/              # Auth, proyectos y host del editor
│   ├── environments/             # Desarrollo, producción y Electron
│   └── styles.css
├── guia-desarrollador/            # Guías de Angular 22 y microkernel
├── scripts/                      # Verificador AST y sus pruebas
├── MICROKERNEL.md
├── angular.json
├── main.js                       # Proceso principal de Electron
└── package.json
```

---

## 📋 Requisitos Previos

* **Node.js**: Compatible con los engines del Angular instalado. Angular CLI 22.1.6 declara `^22.22.3 || ^24.15.0 || >=26.0.0`.
* **npm**: `packageManager` declara `npm@11.19.0`. Este checkout no contiene lockfile.
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
> En NixOS, los binarios FHS estándar precompilados de Electron descargados por `npm` en `node_modules` no encuentran librerías dinámicas del sistema (`libnspr4.so`, `libnss3.so`, etc.). El proyecto ya incluye un [`shell.nix`](shell.nix) configurado para resolver esto automáticamente.

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
   Edita [`src/environments/environment.prod.ts`](src/environments/environment.prod.ts) con las URLs reales de tu API y WebSockets:
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

### Arquitectura microkernel

El Core System mantiene el host del editor, canvas genérico, motor espacial, viewport,
historial, selección y pestañas. Las extensiones aportan comportamiento mediante
`PluginDefinition`, `NodePlugin`, contratos de capacidades y `PluginRegistryService`.

- **Host**: `DiagramEditorComponent` coordina servicios y el canvas monta renderizadores
  mediante `PluginOutletDirective`, sin importar clases de nodos concretas.
- **Nodos**: 13 definiciones agrupadas en ocho paquetes `plugins/uml-*-node/`. Cada descriptor
  define fabricación, geometría, herramientas e inputs/outputs de su renderer standalone.
- **Reglas UML**: `plugins/uml-language/` contiene operaciones, portapapeles, activaciones,
  normalización, sincronización de documentos y editores de propiedades.
- **Herramientas**: JSON, XMI, imágenes, BMP, generación de código, IA y guía interactiva
  viven en sus propios paquetes. Colaboran mediante tokens, sin imports entre plug-ins.
- **SDK**: `plugin-sdk/` comparte factoría, geometría, SVG, etiquetas y controles de UI.
- **Composición**: `composition/` reúne las implementaciones y aloja sus pruebas de integración.

Los contratos están en `core/plugins/`; no dependen de componentes del host. La captura de
imágenes usa `DiagramExportCanvasTarget`, que restaura zoom y posición incluso ante fallos.
`UmlDiagramProject` pertenece a los modelos de Core. Guardar el documento no requiere IA,
XMI ni exportadores de imagen instalados.

La aplicación usa Angular 22 con Signals y detección zoneless. El catálogo actual se importa
estáticamente, aunque el registro permite altas/bajas en ejecución. No implica descarga remota
de código. Los componentes WebGL fueron eliminados; los nodos de despliegue usan SVG.

Consultar [MICROKERNEL.md](MICROKERNEL.md) y la [guía del desarrollador](guia-desarrollador/README.md)
para contratos, ciclo de vida y pasos de extensión. El verificador AST incluye specs,
reexportaciones, imports dinámicos con ruta literal y aliases TypeScript.

---

## 🛠 Scripts Disponibles

| Script | Descripción |
| :--- | :--- |
| `npm start` | Inicia el servidor de desarrollo web local en `http://localhost:4200/`. |
| `npm run build` | Compila la aplicación web optimizada para producción en `dist/frontend`. |
| `npm run watch` | Compila y escucha cambios continuos en Angular en modo desarrollo. |
| `npm test -- --watch=false` | Ejecuta controles de arquitectura y la suite Angular/Vitest completa. |
| `npm run check:architecture` | Comprueba los límites de dependencia mediante AST. |
| `npm run test:architecture` | Verifica casos permitidos y rechazados del analizador. |
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
