import { NodePluginRegistryService } from '../../../../../core/plugins/node-plugin-registry.service';
import { PluginOutletDirective } from '../../../../../core/plugins/plugin-outlet.directive';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroArrowsPointingOut,
  heroArrowsUpDown,
  heroBars2,
  heroBars3,
  heroChatBubbleLeftRight,
  heroCheck,
  heroChevronDown,
  heroChevronLeft,
  heroChevronRight,
  heroChevronUp,
  heroCloud,
  heroComputerDesktop,
  heroCpuChip,
  heroCube,
  heroCursorArrowRays,
  heroDocumentDuplicate,
  heroDocumentText,
  heroEllipsisHorizontalCircle,
  heroFolder,
  heroFolderOpen,
  heroMagnifyingGlassMinus,
  heroMagnifyingGlassPlus,
  heroPencilSquare,
  heroPlus,
  heroServer,
  heroSparkles,
  heroSquare3Stack3d,
  heroSquares2x2,
  heroTrash,
  heroUser,
  heroUserGroup,
  heroXMark,
} from '@ng-icons/heroicons/outline';
import {
  DiagramDto,
  DiagramType,
  DiagramTypeItem,
  UML_COMMUNICATION_RELATION_TYPES,
  UML_COMPONENT_RELATION_TYPES,
  UML_DEPLOYMENT_RELATION_TYPES,
  UML_DIAGRAM_TYPES,
  UML_LINE_STYLES,
  UML_PACKAGE_RELATION_TYPES,
  UML_RELATION_TYPES,
  UML_SEQUENCE_RELATION_TYPES,
  UML_USE_CASE_RELATION_TYPES,
  UmlLineStyle,
  UmlLineStyleItem,
  UmlRelationTypeItem,
  UmlRelationshipType,
} from '../../../../../core/models/diagram.model';
import { TranslatePipe, TranslationService } from '../../../../../core/i18n/index';
import { UML_SVG_COMPONENTS } from '../../../../../plugin-sdk/ui/uml-svg/index';
import { SHARED_DIAGRAM_UI_COMPONENTS } from '../../../../../plugin-sdk/ui/shared-ui/index';
import { UmlNodeNormalizerUtil } from '../../../../../core/plugins/contracts/uml-node-normalizer.util.contract';
import {
  computeDroppedDiagramOrder,
  computeMovedDiagramOrder,
  loadCustomDiagramOrder,
  loadSavedSidebarWidth,
  saveCustomDiagramOrder,
  saveSidebarWidth,
  setExplorerNodeDragTransfer,
  setToolboxDragTransfer,
  sortDiagramsByCustomOrder,
} from './diagram-sidebar-explorer.util';

const RELATION_TYPES_BY_DIAGRAM: Partial<Record<DiagramType, UmlRelationTypeItem[]>> = {
  [DiagramType.USE_CASE]: UML_USE_CASE_RELATION_TYPES,
  [DiagramType.PACKAGE]: UML_PACKAGE_RELATION_TYPES,
  [DiagramType.LAYERED]: UML_PACKAGE_RELATION_TYPES,
  [DiagramType.COMPONENT]: UML_COMPONENT_RELATION_TYPES,
  [DiagramType.COMMUNICATION]: UML_COMMUNICATION_RELATION_TYPES,
  [DiagramType.DEPLOYMENT]: UML_DEPLOYMENT_RELATION_TYPES,
  [DiagramType.SEQUENCE]: UML_SEQUENCE_RELATION_TYPES,
};

/**
 * Barra lateral del editor de diagramas UML.
 * Agrupa el Explorador del proyecto (árbol de diagramas y nodos) y la Caja de Herramientas (Toolbox) contextual.
 */
