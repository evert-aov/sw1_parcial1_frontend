import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { Project } from '../../../core/models/project.model';
import { ProjectService } from '../../../core/services/project.service';
import { AuthService } from '../../../core/services/auth.service';
import { ProjectListComponent } from './project-list.component';

describe('Project administration from the editor', () => {
  it.each([
    ['settings', 'OWNER', true, false],
    ['settings', 'VIEWER', false, false],
    ['members', 'OWNER', false, true],
    ['members', 'VIEWER', false, true],
  ] as const)('opens %s with role %s using the existing form', (panel, role, edit, members) => {
    const project: Project = { id: 'project-1', name: 'Example', description: null, basePackage: 'com.example', javaVersion: 21,
      springBootVersion: '3.4.0', createdBy: 'owner-1', creatorName: 'Owner', userRole: role, memberCount: 1, diagramCount: 1, createdAt: '2026-10-22', members: [] };
    const service = { projects: signal([project]), loadProjects: vi.fn(() => of([project])), getProject: vi.fn(() => of(project)) };
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(),
      { provide: AuthService, useValue: { currentUser: signal(null) } },
      { provide: ProjectService, useValue: service },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ projectId: 'project-1', panel }) } } },
    ] });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const component = TestBed.runInInjectionContext(() => new ProjectListComponent());
    component.ngOnInit();
    expect(service.getProject).toHaveBeenCalledWith('project-1');
    expect(component.isEditModalOpen()).toBe(edit);
    expect(component.isMembersModalOpen()).toBe(members);
    if (edit) expect(component.editForm.value.name).toBe('Example');
    if (members) expect(component.selectedProjectForMembers()).toBe(project);
  });
});
