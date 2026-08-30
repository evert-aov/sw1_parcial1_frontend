import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiResponse } from '../models/auth.model';
import { UmlClassNode, UmlConnection } from '../models/diagram.model';
import { environment } from '../../../environments/environment';

export interface ExportXmiResult {
  filename: string;
  xmiContent: string;
}

export interface DiagramVersionItem {
  id: string;
  diagramId: string;
  versionTag: string;
  astJson: Record<string, any>;
  xmiContent?: string | null;
  createdBy: string;
  creatorName?: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class XmiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/xmi`;

  /**
   * Exporta un diagrama existente a XMI 2.1 estándar compatible con Enterprise Architect v17.
   */
  exportDiagram(diagramId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export/${diagramId}`, {
      responseType: 'blob',
    });
  }

  /**
   * Exporta directamente el AST del lienzo a contenido XMI 2.1 con geometrías para descarga instantánea.
   */
  exportAst(payload: {
    diagramName: string;
    nodes: UmlClassNode[];
    connections: UmlConnection[];
    defaultLineStyle?: string;
  }): Observable<ExportXmiResult> {
    return this.http.post<ApiResponse<ExportXmiResult>>(`${this.apiUrl}/export-ast`, payload).pipe(
      map((res) => res.data),
    );
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

  /**
   * Crea un snapshot histórico o versión congelada del diagrama.
   */
  createVersion(diagramId: string, versionTag: string, astJson?: any): Observable<DiagramVersionItem> {
    return this.http.post<ApiResponse<DiagramVersionItem>>(`${this.apiUrl}/diagrams/${diagramId}/versions`, {
      versionTag,
      astJson,
    }).pipe(
      map((res) => res.data),
    );
  }

  /**
   * Lista todas las versiones históricas de un diagrama.
   */
  getVersions(diagramId: string): Observable<DiagramVersionItem[]> {
    return this.http.get<ApiResponse<DiagramVersionItem[]>>(`${this.apiUrl}/diagrams/${diagramId}/versions`).pipe(
      map((res) => res.data),
    );
  }

  /**
   * Restaura el estado activo del diagrama al AST de una versión histórica.
   */
  restoreVersion(diagramId: string, versionId: string): Observable<any> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/diagrams/${diagramId}/versions/${versionId}/restore`, {}).pipe(
      map((res) => res.data),
    );
  }
}
