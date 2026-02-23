import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
    selector: 'app-register',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './register.html',
    styleUrl: './register.scss'
})
export class RegisterComponent {
    private authService = inject(AuthService);
    private router = inject(Router);

    form = { nombre_completo: '', email: '', password: '', confirm_password: '' };
    cargando = signal(false);
    error = signal<string | null>(null);
    showPass = signal(false);

    register(): void {
        this.error.set(null);
        if (!this.form.nombre_completo || !this.form.email || !this.form.password) {
            this.error.set('Completa todos los campos.'); return;
        }
        if (this.form.password !== this.form.confirm_password) {
            this.error.set('Las contraseñas no coinciden.'); return;
        }
        if (this.form.password.length < 6) {
            this.error.set('La contraseña debe tener al menos 6 caracteres.'); return;
        }

        this.cargando.set(true);
        this.authService.register(this.form).subscribe({
            next: () => this.router.navigate(['/dashboard']),
            error: (err) => {
                this.error.set(err?.error?.message || 'Error al registrar. Intenta de nuevo.');
                this.cargando.set(false);
            }
        });
    }
}
