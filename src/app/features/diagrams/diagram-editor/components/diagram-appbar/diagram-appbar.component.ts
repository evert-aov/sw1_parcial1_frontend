import {
  Component,
  inject,
  signal,
  computed,
  input,
  output,
  ElementRef,
  ViewChild,
  AfterViewInit,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';
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
import { hexToRgb, rgbToHex } from '../../../../../core/models/diagram.model';
import { ToastService } from '../../../../../core/services/toast.service';

export type RibbonTab = 'publish' | 'design' | 'develop' | 'collaborate' | 'start';

@Component({
  selector: 'app-diagram-appbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
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
export class DiagramAppbarComponent implements AfterViewInit {
  readonly authService = inject(AuthService);
  readonly collaborationService = inject(CollaborationService);
  readonly guideService = inject(UserGuideService);
  readonly translationService = inject(TranslationService);
  readonly toastService = inject(ToastService);

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
  readonly showGrid = input<boolean>(false);

  // Colores predefinidos modernos
  readonly presetColors = [
    { name: 'Por defecto (#FDFAF3)', color: '#FDFAF3' },
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
  readonly exportPng = output<void>();
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
  readonly toggleGrid = output<void>();

  handleExportBmp(): void {
    if (this.multiUserBlocked()) {
      this.toastService.warning(this.translationService.translate('appbar.multiUserExportBlocked'));
      return;
    }
    this.exportBmp.emit();
  }

  handleExportPng(): void {
    if (this.multiUserBlocked()) {
      this.toastService.warning(this.translationService.translate('appbar.multiUserExportBlocked'));
      return;
    }
    this.exportPng.emit();
  }

  handleExportXmi(): void {
    if (this.multiUserBlocked()) {
      this.toastService.warning(this.translationService.translate('appbar.multiUserExportBlocked'));
      return;
    }
    this.exportXmi.emit();
  }

  handleExportJson(): void {
    if (this.multiUserBlocked()) {
      this.toastService.warning(this.translationService.translate('appbar.multiUserExportBlocked'));
      return;
    }
    this.exportJson.emit();
  }

  handleViewJson(): void {
    if (this.multiUserBlocked()) {
      this.toastService.warning(this.translationService.translate('appbar.multiUserExportBlocked'));
      return;
    }
    this.viewJson.emit();
  }

  handleOpenImportJson(): void {
    if (this.multiUserBlocked()) {
      this.toastService.warning(this.translationService.translate('appbar.multiUserImportBlocked'));
      return;
    }
    this.openImportJson.emit();
  }

  triggerFileInput(): void {
    if (this.multiUserBlocked()) {
      this.toastService.warning(this.translationService.translate('appbar.multiUserImportBlocked'));
      return;
    }
    this.fileInputRef?.nativeElement?.click();
  }

  copyRoomCode(): void {
    const code = this.collaborationService.activeRoomCode();
    if (code) {
      navigator.clipboard.writeText(code).then(() => {
        this.toastService.success(`Código de sala "${code}" copiado al portapapeles.`);
      });
    }
  }

  @ViewChild('nativeColorInput') nativeColorInputRef?: ElementRef<HTMLInputElement>;
  private isPickerOpen = false;

  constructor() {
    effect(() => {
      const color = this.selectedNodeColor() || '#FDFAF3';
      if (!this.isPickerOpen && this.nativeColorInputRef?.nativeElement) {
        this.nativeColorInputRef.nativeElement.value = color;
      }
    });
  }

  ngAfterViewInit(): void {
    if (this.nativeColorInputRef?.nativeElement) {
      this.nativeColorInputRef.nativeElement.value = this.selectedNodeColor() || '#FDFAF3';
    }
  }

  onColorPickerFocus(): void {
    this.isPickerOpen = true;
  }

  onColorPickerBlur(): void {
    this.isPickerOpen = false;
    if (this.nativeColorInputRef?.nativeElement) {
      this.nativeColorInputRef.nativeElement.value = this.selectedNodeColor() || '#FDFAF3';
    }
  }

  onCustomColorInput(event: Event): void {
    this.isPickerOpen = true;
    const target = event.target as HTMLInputElement;
    if (target?.value) {
      this.changeNodeColor.emit(target.value);
    }
  }

  onCustomColorChange(event: Event): void {
    this.isPickerOpen = false;
    const target = event.target as HTMLInputElement;
    if (target?.value) {
      this.changeNodeColor.emit(target.value);
    }
  }
}
