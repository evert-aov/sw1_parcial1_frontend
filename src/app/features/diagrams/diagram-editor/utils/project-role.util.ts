import { Project, ProjectRole } from '../../../../core/models/project.model';

/**
 * Resuelve el rol del usuario actual dentro del proyecto según permisos del backend.
 *
 * @param project Proyecto actual o `null`.
 * @param userId Identificador del usuario autenticado.
 * @returns Rol del usuario (`OWNER`, `EDITOR` o `VIEWER`).
 */
export function resolveUserRoleInProject(project: Project | null, userId?: string | null): ProjectRole {
  if (!project || !userId) return 'EDITOR';
  if (project.userRole) return project.userRole;
  if (project.createdBy === userId) return 'OWNER';
  if (project.members) {
    const member = project.members.find((m) => m.userId === userId);
    if (member) return member.role;
  }
  return 'EDITOR';
}
