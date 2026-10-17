import { Project } from '../../../../core/models/project.model';

/**
 * Resuelve el rol del usuario actual dentro del proyecto según permisos del backend.
 */
export function resolveUserRoleInProject(project: Project | null, userId?: string | null): string {
  if (!project || !userId) return 'EDITOR';
  if (project.userRole) return project.userRole;
  if (project.createdBy === userId) return 'OWNER';
  if (project.members) {
    const member = project.members.find((m: any) => m.userId === userId);
    if (member) return member.role;
  }
  return 'EDITOR';
}
