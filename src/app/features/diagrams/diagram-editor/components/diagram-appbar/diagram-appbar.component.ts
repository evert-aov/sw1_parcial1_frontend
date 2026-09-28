import { Component, inject, signal, computed, input, output, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroCube,
  heroLockClosed,
  heroPencilSquare,
  heroUserGroup,
  heroTrash,
  heroDocumentChartBar,
  heroArrowDownTray,
  heroArrowUpTray,
  heroDocumentText,
  heroBolt,
  heroSparkles,
  heroChevronDown,
  heroChevronUp,
  heroChevronLeft,
  heroArrowRightOnRectangle,
  heroUserCircle,
  heroClipboardDocument,
  heroFolder,
  heroCloudArrowUp,
  heroEye,
  heroCheck,
  heroPhoto,
  heroAcademicCap,
  heroMagnifyingGlassPlus,
  heroMagnifyingGlassMinus,
  heroArrowsPointingOut,
  heroArrowPath,
  heroPlus,
  heroSquares2x2,
  heroCursorArrowRays,
  heroBars3,
  heroPrinter,
  heroArrowUturnLeft,
  heroArrowUturnRight,
  heroPaintBrush,
  heroSwatch,
} from '@ng-icons/heroicons/outline';
import { AuthService } from '../../../../../core/services/auth.service';
import { CollaborationService } from '../../../../../core/services/collaboration.service';
import { UserGuideService } from '../../../../../core/services/user-guide.service';
import { TranslatePipe, LanguageSelectorComponent, TranslationService } from '../../../../../core/i18n';
import { ThemeToggleComponent } from '../../../../../core/components/theme-toggle/theme-toggle.component';

export type RibbonTab = 'publish' | 'design' | 'develop' | 'collaborate' | 'start';

@Component({
  selector: 'app-diagram-appbar',
  standalone: true,
  imports: [CommonModule, RouterLink, NgIconComponent, TranslatePipe, LanguageSelectorComponent, ThemeToggleComponent],
  providers: [
    provideIcons({
      heroCube,
      heroLockClosed,
      heroPencilSquare,
      heroUserGroup,
      heroTrash,
      heroDocumentChartBar,
      heroArrowDownTray,
      heroArrowUpTray,
      heroDocumentText,
      heroBolt,
      heroSparkles,
      heroChevronDown,
      heroChevronUp,
      heroChevronLeft,
      heroArrowRightOnRectangle,
      heroUserCircle,
      heroClipboardDocument,
      heroFolder,
      heroCloudArrowUp,
      heroEye,
      heroCheck,
      heroPhoto,
      heroAcademicCap,
      heroMagnifyingGlassPlus,
      heroMagnifyingGlassMinus,
      heroArrowsPointingOut,
      heroArrowPath,
      heroPlus,
      heroSquares2x2,
      heroCursorArrowRays,
      heroBars3,
      heroPrinter,
      heroArrowUturnLeft,
      heroArrowUturnRight,
      heroPaintBrush,
      heroSwatch,
    }),
  ],
  templateUrl: './diagram-appbar.component.html',
})
export class DiagramAppbarComponent {
  readonly authService = inject(AuthService);
  readonly collaborationService = inject(CollaborationService);
  readonly guideService = inject(UserGuideService);
  readonly translationService = inject(TranslationService);

  // Tab activo en el Ribbon al estilo Enterprise Architect
  readonly activeTab = signal<RibbonTab>('design');

  // Estado de minimización / colapso del Ribbon (doble clic)
  readonly isCollapsed = signal<boolean>(false);

  toggleCollapse(): void {
    this.isCollapsed.update(val => !val);
  }

  onTabClick(tab: RibbonTab): void {
    if (this.isCollapsed() && this.activeTab() === tab) {
      this.isCollapsed.set(false);
    } else {
      this.activeTab.set(tab);
    }
  }

  onTabDblClick(tab: RibbonTab, event?: MouseEvent): void {
    event?.stopPropagation();
    event?.preventDefault();
    this.toggleCollapse();
  }

