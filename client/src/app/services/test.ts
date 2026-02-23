import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TestService {
  private apiUrl = '/api/tests';

  constructor(private http: HttpClient) { }

  private getHeaders() {
    const token = localStorage.getItem('token');
    return new HttpHeaders().set('Authorization', `Bearer ${token}`);
  }

  // ── Lista de tests activos ──
  getTests(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl, { headers: this.getHeaders() });
  }

  // ── Grabar nuevo script ──
  recordTest(datos: { nombre: string; url: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/record`, datos, { headers: this.getHeaders() });
  }

  // ── Crear test manualmente (sin grabador) ──
  createManualTest(datos: { nombre: string; url: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/manual`, datos, { headers: this.getHeaders() });
  }

  // ── Ejecutar robot ──
  runTest(testId: number, slowMo: number = 0): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${testId}/run`, { slowMo }, { headers: this.getHeaders() });
  }

  // ── Eliminar test (hard delete) ──
  deleteTest(testId: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${testId}`, { headers: this.getHeaders() });
  }

  // ── Script Editor: obtener script ──
  getScript(testId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${testId}/script`, { headers: this.getHeaders() });
  }

  // ── Script Editor: guardar cambios ──
  updateScript(testId: number, script_codigo: string): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${testId}/script`, { script_codigo }, { headers: this.getHeaders() });
  }

  // ── Historial de ejecuciones de un test ──
  getExecutions(testId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${testId}/executions`, { headers: this.getHeaders() });
  }

  // ── Renombrar test ──
  renameTest(testId: number, nombre: string): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${testId}/rename`, { nombre }, { headers: this.getHeaders() });
  }

  // ── Admin: estadísticas globales (con filtros) ──
  getAdminStats(filters?: { usuarioId?: number | null; urlFiltro?: string | null; diasFiltro?: number | null }): Observable<any> {
    let url = `${this.apiUrl}/admin/stats`;
    const params: string[] = [];
    if (filters?.usuarioId) params.push(`usuarioId=${filters.usuarioId}`);
    if (filters?.urlFiltro) params.push(`urlFiltro=${encodeURIComponent(filters.urlFiltro)}`);
    if (filters?.diasFiltro) params.push(`diasFiltro=${filters.diasFiltro}`);
    if (params.length) url += '?' + params.join('&');
    return this.http.get<any>(url, { headers: this.getHeaders() });
  }

  // ── Admin: lista de usuarios ──
  getAdminUsuarios(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/admin/usuarios`, { headers: this.getHeaders() });
  }

  // ── Admin: cambiar rol de usuario ──
  cambiarRolUsuario(userId: number, rol: string): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/admin/usuarios/${userId}/rol`, { rol }, { headers: this.getHeaders() });
  }
}