@Component({
  selector: 'app-diagram-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PluginOutletDirective,
    CommonModule,
    FormsModule,
    NgIconComponent,
    TranslatePipe,
    ...UML_SVG_COMPONENTS,
    ...SHARED_DIAGRAM_UI_COMPONENTS,
  ],
  providers: [
    provideIcons({
      heroBars3,
      heroBars2,
      heroChevronLeft,
      heroChevronDown,
      heroChevronUp,
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
      heroFolder,
      heroDocumentText,
      heroUser,
      heroEllipsisHorizontalCircle,
      heroPencilSquare,
      heroTrash,
      heroXMark,
      heroDocumentDuplicate,
      heroCpuChip,
      heroCube,
      heroSquares2x2,
      heroSparkles,
      heroServer,
      heroComputerDesktop,
      heroCloud,
    }),
  ],
  host: {
    'style': 'display: flex; height: 100%; flex-shrink: 0; min-height: 0;',
    '(window:keydown)': 'onExplorerKeyDown($event)',
    '(window:mousemove)': 'onWindowMouseMove($event)',
    '(window:mouseup)': 'onWindowMouseUp()',
  },
  templateUrl: './diagram-sidebar.component.html',
})
export class DiagramSidebarComponent {
  private readonly normalizer = inject(UmlNodeNormalizerUtil);
  readonly nodePlugins = inject(NodePluginRegistryService);
  readonly addPluginNode = output<{ type: string; stereotype?: string }>();
  readonly pluginTools = computed(() => this.nodePlugins.plugins().flatMap(plugin => plugin.tools.filter(tool => tool.diagramTypes.includes(this.activeDiagramType())).map(tool => ({ ...tool, type: plugin.nodeTypes[0] }))));
  readonly DiagramType = DiagramType;
  protected readonly translationService = inject(TranslationService);

  readonly activeTab = signal<'toolbox' | 'explorer'>('explorer');
  readonly sidebarWidth = signal<number>(280);
  readonly isResizing = signal<boolean>(false);
  private resizeStartX = 0;
  private resizeStartWidth = 280;

  readonly editingDiagramId = signal<string | null>(null);
  readonly editingDiagramName = signal<string>('');
  readonly hoveredDiagramId = signal<string | null>(null);
  readonly expandedDiagrams = signal<Record<string, boolean>>({});

  readonly isOpen = input<boolean>(false);
  readonly activeDiagramType = input<DiagramType>(DiagramType.CLASS);
  readonly selectedRelationType = input<UmlRelationshipType | null>(null);
  readonly defaultLineStyle = input<UmlLineStyle>('segment');
  readonly isReadOnly = input<boolean>(false);
  readonly relationTypes = input<UmlRelationTypeItem[]>(UML_RELATION_TYPES);
  readonly lineStyles = input<UmlLineStyleItem[]>(UML_LINE_STYLES);
  readonly diagramTypes = input<DiagramTypeItem[]>(UML_DIAGRAM_TYPES);

  readonly projectDiagrams = input<DiagramDto[]>([]);
  readonly currentDiagramId = input<string | null>(null);
  readonly currentProjectId = input<string | null>(null);
  readonly currentProjectName = input<string>('');
  readonly currentNodes = input<any[]>([]);

  readonly customDiagramOrder = signal<string[]>([]);
  readonly draggedDiagramId = signal<string | null>(null);
  readonly draggedNodeId = signal<string | null>(null);
  readonly dragOverDiagramId = signal<string | null>(null);
  readonly dragOverPosition = signal<'above' | 'below' | null>(null);

  readonly isRelationshipsOpen = signal<boolean>(true);
  readonly isLineStylesOpen = signal<boolean>(true);

  readonly expandedFolders = signal<Record<string, boolean>>({
    [DiagramType.CLASS]: false,
    [DiagramType.USE_CASE]: false,
    [DiagramType.SEQUENCE]: false,
    [DiagramType.COMMUNICATION]: false,
    [DiagramType.PACKAGE]: false,
    [DiagramType.COMPONENT]: false,
    [DiagramType.DEPLOYMENT]: false,
    [DiagramType.LAYERED]: false,
    [DiagramType.CLASS_ANALYSIS]: false,
  });

  readonly diagramsByType = computed<Map<DiagramType, DiagramDto[]>>(() => {
    const map = new Map<DiagramType, DiagramDto[]>();
    for (const dt of UML_DIAGRAM_TYPES) map.set(dt.id, []);
    for (const diag of this.projectDiagrams()) {
      const type = (diag.type as DiagramType) || DiagramType.CLASS;
      const list = map.get(type) || [];
      list.push(diag);
      map.set(type, list);
    }
    return map;
  });

