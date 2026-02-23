import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = '/api/auth';
  // Signal para saber quién está logueado en todo el sistema
  currentUser = signal<any>(null);

  constructor(private http: HttpClient) {
    const savedUser = localStorage.getItem('user');
    if (savedUser) this.currentUser.set(JSON.parse(savedUser));
  }

  login(credentials: any) {
    return this.http.post<any>(`${this.apiUrl}/login`, credentials).pipe(
      tap(res => {
        // Guardamos el token y los datos del usuario (id, nombre, rol)
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(res.user));
        this.currentUser.set(res.user);
      })
    );
  }

  register(data: any) {
    return this.http.post<any>(`${this.apiUrl}/register`, data).pipe(
      tap(res => {
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(res.user));
        this.currentUser.set(res.user);
      })
    );
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUser.set(null);
  }
}