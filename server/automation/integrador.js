const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const util = require('util');
const execPromise = util.promisify(exec);
const { EventEmitter } = require('events');

const liveLogsEmitter = new EventEmitter();
liveLogsEmitter.setMaxListeners(100);

const tempPath = path.resolve(__dirname, '../temp');
const evidencePath = path.resolve(__dirname, '../evidencias');
const storagePath = path.resolve(__dirname, '../storage');

if (!fs.existsSync(tempPath)) fs.mkdirSync(tempPath, { recursive: true });
if (!fs.existsSync(evidencePath)) fs.mkdirSync(evidencePath, { recursive: true });
if (!fs.existsSync(storagePath)) fs.mkdirSync(storagePath, { recursive: true });

// ─────────────────────────────────────────────────────────────────────────────
// Espera activa hasta que el archivo de video deje de crecer en disco.
// Playwright escribe el .webm de forma asíncrona después de browser.close(),
// por lo que un setTimeout fijo no es suficiente en pruebas exitosas largas.
// ─────────────────────────────────────────────────────────────────────────────
async function waitForVideoReady(videoDir, { maxWaitMs = 15000, pollMs = 300, stableMs = 600 } = {}) {
    const deadline = Date.now() + maxWaitMs;
    let lastSize = -1;
    let stableSince = null;

    while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, pollMs));

        if (!fs.existsSync(videoDir)) continue;

        const videos = fs.readdirSync(videoDir).filter(f => f.endsWith('.webm'));
        if (videos.length === 0) continue;

        const filePath = path.join(videoDir, videos[0]);
        let currentSize = 0;
        try {
            currentSize = fs.statSync(filePath).size;
        } catch (_) { continue; }

        if (currentSize > 0 && currentSize === lastSize) {
            if (!stableSince) {
                stableSince = Date.now();
            } else if (Date.now() - stableSince >= stableMs) {
                console.log(`✅ Video listo (${currentSize} bytes, estable por ${stableMs}ms)`);
                return videos[0];
            }
        } else {
            stableSince = null;
        }
        lastSize = currentSize;
    }

    // Timeout: devolvemos lo que haya aunque no esté estable
    if (fs.existsSync(videoDir)) {
        const videos = fs.readdirSync(videoDir).filter(f => f.endsWith('.webm'));
        if (videos.length > 0) {
            console.warn(`⚠️  waitForVideoReady: timeout alcanzado, usando video disponible`);
            return videos[0];
        }
    }
    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. MODO GRABACIÓN
