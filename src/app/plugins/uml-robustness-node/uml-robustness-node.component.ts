import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroTrash } from '@ng-icons/heroicons/outline';
import { UmlClassNode } from '../../core/models/diagram.model';
import { TranslatePipe } from '../../core/i18n/index';
import { DiagramFloatingLabelComponent } from '../../plugin-sdk/ui/diagram-floating-label/diagram-floating-label.component';
import { UML_SVG_COMPONENTS } from '../../plugin-sdk/ui/uml-svg/index';

@Component({
  selector: 'app-uml-robustness-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    NgIconComponent,
    TranslatePipe,
    DiagramFloatingLabelComponent,
    ...UML_SVG_COMPONENTS,
  ],
  providers: [provideIcons({ heroTrash })],
  templateUrl: './uml-robustness-node.component.html',
  host: {
    class: 'w-full h-full flex flex-col flex-1 min-h-0 min-w-0',
  },
})
export class UmlRobustnessNodeComponent {
  readonly node = input.required<UmlClassNode>();
  readonly isSelected = input(false);
  readonly isLocked = input(false);
  readonly renamingNodeId = input<string | null>(null);
  readonly isReadOnly = input(false);

  readonly nodeClick = output<MouseEvent>();
  readonly deleteNode = output<MouseEvent>();
  readonly labelDblClick = output<MouseEvent>();
  readonly commitRename = output<string>();
  readonly cancelRename = output<void>();

  /**
   * Determina el color de acento de robustez (boundary, control o entity).
   */
  get accentColor(): 'cyan' | 'teal' | 'emerald' {
    if (this.node()?.nodeType === 'boundary') return 'cyan';
    if (this.node()?.nodeType === 'control') return 'teal';
    return 'emerald';
  }

  /**
   * Resuelve las clases CSS del anillo de selección y brillo según el tipo de nodo de robustez.
   */
  get ringClass(): string {
    if (!this.isSelected()) return 'hover:bg-slate-100/40';
    if (this.node()?.nodeType === 'boundary') return 'ring-2 ring-cyan-600 shadow-[0_0_12px_rgba(8,145,178,0.35)]';
    if (this.node()?.nodeType === 'control') return 'ring-2 ring-teal-600 shadow-[0_0_12px_rgba(13,148,136,0.35)]';
    return 'ring-2 ring-emerald-600 shadow-[0_0_12px_rgba(5,150,105,0.35)]';
  }

  /**
   * Obtiene la clave de traducción para el tooltip del botón de eliminación según la semántica del nodo.
   */
  get deleteTitle(): string {
    if (this.node()?.nodeType === 'boundary') return 'editor.canvas.nodes.deleteBoundary';
    if (this.node()?.nodeType === 'control') return 'editor.canvas.nodes.deleteControl';
    return 'editor.canvas.nodes.deleteEntity';
  }

  /**
   * Maneja el clic en el contenedor del nodo de robustez para emitir selección.
   * @param event Evento de ratón.
   */
  onContainerClick(event: MouseEvent): void {
    this.nodeClick.emit(event);
  }

  /**
   * Maneja la eliminación del nodo de robustez.
   * @param event Evento de ratón.
   */
  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.deleteNode.emit(event);
  }
}
