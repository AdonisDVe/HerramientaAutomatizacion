const express = require('express');
const router = express.Router();
const testController = require('../controllers/testController');
const authMiddleware = require('../middleware/authMiddleware');

// — Admin Stats & User Management (debe ir ANTES de las rutas con :id) —
router.get('/admin/stats', authMiddleware, testController.getAdminStats);
router.get('/admin/usuarios', authMiddleware, testController.getAdminUsuarios);
router.patch('/admin/usuarios/:id/rol', authMiddleware, testController.cambiarRolUsuario);

// — Tests —
router.get('/', authMiddleware, testController.getAllTests);
router.post('/record', authMiddleware, testController.recordAndSave);
router.post('/manual', authMiddleware, testController.createManualTest);
router.post('/:testId/run', authMiddleware, testController.executeTest);
router.delete('/:id', authMiddleware, testController.deleteTest);

// — Proyectos / Carpetas —
router.get('/proyectos', authMiddleware, testController.getAllProyectos);
router.post('/proyectos', authMiddleware, testController.createProyecto);
router.patch('/:id/proyecto', authMiddleware, testController.assignProyecto);

// — Script Editor —
router.get('/:id/script', authMiddleware, testController.getTestScript);
router.patch('/:id/script', authMiddleware, testController.updateTestScript);

// — Renombrar test —
router.patch('/:id/rename', authMiddleware, testController.renameTest);

// — Historial de ejecuciones y Logs —
router.get('/:id/executions', authMiddleware, testController.getExecutions);
router.get('/logs/:ejecucionId', authMiddleware, testController.getExecutionLogs);

module.exports = router;