import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslationService } from '../../../../../../core/i18n';
import { UmlRelationshipType, UmlRelationTypeItem } from '../../../../../../core/models/diagram.model';

@Component({
  selector: 'app-diagram-relationship-button',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './diagram-relationship-button.component.html',
})
export class DiagramRelationshipButtonComponent {
  private readonly i18n = inject(TranslationService);

  @Input() relationship?: UmlRelationTypeItem;
  @Input() relationshipId = '';
  @Input() label = '';
  @Input() description = '';
  @Input() isSelected = false;
  @Input() themeColor: 'blue' | 'amber' | 'cyan' | 'rose' = 'blue';

  @Output() selectRelation = new EventEmitter<UmlRelationshipType>();
  @Output() select = new EventEmitter<UmlRelationshipType>();

  get effectiveId(): UmlRelationshipType {
    return (this.relationship?.id ?? this.relationshipId) as UmlRelationshipType;
  }

  get effectiveLabel(): string {
    return this.relationship?.label ?? this.label;
  }

  get effectiveDescription(): string {
    return this.relationship?.description ?? this.description;
  }

  get displayLabel(): string {
    const id = this.effectiveId;
    const key = `editor.toolbox.${id}`;
    const translated = this.i18n.translate(key);
    return translated !== key ? translated : this.effectiveLabel;
  }

  get displayDescription(): string {
    const id = this.effectiveId;
    const key = `editor.toolbox.${id}Desc`;
    const translated = this.i18n.translate(key);
    return translated !== key ? translated : this.effectiveDescription;
  }

  get selectedClasses(): string {
    switch (this.themeColor) {
      case 'amber':
        return 'bg-amber-50 dark:bg-amber-950/70 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100 shadow-2xs';
      case 'cyan':
        return 'bg-cyan-50 dark:bg-cyan-950/70 border-cyan-300 dark:border-cyan-700 text-cyan-900 dark:text-cyan-100 shadow-2xs';
      case 'rose':
        return 'bg-rose-50 dark:bg-rose-950/70 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-100 shadow-2xs';
      case 'blue':
      default:
        return 'bg-blue-50 dark:bg-blue-950/70 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-100 shadow-2xs';
    }
  }

  onClick(): void {
    const id = this.effectiveId;
    this.selectRelation.emit(id);
    this.select.emit(id);
  }
}
