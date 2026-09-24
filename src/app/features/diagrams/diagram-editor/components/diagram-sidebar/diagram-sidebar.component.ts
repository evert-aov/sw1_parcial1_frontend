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
  heroSquare3Stack3d,
  heroUserGroup,
  heroArrowsUpDown,
  heroChatBubbleLeftRight,
  heroFolderOpen,
} from '@ng-icons/heroicons/outline';
import {
  DiagramType,
  DiagramTypeItem,
  UML_DIAGRAM_TYPES,
  UmlRelationshipType,
  UmlLineStyle,
  UmlRelationTypeItem,
  UmlLineStyleItem,
  UML_RELATION_TYPES,
  UML_LINE_STYLES,
} from '../../../../../core/models/diagram.model';
import { TranslatePipe } from '../../../../../core/i18n';

@Component({
  selector: 'app-diagram-sidebar',
  standalone: true,
  imports: [CommonModule, NgIconComponent, TranslatePipe],
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
      heroSquare3Stack3d,
      heroUserGroup,
      heroArrowsUpDown,
      heroChatBubbleLeftRight,
      heroFolderOpen,
    }),
  ],
  templateUrl: './diagram-sidebar.component.html',
})
export class DiagramSidebarComponent {
  // Inputs
  readonly isOpen = input<boolean>(true);
  readonly activeDiagramType = input<DiagramType>('class');
  readonly selectedRelationType = input<UmlRelationshipType | null>(null);
  readonly defaultLineStyle = input<UmlLineStyle>('segment');
  readonly isReadOnly = input<boolean>(false);
  readonly relationTypes = input<UmlRelationTypeItem[]>(UML_RELATION_TYPES);
  readonly lineStyles = input<UmlLineStyleItem[]>(UML_LINE_STYLES);
  readonly diagramTypes = input<DiagramTypeItem[]>(UML_DIAGRAM_TYPES);

  // Estados de acordeón
  readonly isDiagramTypesOpen = signal<boolean>(false);
  readonly isRelationshipsOpen = signal<boolean>(true);
  readonly isLineStylesOpen = signal<boolean>(true);

  // Eventos hacia el contenedor del Diagrama
  readonly closeSidebar = output<void>();
  readonly diagramTypeChange = output<DiagramType>();
  readonly setPointerMode = output<void>();
  readonly selectRelationType = output<UmlRelationshipType>();
  readonly setDefaultLineStyle = output<UmlLineStyle>();
  readonly zoomIn = output<void>();
  readonly zoomOut = output<void>();
  readonly resetView = output<void>();
  readonly fitView = output<void>();
  readonly addClass = output<void>();

  onSelectDiagramType(type: DiagramType): void {
    this.diagramTypeChange.emit(type);
  }

  onSelectPointer(): void {
    this.setPointerMode.emit();
  }

  onSelectRelation(type: UmlRelationshipType): void {
    this.selectRelationType.emit(type);
  }

  onSetLineStyle(style: UmlLineStyle): void {
    this.setDefaultLineStyle.emit(style);
  }
}
