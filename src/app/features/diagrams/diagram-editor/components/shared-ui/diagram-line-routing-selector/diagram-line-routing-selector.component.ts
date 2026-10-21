import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslationService } from '../../../../../../core/i18n';
import { UmlLineStyle, UML_LINE_STYLES, UmlLineStyleItem } from '../../../../../../core/models/diagram.model';

@Component({
  selector: 'app-diagram-line-routing-selector',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './diagram-line-routing-selector.component.html',
})
export class DiagramLineRoutingSelectorComponent {
  private readonly i18n = inject(TranslationService);
  readonly lineStyles: UmlLineStyleItem[] = UML_LINE_STYLES;

  @Input() selectedStyle: UmlLineStyle = 'orthogonal_square';
  @Output() styleChange = new EventEmitter<UmlLineStyle>();

  getLineStyleLabel(styleId: string, fallback: string): string {
    const key = `editor.toolbox.${styleId}`;
    const translated = this.i18n.translate(key);
    return translated !== key ? translated : fallback;
  }

  onChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    if (select && select.value) {
      this.styleChange.emit(select.value as UmlLineStyle);
    }
  }
}
