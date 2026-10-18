import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'projects',
    loadComponent: () =>
      import('./features/projects/project-list/project-list.component').then(
        (m) => m.ProjectListComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'diagram',
    loadComponent: () =>
      import('./features/diagrams/diagram-editor/diagram-editor.component').then(
        (m) => m.DiagramEditorComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'diagrams/:id',
    loadComponent: () =>
      import('./features/diagrams/diagram-editor/diagram-editor.component').then(
        (m) => m.DiagramEditorComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: '',
    redirectTo: 'projects',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'projects',
  },
];
