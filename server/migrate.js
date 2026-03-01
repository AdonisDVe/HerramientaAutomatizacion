const db = require('./config/db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        const sql = fs.readFileSync(path.join(__dirname, 'config', 'migration_v2.sql'), 'utf-8');
        const statements = sql.split(';').filter(stmt => stmt.trim() !== '');

        for (const stmt of statements) {
            console.log('Ejecutando:', stmt.substring(0, 50) + '...');
            await db.query(stmt);
        }

        console.log('✅ Migración completada correctamente.');
    } catch (error) {
        console.error('❌ Error en migración:', error.message);
    } finally {
        process.exit();
    }
}

runMigration();
