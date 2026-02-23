require('dotenv').config();
const mysql = require('mysql2');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'novum_qa_platform',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Convertimos a promesas para usar async/await
module.exports = pool.promise();