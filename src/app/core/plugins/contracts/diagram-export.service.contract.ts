import { InjectionToken, inject } from '@angular/core';
import { PluginRegistryService } from '../plugin-registry.service';
import { Observable } from 'rxjs';
import { XmiService } from './xmi.service.contract';
import {
  DiagramType,
  SaveDiagramAstRequest,
  UmlClassNode,
  UmlConnection,
  UmlLineStyle,
  UmlMessage,
} from '../../models/diagram.model';
/** Host adapter for image capture; no rendering-library types cross this boundary. */
export interface DiagramExportCanvasTarget {
  clearSelection(): void;
  getExportElement(): HTMLElement | undefined;
  /** Normalize the viewport for capture and return its restoration callback. */
  prepareForExport(): () => void;
}

export interface UmlDiagramExportJson {
  version: string;
  name: string;
  createdDate: string;
  defaultLineStyle: UmlLineStyle;
  nodes: UmlClassNode[];
  connections: UmlConnection[];
}
export interface DiagramExportService {
  exportDiagramImage(
    diagramCanvas: DiagramExportCanvasTarget | undefined,
    format: 'bmp' | 'png',
    diagramName: string,
    diagramType: DiagramType,
    nodes: UmlClassNode[],
    connections: UmlConnection[],
  ): Promise<void>;
  buildProjectJson(
    diagramName: string,
    defaultLineStyle: UmlLineStyle,
    nodes: UmlClassNode[],
    connections: UmlConnection[],
  ): UmlDiagramExportJson;
  downloadJsonFile(
    diagramName: string,
    defaultLineStyle: UmlLineStyle,
    nodes: UmlClassNode[],
    connections: UmlConnection[],
  ): void;
  downloadBlob(blob: Blob, filename: string): void;
  buildSaveAstPayload(
    activeDiagramType: DiagramType,
    defaultLineStyle: UmlLineStyle,
    nodes: UmlClassNode[],
    connectionsList: UmlConnection[],
    getNodeWidth: (node: UmlClassNode) => number,
    getNodeHeight: (node: UmlClassNode) => number,
    getDefaultColor: (nodeType?: string | null, stereotype?: string | null) => string,
    normalizeUmlMessage: (m: any, defaultSeq?: string) => UmlMessage,
    recalculateSequenceNumbers?: (
      conns: UmlConnection[],
      preserveOrder?: boolean,
    ) => UmlConnection[],
  ): SaveDiagramAstRequest;
  exportXmi(params: {
    diagramId: string;
    diagramName: string;
    hasUnsavedChanges: boolean;
    isReadOnly: boolean;
    xmiService?: XmiService;
    saveAst: (diagramId: string, payload: any) => Observable<any>;
    buildSaveAstPayload: () => any;
    onSavedSuccessfully: () => void;
  }): void;
  executeDownloadXmi(options: {
    currentDiagramId: string | null;
    currentDiagramName: string;
    hasUnsavedChanges: boolean;
    isReadOnly: boolean;
    xmiService: XmiService;
    saveAst: (id: string, payload: any) => Observable<any>;
    buildSaveAstPayload: () => any;
    onSavedSuccessfully: () => void;
  }): void;
}
export const DiagramExportService: InjectionToken<DiagramExportService> =
  new InjectionToken<DiagramExportService>('DiagramExportService', {
    providedIn: 'root',
    factory: () => inject(PluginRegistryService).resolve(DiagramExportService),
  });
