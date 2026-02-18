const express = require('express');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 8080;

app.use(express.json());
app.use(express.static(__dirname)); // Sirve novum.png

const SIRIO_URL = 'http://sirio-dev-frontend-alb-894180136.us-east-1.elb.amazonaws.com/user/login';

const UI = `
<!DOCTYPE html>
<html lang="es" data-bs-theme="dark">
<head>
    <meta charset="UTF-8">
    <title>Novum - Sirio QA Automatizacion</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
    <style>
        :root { --primary-color: #0d6efd; }
        body { background-color: var(--bs-body-bg); font-family: 'Inter', sans-serif; transition: 0.3s; }
        .logo-glow { height: 45px; margin-right: 15px; filter: drop-shadow(0 0 8px rgba(13, 110, 253, 0.8)); }
        .navbar { background: rgba(0,0,0,0.3); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255,255,255,0.1); }
        .card { border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 8px 32px rgba(0,0,0,0.4); background: rgba(255,255,255,0.02); }
        .terminal { background: #000; color: #39ff14; height: 280px; overflow-y: auto; font-family: 'Fira Code', monospace; padding: 15px; border-radius: 12px; font-size: 12px; border: 1px solid #333; }
        .editor-area { width: 100%; height: 480px; background: #0d1117; color: #c9d1d9; padding: 20px; border-radius: 12px; border: none; font-family: 'Consolas', monospace; resize: none; }
        .test-item { background: rgba(255,255,255,0.03); padding: 10px 15px; border-radius: 10px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,255,255,0.05); }
        .test-item:hover { border-color: var(--primary-color); background: rgba(13, 110, 253, 0.05); }
        .btn-main { border-radius: 10px; font-weight: bold; transition: 0.2s; }
    </style>
</head>
<body>
    <nav class="navbar p-3 mb-4 sticky-top">
        <div class="container-fluid">
            <div class="d-flex align-items-center">
                <img src="/novum.png" class="logo-glow" onerror="this.src='https://via.placeholder.com/40?text=Novum'">
                <span class="fs-4 fw-bold">Sirio <span class="text-primary">QA Platform</span></span>
            </div>
            <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="themeSwitch" checked>
                <label class="form-check-label"><i class="bi bi-moon-stars-fill"></i></label>
            </div>
        </div>
    </nav>

    <div class="container-fluid px-4">
        <div class="row g-4">
            <div class="col-lg-4">
                <div class="card p-4 mb-4">
                    <h6 class="fw-bold mb-3 text-muted small text-uppercase">Listado de Pruebas</h6>
                    <div id="fileList" style="max-height: 350px; overflow-y: auto; margin-bottom: 20px;"></div>
                    
                    <div class="mb-3">
                        <label class="small fw-bold text-muted mb-1">VELOCIDAD DEL ROBOT:</label>
                        <select id="velocidadSelector" class="form-select form-select-sm bg-dark text-white border-secondary">
                            <option value="0">🚀 Rápido</option>
                            <option value="500" selected>🚶 Normal</option>
                            <option value="1500">🐢 Lento</option>
                        </select>
                    </div>

                    <div class="d-grid gap-2">
                        <button onclick="runSelected()" class="btn btn-success btn-main p-3"><i class="bi bi-play-circle-fill"></i> Ejecutar Prueba Seleccionada</button>
                        <div class="row g-2">
                            <div class="col-6"><button onclick="runAction('/grabar')" class="btn btn-danger btn-main w-100"><i class="bi bi-record-circle"></i> Grabar Prueba</button></div>
                            <div class="col-6"><button onclick="runAction('/reporte')" class="btn btn-primary btn-main w-100"><i class="bi bi-file-earmark-bar-graph"></i> Reportes de Pruebas</button></div>
                        </div>
                        <button onclick="limpiarTodo()" class="btn btn-sm btn-outline-secondary mt-2 border-0">Limpiar Historial</button>
                    </div>
                </div>
                <div class="card p-3">
                    <div id="terminal" class="terminal">Listo para operar...</div>
                </div>
            </div>

            <div class="col-lg-8">
                <div class="card p-4">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h5 class="fw-bold m-0 text-truncate">Archivo: <span id="editingFileName" class="text-primary small">---</span></h5>
                        <div class="d-flex gap-2">
                            <button class="btn btn-sm btn-outline-info" onclick="renameCurrentTest()"><i class="bi bi-pencil"></i> Renombrar</button>
                            <input type="text" id="valorExtra" class="form-control form-control-sm" style="width: 130px; background: rgba(255,255,255,0.05);" placeholder="Dato Dinámico">
                            <button class="btn btn-sm btn-primary px-4 fw-bold" onclick="saveTest()">GUARDAR</button>
                        </div>
                    </div>
                    <textarea id="codeEditor" class="editor-area" spellcheck="false" placeholder="Selecciona un test de la lista, recuerda que la IA puede ayudarte a mejorar el codigo"></textarea>
                </div>
            </div>
        </div>
    </div>

    <script>
        const themeSwitch = document.getElementById('themeSwitch');
        themeSwitch.onchange = () => document.documentElement.setAttribute('data-bs-theme', themeSwitch.checked ? 'dark' : 'light');

        function loadFileList() {
            fetch('/list-tests').then(r => r.json()).then(files => {
                const container = document.getElementById('fileList');
                container.innerHTML = '';
                files.forEach(f => {
                    const div = document.createElement('div');
                    div.className = 'test-item';
                    div.innerHTML = '<div><input type="checkbox" class="form-check-input me-3 test-checkbox" value="' + f + '"><a href="#" onclick="loadTest(\\'' + f + '\\')" class="text-decoration-none text-reset fw-bold small">' + f + '</a></div><div class="d-flex gap-2"><button onclick="duplicateTest(\\'' + f + '\\')" class="btn btn-link text-info p-0" title="Duplicar"><i class="bi bi-copy"></i></button><button onclick="deleteTest(\\'' + f + '\\')" class="btn btn-link text-danger p-0" title="Borrar"><i class="bi bi-trash3-fill"></i></button></div>';
                    container.appendChild(div);
                });
            });
        }

        function loadTest(file) {
            document.getElementById('editingFileName').innerText = file;
            fetch('/get-test?file=' + file).then(r => r.text()).then(code => document.getElementById('codeEditor').value = code);
        }

        function renameCurrentTest() {
            const oldName = document.getElementById('editingFileName').innerText;
            if(oldName === '---') return;
            let newName = prompt('Nuevo nombre (sin .spec.js):', oldName.replace('.spec.js', ''));
            if(newName) {
                if(!newName.endsWith('.spec.js')) newName += '.spec.js';
                fetch('/rename-test', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ oldName, newName }) }).then(loadFileList);
            }
        }

        function duplicateTest(file) {
            let newName = prompt('Nombre para la copia:', file.replace('.spec.js', '') + '_copia');
            if(newName) {
                if(!newName.endsWith('.spec.js')) newName += '.spec.js';
                fetch('/duplicate-test', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ originalName: file, newName }) }).then(loadFileList);
            }
        }

        function saveTest() {
            const file = document.getElementById('editingFileName').innerText;
            if(file === '---') return;
            fetch('/save-test', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ file, code: document.getElementById('codeEditor').value }) }).then(() => alert('Guardado'));
        }

        function deleteTest(file) {
            if(confirm('¿Borrar prueba?')) fetch('/delete-test?file=' + file, { method: 'DELETE' }).then(loadFileList);
        }

        function runSelected() {
            const files = Array.from(document.querySelectorAll('.test-checkbox:checked')).map(cb => cb.value);
            if(!files.length) return alert('Selecciona al menos una prueba');
            const vel = document.getElementById('velocidadSelector').value;
            runAction('/ejecutar', { files, dato: document.getElementById('valorExtra').value, velocidad: vel });
        }

        function limpiarTodo() {
            if(confirm('¿Limpiar reportes?')) fetch('/limpiar-reportes', { method: 'POST' });
        }

        function runAction(endpoint, body = {}) {
            fetch(endpoint, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) });
        }

        new EventSource('/events').onmessage = (e) => {
            const t = document.getElementById('terminal');
            t.innerHTML += '<div>' + e.data + '</div>';
            t.scrollTop = t.scrollHeight;
        };
        
        loadFileList();
        setInterval(loadFileList, 5000);
    </script>
</body>
</html>
`;