  readonly diagramSearch = signal('');
  readonly normalizedDiagramSearch = computed(() => this.normalizeSearchText(this.diagramSearch()));
  readonly visibleDiagramsByType = computed(() => {
    const query = this.normalizedDiagramSearch();
    return new Map(this.diagramTypes().map(type => [
      type.id,
      this.getDiagramsForType(type.id).filter(diagram => this.normalizeSearchText(diagram.name).includes(query)),
    ]));
  });
  readonly visibleDiagramTypes = computed(() => this.diagramTypes().filter(
    type => (this.visibleDiagramsByType().get(type.id)?.length ?? 0) > 0
  ));

  /** Normaliza nombres para buscar sin distinguir mayúsculas, tildes ni espacios externos. */
  private normalizeSearchText(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  /** Obtiene coincidencias sin modificar los datos ni el orden completo del proyecto. */
  getVisibleDiagramsForType(type: DiagramType): DiagramDto[] {
    return this.visibleDiagramsByType().get(type) ?? [];
  }

  readonly currentRelations = computed<UmlRelationTypeItem[]>(
    () => RELATION_TYPES_BY_DIAGRAM[this.activeDiagramType()] ?? UML_RELATION_TYPES
  );

  readonly closeSidebar = output<void>();
  readonly openSidebar = output<void>();

  /** Cambia de sección o colapsa la activa; conserva la pestaña al ocultar el panel. */
  selectPanel(tab: 'toolbox' | 'explorer'): void {
    if (this.isOpen() && this.activeTab() === tab) this.closeSidebar.emit();
    else { this.activeTab.set(tab); this.openSidebar.emit(); }
  }

  readonly diagramTypeChange = output<DiagramType>();
  readonly setPointerMode = output<void>();
  readonly selectRelationType = output<UmlRelationshipType>();
  readonly setDefaultLineStyle = output<UmlLineStyle>();
  readonly zoomIn = output<void>();
  readonly zoomOut = output<void>();
  readonly resetView = output<void>();
  readonly fitView = output<void>();
  readonly addClass = output<void>();
  readonly addClassWithStereotype = output<string>();
  readonly addActor = output<void>();
  readonly addUseCase = output<void>();
  readonly addPackage = output<void>();
  readonly addBoundary = output<void>();
  readonly addControl = output<void>();
  readonly addEntity = output<void>();
  readonly addLifeline = output<void>();
  readonly addDevice = output<void>();
  readonly addExecutionEnvironment = output<void>();
  readonly addComponent = output<void>();
  readonly addBoundaryBox = output<void>();

  readonly selectDiagram = output<string>();
  readonly openCreateDiagram = output<DiagramType | null>();
  readonly renameDiagram = output<{ diagramId: string; name: string }>();
  readonly deleteDiagram = output<string>();
  readonly copyNodeToCurrent = output<{
    node: any;
    sourceDiagramId: string;
    sourceDiagramType?: DiagramType;
  }>();
  readonly selectNode = output<string>();

  constructor() {
    const savedWidth = loadSavedSidebarWidth();
    if (savedWidth !== null) this.sidebarWidth.set(savedWidth);

    effect(() => {
      const pid = this.currentProjectId();
      if (pid) this.customDiagramOrder.set(loadCustomDiagramOrder(pid));
    });
  }

  /**
   * Traduce una clave utilizando el servicio de i18n o devuelve el texto alternativo si no existe traducción.
   * @param key Clave de internacionalización.
   * @param fallback Texto predeterminado.
   * @returns Traducción o texto por defecto.
   */
  private translateWithFallback(key: string, fallback: string): string {
    this.translationService.currentLang();
    const translated = this.translationService.translate(key);
    return translated !== key ? translated : fallback;
  }

  /**
   * Obtiene la etiqueta traducida para un tipo de relación UML.
   * @param rel Ítem de relación UML.
   * @returns Nombre de la relación para la UI.
   */
  getRelationLabel(rel: UmlRelationTypeItem): string {
    return this.translateWithFallback(`editor.toolbox.${rel.id}`, rel.label);
  }

  /**
   * Obtiene la descripción explicativa de un tipo de relación UML para tooltips.
   * @param rel Ítem de relación UML.
   * @returns Texto descriptivo.
   */
  getRelationDescription(rel: UmlRelationTypeItem): string {
    return this.translateWithFallback(`editor.toolbox.${rel.id}Desc`, rel.description);
  }

  /**
   * Obtiene el nombre del estilo de línea (directa, ortogonal, bezier, etc.).
   * @param id Identificador del estilo de línea.
   * @param fallback Texto por defecto si no hay traducción.
   * @returns Etiqueta localizada.
   */
  getLineStyleLabel(id: string, fallback: string): string {
    return this.translateWithFallback(`editor.toolbox.${id}`, fallback);
  }

  /**
   * Obtiene la etiqueta legible de un tipo de diagrama UML.
   * @param dt Objeto o identificador del tipo de diagrama.
   * @returns Nombre localizado del tipo de diagrama.
   */
  getDiagramTypeLabel(dt: DiagramTypeItem | DiagramType | string): string {
    const id = typeof dt === 'string' ? dt : dt.id;
    const fallback = typeof dt === 'object' ? dt.label : id;
    return this.translateWithFallback(`editor.explorer.folders.${id}`, fallback);
  }

  /**
   * Obtiene el nombre de la carpeta virtual para un tipo de diagrama en el explorador.
   * @param dt Ítem del tipo de diagrama.
   * @returns Nombre de carpeta traducido.
   */
  getDiagramTypeFolderName(dt: DiagramTypeItem): string {
    return this.translateWithFallback(`editor.explorer.folders.${dt.id}`, dt.folderName);
  }

  /**
   * Obtiene el nombre legible para un tipo de nodo en el árbol del explorador.
   * @param nodeType Tipo de nodo UML ('class', 'actor', 'component', etc.).
   * @returns Etiqueta formateada.
   */
  getNodeTypeLabel(nodeType: string): string {
    return this.translateWithFallback(`editor.explorer.nodeTypes.${nodeType}`, nodeType);
  }

  /**
   * Alterna la expansión o colapso del nodo de un diagrama en el explorador de proyecto.
   * @param diagramId Identificador del diagrama a alternar.
   * @param event Evento del ratón.
   */
  toggleDiagramExpanded(diagramId: string, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.expandedDiagrams.set({
      ...this.expandedDiagrams(),
      [diagramId]: !this.isDiagramExpanded(diagramId),
    });
  }

  /**
   * Verifica si un diagrama tiene su lista de nodos desplegada en el árbol.
   * @param diagramId Identificador del diagrama.
   * @returns Verdadero si está expandido.
   */
  isDiagramExpanded(diagramId: string): boolean {
    const map = this.expandedDiagrams();
    return map[diagramId] !== undefined ? map[diagramId] : diagramId === this.currentDiagramId();
  }

  /**
   * Obtiene la lista de nodos válidos correspondientes a un diagrama del proyecto.
   * @param diag DTO del diagrama.
   * @returns Arreglo de nodos excluyendo anclas de routing.
   */
  getNodesForDiagram(diag: DiagramDto): any[] {
    const source = diag.id === this.currentDiagramId() ? this.currentNodes() : diag.nodes;
    return (source || []).filter((n) => !n.isAnchor);
  }

  /**
   * Comprueba si un tipo de nodo es compatible con el tipo del diagrama actualmente abierto.
   * @param nodeType Tipo de nodo.
   * @param _sourceDiagramType Tipo del diagrama de procedencia.
   * @returns Verdadero si puede ser insertado en el diagrama actual.
   */
  isNodeTypeCompatibleWithCurrent(
    nodeType?: string,
    _sourceDiagramType?: DiagramType | string
  ): boolean {
    return this.normalizer.isNodeTypeCompatible(nodeType, this.activeDiagramType());
  }

  /**
   * Construye el texto de ayuda o tooltip contextual al pasar el ratón sobre un nodo en el explorador.
   * @param diag Diagrama contenedor.
   * @param node Elemento o nodo inspeccionado.
   * @returns Texto descriptivo de la acción posible (copiar, duplicar o aviso de incompatibilidad).
   */
  getCopyTooltip(diag: DiagramDto, node: any): string {
    this.translationService.currentLang();
    const typeLabel = this.getNodeTypeLabel(node.nodeType);
    if (diag.id === this.currentDiagramId()) {
      return this.translationService.translate('editor.explorer.duplicateNode', {
        type: typeLabel,
        name: node.name,
      });
    }
    if (!this.isNodeTypeCompatibleWithCurrent(node.nodeType, diag.type)) {
      return this.translationService.translate('editor.explorer.incompatibleNode', {
        type: this.getDiagramTypeLabel(this.activeDiagramType()),
      });
    }
    return this.translationService.translate('editor.explorer.copyNode', {
      type: typeLabel,
      name: node.name,
    });
  }

  /**
   * Emite la solicitud de copia o duplicación de un nodo del explorador hacia el diagrama activo.
   * @param diag Diagrama de procedencia.
   * @param node Nodo a copiar.
   * @param event Evento del ratón.
   */
  onCopyNode(diag: DiagramDto, node: any, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (this.isReadOnly()) return;
    this.copyNodeToCurrent.emit({
      node,
      sourceDiagramId: diag.id,
      sourceDiagramType: (diag.type as DiagramType) || DiagramType.CLASS,
    });
  }

  /**
   * Gestiona el clic en un nodo del explorador: si pertenece al diagrama activo lo selecciona, si no lo copia.
   * @param diag Diagrama contenedor.
   * @param node Nodo pulsado.
   * @param event Evento del ratón.
   */
  onNodeItemClick(diag: DiagramDto, node: any, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (diag.id === this.currentDiagramId()) this.selectNode.emit(node.id);
    else this.onCopyNode(diag, node);
  }

  /**
   * Gestiona accesos rápidos por teclado en el explorador, como F2 para renombrar.
   * @param event Evento de pulsación de teclado.
   */
  onExplorerKeyDown(event: KeyboardEvent): void {
    if (this.activeTab() !== 'explorer' || this.isReadOnly() || !this.isOpen()) return;
    if (event.key === 'F2') {
      const targetId = this.hoveredDiagramId();
      if (targetId && !this.editingDiagramId()) {
        const diag = this.projectDiagrams().find((d) => d.id === targetId);
        if (diag) {
          event.preventDefault();
          this.startRenameDiagram(diag);
        }
      }
    }
  }

  /**
   * Activa el modo de edición en línea del nombre de un diagrama.
   * @param diag Diagrama a renombrar.
   * @param event Evento del ratón opcional.
   */
  startRenameDiagram(diag: DiagramDto, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (this.isReadOnly()) return;
    this.editingDiagramId.set(diag.id);
    this.editingDiagramName.set(diag.name);
  }

  /**
   * Confirma y emite el nuevo nombre asignado al diagrama en el explorador.
   * @param diagId Identificador del diagrama modificado.
   */
  saveRenameDiagram(diagId: string): void {
    const newName = this.editingDiagramName().trim();
    if (newName && this.editingDiagramId() === diagId) {
      this.renameDiagram.emit({ diagramId: diagId, name: newName });
    }
    this.editingDiagramId.set(null);
  }

  /**
   * Cancela la edición en línea del nombre del diagrama sin guardar cambios.
   */
  cancelRenameDiagram(): void {
    this.editingDiagramId.set(null);
  }

  /**
   * Emite la solicitud de eliminación de un diagrama del proyecto.
   * @param diag Diagrama a eliminar.
   * @param event Evento de clic.
   */
  onDeleteDiagram(diag: DiagramDto, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.isReadOnly()) this.deleteDiagram.emit(diag.id);
  }

