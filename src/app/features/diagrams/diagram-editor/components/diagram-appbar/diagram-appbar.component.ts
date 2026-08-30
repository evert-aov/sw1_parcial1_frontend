import { Component, inject, signal, input, output, ElementRef, ViewChild } from '@angular/core';
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
} from '@ng-icons/heroicons/outline';
import { AuthService } from '../../../../../core/services/auth.service';
import { CollaborationService } from '../../../../../core/services/collaboration.service';

@Component({
  selector: 'app-diagram-appbar',
  standalone: true,
  imports: [CommonModule, RouterLink, NgIconComponent],
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
    }),
  ],
  templateUrl: './diagram-appbar.component.html',
})
export class DiagramAppbarComponent {
  readonly authService = inject(AuthService);
  readonly collaborationService = inject(CollaborationService);

  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  // Inputs
  readonly diagramTitle = input<string>('Diagrama de Clases UML');
  readonly diagramId = input<string | null>(null);
  readonly isSaving = input<boolean>(false);
  readonly saveSuccessMessage = input<boolean>(false);
  readonly isReadOnly = input<boolean>(false);

  // Outputs
  readonly saveDiagram = output<void>();
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

  triggerFileInput(): void {
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
