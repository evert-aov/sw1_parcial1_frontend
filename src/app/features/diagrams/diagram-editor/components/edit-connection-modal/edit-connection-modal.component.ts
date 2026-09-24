import { Component, input, output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroArrowsRightLeft, heroTrash } from '@ng-icons/heroicons/outline';
import { TranslatePipe } from '../../../../../core/i18n';
import {
  UmlConnection,
  UmlRelationTypeItem,
  UmlLineStyleItem,
  UML_RELATION_TYPES,
  UML_LINE_STYLES,
  UML_MULTIPLICITY_OPTIONS,
} from '../../../../../core/models/diagram.model';

@Component({
  selector: 'app-edit-connection-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent, TranslatePipe],
  providers: [
    provideIcons({
      heroArrowsRightLeft,
      heroTrash,
    }),
  ],
  templateUrl: './edit-connection-modal.component.html',
})
export class EditConnectionModalComponent {
  readonly isOpen = input<boolean>(false);
  readonly connection = input<UmlConnection | null>(null);
  readonly relationTypes = input<UmlRelationTypeItem[]>(UML_RELATION_TYPES);
  readonly lineStyles = input<UmlLineStyleItem[]>(UML_LINE_STYLES);
  readonly multiplicityOptions = input<string[]>(UML_MULTIPLICITY_OPTIONS);

  readonly close = output<void>();
  readonly save = output<UmlConnection>();
  readonly delete = output<string>();
  readonly swapDirection = output<void>();

  readonly editingConnection = signal<UmlConnection | null>(null);

  constructor() {
    effect(
      () => {
        const c = this.connection();
        if (c && this.isOpen()) {
          this.editingConnection.set(JSON.parse(JSON.stringify(c)));
        } else if (!this.isOpen()) {
          this.editingConnection.set(null);
        }
      },
      { allowSignalWrites: true }
    );
  }

  onSwapDirection(): void {
    const conn = this.editingConnection();
    if (!conn) return;
    const tempSource = conn.sourceId;
    conn.sourceId = conn.targetId;
    conn.targetId = tempSource;
    const tempMultiplicity = conn.sourceMultiplicity;
    conn.sourceMultiplicity = conn.targetMultiplicity;
    conn.targetMultiplicity = tempMultiplicity;
    this.editingConnection.set({ ...conn });
    this.swapDirection.emit();
  }

  onSave(): void {
    const conn = this.editingConnection();
    if (!conn) return;
    this.save.emit(conn);
    this.close.emit();
  }

  onDelete(): void {
    const conn = this.editingConnection();
    if (!conn) return;
    this.delete.emit(conn.id);
    this.close.emit();
  }

  onClose(): void {
    this.close.emit();
  }
}
