const { test: base } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

exports.test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const testName = path.basename(testInfo.file, '.spec.js');
    const folderPath = path.join(process.cwd(), 'evidencias', testName);
    
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

    const takePhoto = async (name) => {
        await page.waitForTimeout(600); 
        const fileName = `${Date.now()}_${name}.png`;
        try {
            await page.screenshot({ path: path.join(folderPath, fileName), fullPage: true });
            console.log(`📸 [EVIDENCIA] Foto: ${fileName}`);
        } catch (e) {}
    };

    // Sensor de clics
    await page.exposeFunction('notificarClic', () => {
        console.log("🖱️ [ACCION] Clic en Sirio...");
        takePhoto('click');
    });
    
    await page.addInitScript(() => {
        window.addEventListener('mousedown', () => window.notificarClic(), true);
    });

    console.log(`🚀 [INICIO] Test: ${testName}`);
    await takePhoto('inicio');
    await use(page);
    await takePhoto('final');
    console.log(`✅ [FIN] Test finalizado.`);
  },
});