import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroTrash } from '@ng-icons/heroicons/outline';
import { UmlClassNode } from '../../core/models/diagram.model';
import { TranslatePipe } from '../../core/i18n/index';
import { AutofocusInputDirective } from '../../plugin-sdk/ui/autofocus-input.directive';

@Component({
  selector: 'app-uml-package-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, NgIconComponent, AutofocusInputDirective, TranslatePipe],
  providers: [provideIcons({ heroTrash })],
  templateUrl: './uml-package-node.component.html',
  host: {
    class: 'w-full h-full flex flex-col flex-1 min-h-0 min-w-0',
  },
})
export class UmlPackageNodeComponent {
  readonly node = input.required<UmlClassNode>();
  readonly isSelected = input(false);
  readonly isLocked = input(false);
  readonly renamingNodeId = input<string | null>(null);
  readonly packageTabTitle = input('');
  readonly packageBodyText = input('');

  readonly nodeClick = output<MouseEvent>();
  readonly deleteNode = output<MouseEvent>();
  readonly commitRename = output<string>();
  readonly cancelRename = output<void>();

  /**
   * Indica si el paquete se encuentra actualmente en edición de nombre en línea.
   */
  get isRenaming(): boolean {
    return this.renamingNodeId() === this.node()?.id;
  }

  /**
   * Determina si el nodo actúa como recuadro contenedor (boundary_box) en vez de paquete formal.
   */
  get isBoundaryBox(): boolean {
    return (
      this.node()?.nodeType === 'boundary_box' ||
      this.node()?.stereotype === 'boundary' ||
      this.node()?.stereotype === 'boundary_box'
    );
  }

  /**
   * Maneja el clic en el contenedor del paquete o recuadro para seleccionar el elemento.
   * @param event Evento de ratón.
   */
  onContainerClick(event: MouseEvent): void {
    this.nodeClick.emit(event);
  }

  /**
   * Maneja la eliminación del paquete o recuadro emitiendo el evento de borrado.
   * @param event Evento de ratón.
   */
  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.deleteNode.emit(event);
  }

  /**
   * Confirma el nuevo nombre del paquete tras la edición en línea.
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
