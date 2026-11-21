import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, map, catchError, throwError } from 'rxjs';
import {
  DiagramDto,
  DiagramType,
  SaveDiagramAstRequest,
  UmlClassNode,
  UmlConnection,
} from '../models/diagram.model';
import { ApiResponse } from '../models/auth.model';
import { environment } from '../../../environments/environment';
import { CollaborationService } from './collaboration.service';

@Injectable({
  providedIn: 'root',
})
export class DiagramService {
  private readonly http = inject(HttpClient);
  private readonly collaboration = inject(CollaborationService, { optional: true });
  private readonly apiUrl = `${environment.apiUrl}/diagrams`;

  // Signals para estado reactivo
  readonly currentDiagram = signal<DiagramDto | null>(null);
  readonly projectDiagrams = signal<DiagramDto[]>([]);
  readonly isSaving = signal<boolean>(false);
  readonly lastSavedAt = signal<Date | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  /**
   * Carga desde el backend la definición completa de un diagrama por su identificador.
   * @param diagramId Identificador único del diagrama.
   * @returns Observable con el DTO del diagrama.
   */
  loadDiagram(diagramId: string): Observable<DiagramDto> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    return this.http.get<ApiResponse<DiagramDto>>(`${this.apiUrl}/${diagramId}`).pipe(
      map((res) => res.data),
      tap((diagram) => {
        this.currentDiagram.set(diagram);
        this.isLoading.set(false);
      }),
      catchError((err) => {
        this.isLoading.set(false);
        const msg = err.error?.error?.message || err.error?.message || 'Error al cargar el diagrama';
        this.errorMessage.set(Array.isArray(msg) ? msg.join(', ') : msg);
        return throwError(() => err);
      }),
    );
  }

  /**
   * Obtiene la lista de todos los diagramas asociados a un proyecto.
   * @param projectId Identificador del proyecto.
   * @returns Observable con la colección de diagramas.
   */
  loadDiagramsByProject(projectId: string): Observable<DiagramDto[]> {
    this.isLoading.set(true);
    return this.http.get<ApiResponse<DiagramDto[]>>(`${this.apiUrl}/project/${projectId}`).pipe(
      map((res) => res.data),
      tap((diagrams) => {
        this.projectDiagrams.set(diagrams || []);
        this.isLoading.set(false);
      }),
      catchError((err) => {
        this.isLoading.set(false);
        return throwError(() => err);
      }),
    );
  }

  /**
   * Crea un nuevo diagrama dentro de un proyecto con el tipo UML especificado.
   * @param projectId Identificador del proyecto contenedor.
   * @param name Nombre inicial del diagrama.
   * @param type Tipo de diagrama UML (ej. CLASS, SEQUENCE, etc.).
   * @returns Observable con el diagrama recién creado.
   */
  createDiagram(
    projectId: string,
    name: string,
    type: DiagramType = DiagramType.CLASS,
  ): Observable<DiagramDto> {
    this.isLoading.set(true);
    return this.http.post<ApiResponse<DiagramDto>>(this.apiUrl, { projectId, name, type }).pipe(
      map((res) => res.data),
      tap((diagram) => {
        this.currentDiagram.set(diagram);
        const currentList = this.projectDiagrams();
        if (!currentList.some((d) => d.id === diagram.id)) {
          this.projectDiagrams.set([...currentList, diagram]);
        }
        this.isLoading.set(false);
      }),
      catchError((err) => {
        this.isLoading.set(false);
        return throwError(() => err);
      }),
    );
  }

  /**
   * Persiste el AST (nodos, conexiones y metadatos) del diagrama en la base de datos.
   * @param diagramId Identificador del diagrama a guardar.
   * @param payload Estructura AST serializada.
   * @returns Observable con el diagrama actualizado tras el guardado.
   */
  saveAst(diagramId: string, payload: SaveDiagramAstRequest): Observable<DiagramDto> {
    this.isSaving.set(true);
    const socketId = this.collaboration?.getSocketId();
    const options = socketId ? { headers: { 'X-Collaboration-Socket-Id': socketId } } : {};
    return this.http.put<ApiResponse<DiagramDto>>(`${this.apiUrl}/${diagramId}/ast`, payload, options).pipe(
      map((res) => res.data),
      tap((saved) => {
        this.currentDiagram.set(saved);
        this.isSaving.set(false);
        this.lastSavedAt.set(new Date());
      }),
      catchError((err) => {
        this.isSaving.set(false);
        return throwError(() => err);
      }),
    );
  }

  /**
   * Renombra un diagrama existente.
   * @param diagramId Identificador del diagrama.
   * @param name Nuevo nombre asignado.
   * @returns Observable con el diagrama renombrado.
   */
  renameDiagram(diagramId: string, name: string): Observable<DiagramDto> {
    return this.http.patch<ApiResponse<DiagramDto>>(`${this.apiUrl}/${diagramId}`, { name }).pipe(
      map((res) => res.data),
      tap((updated) => {
        this.projectDiagrams.update((list) =>
          list.map((d) => (d.id === diagramId ? { ...d, name: updated.name } : d)),
        );
        if (this.currentDiagram()?.id === diagramId) {
          this.currentDiagram.update((cur) => (cur ? { ...cur, name: updated.name } : cur));
        }
      }),
    );
  }

  /**
   * Elimina un diagrama del proyecto en el backend y de la lista reactiva local.
   * @param diagramId Identificador del diagrama a eliminar.
   * @returns Observable vacío al finalizar la eliminación.
   */
  deleteDiagram(diagramId: string): Observable<void> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/${diagramId}`).pipe(
      map(() => void 0),
      tap(() => {
        this.projectDiagrams.update((list) => list.filter((d) => d.id !== diagramId));
      }),
    );
  }
}
