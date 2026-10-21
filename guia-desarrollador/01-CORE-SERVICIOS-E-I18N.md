# 01 — Core, contratos, servicios e internacionalización

## Registro y contratos

[core/plugins/](../src/app/core/plugins/) contiene la infraestructura estable:

| Elemento | Función |
| --- | --- |
| `PluginDefinition` | Metadatos, providers, capacidades, slots visuales y hooks de ciclo de vida. |
| `PluginRegistryService` | Registro, descubrimiento e instanciación diferida de capacidades. |
| `NodePlugin` | Contrato de creación, renderizado, herramientas y geometría de nodos. |
| `NodePluginRegistryService` | Búsqueda por tipo/estereotipo y acceso al injector de cada nodo. |
| `PluginOutletDirective` | Instancia componentes y conecta sus inputs/outputs dinámicamente. |

Las capacidades se definen como interfaces e `InjectionToken<T>` en
[core/plugins/contracts/](../src/app/core/plugins/contracts/). Sus factories resuelven la
implementación mediante `PluginRegistryService.resolve(token)`. El registro verifica colisiones,
crea un `EnvironmentInjector` por plug-in y destruye sus providers al retirarlo.

Los contratos solo describen lo que consume el host o un plug-in. No deben importar
componentes de `features/` ni implementaciones de `plugins/`. Por ejemplo,
`DiagramExportCanvasTarget` ofrece `clearSelection()`, `getExportElement()` y
`prepareForExport()`, que devuelve una función para restaurar el viewport.

Los documentos JSON comparten `UmlDiagramProject`, definido en
[diagram.model.ts](../src/app/core/models/diagram.model.ts), junto a los modelos del AST.
No importar modelos desde un componente del editor.

## Infraestructura de aplicación

[core/services/](../src/app/core/services/) mantiene autenticación, proyectos, diagramas,
colaboración, temas, toasts y confirmaciones. Los clientes de IA, XMI, generación de código,
exportación gráfica y guía interactiva pertenecen a sus plug-ins; sus contratos públicos
permanecen en Core.

`authGuard` consulta `AuthService.isAuthenticated()` y redirige a `/login` cuando no hay sesión.
`jwtInterceptor` agrega `Authorization: Bearer ...` si existe token. La autorización efectiva
corresponde al backend; no asumir validaciones o recuperación de errores que el interceptor
actual no implementa.

## Internacionalización

[TranslationService](../src/app/core/i18n/services/translation.service.ts) expone
`currentLang`, `setLanguage()`, `translate()` y `t()`. Persiste la preferencia bajo `app_lang`,
actualiza `html.lang` y usa español como fallback. Admite parámetros `{{nombre}}`.

[TranslatePipe](../src/app/core/i18n/pipes/translate.pipe.ts) es standalone y **`pure: false`**;
consulta el Signal del idioma. Los componentes que lo usan deben importarlo.

```html
<button>{{ 'auth.login.title' | translate }}</button>
```

Registrar toda clave nueva en ambos archivos:

- [es.ts](../src/app/core/i18n/translations/es.ts).
- [en.ts](../src/app/core/i18n/translations/en.ts).

Los descriptores de plug-in usan `metadata.labelKey` y `tools[].labelKey`; no almacenan
etiquetas de UI traducidas de forma fija. Para notificaciones construidas en TypeScript,
usar `TranslationService`. La regla aplica al texto nuevo; no implica que todo el legado
ya haya sido traducido.

## Tema y reactividad

[ThemeService](../src/app/core/services/theme.service.ts) centraliza el tema y la clase `dark`.
Reutilizarlo desde host y extensiones. El modo zoneless se configura en `app.config.ts`;
actualizar Signals o usar `markForCheck()` cuando un callback cambie datos visibles.
Los servicios de infraestructura compartidos no deben depender de la presencia de una
herramienta opcional como el asistente IA.
