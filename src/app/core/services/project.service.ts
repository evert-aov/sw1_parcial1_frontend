import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, map, catchError, throwError } from 'rxjs';
import {
  Project,
  CreateProjectRequest,
  UpdateProjectRequest,
  AddMemberRequest,
  UpdateMemberRoleRequest,
  ProjectMember,
} from '../models/project.model';
import { ApiResponse } from '../models/auth.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ProjectService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/projects`;

  // Reactive state using Angular Signals
  readonly projects = signal<Project[]>([]);
  readonly selectedProject = signal<Project | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  /**
   * Carga la lista completa de proyectos pertenecientes al usuario autenticado.
   * @returns Observable con el arreglo de proyectos.
   */
  loadProjects(): Observable<Project[]> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    return this.http.get<ApiResponse<Project[]>>(this.apiUrl).pipe(
      map((res) => res.data),
      tap((data) => {
        this.projects.set(data);
        this.isLoading.set(false);
      }),
      catchError((err) => {
        this.isLoading.set(false);
        const msg = err.error?.error?.message || err.error?.message || 'Error al cargar los proyectos';
        this.errorMessage.set(Array.isArray(msg) ? msg.join(', ') : msg);
        return throwError(() => err);
      }),
    );
  }

  /**
   * Obtiene la información detallada de un proyecto por su ID.
   * @param id Identificador único del proyecto.
   * @returns Observable con los datos del proyecto.
   */
  getProject(id: string): Observable<Project> {
    this.isLoading.set(true);
    return this.http.get<ApiResponse<Project>>(`${this.apiUrl}/${id}`).pipe(
      map((res) => res.data),
      tap((project) => {
        this.selectedProject.set(project);
        this.isLoading.set(false);
      }),
      catchError((err) => {
        this.isLoading.set(false);
        return throwError(() => err);
      }),
    );
  }

  /**
   * Crea un nuevo proyecto en la plataforma.
   * @param payload Datos del nuevo proyecto (nombre, descripción).
   * @returns Observable con el proyecto creado.
   */
  createProject(payload: CreateProjectRequest): Observable<Project> {
    this.isLoading.set(true);
    return this.http.post<ApiResponse<Project>>(this.apiUrl, payload).pipe(
      map((res) => res.data),
      tap((newProject) => {
        this.projects.update((list) => [newProject, ...list]);
        this.isLoading.set(false);
      }),
      catchError((err) => {
        this.isLoading.set(false);
        return throwError(() => err);
      }),
    );
  }

  /**
   * Actualiza el nombre o descripción de un proyecto existente.
   * @param id Identificador del proyecto.
   * @param payload Datos a modificar.
   * @returns Observable con el proyecto actualizado.
   */
  updateProject(id: string, payload: UpdateProjectRequest): Observable<Project> {
    return this.http.patch<ApiResponse<Project>>(`${this.apiUrl}/${id}`, payload).pipe(
      map((res) => res.data),
      tap((updated) => {
        this.projects.update((list) => list.map((p) => (p.id === id ? updated : p)));
        if (this.selectedProject()?.id === id) {
          this.selectedProject.set(updated);
        }
      }),
    );
  }

  /**
   * Elimina un proyecto del sistema y actualiza la lista local.
   * @param id Identificador del proyecto a borrar.
   * @returns Observable con el resultado de la operación.
   */
  deleteProject(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<ApiResponse<{ success: boolean; message: string }>>(`${this.apiUrl}/${id}`).pipe(
      map((res) => res.data),
      tap(() => {
        this.projects.update((list) => list.filter((p) => p.id !== id));
        if (this.selectedProject()?.id === id) {
          this.selectedProject.set(null);
        }
      }),
    );
  }

  /**
   * Añade un nuevo miembro colaborador al proyecto indicado.
   * @param projectId Identificador del proyecto.
   * @param payload Datos del miembro (email, rol).
   * @returns Observable con el miembro agregado.
   */
  addMember(projectId: string, payload: AddMemberRequest): Observable<ProjectMember> {
    return this.http.post<ApiResponse<ProjectMember>>(`${this.apiUrl}/${projectId}/members`, payload).pipe(
      map((res) => res.data),
      tap((newMember) => {
        if (this.selectedProject()?.id === projectId) {
          this.selectedProject.update((p) => {
            if (!p) return null;
            return {
              ...p,
              memberCount: p.memberCount + 1,
              members: p.members ? [...p.members, newMember] : [newMember],
            };
          });
        }
      }),
    );
  }

  /**
   * Actualiza el rol asignado a un miembro dentro del proyecto.
   * @param projectId Identificador del proyecto.
   * @param userId Identificador del usuario miembro.
   * @param payload Nuevo rol asignado.
   * @returns Observable con la información del miembro actualizada.
   */
  updateMemberRole(projectId: string, userId: string, payload: UpdateMemberRoleRequest): Observable<ProjectMember> {
    return this.http.patch<ApiResponse<ProjectMember>>(`${this.apiUrl}/${projectId}/members/${userId}`, payload).pipe(
      map((res) => res.data),
      tap((updatedMember) => {
        if (this.selectedProject()?.id === projectId) {
          this.selectedProject.update((p) => {
            if (!p || !p.members) return p;
            return {
              ...p,
              members: p.members.map((m) => (m.userId === userId ? updatedMember : m)),
            };
          });
        }
      }),
    );
  }

  /**
   * Remueve a un miembro colaborador del proyecto.
   * @param projectId Identificador del proyecto.
   * @param userId Identificador del usuario a desvincular.
   * @returns Observable con el estado de la operación.
   */
  removeMember(projectId: string, userId: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<ApiResponse<{ success: boolean; message: string }>>(`${this.apiUrl}/${projectId}/members/${userId}`).pipe(
      map((res) => res.data),
      tap(() => {
        if (this.selectedProject()?.id === projectId) {
          this.selectedProject.update((p) => {
            if (!p || !p.members) return p;
            return {
              ...p,
              memberCount: Math.max(1, p.memberCount - 1),
              members: p.members.filter((m) => m.userId !== userId),
            };
          });
        }
      }),
    );
  }
}
