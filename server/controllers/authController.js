require('dotenv').config();
const db = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET;

exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const [users] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);

        if (users.length === 0) return res.status(404).json({ message: 'Usuario no encontrado' });

        const user = users[0];

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ message: 'Contraseña incorrecta' });
        }

        const token = jwt.sign(
            { id: user.id, rol: user.rol, nombre: user.nombre_completo },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            token,
            user: { id: user.id, nombre: user.nombre_completo, rol: user.rol }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.register = async (req, res) => {
    const { nombre_completo, email, password, confirm_password } = req.body;
    try {
        if (!nombre_completo || !email || !password) {
            return res.status(400).json({ message: 'Todos los campos son requeridos.' });
        }
        if (password !== confirm_password) {
            return res.status(400).json({ message: 'Las contraseñas no coinciden.' });
        }
        if (password.length < 6) {
            return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres.' });
        }

        const [existing] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(409).json({ message: 'Ya existe una cuenta con ese email.' });
        }

        const hash = await bcrypt.hash(password, 12);
        const [result] = await db.query(
            'INSERT INTO usuarios (nombre_completo, email, password_hash, rol) VALUES (?, ?, ?, ?)',
            [nombre_completo.trim(), email.toLowerCase().trim(), hash, 'QA_TESTER']
        );

        const token = jwt.sign(
            { id: result.insertId, rol: 'QA_TESTER', nombre: nombre_completo.trim() },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.status(201).json({
            token,
            user: { id: result.insertId, nombre: nombre_completo.trim(), rol: 'QA_TESTER' }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};