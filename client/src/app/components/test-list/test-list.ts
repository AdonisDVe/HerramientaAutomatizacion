import { Component, OnInit, inject, signal, computed } from '@angular/core';
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

  // Modal video post-ejecución
  videoUrl = signal<string | null>(null);
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

  // Proyectos
  proyectos = signal<any[]>([]);
  proyectoActivoId = signal<number | null>(null);
  mostrandoNuevoProyecto = false;
  adminStats = signal<any>(null);

  // Filtered Tests
  filteredTests = computed(() => {
    const pId = this.proyectoActivoId();
    if (pId === null) return this.tests();
    return this.tests().filter(t => t.proyecto_id === pId);
  });

  seleccionarProyecto(id: number | null): void {
    this.proyectoActivoId.set(id);
  }

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
    this.testService.getProyectos().subscribe({
      next: (data) => this.proyectos.set(data),
      error: () => console.error('Error al cargar proyectos')
    });
    if (this.isAdmin) {
      this.testService.getAdminStats().subscribe({
        next: (data) => this.adminStats.set(data),
        error: () => console.error('Error al cargar stats')
      });
    }
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
        this.mostrarToast('Error al levantar el grabador. ¿Está el servidor activo?', 'error');
      }
    });
  }

  crearManual(): void {
    if (!this.nuevoTest.nombre || !this.nuevoTest.url) {
      this.mostrarToast('Completa el nombre y la URL.', 'error');
      return;
    }
    this.cargando = true;
    this.testService.createManualTest(this.nuevoTest).subscribe({
      next: () => {
        this.cargando = false;
        this.mostrandoGrabador = false;
        this.nuevoTest = { nombre: '', url: '' };
        this.cargar();
        this.mostrarToast('Test creado. Ya puedes editar su código.', 'success');
      },
      error: (err: any) => {
        this.cargando = false;
        this.mostrarToast('Error al crear el test manual', 'error');
      }
    });
  }

  ejecutarTest(testId: number): void {
    const slowMo = this.getSlowMo(testId);
    this.ejecutandoId.set(testId);
    this.testService.runTest(testId, slowMo).subscribe({
      next: (res) => {
        this.ejecutandoId.set(null);
        if (res.videoUrl) this.videoUrl.set(res.videoUrl);
        this.mostrarToast(`Ejecución ${res.status === 'PASSED' ? 'exitosa ✅' : 'fallida ❌'}`, res.status === 'PASSED' ? 'success' : 'error');
        this.cargar();
      },
      error: () => {
        this.ejecutandoId.set(null);
        this.mostrarToast('No se pudo ejecutar el robot.', 'error');
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
  cerrarVideo(): void { this.videoUrl.set(null); }
  ejecutarDesdeEditor(e: { testId: number; script: string }): void { this.ejecutarTest(e.testId); }

  // ── Toast ──
  mostrarToast(texto: string, tipo: 'success' | 'error'): void {
    this.toast.set({ texto, tipo });
    setTimeout(() => this.toast.set(null), 3500);
  }

  irAlAdmin(): void { this.router.navigate(['/admin']); }
  logout(): void { this.authService.logout(); this.router.navigate(['/login']); }

  get isAdmin(): boolean {
    return this.user()?.rol?.includes('ADMIN') ?? false;
  }
}