// ─────────────────────────────────────────────────────────────────────────────
async function recordScript(url) {
    console.log(`🌐 Levantando Playwright Codegen para: ${url}`);
    const tempFile = path.join(tempPath, `script_${Date.now()}.js`);
    const playwrightBin = path.resolve(__dirname, '../node_modules/.bin/playwright');
    const env = { ...process.env };

    try {
        await execPromise(
            `"${playwrightBin}" codegen --target javascript "${url}" -o "${tempFile}"`,
            { env, timeout: 300000 }
        );

        let scriptContent = '';
        if (fs.existsSync(tempFile)) {
            scriptContent = fs.readFileSync(tempFile, 'utf8');
            fs.unlinkSync(tempFile);
        }

        if (!scriptContent.trim()) {
            throw new Error('No se generó código. Asegúrate de interactuar con la página antes de cerrar el navegador.');
        }

        return { success: true, script: scriptContent };
    } catch (error) {
        console.error('❌ Error en Codegen:', error.message);
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        throw error;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. MODO EJECUCIÓN
//    Siempre guarda video y capturas, incluso si la prueba falla.
// ─────────────────────────────────────────────────────────────────────────────
async function executeScript(scriptContent, testId, slowMo = 0, contextOpts = {}) {
    const timestamp = Date.now();
    const ejecucionId = contextOpts.ejecucionId || timestamp;
    const projName = (contextOpts.proyectoNombre || 'Default').replace(/[^a-zA-Z0-9_]/g, '_');
    const userName = contextOpts.usuarioNombre || 'Sistema';

    console.log(`🤖 Ejecutando script para Test ID: ${testId} | slowMo: ${slowMo}ms`);

    const tempFile = path.join(tempPath, `run_${testId}_${timestamp}.js`);
    const runDir = path.join(storagePath, projName, `exec_${ejecucionId}`);

    try {
        fs.mkdirSync(runDir, { recursive: true });
    } catch (err) {
        console.error('❌ Error creando carpeta storage:', err.message);
        if (ejecucionId) liveLogsEmitter.emit('log', { ejecucionId, type: 'stderr', chunk: `Error Storage: ${err.message}` });
    }

    const capturasDir = path.join(runDir, "capturas");
    const videoDir = runDir; // Video and trace en raiz de ejecución
    fs.mkdirSync(capturasDir, { recursive: true });

    const runDirClean = runDir.replace(/\\/g, '/');
    const capturasDirClean = capturasDir.replace(/\\/g, '/');

    try {
        let modified = scriptContent;

        // 1. headless + slowMo explícito
        const browserArgs = slowMo > 0 ? `{ headless: true, slowMo: ${slowMo}, args: ['--no-sandbox', '--disable-dev-shm-usage'] }` : `{ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] }`;
        modified = modified
            .replace(/headless:\s*(false|true)/gi, 'headless: true') // Force explicit properties first
            .replace(/chromium\.launch\(\{[\s\S]*?\}\)/g, `chromium.launch(${browserArgs})`)
            .replace(/chromium\.launch\(\)/g, `chromium.launch(${browserArgs})`);

        // 3. Grabación de video y context (Traces)
        modified = modified
            .replace(/browser\.newContext\(\)/g,
                `browser.newContext({ recordVideo: { dir: '${runDirClean}', size: { width: 1280, height: 720 } } })`)
            .replace(/browser\.newContext\(\{/g,
                `browser.newContext({ recordVideo: { dir: '${runDirClean}', size: { width: 1280, height: 720 } },`);

        // Inyectar inicio y fin de Traza
        if (modified.includes('browser.newContext')) {
            modified = modified.replace(
                /(const context = await browser\.newContext.*?);/g,
                `$1\n  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });`
            );
            modified = modified.replace(
                /(await context\.close\(\);)/g,
                `await context.tracing.stop({ path: require('path').join('${runDirClean}', 'trace.zip') });\n  $1`
            );
        }

        // 4. Capturas y Logs después de cada acción de página
        let stepNum = 0;
        modified = modified.replace(
            /^(\s*)(await page\.(?!screenshot|waitFor|pause|close)[^\n]+;)\s*$/gm,
            (match, indent, action) => {
                stepNum++;
                const num = String(stepNum).padStart(3, '0');
                const logAction = action.replace(/'/g, "\\'").trim();
                return `${indent}console.log('➡️ Acción ${num}: ${logAction}');\n${indent}${action}\n${indent}try { await page.screenshot({ path: require('path').join('${capturasDirClean}', 'paso_${num}.png'), fullPage: false }); } catch(_) {}`;
            }
        );

        // 5. Inyección de Robustez: Try/Catch/Finally Global
        // Envolvemos el cuerpo de la función asíncrona principal
        // Buscamos (async () => { ... })(); y envolvemos el interior.
        if (modified.includes('(async () => {')) {
            modified = modified.replace(
                /(\(async\s*\(\)\s*=>\s*\{)/,
                `$1\n  let __sirio_err = null;\n  try {`
            );

            const closePattern = /await context\.close\(\);[\s\S]*?await browser\.close\(\);/;
            if (closePattern.test(modified)) {
                modified = modified.replace(
                    closePattern,
                    `} catch (__e) {\n    __sirio_err = __e;\n    console.error('❌ Error capturado en el script:', __e.message);\n    try {\n      if (typeof page !== 'undefined') {\n         await page.screenshot({ path: require('path').join('${capturasDirClean}', 'ZZZ_FAILURE.png'), fullPage: true });\n      }\n    } catch (err) {}\n  } finally {\n    try { if (typeof context !== 'undefined') await context.close(); } catch(e) {}\n    try { if (typeof browser !== 'undefined') await browser.close(); } catch(e) {}\n    console.log('🏁 Limpieza de Playwright completada');\n  }\n  if (__sirio_err) { process.exitCode = 1; process.exit(1); }\n  process.exit(0);`
                );
            } else {
                // Fallback: inyectar antes del final de la función IIFE
                modified = modified.replace(
                    /(\}\)\(\);?\s*$)/,
                    `} catch (__e) {\n    __sirio_err = __e;\n    try { if (typeof page !== 'undefined') await page.screenshot({ path: require('path').join('${capturasDirClean}', 'ZZZ_FAILURE.png'), fullPage: true }); } catch (_) {}\n  } finally {\n    try { if (typeof context !== 'undefined') await context.close(); } catch(e) {}\n    try { if (typeof browser !== 'undefined') await browser.close(); } catch(e) {}\n  }\n  if (__sirio_err) { process.exitCode = 1; process.exit(1); }\n  process.exit(0);\n$1`
                );
            }
        }

<<<<<<< HEAD
        // Ejecutamos el archivo y capturamos logs
        let scriptError = null;
        try {
            await execPromise(`node "${tempFile}"`);
        } catch (execErr) {
            console.error('⚠️ El script de QA falló durante la ejecución.');
            scriptError = execErr;
        }

        // Buscamos el video generado (incluso si falló, Playwright suele guardar hasta el punto de fallo)
        const files = fs.readdirSync(evidencePath)
            .filter(f => f.endsWith('.webm'))
            .map(f => ({ file: f, time: fs.statSync(path.join(evidencePath, f)).mtime.getTime() }))
            .sort((a, b) => b.time - a.time);
=======
        console.log(`📸 Inyectadas ${stepNum} capturas | 🎥 Video dir: ${videoDir}`);
        fs.writeFileSync(tempFile, modified);

        let executionError = null;
        let execStdout = '';
        let execStderr = '';
        const t0 = Date.now();
        try {
            await new Promise((resolve, reject) => {
                const { spawn } = require('child_process');
                const child = spawn('node', [tempFile]);
>>>>>>> 49bbeed10f2b35a6400112e42f33c0bb4a4fadc9

                const timeoutId = setTimeout(() => {
                    child.kill();
                    reject(new Error(`Timeout de 120000ms excedido`));
                }, 120000);

                child.stdout.on('data', (data) => {
                    const text = data.toString();
                    execStdout += text;
                    if (ejecucionId) {
                        liveLogsEmitter.emit('log', { ejecucionId, type: 'stdout', chunk: text });
                    }
                });

                child.stderr.on('data', (data) => {
                    const text = data.toString();
                    execStderr += text;
                    if (ejecucionId) {
                        liveLogsEmitter.emit('log', { ejecucionId, type: 'stderr', chunk: text });
                    }
                });

                child.on('close', (code) => {
                    clearTimeout(timeoutId);
                    if (code !== 0) {
                        const err = new Error(`El proceso de Node terminó con código ${code}`);
                        err.stdout = execStdout;
                        err.stderr = execStderr;
                        reject(err);
                    } else {
                        resolve();
                    }
                });

                child.on('error', (err) => {
                    clearTimeout(timeoutId);
                    reject(err);
                });
            });
            console.log(`⏱️  Script ejecutado en ${Date.now() - t0}ms`);
        } catch (execErr) {
            console.error(`❌ El proceso de Node falló (${Date.now() - t0}ms):`, execErr.message);
            executionError = execErr;
            if (executionError.stdout === undefined) executionError.stdout = execStdout;
            if (executionError.stderr === undefined) executionError.stderr = execStderr;
        }

        const t1 = Date.now();
        console.log(`⏳ Esperando que el video quede listo en disco...`);
        const videoFile = await waitForVideoReady(runDir, {
            maxWaitMs: 15000,
            pollMs: 300,
            stableMs: 600
        });

        const videoRelativePath = videoFile ? `${projName}/exec_${ejecucionId}/${videoFile}` : null;

        const capturas = fs.existsSync(capturasDir)
            ? fs.readdirSync(capturasDir)
                .filter(f => f.endsWith('.png'))
                .sort()
                .map(f => `${projName}/exec_${ejecucionId}/capturas/${f}`)
            : [];

        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);

<<<<<<< HEAD
        if (scriptError) {
            return {
                success: false,
                video: videoFileName,
                log: scriptError.stdout + '\n' + scriptError.stderr
            };
        }

        return { success: true, video: videoFileName };
    } catch (error) {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        console.error('❌ Error fatal en inicialización del Script:', error.message);
=======
        // Registro Historial Demo-Ready
        try {
            const histLog = {
                usuario: userName,
                proyecto: projName,
                fecha: new Date().toISOString(),
                estado: executionError ? 'FALLIDO' : 'EXITO',
                ruta: runDirClean
            };
            fs.appendFileSync(path.join(storagePath, 'historial.json'), JSON.stringify(histLog) + '\\n');
        } catch (e) { }

        if (executionError) {
            executionError.evidence = { video: videoRelativePath, capturas };
            throw executionError;
        }

        return { success: true, video: videoRelativePath, capturas };

    } catch (error) {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
>>>>>>> 49bbeed10f2b35a6400112e42f33c0bb4a4fadc9
        throw error;
    }
}

module.exports = { recordScript, executeScript, liveLogsEmitter };