app.get('/', (req, res) => res.send(UI));

app.get('/list-tests', (req, res) => res.json(fs.readdirSync('./tests').filter(f => f.endsWith('.spec.js'))));
app.get('/get-test', (req, res) => res.send(fs.readFileSync(path.join('./tests', req.query.file), 'utf8')));
app.post('/save-test', (req, res) => { fs.writeFileSync(path.join('./tests', req.body.file), req.body.code); res.sendStatus(200); });
app.delete('/delete-test', (req, res) => { fs.unlinkSync(path.join('./tests', req.query.file)); res.sendStatus(200); });
app.post('/rename-test', (req, res) => { fs.renameSync(path.join('./tests', req.body.oldName), path.join('./tests', req.body.newName)); res.sendStatus(200); });
app.post('/duplicate-test', (req, res) => { fs.copyFileSync(path.join('./tests', req.body.originalName), path.join('./tests', req.body.newName)); res.sendStatus(200); });
app.post('/limpiar-reportes', (req, res) => {
    ['./playwright-report', './test-results'].forEach(d => { if(fs.existsSync(d)) fs.rmSync(d, {recursive:true, force:true}); });
    res.sendStatus(200);
});

let sseResponse = null;
app.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    sseResponse = res;
});

function log(data) { if (sseResponse) sseResponse.write('data: ' + data.toString() + '\n\n'); }

app.post('/grabar', (req, res) => {
    const name = 'test_' + Date.now() + '.spec.js';
    spawn('npx', ['playwright', 'codegen', '-o', 'tests/' + name, SIRIO_URL], { shell: true }).stdout.on('data', log);
    res.sendStatus(200);
});

app.post('/ejecutar', (req, res) => {
    const paths = (req.body.files || []).map(f => 'tests/' + f);
    const child = spawn('npx', ['playwright', 'test', ...paths], { 
        shell: true, 
        env: { ...process.env, CEDULA_DINAMICA: req.body.dato, VELOCIDAD_TEST: req.body.velocidad } 
    });
    child.stdout.on('data', log);
    child.stderr.on('data', log);
    res.sendStatus(200);
});

app.post('/reporte', (req, res) => {
    exec('npx kill-port 9323', () => { spawn('npx', ['playwright', 'show-report'], { shell: true }).stdout.on('data', log); });
    res.sendStatus(200);
});

app.listen(port, '0.0.0.0', () => console.log('>>> NOVUM QA PRO 7.0 ACTIVO EN http://127.0.0.1:8080 <<<'));