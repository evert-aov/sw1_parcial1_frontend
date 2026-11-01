import { PluginRegistryService } from '../../core/plugins/plugin-registry.service';
import { DiagramSequenceActivationService } from '../../core/plugins/contracts/diagram-sequence-activation.service.contract';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FFlowModule } from '@foblex/flow';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroTrash } from '@ng-icons/heroicons/outline';
import { DiagramType, UmlClassNode, UmlConnection } from '../../core/models/diagram.model';
import { TranslatePipe } from '../../core/i18n/index';
import { DiagramFloatingLabelComponent } from '../../plugin-sdk/ui/diagram-floating-label/diagram-floating-label.component';
import { UML_SVG_COMPONENTS } from '../../plugin-sdk/ui/uml-svg/index';

@Component({
  selector: 'app-uml-actor-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FFlowModule,
    NgIconComponent,
    TranslatePipe,
    DiagramFloatingLabelComponent,
    ...UML_SVG_COMPONENTS,
  ],
  providers: [provideIcons({ heroTrash })],
  templateUrl: './uml-actor-node.component.html',
  host: {
    class: 'w-full h-full flex flex-col flex-1 min-h-0 min-w-0',
  },
})
export class UmlActorNodeComponent {
  private readonly registry = inject(PluginRegistryService);
  /** Servicio de activación de secuencias resuelto desde el registro de plug-ins. */
  private get sequence(): DiagramSequenceActivationService | undefined {
    return this.registry.has(DiagramSequenceActivationService) ? this.registry.resolve(DiagramSequenceActivationService) : undefined;
  }
  readonly connections = input<UmlConnection[]>([]);
  readonly lifelineLength = computed(() => this.sequence?.getLifelineLength(this.node(), this.connections()) ?? 300);
  readonly activations = computed(() => this.sequence?.getNodeActivations(this.node(), this.connections(), this.activeDiagramType()) ?? []);
  readonly sequenceSlots = computed(() => this.sequence?.getSequenceSlots(this.connections()) ?? Array.from({ length: 25 }, (_, index) => index));
  readonly isSequenceSlotOccupiedFn = (slot: number): boolean => this.sequence?.isSequenceSlotOccupied(slot, this.connections(), this.activeDiagramType()) ?? false;
  readonly getSlotTopFn = (slot: number): number => 210 + slot * 50 - 60;

  readonly node = input.required<UmlClassNode>();
  readonly isSelected = input(false);
  readonly isLocked = input(false);
  readonly activeDiagramType = input<DiagramType>(DiagramType.CLASS);
  readonly selectedRelationType = input<string | null>(null);
  readonly renamingNodeId = input<string | null>(null);
  readonly isReadOnly = input(false);

  readonly nodeClick = output<MouseEvent>();
  readonly deleteNode = output<MouseEvent>();
  readonly tableClick = output<MouseEvent>();
  readonly labelDblClick = output<MouseEvent>();
  readonly commitRename = output<string>();
  readonly cancelRename = output<void>();

  /**
   * Maneja el clic sobre el contenedor visual del actor para emitir la selección.
   * @param event Evento de ratón.
   */
  onContainerClick(event: MouseEvent): void {
    this.nodeClick.emit(event);
  }

  /**
   * Maneja la eliminación del nodo actor emitiendo el evento de borrado.
   * @param event Evento de ratón.
   */
  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.deleteNode.emit(event);
  }

  /**
   * Maneja el clic sobre la capa del actor en diagramas que no son de secuencia.
   * @param event Evento de ratón.
   */
  onLayerClick(event: MouseEvent): void {
    if (this.activeDiagramType() !== 'sequence') {
      this.tableClick.emit(event);
    }
  }

  /**
   * Maneja el clic sobre un slot de activación temporal en diagramas de secuencia.
   * @param event Evento de ratón.
   */
  onSlotClick(event: MouseEvent): void {
    this.tableClick.emit(event);
  }
}
