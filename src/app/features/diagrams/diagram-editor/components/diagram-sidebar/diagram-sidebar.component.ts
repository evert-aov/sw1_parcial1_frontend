import { Component, input, output, signal, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
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
} from '@ng-icons/heroicons/outline';
import { HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DiagramDto,
  DiagramType,
  DiagramTypeItem,
  UML_DIAGRAM_TYPES,
  UmlRelationshipType,
  UmlLineStyle,
  UmlRelationTypeItem,
  UmlLineStyleItem,
  UML_RELATION_TYPES,
  UML_USE_CASE_RELATION_TYPES,
  UML_PACKAGE_RELATION_TYPES,
  UML_COMPONENT_RELATION_TYPES,
  UML_COMMUNICATION_RELATION_TYPES,
  UML_DEPLOYMENT_RELATION_TYPES,
  UML_SEQUENCE_RELATION_TYPES,
  UML_LINE_STYLES,
} from '../../../../../core/models/diagram.model';
import { TranslatePipe, TranslationService } from '../../../../../core/i18n';
import { DiagramSidebarIconComponent } from './diagram-sidebar-icon/diagram-sidebar-icon.component';
import { SHARED_DIAGRAM_UI_COMPONENTS } from '../shared-ui';

@Component({
  selector: 'app-diagram-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgIconComponent,
    TranslatePipe,
    DiagramSidebarIconComponent,
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
  templateUrl: './diagram-sidebar.component.html',
})
export class DiagramSidebarComponent {
  readonly DiagramType = DiagramType;
  protected readonly translationService = inject(TranslationService);

  getRelationLabel(rel: UmlRelationTypeItem): string {
    this.translationService.currentLang();
    const key = `editor.toolbox.${rel.id}`;
    const translated = this.translationService.translate(key);
    return translated !== key ? translated : rel.label;
  }

  getRelationDescription(rel: UmlRelationTypeItem): string {
    this.translationService.currentLang();
    const key = `editor.toolbox.${rel.id}Desc`;
    const translated = this.translationService.translate(key);
    return translated !== key ? translated : rel.description;
  }

  getLineStyleLabel(id: string, fallback: string): string {
    this.translationService.currentLang();
    const key = `editor.toolbox.${id}`;
    const translated = this.translationService.translate(key);
    return translated !== key ? translated : fallback;
  }

  getDiagramTypeLabel(dt: DiagramTypeItem | DiagramType | string): string {
    this.translationService.currentLang();
    const id = typeof dt === 'string' ? dt : dt.id;
    const key = `editor.explorer.folders.${id}`;
    const translated = this.translationService.translate(key);
    if (translated !== key) return translated;
    return typeof dt === 'object' ? dt.label : id;
  }

  getDiagramTypeFolderName(dt: DiagramTypeItem): string {
    this.translationService.currentLang();
    const key = `editor.explorer.folders.${dt.id}`;
    const translated = this.translationService.translate(key);
    return translated !== key ? translated : dt.folderName;
  }

  getNodeTypeLabel(nodeType: string): string {
    this.translationService.currentLang();
    const key = `editor.explorer.nodeTypes.${nodeType}`;
    const translated = this.translationService.translate(key);
    return translated !== key ? translated : nodeType;
  }

  // Tabs (Por defecto 'explorer' para mostrar el árbol del proyecto al abrir el lienzo)
  readonly activeTab = signal<'toolbox' | 'explorer'>('explorer');

  // Ancho ajustable del sidebar (por defecto 280px, rango 220px - 750px)
  readonly sidebarWidth = signal<number>(280);
  readonly isResizing = signal<boolean>(false);
  private resizeStartX = 0;
  private resizeStartWidth = 280;

  // Estados de renombrado y foco en el Explorador
  readonly editingDiagramId = signal<string | null>(null);
  readonly editingDiagramName = signal<string>('');
  readonly hoveredDiagramId = signal<string | null>(null);

  // Estados de expansión de nodos de cada diagrama
  readonly expandedDiagrams = signal<Record<string, boolean>>({});

