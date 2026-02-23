import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent {
  cargando = signal(false);
  error = signal<string | null>(null);

  constructor(private authService: AuthService, private router: Router) { }

  onLogin(event: Event) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const credentials = {
      email: (form.elements.namedItem('email') as HTMLInputElement).value,
      password: (form.elements.namedItem('password') as HTMLInputElement).value
    };

    this.cargando.set(true);
    this.error.set(null);

    this.authService.login(credentials).subscribe({
      next: () => {
        this.cargando.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(err?.error?.message || 'Credenciales incorrectas. Intenta de nuevo.');
      }
    });
  }
}