  /**
   * Emite el cambio de tipo de diagrama UML activo.
   * @param type Nuevo tipo de diagrama.
   */
  onSelectDiagramType(type: DiagramType): void { this.diagramTypeChange.emit(type); }

  /**
   * Activa el modo de selección y puntero general en el lienzo.
   */
  onSelectPointer(): void { this.setPointerMode.emit(); }

  /**
   * Selecciona una herramienta de relación para enlazar elementos.
   * @param type Tipo de relación UML a dibujar.
   */
  onSelectRelation(type: UmlRelationshipType): void { this.selectRelationType.emit(type); }

  /**
   * Establece el estilo de trazado predeterminado para las nuevas conexiones.
   * @param style Estilo de enrutamiento ('segment', 'orthogonal', etc.).
   */
  onSetLineStyle(style: UmlLineStyle): void { this.setDefaultLineStyle.emit(style); }

  /**
   * Alterna la visibilidad de una carpeta de categoría de diagrama en el árbol del explorador.
   * @param type Tipo de diagrama correspondiente a la carpeta.
   */
  toggleFolder(type: DiagramType): void {
    const curr = this.expandedFolders();
    this.expandedFolders.set({ ...curr, [type]: !curr[type] });
  }

  /**
   * Inicia el arrastre interactivo para redimensionar el ancho del panel lateral.
   * @param event Evento inicial mousedown.
   */
  onStartResize(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isResizing.set(true);
    this.resizeStartX = event.clientX;
    this.resizeStartWidth = this.sidebarWidth();
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }

