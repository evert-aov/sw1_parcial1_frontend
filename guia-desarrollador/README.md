# Guía del desarrollador — Angular 22 y arquitectura microkernel

El frontend de UML Collaborative Studio usa Angular 22 standalone, Signals, detección
zoneless, Tailwind CSS v4 y Foblex Flow. El editor se organiza como un **microkernel**:
el host mantiene la infraestructura del lienzo y los plug-ins aportan nodos, semántica UML
y herramientas. Puede ejecutarse en navegador o en Electron.

La referencia de límites y ciclo de vida es [MICROKERNEL.md](../MICROKERNEL.md).
Las versiones y comandos se obtienen de [package.json](../package.json), los paquetes instalados y [angular.json](../angular.json).

## Contenido

| Capítulo | Tema |
| --- | --- |
| [00 — Arquitectura y configuración](00-ARQUITECTURA-Y-CONFIGURACION.md) | Capas, dependencias, entornos, Angular 22 y comandos. |
| [01 — Core, servicios e i18n](01-CORE-SERVICIOS-E-I18N.md) | Contratos, registro, modelos compartidos, autenticación y traducciones. |
| [02 — Editor de diagramas](02-ARQUITECTURA-DEL-EDITOR-DE-DIAGRAMAS.md) | Host, estado, motor espacial y delegación de capacidades. |
| [03 — Lienzo y nodos](03-LIENZO-Y-NODOS-MODULARES.md) | NodePlugin, renderizado dinámico, geometría y conectores Foblex. |
| [04 — Colaboración](04-COLABORACION-TIEMPO-REAL-Y-WEBSOCKETS.md) | Sesión de diagrama, cursores, bloqueos y reconexión. |
| [05 — UI compartida](05-SUITE-UI-REUTILIZABLE-Y-ESTILOS.md) | SDK, controles, SVG, Signals, temas e i18n. |
| [06 — Herramientas](06-EXPORTACION-XMI-CODEGEN-E-IA.md) | Documentos, XMI, imágenes, BMP, código, IA y guía interactiva. |
| [07 — Mapa de directorios y flujos](07-MAPA-DE-DIRECTORIOS-Y-FLUJOS.md) | Responsabilidades de todas las áreas y cuatro diagramas de funcionamiento. |

## Inicio rápido

Desde la raíz del frontend:

```sh
npm install
npm start
```

El servidor web usa `http://localhost:4200`. En desarrollo, la API usa
`http://localhost:4000/api` y Socket.IO `http://localhost:4000/collaboration`.
La configuración está en [src/environments/](../src/environments/).

Usar una versión de Node admitida por el Angular instalado. En la revisión actual,
Angular CLI 22.1.6 declara `^22.22.3 || ^24.15.0 || >=26.0.0`; no basta con cualquier Node 22.
`packageManager` declara npm 11.19.0. Volver a comprobar estos datos al cambiar dependencias.

Para escritorio, `npm run electron:start` compila y abre Electron con el backend local.
Para desarrollo con recarga, ejecutar `npm start` y, en otra terminal, `npm run electron:dev`.
Los comandos de empaquetado por plataforma están en el [README principal](../README.md).

## Verificación

```sh
npm run test:architecture
npm run check:architecture
npm test -- --watch=false
npm run build
```

`pretest` ejecuta las pruebas del verificador y el análisis de límites antes de Vitest.
`prebuild` ejecuta el análisis antes de compilar. No usar un número histórico de tests como
criterio de éxito: debe pasar la suite completa vigente y la compilación no debe tener errores.
Reportar por separado las advertencias; existe una de presupuesto CSS del lienzo.

## Reglas de contribución

- Componentes standalone con OnPush; estado con Signals y nuevos inputs/outputs funcionales.
- Nuevos tipos de nodo en `src/app/plugins/`, registrados desde `src/app/composition/`.
- Ninguna importación entre paquetes de plug-ins; compartir contratos o utilidades del SDK.
- Core, SDK y plug-ins no importan `features/`; los contratos no exponen componentes concretos.
- Textos visibles nuevos en ambos diccionarios, `es.ts` y `en.ts`.
- Mantener el AST y los identificadores persistidos. Eliminar directorios vacíos tras mover archivos.

## Chat grupal con IA

El incremento de conversación persistente, FastAPI y Qwen 14B se documenta en
[Chat grupal: arquitectura, operación y reporte](../docs/chat-grupal/README.md).

La configuración de los proveedores y MongoDB reside en `ia/.env`. NestJS solo conserva
la URL y el token del puente interno; FastAPI no lee `backend/.env` ni comparte el secreto JWT.

La documentación por servicio está en la [guía del backend NestJS](../../backend/guia-desarrollador/README.md)
y la [guía del microservicio FastAPI](../../ia/guia-desarrollador/README.md). Incluyen contratos,
persistencia, recuperación de propuestas y diagramas de flujo de la integración.

La entrega inmediata del chat, la voz fija de Kanon y los subtítulos alineados se describen en
[Kanon: sincronización y reporte](../../ia/docs/kanon-realtime/README.md).