  // Inputs
  readonly isOpen = input<boolean>(false);
  readonly activeDiagramType = input<DiagramType>(DiagramType.CLASS);
  readonly selectedRelationType = input<UmlRelationshipType | null>(null);
  readonly defaultLineStyle = input<UmlLineStyle>('segment');
  readonly isReadOnly = input<boolean>(false);
  readonly relationTypes = input<UmlRelationTypeItem[]>(UML_RELATION_TYPES);
  readonly lineStyles = input<UmlLineStyleItem[]>(UML_LINE_STYLES);
  readonly diagramTypes = input<DiagramTypeItem[]>(UML_DIAGRAM_TYPES);

  // Inputs del Explorador de Proyecto
  readonly projectDiagrams = input<DiagramDto[]>([]);
  readonly currentDiagramId = input<string | null>(null);
  readonly currentProjectId = input<string | null>(null);
  readonly currentProjectName = input<string>('');
  readonly currentNodes = input<any[]>([]);

  // Orden personalizado y estados de arrastrar y soltar (Drag and Drop)
  readonly customDiagramOrder = signal<string[]>([]);
  readonly draggedDiagramId = signal<string | null>(null);
  readonly draggedNodeId = signal<string | null>(null);
  readonly dragOverDiagramId = signal<string | null>(null);
  readonly dragOverPosition = signal<'above' | 'below' | null>(null);

  // Estados de acordeón del Toolbox
  readonly isDiagramTypesOpen = signal<boolean>(false);
  readonly isRelationshipsOpen = signal<boolean>(true);
  readonly isLineStylesOpen = signal<boolean>(true);

  // Estados de carpetas en el Explorador
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

  // Agrupamiento estricto de diagramas por su DiagramType
  readonly diagramsByType = computed<Map<DiagramType, DiagramDto[]>>(() => {
    const map = new Map<DiagramType, DiagramDto[]>();
    for (const dt of UML_DIAGRAM_TYPES) {
      map.set(dt.id, []);
    }
    for (const diag of this.projectDiagrams()) {
      const type = (diag.type as DiagramType) || DiagramType.CLASS;
      const list = map.get(type) || [];
      list.push(diag);
      map.set(type, list);
    }
    return map;
  });

  // Relaciones contextuales según el tipo de diagrama activo
  readonly currentRelations = computed<UmlRelationTypeItem[]>(() => {
    if (this.activeDiagramType() === DiagramType.USE_CASE) {
      return UML_USE_CASE_RELATION_TYPES;
    }
    if (this.activeDiagramType() === DiagramType.PACKAGE || this.activeDiagramType() === DiagramType.LAYERED) {
      return UML_PACKAGE_RELATION_TYPES;
    }
    if (this.activeDiagramType() === DiagramType.COMPONENT) {
      return UML_COMPONENT_RELATION_TYPES;
    }
    if (this.activeDiagramType() === DiagramType.COMMUNICATION) {
      return UML_COMMUNICATION_RELATION_TYPES;
    }
    if (this.activeDiagramType() === DiagramType.DEPLOYMENT) {
      return UML_DEPLOYMENT_RELATION_TYPES;
    }
    if (this.activeDiagramType() === DiagramType.SEQUENCE) {
      return UML_SEQUENCE_RELATION_TYPES;
    }
    return UML_RELATION_TYPES;
  });

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

  // Eventos del Explorador
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

  toggleDiagramExpanded(diagramId: string, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    const curr = { ...this.expandedDiagrams() };
    curr[diagramId] = !this.isDiagramExpanded(diagramId);
    this.expandedDiagrams.set(curr);
  }

  isDiagramExpanded(diagramId: string): boolean {
    const map = this.expandedDiagrams();
    if (map[diagramId] !== undefined) {
      return map[diagramId];
    }
    return diagramId === this.currentDiagramId();
  }

  getNodesForDiagram(diag: DiagramDto): any[] {
    if (diag.id === this.currentDiagramId()) {
      return (this.currentNodes() || []).filter((n) => !n.isAnchor);
    }
    return (diag.nodes || []).filter((n) => !n.isAnchor);
  }

