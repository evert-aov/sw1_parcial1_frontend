import { InjectionToken, inject } from '@angular/core';
import { PluginRegistryService } from '../plugin-registry.service';
import { Observable } from 'rxjs';
export interface XmiService {
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
