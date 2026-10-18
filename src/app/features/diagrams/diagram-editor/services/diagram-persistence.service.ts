import { Injectable, signal } from '@angular/core';
import { Subject, Subscription, debounceTime } from 'rxjs';
import { UmlClassNode, UmlConnection, UmlLineStyle } from '../../../../core/models/diagram.model';
import { DiagramAstNormalizerService } from './diagram-ast-normalizer.service';

export interface UmlDiagramDraft {
  diagramId: string;
  nodes: UmlClassNode[];
  connections: UmlConnection[];
  defaultLineStyle: UmlLineStyle;
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class DiagramPersistenceService {
  readonly hasUnsavedChanges = signal<boolean>(false);
  readonly saveSuccessMessage = signal<boolean>(false);

  readonly autoSave$ = new Subject<void>();
  readonly nodeDragEnd$ = new Subject<void>();

  private successTimer: any = null;

  // Normalizador sin estado: se instancia directamente para que `new DiagramPersistenceService()` siga siendo válido fuera de DI.
  private readonly astNormalizer = new DiagramAstNormalizerService();

  saveLocalDraft(
    diagramId: string,
    data: {
      nodes: UmlClassNode[];
      connections: UmlConnection[];
      defaultLineStyle: UmlLineStyle;
    },
  ): void {
    if (!diagramId) return;
    try {
      const draft: UmlDiagramDraft = {
        diagramId,
        nodes: data.nodes,
        connections: data.connections,
        defaultLineStyle: data.defaultLineStyle,
        timestamp: Date.now(),
      };
      localStorage.setItem(`uml_draft_${diagramId}`, JSON.stringify(draft));
    } catch (_) {}
  }

  clearLocalDraft(diagramId: string): void {
    if (!diagramId) return;
    try {
      localStorage.removeItem(`uml_draft_${diagramId}`);
    } catch (_) {}
  }

  getLocalDraft(diagramId: string): UmlDiagramDraft | null {
    if (!diagramId) return null;
    try {
      const raw = localStorage.getItem(`uml_draft_${diagramId}`);
      if (raw) {
        return JSON.parse(raw) as UmlDiagramDraft;
      }
    } catch (_) {}
    return null;
  }

  flushExitSave(options: {
    diagramId: string | null;
    isReadOnly: boolean;
    hasUnsavedChanges: boolean;
    token?: string | null;
    apiUrl: string;
    payload: any;
    onSendDiagramSync?: () => void;
  }): void {
    const { diagramId, isReadOnly, hasUnsavedChanges, token, apiUrl, payload, onSendDiagramSync } =
      options;
    if (!diagramId || isReadOnly || !hasUnsavedChanges) return;

    onSendDiagramSync?.();

    try {
      const url = `${apiUrl}/diagrams/${diagramId}/ast`;
      fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    } catch (_) {}
  }

  markAsUnsaved(
    isReadOnly: boolean,
    diagramId: string | null,
    draftData: {
      nodes: UmlClassNode[];
      connections: UmlConnection[];
      defaultLineStyle: UmlLineStyle;
    },
  ): void {
    if (isReadOnly) return;
    this.hasUnsavedChanges.set(true);
    if (diagramId) {
      this.saveLocalDraft(diagramId, draftData);
    }
    this.autoSave$.next();
  }

  markAsSaved(diagramId?: string | null): void {
    this.hasUnsavedChanges.set(false);
    if (diagramId) {
      this.clearLocalDraft(diagramId);
    }
  }

  notifySaveSuccess(durationMs = 2500): void {
    if (this.successTimer) {
      clearTimeout(this.successTimer);
    }
    this.saveSuccessMessage.set(true);
    this.successTimer = setTimeout(() => {
      this.saveSuccessMessage.set(false);
      this.successTimer = null;
    }, durationMs);
  }

  /**
   * Ejecuta el guardado del AST en backend con sincronización y notificaciones
   */
  executeSaveToBackend(
    diagramService: { saveAst: (id: string, payload: any) => any },
    diagramId: string,
    payload: any,
    silent: boolean,
    onSaveSuccessSync?: () => void,
  ): void {
    diagramService.saveAst(diagramId, payload).subscribe({
      next: () => {
        this.markAsSaved(diagramId);
        this.notifySaveSuccess(2500);
        if (!silent) onSaveSuccessSync?.();
      },
      error: (err: any) => {
        console.warn('Auto-save no pudo completarse en servidor (borrador local protegido):', err);
      },
    });
  }

  /**
   * Ejecuta la carga y resolución de un diagrama desde el backend con manejo de borradores locales
   */
  executeLoadDiagram(
    diagramService: { loadDiagram: (id: string) => any },
    diagramId: string,
    options: {
      getDefaultColor: (nodeType?: string, stereotype?: string | null) => string;
      normalizeDataType: (type: string) => string;
      normalizeReturnType: (type: string) => string;
      recalculateSequenceNumbers: (
        conns: UmlConnection[],
        preserveOrder?: boolean,
      ) => UmlConnection[];
      onLoaded: (
        diagram: any,
        resolved: {
          nodes: UmlClassNode[];
          connections: UmlConnection[];
          defaultLineStyle?: UmlLineStyle;
          fromDraft: boolean;
        },
      ) => void;
    },
  ): Subscription {
    return diagramService.loadDiagram(diagramId).subscribe((diagram: any) => {
      const resolved = this.resolveDiagramData(diagram, {
        getDefaultColor: options.getDefaultColor,
        normalizeDataType: options.normalizeDataType,
        normalizeReturnType: options.normalizeReturnType,
      });

      const processedConnections = options.recalculateSequenceNumbers(resolved.connections, true);

      options.onLoaded(diagram, {
        nodes: resolved.nodes,
        connections: processedConnections,
        defaultLineStyle: resolved.defaultLineStyle,
        fromDraft: resolved.fromDraft,
      });
    });
  }

  /**
   * Sincroniza la información del proyecto y sus diagramas si aún no están en memoria
   */
  syncProjectInfo(
    projectId: string | undefined | null,
    context: {
      hasCurrentProject: boolean;
      projectDiagramsCount: number;
      setCurrentProjectId: (id: string) => void;
      fetchProject: (id: string) => any;
      fetchProjectDiagrams: (id: string) => any;
      onProjectLoaded: (proj: any) => void;
    },
  ): void {
    if (!projectId) return;
    if (!context.hasCurrentProject) {
      context.setCurrentProjectId(projectId);
      context.fetchProject(projectId).subscribe({
        next: (proj: any) => context.onProjectLoaded(proj),
        error: () => {},
      });
    }
    if (context.projectDiagramsCount === 0) {
      context.fetchProjectDiagrams(projectId).subscribe();
    }
  }

  setupAutoSave(onAutoSave: () => void, debounceMs = 1000): Subscription {
    return this.autoSave$.pipe(debounceTime(debounceMs)).subscribe(onAutoSave);
  }

  setupNodeDragEnd(onDragEnd: () => void, debounceMs = 600): Subscription {
    return this.nodeDragEnd$.pipe(debounceTime(debounceMs)).subscribe(onDragEnd);
  }

  triggerAutoSave(): void {
    this.autoSave$.next();
  }

  triggerNodeDragEnd(): void {
    this.nodeDragEnd$.next();
  }

  restoreDraftIfNewer(
    diagramId: string,
    serverUpdatedAt?: string,
    isSequence?: boolean,
    getDefaultColor?: (nodeType?: string, stereotype?: string | null) => string,
  ): {
    restored: boolean;
    nodes?: UmlClassNode[];
    connections?: UmlConnection[];
    defaultLineStyle?: UmlLineStyle;
  } {
    const localDraftRaw = localStorage.getItem(`uml_draft_${diagramId}`);
    if (!localDraftRaw) return { restored: false };

    try {
      const draft = JSON.parse(localDraftRaw);
      const serverUpdated = serverUpdatedAt ? new Date(serverUpdatedAt).getTime() : 0;
      if (draft.timestamp && draft.timestamp > serverUpdated && draft.nodes?.length > 0) {
        const sanitizedDraftNodes: UmlClassNode[] = (draft.nodes || []).map((n: any) => {
          const nodeType = this.astNormalizer.resolveNodeType(n.id, n.nodeType || 'class', {
            isSequence,
          });
          let name = n.name || '';
          if (nodeType === 'boundary_box' && (name === 'ClassName' || !name.trim())) {
            name = '.';
          }
          let nodeColor = n.color;
          if (!nodeColor && getDefaultColor) {
            nodeColor = getDefaultColor(nodeType, n.stereotype);
          }
          const isExplicitSizeNode = this.astNormalizer.isExplicitSizeNodeType(nodeType);
          const defaultH =
            nodeType === 'lifeline'
              ? 60
              : nodeType === 'component'
                ? 70
                : nodeType === 'device' || nodeType === 'node'
                  ? 140
                  : nodeType === 'executionEnvironment'
                    ? 160
                    : nodeType === 'boundary_box'
                      ? 200
                      : nodeType === 'package'
                        ? 120
                        : undefined;
          const draftH = nodeType === 'lifeline' ? 60 : n.height || n.customHeight || defaultH;
          return {
            ...n,
            nodeType,
            name,
            height: draftH,
            customHeight: n.customHeight || (isExplicitSizeNode ? draftH : undefined),
            customWidth: n.customWidth || (isExplicitSizeNode ? n.width || 220 : undefined),
            isCustomSize:
              n.isCustomSize !== undefined
                ? n.isCustomSize
                : isExplicitSizeNode || (!!draftH && nodeType === 'class'),
            color: nodeColor,
            stereotype: n.stereotype || null,
          };
        });

        return {
          restored: true,
          nodes: sanitizedDraftNodes,
          connections: draft.connections || [],
          defaultLineStyle: draft.defaultLineStyle,
        };
      }
    } catch (_) {}

    return { restored: false };
  }

  /**
   * Resuelve los datos del diagrama dando prioridad a un borrador local no guardado
   * si este es más reciente que el timestamp del servidor, o mapeando el AST del servidor.
   */
  resolveDiagramData(
    diagram: any,
    options: {
      getDefaultColor?: (nodeType?: string, stereotype?: string | null) => string;
      normalizeDataType?: (type: string) => string;
      normalizeReturnType?: (type: string) => string;
    },
  ): {
    nodes: UmlClassNode[];
    connections: UmlConnection[];
    defaultLineStyle?: UmlLineStyle;
    fromDraft: boolean;
  } {
    const isSequence = diagram.type === 'sequence';
    const draftResult = this.restoreDraftIfNewer(
      diagram.id,
      diagram.updatedAt,
      isSequence,
      options.getDefaultColor,
    );
    if (draftResult.restored && draftResult.nodes) {
      return {
        nodes: draftResult.nodes,
        connections: draftResult.connections || [],
        defaultLineStyle: draftResult.defaultLineStyle,
        fromDraft: true,
      };
    }
    const { nodes, connections } = this.mapServerDiagramToLocal(
      diagram,
      options.getDefaultColor,
      options.normalizeDataType,
      options.normalizeReturnType,
    );
    return {
      nodes,
      connections,
      defaultLineStyle: diagram.defaultLineStyle as UmlLineStyle | undefined,
      fromDraft: false,
    };
  }

  mapServerDiagramToLocal(
    diagram: any,
    getDefaultColor?: (nodeType?: string, stereotype?: string | null) => string,
    normalizeDataType?: (type: string) => string,
    normalizeReturnType?: (type: string) => string,
  ): { nodes: UmlClassNode[]; connections: UmlConnection[] } {
    return {
      nodes: this.astNormalizer.normalizeNodes(diagram.nodes, {
        diagramType: diagram.type,
        getDefaultColor,
        normalizeDataType,
        normalizeReturnType,
      }),
      connections: this.astNormalizer.normalizeConnections(
        diagram.connections,
        diagram.type === 'sequence',
      ),
    };
  }
}
