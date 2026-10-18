import { Injectable, signal } from '@angular/core';
import { Subject, Subscription, debounceTime } from 'rxjs';
import {
  UmlClassNode,
  UmlConnection,
  UmlLineStyle,
  UmlNodeType,
  UmlRelationshipType,
} from '../../../../core/models/diagram.model';

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
    const { diagramId, isReadOnly, hasUnsavedChanges, token, apiUrl, payload, onSendDiagramSync } = options;
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
      recalculateSequenceNumbers: (conns: UmlConnection[], preserveOrder?: boolean) => UmlConnection[];
      onLoaded: (diagram: any, resolved: {
        nodes: UmlClassNode[];
        connections: UmlConnection[];
        defaultLineStyle?: UmlLineStyle;
        fromDraft: boolean;
      }) => void;
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
  ): { restored: boolean; nodes?: UmlClassNode[]; connections?: UmlConnection[]; defaultLineStyle?: UmlLineStyle } {
    const localDraftRaw = localStorage.getItem(`uml_draft_${diagramId}`);
    if (!localDraftRaw) return { restored: false };

    try {
      const draft = JSON.parse(localDraftRaw);
      const serverUpdated = serverUpdatedAt ? new Date(serverUpdatedAt).getTime() : 0;
      if (draft.timestamp && draft.timestamp > serverUpdated && draft.nodes?.length > 0) {
        const sanitizedDraftNodes: UmlClassNode[] = (draft.nodes || []).map((n: any) => {
          let nodeType: UmlNodeType | string = n.nodeType || 'class';
          if (nodeType === 'class') {
            if (n.id?.startsWith('actor_')) nodeType = 'actor';
            else if (n.id?.startsWith('use_case_')) nodeType = 'use_case';
            else if (n.id?.startsWith('boundary_box_')) nodeType = 'boundary_box';
            else if (n.id?.startsWith('package_')) nodeType = 'package';
            else if (n.id?.startsWith('boundary_')) nodeType = 'boundary';
            else if (n.id?.startsWith('control_')) nodeType = 'control';
            else if (n.id?.startsWith('entity_')) nodeType = 'entity';
            else if (n.id?.startsWith('component_')) nodeType = 'component';
            else if (n.id?.startsWith('device_')) nodeType = 'device';
            else if (n.id?.startsWith('exec_env_') || n.id?.startsWith('exec_')) nodeType = 'executionEnvironment';
            else if (n.id?.startsWith('lifeline_') || isSequence) nodeType = 'lifeline';
          }
          let name = n.name || '';
          if (nodeType === 'boundary_box' && (name === 'ClassName' || !name.trim())) {
            name = '.';
          }
          let nodeColor = n.color;
          if (!nodeColor && getDefaultColor) {
            nodeColor = getDefaultColor(nodeType, n.stereotype);
          }
          const isExplicitSizeNode = ['component', 'device', 'node', 'executionEnvironment', 'boundary_box', 'package'].includes(nodeType);
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
          const draftH = nodeType === 'lifeline' ? 60 : (n.height || n.customHeight || defaultH);
          return {
            ...n,
            nodeType,
            name,
            height: draftH,
            customHeight: n.customHeight || (isExplicitSizeNode ? draftH : undefined),
            customWidth: n.customWidth || (isExplicitSizeNode ? (n.width || 220) : undefined),
            isCustomSize: n.isCustomSize !== undefined ? n.isCustomSize : (isExplicitSizeNode || (!!draftH && nodeType === 'class')),
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
    const isSequence = diagram.type === 'sequence';

    const mappedNodes: UmlClassNode[] = (diagram.nodes || []).map((n: any) => {
      let nodeType: UmlNodeType | string = (n.nodeType as any) || (diagram.type === 'package' ? 'package' : (isSequence ? 'lifeline' : 'class'));
      if (nodeType === 'class') {
        if (n.id.startsWith('actor_')) {
          nodeType = 'actor';
        } else if (n.id.startsWith('use_case_')) {
          nodeType = 'use_case';
        } else if (n.id.startsWith('boundary_box_')) {
          nodeType = 'boundary_box';
        } else if (n.id.startsWith('package_')) {
          nodeType = 'package';
        } else if (n.id.startsWith('boundary_')) {
          nodeType = 'boundary';
        } else if (n.id.startsWith('control_')) {
          nodeType = 'control';
        } else if (n.id.startsWith('entity_')) {
          nodeType = 'entity';
        } else if (n.id.startsWith('component_')) {
          nodeType = 'component';
        } else if (n.id.startsWith('device_')) {
          nodeType = 'device';
        } else if (n.id.startsWith('exec_env_') || n.id.startsWith('exec_')) {
          nodeType = 'executionEnvironment';
        } else if (n.id.startsWith('lifeline_')) {
          nodeType = 'lifeline';
        } else if (isSequence) {
          nodeType = 'lifeline';
        }
      }
      const isBce = nodeType === 'boundary' || nodeType === 'control' || nodeType === 'entity';
      const isLifeline = nodeType === 'lifeline';
      const isExplicitSizeNode = ['component', 'device', 'node', 'executionEnvironment', 'boundary_box', 'package'].includes(nodeType);
      const hasExplicitDbHeight = !!(n.height && n.height > 0);
      const hasCustomFlag = !!n.isCustomSize || (!!n.customHeight && n.customHeight > 0) || (!!n.customWidth && n.customWidth > 0);
      const isManuallyResized = hasCustomFlag || isExplicitSizeNode || (hasExplicitDbHeight && (nodeType === 'class' || isBce || nodeType === 'actor' || nodeType === 'use_case'));

      let nodeName = n.name || '';
      if (nodeType === 'boundary_box' && (nodeName === 'ClassName' || !nodeName.trim())) {
        nodeName = '.';
      }

      let nodeColor = n.color;
      if (!nodeColor && getDefaultColor) {
        nodeColor = getDefaultColor(nodeType, n.stereotype);
      }

      const defaultWidth =
        nodeType === 'actor'
          ? 65
          : nodeType === 'use_case'
          ? 140
          : nodeType === 'boundary_box'
          ? 280
          : nodeType === 'package'
          ? 200
          : nodeType === 'component'
          ? 190
          : nodeType === 'device'
          ? 230
          : nodeType === 'executionEnvironment'
          ? 240
          : nodeType === 'node'
          ? 230
          : isBce
          ? 90
          : isLifeline
          ? 140
          : 220;
      const resolvedWidth = n.width || defaultWidth;

      const defaultHeight =
        isLifeline
          ? 60
          : isBce
          ? 95
          : nodeType === 'actor'
          ? 95
          : nodeType === 'boundary_box'
          ? 200
          : nodeType === 'component'
          ? 70
          : nodeType === 'device'
          ? 140
          : nodeType === 'executionEnvironment'
          ? 160
          : nodeType === 'node'
          ? 140
          : nodeType === 'package'
          ? 120
          : undefined;
      const resolvedHeight = isLifeline ? 60 : (n.height || defaultHeight);

      return {
        id: n.id,
        name: nodeName,
        position: { x: n.positionX, y: n.positionY },
        width: resolvedWidth,
        height: resolvedHeight,
        customWidth: isManuallyResized ? (n.customWidth || resolvedWidth) : undefined,
        customHeight: isManuallyResized ? (n.customHeight || resolvedHeight) : undefined,
        isCustomSize: isManuallyResized,
        color: nodeColor,
        isAnchor: n.isAnchor,
        nodeType,
        stereotype: n.stereotype || null,
        assocMainConnId: n.assocMainConnId || undefined,
        activations: n.activations || [],
        attributes: (n.attributes || []).map((a: any) => ({
          name: a.name,
          type: normalizeDataType ? normalizeDataType(a.type) : a.type,
          orderIndex: a.orderIndex,
          nullable: a.nullable !== undefined ? a.nullable : true,
          unique: a.unique !== undefined ? a.unique : false,
          length: a.length !== undefined ? a.length : 255,
          defaultValue: a.defaultValue ?? a.default ?? null,
          default: a.default ?? a.defaultValue ?? null,
        })),
        methods: (n.methods || []).map((m: any) => ({
          name: m.name,
          parameters: m.parameters,
          returnType: normalizeReturnType ? normalizeReturnType(m.returnType) : m.returnType,
        })),
      };
    });

    const mappedConnections: UmlConnection[] = (diagram.connections || []).map((c: any) => ({
      id: c.id,
      sourceNodeId: c.sourceNodeId || undefined,
      targetNodeId: c.targetNodeId || undefined,
      sourceId: c.sourceId,
      targetId: c.targetId,
      type: c.type as UmlRelationshipType,
      lineStyle: (c.lineStyle as UmlLineStyle) || 'segment',
      name: c.name || undefined,
      sourceMultiplicity: isSequence ? '' : (c.sourceMultiplicity || ''),
      targetMultiplicity: isSequence ? '' : (c.targetMultiplicity || ''),
      assocAnchorNodeId: c.assocAnchorNodeId || undefined,
      messages: c.messages || [],
    }));

    return { nodes: mappedNodes, connections: mappedConnections };
  }
}
