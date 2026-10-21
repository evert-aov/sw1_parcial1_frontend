import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../../core/i18n/index';

export type ToolItemThemeColor =
  | 'amber'
  | 'sky'
  | 'blue'
  | 'indigo'
  | 'warm'
  | 'emerald'
  | 'cyan'
  | 'teal'
  | 'slate';

@Component({
  selector: 'app-diagram-tool-item-button',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './diagram-tool-item-button.component.html',
})
export class DiagramToolItemButtonComponent {
  @Input({ required: true }) label = '';
  @Input() description = '';
  @Input() disabled = false;
  @Input() draggable = false;
  @Input() dragType = '';
  @Input() title = '';
  @Input() themeColor: ToolItemThemeColor = 'blue';
  @Input() badgeText = '+';

  @Output() itemClick = new EventEmitter<MouseEvent>();
  @Output() itemDragStart = new EventEmitter<DragEvent>();

  /** Clases CSS de efecto hover según la variante de color configurada. */
  get buttonHoverClass(): string {
    switch (this.themeColor) {
      case 'amber':
        return 'hover:bg-amber-50/50 dark:hover:bg-[#151A32] hover:border-amber-300 dark:hover:border-amber-700';
      case 'sky':
        return 'hover:bg-sky-50/50 dark:hover:bg-[#151A32] hover:border-sky-300 dark:hover:border-sky-700';
      case 'indigo':
        return 'hover:bg-indigo-50/50 dark:hover:bg-[#151A32] hover:border-indigo-300 dark:hover:border-indigo-700';
      case 'warm':
        return 'hover:bg-orange-50/50 dark:hover:bg-[#151A32] hover:border-orange-300 dark:hover:border-orange-700';
      case 'emerald':
        return 'hover:bg-emerald-50/50 dark:hover:bg-[#151A32] hover:border-emerald-300 dark:hover:border-emerald-700';
      case 'cyan':
        return 'hover:bg-cyan-50/50 dark:hover:bg-[#151A32] hover:border-cyan-300 dark:hover:border-cyan-700';
      case 'teal':
        return 'hover:bg-teal-50/50 dark:hover:bg-[#151A32] hover:border-teal-300 dark:hover:border-teal-700';
      case 'slate':
        return 'hover:bg-slate-100/70 dark:hover:bg-[#151A32] hover:border-slate-300 dark:hover:border-slate-600';
      case 'blue':
      default:
        return 'hover:bg-blue-50/50 dark:hover:bg-[#151A32] hover:border-blue-300 dark:hover:border-blue-700';
    }
  }

  /** Clases CSS del contenedor de icono según el tema visual del ítem. */
  get iconContainerClass(): string {
    switch (this.themeColor) {
      case 'amber':
        return 'bg-[#FEF2DD] dark:bg-amber-950/60 border-amber-300/80 dark:border-amber-800/60 text-amber-800 dark:text-amber-300';
      case 'sky':
        return 'bg-[#E5F2FE] dark:bg-sky-950/60 border-sky-300/80 dark:border-sky-800/60 text-sky-700 dark:text-sky-300';
      case 'indigo':
        return 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300';
      case 'warm':
        return 'bg-[#FAF1EC] dark:bg-orange-950/40 border-[#D8C7B8] dark:border-orange-900/60 text-[#796354] dark:text-orange-300';
      case 'emerald':
        return 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300/80 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300';
      case 'cyan':
        return 'bg-cyan-50 dark:bg-cyan-950/60 border-cyan-300/80 dark:border-cyan-800/60 text-cyan-800 dark:text-cyan-300';
      case 'teal':
        return 'bg-teal-50 dark:bg-teal-950/60 border-teal-300/80 dark:border-teal-800/60 text-teal-800 dark:text-teal-300';
      case 'slate':
        return 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300';
      case 'blue':
      default:
        return 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300';
    }
  }

  /** Clases CSS de color para la insignia o texto secundario del botón. */
  get badgeClass(): string {
    switch (this.themeColor) {
      case 'amber':
        return 'text-amber-600 dark:text-amber-400';
      case 'sky':
        return 'text-sky-600 dark:text-sky-400';
      case 'indigo':
        return 'text-indigo-600 dark:text-indigo-400';
      case 'warm':
        return 'text-orange-600 dark:text-orange-400';
      case 'emerald':
        return 'text-emerald-600 dark:text-emerald-400';
      case 'cyan':
        return 'text-cyan-600 dark:text-cyan-400';
      case 'teal':
        return 'text-teal-600 dark:text-teal-400';
      case 'slate':
        return 'text-slate-500 dark:text-slate-400';
      case 'blue':
      default:
        return 'text-blue-600 dark:text-blue-400';
    }
  }

  /**
   * Emite el evento de clic sobre la herramienta si no está inhabilitada.
   * @param event Evento MouseEvent.
   */
  onClick(event: MouseEvent): void {
    if (this.disabled) return;
    this.itemClick.emit(event);
  }

  /**
   * Prepara los datos de arrastre para transferir el tipo de elemento hacia el lienzo.
   * @param event Evento DragEvent.
   */
  onDragStart(event: DragEvent): void {
    if (this.disabled) return;
    if (this.dragType && event.dataTransfer) {
      event.dataTransfer.setData('text/plain', this.dragType);
    }
    this.itemDragStart.emit(event);
  }
}
