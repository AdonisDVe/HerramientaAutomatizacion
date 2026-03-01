require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const testRoutes = require('./routes/testRoutes');
const authRoutes = require('./routes/authRoutes');
const { startCleanupJob } = require('./utils/cleanupService');

const app = express();
const PORT = process.env.PORT || 3001;

// ─────────────────────────────────────────────
// Archivos Estáticos (Debe ir ANTES del CORS global)
// ─────────────────────────────────────────────

// Novedad SaaS: Exponemos 'storage' bajo '/ver-reportes' para el Trace Viewer
app.use('/ver-reportes', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
    res.header('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Encoding, Content-Length, Content-Range');
    res.header('Access-Control-Allow-Private-Network', 'true'); // IMPORTANTE para local/VPS -> trace.playwright.dev
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
}, express.static(path.join(__dirname, 'storage')));

// Exponemos la carpeta "evidencias" (Legacy)
app.use('/evidencias', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
}, express.static(path.join(__dirname, 'evidencias')));

// ─────────────────────────────────────────────
// Middleware Globales
// ─────────────────────────────────────────────

// CORS restrictivo: solo acepta el domino del frontend
const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:4200',
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// Log global para ver qué llega al servidor
app.use((req, res, next) => {
    console.log(`📡 [${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
});

app.use('/api/tests', testRoutes);
app.use('/api/auth', authRoutes);

app.listen(PORT, () => {
    console.log(`🚀 Servidor SirioQA activo en http://localhost:${PORT}`);
    startCleanupJob(); // Inicia el cron job de limpieza
});