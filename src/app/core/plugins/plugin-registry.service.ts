import { isNodePlugin } from './node-plugin.contract';
import {
  EnvironmentInjector,
  Injectable,
  InjectionToken,
  Type,
  computed,
  createEnvironmentInjector,
  inject,
  signal,
  OnDestroy,
} from '@angular/core';
import { EDITOR_PLUGINS, PluginDefinition } from './plugin.contract';

interface Registration {
  readonly definition: PluginDefinition;
  readonly injector: EnvironmentInjector;
  readonly instances: Map<InjectionToken<unknown>, unknown>;
}

/** Synchronous in-process microkernel registry. Registration is atomic; instances are lazy. */
@Injectable({ providedIn: 'root' })
export class PluginRegistryService implements OnDestroy {
  private readonly environment = inject(EnvironmentInjector);
  private readonly registrations = signal<ReadonlyMap<string, Registration>>(new Map());
  private readonly resolving = new Set<InjectionToken<unknown>>();
  readonly plugins = computed(() => [...this.registrations().values()].map((r) => r.definition));

  constructor() {
    for (const plugin of inject(EDITOR_PLUGINS)) this.register(plugin);
  }

  /**
   * Registra dinámicamente un plug-in en el microkernel, validando metadatos y duplicados de capacidades.
   * @param definition Definición completa del plug-in a registrar.
   */
  register(definition: PluginDefinition): void {
    const { id, apiVersion } = definition.metadata;
    if (!id.trim() || apiVersion !== 1) throw new Error(`Unsupported plug-in: ${id}`);
    if (this.registrations().has(id)) throw new Error(`Duplicate plug-in: ${id}`);
    const existing = new Set(
      this.plugins().flatMap((p) => p.capabilities?.map((c) => c.token) ?? []),
    );
    for (const capability of definition.capabilities ?? []) {
      if (existing.has(capability.token))
        throw new Error(`Duplicate capability: ${capability.token}`);
      existing.add(capability.token);
    }
    if (isNodePlugin(definition)) {
      const types = new Set(
        this.plugins()
          .filter(isNodePlugin)
          .flatMap((p) => [...p.nodeTypes]),
      );
      const aliases = new Set(
        this.plugins()
          .filter(isNodePlugin)
          .flatMap((p) => [...(p.stereotypeAliases ?? [])]),
      );
      for (const type of definition.nodeTypes) {
        if (!type.trim() || types.has(type))
          throw new Error(`Duplicate or empty node type: ${type}`);
        types.add(type);
      }
      for (const alias of definition.stereotypeAliases ?? []) {
        if (aliases.has(alias)) throw new Error(`Duplicate node stereotype: ${alias}`);
        aliases.add(alias);
      }
    }
    const injector = createEnvironmentInjector(definition.providers ?? [], this.environment, id);
    try {
      definition.activate?.(injector);
    } catch (error) {
      injector.destroy();
      throw error;
    }
    const next = new Map(this.registrations());
    next.set(id, { definition, injector, instances: new Map() });
    this.registrations.set(next);
  }

  /**
   * Desregistra un plug-in del microkernel por su identificador único y destruye su inyector.
   * @param id Identificador del plug-in a desregistrar.
   * @returns Verdadero si el plug-in existía y fue removido; falso en caso contrario.
   */
  unregister(id: string): boolean {
    const registration = this.registrations().get(id);
    if (!registration) return false;
    const next = new Map(this.registrations());
    next.delete(id);
    this.registrations.set(next);
    try {
      registration.definition.deactivate?.(registration.injector);
    } finally {
      registration.injector.destroy();
    }
    return true;
  }

  /**
   * Obtiene el inyector de entorno aislado perteneciente al plug-in indicado.
   * @param id Identificador del plug-in.
   * @returns El inyector de entorno o indefinido si no está registrado.
   */
  environmentFor(id: string): EnvironmentInjector | undefined {
    return this.registrations().get(id)?.injector;
  }

  /**
   * Busca la definición de un plug-in registrado por su ID.
   * @param id Identificador único del plug-in.
   * @returns La definición del plug-in o indefinido si no existe.
   */
  find(id: string): PluginDefinition | undefined {
    return this.registrations().get(id)?.definition;
  }

  /**
   * Descubre todos los plug-ins registrados que pertenezcan a una categoría específica.
   * @param category Categoría a consultar ('node' | 'tool' | 'domain').
   * @returns Lista de definiciones de plug-ins encontradas.
   */
  discover(category: PluginDefinition['metadata']['category']): readonly PluginDefinition[] {
    return this.plugins().filter((plugin) => plugin.metadata.category === category);
  }

  /**
   * Obtiene el tipo de componente Angular registrado por un plug-in en un slot visual determinado.
   * @param id Identificador del plug-in.
   * @param slot Nombre de la ranura visual (ej. 'modal', 'panel', 'launcher').
   * @returns Clase del componente o indefinido si no está registrado.
   */
  component(id: string, slot: string): Type<unknown> | undefined {
    return this.find(id)?.components?.[slot];
  }

  /**
   * Verifica si algún plug-in activo provee una capacidad correspondiente al token especificado.
   * @param token Token de inyección de la capacidad.
   * @returns Verdadero si la capacidad está disponible.
   */
  has<T>(token: InjectionToken<T>): boolean {
    return this.plugins().some((p) => p.capabilities?.some((c) => c.token === token));
  }

  /**
   * Resuelve de forma perezosa la instancia de una capacidad provista por los plug-ins registrados.
   * @param token Token de inyección de la capacidad solicitada.
   * @returns Instancia tipada de la capacidad resuelta.
   * @throws Error si ningún plug-in provee el token o si existe dependencia circular.
   */
  resolve<T>(token: InjectionToken<T>): T {
    for (const registration of this.registrations().values()) {
      const capability = registration.definition.capabilities?.find((c) => c.token === token);
      if (!capability) continue;
      if (registration.instances.has(token)) return registration.instances.get(token) as T;
      if (this.resolving.has(token)) throw new Error(`Circular plug-in capability: ${token}`);
      this.resolving.add(token);
      try {
        const instance = capability.create(registration.injector);
        registration.instances.set(token, instance);
        return instance as T;
      } finally {
        this.resolving.delete(token);
      }
    }
    throw new Error(`No plug-in provides ${token}`);
  }

  /**
   * Hook de ciclo de vida de Angular: desregistra y libera todos los plug-ins activos en orden inverso.
   */
  ngOnDestroy(): void {
    for (const id of [...this.registrations().keys()].reverse()) this.unregister(id);
  }
}
