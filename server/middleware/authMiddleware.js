require('dotenv').config();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

module.exports = (req, res, next) => {
    let token = null;

    const authHeader = req.headers['authorization'];
    if (authHeader) token = authHeader.split(' ')[1];

    if (!token && req.query.token) token = req.query.token;

    if (!token) {
        console.error('❌ Error: Petición sin Token');
        return res.status(401).json({ message: 'Token requerido' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        console.log(`✅ Usuario validado: ${decoded.nombre}`);
        next();
    } catch (err) {
        console.error('❌ Error: Token inválido');
        res.status(403).json({ message: 'Sesión inválida' });
    }
};