  /**
   * Actualiza dinámicamente el ancho del panel lateral mientras se arrastra el separador.
   * @param event Evento mousemove global.
   */
  onWindowMouseMove(event: MouseEvent): void {
    if (!this.isResizing()) return;
    const delta = event.clientX - this.resizeStartX;
    this.sidebarWidth.set(Math.min(Math.max(220, this.resizeStartWidth + delta), 750));
  }

  /**
   * Finaliza la operación de redimensionado del panel lateral y guarda la preferencia de ancho.
   */
  onWindowMouseUp(): void {
    if (!this.isResizing()) return;
    this.isResizing.set(false);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    saveSidebarWidth(this.sidebarWidth());
  }

  /**
   * Restablece el ancho del panel lateral a su dimensión predeterminada (280px).
   * @param event Evento del ratón.
   */
  resetWidth(event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.sidebarWidth.set(280);
    saveSidebarWidth(280);
  }

  /**
   * Comprueba si la carpeta de una categoría de diagramas está expandida.
   * @param type Tipo de diagrama consultado.
   * @returns Verdadero si está desplegada.
   */
  isFolderExpanded(type: DiagramType): boolean {
    return !!this.normalizedDiagramSearch() || !!this.expandedFolders()[type];
  }

  /**
   * Obtiene la lista ordenada de diagramas de un tipo específico respetando el orden personalizado.
   * @param type Categoría de diagrama UML.
   * @returns Lista ordenada de diagramas.
   */
  getDiagramsForType(type: DiagramType): DiagramDto[] {
    return sortDiagramsByCustomOrder(
      this.diagramsByType().get(type) || [],
      this.customDiagramOrder()
    );
  }

