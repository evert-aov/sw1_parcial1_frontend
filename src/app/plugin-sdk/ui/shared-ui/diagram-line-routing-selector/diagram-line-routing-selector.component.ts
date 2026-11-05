import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroArrowPath } from '@ng-icons/heroicons/outline';
import { TranslationService, TranslatePipe } from '../../../../core/i18n/index';
import { UmlLineStyle, UML_LINE_STYLES, UmlLineStyleItem } from '../../../../core/models/diagram.model';

@Component({
  selector: 'app-diagram-line-routing-selector',
  standalone: true,
  imports: [CommonModule, TranslatePipe, NgIconComponent],
  viewProviders: [
    provideIcons({
      heroArrowPath,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './diagram-line-routing-selector.component.html',
})
export class DiagramLineRoutingSelectorComponent {
  private readonly i18n = inject(TranslationService);
  readonly lineStyles: UmlLineStyleItem[] = UML_LINE_STYLES;

  @Input() selectedStyle: UmlLineStyle = 'orthogonal_square';
  @Output() styleChange = new EventEmitter<UmlLineStyle>();
  @Output() applyToAll = new EventEmitter<UmlLineStyle>();

  /**
   * Obtiene el nombre traducido del estilo de trazado para las opciones del selector.
   * @param styleId Identificador del estilo de línea.
   * @param fallback Texto alternativo por defecto.
   * @returns Nombre localizado del estilo.
   */
  getLineStyleLabel(styleId: string, fallback: string): string {
    const toolboxKey = `editor.toolbox.${styleId}`;
    const translatedToolbox = this.i18n.translate(toolboxKey);
    if (translatedToolbox !== toolboxKey) return translatedToolbox;

    const sidebarKey = `editor.sidebar.${styleId}`;
    const translatedSidebar = this.i18n.translate(sidebarKey);
    return translatedSidebar !== sidebarKey ? translatedSidebar : fallback;
  }

  /**
   * Emite el cambio en el estilo de trazado seleccionado al modificarse el dropdown
   * y aplica el cambio a todas las conexiones del diagrama.
   * @param event Evento change del elemento select.
   */
  onChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    if (select && select.value) {
      const style = select.value as UmlLineStyle;
      this.selectedStyle = style;
      this.styleChange.emit(style);
      this.applyToAll.emit(style);
    }
  }

  /**
   * Fuerza la aplicación del estilo actualmente seleccionado a todas las líneas del diagrama.
   */
  onApplyToAll(): void {
    this.applyToAll.emit(this.selectedStyle);
  }
}
