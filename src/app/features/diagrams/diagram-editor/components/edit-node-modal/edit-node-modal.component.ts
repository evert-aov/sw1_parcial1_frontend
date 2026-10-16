import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  effect,
  ElementRef,
  ViewChild,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroDocumentText,
  heroSwatch,
  heroPencilSquare,
  heroPlus,
  heroTrash,
  heroXMark,
  heroArrowsPointingOut,
  heroArrowPath,
  heroCheck,
  heroAdjustmentsHorizontal,
} from '@ng-icons/heroicons/outline';
import { TranslatePipe } from '../../../../../core/i18n';
import {
  UmlClassNode,
  UML_PREDEFINED_TYPES,
  UML_PREDEFINED_RETURN_TYPES,
  UML_PREDEFINED_STEREOTYPES,
} from '../../../../../core/models/diagram.model';

export interface ColorPreset {
  hex: string;
  name: string;
}

@Component({
  selector: 'app-edit-node-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TranslatePipe, NgIconComponent],
  providers: [
    provideIcons({
      heroDocumentText,
      heroSwatch,
      heroPencilSquare,
      heroPlus,
      heroTrash,
      heroXMark,
      heroArrowsPointingOut,
      heroArrowPath,
      heroCheck,
      heroAdjustmentsHorizontal,
    }),
  ],
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
  readonly activeTab = signal<'general' | 'style'>('general');
  protected readonly Math = Math;

  // Estados de Dimensiones (Tamaño)
  readonly isCustomSize = signal<boolean>(false);
  readonly nodeWidth = signal<number>(200);
  readonly nodeHeight = signal<number | null>(null);

  // Paleta armónica de colores de nodo
  readonly colorPalette: ColorPreset[] = [
    { hex: '#FDFAF3', name: 'Crema UML' },
    { hex: '#DDF4F5', name: 'Cyan BCE' },
    { hex: '#E9F5EC', name: 'Verde Menta' },
    { hex: '#F5EBF7', name: 'Lavanda' },
    { hex: '#FFFFFF', name: 'Blanco' },
    { hex: '#FEF3C7', name: 'Ámbar Suave' },
    { hex: '#E0F2FE', name: 'Celeste' },
    { hex: '#FCE7F3', name: 'Rosa Pálido' },
    { hex: '#F1F5F9', name: 'Pizarra Claro' },
    { hex: '#1E293B', name: 'Pizarra Oscuro' },
  ];

  @ViewChild('modalColorInput') modalColorInputRef?: ElementRef<HTMLInputElement>;
  private isModalPickerOpen = false;

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

  getDefaultColorForNode(): string {
    const nt = (this.editingNode()?.nodeType || '').toLowerCase().trim();
    if (nt === 'lifeline' || nt === 'boundary' || nt === 'control' || nt === 'entity') return '#DDF4F5';
    if (nt === 'actor') return '#FEF2DD';
    if (nt === 'use_case') return '#E5F2FE';
    if (nt === 'package') return '#FFFFFF';
    return '#FDFAF3';
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
          this.activeTab.set('general');

          const hasCustom = !!cloned.isCustomSize || (!!cloned.customWidth && cloned.customWidth > 0);
          this.isCustomSize.set(hasCustom);
          this.nodeWidth.set(cloned.customWidth || cloned.width || 200);
          this.nodeHeight.set(cloned.customHeight || (cloned.isCustomSize ? cloned.height || null : null));

          setTimeout(() => {
            if (this.modalColorInputRef?.nativeElement && !this.isModalPickerOpen) {
              this.modalColorInputRef.nativeElement.value = cloned.color || this.getDefaultColorForNode();
            }
          }, 0);
        } else if (!this.isOpen()) {
          this.editingNode.set(null);
        }
      },
      { allowSignalWrites: true }
    );
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeyDown(event: KeyboardEvent): void {
    if (!this.isOpen()) return;
    if (event.key === 'Escape') {
      event.stopPropagation();
      event.preventDefault();
      this.onClose();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  setColor(color: string): void {
    const curr = this.editingNode();
    if (curr) {
      curr.color = color;
      this.editingNode.set({ ...curr });
      if (this.modalColorInputRef?.nativeElement) {
        this.modalColorInputRef.nativeElement.value = color;
      }
    }
  }

  resetColor(): void {
    const defaultColor = this.getDefaultColorForNode();
    this.setColor(defaultColor);
  }

  onColorPickerFocus(): void {
    this.isModalPickerOpen = true;
  }

  onColorPickerBlur(): void {
    this.isModalPickerOpen = false;
    if (this.modalColorInputRef?.nativeElement && this.editingNode()) {
      this.modalColorInputRef.nativeElement.value = this.editingNode()!.color || this.getDefaultColorForNode();
    }
  }

  onColorInput(event: Event): void {
    this.isModalPickerOpen = true;
    const target = event.target as HTMLInputElement;
    const curr = this.editingNode();
    if (curr && target?.value) {
      curr.color = target.value;
      this.editingNode.set({ ...curr });
    }
  }

  onColorChange(event: Event): void {
    this.isModalPickerOpen = false;
    const target = event.target as HTMLInputElement;
    const curr = this.editingNode();
    if (curr && target?.value) {
      curr.color = target.value;
      this.editingNode.set({ ...curr });
    }
  }

  toggleCustomSize(enabled: boolean): void {
    this.isCustomSize.set(enabled);
    if (!enabled) {
      this.resetToAutoSize();
    } else {
      if (!this.nodeWidth() || this.nodeWidth() < 60) {
        this.nodeWidth.set(200);
      }
    }
  }

  onWidthChange(val: number | string): void {
    const num = Number(val);
    if (!isNaN(num) && num > 0) {
      this.nodeWidth.set(Math.max(60, Math.min(1200, Math.round(num))));
      this.isCustomSize.set(true);
    }
  }

  onHeightChange(val: number | string | null): void {
    if (val === null || val === '' || isNaN(Number(val))) {
      this.nodeHeight.set(null);
    } else {
      const num = Number(val);
      this.nodeHeight.set(Math.max(40, Math.min(1200, Math.round(num))));
      this.isCustomSize.set(true);
    }
  }

  applyPreset(preset: 'compact' | 'standard' | 'wide'): void {
    this.isCustomSize.set(true);
    if (preset === 'compact') {
      this.nodeWidth.set(180);
      this.nodeHeight.set(90);
    } else if (preset === 'standard') {
      this.nodeWidth.set(240);
      this.nodeHeight.set(130);
    } else if (preset === 'wide') {
      this.nodeWidth.set(320);
      this.nodeHeight.set(190);
    }
  }

  resetToAutoSize(): void {
    this.isCustomSize.set(false);
    this.nodeHeight.set(null);
    const curr = this.editingNode();
    if (curr) {
      curr.customWidth = undefined;
      curr.customHeight = undefined;
      curr.isCustomSize = false;
      this.editingNode.set({ ...curr });
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

    // Configuración técnica y estética de dimensiones
    if (this.isCustomSize()) {
      const w = Math.max(60, Math.round(this.nodeWidth()));
      curr.isCustomSize = true;
      curr.customWidth = w;
      curr.width = w;

      const h = this.nodeHeight();
      if (h && h > 0) {
        const roundedH = Math.max(40, Math.round(h));
        curr.customHeight = curr.nodeType === 'lifeline' ? 60 : roundedH;
        curr.height = curr.nodeType === 'lifeline' ? 60 : roundedH;
      } else {
        curr.customHeight = undefined;
        curr.height = undefined;
      }
    } else {
      curr.isCustomSize = false;
      curr.customWidth = undefined;
      curr.customHeight = undefined;
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
