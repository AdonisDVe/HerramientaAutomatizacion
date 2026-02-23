import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TestService } from '../../services/test';
import { AuthService } from '../../services/auth';
import { Router } from '@angular/router';
import { ScriptEditorComponent } from '../script-editor/script-editor';
import { ExecutionHistoryComponent } from '../execution-history/execution-history';

@Component({
  selector: 'app-test-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ScriptEditorComponent, ExecutionHistoryComponent],
  templateUrl: './test-list.html',
  styleUrl: './test-list.scss'
})
export class TestListComponent implements OnInit {
  private testService = inject(TestService);
  private authService = inject(AuthService);
  private router = inject(Router);

  user = this.authService.currentUser;
  tests = signal<any[]>([]);
  cargando = false;

  // Modal grabador
  mostrandoGrabador = false;
  nuevoTest = { nombre: '', url: '' };

  // Modal video + capturas post-ejecución
  videoUrl = signal<string | null>(null);
  capturas = signal<string[]>([]);
  capturaSel = signal<string | null>(null);
  errorDetail = signal<string | null>(null);
  ejecutandoId = signal<number | null>(null);

  // Modal script editor
  scriptEditorTestId = signal<number | null>(null);
  scriptEditorNombre = signal<string>('');

  // Modal historial
  historialTestId = signal<number | null>(null);
  historialNombre = signal<string>('');

  // Renombrar inline
  renombrandoId = signal<number | null>(null);
  nuevoNombre = signal<string>('');

  // Velocidad de ejecución por test (0 = normal, ms = lento)
  slowMoMap = signal<Map<number, number>>(new Map());

  setSlowMo(testId: number, ms: number): void {
    const m = new Map(this.slowMoMap());
    m.set(testId, ms);
    this.slowMoMap.set(m);
  }

  getSlowMo(testId: number): number {
    return this.slowMoMap().get(testId) ?? 0;
  }

  toggleModoLento(testId: number): void {
    const current = this.getSlowMo(testId);
    this.setSlowMo(testId, current === 0 ? 800 : 0);
  }

  // Toast
  toast = signal<{ texto: string; tipo: 'success' | 'error' } | null>(null);

  ngOnInit(): void { this.cargar(); }

  cargar(): void {
    this.testService.getTests().subscribe({
      next: (data) => this.tests.set(data),
      error: () => this.mostrarToast('Error al cargar los tests.', 'error')
    });
  }

  iniciarGrabacion(): void {
    if (!this.nuevoTest.nombre || !this.nuevoTest.url) {
      this.mostrarToast('Completa el nombre y la URL.', 'error');
      return;
    }
    this.cargando = true;
    this.testService.recordTest(this.nuevoTest).subscribe({
      next: () => {
        this.cargando = false;
        this.mostrandoGrabador = false;
        this.nuevoTest = { nombre: '', url: '' };
        this.cargar();
        this.mostrarToast('¡Grabación completada y guardada!', 'success');
      },
      error: () => {
        this.cargando = false;
        this.mostrarToast('Error al levantar el grabador.', 'error');
      }
    });
  }

  ejecutarTest(testId: number): void {
    const slowMo = this.getSlowMo(testId);
    this.ejecutandoId.set(testId);

    // Limpiar evidencias anteriores
    this.videoUrl.set(null);
    this.capturas.set([]);
    this.errorDetail.set(null);

    if (slowMo > 0) {
      this.mostrarToast('🖥️ Modo visible — busca la ventana de Chromium en tu escritorio.', 'success', 6000);
    }

    this.testService.runTest(testId, slowMo).subscribe({
      next: (res) => {
        this.ejecutandoId.set(null);
        if (res.videoUrl) this.videoUrl.set(res.videoUrl);
        if (res.capturas?.length) this.capturas.set(res.capturas);
        this.mostrarToast(`Ejecución ${res.status === 'PASSED' ? 'exitosa ✅' : 'fallida ❌'}`, res.status === 'PASSED' ? 'success' : 'error');
        this.cargar();
      },
      error: (err) => {
        this.ejecutandoId.set(null);
        const res = err?.error;
        const detail = res?.errorDetail || null;
        if (detail) this.errorDetail.set(detail);

        // Si el fallo trajo evidencia, la cargamos también
        if (res?.videoUrl) this.videoUrl.set(res.videoUrl);
        if (res?.capturas?.length) this.capturas.set(res.capturas);

        this.mostrarToast('El robot falló ❌ — revisa el detalle del error.', 'error');
        this.cargar();
      }
    });
  }

  eliminarTest(testId: number): void {
    if (!confirm('¿Seguro que deseas eliminar esta prueba? Se eliminarán también sus evidencias.')) return;
    this.testService.deleteTest(testId).subscribe({
      next: () => { this.cargar(); this.mostrarToast('Test eliminado.', 'success'); },
      error: () => this.mostrarToast('Error al eliminar.', 'error')
    });
  }

  // ── Rename inline ──
  iniciarRenombrar(test: any): void {
    this.renombrandoId.set(test.id);
    this.nuevoNombre.set(test.nombre);
  }

  cancelarRenombrar(): void {
    this.renombrandoId.set(null);
    this.nuevoNombre.set('');
  }

  confirmarRenombrar(testId: number): void {
    const nombre = this.nuevoNombre().trim();
    if (!nombre) { this.mostrarToast('El nombre no puede estar vacío.', 'error'); return; }
    this.testService.renameTest(testId, nombre).subscribe({
      next: () => {
        this.renombrandoId.set(null);
        this.cargar();
        this.mostrarToast('Prueba renombrada.', 'success');
      },
      error: () => this.mostrarToast('Error al renombrar.', 'error')
    });
  }

  // ── Modales ──
  abrirScriptEditor(test: any): void { this.scriptEditorTestId.set(test.id); this.scriptEditorNombre.set(test.nombre); }
  abrirHistorial(test: any): void { this.historialTestId.set(test.id); this.historialNombre.set(test.nombre); }
  cerrarScriptEditor(): void { this.scriptEditorTestId.set(null); }
  cerrarHistorial(): void { this.historialTestId.set(null); }
  cerrarVideo(): void { this.videoUrl.set(null); this.capturas.set([]); this.capturaSel.set(null); }
  ejecutarDesdeEditor(e: { testId: number; script: string }): void { this.ejecutarTest(e.testId); }

  // ── Descargar capturas ──
  downloadCaptura(url: string, index: number): void {
    fetch(url)
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `paso_${String(index + 1).padStart(3, '0')}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
      });
  }

  async downloadAllCapturas(): Promise<void> {
    for (let i = 0; i < this.capturas().length; i++) {
      this.downloadCaptura(this.capturas()[i], i);
      await new Promise(r => setTimeout(r, 350)); // pausa entre descargas
    }
  }

  // ── Toast ──
  mostrarToast(texto: string, tipo: 'success' | 'error', duracion = 3500): void {
    this.toast.set({ texto, tipo });
    setTimeout(() => this.toast.set(null), duracion);
  }

  irAlAdmin(): void { this.router.navigate(['/admin']); }
  logout(): void { this.authService.logout(); this.router.navigate(['/login']); }

  get isAdmin(): boolean {
    return this.user()?.rol?.includes('ADMIN') ?? false;
  }
}