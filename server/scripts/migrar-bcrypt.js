/**
 * SirioQA — Migración de contraseñas a bcrypt
 * 
 * INSTRUCCIONES:
 * 1. Asegúrate de que el servidor tiene el .env configurado correctamente.
 * 2. Ejecuta este script UNA SOLA VEZ con: node scripts/migrar-bcrypt.js
 * 3. El script actualiza los usuarios cuyo password_hash NO empiece con '$2' 
 *    (es decir, los que aún están en texto plano).
 * 4. Una vez ejecutado exitosamente, puedes borrar este archivo.
 */

const path = require('path');
// __dirname = server/scripts/  →  un nivel arriba es server/  →  ahí está el .env
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

async function migrarContrasenas() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'novum_qa_platform'
    });

    console.log('🔌 Conectado a la base de datos...');

    const [usuarios] = await connection.query(
        "SELECT id, email, password_hash FROM usuarios WHERE password_hash NOT LIKE '$2%'"
    );

    if (usuarios.length === 0) {
        console.log('✅ Todos los usuarios ya tienen contraseñas hasheadas. Nada que hacer.');
        await connection.end();
        return;
    }

    console.log(`🔐 Migrando ${usuarios.length} usuario(s)...`);

    for (const usuario of usuarios) {
        const hashed = await bcrypt.hash(usuario.password_hash, 10);
        await connection.query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [hashed, usuario.id]);
        console.log(`  ✔ Usuario ${usuario.email} migrado.`);
    }

    await connection.end();
    console.log('🎉 Migración completada. Todos los usuarios ya usan bcrypt.');
}

migrarContrasenas().catch(err => {
    console.error('❌ Error durante la migración:', err.message);
    process.exit(1);
});
