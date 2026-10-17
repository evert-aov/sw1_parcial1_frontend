import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BmpExportService } from '../../../../core/services/bmp-export.service';
import { XmiService } from '../../../../core/services/xmi.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  DiagramType,
  SaveDiagramAstRequest,
  UmlClassNode,
  UmlConnection,
  UmlLineStyle,
  UmlMessage,
} from '../../../../core/models/diagram.model';
import { DiagramCanvasComponent } from '../components/diagram-canvas/diagram-canvas.component';

export interface UmlDiagramExportJson {
  version: string;
  name: string;
  createdDate: string;
  defaultLineStyle: UmlLineStyle;
  nodes: UmlClassNode[];
  connections: UmlConnection[];
}

@Injectable({
  providedIn: 'root',
})
export class DiagramExportService {
  private readonly bmpExportService: BmpExportService;
  private readonly xmiService: XmiService;
  private readonly toastService?: ToastService | null;

  constructor(bmpService?: BmpExportService, xmiService?: XmiService, toastService?: ToastService) {
    if (bmpService) {
      this.bmpExportService = bmpService;
    } else {
      let injected: BmpExportService | null = null;
      try {
        injected = inject(BmpExportService, { optional: true });
      } catch {
        // Outside Angular DI context (e.g. unit tests with Object.create)
      }
      this.bmpExportService = injected ?? new BmpExportService();
    }

    if (xmiService) {
      this.xmiService = xmiService;
    } else {
      let injectedXmi: XmiService | null = null;
      try {
        injectedXmi = inject(XmiService, { optional: true });
      } catch {
        // Outside Angular DI context
      }
      this.xmiService = injectedXmi ?? ({} as any);
    }

    if (toastService !== undefined) {
      this.toastService = toastService;
    } else {
      try {
        this.toastService = inject(ToastService, { optional: true });
      } catch {
        this.toastService = null;
      }
    }
  }

  /**
   * Exporta el canvas a una imagen BMP o PNG preservando el zoom y la posición original del usuario.
   */
  async exportDiagramImage(
    diagramCanvas: DiagramCanvasComponent | undefined,
    format: 'bmp' | 'png',
    diagramName: string,
    diagramType: DiagramType,
    nodes: UmlClassNode[],
    connections: UmlConnection[],
  ): Promise<void> {
    const canvasComp = diagramCanvas?.canvas;
    const prevScale = canvasComp?.transform?.scale ?? 1;
    const prevPos = canvasComp?.transform?.position ? { ...canvasComp.transform.position } : { x: 0, y: 0 };
    const prevScaledPos = canvasComp?.transform?.scaledPosition ? { ...canvasComp.transform.scaledPosition } : { x: 0, y: 0 };

    diagramCanvas?.clearSelection();

    try {
      if (canvasComp?.transform) {
        canvasComp.resetScale();
        canvasComp.transform.position = { x: 0, y: 0 };
        canvasComp.transform.scaledPosition = { x: 0, y: 0 };
        canvasComp.redraw();
      }

      await new Promise<void>((resolve) => {
        if (typeof requestAnimationFrame !== 'undefined') {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        } else {
          setTimeout(resolve, 0);
        }
      });

      const containerEl = diagramCanvas?.getExportElement();
      if (containerEl) {
        if (format === 'bmp') {
          await this.bmpExportService.exportElementToBmp(containerEl, diagramName, diagramType);
        } else {
          await this.bmpExportService.exportElementToPng(containerEl, diagramName, diagramType);
        }
      } else {
        if (format === 'bmp') {
          this.bmpExportService.exportToBmp(nodes, connections, diagramName, diagramType);
        } else {
          this.bmpExportService.exportToPng(nodes, connections, diagramName, diagramType);
        }
      }
    } finally {
      if (canvasComp?.transform) {
        canvasComp.transform.scale = prevScale;
        canvasComp.transform.position = prevPos;
        canvasComp.transform.scaledPosition = prevScaledPos;
        canvasComp.redraw();
      }
    }
  }

  /**
   * Construye el objeto JSON exportable del proyecto de diagrama.
   */
  buildProjectJson(
    diagramName: string,
    defaultLineStyle: UmlLineStyle,
    nodes: UmlClassNode[],
    connections: UmlConnection[],
  ): UmlDiagramExportJson {
    return {
      version: '1.0',
      name: diagramName,
      createdDate: new Date().toISOString(),
      defaultLineStyle,
      nodes,
      connections,
    };
  }

