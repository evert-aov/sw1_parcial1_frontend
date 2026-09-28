import { Component, input, output, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroSquare3Stack3d,
  heroUserGroup,
  heroArrowsUpDown,
  heroChatBubbleLeftRight,
  heroFolderOpen,
  heroFolder,
  heroLockClosed,
} from '@ng-icons/heroicons/outline';
import { TranslatePipe } from '../../../../../core/i18n';
import {
  DiagramType,
  UML_DIAGRAM_TYPES,
  DiagramTypeItem,
} from '../../../../../core/models/diagram.model';

@Component({
  selector: 'app-create-diagram-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent, TranslatePipe],
  providers: [
    provideIcons({
      heroSquare3Stack3d,
      heroUserGroup,
      heroArrowsUpDown,
      heroChatBubbleLeftRight,
      heroFolderOpen,
      heroFolder,
      heroLockClosed,
    }),
  ],
  templateUrl: './create-diagram-modal.component.html',
})
export class CreateDiagramModalComponent {
  readonly DiagramType = DiagramType;
  readonly diagramTypes = UML_DIAGRAM_TYPES;

  // Inputs
  readonly isOpen = input<boolean>(false);
  readonly lockedType = input<DiagramType | null>(null);
  readonly projectName = input<string>('');

  // Outputs
  readonly close = output<void>();
  readonly create = output<{ name: string; type: DiagramType }>();

  // State
  readonly diagramName = signal<string>('');
  readonly selectedType = signal<DiagramType>(DiagramType.CLASS);

  // Computados para el directorio de destino estricto
  readonly activeType = computed<DiagramType>(() => {
    return this.lockedType() || this.selectedType();
  });

  readonly targetTypeItem = computed<DiagramTypeItem | undefined>(() => {
    const type = this.activeType();
    return this.diagramTypes.find((dt) => dt.id === type);
  });

  readonly targetFolderName = computed<string>(() => {
    return this.targetTypeItem()?.folderName || 'Diagramas de Clases';
  });

  constructor() {
    effect(
      () => {
        if (this.isOpen()) {
          const locked = this.lockedType();
          if (locked) {
            this.selectedType.set(locked);
          } else {
            this.selectedType.set(DiagramType.CLASS);
          }
          this.diagramName.set('');
        }
      },
      { allowSignalWrites: true }
    );
  }

  selectType(type: DiagramType): void {
    if (this.lockedType()) return; // Si está fijado por la carpeta, no se puede cambiar
    this.selectedType.set(type);
  }

  onCreate(): void {
    const name = this.diagramName().trim();
    if (!name) return;

    this.create.emit({
      name,
      type: this.activeType(),
    });
    this.close.emit();
  }

  onClose(): void {
    this.close.emit();
  }
}
