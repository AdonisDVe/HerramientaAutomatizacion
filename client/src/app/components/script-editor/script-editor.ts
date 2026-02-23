import { Component, Input, Output, EventEmitter, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TestService } from '../../services/test';

@Component({
    selector: 'app-script-editor',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './script-editor.html',
    styleUrl: './script-editor.scss'
})
export class ScriptEditorComponent implements OnInit {
    @Input() testId!: number;
    @Input() testNombre: string = '';
    @Output() cerrar = new EventEmitter<void>();
    @Output() ejecutar = new EventEmitter<{ testId: number; script: string }>();

    private testService = inject(TestService);

    scriptCodigo = signal<string>('');
    cargando = signal<boolean>(true);
    guardando = signal<boolean>(false);
    mensaje = signal<{ texto: string; tipo: 'success' | 'error' } | null>(null);

    ngOnInit(): void {
        this.testService.getScript(this.testId).subscribe({
            next: (data) => {
                this.scriptCodigo.set(data.script_codigo || '');
                this.cargando.set(false);
            },
            error: () => {
                this.mostrarMensaje('Error al cargar el script.', 'error');
                this.cargando.set(false);
            }
        });
    }

    guardarScript(): void {
        this.guardando.set(true);
        this.testService.updateScript(this.testId, this.scriptCodigo()).subscribe({
            next: () => {
                this.guardando.set(false);
                this.mostrarMensaje('Script guardado correctamente.', 'success');
            },
            error: () => {
                this.guardando.set(false);
                this.mostrarMensaje('Error al guardar el script.', 'error');
            }
        });
    }

    ejecutarConScript(): void {
        this.ejecutar.emit({ testId: this.testId, script: this.scriptCodigo() });
        this.cerrar.emit();
    }

    mostrarMensaje(texto: string, tipo: 'success' | 'error'): void {
        this.mensaje.set({ texto, tipo });
        setTimeout(() => this.mensaje.set(null), 3500);
    }
}
