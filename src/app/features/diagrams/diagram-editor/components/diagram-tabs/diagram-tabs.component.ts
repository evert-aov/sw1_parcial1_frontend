import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroPlus,
  heroXMark,
  heroArrowsPointingOut,
} from '@ng-icons/heroicons/outline';
import { DiagramType, UML_DIAGRAM_TYPES } from '../../../../../core/models/diagram.model';

export interface DiagramTab {
  id: string;
  name: string;
  type: DiagramType;
}

@Component({
  standalone: true,
  selector: 'app-diagram-tabs',
  imports: [CommonModule, NgIconComponent],
  viewProviders: [
    provideIcons({
      heroPlus,
      heroXMark,
      heroArrowsPointingOut,
    }),
  ],
  templateUrl: './diagram-tabs.component.html',
})
export class DiagramTabsComponent {
  @Input() tabs: DiagramTab[] = [];
  @Input() activeDiagramId: string | null = null;
  @Input() hasUnsavedChanges = false;
  @Input() currentDiagramName = '';

  @Output() selectTab = new EventEmitter<string>();
  @Output() closeTab = new EventEmitter<{ id: string; event: MouseEvent }>();
  @Output() createTab = new EventEmitter<void>();
  @Output() fitView = new EventEmitter<void>();

  /**
   * Obtiene la etiqueta abreviada del tipo de diagrama (ej. 'CD', 'UC', 'SD') para mostrar en la pestaña.
   * @param type Tipo de diagrama UML.
   * @returns Siglas o etiqueta corta.
   */
  getTabTypeShort(type: DiagramType): string {
    const found = UML_DIAGRAM_TYPES.find((d: { id: DiagramType; shortLabel: string }) => d.id === type);
    return found ? found.shortLabel : 'UML';
  }

  /**
   * Emite la selección de una pestaña para activar dicho diagrama en el editor.
   * @param id Identificador del diagrama de la pestaña.
   */
  onSelectTab(id: string): void {
    this.selectTab.emit(id);
  }

  /**
   * Emite la solicitud de cierre de una pestaña abierta.
   * @param id Identificador del diagrama a cerrar.
   * @param event Evento MouseEvent.
   */
  onCloseTab(id: string, event: MouseEvent): void {
    this.closeTab.emit({ id, event });
  }

  /**
   * Emite la acción para crear una nueva pestaña de diagrama en el editor.
   */
  onCreateTab(): void {
    this.createTab.emit();
  }

  /**
   * Emite la orden de encuadre visual completo (fit view) sobre el lienzo.
   */
  onFitView(): void {
    this.fitView.emit();
  }
}