  /**
   * Genera y descarga el archivo JSON del diagrama.
   */
  downloadJsonFile(
    diagramName: string,
    defaultLineStyle: UmlLineStyle,
    nodes: UmlClassNode[],
    connections: UmlConnection[],
  ): void {
    const project = this.buildProjectJson(diagramName, defaultLineStyle, nodes, connections);
    const blob = new Blob([JSON.stringify(project, null, 2)], {
      type: 'application/json',
    });
    const filename = `${diagramName.toLowerCase().replace(/\s+/g, '_')}_diagrama.json`;
    this.downloadBlob(blob, filename);
  }

  /**
   * Descarga un Blob como archivo en el navegador.
   */
  downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  /**
   * Construye el payload canónico AST para guardar el diagrama en el backend.
   */
  buildSaveAstPayload(
    activeDiagramType: DiagramType,
    defaultLineStyle: UmlLineStyle,
    nodes: UmlClassNode[],
    connectionsList: UmlConnection[],
    getNodeWidth: (node: UmlClassNode) => number,
    getNodeHeight: (node: UmlClassNode) => number,
    getDefaultColor: (nodeType?: string | null, stereotype?: string | null) => string,
    normalizeUmlMessage: (m: any, defaultSeq?: string) => UmlMessage,
    recalculateSequenceNumbers?: (conns: UmlConnection[], preserveOrder?: boolean) => UmlConnection[],
  ): SaveDiagramAstRequest {
    const isSequence = activeDiagramType === DiagramType.SEQUENCE;
    const connections = isSequence && recalculateSequenceNumbers
      ? recalculateSequenceNumbers(connectionsList, true)
      : connectionsList;

    return {
      type: activeDiagramType,
      defaultLineStyle,
      nodes: nodes.map((n) => {
        const cleanName = (n.name || '').trim();
        const fallbackName = n.isAnchor
          ? 'Anchor'
          : n.nodeType === 'boundary_box'
            ? '.'
            : (isSequence
              ? (n.nodeType === 'actor' || n.id.startsWith('actor_') ? 'actor_1' : 'lifeline_1')
              : 'ClassName');
        const finalName = (n.nodeType === 'boundary_box' && (cleanName === 'ClassName' || !cleanName))
          ? '.'
          : (cleanName || fallbackName);

        const resolvedNodeType =
          n.nodeType && n.nodeType !== 'class'
            ? n.nodeType
            : n.id.startsWith('actor_')
            ? 'actor'
            : n.id.startsWith('use_case_')
            ? 'use_case'
            : n.id.startsWith('boundary_box_')
            ? 'boundary_box'
            : n.id.startsWith('package_')
            ? 'package'
            : n.id.startsWith('boundary_')
            ? 'boundary'
            : n.id.startsWith('control_')
            ? 'control'
            : n.id.startsWith('entity_')
            ? 'entity'
            : n.id.startsWith('component_')
            ? 'component'
            : n.id.startsWith('device_')
            ? 'device'
            : n.id.startsWith('exec_env_') || n.id.startsWith('exec_')
            ? 'executionEnvironment'
            : n.id.startsWith('lifeline_')
            ? 'lifeline'
            : isSequence
            ? 'lifeline'
            : activeDiagramType === DiagramType.PACKAGE
            ? 'package'
            : n.nodeType || 'class';

        let nodeColor = n.color;
        if (!nodeColor || ((nodeColor === '#FFFDDD' || nodeColor === '#FDFAF3') && ['device', 'executionEnvironment', 'component', 'node', 'boundary_box', 'boundary', 'control', 'entity', 'lifeline', 'actor', 'use_case', 'package'].includes(resolvedNodeType))) {
          nodeColor = getDefaultColor(resolvedNodeType, n.stereotype);
        }

        const isExplicitSize = ['component', 'device', 'node', 'executionEnvironment', 'boundary_box', 'package'].includes(resolvedNodeType);
        const savedHeight = resolvedNodeType === 'lifeline'
          ? 60
          : (isExplicitSize
              ? (n.customHeight || n.height || getNodeHeight(n))
              : (n.customHeight || (n.isCustomSize ? n.height : null) || null));

        return {
          id: n.id,
          name: finalName,
          positionX: n.position.x,
          positionY: n.position.y,
          width: getNodeWidth(n),
          height: savedHeight,
          color: nodeColor,
          isAnchor: n.isAnchor,
          assocMainConnId: n.assocMainConnId,
          nodeType: resolvedNodeType,
          stereotype: n.stereotype || null,
          activations: (n as any).activations || [],
          attributes: (n.attributes || []).map((a: any, aIdx: number) => ({
            name: a.name,
            type: a.type || 'String',
            orderIndex: typeof a.orderIndex === 'number' ? a.orderIndex : aIdx,
            nullable: a.nullable !== undefined ? a.nullable : (a.isNullable !== undefined ? a.isNullable : true),
            unique: a.unique !== undefined ? a.unique : (a.isUnique !== undefined ? a.isUnique : false),
            length: a.length !== undefined && a.length !== null ? Number(a.length) : 255,
            defaultValue: a.defaultValue ?? a.default ?? null,
            default: a.default ?? a.defaultValue ?? null,
            visibility: a.visibility || undefined,
            isPk: typeof a.isPk === 'boolean' ? a.isPk : undefined,
            isFk: typeof a.isFk === 'boolean' ? a.isFk : undefined,
            isNullable: typeof a.isNullable === 'boolean' ? a.isNullable : undefined,
            isUnique: typeof a.isUnique === 'boolean' ? a.isUnique : undefined,
          })),
          methods: (n.methods || []).map((m: any, mIdx: number) => ({
            name: m.name,
            parameters: m.parameters || '',
            returnType: m.returnType || 'void',
            orderIndex: typeof m.orderIndex === 'number' ? m.orderIndex : mIdx,
            visibility: m.visibility || undefined,
          })),
        };
      }),
      connections: connections.map((c) => {
        const baseSourceId = c.sourceNodeId || c.sourceId.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
        const baseTargetId = c.targetNodeId || c.targetId.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
        return {
          id: c.id,
          sourceNodeId: baseSourceId,
          targetNodeId: baseTargetId,
          sourceId: c.sourceId,
          targetId: c.targetId,
          type: c.type,
          lineStyle: c.lineStyle || defaultLineStyle,
          name: c.name || null,
          sourceMultiplicity: isSequence ? '' : (c.sourceMultiplicity || ''),
          targetMultiplicity: isSequence ? '' : (c.targetMultiplicity || ''),
          assocAnchorNodeId: c.assocAnchorNodeId || null,
          messages: (c.messages || []).map((m, mIdx) => {
            const norm = normalizeUmlMessage(m, `${mIdx + 1}`);
            return {
              id: norm.id,
              sequenceNumber: norm.sequenceNumber,
              functionName: norm.functionName,
              parameters: norm.parameters ?? '',
              returnType: norm.returnType || undefined,
              direction: norm.direction,
              type: norm.type,
              isReturn: norm.isReturn,
              orderIndex: norm.orderIndex ?? mIdx,
              positionY: norm.positionY,
              color: norm.color || undefined,
            };
          }),
        };
      }),
    };
  }

