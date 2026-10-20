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
import { TranslatePipe, TranslationService } from '../../../../../core/i18n';
import { UML_SVG_COMPONENTS } from '../uml-svg';
import { UML_WEBGL_COMPONENTS } from '../uml-webgl';
import { SHARED_DIAGRAM_UI_COMPONENTS } from '../shared-ui';
import { UmlNodeNormalizerUtil } from '../../utils/uml-node-normalizer.util';
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
    CommonModule,
    FormsModule,
    NgIconComponent,
    TranslatePipe,
    ...UML_SVG_COMPONENTS,
    ...UML_WEBGL_COMPONENTS,
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
    '(window:keydown)': 'onExplorerKeyDown($event)',
    '(window:mousemove)': 'onWindowMouseMove($event)',
    '(window:mouseup)': 'onWindowMouseUp()',
  },
  templateUrl: './diagram-sidebar.component.html',
})
export class DiagramSidebarComponent {
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

  readonly isDiagramTypesOpen = signal<boolean>(false);
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

  readonly currentRelations = computed<UmlRelationTypeItem[]>(
    () => RELATION_TYPES_BY_DIAGRAM[this.activeDiagramType()] ?? UML_RELATION_TYPES
  );

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

  private translateWithFallback(key: string, fallback: string): string {
    this.translationService.currentLang();
    const translated = this.translationService.translate(key);
    return translated !== key ? translated : fallback;
  }

  getRelationLabel(rel: UmlRelationTypeItem): string {
    return this.translateWithFallback(`editor.toolbox.${rel.id}`, rel.label);
  }

  getRelationDescription(rel: UmlRelationTypeItem): string {
    return this.translateWithFallback(`editor.toolbox.${rel.id}Desc`, rel.description);
  }

  getLineStyleLabel(id: string, fallback: string): string {
    return this.translateWithFallback(`editor.toolbox.${id}`, fallback);
  }

  getDiagramTypeLabel(dt: DiagramTypeItem | DiagramType | string): string {
    const id = typeof dt === 'string' ? dt : dt.id;
    const fallback = typeof dt === 'object' ? dt.label : id;
    return this.translateWithFallback(`editor.explorer.folders.${id}`, fallback);
  }

  getDiagramTypeFolderName(dt: DiagramTypeItem): string {
    return this.translateWithFallback(`editor.explorer.folders.${dt.id}`, dt.folderName);
  }

  getNodeTypeLabel(nodeType: string): string {
    return this.translateWithFallback(`editor.explorer.nodeTypes.${nodeType}`, nodeType);
  }

  toggleDiagramExpanded(diagramId: string, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.expandedDiagrams.set({
      ...this.expandedDiagrams(),
      [diagramId]: !this.isDiagramExpanded(diagramId),
    });
  }

  isDiagramExpanded(diagramId: string): boolean {
    const map = this.expandedDiagrams();
    return map[diagramId] !== undefined ? map[diagramId] : diagramId === this.currentDiagramId();
  }

  getNodesForDiagram(diag: DiagramDto): any[] {
    const source = diag.id === this.currentDiagramId() ? this.currentNodes() : diag.nodes;
    return (source || []).filter((n) => !n.isAnchor);
  }

  isNodeTypeCompatibleWithCurrent(
    nodeType?: string,
    _sourceDiagramType?: DiagramType | string
  ): boolean {
    return UmlNodeNormalizerUtil.isNodeTypeCompatible(nodeType, this.activeDiagramType());
  }

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

  onCopyNode(diag: DiagramDto, node: any, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (this.isReadOnly()) return;
    this.copyNodeToCurrent.emit({
      node,
      sourceDiagramId: diag.id,
      sourceDiagramType: (diag.type as DiagramType) || DiagramType.CLASS,
    });
  }

  onNodeItemClick(diag: DiagramDto, node: any, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (diag.id === this.currentDiagramId()) this.selectNode.emit(node.id);
    else this.onCopyNode(diag, node);
  }

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

