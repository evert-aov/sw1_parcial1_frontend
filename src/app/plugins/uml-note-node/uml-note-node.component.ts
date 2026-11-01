import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroChatBubbleBottomCenterText, heroTrash } from '@ng-icons/heroicons/outline';
import { UmlClassNode } from '../../core/models/diagram.model';
import { TranslatePipe } from '../../core/i18n/index';

/**
 * Renderizador de Nota Flotante colaborativa en el lienzo Foblex.
 * Permite documentar acuerdos y recordatorios visuales sin afectar la generación de código.
 */
@Component({
  selector: 'app-uml-note-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, NgIconComponent, TranslatePipe],
  providers: [provideIcons({ heroTrash, heroChatBubbleBottomCenterText })],
  templateUrl: './uml-note-node.component.html',
  host: {
    class: 'w-full h-full flex flex-col flex-1 min-h-0 min-w-0',
  },
})
export class UmlNoteNodeComponent {
  readonly node = input.required<UmlClassNode>();
  readonly isSelected = input(false);
  readonly isLocked = input(false);
  readonly renamingNodeId = input<string | null>(null);

  readonly nodeClick = output<MouseEvent>();
  readonly deleteNode = output<MouseEvent>();
  readonly commitRename = output<string>();
  readonly cancelRename = output<void>();

  /** Indica si la nota se encuentra actualmente en edición rápida en línea. */
  get isRenaming(): boolean {
    return this.renamingNodeId() === this.node()?.id;
  }

  /** Selecciona la nota flotante al hacer clic sobre su tarjeta. */
  onContainerClick(event: MouseEvent): void {
    this.nodeClick.emit(event);
  }

  /** Solicita la eliminación de la nota flotante sin propagar el clic al lienzo. */
  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.deleteNode.emit(event);
  }

  /** Gestiona Enter (guardar) y Escape (cancelar) permitiendo saltos de línea con Shift+Enter. */
  onTextareaKeyDown(event: KeyboardEvent, value: string): void {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelRename.emit();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.commitRename.emit(value);
    }
  }

  /** Confirma el texto editado al perder el foco del área de texto. */
  onCommit(value: string): void {
    this.commitRename.emit(value);
  }

  /** Determina si la nota tiene tono morado (usada por sugerencias de Kanon o marcas violetas). */
  isPurpleNote(): boolean {
    const c = (this.node()?.color || '').toLowerCase();
    return c === '#f3e8ff' || c === '#e9d5ff' || c === '#c084fc' || c === '#a855f7' || c.includes('purple');
  }
}
