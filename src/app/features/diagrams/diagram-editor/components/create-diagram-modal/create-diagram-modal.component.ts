import { Component, input, output, signal, effect, computed, inject } from '@angular/core';
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
import { TranslatePipe, TranslationService } from '../../../../../core/i18n/index';
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
  private readonly translationService = inject(TranslationService);

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
    this.translationService.currentLang();
    const type = this.activeType();
    const key = `editor.explorer.folders.${type}`;
    const translated = this.translationService.translate(key);
    return translated !== key ? translated : (this.targetTypeItem()?.folderName || 'Diagramas de Clases');
  });

  /**
   * Obtiene el nombre traducido del tipo de diagrama para las tarjetas de selección.
   * @param dt Ítem del tipo de diagrama.
   * @returns Etiqueta localizada.
   */
  getTypeLabel(dt: DiagramTypeItem | undefined): string {
    if (!dt) return '';
    this.translationService.currentLang();
    const key = `editor.createDiagramModal.types.${dt.id}.label`;
    const translated = this.translationService.translate(key);
    return translated !== key ? translated : dt.label;
  }

  /**
   * Obtiene la descripción traducida del tipo de diagrama seleccionado.
   * @param dt Ítem del tipo de diagrama.
   * @returns Descripción explicativa para la tarjeta.
   */
  getTypeDescription(dt: DiagramTypeItem | undefined): string {
    if (!dt) return '';
    this.translationService.currentLang();
    const key = `editor.createDiagramModal.types.${dt.id}.description`;
    const translated = this.translationService.translate(key);
    return translated !== key ? translated : dt.description;
  }

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

  /**
   * Cambia el tipo de diagrama seleccionado si no se encuentra bloqueado por la carpeta de origen.
   * @param type Tipo de diagrama UML a activar.
   */
  selectType(type: DiagramType): void {
    if (this.lockedType()) return; // Si está fijado por la carpeta, no se puede cambiar
    this.selectedType.set(type);
  }

  /**
   * Valida y emite la creación del nuevo diagrama con el nombre y tipo configurados.
   */
  onCreate(): void {
    const name = this.diagramName().trim();
    if (!name) return;

    this.create.emit({
      name,
      type: this.activeType(),
    });
    this.close.emit();
  }

  /**
   * Cierra el modal de creación de diagramas.
   */
  onClose(): void {
    this.close.emit();
  }
}
