const db = require('../config/db');
const fs = require('fs');
const path = require('path');

const evidencePath = path.resolve(__dirname, '../evidencias');

// Función que limpia evidencias de más de X días
async function cleanOldEvidences(days = 7) {
    console.log(`🧹 [Auto-Cleanup] Iniciando limpieza de videos de más de ${days} días...`);
    try {
        // Obtenemos los videos viejos
        const [archivosViejos] = await db.query(`
            SELECT ea.id, ea.ruta_archivo 
            FROM evidencias_archivos ea
            INNER JOIN ejecuciones e ON e.id = ea.ejecucion_id
            WHERE e.iniciado_en < DATE_SUB(NOW(), INTERVAL ? DAY)
              AND ea.tipo_archivo = 'VIDEO'
        `, [days]);

        if (archivosViejos.length === 0) {
            console.log('✅ [Auto-Cleanup] Ningún archivo viejo para eliminar hoy.');
            return;
        }

        let eliminados = 0;
        let errores = 0;

        // Borramos los archivos físicos
        for (const archivo of archivosViejos) {
            const filePath = path.join(evidencePath, archivo.ruta_archivo);

            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }

                // Borramos el registro de evidencias_archivos.
                // IMPORTANTE: Esto NO borra la ejecución, por lo tanto tus métricas (total tests, exitosos, fallidos, % de éxito) quedan INTACTAS.
                // Simplemente el usuario dejará de ver el video para ejecuciones de hace más de una semana.
                await db.query('DELETE FROM evidencias_archivos WHERE id = ?', [archivo.id]);
                eliminados++;
            } catch (err) {
                console.error(`❌ [Auto-Cleanup] Error al borrar archivo ${archivo.ruta_archivo}:`, err.message);
                errores++;
            }
        }

        console.log(`✅ [Auto-Cleanup] Limpieza terminada: ${eliminados} borrados | ${errores} errores.`);
    } catch (error) {
        console.error('🔥 [Auto-Cleanup] Error crítico durante la limpieza:', error.message);
    }
}

function startCleanupJob() {
    // Ejecutamos la primera limpieza 1 minuto después de arrancar el servidor
    setTimeout(() => cleanOldEvidences(7), 60 * 1000);

    // Luego, se ejecuta cada 24 horas (24 * 60 * 60 * 1000 milisegundos)
    setInterval(() => cleanOldEvidences(7), 24 * 60 * 60 * 1000);
}

module.exports = { startCleanupJob, cleanOldEvidences };
