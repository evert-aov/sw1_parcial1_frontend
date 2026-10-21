import {
  ComponentRef,
  Directive,
  EnvironmentInjector,
  effect,
  inject,
  input,
  output,
  reflectComponentType,
  signal,
  Type,
  untracked,
  ViewContainerRef,
} from '@angular/core';

export interface PluginOutputEvent {
  name: string;
  value: unknown;
}

/** Keeps Angular's injector ancestry intact, including Foblex node connector ownership. */
@Directive({ selector: '[appPluginOutlet]', standalone: true })
export class PluginOutletDirective {
  readonly appPluginOutlet = input<Type<unknown> | null | undefined>();
  readonly pluginInputs = input<Record<string, unknown>>({});
  readonly pluginEnvironment = input<EnvironmentInjector | undefined>();
  readonly pluginEvent = output<PluginOutputEvent>();
  private readonly container = inject(ViewContainerRef);
  private readonly component = signal<ComponentRef<unknown> | null>(null);

  constructor() {
    effect((cleanup) => {
      const type = this.appPluginOutlet();
      const environmentInjector = this.pluginEnvironment();
      this.container.clear();
      this.component.set(null);
      if (!type) return;
      const ref = this.container.createComponent(type, { environmentInjector });
      this.applyInputs(ref, untracked(this.pluginInputs));
      this.component.set(ref);
      const subscriptions =
        reflectComponentType(type)?.outputs.map(({ propName, templateName }) => {
          const emitter = (ref.instance as Record<string, unknown>)[propName] as {
            subscribe?: (fn: (value: unknown) => void) => { unsubscribe(): void };
          };
          return emitter?.subscribe?.((value) =>
            this.pluginEvent.emit({ name: templateName, value }),
          );
        }) ?? [];
      cleanup(() => {
        subscriptions.forEach((s) => s?.unsubscribe());
        ref.destroy();
      });
    });
    effect(() => {
      const ref = this.component();
      const inputs = this.pluginInputs();
      if (ref) this.applyInputs(ref, inputs);
    });
  }

  /**
   * Aplica dinámicamente el conjunto de entradas (inputs) a la instancia del componente Angular.
   * @param ref Referencia del componente instanciado dinámicamente.
   * @param values Diccionario clave-valor con las entradas recibidas.
   */
  private applyInputs(ref: ComponentRef<unknown>, values: Record<string, unknown>): void {
    for (const input of reflectComponentType(ref.componentType)?.inputs ?? []) {
      if (Object.hasOwn(values, input.templateName))
        ref.setInput(input.templateName, values[input.templateName]);
    }
  }
}