  startRenameDiagram(diag: DiagramDto, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (this.isReadOnly()) return;
    this.editingDiagramId.set(diag.id);
    this.editingDiagramName.set(diag.name);
  }

  saveRenameDiagram(diagId: string): void {
    const newName = this.editingDiagramName().trim();
    if (newName && this.editingDiagramId() === diagId) {
      this.renameDiagram.emit({ diagramId: diagId, name: newName });
    }
    this.editingDiagramId.set(null);
  }

  cancelRenameDiagram(): void {
    this.editingDiagramId.set(null);
  }

  onDeleteDiagram(diag: DiagramDto, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.isReadOnly()) this.deleteDiagram.emit(diag.id);
  }

  onSelectDiagramType(type: DiagramType): void { this.diagramTypeChange.emit(type); }
  onSelectPointer(): void { this.setPointerMode.emit(); }
  onSelectRelation(type: UmlRelationshipType): void { this.selectRelationType.emit(type); }
  onSetLineStyle(style: UmlLineStyle): void { this.setDefaultLineStyle.emit(style); }

  toggleFolder(type: DiagramType): void {
    const curr = this.expandedFolders();
    this.expandedFolders.set({ ...curr, [type]: !curr[type] });
  }

  onStartResize(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isResizing.set(true);
    this.resizeStartX = event.clientX;
    this.resizeStartWidth = this.sidebarWidth();
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }

  onWindowMouseMove(event: MouseEvent): void {
    if (!this.isResizing()) return;
    const delta = event.clientX - this.resizeStartX;
    this.sidebarWidth.set(Math.min(Math.max(220, this.resizeStartWidth + delta), 750));
  }

  onWindowMouseUp(): void {
    if (!this.isResizing()) return;
    this.isResizing.set(false);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    saveSidebarWidth(this.sidebarWidth());
  }

  resetWidth(event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.sidebarWidth.set(280);
    saveSidebarWidth(280);
  }

  isFolderExpanded(type: DiagramType): boolean {
    return !!this.expandedFolders()[type];
  }

  getDiagramsForType(type: DiagramType): DiagramDto[] {
    return sortDiagramsByCustomOrder(
      this.diagramsByType().get(type) || [],
      this.customDiagramOrder()
    );
  }

  moveDiagram(
    diagramId: string,
    direction: 'up' | 'down',
    type: DiagramType,
    event?: MouseEvent
  ): void {
    if (event) event.stopPropagation();
    if (this.isReadOnly()) return;
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

  onToolboxDragStart(nodeType: string, event: DragEvent, stereotype?: string): void {
    if (!this.isReadOnly()) setToolboxDragTransfer(nodeType, event, stereotype);
  }

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

  onNodeDragEnd(): void {
    this.draggedNodeId.set(null);
  }

  onDiagramDragStart(diag: DiagramDto, event: DragEvent): void {
    if (this.isReadOnly()) return;
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', diag.id);
      event.dataTransfer.effectAllowed = 'move';
    }
    this.draggedDiagramId.set(diag.id);
  }

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

  onDiagramDragLeave(diag: DiagramDto, _event: DragEvent): void {
    if (this.dragOverDiagramId() === diag.id) {
      this.dragOverDiagramId.set(null);
      this.dragOverPosition.set(null);
    }
  }

  onDiagramDrop(targetDiag: DiagramDto, type: DiagramType, event: DragEvent): void {
    if (this.isReadOnly()) return;
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

  onDiagramDragEnd(): void {
    this.clearDragState();
  }

  private clearDragState(): void {
    this.draggedDiagramId.set(null);
    this.dragOverDiagramId.set(null);
    this.dragOverPosition.set(null);
  }

  onSelectDiagram(diagramId: string): void {
    this.selectDiagram.emit(diagramId);
  }

  onCreateInFolder(type: DiagramType, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.openCreateDiagram.emit(type);
  }

  onCreateDiagramGeneral(): void {
    this.openCreateDiagram.emit(null);
  }
}
