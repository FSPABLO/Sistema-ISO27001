// Pruebas de punta a punta en un navegador real (Chromium), contra el sistema y las dos bases del laboratorio.
// Se ejecutan con: docker compose --profile e2e run --rm e2e
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.js/,
  timeout: 300000,
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  outputDir: 'resultados',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    viewport: { width: 1440, height: 900 },
    locale: 'es-CR',
    timezoneId: 'America/Costa_Rica',
    trace: 'retain-on-failure',
  },
});