  /**
   * Reordena un diagrama desplazándolo hacia arriba o abajo dentro de su categoría.
   * @param diagramId Identificador del diagrama a mover.
   * @param direction Sentido del desplazamiento ('up' o 'down').
   * @param type Tipo de diagrama correspondiente.
   * @param event Evento del ratón.
   */
  moveDiagram(
    diagramId: string,
    direction: 'up' | 'down',
    type: DiagramType,
    event?: MouseEvent
  ): void {
    if (event) event.stopPropagation();
    if (this.isReadOnly() || this.normalizedDiagramSearch()) return;
    const nextOrder = computeMovedDiagramOrder(
      this.getDiagramsForType(type),
      this.customDiagramOrder(),
      diagramId,
      direction
    );
    if (nextOrder) {
      this.customDiagramOrder.set(nextOrder);
      saveCustomDiagramOrder(this.currentProjectId(), nextOrder);
    }
  }

  /**
   * Configura la información de transferencia al arrastrar una herramienta desde la caja de herramientas al lienzo.
   * @param nodeType Tipo de nodo UML.
   * @param event Evento DragEvent del navegador.
   * @param stereotype Estereotipo asociado (opcional).
   */
  onToolboxDragStart(nodeType: string, event: DragEvent, stereotype?: string): void {
    if (!this.isReadOnly()) setToolboxDragTransfer(nodeType, event, stereotype);
  }

