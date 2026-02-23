import {
    Component, OnInit, AfterViewInit, OnDestroy,
    signal, inject, ViewChild, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TestService } from '../../services/test';
import { AuthService } from '../../services/auth';
import { Router } from '@angular/router';
import {
    Chart, BarController, BarElement, CategoryScale,
    LinearScale, Tooltip, Legend
} from 'chart.js';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

@Component({
    selector: 'app-admin-dashboard',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './admin-dashboard.html',
    styleUrl: './admin-dashboard.scss'
})
export class AdminDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

    private testService = inject(TestService);
    private authService = inject(AuthService);
    private router = inject(Router);

    user = this.authService.currentUser;
    stats = signal<any>(null);
    cargando = signal<boolean>(true);
    error = signal<string | null>(null);

    // Filtros activos
    filtroUsuarioId = signal<number | null>(null);
    filtroUrl = signal<string | null>(null);
    filtroDias = signal<number | null>(null);

    // Opciones para los dropdowns (se llenan la primera carga)
    opcionesUsuarios = signal<any[]>([]);
    opcionesUrls = signal<string[]>([]);

    private chart: Chart | null = null;

    usuarios = signal<any[]>([]);
    usuariosBusy = signal<Set<number>>(new Set());

    ngOnInit(): void {
        if (!this.user()?.rol?.includes('ADMIN')) {
            this.router.navigate(['/dashboard']);
            return;
        }
        this.cargarStats();
        this.cargarUsuarios();
    }

    ngAfterViewInit(): void { /* chart se inicia tras datos */ }

    cargarStats(): void {
        this.cargando.set(true);
        this.error.set(null);
        this.testService.getAdminStats({
            usuarioId: this.filtroUsuarioId(),
            urlFiltro: this.filtroUrl(),
            diasFiltro: this.filtroDias()
        }).subscribe({
            next: (data) => {
                this.stats.set(data);
                this.cargando.set(false);
                // Persistir opciones solo en la primera carga (sin filtros activos)
                if (data.filter_options) {
                    if (!this.filtroUsuarioId() && !this.filtroUrl() && !this.filtroDias()) {
                        this.opcionesUsuarios.set(data.filter_options.usuarios ?? []);
                        this.opcionesUrls.set(data.filter_options.urls ?? []);
                    }
                }
                setTimeout(() => this.buildChart(data.chart_data), 80);
            },
            error: (err) => {
                this.error.set(err?.error?.error || 'No se pudieron cargar las estadísticas.');
                this.cargando.set(false);
            }
        });
    }

    aplicarFiltros(): void { this.cargarStats(); }

    limpiarFiltros(): void {
        this.filtroUsuarioId.set(null);
        this.filtroUrl.set(null);
        this.filtroDias.set(null);
        this.cargarStats();
    }

    get hayFiltroActivo(): boolean {
        return !!this.filtroUsuarioId() || !!this.filtroUrl() || !!this.filtroDias();
    }

    // Extraer etiqueta legible del ambiente (dominio)
    etiquetaUrl(url: string): string {
        try {
            const host = new URL(url).hostname.replace('www.', '');
            return host.length > 30 ? host.slice(0, 30) + '…' : host;
        } catch { return url; }
    }

    buildChart(chartData: any[]): void {
        if (!this.chartCanvas) return;
        if (this.chart) { this.chart.destroy(); this.chart = null; }

        const days: string[] = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            days.push(d.toISOString().split('T')[0]);
        }

        const passedMap: Record<string, number> = {};
        const failedMap: Record<string, number> = {};
        chartData.forEach(row => {
            const fecha = new Date(row.fecha).toISOString().split('T')[0];
            if (row.resultado === 'PASSED') passedMap[fecha] = Number(row.total);
            if (row.resultado === 'FAILED') failedMap[fecha] = Number(row.total);
        });

        const passedData = days.map(d => passedMap[d] || 0);
        const failedData = days.map(d => failedMap[d] || 0);
        const labels = days.map(d =>
            new Date(d + 'T12:00:00').toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric', month: 'short' })
        );

        this.chart = new Chart(this.chartCanvas.nativeElement, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Exitosas (PASSED)', data: passedData, backgroundColor: 'rgba(16,185,129,0.75)', borderColor: '#10b981', borderWidth: 1, borderRadius: 6 },
                    { label: 'Fallidas (FAILED)', data: failedData, backgroundColor: 'rgba(239,68,68,0.7)', borderColor: '#ef4444', borderWidth: 1, borderRadius: 6 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { color: '#94a3b8', font: { size: 12 }, padding: 20 } },
                    tooltip: { backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1, titleColor: '#f8fafc', bodyColor: '#94a3b8' }
                },
                scales: {
                    x: { ticks: { color: '#64748b', font: { size: 11 } }, grid: { color: 'rgba(51,65,85,0.4)' } },
                    y: { ticks: { color: '#64748b', stepSize: 1 }, grid: { color: 'rgba(51,65,85,0.4)' }, beginAtZero: true }
                }
            }
        });
    }

    cargarUsuarios(): void {
        this.testService.getAdminUsuarios().subscribe({
            next: (data) => this.usuarios.set(data),
            error: () => { }
        });
    }

    cambiarRol(userId: number, rolActual: string): void {
        const nuevoRol = rolActual === 'QA_ADMIN' ? 'QA_TESTER' : 'QA_ADMIN';
        const s = new Set(this.usuariosBusy());
        s.add(userId);
        this.usuariosBusy.set(s);

        this.testService.cambiarRolUsuario(userId, nuevoRol).subscribe({
            next: (res) => {
                this.usuarios.update(list =>
                    list.map(u => u.id === userId ? { ...u, rol: res.usuario.rol } : u)
                );
                const ss = new Set(this.usuariosBusy());
                ss.delete(userId);
                this.usuariosBusy.set(ss);
            },
            error: () => {
                const ss = new Set(this.usuariosBusy());
                ss.delete(userId);
                this.usuariosBusy.set(ss);
            }
        });
    }

    ngOnDestroy(): void { if (this.chart) this.chart.destroy(); }

    irAlDashboard(): void { this.router.navigate(['/dashboard']); }
    logout(): void { this.authService.logout(); this.router.navigate(['/login']); }

    formatDuracion(ms: number | null): string {
        if (!ms) return '—';
        return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
    }
}
