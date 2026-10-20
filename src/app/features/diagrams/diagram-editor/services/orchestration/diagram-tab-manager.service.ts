import { Injectable, signal, inject } from '@angular/core';
import { DiagramType, UML_DIAGRAM_TYPES } from '../../../../../core/models/diagram.model';
import { DiagramService } from '../../../../../core/services/diagram.service';
import { ConfirmDialogService } from '../../../../../core/services/confirm-dialog.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { DiagramViewportService } from '../spatial-engine/diagram-viewport.service';
import { DiagramModalService } from './diagram-modal.service';
import { DiagramTab } from '../../components/diagram-tabs/diagram-tabs.component';

export interface TabCloseResult {
  nextTabId?: string;
  allTabsClosed?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class DiagramTabManagerService {
  private readonly diagramService?: DiagramService | null;
  private readonly confirmDialogService?: ConfirmDialogService | null;
  private readonly viewportService?: DiagramViewportService | null;
  private readonly modalService?: DiagramModalService | null;
  private readonly toastService?: ToastService | null;

  constructor(
    diagramService?: DiagramService,
    confirmDialogService?: ConfirmDialogService,
    viewportService?: DiagramViewportService,
    modalService?: DiagramModalService,
    toastService?: ToastService,
  ) {
    if (diagramService !== undefined) {
      this.diagramService = diagramService;
    } else {
      try { this.diagramService = inject(DiagramService, { optional: true }); } catch { this.diagramService = null; }
    }
    if (confirmDialogService !== undefined) {
      this.confirmDialogService = confirmDialogService;
    } else {
      try { this.confirmDialogService = inject(ConfirmDialogService, { optional: true }); } catch { this.confirmDialogService = null; }
    }
    if (viewportService !== undefined) {
      this.viewportService = viewportService;
    } else {
      try { this.viewportService = inject(DiagramViewportService, { optional: true }); } catch { this.viewportService = null; }
    }
    if (modalService !== undefined) {
      this.modalService = modalService;
    } else {
      try { this.modalService = inject(DiagramModalService, { optional: true }); } catch { this.modalService = null; }
    }
    if (toastService !== undefined) {
      this.toastService = toastService;
    } else {
      try { this.toastService = inject(ToastService, { optional: true }); } catch { this.toastService = null; }
    }
  }

  readonly openTabs = signal<DiagramTab[]>([]);
  readonly currentDiagramName = signal<string>('Diagrama UML');

  getTabTypeShort(type: DiagramType): string {
    const found = UML_DIAGRAM_TYPES.find((d) => d.id === type);
    return found ? found.shortLabel : 'UML';
  }

  addTab(tab: DiagramTab): void {
    this.openTabs.update((tabs) => {
      if (!tabs.some((t) => t.id === tab.id)) {
        return [...tabs, tab];
      }
      return tabs;
    });
  }

  updateTabName(diagramId: string, newName: string): void {
    this.openTabs.update((tabs) =>
      tabs.map((t) => (t.id === diagramId ? { ...t, name: newName } : t)),
    );
  }

  closeTab(
    tabId: string,
    currentDiagramId: string | null,
  ): TabCloseResult | null {
    const currentTabs = this.openTabs();
    if (currentTabs.length <= 1) return null;

    this.viewportService?.deleteDiagramViewState(tabId);

    const index = currentTabs.findIndex((t) => t.id === tabId);
    const newTabs = currentTabs.filter((t) => t.id !== tabId);
    this.openTabs.set(newTabs);

    if (currentDiagramId === tabId) {
      const nextIndex = Math.max(0, index - 1);
      const nextTab = newTabs[nextIndex] || newTabs[0];
      return { nextTabId: nextTab?.id };
    }

    return {};
  }

  handleCreateDiagram(
    projectId: string | null,
    data: { name: string; type: DiagramType },
    onCreated: (createdId: string) => void,
    onBeforeSave?: () => void,
  ): void {
    if (!projectId || !this.diagramService) {
      console.error('Cannot create diagram without a valid project ID');
      return;
    }

    onBeforeSave?.();

    this.diagramService.createDiagram(projectId, data.name, data.type).subscribe({
      next: (created) => {
        this.modalService?.closeCreateDiagramModal();
        const diagramType = (created.type as DiagramType) || data.type;
        this.addTab({ id: created.id, name: created.name, type: diagramType });
        onCreated(created.id);
      },
      error: (err) => {
        console.error('Error creating diagram:', err);
      },
    });
  }

  renameDiagram(
    event: { diagramId: string; name: string },
    currentDiagramId: string | null,
    onRenamed?: (newName: string) => void,
  ): void {
    if (!this.diagramService) return;
    this.diagramService.renameDiagram(event.diagramId, event.name).subscribe({
      next: (updated) => {
        if (currentDiagramId === event.diagramId) {
          this.currentDiagramName.set(updated.name);
          onRenamed?.(updated.name);
        }
        this.updateTabName(event.diagramId, updated.name);
      },
      error: (err) => {
        console.error('Error renaming diagram:', err);
      },
    });
  }

  async deleteDiagram(
    diagramId: string,
    currentDiagramId: string | null,
    projectDiagrams: Array<{ id: string; name: string }>,
    onSelectNext: (nextId: string | null) => void,
  ): Promise<void> {
    if (!this.confirmDialogService || !this.diagramService) return;

    const diag = projectDiagrams.find((d) => d.id === diagramId);
    const diagName = diag ? diag.name : 'este diagrama';

    const confirmed = await this.confirmDialogService.confirm({
      title: 'common.confirmModal.deleteDiagramTitle',
      message: 'common.confirmModal.deleteDiagramMessage',
      messageParams: { name: diagName },
      type: 'danger',
    });

    if (!confirmed) {
      return;
    }

    this.diagramService.deleteDiagram(diagramId).subscribe({
      next: () => {
        this.viewportService?.deleteDiagramViewState(diagramId);

        const currentTabs = this.openTabs();
        const wasActive = currentDiagramId === diagramId;
        const newTabs = currentTabs.filter((t) => t.id !== diagramId);
        this.openTabs.set(newTabs);

        if (wasActive) {
          if (newTabs.length > 0) {
            onSelectNext(newTabs[0].id);
          } else {
            const remaining = projectDiagrams.filter((d) => d.id !== diagramId);
            if (remaining.length > 0) {
              onSelectNext(remaining[0].id);
            } else {
              onSelectNext(null);
            }
          }
        }
      },
      error: (err) => {
        console.error('Error deleting diagram:', err);
        this.toastService?.error('No se pudo eliminar el diagrama.');
      },
    });
  }

  /**
   * Resuelve y procesa los parámetros de ruta al inicializar el editor
   */
  handleRouteQueryParams(
    params: any,
    context: {
      userId?: string | null;
      setCurrentProjectId: (id: string) => void;
      setCurrentDiagramId: (id: string) => void;
      setCurrentDiagramName: (name: string) => void;
      setCurrentProject: (proj: any) => void;
      setCurrentUserRole: (role: any) => void;
      loadDiagramsByProject: (projectId: string) => any;
      getProject: (projectId: string) => any;
      loadDiagram: (diagramId: string) => void;
      resolveUserRole: (project: any, userId?: string | null) => any;
    },
  ): void {
    const { diagramId, projectId, projectName } = params;
    if (projectId) {
      context.setCurrentProjectId(projectId);
      context.loadDiagramsByProject(projectId).subscribe({
        next: (diagrams: any[]) => {
          if (!diagramId && diagrams?.length > 0) {
            context.setCurrentDiagramId(diagrams[0].id);
            context.setCurrentDiagramName(diagrams[0].name);
            context.loadDiagram(diagrams[0].id);
          }
        },
        error: () => {},
      });
      context.getProject(projectId).subscribe({
        next: (project: any) => {
          context.setCurrentProject(project);
          context.setCurrentUserRole(context.resolveUserRole(project, context.userId));
        },
        error: () => {},
      });
    }
    if (projectName) context.setCurrentDiagramName(projectName);
    if (diagramId) {
      context.setCurrentDiagramId(diagramId);
      context.loadDiagram(diagramId);
    }
  }

  /**
   * Transiciona hacia un nuevo diagrama guardando estado y navegando por ruta
   */
  executeSelectDiagram(
    diagramId: string,
    context: {
      currentDiagramId: string | null;
      isReadOnly: boolean;
      hasUnsavedChanges: boolean;
      saveCurrentViewState?: () => void;
      saveToBackend?: () => void;
      setCurrentDiagramId: (id: string) => void;
      navigateToDiagram: (id: string) => void;
      loadDiagram: (id: string) => void;
    },
  ): void {
    if (context.currentDiagramId === diagramId) return;

    if (context.currentDiagramId) {
      context.saveCurrentViewState?.();
    }

    if (context.hasUnsavedChanges && !context.isReadOnly) {
      context.saveToBackend?.();
    }

    context.setCurrentDiagramId(diagramId);
    context.navigateToDiagram(diagramId);
    context.loadDiagram(diagramId);
  }
}
