import { PluginRegistryService } from '../../core/plugins/plugin-registry.service';
import { DiagramSequenceActivationService } from '../../core/plugins/contracts/diagram-sequence-activation.service.contract';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FFlowModule } from '@foblex/flow';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroTrash } from '@ng-icons/heroicons/outline';
import { DiagramType, UmlClassNode, UmlConnection } from '../../core/models/diagram.model';
import { TranslatePipe } from '../../core/i18n/index';
import { AutofocusInputDirective } from '../../plugin-sdk/ui/autofocus-input.directive';

@Component({
  selector: 'app-uml-lifeline-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FFlowModule, NgIconComponent, AutofocusInputDirective, TranslatePipe],
  providers: [provideIcons({ heroTrash })],
  templateUrl: './uml-lifeline-node.component.html',
  host: {
    class: 'w-full h-full flex flex-col flex-1 min-h-0 min-w-0',
  },
})
export class UmlLifelineNodeComponent {
  private readonly registry = inject(PluginRegistryService);
  /** Capacidad de cálculo de secuencias y activaciones resuelta desde el microkernel. */
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

  readonly nodeClick = output<MouseEvent>();
  readonly deleteNode = output<MouseEvent>();
  readonly tableClick = output<MouseEvent>();
  readonly commitRename = output<string>();
  readonly cancelRename = output<void>();

  /**
   * Indica si la línea de vida se encuentra en proceso de renombrado en línea.
   */
  get isRenaming(): boolean {
    return this.renamingNodeId() === this.node()?.id;
  }

  /**
   * Maneja el clic sobre el encabezado de la línea de vida para seleccionarla.
   * @param event Evento de ratón.
   */
  onContainerClick(event: MouseEvent): void {
    this.nodeClick.emit(event);
  }

  /**
   * Maneja la eliminación de la línea de vida.
   * @param event Evento de ratón.
   */
  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.deleteNode.emit(event);
  }

  /**
   * Maneja el clic en capas secundarias en tipos de diagrama compatibles.
   * @param event Evento de ratón.
   */
  onLayerClick(event: MouseEvent): void {
    if (this.activeDiagramType() !== 'sequence') {
      this.tableClick.emit(event);
    }
  }

  /**
   * Maneja la interacción sobre un slot de activación temporal en la línea de vida.
   * @param event Evento de ratón.
   */
  onSlotClick(event: MouseEvent): void {
    this.tableClick.emit(event);
  }
}