  openGuide(): void {
    this.guideService.openGuide();
  }

  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  // Inputs
  readonly diagramTitle = input<string>('Diagrama de Clases UML');
  readonly diagramId = input<string | null>(null);
  readonly isSaving = input<boolean>(false);
  readonly saveSuccessMessage = input<boolean>(false);
  readonly hasUnsavedChanges = input<boolean>(false);
  readonly isReadOnly = input<boolean>(false);
  readonly isMultiUserEditing = input<boolean | undefined>(undefined);
  readonly isToolboxOpen = input<boolean>(false);
  readonly canUndo = input<boolean>(false);
  readonly canRedo = input<boolean>(false);
  readonly selectedNodeId = input<string | null>(null);
  readonly selectedNodeColor = input<string | null>(null);
  readonly selectedNodesCount = input<number>(0);
  readonly smartGuidesEnabled = input<boolean>(true);

  // Colores predefinidos modernos
  readonly presetColors = [
    { name: 'Amarillo suave (Por defecto)', color: '#FFFDDD' },
    { name: 'Cyan suave', color: '#BAE6FD' },
    { name: 'Azul suave', color: '#BFDBFE' },
    { name: 'Rosa suave', color: '#FBCFE8' },
    { name: 'Fucsia suave', color: '#F5D0FE' },
    { name: 'Púrpura suave', color: '#E9D5FF' },
    { name: 'Gris suave', color: '#E2E8F0' },
    { name: 'Blanco puro', color: '#FFFFFF' },
  ];

  // Indica si hay 2 o más usuarios editando simultáneamente
  readonly multiUserBlocked = computed(() => {
    if (this.isMultiUserEditing() !== undefined) {
      return !!this.isMultiUserEditing();
    }
    return this.collaborationService.isMultiUserEditing();
  });

  // Outputs
  readonly saveDiagram = output<void>();
  readonly undo = output<void>();
  readonly redo = output<void>();
  readonly selectAll = output<void>();
  readonly changeNodeColor = output<string | null>();
  readonly exportBmp = output<void>();
  readonly exportXmi = output<void>();
  readonly exportJson = output<void>();
  readonly viewJson = output<void>();
  readonly fileSelected = output<Event>();
  readonly openImportJson = output<void>();
  readonly openSpringBoot = output<void>();
  readonly openProfile = output<void>();
  readonly toggleToolbox = output<void>();
  readonly zoomIn = output<void>();
  readonly zoomOut = output<void>();
  readonly fitView = output<void>();
  readonly resetView = output<void>();
  readonly addClass = output<void>();
  readonly setPointerMode = output<void>();
  readonly alignNodes = output<'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'>();
  readonly distributeNodes = output<'horizontal' | 'vertical'>();
  readonly snapToGrid = output<void>();
  readonly toggleSmartGuides = output<void>();

  handleExportBmp(): void {
    if (this.multiUserBlocked()) {
      alert(this.translationService.translate('appbar.multiUserExportBlocked'));
      return;
    }
    this.exportBmp.emit();
  }

  handleExportXmi(): void {
    if (this.multiUserBlocked()) {
      alert(this.translationService.translate('appbar.multiUserExportBlocked'));
      return;
    }
    this.exportXmi.emit();
  }

  handleExportJson(): void {
    if (this.multiUserBlocked()) {
      alert(this.translationService.translate('appbar.multiUserExportBlocked'));
      return;
    }
    this.exportJson.emit();
  }

  handleViewJson(): void {
    if (this.multiUserBlocked()) {
      alert(this.translationService.translate('appbar.multiUserExportBlocked'));
      return;
    }
    this.viewJson.emit();
  }

  handleOpenImportJson(): void {
    if (this.multiUserBlocked()) {
      alert(this.translationService.translate('appbar.multiUserImportBlocked'));
      return;
    }
    this.openImportJson.emit();
  }

  triggerFileInput(): void {
    if (this.multiUserBlocked()) {
      alert(this.translationService.translate('appbar.multiUserImportBlocked'));
      return;
    }
    this.fileInputRef?.nativeElement?.click();
  }

  copyRoomCode(): void {
    const code = this.collaborationService.activeRoomCode();
    if (code) {
      navigator.clipboard.writeText(code).then(() => {
        alert(`Código de sala "${code}" copiado al portapapeles.`);
      });
    }
  }

  onCustomColorInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target?.value) {
      this.changeNodeColor.emit(target.value);
    }
  }
}