  /**
   * Configura la información de transferencia al arrastrar un nodo desde el explorador al lienzo.
   * @param diag Diagrama origen.
   * @param node Nodo arrastrado.
   * @param event Evento DragEvent.
   */
  onNodeDragStart(diag: DiagramDto, node: any, event: DragEvent): void {
    if (this.isReadOnly()) return;
    event.stopPropagation();
    this.draggedNodeId.set(node.id);
    setExplorerNodeDragTransfer(
      diag,
      node,
      this.isNodeTypeCompatibleWithCurrent(node.nodeType, diag.type),
      event
    );
  }

  /**
   * Limpia el identificador del nodo que estaba siendo arrastrado.
   */
  onNodeDragEnd(): void {
    this.draggedNodeId.set(null);
  }

  /**
   * Inicia la operación de arrastrar un diagrama para reordenarlo en el explorador.
   * @param diag Diagrama en movimiento.
   * @param event Evento DragEvent.
   */
  onDiagramDragStart(diag: DiagramDto, event: DragEvent): void {
    if (this.isReadOnly() || this.normalizedDiagramSearch()) return;
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', diag.id);
      event.dataTransfer.effectAllowed = 'move';
    }
    this.draggedDiagramId.set(diag.id);
  }

  /**
   * Calcula la posición visual ('above' o 'below') al arrastrar un diagrama sobre otro en la lista.
   * @param diag Diagrama destino sobre el que se sobrevuela.
   * @param event Evento DragEvent.
   */
  onDiagramDragOver(diag: DiagramDto, event: DragEvent): void {
    if (this.isReadOnly()) return;
    const draggedId = this.draggedDiagramId();
    if (!draggedId || draggedId === diag.id) return;

    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.dragOverDiagramId.set(diag.id);
    this.dragOverPosition.set(event.clientY < rect.top + rect.height / 2 ? 'above' : 'below');
  }

  /**
   * Limpia el indicador de destino al salir del área de un diagrama durante el arrastre.
   * @param diag Diagrama que se deja de sobrevolar.
   * @param _event Evento DragEvent.
   */
  onDiagramDragLeave(diag: DiagramDto, _event: DragEvent): void {
    if (this.dragOverDiagramId() === diag.id) {
      this.dragOverDiagramId.set(null);
      this.dragOverPosition.set(null);
    }
  }

  /**
   * Aplica el nuevo orden al soltar un diagrama sobre otra posición de la lista y lo persiste.
   * @param targetDiag Diagrama destino.
   * @param type Tipo de diagrama.
   * @param event Evento DragEvent.
   */
  onDiagramDrop(targetDiag: DiagramDto, type: DiagramType, event: DragEvent): void {
    if (this.isReadOnly() || this.normalizedDiagramSearch()) return;
    event.preventDefault();
    const nextOrder = computeDroppedDiagramOrder(
      this.getDiagramsForType(type),
      this.customDiagramOrder(),
      this.draggedDiagramId(),
      targetDiag.id,
      this.dragOverPosition()
    );
    if (nextOrder) {
      this.customDiagramOrder.set(nextOrder);
      saveCustomDiagramOrder(this.currentProjectId(), nextOrder);
    }
    this.clearDragState();
  }

  /**
   * Limpia los estados de arrastre al culminar o cancelar el drag and drop de un diagrama.
   */
  onDiagramDragEnd(): void {
    this.clearDragState();
  }

  /**
   * Restablece las señales de control de arrastre de diagramas a sus valores nulos.
   */
  private clearDragState(): void {
    this.draggedDiagramId.set(null);
    this.dragOverDiagramId.set(null);
    this.dragOverPosition.set(null);
  }

  /**
   * Emite la selección de un diagrama para ser cargado y mostrado en el editor.
   * @param diagramId Identificador del diagrama seleccionado.
   */
  onSelectDiagram(diagramId: string): void {
    this.selectDiagram.emit(diagramId);
  }

  /**
   * Emite la solicitud de creación de un diagrama preconfigurado para una carpeta específica.
   * @param type Tipo de diagrama sugerido.
   * @param event Evento de clic.
   */
  onCreateInFolder(type: DiagramType, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.openCreateDiagram.emit(type);
  }

  /**
   * Emite la solicitud de creación de un diagrama genérico sin tipo preseleccionado.
   */
  onCreateDiagramGeneral(): void {
    this.openCreateDiagram.emit(null);
  }
}
