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
          const cloned: UmlClassNode = JSON.parse(JSON.stringify(n));
          if (cloned.attributes) {
            cloned.attributes = cloned.attributes.map((a) => ({
              ...a,
              nullable: a.nullable !== undefined ? a.nullable : true,
              unique: a.unique !== undefined ? a.unique : false,
              length: a.length !== undefined && a.length !== null ? Number(a.length) : 255,
              defaultValue: a.defaultValue ?? a.default ?? null,
              default: a.default ?? a.defaultValue ?? null,
            }));
          }
          this.editingNode.set(cloned);
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
    const attrs = [
      ...curr.attributes,
      {
        name: 'nuevoAtributo',
        type: 'String',
        nullable: true,
        unique: false,
        length: 255,
        defaultValue: null,
        default: null,
      },
    ];
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

  getPackageDescription(): string {
    const curr = this.editingNode();
    if (!curr) return '';
    if (curr.attributes && curr.attributes.length > 0 && curr.attributes[0]?.name) {
      return curr.attributes[0].name;
    }
    return '';
  }

  setPackageDescription(val: string): void {
    const curr = this.editingNode();
    if (!curr) return;
    const attrs = [...(curr.attributes || [])];
    if (attrs.length === 0) {
      attrs.push({ name: val, type: 'package' });
    } else {
      attrs[0] = { ...attrs[0], name: val };
    }
    this.editingNode.set({ ...curr, attributes: attrs });
  }

  onSave(): void {
    const curr = this.editingNode();
    if (!curr) return;
    if (curr.attributes) {
      curr.attributes = curr.attributes.map((a) => ({
        ...a,
        nullable: a.nullable !== undefined ? a.nullable : true,
        unique: a.unique !== undefined ? a.unique : false,
        length: a.length !== undefined && a.length !== null && (a.length as any) !== '' ? Number(a.length) : null,
        defaultValue: a.defaultValue && String(a.defaultValue).trim() ? String(a.defaultValue).trim() : null,
        default: a.defaultValue && String(a.defaultValue).trim() ? String(a.defaultValue).trim() : null,
      }));
    }
    this.save.emit(curr);
    this.close.emit();
  }

  onClose(): void {
    this.close.emit();
  }
}
