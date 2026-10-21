import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroTrash } from '@ng-icons/heroicons/outline';
import { UmlClassNode } from '../../core/models/diagram.model';
import { TranslatePipe } from '../../core/i18n/index';
import { AutofocusInputDirective } from '../../plugin-sdk/ui/autofocus-input.directive';

@Component({
  selector: 'app-uml-use-case-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, NgIconComponent, AutofocusInputDirective, TranslatePipe],
  providers: [provideIcons({ heroTrash })],
  templateUrl: './uml-use-case-node.component.html',
  host: {
    class: 'w-full h-full flex flex-col flex-1 min-h-0 min-w-0',
  },
})
export class UmlUseCaseNodeComponent {
  readonly node = input.required<UmlClassNode>();
  readonly isSelected = input(false);
  readonly isLocked = input(false);
  readonly renamingNodeId = input<string | null>(null);

  readonly nodeClick = output<MouseEvent>();
  readonly deleteNode = output<MouseEvent>();
  readonly commitRename = output<string>();
  readonly cancelRename = output<void>();

  /**
   * Indica si el caso de uso se encuentra actualmente en edición de nombre en línea.
   */
  get isRenaming(): boolean {
    return this.renamingNodeId() === this.node()?.id;
  }

  /**
   * Maneja el clic en la elipse del caso de uso emitiendo el evento de selección.
   * @param event Evento de ratón.
   */
  onContainerClick(event: MouseEvent): void {
    this.nodeClick.emit(event);
  }

  /**
   * Maneja la eliminación del caso de uso.
   * @param event Evento de ratón.
   */
  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.deleteNode.emit(event);
  }

  /**
   * Confirma el nuevo nombre del caso de uso tras renombrar en línea.
   * @param val Nombre confirmado.
   */
  onCommit(val: string): void {
    this.commitRename.emit(val);
  }

  /**
   * Cancela el renombrado en línea.
   */
  onCancel(): void {
    this.cancelRename.emit();
  }
}
