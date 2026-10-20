import { Injectable } from '@angular/core';
import { HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { User } from '../models/user.model';
import { AuthResponse, ApiResponse, LoginRequest, RegisterRequest } from '../models/auth.model';
import {
  Project,
  CreateProjectRequest,
  UpdateProjectRequest,
  AddMemberRequest,
  UpdateMemberRoleRequest,
  ProjectMember,
} from '../models/project.model';
import { DiagramDto, DiagramType, SaveDiagramAstRequest } from '../models/diagram.model';
import { GenerateCodeRequest } from './code-generator.service';
import {
  DEFAULT_IN_MEMORY_USER,
  IN_MEMORY_TOKEN_PREFIX,
  INITIAL_IN_MEMORY_DIAGRAMS,
  INITIAL_IN_MEMORY_PROJECTS,
  buildInMemoryCodePreview,
} from './in-memory-seed.data';

@Injectable({
  providedIn: 'root',
})
export class InMemoryBackendService {
  private readonly PROJECTS_STORAGE_KEY = 'uml_studio_mem_projects';
  private readonly DIAGRAMS_STORAGE_KEY = 'uml_studio_mem_diagrams';
  private readonly USER_STORAGE_KEY = 'uml_studio_user';

  private projects: Project[] = this.loadFromStorage(this.PROJECTS_STORAGE_KEY, INITIAL_IN_MEMORY_PROJECTS);
  private diagrams: DiagramDto[] = this.loadFromStorage(this.DIAGRAMS_STORAGE_KEY, INITIAL_IN_MEMORY_DIAGRAMS);

  isDemoCredential(email?: string): boolean {
    if (!email) return false;
    const normalized = email.trim().toLowerCase();
    return normalized === DEFAULT_IN_MEMORY_USER.email || normalized === 'admin@umlstudio.dev';
  }

  isInMemoryToken(token: string | null | undefined): boolean {
    return !!token && token.startsWith(IN_MEMORY_TOKEN_PREFIX);
  }

  createDemoSession(): AuthResponse {
    const user = this.getActiveUser();
    return {
      accessToken: `${IN_MEMORY_TOKEN_PREFIX}${Date.now()}`,
      user,
    };
  }

  handleRequest(req: HttpRequest<unknown>): Observable<HttpResponse<unknown>> {
    const url = req.url;
    const method = req.method.toUpperCase();
    const body = req.body as Record<string, unknown> | null;

    // --- AUTH ---
    if (url.endsWith('/auth/login') && method === 'POST') {
      const payload = (body || {}) as unknown as LoginRequest;
      const email = payload.email?.trim() || DEFAULT_IN_MEMORY_USER.email;
      const isDefault = email.toLowerCase() === DEFAULT_IN_MEMORY_USER.email;
      const user: User = {
        ...DEFAULT_IN_MEMORY_USER,
        email,
        fullName: isDefault ? DEFAULT_IN_MEMORY_USER.fullName : email.split('@')[0] || 'Usuario en Memoria',
      };
      return this.ok<AuthResponse>({
        accessToken: `${IN_MEMORY_TOKEN_PREFIX}${Date.now()}`,
        user,
      });
    }

    if (url.endsWith('/auth/register') && method === 'POST') {
      const payload = (body || {}) as unknown as RegisterRequest;
      const user: User = {
        id: `usr-mem-${Date.now()}`,
        fullName: payload.fullName?.trim() || DEFAULT_IN_MEMORY_USER.fullName,
        email: payload.email?.trim() || DEFAULT_IN_MEMORY_USER.email,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      return this.ok<AuthResponse>({
        accessToken: `${IN_MEMORY_TOKEN_PREFIX}${Date.now()}`,
        user,
      });
    }

    if (url.endsWith('/auth/me') && method === 'GET') {
      return this.ok<User>(this.getActiveUser());
    }

    if (url.endsWith('/auth/me') && method === 'PATCH') {
      const current = this.getActiveUser();
      const updated: User = {
        ...current,
        fullName: (body?.['fullName'] as string) || current.fullName,
      };
      return this.ok<User>(updated);
    }

    // --- PROJECTS ---
    if (url.endsWith('/projects') && method === 'GET') {
      return this.ok<Project[]>(this.syncDiagramCounts());
    }

    if (url.endsWith('/projects') && method === 'POST') {
      const payload = (body || {}) as unknown as CreateProjectRequest;
      const user = this.getActiveUser();
      const now = new Date().toISOString();
      const projectId = `proj-mem-${Date.now()}`;
      const newProject: Project = {
        id: projectId,
        name: payload.name || 'Nuevo Proyecto UML',
        description: payload.description || null,
        basePackage: payload.basePackage || 'com.example.app',
        javaVersion: payload.javaVersion || 21,
        springBootVersion: payload.springBootVersion || '3.4.0',
        createdBy: user.id,
        creatorName: user.fullName,
        userRole: 'OWNER',
        memberCount: 1,
        diagramCount: 1,
        createdAt: now,
        members: [
          {
            id: `mem-${Date.now()}`,
            userId: user.id,
            fullName: user.fullName,
            email: user.email,
            role: 'OWNER',
            joinedAt: now,
          },
        ],
      };

      const defaultDiagram: DiagramDto = {
        id: `diag-mem-${Date.now()}`,
        projectId,
        name: 'Diagrama de Clases Principal',
        type: DiagramType.CLASS,
        version: '1.0.0',
        defaultLineStyle: 'segment',
        nodes: [],
        connections: [],
        createdAt: now,
        updatedAt: now,
      };

      this.projects = [newProject, ...this.projects];
      this.diagrams = [...this.diagrams, defaultDiagram];
      this.persistState();
      return this.ok<Project>(newProject);
    }

    const projectMemberMatch = url.match(/\/projects\/([^/]+)\/members(?:\/([^/]+))?$/);
    if (projectMemberMatch) {
      return this.handleProjectMembers(projectMemberMatch[1], projectMemberMatch[2], method, body);
    }

    const projectMatch = url.match(/\/projects\/([^/]+)$/);
    if (projectMatch) {
      return this.handleSingleProject(projectMatch[1], method, body);
    }

    // --- DIAGRAMS ---
    const diagramsByProjectMatch = url.match(/\/diagrams\/project\/([^/]+)$/);
    if (diagramsByProjectMatch && method === 'GET') {
      const projectId = diagramsByProjectMatch[1];
      const list = this.diagrams.filter((d) => d.projectId === projectId);
      return this.ok<DiagramDto[]>(list);
    }

    if (url.endsWith('/diagrams') && method === 'POST') {
      const now = new Date().toISOString();
      const projectId = (body?.['projectId'] as string) || null;
      const newDiagram: DiagramDto = {
        id: `diag-mem-${Date.now()}`,
        projectId,
        name: (body?.['name'] as string) || 'Nuevo Diagrama UML',
        type: (body?.['type'] as DiagramType) || DiagramType.CLASS,
        version: '1.0.0',
        defaultLineStyle: 'segment',
        nodes: [],
        connections: [],
        createdAt: now,
        updatedAt: now,
      };
      this.diagrams = [...this.diagrams, newDiagram];
      this.syncDiagramCounts();
      this.persistState();
      return this.ok<DiagramDto>(newDiagram);
    }

    const diagramAstMatch = url.match(/\/diagrams\/([^/]+)\/ast$/);
    if (diagramAstMatch && method === 'PUT') {
      const diagramId = diagramAstMatch[1];
      const payload = (body || {}) as unknown as SaveDiagramAstRequest;
      const existing = this.diagrams.find((d) => d.id === diagramId);
      const updated: DiagramDto = existing
        ? {
            ...existing,
            type: payload.type || existing.type,
            defaultLineStyle: payload.defaultLineStyle || existing.defaultLineStyle,
            nodes: payload.nodes || [],
            connections: payload.connections || [],
            updatedAt: new Date().toISOString(),
          }
        : {
            id: diagramId,
            projectId: null,
            name: 'Diagrama en Memoria',
            type: payload.type || DiagramType.CLASS,
            version: '1.0.0',
            defaultLineStyle: payload.defaultLineStyle || 'segment',
            nodes: payload.nodes || [],
            connections: payload.connections || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
      this.diagrams = existing
        ? this.diagrams.map((d) => (d.id === diagramId ? updated : d))
        : [...this.diagrams, updated];
      this.persistState();
      return this.ok<DiagramDto>(updated);
    }

    const singleDiagramMatch = url.match(/\/diagrams\/([^/]+)$/);
    if (singleDiagramMatch) {
      return this.handleSingleDiagram(singleDiagramMatch[1], method, body);
    }

    // --- CODEGEN PREVIEW ---
    const codegenPreviewMatch = url.match(/\/codegen\/preview\/([^/]+)$/);
    if (codegenPreviewMatch && method === 'POST') {
      const diagramId = codegenPreviewMatch[1];
      const diagram = this.diagrams.find((d) => d.id === diagramId) || this.diagrams[0];
      const preview = buildInMemoryCodePreview(diagram, (body || {}) as unknown as GenerateCodeRequest);
      return this.ok(preview);
    }

    return this.ok({});
  }

  private handleSingleProject(
    projectId: string,
    method: string,
    body: Record<string, unknown> | null,
  ): Observable<HttpResponse<unknown>> {
    const found = this.projects.find((p) => p.id === projectId) || this.projects[0];
    if (method === 'GET') {
      return this.ok<Project>(found);
    }
    if (method === 'PATCH') {
      const payload = (body || {}) as unknown as UpdateProjectRequest;
      const updated: Project = {
        ...found,
        name: payload.name ?? found.name,
        description: payload.description !== undefined ? payload.description : found.description,
        basePackage: payload.basePackage ?? found.basePackage,
        javaVersion: payload.javaVersion ?? found.javaVersion,
        springBootVersion: payload.springBootVersion ?? found.springBootVersion,
      };
      this.projects = this.projects.map((p) => (p.id === projectId ? updated : p));
      this.persistState();
      return this.ok<Project>(updated);
    }
    if (method === 'DELETE') {
      this.projects = this.projects.filter((p) => p.id !== projectId);
      this.diagrams = this.diagrams.filter((d) => d.projectId !== projectId);
      this.persistState();
      return this.ok({ success: true, message: 'Proyecto eliminado en memoria' });
    }
    return this.ok(found);
  }

  private handleProjectMembers(
    projectId: string,
    memberUserId: string | undefined,
    method: string,
    body: Record<string, unknown> | null,
  ): Observable<HttpResponse<unknown>> {
    const project = this.projects.find((p) => p.id === projectId);
    if (!project) return this.ok({});

    if (method === 'POST') {
      const payload = (body || {}) as unknown as AddMemberRequest;
      const newMember: ProjectMember = {
        id: `mem-${Date.now()}`,
        userId: `usr-${Date.now()}`,
        fullName: payload.email.split('@')[0] || 'Colaborador',
        email: payload.email,
        role: payload.role || 'EDITOR',
        joinedAt: new Date().toISOString(),
      };
      const members = [...(project.members || []), newMember];
      this.projects = this.projects.map((p) =>
        p.id === projectId ? { ...p, members, memberCount: members.length } : p,
      );
      this.persistState();
      return this.ok<ProjectMember>(newMember);
    }

    if (method === 'PATCH' && memberUserId) {
      const payload = (body || {}) as unknown as UpdateMemberRoleRequest;
      let updatedMember: ProjectMember | undefined;
      const members = (project.members || []).map((m) => {
        if (m.userId === memberUserId) {
          updatedMember = { ...m, role: payload.role };
          return updatedMember;
        }
        return m;
      });
      this.projects = this.projects.map((p) => (p.id === projectId ? { ...p, members } : p));
      this.persistState();
      return this.ok<ProjectMember>(updatedMember || (project.members?.[0] as ProjectMember));
    }

    if (method === 'DELETE' && memberUserId) {
      const members = (project.members || []).filter((m) => m.userId !== memberUserId);
      this.projects = this.projects.map((p) =>
        p.id === projectId ? { ...p, members, memberCount: Math.max(1, members.length) } : p,
      );
      this.persistState();
      return this.ok({ success: true, message: 'Miembro removido' });
    }

    return this.ok({});
  }

  private handleSingleDiagram(
    diagramId: string,
    method: string,
    body: Record<string, unknown> | null,
  ): Observable<HttpResponse<unknown>> {
    const found = this.diagrams.find((d) => d.id === diagramId) || this.diagrams[0];
    if (method === 'GET') {
      return this.ok<DiagramDto>(found);
    }
    if (method === 'PATCH') {
      const updated: DiagramDto = {
        ...found,
        name: (body?.['name'] as string) || found.name,
        updatedAt: new Date().toISOString(),
      };
      this.diagrams = this.diagrams.map((d) => (d.id === diagramId ? updated : d));
      this.persistState();
      return this.ok<DiagramDto>(updated);
    }
    if (method === 'DELETE') {
      this.diagrams = this.diagrams.filter((d) => d.id !== diagramId);
      this.syncDiagramCounts();
      this.persistState();
      return this.ok({ success: true });
    }
    return this.ok(found);
  }

  private syncDiagramCounts(): Project[] {
    this.projects = this.projects.map((p) => ({
      ...p,
      diagramCount: this.diagrams.filter((d) => d.projectId === p.id).length,
    }));
    return this.projects;
  }

  private getActiveUser(): User {
    try {
      const raw = localStorage.getItem(this.USER_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) as User;
      }
    } catch {}
    return DEFAULT_IN_MEMORY_USER;
  }

  private loadFromStorage<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        return JSON.parse(raw) as T;
      }
    } catch {}
    return structuredClone(fallback);
  }

  private persistState(): void {
    try {
      localStorage.setItem(this.PROJECTS_STORAGE_KEY, JSON.stringify(this.projects));
      localStorage.setItem(this.DIAGRAMS_STORAGE_KEY, JSON.stringify(this.diagrams));
    } catch {}
  }

  private ok<T>(data: T): Observable<HttpResponse<ApiResponse<T>>> {
    return of(
      new HttpResponse({
        status: 200,
        body: {
          statusCode: 200,
          data,
          timestamp: new Date().toISOString(),
        },
      }),
    );
  }
}
