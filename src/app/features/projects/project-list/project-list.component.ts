import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroFolderPlus,
  heroFolder,
  heroUserGroup,
  heroDocumentChartBar,
  heroTrash,
  heroPencilSquare,
  heroArrowRightOnRectangle,
  heroUserCircle,
  heroMagnifyingGlass,
  heroPlus,
  heroXMark,
  heroEllipsisVertical,
  heroCube,
  heroShieldCheck,
  heroCheck,
  heroArrowTopRightOnSquare,
  heroAcademicCap,
  heroExclamationCircle,
} from '@ng-icons/heroicons/outline';

import { ProjectService } from '../../../core/services/project.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserGuideService } from '../../../core/services/user-guide.service';
import { Project, ProjectRole } from '../../../core/models/project.model';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { UserProfileModalComponent } from '../../diagrams/diagram-editor/components/user-profile-modal/user-profile-modal.component';
import { TranslatePipe, LanguageSelectorComponent } from '../../../core/i18n';
import { ThemeToggleComponent } from '../../../core/components/theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    NgIconComponent,
    UserProfileModalComponent,
    TranslatePipe,
    LanguageSelectorComponent,
    ThemeToggleComponent,
  ],
  providers: [
    provideIcons({
      heroFolderPlus,
      heroFolder,
      heroUserGroup,
      heroDocumentChartBar,
      heroTrash,
      heroPencilSquare,
      heroArrowRightOnRectangle,
      heroUserCircle,
      heroMagnifyingGlass,
      heroPlus,
      heroXMark,
      heroEllipsisVertical,
      heroCube,
      heroShieldCheck,
      heroCheck,
      heroArrowTopRightOnSquare,
      heroAcademicCap,
      heroExclamationCircle,
    }),
  ],
  templateUrl: './project-list.component.html',
  styleUrls: ['./project-list.component.css'],
})
export class ProjectListComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly projectService = inject(ProjectService);
  readonly authService = inject(AuthService);
  readonly guideService = inject(UserGuideService);
  private readonly router = inject(Router);
  private readonly confirmDialogService = inject(ConfirmDialogService);

  openGuide(prompt?: string): void {
    this.guideService.openGuide(prompt);
  }

  // Filtro de búsqueda
  readonly searchQuery = signal<string>('');

  // Modales
  readonly isCreateModalOpen = signal<boolean>(false);
  readonly isEditModalOpen = signal<boolean>(false);
  readonly isMembersModalOpen = signal<boolean>(false);
  readonly isProfileModalOpen = signal<boolean>(false);
  readonly selectedProjectForMembers = signal<Project | null>(null);
  readonly selectedProjectForEdit = signal<Project | null>(null);

  // Formulario Crear Proyecto
  readonly createForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: [''],
    basePackage: ['com.example.app', [Validators.required, Validators.maxLength(150)]],
    javaVersion: [21, [Validators.required]],
    springBootVersion: ['3.4.0', [Validators.required]],
  });

  // Formulario Editar Proyecto
  readonly editForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: [''],
    basePackage: ['com.example.app', [Validators.required, Validators.maxLength(150)]],
    javaVersion: [21, [Validators.required]],
    springBootVersion: ['3.4.0', [Validators.required]],
  });

  // Formulario Agregar Miembro
  readonly addMemberForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    role: ['EDITOR', [Validators.required]],
  });

  readonly projects = computed(() => this.projectService.projects());

  // Proyectos filtrados
  readonly filteredProjects = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const list = this.projectService.projects();
    if (!q) return list;
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        p.basePackage.toLowerCase().includes(q),
    );
  });

  logout(): void {
    this.authService.logout();
  }

  readonly createErrorMessageKey = signal<string | null>(null);
  readonly createCustomErrorMessage = signal<string | null>(null);
  readonly editErrorMessageKey = signal<string | null>(null);
  readonly editCustomErrorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.projectService.loadProjects().subscribe();
  }

  // --- CREAR PROYECTO ---
  openCreateModal(): void {
    this.createErrorMessageKey.set(null);
    this.createCustomErrorMessage.set(null);
    this.createForm.reset({
      name: '',
      description: '',
      basePackage: 'com.example.app',
      javaVersion: 21,
      springBootVersion: '3.4.0',
    });
    this.isCreateModalOpen.set(true);
  }

  closeCreateModal(): void {
    this.isCreateModalOpen.set(false);
    this.createErrorMessageKey.set(null);
    this.createCustomErrorMessage.set(null);
  }

  onCreateSubmit(): void {
    this.createErrorMessageKey.set(null);
    this.createCustomErrorMessage.set(null);
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      this.createErrorMessageKey.set('projects.createModal.requiredFieldsWarning');
      return;
    }

    this.projectService.createProject(this.createForm.value).subscribe({
      next: () => {
        this.closeCreateModal();
      },
      error: (err) => {
        const msg = err?.error?.message || err?.message;
        if (msg) {
          this.createCustomErrorMessage.set(Array.isArray(msg) ? msg.join(', ') : msg);
        } else {
          this.createErrorMessageKey.set('projects.createModal.createError');
        }
      },
    });
  }

  // --- EDITAR PROYECTO ---
  openEditModal(project: Project, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.editErrorMessageKey.set(null);
    this.editCustomErrorMessage.set(null);
    this.selectedProjectForEdit.set(project);
    this.editForm.patchValue({
      name: project.name,
      description: project.description || '',
      basePackage: project.basePackage,
      javaVersion: project.javaVersion,
      springBootVersion: project.springBootVersion,
    });
    this.isEditModalOpen.set(true);
  }

  closeEditModal(): void {
    this.isEditModalOpen.set(false);
    this.selectedProjectForEdit.set(null);
    this.editErrorMessageKey.set(null);
    this.editCustomErrorMessage.set(null);
  }

  onEditSubmit(): void {
    const project = this.selectedProjectForEdit();
    this.editErrorMessageKey.set(null);
    this.editCustomErrorMessage.set(null);
    if (!project || this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      this.editErrorMessageKey.set('projects.editModal.requiredFieldsWarning');
      return;
    }

    this.projectService.updateProject(project.id, this.editForm.value).subscribe({
      next: () => {
        this.closeEditModal();
      },
      error: (err) => {
        const msg = err?.error?.message || err?.message;
        if (msg) {
          this.editCustomErrorMessage.set(Array.isArray(msg) ? msg.join(', ') : msg);
        } else {
          this.editErrorMessageKey.set('projects.editModal.editError');
        }
      },
    });
  }

  openDiagram(project: Project): void {
    this.router.navigate(['/diagram'], {
      queryParams: { projectId: project.id, projectName: project.name },
    });
  }

  // --- GESTIÓN DE MIEMBROS ---
  openMembersModal(project: Project, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.selectedProjectForMembers.set(project);
    this.addMemberForm.reset({ email: '', role: 'EDITOR' });
    this.isMembersModalOpen.set(true);
  }

  closeMembersModal(): void {
    this.isMembersModalOpen.set(false);
    this.selectedProjectForMembers.set(null);
  }

  onAddMemberSubmit(): void {
    const project = this.selectedProjectForMembers();
    if (!project || this.addMemberForm.invalid) {
      this.addMemberForm.markAllAsTouched();
      return;
    }

    this.projectService.addMember(project.id, this.addMemberForm.value).subscribe({
      next: () => {
        this.addMemberForm.reset({ email: '', role: 'EDITOR' });
        this.projectService.getProject(project.id).subscribe((p) => {
          this.selectedProjectForMembers.set(p);
        });
      },
    });
  }

  async onRemoveMember(userId: string): Promise<void> {
    const project = this.selectedProjectForMembers();
    if (!project) return;

    const confirmed = await this.confirmDialogService.confirm({
      title: 'common.confirmModal.removeMemberTitle',
      message: 'common.confirmModal.removeMemberMessage',
      type: 'danger',
    });

    if (confirmed) {
      this.projectService.removeMember(project.id, userId).subscribe({
        next: () => {
          this.projectService.getProject(project.id).subscribe((p) => {
            this.selectedProjectForMembers.set(p);
          });
        },
      });
    }
  }

  onRoleChange(userId: string, newRole: ProjectRole): void {
    const project = this.selectedProjectForMembers();
    if (!project) return;

    this.projectService.updateMemberRole(project.id, userId, { role: newRole }).subscribe({
      next: () => {
        this.projectService.getProject(project.id).subscribe((p) => {
          this.selectedProjectForMembers.set(p);
        });
      },
    });
  }

  async onDeleteProject(project: Project, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    const confirmed = await this.confirmDialogService.confirm({
      title: 'common.confirmModal.deleteProjectTitle',
      message: 'common.confirmModal.deleteProjectMessage',
      messageParams: { name: project.name },
      type: 'danger',
    });

    if (confirmed) {
      this.projectService.deleteProject(project.id).subscribe();
    }
  }

  openProfileModal(): void {
    this.isProfileModalOpen.set(true);
  }
}