  isNodeTypeCompatibleWithCurrent(nodeType?: string, sourceDiagramType?: DiagramType | string): boolean {
    const currentType = this.activeDiagramType();
    const type = nodeType || 'class';

    if (currentType === DiagramType.COMMUNICATION) {
      // En diagrama de comunicación: solo se permiten actor, boundary, control, entity.
      // Las clases (incluso con estereotipo UI, Controller., Entity.) NO están permitidas.
      return type === 'actor' || type === 'boundary' || type === 'control' || type === 'entity';
    }
    if (currentType === DiagramType.CLASS_ANALYSIS) {
      // En análisis de clases: solo clases estándar (con o sin estereotipo) y actor.
      // Los nodos puros (boundary, control, entity) NO están permitidos.
      return type === 'class' || type === 'actor';
    }
    if (currentType === DiagramType.CLASS) {
      return type === 'class';
    }
    if (currentType === DiagramType.USE_CASE) {
      return type === 'actor' || type === 'use_case';
    }
    if (currentType === DiagramType.PACKAGE) {
      return type === 'package' || type === 'use_case' || type === 'actor';
    }
    if (currentType === DiagramType.SEQUENCE) {
      return (
        type === 'actor' ||
        type === 'lifeline' ||
        type === 'class' ||
        type === 'boundary' ||
        type === 'control' ||
        type === 'entity'
      );
    }
    if (currentType === DiagramType.DEPLOYMENT) {
      return (
        type === 'device' ||
        type === 'node' ||
        type === 'executionEnvironment' ||
        type === 'component' ||
        type === 'boundary_box' ||
        type === 'package' ||
        type === 'class'
      );
    }
    if (currentType === DiagramType.COMPONENT) {
      return type === 'component' || type === 'boundary_box' || type === 'package' || type === 'class';
    }
    if (currentType === DiagramType.LAYERED) {
      return type === 'package' || type === 'boundary_box' || type === 'class';
    }
    return true;
  }

  getCopyTooltip(diag: DiagramDto, node: any): string {
    this.translationService.currentLang();
    const isCurrent = diag.id === this.currentDiagramId();
    const typeLabel = this.getNodeTypeLabel(node.nodeType);
    if (isCurrent) {
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
    if (diag.id === this.currentDiagramId()) {
      this.selectNode.emit(node.id);
    } else {
      this.onCopyNode(diag, node);
    }
  }

  @HostListener('window:keydown', ['$event'])
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
    if (this.isReadOnly()) return;
    this.deleteDiagram.emit(diag.id);
  }

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

  toggleFolder(type: DiagramType): void {
    const curr = { ...this.expandedFolders() };
    curr[type] = !curr[type];
    this.expandedFolders.set(curr);
  }

