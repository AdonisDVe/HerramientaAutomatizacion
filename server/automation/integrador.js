const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const util = require('util');
const execPromise = util.promisify(exec);

const tempPath = path.resolve(__dirname, '../temp');
const evidencePath = path.resolve(__dirname, '../evidencias');

// Crear carpetas si no existen
if (!fs.existsSync(tempPath)) fs.mkdirSync(tempPath, { recursive: true });
if (!fs.existsSync(evidencePath)) fs.mkdirSync(evidencePath, { recursive: true });

// 1. MODO GRABACIÓN: Extrae el código generado por el usuario
async function recordScript(url) {
    console.log(`🌐 Levantando Playwright Codegen para: ${url}`);
    const tempFile = path.join(tempPath, `script_${Date.now()}.js`);

    try {
        await execPromise(`npx playwright codegen --target javascript ${url} -o ${tempFile}`);

        let scriptContent = '';
        if (fs.existsSync(tempFile)) {
            scriptContent = fs.readFileSync(tempFile, 'utf8');
            fs.unlinkSync(tempFile);
        }

        return { success: true, script: scriptContent };
    } catch (error) {
        console.error('❌ Error en Codegen:', error.message);
        throw error;
    }
}

// 2. MODO EJECUCIÓN: Corre el script, graba video y va en CÁMARA LENTA
async function executeScript(scriptContent, testId, slowMo = 0) {
    console.log(`🤖 Ejecutando script automatizado para Test ID: ${testId} | slowMo: ${slowMo}ms`);
    const tempFile = path.join(tempPath, `run_${testId}_${Date.now()}.js`);

    try {
        const videoDir = evidencePath.replace(/\\/g, '/');

        // Modo lento: inyectar slowMo si es > 0, de lo contrario ejecutar a velocidad normal
        let modifiedScript;
        if (slowMo > 0) {
            modifiedScript = scriptContent.replace(
                /headless:\s*(true|false)/,
                `headless: false, slowMo: ${slowMo}`
            );
        } else {
            // Modo normal: headless true para máxima velocidad
            modifiedScript = scriptContent.replace(
                /headless:\s*(true|false)/,
                `headless: true`
            );
        }

        // Inyección de grabación de video
        modifiedScript = modifiedScript.replace(
            /await browser\.newContext\(([\s\S]*?)\);/,
            `await browser.newContext({ $1 recordVideo: { dir: '${videoDir}' } });`
        );

        // ℹ️ No inyectamos process.exit() — el child process termina solo.
        // Inyectarlo mataba el servidor Express antes de actualizar la BD.

        // Guardamos el archivo modificado
        fs.writeFileSync(tempFile, modifiedScript);

        // Ejecutamos el archivo
        await execPromise(`node "${tempFile}"`);

        // Buscamos el video generado más reciente
        const files = fs.readdirSync(evidencePath)
            .filter(f => f.endsWith('.webm'))
            .map(f => ({ file: f, time: fs.statSync(path.join(evidencePath, f)).mtime.getTime() }))
            .sort((a, b) => b.time - a.time);

        const videoFileName = files.length > 0 ? files[0].file : 'no-video.webm';

        // Limpiamos el archivo temporal
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);

        return { success: true, video: videoFileName };
    } catch (error) {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        console.error('❌ Error en Ejecución del Script:', error.message);
        throw error;
    }
}

module.exports = { recordScript, executeScript };