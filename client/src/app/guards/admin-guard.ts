import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

export const adminGuard: CanActivateFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.currentUser()?.rol?.includes('ADMIN')) {
        return true;
    }

    console.warn('⛔ Acceso denegado: Se requiere rol ADMIN.');
    router.navigate(['/dashboard']);
    return false;
};
