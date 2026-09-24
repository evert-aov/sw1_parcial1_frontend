import { Component, input, output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../../../core/i18n';
import {
  UmlClassNode,
  UML_PREDEFINED_TYPES,
  UML_PREDEFINED_RETURN_TYPES,
} from '../../../../../core/models/diagram.model';

@Component({
  selector: 'app-edit-node-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './edit-node-modal.component.html',
})
export class EditNodeModalComponent {
  readonly isOpen = input<boolean>(false);
  readonly node = input<UmlClassNode | null>(null);

  readonly close = output<void>();
  readonly save = output<UmlClassNode>();

  readonly predefinedTypes = UML_PREDEFINED_TYPES;
  readonly predefinedReturnTypes = UML_PREDEFINED_RETURN_TYPES;

  readonly editingNode = signal<UmlClassNode | null>(null);

  constructor() {
    effect(
      () => {
        const n = this.node();
        if (n && this.isOpen()) {
          this.editingNode.set(JSON.parse(JSON.stringify(n)));
        } else if (!this.isOpen()) {
          this.editingNode.set(null);
        }
      },
      { allowSignalWrites: true }
    );
  }

  addAttribute(): void {
    const curr = this.editingNode();
    if (!curr) return;
    const attrs = [...curr.attributes, { name: 'nuevoAtributo', type: 'String' }];
    this.editingNode.set({ ...curr, attributes: attrs });
  }

  removeAttribute(index: number): void {
    const curr = this.editingNode();
    if (!curr) return;
    const attrs = curr.attributes.filter((_, i) => i !== index);
    this.editingNode.set({ ...curr, attributes: attrs });
  }

  addMethod(): void {
    const curr = this.editingNode();
    if (!curr) return;
    const methods = [
      ...curr.methods,
      { name: 'nuevoMetodo', parameters: '', returnType: 'void' },
    ];
    this.editingNode.set({ ...curr, methods });
  }

  removeMethod(index: number): void {
    const curr = this.editingNode();
    if (!curr) return;
    const methods = curr.methods.filter((_, i) => i !== index);
    this.editingNode.set({ ...curr, methods });
  }

  onSave(): void {
    const curr = this.editingNode();
    if (!curr) return;
    this.save.emit(curr);
    this.close.emit();
  }

  onClose(): void {
    this.close.emit();
  }
}
