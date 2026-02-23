require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const testRoutes = require('./routes/testRoutes');
const authRoutes = require('./routes/authRoutes');
const { startCleanupJob } = require('./utils/cleanupService');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS restrictivo: solo acepta el domino del frontend
const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:4200',
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// Exponemos la carpeta "evidencias" estáticamente para el tag <video> del frontend
app.use('/evidencias', express.static(path.join(__dirname, 'evidencias')));

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