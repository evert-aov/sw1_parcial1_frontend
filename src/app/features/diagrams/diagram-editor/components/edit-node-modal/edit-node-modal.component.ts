import { Component, input, output, signal, effect, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../../../core/i18n';
import {
  UmlClassNode,
  UML_PREDEFINED_TYPES,
  UML_PREDEFINED_RETURN_TYPES,
  UML_PREDEFINED_STEREOTYPES,
  hexToRgb,
  rgbToHex,
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
  readonly predefinedStereotypes = UML_PREDEFINED_STEREOTYPES;

  readonly editingNode = signal<UmlClassNode | null>(null);

  onStereotypeSelect(val: string): void {
    const curr = this.editingNode();
    if (curr) {
      curr.stereotype = val && val.trim() ? val.trim() : null;
    }
  }

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
          setTimeout(() => {
            if (this.modalColorInputRef?.nativeElement && !this.isModalPickerOpen) {
              this.modalColorInputRef.nativeElement.value = cloned.color || '#FFFDDD';
            }
          }, 0);
        } else if (!this.isOpen()) {
          this.editingNode.set(null);
        }
      },
      { allowSignalWrites: true }
    );
  }

  @ViewChild('modalColorInput') modalColorInputRef?: ElementRef<HTMLInputElement>;
  private isModalPickerOpen = false;

  setColor(color: string): void {
    const curr = this.editingNode();
    if (curr) {
      curr.color = color;
      if (this.modalColorInputRef?.nativeElement) {
        this.modalColorInputRef.nativeElement.value = color;
      }
    }
  }

  onColorPickerFocus(): void {
    this.isModalPickerOpen = true;
  }

  onColorPickerBlur(): void {
    this.isModalPickerOpen = false;
    if (this.modalColorInputRef?.nativeElement && this.editingNode()) {
      this.modalColorInputRef.nativeElement.value = this.editingNode()!.color || '#FFFDDD';
    }
  }

  onColorInput(event: Event): void {
    this.isModalPickerOpen = true;
    const target = event.target as HTMLInputElement;
    const curr = this.editingNode();
    if (curr && target?.value) {
      curr.color = target.value;
    }
  }

  onColorChange(event: Event): void {
    this.isModalPickerOpen = false;
    const target = event.target as HTMLInputElement;
    const curr = this.editingNode();
    if (curr && target?.value) {
      curr.color = target.value;
    }
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
