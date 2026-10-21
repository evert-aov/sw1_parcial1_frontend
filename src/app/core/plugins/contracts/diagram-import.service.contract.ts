import { InjectionToken, inject } from '@angular/core';
import { PluginRegistryService } from '../plugin-registry.service';
import { ToastService } from '../../services/toast.service';
import { DiagramType, UmlClassNode, UmlConnection, UmlLineStyle } from '../../models/diagram.model';
export interface DiagramImportResult {
  format: 'xmi' | 'json';
  nodes: UmlClassNode[];
  connections: UmlConnection[];
  name?: string;
  diagramType?: DiagramType;
  defaultLineStyle?: UmlLineStyle;
}
export interface DiagramImportService {
  parseFile(
    file: File,
    normalizeDataType: (type: string) => string,
    normalizeReturnType: (type: string) => string,
  ): Promise<DiagramImportResult>;
  parseJsonProject(
    jsonString: string,
    normalizeDataType: (type: string) => string,
    normalizeReturnType: (type: string) => string,
  ): DiagramImportResult;
  executeJsonImport(options: {
    jsonString: string;
    isReadOnly: boolean;
    hasMultipleActiveUsers: boolean;
    multiUserBlockedMsg: string;
    normalizeDataType: (type: string) => string;
    normalizeReturnType: (type: string) => string;
    onSuccess: (result: DiagramImportResult) => void;
  }): void;
  executeFileImport(options: {
    event: Event;
    isReadOnly: boolean;
    hasMultipleActiveUsers: boolean;
    multiUserBlockedMsg: string;
    normalizeDataType: (type: string) => string;
    normalizeReturnType: (type: string) => string;
    onSuccess: (result: DiagramImportResult) => void;
  }): Promise<void>;
}
export const DiagramImportService: InjectionToken<DiagramImportService> =
  new InjectionToken<DiagramImportService>('DiagramImportService', {
    providedIn: 'root',
    factory: () => inject(PluginRegistryService).resolve(DiagramImportService),
  });
