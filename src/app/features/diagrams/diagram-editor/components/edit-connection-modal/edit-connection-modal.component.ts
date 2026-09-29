import { Component, input, output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroArrowsRightLeft, heroTrash, heroPlus, heroChevronUp, heroChevronDown } from '@ng-icons/heroicons/outline';
import { TranslatePipe } from '../../../../../core/i18n';
import {
  UmlConnection,
  UmlRelationTypeItem,
  UmlLineStyleItem,
  UML_RELATION_TYPES,
  ALL_UML_RELATION_TYPES,
  UML_LINE_STYLES,
  UML_MULTIPLICITY_OPTIONS,
  DiagramType,
  UmlMessage,
} from '../../../../../core/models/diagram.model';

@Component({
  selector: 'app-edit-connection-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent, TranslatePipe],
  providers: [
    provideIcons({
      heroArrowsRightLeft,
      heroTrash,
      heroPlus,
      heroChevronUp,
      heroChevronDown,
    }),
  ],
  templateUrl: './edit-connection-modal.component.html',
})
export class EditConnectionModalComponent {
  readonly isOpen = input<boolean>(false);
  readonly connection = input<UmlConnection | null>(null);
  readonly relationTypes = input<UmlRelationTypeItem[]>(ALL_UML_RELATION_TYPES);
  readonly lineStyles = input<UmlLineStyleItem[]>(UML_LINE_STYLES);
  readonly multiplicityOptions = input<string[]>(UML_MULTIPLICITY_OPTIONS);
  readonly activeDiagramType = input<DiagramType>(DiagramType.CLASS);

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

  addMessage(): void {
    const conn = this.editingConnection();
    if (!conn) return;
    if (!conn.messages) conn.messages = [];
    const nextSeq = `${conn.messages.length + 1}`;
    const newMsg: UmlMessage = {
      id: `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      sequenceNumber: nextSeq,
      functionName: `mensaje_${nextSeq}`,
      parameters: '',
      returnType: '',
      isReturn: false,
      direction: 'forward',
      orderIndex: conn.messages.length,
      color: '#241C18',
    };
    conn.messages.push(newMsg);
    this.editingConnection.set({ ...conn });
  }

  removeMessage(index: number): void {
    const conn = this.editingConnection();
    if (!conn || !conn.messages) return;
    conn.messages.splice(index, 1);
    this.editingConnection.set({ ...conn });
  }

  moveMessageUp(index: number): void {
    const conn = this.editingConnection();
    if (!conn || !conn.messages || index <= 0) return;
    const temp = conn.messages[index];
    conn.messages[index] = conn.messages[index - 1];
    conn.messages[index - 1] = temp;
    this.editingConnection.set({ ...conn });
  }

  moveMessageDown(index: number): void {
    const conn = this.editingConnection();
    if (!conn || !conn.messages || index >= conn.messages.length - 1) return;
    const temp = conn.messages[index];
    conn.messages[index] = conn.messages[index + 1];
    conn.messages[index + 1] = temp;
    this.editingConnection.set({ ...conn });
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
