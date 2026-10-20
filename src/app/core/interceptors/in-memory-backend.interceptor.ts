import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { InMemoryBackendService } from '../services/in-memory-backend.service';

export const inMemoryBackendInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const inMemoryBackend = inject(InMemoryBackendService);

  const token = authService.token();
  const body = req.body as Record<string, unknown> | null;
  const loginEmail = typeof body?.['email'] === 'string' ? body['email'] : undefined;

  if (
    inMemoryBackend.isInMemoryToken(token) ||
    (req.url.endsWith('/auth/login') && inMemoryBackend.isDemoCredential(loginEmail))
  ) {
    return inMemoryBackend.handleRequest(req);
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 0 || error.status === 502 || error.status === 504) {
        return inMemoryBackend.handleRequest(req);
      }
      return throwError(() => error);
    }),
  );
};
