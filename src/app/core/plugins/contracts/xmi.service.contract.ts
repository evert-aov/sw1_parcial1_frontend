import { InjectionToken, inject } from '@angular/core';
import { PluginRegistryService } from '../plugin-registry.service';
import { Observable } from 'rxjs';
export interface QeaDiagramPreview {
  id: number; name: string; packageName: string; type: string;
  nodeCount: number; connectionCount: number; warnings: string[]; supported: boolean;
}
export interface XmiService {
  previewQea(file: File): Observable<QeaDiagramPreview[]>;
  importQea(file: File, projectId: string, diagramIds: number[]): Observable<{ id: string; name: string }[]>;
  exportQea(id: string, project: boolean): Observable<Blob>;
  exportDiagram(diagramId: string): Observable<Blob>;
  importXmi(payload: {
    xmiContent: string;
    diagramId?: string;
    projectId?: string;
    diagramName?: string;
  }): Observable<any>;
}
export const XmiService: InjectionToken<XmiService> = new InjectionToken<XmiService>('XmiService', {
  providedIn: 'root',
  factory: () => inject(PluginRegistryService).resolve(XmiService),
});
