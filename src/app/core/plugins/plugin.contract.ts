import { InjectionToken, Injector, Provider, Type } from '@angular/core';

/** The host understands capabilities and identifiers, never implementation classes. */
export interface PluginMetadata {
  readonly id: string;
  readonly version: string;
  readonly apiVersion: 1;
  readonly labelKey: string;
  readonly category: 'node' | 'tool' | 'domain';
}

export interface PluginCapability<T = unknown> {
  readonly token: InjectionToken<T>;
  readonly create: (injector: Injector) => T;
}

export interface PluginDefinition {
  readonly metadata: PluginMetadata;
  readonly providers?: Provider[];
  readonly capabilities?: readonly PluginCapability[];
  readonly components?: Readonly<Record<string, Type<unknown>>>;
  readonly activate?: (injector: Injector) => void;
  readonly deactivate?: (injector: Injector) => void;
}

export const EDITOR_PLUGINS = new InjectionToken<readonly PluginDefinition[]>('Editor plug-ins', {
  providedIn: 'root',
  factory: () => [],
});
