import { QeaDiagramPreview } from '../../core/plugins/contracts/xmi.service.contract';
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiResponse } from '../../core/models/auth.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class XmiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/xmi`;

  /** Lee el inventario QEA en NestJS sin almacenar diagramas. */
  previewQea(file: File): Observable<QeaDiagramPreview[]> {
    const body = new FormData(); body.append('file', file);
    return this.http.post<ApiResponse<QeaDiagramPreview[]>>(`${environment.apiUrl}/qea/preview`, body).pipe(map(res => res.data));
  }

  /** Envía la selección explícita para crear copias nuevas en un proyecto autorizado. */
  importQea(file: File, projectId: string, diagramIds: number[]): Observable<{ id: string; name: string }[]> {
    const body = new FormData(); body.append('file', file); body.append('projectId', projectId); body.append('diagramIds', JSON.stringify(diagramIds));
    return this.http.post<ApiResponse<{ id: string; name: string }[]>>(`${environment.apiUrl}/qea/import`, body).pipe(map(res => res.data));
  }

  /** Descarga el repositorio QEA del diagrama o proyecto autorizado. */
  exportQea(id: string, project: boolean): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/qea/${project ? 'project' : 'export'}/${id}`, { responseType: 'blob' });
  }

  /**
   * Exporta un diagrama existente a XMI 2.1 estándar compatible con Enterprise Architect v17.
   */
  exportDiagram(diagramId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export/${diagramId}`, {
      responseType: 'blob',
    });
  }

  /**
   * Parsea un archivo XMI/XML 2.1 de Enterprise Architect e importa sus clases, atributos, métodos y coordenadas.
   */
  importXmi(payload: {
    xmiContent: string;
    diagramId?: string;
    projectId?: string;
    diagramName?: string;
  }): Observable<any> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/import`, payload).pipe(
      map((res) => res.data),
    );
  }
}
