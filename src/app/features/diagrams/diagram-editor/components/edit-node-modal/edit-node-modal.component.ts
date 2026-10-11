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
  readonly activeDiagramType = input<string>('class');

  readonly close = output<void>();
  readonly save = output<UmlClassNode>();

  readonly predefinedTypes = UML_PREDEFINED_TYPES;
  readonly predefinedReturnTypes = UML_PREDEFINED_RETURN_TYPES;
  readonly predefinedStereotypes = UML_PREDEFINED_STEREOTYPES;

  readonly editingNode = signal<UmlClassNode | null>(null);

  canHaveStereotype(): boolean {
    const n = this.editingNode();
    if (!n) return false;
    const nt = (n.nodeType || '').toLowerCase().trim();
    if (nt === 'actor' || nt === 'use_case' || nt === 'lifeline') return false;

    // En diagramas de clase estándar (class / logical), no se permite estereotipo a las clases
    const dt = (this.activeDiagramType() || '').toLowerCase().trim();
    if ((dt === 'class' || dt === 'logical') && nt === 'class') {
      return false;
    }

    return true;
  }

  isCommunicationDiagram(): boolean {
    const dt = (this.activeDiagramType() || '').toLowerCase().trim();
    return dt === 'communication' || dt === 'collaboration';
  }

  isClassAnalysisDiagram(): boolean {
    const dt = (this.activeDiagramType() || '').toLowerCase().trim();
    return dt === 'class_analysis';
  }

  availableStereotypes(): { value: string; label: string }[] {
    if (this.isClassAnalysisDiagram()) {
      return [
        { value: 'UI', label: 'UI' },
        { value: 'Controller.', label: 'Controller.' },
        { value: 'Entity.', label: 'Entity.' },
      ];
    }
    const list = this.predefinedStereotypes.filter(
      (s) => s.value.toLowerCase() !== 'class' && s.label.toLowerCase() !== 'class'
    );
    const curr = this.editingNode()?.stereotype;
    if (
      curr &&
      curr.toLowerCase() !== 'class' &&
      !list.some((s) => s.value.toLowerCase() === curr.toLowerCase())
    ) {
      return [{ value: curr, label: curr }, ...list];
    }
    return list;
  }

  onStereotypeSelect(val: string): void {
    const curr = this.editingNode();
    if (!curr || !this.canHaveStereotype() || this.isCommunicationDiagram()) return;
    let clean = val && val.trim() ? val.trim() : null;
    if (clean && clean.toLowerCase() === 'class') {
      clean = null;
    }
    const dt = (this.activeDiagramType() || '').toLowerCase().trim();
    const nt = (curr.nodeType || '').toLowerCase().trim();
    if ((dt === 'class' || dt === 'logical') && nt === 'class') {
      clean = null;
    }
    if (this.isClassAnalysisDiagram()) {
      if (clean && !['UI', 'Controller.', 'Entity.'].includes(clean)) {
        clean = null;
      }
    }
    curr.stereotype = clean;
    this.editingNode.set({ ...curr });
  }

  clearStereotype(): void {
    const curr = this.editingNode();
    if (curr && this.canHaveStereotype() && !this.isCommunicationDiagram()) {
      curr.stereotype = null;
      this.editingNode.set({ ...curr });
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

          // Normalización estricta de estereotipos según tipo de nodo y diagrama
          const nt = (cloned.nodeType || '').toLowerCase().trim();
          const dt = (this.activeDiagramType() || '').toLowerCase().trim();
          if (nt === 'actor' || nt === 'use_case' || nt === 'lifeline') {
            cloned.stereotype = null;
          } else if (dt === 'communication' || dt === 'collaboration') {
            if (nt === 'boundary' || nt === 'ui') cloned.stereotype = 'boundary';
            else if (nt === 'control') cloned.stereotype = 'control';
            else if (nt === 'entity') cloned.stereotype = 'entity';
            else cloned.stereotype = null;
          } else if (dt === 'class' || dt === 'logical') {
            if (nt === 'class') {
              cloned.stereotype = null;
            } else if (cloned.stereotype && cloned.stereotype.toLowerCase() === 'class') {
              cloned.stereotype = null;
            }
          } else if (dt === 'class_analysis') {
            const s = (cloned.stereotype || '').toLowerCase().trim();
            if (s === 'ui' || s === 'boundary' || nt === 'boundary' || nt === 'ui') cloned.stereotype = 'UI';
            else if (s === 'controller.' || s === 'controller' || s === 'control' || nt === 'control') cloned.stereotype = 'Controller.';
            else if (s === 'entity.' || s === 'entity' || nt === 'entity') cloned.stereotype = 'Entity.';
            else if (cloned.stereotype && !['UI', 'Controller.', 'Entity.'].includes(cloned.stereotype)) {
              cloned.stereotype = null;
            }
          }

          this.editingNode.set(cloned);
          setTimeout(() => {
            if (this.modalColorInputRef?.nativeElement && !this.isModalPickerOpen) {
              this.modalColorInputRef.nativeElement.value = cloned.color || '#FDFAF3';
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
      this.modalColorInputRef.nativeElement.value = this.editingNode()!.color || '#FDFAF3';
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

    // Validar y aplicar restricciones de estereotipo al guardar
    if (!this.canHaveStereotype()) {
      curr.stereotype = null;
    } else if (this.isCommunicationDiagram()) {
      const nt = (curr.nodeType || '').toLowerCase().trim();
      if (nt === 'boundary' || nt === 'ui') curr.stereotype = 'boundary';
      else if (nt === 'control') curr.stereotype = 'control';
      else if (nt === 'entity') curr.stereotype = 'entity';
      else curr.stereotype = null;
    } else {
      if (curr.stereotype && curr.stereotype.toLowerCase() === 'class') {
        curr.stereotype = null;
      }
      if (this.isClassAnalysisDiagram()) {
        if (curr.stereotype && !['UI', 'Controller.', 'Entity.'].includes(curr.stereotype)) {
          curr.stereotype = null;
        }
      }
    }

    this.save.emit(curr);
    this.close.emit();
  }

  onClose(): void {
    this.close.emit();
  }
}
