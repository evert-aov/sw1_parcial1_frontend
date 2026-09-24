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
} from '@ng-icons/heroicons/outline';
import { AuthService } from '../../../../../core/services/auth.service';
import { CollaborationService } from '../../../../../core/services/collaboration.service';
import { UserGuideService } from '../../../../../core/services/user-guide.service';
import { TranslatePipe, LanguageSelectorComponent, TranslationService } from '../../../../../core/i18n';
import { ThemeToggleComponent } from '../../../../../core/components/theme-toggle/theme-toggle.component';

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
    }),
  ],
  templateUrl: './diagram-appbar.component.html',
})
export class DiagramAppbarComponent {
  readonly authService = inject(AuthService);
  readonly collaborationService = inject(CollaborationService);
  readonly guideService = inject(UserGuideService);
  readonly translationService = inject(TranslationService);

  openGuide(): void {
    this.guideService.openGuide();
  }

  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  // Inputs
  readonly diagramTitle = input<string>('Diagrama de Clases UML');
  readonly diagramId = input<string | null>(null);
  readonly isSaving = input<boolean>(false);
  readonly saveSuccessMessage = input<boolean>(false);
  readonly isReadOnly = input<boolean>(false);
  readonly isMultiUserEditing = input<boolean | undefined>(undefined);

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

  // Estados de dropdowns locales
  readonly isExportDropdownOpen = signal<boolean>(false);
  readonly isImportDropdownOpen = signal<boolean>(false);

  handleExportBmp(): void {
    if (this.multiUserBlocked()) {
      alert(this.translationService.translate('appbar.multiUserExportBlocked'));
      this.isExportDropdownOpen.set(false);
      return;
    }
    this.exportBmp.emit();
    this.isExportDropdownOpen.set(false);
  }

  handleExportXmi(): void {
    if (this.multiUserBlocked()) {
      alert(this.translationService.translate('appbar.multiUserExportBlocked'));
      this.isExportDropdownOpen.set(false);
      return;
    }
    this.exportXmi.emit();
    this.isExportDropdownOpen.set(false);
  }

  handleExportJson(): void {
    if (this.multiUserBlocked()) {
      alert(this.translationService.translate('appbar.multiUserExportBlocked'));
      this.isExportDropdownOpen.set(false);
      return;
    }
    this.exportJson.emit();
    this.isExportDropdownOpen.set(false);
  }

  handleViewJson(): void {
    if (this.multiUserBlocked()) {
      alert(this.translationService.translate('appbar.multiUserExportBlocked'));
      this.isExportDropdownOpen.set(false);
      return;
    }
    this.viewJson.emit();
    this.isExportDropdownOpen.set(false);
  }

  handleOpenImportJson(): void {
    if (this.multiUserBlocked()) {
      alert(this.translationService.translate('appbar.multiUserImportBlocked'));
      this.isImportDropdownOpen.set(false);
      return;
    }
    this.openImportJson.emit();
    this.isImportDropdownOpen.set(false);
  }

  triggerFileInput(): void {
    if (this.multiUserBlocked()) {
      alert(this.translationService.translate('appbar.multiUserImportBlocked'));
      this.isImportDropdownOpen.set(false);
      return;
    }
    this.isImportDropdownOpen.set(false);
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
