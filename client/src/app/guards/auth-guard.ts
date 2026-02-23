import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Verificamos si hay un usuario en el Signal
  if (authService.currentUser()) {
    return true; // El paso está permitido
  }

  // Si no hay sesión, lo mandamos al login de inmediato
  console.warn('⛔ Acceso denegado: Intento de entrada sin login.');
  router.navigate(['/login']);
  return false;
};
