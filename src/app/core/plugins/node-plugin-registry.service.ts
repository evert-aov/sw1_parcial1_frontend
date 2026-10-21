import { Injectable, computed, inject } from '@angular/core';
import { UmlClassNode } from '../models/diagram.model';
import { isNodePlugin, NodePlugin } from './node-plugin.contract';
import { PluginRegistryService } from './plugin-registry.service';

@Injectable({ providedIn: 'root' })
export class NodePluginRegistryService {
  private readonly registry = inject(PluginRegistryService);
  readonly plugins = computed(() => this.registry.plugins().filter(isNodePlugin));
  private readonly byType = computed(() => {
    const types = new Map<string, NodePlugin>();
    for (const plugin of this.plugins())
      for (const type of plugin.nodeTypes) {
        if (types.has(type)) throw new Error(`Duplicate node type: ${type}`);
        types.set(type, plugin);
      }
    return types;
  });
  /**
   * Obtiene el inyector de entorno Angular correspondiente al plug-in del nodo dado.
   * @param node Información básica del nodo (nodeType y stereotype).
   * @returns El inyector de entorno o indefinido si no se encuentra el plug-in.
   */
  environmentFor(node: Pick<UmlClassNode, 'nodeType' | 'stereotype'>) {
    const plugin = this.forNode(node);
    return plugin ? this.registry.environmentFor(plugin.metadata.id) : undefined;
  }

  /**
   * Busca un plug-in de nodo registrado por su tipo UML exacto.
   * @param type Tipo de nodo UML (ej. 'class', 'actor', 'use_case').
   * @returns La definición del plug-in de nodo o indefinido.
   */
  find(type: string): NodePlugin | undefined {
    return this.byType().get(type);
  }

  /**
   * Resuelve el plug-in de nodo adecuado evaluando primero alias de estereotipo y luego el tipo de nodo.
   * @param node Nodo con nodeType y stereotype opcional.
   * @returns El plug-in correspondiente o indefinido.
   */
  forNode(node: Pick<UmlClassNode, 'nodeType' | 'stereotype'>): NodePlugin | undefined {
    return (
      this.plugins().find((p) => p.stereotypeAliases?.includes(node.stereotype ?? '')) ??
      this.find(node.nodeType || 'class')
    );
  }

  /**
   * Obtiene obligatoriamente el plug-in de nodo para el tipo solicitado, lanzando un error si no existe.
   * @param type Tipo de nodo solicitado.
   * @returns El plug-in de nodo registrado.
   * @throws Error si el tipo de nodo no está registrado.
   */
  require(type: string): NodePlugin {
    const plugin = this.find(type);
    if (!plugin) throw new Error(`Unknown node type: ${type}`);
    return plugin;
  }
}
