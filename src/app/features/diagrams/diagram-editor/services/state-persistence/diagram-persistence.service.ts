import { inject } from '@angular/core';
import { Injectable, signal } from '@angular/core';
import { Subject, Subscription, debounceTime } from 'rxjs';
import {
  sanitizeLineStyle,
  UmlClassNode,
  UmlConnection,
  UmlLineStyle,
  UmlRelationshipType,
} from '../../../../../core/models/diagram.model';
import {
  UmlNodeNormalizerUtil,
} from '../../../../../core/plugins/contracts/uml-node-normalizer.util.contract';

export interface UmlDiagramDraft {
  diagramId: string;
  nodes: UmlClassNode[];
  connections: UmlConnection[];
  defaultLineStyle: UmlLineStyle;
  timestamp: number;
}

/**
 * Servicio de persistencia del editor de diagramas:
 * gestiona borradores locales en `localStorage`, pipelines de auto-guardado con debounce,
 * sincronización de salida (`keepalive`) y mapeo de AST del servidor.
 */
@Injectable({
  providedIn: 'root',
})
export class DiagramPersistenceService {
  private readonly normalizer = inject(UmlNodeNormalizerUtil);
  readonly hasUnsavedChanges = signal<boolean>(false);
  readonly saveSuccessMessage = signal<boolean>(false);

  readonly autoSave$ = new Subject<void>();
  readonly nodeDragEnd$ = new Subject<void>();

  private successTimer: ReturnType<typeof setTimeout> | null = null;

  /** Persiste el borrador del diagrama activo en `localStorage`. */
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

  /** Elimina el borrador local almacenado para el diagrama indicado. */
  clearLocalDraft(diagramId: string): void {
    if (!diagramId) return;
    try {
      localStorage.removeItem(`uml_draft_${diagramId}`);
    } catch (_) {}
  }

  /** Obtiene el borrador local de un diagrama si existe. */
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

  /** Ejecuta un guardado de emergencia con `keepalive` al cerrar o abandonar la pestaña. */
  flushExitSave(options: {
    diagramId: string | null;
    isReadOnly: boolean;
    hasUnsavedChanges: boolean;
    token?: string | null;
    apiUrl: string;
    payload: unknown;
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

  /** Marca el diagrama con cambios pendientes, actualiza el borrador local y dispara el debounce de auto-guardado. */
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

  /** Marca el diagrama como sincronizado y limpia su borrador local. */
  markAsSaved(diagramId?: string | null): void {
    this.hasUnsavedChanges.set(false);
    if (diagramId) {
      this.clearLocalDraft(diagramId);
    }
  }

  /** Muestra temporalmente el indicador visual de guardado exitoso. */
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

  /** Ejecuta el guardado del AST en backend con sincronización y notificaciones. */
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
      error: (err: unknown) => {
        console.warn('Auto-save no pudo completarse en servidor (borrador local protegido):', err);
      },
    });
  }

  /** Ejecuta la carga y resolución de un diagrama desde el backend con manejo de borradores locales. */
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
    return diagramService.loadDiagram(diagramId).subscribe({
      next: (diagram: any) => {
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
      },
      error: () => {},
    });
  }

  /** Sincroniza la información del proyecto y sus diagramas si aún no están en memoria. */
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
      context.fetchProjectDiagrams(projectId).subscribe({
        error: () => {},
      });
    }
  }

  /** Suscribe una acción al flujo de auto-guardado con debounce. */
  setupAutoSave(onAutoSave: () => void, debounceMs = 1000): Subscription {
    return this.autoSave$.pipe(debounceTime(debounceMs)).subscribe(onAutoSave);
  }

  /** Suscribe una acción al fin de arrastre de nodos con debounce. */
  setupNodeDragEnd(onDragEnd: () => void, debounceMs = 600): Subscription {
    return this.nodeDragEnd$.pipe(debounceTime(debounceMs)).subscribe(onDragEnd);
  }

  /** Dispara manualmente un evento de auto-guardado. */
  triggerAutoSave(): void {
    this.autoSave$.next();
  }

  /** Dispara el evento de finalización de arrastre de un nodo. */
  triggerNodeDragEnd(): void {
    this.nodeDragEnd$.next();
  }

  /** Restaura el borrador local si su marca de tiempo es más reciente que la del servidor. */
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
          return this.normalizer.normalizeDraftNode(n, isSequence, getDefaultColor);
        });

        return {
          restored: true,
          nodes: sanitizedDraftNodes,
          connections: (draft.connections || []).map((c: any) => ({
            ...c,
            lineStyle: sanitizeLineStyle(c.lineStyle, isSequence ? 'straight' : 'segment'),
          })),
          defaultLineStyle: sanitizeLineStyle(draft.defaultLineStyle, isSequence ? 'straight' : 'segment'),
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

  /** Mapea el AST de un diagrama proveniente del backend al modelo local de nodos y conexiones. */
  mapServerDiagramToLocal(
    diagram: any,
    getDefaultColor?: (nodeType?: string, stereotype?: string | null) => string,
    normalizeDataType?: (type: string) => string,
    normalizeReturnType?: (type: string) => string,
  ): { nodes: UmlClassNode[]; connections: UmlConnection[] } {
    return this.normalizer.mapServerDiagramToLocal(diagram, getDefaultColor, normalizeDataType, normalizeReturnType);
  }
}
