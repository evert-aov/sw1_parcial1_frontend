import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, map, catchError, throwError } from 'rxjs';
import { ApiResponse } from '../../core/models/auth.model';
import { environment } from '../../../environments/environment';

export interface GeneratedFile {
  path: string;
  filename: string;
  language: string;
  layer: 'entity' | 'repository' | 'service' | 'controller' | 'dto' | 'migration' | 'config' | 'docker' | 'docs';
  content: string;
}

export interface CodeGenerationPreviewResponse {
  projectName: string;
  totalFiles: number;
  files: GeneratedFile[];
}

export interface GenerateCodeRequest {
  diagramId?: string;
  packageName?: string;
  artifactId?: string;
  groupId?: string;
  projectName?: string;
  javaVersion?: string;
  springBootVersion?: string;
  databaseName?: string;
  databaseUser?: string;
  databasePassword?: string;
  databasePort?: number;
  serverPort?: number;
  platform?: 'all' | 'spring-boot' | 'flutter';
  nodes?: any[];
  connections?: any[];
}

@Injectable({
  providedIn: 'root',
})
export class CodeGeneratorService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/codegen`;

  readonly isGenerating = signal<boolean>(false);
  readonly previewData = signal<CodeGenerationPreviewResponse | null>(null);

  /**
   * Solicita al backend la previsualización del código fuente generado a partir del AST del diagrama.
   * @param diagramId Identificador del diagrama UML.
   * @param payload Configuración de paquetes, versiones y parámetros de base de datos.
   * @returns Observable con la estructura de archivos generados.
   */
  previewFromDiagramId(diagramId: string, payload: GenerateCodeRequest): Observable<CodeGenerationPreviewResponse> {
    this.isGenerating.set(true);
    return this.http.post<ApiResponse<CodeGenerationPreviewResponse>>(`${this.apiUrl}/preview/${diagramId}`, payload).pipe(
      map((res) => res.data || (res as any)),
      tap((data) => {
        this.previewData.set(data);
        this.isGenerating.set(false);
      }),
      catchError((err) => {
        this.isGenerating.set(false);
        return throwError(() => err);
      }),
    );
  }

  /**
   * Descarga el proyecto generado empaquetado en un archivo comprimido .ZIP binario.
   * @param diagramId Identificador del diagrama UML.
   * @param payload Configuración y metadatos de generación.
   * @returns Observable con el Blob binario del archivo ZIP.
   */
  downloadZipFromDiagramId(diagramId: string, payload: GenerateCodeRequest): Observable<Blob> {
    return this.http.post(`${this.apiUrl}/download/${diagramId}`, payload, {
      responseType: 'blob',
    });
  }
}
