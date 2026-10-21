import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroBars3,
  heroChevronLeft,
  heroChevronDown,
  heroChevronRight,
  heroCursorArrowRays,
  heroCheck,
  heroMagnifyingGlassPlus,
  heroMagnifyingGlassMinus,
  heroArrowsPointingOut,
  heroPlus,
} from '@ng-icons/heroicons/outline';
import {
  UmlRelationshipType,
  UmlLineStyle,
  UmlRelationTypeItem,
  UmlLineStyleItem,
  UML_RELATION_TYPES,
  UML_LINE_STYLES,
} from '../../../../../core/models/diagram.model';
import { UML_SVG_COMPONENTS } from '../../../../../plugin-sdk/ui/uml-svg/index';
import { SHARED_DIAGRAM_UI_COMPONENTS } from '../../../../../plugin-sdk/ui/shared-ui/index';
import { TranslatePipe } from '../../../../../core/i18n/index';

@Component({
  selector: 'app-diagram-toolbox',
  standalone: true,
  imports: [
    CommonModule,
    NgIconComponent,
    TranslatePipe,
    ...UML_SVG_COMPONENTS,
    ...SHARED_DIAGRAM_UI_COMPONENTS,
  ],
  providers: [
    provideIcons({
      heroBars3,
      heroChevronLeft,
      heroChevronDown,
      heroChevronRight,
      heroCursorArrowRays,
      heroCheck,
      heroMagnifyingGlassPlus,
      heroMagnifyingGlassMinus,
      heroArrowsPointingOut,
      heroPlus,
    }),
  ],
  templateUrl: './diagram-toolbox.component.html',
})
export class DiagramToolboxComponent {
  // Inputs
  readonly isOpen = input<boolean>(true);
  readonly selectedRelationType = input<UmlRelationshipType | null>(null);
  readonly defaultLineStyle = input<UmlLineStyle>('segment');
  readonly isReadOnly = input<boolean>(false);
  readonly relationTypes = input<UmlRelationTypeItem[]>(UML_RELATION_TYPES);
  readonly lineStyles = input<UmlLineStyleItem[]>(UML_LINE_STYLES);

  // Estados de acordeón internos
  readonly isRelationshipsOpen = signal<boolean>(true);
  readonly isLineStylesOpen = signal<boolean>(true);

  // Eventos de salida hacia DiagramEditorComponent
  readonly closeToolbox = output<void>();
  readonly setPointerMode = output<void>();
  readonly selectRelationType = output<UmlRelationshipType>();
  readonly setDefaultLineStyle = output<UmlLineStyle>();
  readonly zoomIn = output<void>();
  readonly zoomOut = output<void>();
  readonly resetView = output<void>();
  readonly fitView = output<void>();
  readonly addClass = output<void>();

  /**
   * Activa el modo de puntero estándar en el lienzo del diagrama.
   */
  onSelectPointer(): void {
    this.setPointerMode.emit();
  }

  /**
   * Emite la selección de un tipo de relación UML para comenzar a trazar aristas.
   * @param type Tipo de relación UML seleccionado.
   */
  onSelectRelation(type: UmlRelationshipType): void {
    this.selectRelationType.emit(type);
  }

  /**
   * Emite el cambio en el estilo de trazado o routing de las líneas.
   * @param style Estilo de línea seleccionado.
   */
  onSetLineStyle(style: UmlLineStyle): void {
    this.setDefaultLineStyle.emit(style);
  }
}
