import { Component, Input, Output, EventEmitter, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TestService } from '../../services/test';

@Component({
    selector: 'app-execution-history',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './execution-history.html',
    styleUrl: './execution-history.scss'
})
export class ExecutionHistoryComponent implements OnInit {
    @Input() testId!: number;
    @Input() testNombre: string = '';
    @Output() cerrar = new EventEmitter<void>();

    private testService = inject(TestService);

    ejecuciones = signal<any[]>([]);
    cargando = signal<boolean>(true);
    videoSeleccionado = signal<string | null>(null);

    ngOnInit(): void {
        this.testService.getExecutions(this.testId).subscribe({
            next: (data) => {
                this.ejecuciones.set(data);
                this.cargando.set(false);
            },
            error: () => {
                this.cargando.set(false);
            }
        });
    }

    verVideo(url: string): void {
        this.videoSeleccionado.set(url);
    }

    cerrarVideo(): void {
        this.videoSeleccionado.set(null);
    }

    descargarVideo(url: string, filename: string): void {
        const a = document.createElement('a');
        a.href = url + '?download=true';
        a.download = filename;
        a.click();
    }

    formatDuracion(ms: number | null): string {
        if (!ms) return '—';
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    }
}
