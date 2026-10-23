import { PluginRegistryService } from '../../../../../core/plugins/plugin-registry.service';
import { Component, ChangeDetectionStrategy, inject, signal, computed, input, output, ElementRef, ViewChild, AfterViewInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroPencilSquare,
  heroUserGroup,
  heroDocumentChartBar,
  heroArrowDownTray,
  heroArrowUpTray,
  heroDocumentText,
  heroBolt,
  heroChevronDown,
  heroChevronUp,
  heroArrowRightOnRectangle,
  heroUserCircle,
  heroClipboardDocument,
  heroFolder,
  heroCloudArrowUp,
  heroEye,
  heroCheck,
  heroPhoto,
  heroAcademicCap,
  heroSparkles,
  heroMagnifyingGlassPlus,
  heroMagnifyingGlassMinus,
  heroArrowsPointingOut,
  heroArrowPath,
  heroSquares2x2,
  heroCursorArrowRays,
  heroArrowUturnLeft,
  heroArrowUturnRight,
  heroCog6Tooth,
} from '@ng-icons/heroicons/outline';
import { AuthService } from '../../../../../core/services/auth.service';
import { CollaborationService } from '../../../../../core/services/collaboration.service';
import { UserGuideService } from '../../../../../core/plugins/contracts/user-guide.contract';
import { TranslatePipe, LanguageSelectorComponent, TranslationService } from '../../../../../core/i18n/index';
import { ThemeToggleComponent } from '../../../../../core/components/theme-toggle/theme-toggle.component';
import { ToastService } from '../../../../../core/services/toast.service';

export type RibbonTab = 'design' | 'develop' | 'collaborate' | 'publish';
type WorkspaceMenu = 'file' | 'export' | 'preferences';

@Component({
  selector: 'app-diagram-appbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:pointerdown)': 'onOutsidePointerDown($event)' },
  imports: [CommonModule, RouterLink, NgIconComponent, TranslatePipe, LanguageSelectorComponent, ThemeToggleComponent],
  providers: [
    provideIcons({
      heroPencilSquare,
      heroUserGroup,
      heroDocumentChartBar,
      heroArrowDownTray,
      heroArrowUpTray,
      heroDocumentText,
      heroBolt,
      heroChevronDown,
      heroChevronUp,
      heroArrowRightOnRectangle,
      heroUserCircle,
      heroClipboardDocument,
      heroFolder,
      heroCloudArrowUp,
      heroEye,
      heroCheck,
      heroPhoto,
      heroAcademicCap,
      heroSparkles,
      heroMagnifyingGlassPlus,
      heroMagnifyingGlassMinus,
      heroArrowsPointingOut,
      heroArrowPath,
      heroSquares2x2,
      heroCursorArrowRays,
      heroArrowUturnLeft,
      heroArrowUturnRight,
      heroCog6Tooth,
    }),
  ],
  templateUrl: './diagram-appbar.component.html',
  styleUrl: './diagram-appbar.component.css',
})
export class DiagramAppbarComponent implements AfterViewInit {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly projectId = input<string | null>(null);
  readonly projectTitle = input('');
  readonly menu = signal<WorkspaceMenu | null>(null);
  readonly importExpanded = signal(false);
  readonly tabs: { id: RibbonTab; icon: string; label: string }[] = [
    { id: 'design', icon: 'heroPencilSquare', label: 'ribbon.tabs.design' },
    { id: 'develop', icon: 'heroBolt', label: 'ribbon.tabs.develop' },
    { id: 'collaborate', icon: 'heroUserGroup', label: 'ribbon.tabs.collaborate' },
    { id: 'publish', icon: 'heroArrowDownTray', label: 'ribbon.tabs.publish' },
  ];
  readonly saveStatusKey = computed(() => this.isReadOnly() ? 'appbar.spectatorMode'
    : this.isSaving() ? 'appbar.autoSaving'
    : this.hasUnsavedChanges() ? 'workspace.pendingChanges' : 'appbar.autoSaved');

  /** Abre un único menú y lleva el foco a su primera acción disponible tras renderizar. */
  toggleMenu(menu: WorkspaceMenu): void {
    if (this.menu() === menu) {
      this.closeMenu();
      return;
    }
    this.menu.set(menu);
    this.importExpanded.set(false);
    setTimeout(() => {
      if (this.menu() === menu) this.element.nativeElement.querySelector<HTMLElement>('.workspace-menu button:not(:disabled), .workspace-menu a:not([aria-disabled="true"])')?.focus();
    });
  }

  /** Cierra el desplegable y opcionalmente devuelve el foco al control de apertura. */
  closeMenu(restoreFocus = false): void {
    const menu = this.menu();
    this.menu.set(null);
    this.importExpanded.set(false);
    if (restoreFocus && menu) this.element.nativeElement.querySelector<HTMLElement>(`[data-menu-trigger="${menu}"]`)?.focus();
  }

