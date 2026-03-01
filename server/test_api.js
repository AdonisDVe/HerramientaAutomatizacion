const http = require('http');
const jwt = require('jsonwebtoken');

const token = jwt.sign({ id: 1, rol: 'QA_TESTER', nombre: 'Test' }, 'YOUR_SECRET', { algorithm: 'HS256' }); // I will use the actual DB to fetch a valid token or just hit the db. 
