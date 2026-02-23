require('dotenv').config();
const db = require('../config/db');
const path = require('path');
const fs = require('fs');
const { recordScript, executeScript } = require('../automation/integrador');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
const evidencePath = path.resolve(__dirname, '../evidencias');

// ─────────────────────────────────────────────
// Mostrar los tests activos en el dashboard
// ─────────────────────────────────────────────
exports.getAllTests = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT t.*,
            (SELECT COUNT(*) FROM ejecuciones e WHERE e.test_id = t.id) as total_ejecuciones,
            (SELECT e2.resultado FROM ejecuciones e2 WHERE e2.test_id = t.id ORDER BY e2.iniciado_en DESC LIMIT 1) as ultimo_resultado,
            (SELECT e3.iniciado_en FROM ejecuciones e3 WHERE e3.test_id = t.id ORDER BY e3.iniciado_en DESC LIMIT 1) as ultima_ejecucion
            FROM tests t WHERE t.estado = 'ACTIVO' ORDER BY t.creado_en DESC
        `);
        console.log(`📋 Tests encontrados: ${rows.length}`);
        res.json(rows);
    } catch (error) {
        console.error('🔥 Error en getAllTests:', error.message);
        res.status(500).json({ error: error.message });
    }
};

// ─────────────────────────────────────────────
// Ver el script de un test específico
// ─────────────────────────────────────────────
exports.getTestScript = async (req, res) => {
    const { id } = req.params;
    try {
        const [tests] = await db.query('SELECT id, nombre, url_base, script_codigo FROM tests WHERE id = ? AND estado = "ACTIVO"', [id]);
        if (tests.length === 0) return res.status(404).json({ error: 'Test no encontrado' });
        res.json(tests[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ─────────────────────────────────────────────
// Actualizar el script de un test (editor)
// ─────────────────────────────────────────────
exports.updateTestScript = async (req, res) => {
    const { id } = req.params;
    const { script_codigo } = req.body;
    if (!script_codigo || script_codigo.trim() === '') {
        return res.status(400).json({ error: 'El script no puede estar vacío' });
    }
    try {
        const [result] = await db.query(
            'UPDATE tests SET script_codigo = ?, actualizado_en = NOW() WHERE id = ? AND estado = "ACTIVO"',
            [script_codigo, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Test no encontrado' });
        res.json({ message: 'Script actualizado correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ─────────────────────────────────────────────
// Renombrar un test
// ─────────────────────────────────────────────
exports.renameTest = async (req, res) => {
    const { id } = req.params;
    const { nombre } = req.body;
    if (!nombre || nombre.trim() === '') {
        return res.status(400).json({ error: 'El nombre no puede estar vacío' });
    }
    try {
        const [result] = await db.query(
            'UPDATE tests SET nombre = ?, actualizado_en = NOW() WHERE id = ? AND estado = "ACTIVO"',
            [nombre.trim(), id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Test no encontrado' });
        res.json({ message: 'Test renombrado correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ─────────────────────────────────────────────
// Grabar Script con Playwright Codegen
// ─────────────────────────────────────────────
exports.recordAndSave = async (req, res) => {
    const { nombre, url } = req.body;
    const usuarioId = req.user.id;

    try {
        console.log(`🎬 Grabando script para: ${nombre}`);
        const result = await recordScript(url);

        if (result && result.success && result.script) {
            await db.query(
                'INSERT INTO tests (nombre, url_base, descripcion, script_codigo, creado_por, estado) VALUES (?, ?, ?, ?, ?, ?)',
                [nombre, url, `Grabado por ${req.user.nombre}`, result.script, usuarioId, 'ACTIVO']
            );
            console.log('✅ Script guardado en la base de datos.');
            res.json({ message: 'Script guardado correctamente' });
        } else {
            res.status(400).json({ error: 'No se generó código. Asegúrate de interactuar con la página.' });
        }
    } catch (error) {
        console.error('🔥 Error fatal al grabar:', error.message);
        res.status(500).json({ error: error.message });
    }
};

// ─────────────────────────────────────────────
// Crear Script Manualmente (Sin Grabador)
// ─────────────────────────────────────────────
exports.createManualTest = async (req, res) => {
    const { nombre, url } = req.body;
    const usuarioId = req.user.id;

    if (!nombre || !url) return res.status(400).json({ error: 'Nombre y URL requeridos' });

    try {
        const scriptBase = `const { test, expect } = require('@playwright/test');\n\ntest('${nombre}', async ({ page }) => {\n  await page.goto('${url}');\n  // Pega el código que grabaste localmente aquí 👇\n});`;

        await db.query(
            'INSERT INTO tests (nombre, url_base, descripcion, script_codigo, creado_por, estado) VALUES (?, ?, ?, ?, ?, ?)',
            [nombre, url, `Creado manualmente por ${req.user.nombre}`, scriptBase, usuarioId, 'ACTIVO']
        );
        res.json({ message: 'Test manual creado correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ─────────────────────────────────────────────
// Ejecutar Robot de forma Autónoma
// ─────────────────────────────────────────────
exports.executeTest = async (req, res) => {
    const { testId } = req.params;
    const usuarioId = req.user.id;
    const slowMo = parseInt(req.body?.slowMo ?? 0, 10);
    const inicioMs = Date.now();

    try {
        const [tests] = await db.query('SELECT * FROM tests WHERE id = ? AND estado = "ACTIVO"', [testId]);
        if (tests.length === 0) return res.status(404).json({ error: 'Test no encontrado' });

        const scriptContent = tests[0].script_codigo;
        const modo = slowMo > 0 ? `🐢 Modo Lento (${slowMo}ms)` : '⚡ Modo Normal';
        console.log(`▶️  Iniciando ejecución — Test #${testId} | ${modo}`);

        const [ejecucion] = await db.query(
            'INSERT INTO ejecuciones (test_id, ejecutado_por, resultado) VALUES (?, ?, ?)',
            [testId, usuarioId, 'RUNNING']
        );
        const ejecucionId = ejecucion.insertId;

        try {
            const result = await executeScript(scriptContent, testId, slowMo);
            const duracionTotal = Date.now() - inicioMs;

            await db.query(
                'UPDATE ejecuciones SET resultado = ?, duracion_ms = ?, finalizado_en = NOW() WHERE id = ?',
                ['PASSED', duracionTotal, ejecucionId]
            );

            await db.query(
                'INSERT INTO evidencias_archivos (ejecucion_id, tipo_archivo, ruta_archivo) VALUES (?, ?, ?)',
                [ejecucionId, 'VIDEO', result.video]
            );

            res.json({
                message: 'Ejecución terminada',
                status: 'PASSED',
                videoUrl: `${SERVER_URL}/evidencias/${result.video}`
            });
        } catch (execError) {
            const duracionTotal = Date.now() - inicioMs;
            await db.query(
                'UPDATE ejecuciones SET resultado = ?, duracion_ms = ?, finalizado_en = NOW() WHERE id = ?',
                ['FAILED', duracionTotal, ejecucionId]
            );
            res.status(500).json({ error: 'El robot falló durante la ejecución.', status: 'FAILED' });
        }
    } catch (error) {
        console.error('🔥 Error en la ejecución:', error.message);
        res.status(500).json({ error: error.message });
    }
};

// ─────────────────────────────────────────────
// Historial de ejecuciones de un test
// ─────────────────────────────────────────────
exports.getExecutions = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await db.query(`
            SELECT 
                e.id, e.resultado, e.duracion_ms, e.iniciado_en, e.finalizado_en,
                u.nombre_completo as ejecutado_por_nombre,
                ea.ruta_archivo as video_archivo
            FROM ejecuciones e
            LEFT JOIN usuarios u ON u.id = e.ejecutado_por
            LEFT JOIN evidencias_archivos ea ON ea.ejecucion_id = e.id AND ea.tipo_archivo = 'VIDEO'
            WHERE e.test_id = ?
            ORDER BY e.iniciado_en DESC
            LIMIT 50
        `, [id]);

        // Agrega la URL completa del video
        const result = rows.map(r => ({
            ...r,
            videoUrl: r.video_archivo ? `${SERVER_URL}/evidencias/${r.video_archivo}` : null,
            videoFilename: r.video_archivo || null
        }));

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ─────────────────────────────────────────────
// Hard Delete: borra test, ejecuciones y videos
// ─────────────────────────────────────────────
exports.deleteTest = async (req, res) => {
    const { id } = req.params;
    try {
        // 1. Obtener todos los archivos de video vinculados a este test
        const [archivos] = await db.query(`
            SELECT ea.ruta_archivo 
            FROM evidencias_archivos ea
            INNER JOIN ejecuciones e ON e.id = ea.ejecucion_id
            WHERE e.test_id = ? AND ea.tipo_archivo = 'VIDEO'
        `, [id]);

        // 2. Borrar los archivos físicos del disco
        for (const archivo of archivos) {
            const filePath = path.join(evidencePath, archivo.ruta_archivo);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`🗑️ Video eliminado: ${archivo.ruta_archivo}`);
            }
        }

        // 3. Borrar registros de BD en orden (foreign keys)
        await db.query(`DELETE ea FROM evidencias_archivos ea INNER JOIN ejecuciones e ON e.id = ea.ejecucion_id WHERE e.test_id = ?`, [id]);
        await db.query('DELETE FROM ejecuciones WHERE test_id = ?', [id]);
        await db.query('DELETE FROM tests WHERE id = ?', [id]);

        res.json({ message: 'Test y sus evidencias eliminados correctamente' });
    } catch (error) {
        console.error('🔥 Error al eliminar:', error.message);
        res.status(500).json({ error: 'Error al eliminar el test' });
    }
};

// ─────────────────────────────────────────────
// Admin: Estadísticas globales (con filtros)
// ─────────────────────────────────────────────
exports.getAdminStats = async (req, res) => {
    if (!req.user.rol || !req.user.rol.includes('ADMIN')) {
        return res.status(403).json({ error: 'Acceso denegado. Solo para administradores.' });
    }
    try {
        // ── Parámetros de filtro ──────────────────────
        const usuarioId = req.query.usuarioId ? parseInt(req.query.usuarioId, 10) : null;
        const urlFiltro = req.query.urlFiltro ? req.query.urlFiltro.trim() : null;
        const diasFiltro = req.query.diasFiltro ? parseInt(req.query.diasFiltro, 10) : null;

        // Construir cláusulas WHERE dinámicas para ejecuciones
        const whereExec = [];
        const paramsExec = [];
        if (usuarioId) { whereExec.push('e.ejecutado_por = ?'); paramsExec.push(usuarioId); }
        if (urlFiltro) { whereExec.push('t.url_base LIKE ?'); paramsExec.push(`%${urlFiltro}%`); }
        if (diasFiltro) { whereExec.push('e.iniciado_en >= DATE_SUB(NOW(), INTERVAL ? DAY)'); paramsExec.push(diasFiltro); }

        const execJoin = urlFiltro ? 'INNER JOIN tests t ON t.id = e.test_id' : '';
        const execWhere = whereExec.length ? `WHERE ${whereExec.join(' AND ')}` : '';

        // ── KPIs ─────────────────────────────────────
        const [[{ total_tests }]] = await db.query(`SELECT COUNT(*) as total_tests FROM tests WHERE estado = 'ACTIVO'${urlFiltro ? ' AND url_base LIKE ?' : ''}`, urlFiltro ? [`%${urlFiltro}%`] : []);

        const [[{ total_ejecuciones }]] = await db.query(
            `SELECT COUNT(*) as total_ejecuciones FROM ejecuciones e ${execJoin} ${execWhere}`,
            paramsExec
        );
        const [[{ ejecuciones_exitosas }]] = await db.query(
            `SELECT COUNT(*) as ejecuciones_exitosas FROM ejecuciones e ${execJoin} ${execWhere ? execWhere + ' AND e.resultado = \'PASSED\'' : 'WHERE e.resultado = \'PASSED\''}`,
            paramsExec
        );
        const [[{ ejecuciones_fallidas }]] = await db.query(
            `SELECT COUNT(*) as ejecuciones_fallidas FROM ejecuciones e ${execJoin} ${execWhere ? execWhere + ' AND e.resultado = \'FAILED\'' : 'WHERE e.resultado = \'FAILED\''}`,
            paramsExec
        );

        // ── Actividad reciente (con filtros) ──────────
        const actividadParams = [...paramsExec];
        const actividadWhere = whereExec.length ? `WHERE ${whereExec.join(' AND ')}` : '';
        const [actividad_reciente] = await db.query(`
            SELECT
                e.id, e.resultado, e.duracion_ms, e.iniciado_en,
                t.nombre as test_nombre, t.url_base,
                u.nombre_completo as ejecutado_por_nombre
            FROM ejecuciones e
            INNER JOIN tests t ON t.id = e.test_id
            LEFT JOIN usuarios u ON u.id = e.ejecutado_por
            ${actividadWhere}
            ORDER BY e.iniciado_en DESC
            LIMIT 10
        `, actividadParams);

        // ── Gráfico: últimos 7 días (con filtros) ────
        const chartWhere = whereExec.length ? `AND ${whereExec.join(' AND ')}` : '';
        const chartParams = [...paramsExec];
        const [chart_data] = await db.query(`
            SELECT
                DATE(e.iniciado_en) as fecha,
                e.resultado,
                COUNT(*) as total
            FROM ejecuciones e
            ${urlFiltro || usuarioId ? 'INNER JOIN tests t ON t.id = e.test_id' : ''}
            WHERE e.iniciado_en >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
            ${chartWhere}
            GROUP BY DATE(e.iniciado_en), e.resultado
            ORDER BY fecha ASC
        `, chartParams);

        // ── Opciones de filtro (para los dropdowns) ──
        const [usuarios_activos] = await db.query(`
            SELECT DISTINCT u.id, u.nombre_completo as nombre
            FROM ejecuciones e
            INNER JOIN usuarios u ON u.id = e.ejecutado_por
            ORDER BY u.nombre_completo ASC
        `);
        const [urls_disponibles] = await db.query(`
            SELECT DISTINCT url_base FROM tests WHERE estado = 'ACTIVO' ORDER BY url_base ASC
        `);

        res.json({
            total_tests,
            total_ejecuciones,
            ejecuciones_exitosas,
            ejecuciones_fallidas,
            tasa_exito: total_ejecuciones > 0
                ? Math.round((ejecuciones_exitosas / total_ejecuciones) * 100)
                : 0,
            actividad_reciente,
            chart_data,
            filter_options: {
                usuarios: usuarios_activos,
                urls: urls_disponibles.map(r => r.url_base)
            }
        });
    } catch (error) {
        console.error('🔥 Error en getAdminStats:', error.message);
        res.status(500).json({ error: error.message });
    }
};

// ─────────────────────────────────────────────
// Admin: Lista de usuarios
// ─────────────────────────────────────────────
exports.getAdminUsuarios = async (req, res) => {
    if (!req.user.rol?.includes('ADMIN')) {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }
    try {
        const [usuarios] = await db.query(`
            SELECT id, nombre_completo, email, rol, creado_en
            FROM usuarios
            ORDER BY creado_en DESC
        `);
        res.json(usuarios);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ─────────────────────────────────────────────
// Admin: Cambiar rol de usuario
// ─────────────────────────────────────────────
exports.cambiarRolUsuario = async (req, res) => {
    if (!req.user.rol?.includes('ADMIN')) {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }
    const { id } = req.params;
    const { rol } = req.body;
    const ROLES_VALIDOS = ['QA_TESTER', 'QA_ADMIN'];

    if (!ROLES_VALIDOS.includes(rol)) {
        return res.status(400).json({ error: `Rol no válido. Debe ser uno de: ${ROLES_VALIDOS.join(', ')}` });
    }
    try {
        await db.query('UPDATE usuarios SET rol = ? WHERE id = ?', [rol, id]);
        const [[usuario]] = await db.query('SELECT id, nombre_completo, email, rol FROM usuarios WHERE id = ?', [id]);
        res.json({ success: true, usuario });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};