  /** Cierra menús al pulsar fuera del encabezado, sin interceptar otros controles. */
  onOutsidePointerDown(event: PointerEvent): void {
    if (event.target instanceof Node && !this.element.nativeElement.contains(event.target)) this.closeMenu();
  }

  /** Aísla los atajos del lienzo y permite recorrer menús con flechas, Inicio, Fin y Escape. */
  onMenuKeyDown(event: KeyboardEvent): void {
    event.stopPropagation();
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      this.saveProject();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeMenu(true);
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const container = event.currentTarget as HTMLElement;
    const items = Array.from(container.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled):not([aria-disabled="true"])'));
    if (!items.length) return;
    event.preventDefault();
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
      : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next].focus();
  }

  /** Alterna las opciones de importación dentro del menú de proyecto. */
  toggleImport(): void { this.importExpanded.update(value => !value); }

  /** Envía un guardado manual respetando permisos y solicitudes de guardado en curso. */
  saveProject(): void {
    if (!this.diagramId() || this.isReadOnly() || this.isSaving()) return;
    this.closeMenu();
    this.saveDiagram.emit();
  }

  /** Dirige el acceso de File a la única lista de exportación ubicada en Publish. */
  showPublish(): void {
    this.onTabClick('publish');
    this.toggleMenu('export');
  }
  readonly authService = inject(AuthService);
  readonly collaborationService = inject(CollaborationService);
  readonly plugins = inject(PluginRegistryService);
  /**
   * Obtiene la instancia del servicio de guía de usuario si el plugin está registrado.
   */
  get guideService(): UserGuideService | undefined { return this.plugins.has(UserGuideService) ? this.plugins.resolve(UserGuideService) : undefined; }
  readonly translationService = inject(TranslationService);
  readonly toastService = inject(ToastService);

  // Tab activo en el Ribbon al estilo Enterprise Architect
  readonly activeTab = signal<RibbonTab>('design');

  // Estado de minimización / colapso del Ribbon (doble clic)
  readonly isCollapsed = signal<boolean>(false);

  /**
   * Alterna el estado colapsado o expandido de la barra de cinta superior (Ribbon).
   */
  toggleCollapse(): void {
    this.closeMenu();
    this.isCollapsed.update(val => !val);
  }

  /**
   * Gestiona el clic en una pestaña de la barra de cinta, expandiéndola si estaba colapsada.
   * @param tab Pestaña seleccionada.
   */
  onTabClick(tab: RibbonTab): void {
    this.closeMenu();
    this.activeTab.set(tab);
    this.isCollapsed.set(false);
  }

  /**
   * Gestiona el doble clic sobre una pestaña para alternar el colapso del menú superior.
   * @param tab Pestaña pulsada dos veces.
   * @param event Evento del ratón.
   */
  onTabDblClick(tab: RibbonTab, event?: MouseEvent): void {
    event?.stopPropagation();
    event?.preventDefault();
    this.toggleCollapse();
  }

  /**
   * Abre la guía de usuario interactiva del editor.
   */
  openGuide(): void {
    this.closeMenu();
    this.guideService?.openGuide();
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
  readonly isAiPanelOpen = input(false);
  readonly canUndo = input<boolean>(false);
  readonly canRedo = input<boolean>(false);
  readonly selectedNodeId = input<string | null>(null);
  readonly selectedNodeColor = input<string | null>(null);
  readonly selectedNodesCount = input<number>(0);
  readonly smartGuidesEnabled = input<boolean>(true);

  // Colores predefinidos modernos
  readonly presetColors = [
    { color: '#FDFAF3' },
    { color: '#BAE6FD' },
    { color: '#BFDBFE' },
    { color: '#FBCFE8' },
    { color: '#F5D0FE' },
    { color: '#E9D5FF' },
    { color: '#E2E8F0' },
    { color: '#FFFFFF' },
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
  readonly toggleAi = output<void>();
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

  /**
   * Emite el evento de exportación en mapa de bits BMP si no está bloqueado por concurrencia multiusuario.
   */
  handleExportBmp(): void {
    this.closeMenu();
    if (this.multiUserBlocked()) {
      this.toastService.warning(this.translationService.translate('appbar.multiUserExportBlocked'));
      return;
    }
    this.exportBmp.emit();
  }

  /**
   * Emite el evento de exportación en imagen PNG si no está bloqueado por concurrencia multiusuario.
   */
  handleExportPng(): void {
    this.closeMenu();
    if (this.multiUserBlocked()) {
      this.toastService.warning(this.translationService.translate('appbar.multiUserExportBlocked'));
      return;
    }
    this.exportPng.emit();
  }

  /**
   * Emite el evento de exportación en formato XMI (Enterprise Architect) si está permitido.
   */
  handleExportXmi(): void {
    this.closeMenu();
    if (this.multiUserBlocked()) {
      this.toastService.warning(this.translationService.translate('appbar.multiUserExportBlocked'));
      return;
    }
    this.exportXmi.emit();
  }

  /**
   * Emite el evento de exportación del AST completo del diagrama en formato JSON.
   */
  handleExportJson(): void {
    this.closeMenu();
    if (this.multiUserBlocked()) {
      this.toastService.warning(this.translationService.translate('appbar.multiUserExportBlocked'));
      return;
    }
    this.exportJson.emit();
  }

  /**
   * Abre el visor modal del código JSON representativo del diagrama.
   */
  handleViewJson(): void {
    this.closeMenu();
    if (this.multiUserBlocked()) {
      this.toastService.warning(this.translationService.translate('appbar.multiUserExportBlocked'));
      return;
    }
    this.viewJson.emit();
  }

  /**
   * Abre el modal de importación de diagramas desde JSON.
   */
  handleOpenImportJson(): void {
    if (this.isReadOnly()) return;
    this.closeMenu();
    if (this.multiUserBlocked()) {
      this.toastService.warning(this.translationService.translate('appbar.multiUserImportBlocked'));
      return;
    }
    this.openImportJson.emit();
  }

  /**
   * Activa el selector de archivos nativo del navegador para importar modelos.
   */
  triggerFileInput(): void {
    if (this.isReadOnly()) return;
    this.closeMenu();
    if (this.multiUserBlocked()) {
      this.toastService.warning(this.translationService.translate('appbar.multiUserImportBlocked'));
      return;
    }
    this.fileInputRef?.nativeElement?.click();
  }

  /**
   * Copia el código de la sala de colaboración en tiempo real al portapapeles.
   */
  copyRoomCode(): void {
    const code = this.collaborationService.activeRoomCode();
    if (code) {
      navigator.clipboard.writeText(code).then(() => {
        this.toastService.success(this.translationService.translate('workspace.roomCopied'));
      }).catch(() => this.toastService.warning(this.translationService.translate('workspace.copyFailed')));
    }
  }

  nativeColorInputRef?: ElementRef<HTMLInputElement>;
  private isPickerOpen = false;

  /** Inicializa cada nueva paleta contextual sin sobrescribir un selector de color abierto. */
  @ViewChild('nativeColorInput')
  set nativeColorInput(ref: ElementRef<HTMLInputElement> | undefined) {
    this.nativeColorInputRef = ref;
    this.isPickerOpen = false;
    if (ref) ref.nativeElement.value = this.selectedNodeColor() || '#FDFAF3';
  }

  constructor() {
    effect(() => {
      const color = this.selectedNodeColor() || '#FDFAF3';
      if (!this.isPickerOpen && this.nativeColorInputRef?.nativeElement) {
        this.nativeColorInputRef.nativeElement.value = color;
      }
    });
  }

  /**
   * Inicializa el valor del selector nativo de color tras renderizar la vista.
   */
  ngAfterViewInit(): void {
    if (this.nativeColorInputRef?.nativeElement) {
      this.nativeColorInputRef.nativeElement.value = this.selectedNodeColor() || '#FDFAF3';
    }
  }

  /**
   * Registra el foco sobre el selector nativo de color para evitar sobreescrituras reactivas mientras el usuario elige.
   */
  onColorPickerFocus(): void {
    this.isPickerOpen = true;
  }

  /**
   * Registra la pérdida de foco del selector nativo de color para reanudar la sincronización reactiva.
   */
  onColorPickerBlur(): void {
    this.isPickerOpen = false;
    if (this.nativeColorInputRef?.nativeElement) {
      this.nativeColorInputRef.nativeElement.value = this.selectedNodeColor() || '#FDFAF3';
    }
  }

  /**
   * Emite el cambio en tiempo real mientras el usuario desliza el puntero en la paleta de color personalizada.
   * @param event Evento de input del navegador.
   */
  onCustomColorInput(event: Event): void {
    this.isPickerOpen = true;
    const target = event.target as HTMLInputElement;
    if (target?.value) {
      this.changeNodeColor.emit(target.value);
    }
  }

  /**
   * Emite el valor definitivo cuando el usuario cierra o confirma el selector de color personalizado.
   * @param event Evento change del elemento input.
   */
  onCustomColorChange(event: Event): void {
    this.isPickerOpen = false;
    const target = event.target as HTMLInputElement;
    if (target?.value) {
      this.changeNodeColor.emit(target.value);
    }
  }
}
