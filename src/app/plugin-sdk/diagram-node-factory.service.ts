import { Injectable, inject } from '@angular/core';
import { UmlClassNode } from '../core/models/diagram.model';
import { NodeCreationContext } from '../core/plugins/node-plugin.contract';
import { NodePluginRegistryService } from '../core/plugins/node-plugin-registry.service';

export interface ScrollOffset {
  scrollLeft: number;
  scrollTop: number;
}

@Injectable({ providedIn: 'root' })
export class DiagramNodeFactoryService {
  private readonly registry = inject(NodePluginRegistryService);

  /**
   * Crea una nueva instancia de nodo delegando la construcción al plugin correspondiente al tipo solicitado.
   * @param type Tipo de nodo UML ('class', 'actor', 'component', etc.).
   * @param context Contexto de creación (posición, offset de scroll, tipo de diagrama, nombre base).
   * @returns Nuevo nodo UML inicializado.
   */
  create(type: string, context: NodeCreationContext): UmlClassNode {
    return this.registry.require(type).create(context);
  }
}
