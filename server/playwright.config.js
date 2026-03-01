const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: process.env.PLAYWRIGHT_TEST_DIR || './tests',
  fullyParallel: true,
  workers: 1, // Limitar a 1 worker para ahorrar CPU y RAM en el VPS
  reporter: [['html', { open: 'never' }]],
  use: {
    // --- ESTA ES LA CLAVE ---
    launchOptions: {
      slowMo: process.env.VELOCIDAD_TEST ? parseInt(process.env.VELOCIDAD_TEST) : 0, // 1000ms = 1 segundo de pausa entre cada clic/acción
    },
    // ------------------------
    screenshot: { mode: 'on', fullPage: true },
    video: 'on',
    trace: 'on',
    baseURL: 'http://sirio-dev-frontend-alb-894180136.us-east-1.elb.amazonaws.com',
    headless: true,
  },
});