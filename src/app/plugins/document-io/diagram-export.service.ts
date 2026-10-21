import { PluginRegistryService } from '../../core/plugins/plugin-registry.service';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BmpExportService } from '../../core/plugins/contracts/bmp-export.service.contract';
import { XmiService } from '../../core/plugins/contracts/xmi.service.contract';
import { ToastService } from '../../core/services/toast.service';
import {
  DiagramType,
  sanitizeLineStyle,
  SaveDiagramAstRequest,
  UmlClassNode,
  UmlConnection,
  UmlLineStyle,
  UmlMessage,
} from '../../core/models/diagram.model';
import type { DiagramExportCanvasTarget } from '../../core/plugins/contracts/diagram-export.service.contract';
import {
  UmlNodeNormalizerUtil,
} from '../../core/plugins/contracts/uml-node-normalizer.util.contract';
import { ConnectionCascadeUtil } from '../../core/plugins/contracts/connection-cascade.util.contract';

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
  private readonly normalizer = inject(UmlNodeNormalizerUtil);
  private readonly cascadeRules = inject(ConnectionCascadeUtil);
  private readonly registry = inject(PluginRegistryService);
  private readonly toastService = inject(ToastService, { optional: true });
  /** Servicio de exportación a imágenes BMP/PNG resuelto dinámicamente del microkernel. */
  private get bmpExportService(): BmpExportService { return this.registry.resolve(BmpExportService); }
  /** Servicio XMI resuelto de forma perezosa desde el registro de plug-ins. */
  private get xmiService(): XmiService { return this.registry.resolve(XmiService); }

  /**
   * Exporta el canvas a una imagen BMP o PNG preservando el zoom y la posición original del usuario.
   */
  async exportDiagramImage(
    diagramCanvas: DiagramExportCanvasTarget | undefined,
    format: 'bmp' | 'png',
    diagramName: string,
    diagramType: DiagramType,
    nodes: UmlClassNode[],
    connections: UmlConnection[],
  ): Promise<void> {
    diagramCanvas?.clearSelection();
    const restoreViewport = diagramCanvas?.prepareForExport();

    try {
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
          await this.bmpExportService.exportToBmp(nodes, connections, diagramName, diagramType);
        } else {
          this.bmpExportService.exportToPng(nodes, connections, diagramName, diagramType);
        }
      }
    } finally {
      restoreViewport?.();
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

        const resolvedNodeType = this.normalizer.inferNodeType(n, {
          isSequence,
          diagramType: activeDiagramType,
        });
        const nodeColor = this.normalizer.resolveNodeColor(
          n.color,
          resolvedNodeType,
          n.stereotype,
          getDefaultColor
        );

        const isExplicitSize = this.normalizer.isExplicitSizeType(resolvedNodeType);
        const savedHeight =
          resolvedNodeType === 'lifeline'
            ? 60
            : isExplicitSize
              ? n.customHeight || n.height || getNodeHeight(n)
              : n.customHeight || (n.isCustomSize ? n.height : null) || null;

        const rawX = n.position?.x ?? (n as any).positionX;
        const rawY = n.position?.y ?? (n as any).positionY;
        const numX = typeof rawX === 'number' ? rawX : parseFloat(rawX);
        const numY = typeof rawY === 'number' ? rawY : parseFloat(rawY);
        const posX = Number.isFinite(numX) ? Math.round(numX) : 50;
        const posY = Number.isFinite(numY) ? Math.round(numY) : 50;

        return {
          id: n.id,
          name: finalName,
          positionX: posX,
          positionY: posY,
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
        const baseSourceId = c.sourceNodeId || this.cascadeRules.extractBaseNodeId(c.sourceId);
        const baseTargetId = c.targetNodeId || this.cascadeRules.extractBaseNodeId(c.targetId);
        const fallbackMsgType = ['sync', 'reply', 'async', 'create'].includes(c.type) ? c.type : undefined;
        return {
          id: c.id,
          sourceNodeId: baseSourceId,
          targetNodeId: baseTargetId,
          sourceId: c.sourceId,
          targetId: c.targetId,
          type: c.type,
          lineStyle: sanitizeLineStyle(c.lineStyle, defaultLineStyle),
          name: c.name || null,
          sourceMultiplicity: isSequence ? '' : (c.sourceMultiplicity || ''),
          targetMultiplicity: isSequence ? '' : (c.targetMultiplicity || ''),
          assocAnchorNodeId: c.assocAnchorNodeId || null,
          messages: (c.messages || []).map((m, mIdx) => {
            const norm = normalizeUmlMessage(
              fallbackMsgType && !m.type ? { ...m, type: fallbackMsgType } : m,
              `${mIdx + 1}`,
            );
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