  constructor() {
    // Cargar ancho guardado del sidebar
    try {
      const savedWidth = localStorage.getItem('uml_sidebar_width');
      if (savedWidth) {
        const parsed = parseInt(savedWidth, 10);
        if (!isNaN(parsed) && parsed >= 220 && parsed <= 750) {
          this.sidebarWidth.set(parsed);
        }
      }
    } catch {}

    effect(() => {
      const pid = this.currentProjectId();
      if (pid) {
        try {
          const raw = localStorage.getItem(`uml_diagram_order_${pid}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              this.customDiagramOrder.set(parsed);
              return;
            }
          }
        } catch {}
        this.customDiagramOrder.set([]);
      }
    });
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

  @HostListener('window:mousemove', ['$event'])
  onWindowMouseMove(event: MouseEvent): void {
    if (!this.isResizing()) return;
    const delta = event.clientX - this.resizeStartX;
    const newWidth = Math.min(Math.max(220, this.resizeStartWidth + delta), 750);
    this.sidebarWidth.set(newWidth);
  }

  @HostListener('window:mouseup')
  onWindowMouseUp(): void {
    if (this.isResizing()) {
      this.isResizing.set(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      try {
        localStorage.setItem('uml_sidebar_width', this.sidebarWidth().toString());
      } catch (e) {
        console.warn('Could not save sidebar width', e);
      }
    }
  }

  resetWidth(event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.sidebarWidth.set(280);
    try {
      localStorage.setItem('uml_sidebar_width', '280');
    } catch {}
  }

  isFolderExpanded(type: DiagramType): boolean {
    return !!this.expandedFolders()[type];
  }

  getDiagramsForType(type: DiagramType): DiagramDto[] {
    const list = this.diagramsByType().get(type) || [];
    const order = this.customDiagramOrder();
    if (!order || order.length === 0) {
      return list;
    }
    return [...list].sort((a, b) => {
      const idxA = order.indexOf(a.id);
      const idxB = order.indexOf(b.id);
      const posA = idxA === -1 ? 999999 : idxA;
      const posB = idxB === -1 ? 999999 : idxB;
      return posA - posB;
    });
  }

  moveDiagram(diagramId: string, direction: 'up' | 'down', type: DiagramType, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (this.isReadOnly()) return;
    const currentList = this.getDiagramsForType(type);
    const index = currentList.findIndex((d) => d.id === diagramId);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentList.length) return;

    const reordered = [...currentList];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    this.applyNewOrderForType(type, reordered.map((d) => d.id));
  }

  private applyNewOrderForType(type: DiagramType, orderedIdsForType: string[]): void {
    const currentGlobal = [...this.customDiagramOrder()];
    const typeDiagIds = new Set(this.getDiagramsForType(type).map((d) => d.id));
    const filteredGlobal = currentGlobal.filter((id) => !typeDiagIds.has(id));
    const newGlobalOrder = [...filteredGlobal, ...orderedIdsForType];
    this.customDiagramOrder.set(newGlobalOrder);

    const pid = this.currentProjectId();
    if (pid) {
      try {
        localStorage.setItem(`uml_diagram_order_${pid}`, JSON.stringify(newGlobalOrder));
      } catch (e) {
        console.warn('Could not save diagram order to localStorage', e);
      }
    }
  }

  onToolboxDragStart(nodeType: string, event: DragEvent, stereotype?: string): void {
    if (this.isReadOnly()) return;
    const payload: any = {
      type: 'toolbox_node',
      nodeType,
    };
    if (stereotype) {
      payload.stereotype = stereotype;
    }
    if (event.dataTransfer) {
      event.dataTransfer.setData('application/json', JSON.stringify(payload));
      event.dataTransfer.setData('text/plain', nodeType);
      event.dataTransfer.effectAllowed = 'copy';
    }
  }

  onNodeDragStart(diag: DiagramDto, node: any, event: DragEvent): void {
    if (this.isReadOnly()) return;
    event.stopPropagation();
    const isCompatible = this.isNodeTypeCompatibleWithCurrent(node.nodeType, diag.type);
    const payload = {
      type: 'explorer_node',
      nodeType: node.nodeType || 'class',
      sourceDiagramId: diag.id,
      sourceDiagramType: diag.type as DiagramType,
      nodeData: node,
      isCompatible,
    };
    this.draggedNodeId.set(node.id);
    if (event.dataTransfer) {
      event.dataTransfer.setData('application/json', JSON.stringify(payload));
      event.dataTransfer.setData('text/plain', node.name || node.nodeType);
      event.dataTransfer.effectAllowed = 'copy';
    }
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
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const pos = event.clientY < midY ? 'above' : 'below';

    this.dragOverDiagramId.set(diag.id);
    this.dragOverPosition.set(pos);
  }

  onDiagramDragLeave(diag: DiagramDto, event: DragEvent): void {
    if (this.dragOverDiagramId() === diag.id) {
      this.dragOverDiagramId.set(null);
      this.dragOverPosition.set(null);
    }
  }

  onDiagramDrop(targetDiag: DiagramDto, type: DiagramType, event: DragEvent): void {
    if (this.isReadOnly()) return;
    event.preventDefault();
    const draggedId = this.draggedDiagramId();
    if (!draggedId || draggedId === targetDiag.id) {
      this.clearDragState();
      return;
    }

    const currentList = this.getDiagramsForType(type);
    const draggedItem = currentList.find((d) => d.id === draggedId);
    if (!draggedItem) {
      this.clearDragState();
      return;
    }

    const filtered = currentList.filter((d) => d.id !== draggedId);
    const targetIdx = filtered.findIndex((d) => d.id === targetDiag.id);
    if (targetIdx === -1) {
      this.clearDragState();
      return;
    }

    const insertIdx = this.dragOverPosition() === 'below' ? targetIdx + 1 : targetIdx;
    filtered.splice(insertIdx, 0, draggedItem);

    this.applyNewOrderForType(type, filtered.map((d) => d.id));
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
