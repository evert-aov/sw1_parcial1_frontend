import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroTrash } from '@ng-icons/heroicons/outline';
import { UmlClassNode } from '../../core/models/diagram.model';
import { TranslatePipe } from '../../core/i18n/index';
import { AutofocusInputDirective } from '../../plugin-sdk/ui/autofocus-input.directive';
import { UML_SVG_COMPONENTS } from '../../plugin-sdk/ui/uml-svg/index';

@Component({
  selector: 'app-uml-component-node',
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
  templateUrl: './uml-component-node.component.html',
  host: {
    class: 'w-full h-full flex flex-col flex-1 min-h-0 min-w-0',
  },
})
export class UmlComponentNodeComponent {
  readonly node = input.required<UmlClassNode>();
  readonly isSelected = input(false);
  readonly isLocked = input(false);
  readonly renamingNodeId = input<string | null>(null);

  readonly nodeClick = output<MouseEvent>();
  readonly deleteNode = output<MouseEvent>();
  readonly commitRename = output<string>();
  readonly cancelRename = output<void>();

  /**
   * Indica si el componente UML se encuentra en modo de renombrado en línea.
   */
  get isRenaming(): boolean {
    return this.renamingNodeId() === this.node()?.id;
  }

  /**
   * Obtiene el color de fondo normalizado del componente según su estado o configuración por defecto.
   */
  get bgColor(): string {
    const c = this.node()?.color;
    if (!c || c === '#FFFDDD' || c === '#F8E5E5') return '#FAF1EC';
    return c;
  }

  /**
   * Maneja el clic en el contenedor del componente para seleccionarlo.
   * @param event Evento de ratón.
   */
  onContainerClick(event: MouseEvent): void {
    this.nodeClick.emit(event);
  }

  /**
   * Maneja la eliminación del componente UML.
   * @param event Evento de ratón.
   */
  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.deleteNode.emit(event);
  }

  /**
   * Confirma el nuevo nombre del componente tras la edición en línea.
   * @param val Nombre confirmado.
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