  /**
   * Exporta el diagrama en formato XMI (Enterprise Architect)
   */
  exportXmi(params: {
    diagramId: string;
    diagramName: string;
    hasUnsavedChanges: boolean;
    isReadOnly: boolean;
    xmiService?: XmiService;
    saveAst: (diagramId: string, payload: any) => Observable<any>;
    buildSaveAstPayload: () => any;
    onSavedSuccessfully: () => void;
  }): void {
    const service = params.xmiService || this.xmiService;
    const triggerDownload = () => {
      service.exportDiagram(params.diagramId).subscribe({
        next: (blob: Blob) => {
          const filename = `${params.diagramName.toLowerCase().replace(/\s+/g, '_')}_ea.xmi`;
          this.downloadBlob(blob, filename);
          this.toastService?.success('Archivo XMI exportado correctamente.');
        },
        error: (err: any) => {
          const errMsg = err?.error?.message || err?.message || 'Error al exportar XMI.';
          this.toastService?.error(`Error al exportar XMI: ${errMsg}`);
        },
      });
    };

    if (params.hasUnsavedChanges && !params.isReadOnly) {
      const payload = params.buildSaveAstPayload();
      params.saveAst(params.diagramId, payload).subscribe({
        next: () => {
          params.onSavedSuccessfully();
          triggerDownload();
        },
        error: (err) => {
          console.warn('No se pudo guardar automáticamente antes de exportar XMI:', err);
          triggerDownload();
        },
      });
    } else {
      triggerDownload();
    }
  }

  /**
   * Valida y orquesta la exportación completa a XMI
   */
  executeDownloadXmi(options: {
    currentDiagramId: string | null;
    currentDiagramName: string;
    hasUnsavedChanges: boolean;
    isReadOnly: boolean;
    xmiService: XmiService;
    saveAst: (id: string, payload: any) => Observable<any>;
    buildSaveAstPayload: () => any;
    onSavedSuccessfully: () => void;
  }): void {
    if (!options.currentDiagramId) {
      this.toastService?.warning('Debes guardar el diagrama antes de exportar XMI.');
      return;
    }
    this.exportXmi({
      diagramId: options.currentDiagramId,
      diagramName: options.currentDiagramName,
      hasUnsavedChanges: options.hasUnsavedChanges,
      isReadOnly: options.isReadOnly,
      xmiService: options.xmiService,
      saveAst: options.saveAst,
      buildSaveAstPayload: options.buildSaveAstPayload,
      onSavedSuccessfully: options.onSavedSuccessfully,
    });
  }
}

