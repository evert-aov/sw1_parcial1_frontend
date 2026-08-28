import { Routes } from '@angular/router';
import { UmlDiagram } from './uml-diagram/uml-diagram';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
  },
  {
    path: 'register',
    component: RegisterComponent,
  },
  {
    path: 'diagram',
    component: UmlDiagram,
    canActivate: [authGuard],
  },
  {
    path: '',
    redirectTo: 'diagram',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'diagram',
  },
];
