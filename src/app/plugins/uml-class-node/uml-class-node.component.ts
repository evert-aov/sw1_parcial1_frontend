import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroLockClosed, heroTrash } from '@ng-icons/heroicons/outline';
import { UmlClassNode } from '../../core/models/diagram.model';
import { TranslatePipe } from '../../core/i18n/index';
import { AutofocusInputDirective } from '../../plugin-sdk/ui/autofocus-input.directive';

@Component({
  selector: 'app-uml-class-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, NgIconComponent, AutofocusInputDirective, TranslatePipe],
  providers: [provideIcons({ heroLockClosed, heroTrash })],
  templateUrl: './uml-class-node.component.html',
  host: {
    class: 'w-full h-full flex flex-col flex-1 min-h-0 min-w-0',
  },
})
export class UmlClassNodeComponent {
  readonly node = input.required<UmlClassNode>();
  readonly isSelected = input(false);
  readonly isNeighbor = input(false);
  readonly isLocked = input(false);
  readonly lockOwner = input<string | undefined>(undefined);
  readonly renamingNodeId = input<string | null>(null);

  readonly nodeClick = output<MouseEvent>();
  readonly deleteNode = output<MouseEvent>();
  readonly commitRename = output<string>();
  readonly cancelRename = output<void>();

  /**
   * Indica si este nodo de clase se encuentra actualmente en modo de renombrado en línea.
   */
  get isRenaming(): boolean {
    return this.renamingNodeId() === this.node()?.id;
  }

  /**
   * Maneja el clic en la cabecera de la clase y emite el evento de selección de nodo.
   * @param event Evento de ratón (MouseEvent).
   */
  onHeaderClick(event: MouseEvent): void {
    this.nodeClick.emit(event);
  }

  /**
   * Maneja la acción de eliminación del nodo emitiendo el evento correspondiente.
   * @param event Evento de ratón.
   */
  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.deleteNode.emit(event);
  }

  /**
   * Emite el nuevo nombre confirmado tras la edición en línea.
   * @param val Nombre resultante escrito por el usuario.
   */
  onCommit(val: string): void {
    this.commitRename.emit(val);
  }

  /**
   * Cancela la edición de nombre en línea sin aplicar cambios.
   */
  onCancel(): void {
    this.cancelRename.emit();
  }
}
