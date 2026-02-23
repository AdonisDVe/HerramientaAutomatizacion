const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const util = require('util');
const execPromise = util.promisify(exec);

const tempPath = path.resolve(__dirname, '../temp');
const evidencePath = path.resolve(__dirname, '../evidencias');

if (!fs.existsSync(tempPath)) fs.mkdirSync(tempPath, { recursive: true });
if (!fs.existsSync(evidencePath)) fs.mkdirSync(evidencePath, { recursive: true });

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
async function executeScript(scriptContent, testId, slowMo = 0) {
    const timestamp = Date.now();
    console.log(`🤖 Ejecutando script para Test ID: ${testId} | slowMo: ${slowMo}ms`);

    const tempFile = path.join(tempPath, `run_${testId}_${timestamp}.js`);
    const capturasDirName = `capturas_${testId}_${timestamp}`;
    const videoDirName = `video_${testId}_${timestamp}`;

    const capturasDir = path.join(evidencePath, capturasDirName);
    const videoDir = path.join(evidencePath, videoDirName);

    fs.mkdirSync(capturasDir, { recursive: true });
    fs.mkdirSync(videoDir, { recursive: true });

    const videoDirClean = videoDir.replace(/\\/g, '/');
    const capturasDirClean = capturasDir.replace(/\\/g, '/');

    try {
        let modified = scriptContent;

        // 1. headless + slowMo
        if (slowMo > 0) {
            modified = modified.replace(/headless:\s*(true|false)/g, `headless: false, slowMo: ${slowMo}`);
        } else {
            modified = modified.replace(/headless:\s*(true|false)/g, 'headless: true');
        }
        if (!/headless:/.test(modified)) {
            const headlessVal = slowMo > 0 ? `false, slowMo: ${slowMo}` : 'true';
            modified = modified
                .replace(/chromium\.launch\(\{/, `chromium.launch({ headless: ${headlessVal},`)
                .replace(/chromium\.launch\(\)/, `chromium.launch({ headless: ${headlessVal} })`);
        }

        // 2. Flags de memoria
        modified = modified.replace(
            /chromium\.launch\(\{/g,
            `chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'],`
        );

        // 3. Grabación de video (A una carpeta específica para este test)
        modified = modified
            .replace(/browser\.newContext\(\)/g,
                `browser.newContext({ recordVideo: { dir: '${videoDirClean}', size: { width: 1280, height: 720 } } })`)
            .replace(/browser\.newContext\(\{/g,
                `browser.newContext({ recordVideo: { dir: '${videoDirClean}', size: { width: 1280, height: 720 } },`);

        // 4. Capturas después de cada acción de página (mejorado el regex)
        let stepNum = 0;
        modified = modified.replace(
            /^(\s*)(await page\.(?!screenshot|waitFor|pause|close)[^\n]+;)\s*$/gm,
            (match, indent, action) => {
                stepNum++;
                const num = String(stepNum).padStart(3, '0');
                return `${indent}${action}\n${indent}try { await page.screenshot({ path: require('path').join('${capturasDirClean}', 'paso_${num}.png'), fullPage: false }); } catch(_) {}`;
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

        console.log(`📸 Inyectadas ${stepNum} capturas | 🎥 Video dir: ${videoDir}`);
        fs.writeFileSync(tempFile, modified);

        let executionError = null;
        const t0 = Date.now();
        try {
            await execPromise(`node "${tempFile}"`, { timeout: 120000 });
            console.log(`⏱️  Script ejecutado en ${Date.now() - t0}ms`);
        } catch (execErr) {
            console.error(`❌ El proceso de Node falló (${Date.now() - t0}ms):`, execErr.message);
            executionError = execErr;
        }

        // Esperar a que Playwright termine de escribir el video en disco.
        // En ejecuciones exitosas el video se codifica de forma asíncrona tras
        // browser.close(), por lo que usamos espera activa en lugar de un
        // setTimeout fijo que resultaba insuficiente para pruebas largas.
        const t1 = Date.now();
        console.log(`⏳ Esperando que el video quede listo en disco...`);
        const videoFile = await waitForVideoReady(videoDir, {
            maxWaitMs: 15000,   // espera máxima de 15 s
            pollMs: 300,        // revisa cada 300 ms
            stableMs: 600       // considera listo cuando el tamaño no cambia por 600 ms
        });
        console.log(`⏱️  Video listo en ${Date.now() - t1}ms`);

        // Mover el video de la subcarpeta a la carpeta principal de evidencias
        let videoFileName = null;
        if (videoFile) {
            const originalPath = path.join(videoDir, videoFile);
            videoFileName = `${videoDirName}.webm`;
            const newPath = path.join(evidencePath, videoFileName);
            fs.copyFileSync(originalPath, newPath);
            // Limpiar subcarpeta de video
            try { fs.rmSync(videoDir, { recursive: true, force: true }); } catch (e) { }
        }

        // Listar capturas
        const capturas = fs.existsSync(capturasDir)
            ? fs.readdirSync(capturasDir)
                .filter(f => f.endsWith('.png'))
                .sort()
                .map(f => `${capturasDirName}/${f}`)
            : [];

        console.log(`🎥 Video final: ${videoFileName || 'ninguno'} | 📸 Capturas: ${capturas.length}`);

        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);

        if (executionError) {
            executionError.evidence = { video: videoFileName, capturas };
            throw executionError;
        }

        return { success: true, video: videoFileName, capturas, capturasDirName };

    } catch (error) {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        throw error;
    }
}

module.exports = { recordScript, executeScript };