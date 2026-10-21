import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroTrash } from '@ng-icons/heroicons/outline';
import { UmlClassNode } from '../../core/models/diagram.model';
import { TranslatePipe } from '../../core/i18n/index';
import { AutofocusInputDirective } from '../../plugin-sdk/ui/autofocus-input.directive';
import { UML_SVG_COMPONENTS } from '../../plugin-sdk/ui/uml-svg/index';

export interface DeploymentColors {
  top: string;
  right: string;
  front: string;
  border: string;
}

@Component({
  selector: 'app-uml-deployment-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    NgIconComponent,
    AutofocusInputDirective,
    TranslatePipe,
    ...UML_SVG_COMPONENTS,
  ],
  providers: [provideIcons({ heroTrash })],
  templateUrl: './uml-deployment-node.component.html',
  host: {
    class: 'w-full h-full flex flex-col flex-1 min-h-0 min-w-0 relative',
  },
})
export class UmlDeploymentNodeComponent {
  readonly node = input.required<UmlClassNode>();
  readonly isSelected = input(false);
  readonly isLocked = input(false);
  readonly renamingNodeId = input<string | null>(null);
  readonly nodeWidth = input(160);
  readonly nodeHeight = input(140);
  readonly frontWidth = input(146);
  readonly frontHeight = input(126);
  readonly depth = input(14);
  readonly colors = input<DeploymentColors>({
    top: '#EFE2D3',
    right: '#DFCBB7',
    front: '#FDFAF3',
    border: '#796354',
  });

  readonly nodeClick = output<MouseEvent>();
  readonly deleteNode = output<MouseEvent>();
  readonly commitRename = output<string>();
  readonly cancelRename = output<void>();

  /**
   * Indica si el nodo de despliegue se encuentra en modo de renombrado en línea.
   */
  get isRenaming(): boolean {
    return this.renamingNodeId() === this.node()?.id;
  }

  /**
   * Maneja el clic sobre el cubo tridimensional de despliegue emitiendo el evento de selección.
   * @param event Evento de ratón.
   */
  onContainerClick(event: MouseEvent): void {
    this.nodeClick.emit(event);
  }

  /**
   * Maneja la eliminación del nodo de despliegue.
   * @param event Evento de ratón.
   */
  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.deleteNode.emit(event);
  }

  /**
   * Confirma el nuevo nombre del nodo tras la edición en línea.
   * @param val Nombre resultante escrito por el usuario.
   */
  onCommit(val: string): void {
    this.commitRename.emit(val);
  }

  /**
   * Cancela la edición de nombre en línea.
   */
  onCancel(): void {
    this.cancelRename.emit();
  }
}
