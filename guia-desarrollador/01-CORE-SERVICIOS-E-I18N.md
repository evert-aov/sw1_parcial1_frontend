# 01 - Core, Servicios e Internacionalización

## 1. Visión General
El directorio [`frontend/src/app/core/`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/src/app/core/) aloja los servicios singleton, modelos de datos, interceptores HTTP y el motor de internacionalización. Estos elementos tienen alcance global y dan soporte a todas las pantallas de la aplicación.

---

## 2. Sistema de Internacionalización Reactivo (i18n)

Implementado en [`frontend/src/app/core/i18n/`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/src/app/core/i18n/):

### 1. `TranslationService` (`src/app/core/i18n/services/translation.service.ts`)
- Mantiene el idioma actual mediante un Signal reactivo: `currentLang = signal<'es' | 'en'>('es')`.
- Almacena y lee la preferencia del usuario en `localStorage` (`app_language`).
- Soporta interpolación de variables dinámicas:
  ```typescript
  // Clave: 'editor.toolbox.paletteOf': 'Paleta de {{name}}'
  translationService.translate('editor.toolbox.paletteOf', { name: 'Casos de Uso' });
  // Retorna: 'Paleta de Casos de Uso'
  ```

### 2. `TranslatePipe` (`src/app/core/i18n/pipes/translate.pipe.ts`)
- Pipe puro con detección de cambios automática cuando cambia el signal de idioma:
  ```html
  <button>{{ 'toolbar.save' | translate }}</button>
  <span>{{ 'editor.paletteOf' | translate:{ name: diagramName() } }}</span>
  ```

### 3. Diccionarios de Idioma
- [`es.ts`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/src/app/core/i18n/translations/es.ts): Español (predeterminado).
- [`en.ts`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/src/app/core/i18n/translations/en.ts): Inglés completo.
- Cubren más de 400 términos de modelado UML, mensajes de error, botones, tooltips y menús contextuales.

---

## 3. Manejo de Temas (Dark / Light Mode)

Implementado en [`ThemeService`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/src/app/core/services/theme.service.ts):
- Signal reactivo `isDark = signal<boolean>(false)`.
- Sincroniza la clase `.dark` en el elemento raíz `<html>` del DOM.
- Escucha y responde a la preferencia del sistema operativo (`prefers-color-scheme: dark`) y persiste la selección manual en `localStorage` (`app_theme`).

---

## 4. Seguridad en el Cliente

### 1. `AuthGuard` (`src/app/core/guards/auth.guard.ts`)
- Protege las rutas `/projects` y `/projects/:id/editor`.
- Verifica si el usuario cuenta con un token JWT válido y no expirado en `localStorage`. Si no existe sesión, redirige inmediatamente a `/auth/login`.

### 2. `JwtInterceptor` (`src/app/core/interceptors/jwt.interceptor.ts`)
- Intercepta automáticamente todas las peticiones salientes de `HttpClient`.
- Inyecta la cabecera `Authorization: Bearer <token>` cuando la petición se dirige a la API del backend.
- Si el backend responde con un error `401 Unauthorized`, elimina el token caducado y redirige al login con notificación.

---

## 5. Servicios de Dominio Core

| Servicio | Archivo | Responsabilidad Principal |
| :--- | :--- | :--- |
| **`AuthService`** | `auth.service.ts` | Peticiones de login, registro, logout y actualización de perfil. |
| **`ProjectService`** | `project.service.ts` | CRUD de proyectos, invitación de miembros y cambio de roles. |
| **`DiagramService`** | `diagram.service.ts` | Peticiones REST de diagramas, carga de AST y versiones históricas. |
| **`CollaborationService`** | `collaboration.service.ts` | Conexión cliente WebSocket mediante `socket.io-client`. |
| **`BmpExportService`** | `bmp-export.service.ts` | Renderizado y rasterización del lienzo a imágenes de alta definición. |
| **`XmiService`** | `xmi.service.ts` | Envío y recepción de documentos XMI 2.1 con el backend. |
| **`CodeGeneratorService`** | `code-generator.service.ts` | Solicitud de vistas previas de código y descarga de microservicios ZIP. |
| **`AiAssistantService`** | `ai-assistant.service.ts` | Envío de prompts y capturas de cámara web a los endpoints de Gemini. |
| **`ConfirmDialogService`**| `confirm-dialog.service.ts` | Diálogos modales de confirmación desacoplados con Promesas. |
