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

  getTabTypeShort(type: DiagramType): string {
    const found = UML_DIAGRAM_TYPES.find((d: { id: DiagramType; shortLabel: string }) => d.id === type);
    return found ? found.shortLabel : 'UML';
  }

  onSelectTab(id: string): void {
    this.selectTab.emit(id);
  }

  onCloseTab(id: string, event: MouseEvent): void {
    this.closeTab.emit({ id, event });
  }

  onCreateTab(): void {
    this.createTab.emit();
  }

  onFitView(): void {
    this.fitView.emit();
  }
}
