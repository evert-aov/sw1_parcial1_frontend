import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroChevronDown, heroChevronRight } from '@ng-icons/heroicons/outline';

@Component({
  selector: 'app-diagram-tool-section-header',
  standalone: true,
  imports: [CommonModule, NgIconComponent],
  providers: [provideIcons({ heroChevronDown, heroChevronRight })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './diagram-tool-section-header.component.html',
})
export class DiagramToolSectionHeaderComponent {
  @Input({ required: true }) title = '';
  @Input() isOpen = true;
  @Input() icon = '';
  @Input() actionText = '';
  @Input() actionTitle = '';

  @Output() toggle = new EventEmitter<void>();
  @Output() actionClick = new EventEmitter<void>();

  /**
   * Emite la alternancia de colapso o apertura de la sección de herramientas.
   */
  onToggle(): void {
    this.toggle.emit();
  }

  /**
   * Emite la acción secundaria del encabezado (por ejemplo, 'Crear' o '+').
   * @param event Evento MouseEvent.
   */
  onActionClick(event: MouseEvent): void {
    event.stopPropagation();
    this.actionClick.emit();
  }
}
