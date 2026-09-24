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
  readonly activeTab = signal<RibbonTab>('publish');

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
  readonly isToolboxOpen = input<boolean>(true);

  // Indica si hay 2 o más usuarios editando simultáneamente
  readonly multiUserBlocked = computed(() => {
    if (this.isMultiUserEditing() !== undefined) {
      return !!this.isMultiUserEditing();
    }
    return this.collaborationService.isMultiUserEditing();
  });

  // Outputs
  readonly saveDiagram = output<void>();
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
}
