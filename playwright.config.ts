import { defineConfig } from "@playwright/test";

/**
 * E2E del flujo crítico. Requiere navegadores instalados:
 *   npx playwright install chromium
 * y la app corriendo (o deja que webServer la levante).
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3010",
    viewport: { width: 390, height: 844 },
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        port: 3010,
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
