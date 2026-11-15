import { defineConfig, devices } from "@playwright/test";

/**
 * Flujos de punta a punta sobre el build de producción, con el proveedor de IA guionado y una
 * base propia (E2E_DATABASE_URL). Todos los datos son sintéticos y se crean en cada corrida.
 *   npm run build && npm run test:e2e
 */
const PORT = Number(process.env.E2E_PORT ?? 3200);
const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgresql://educai:educai@localhost:5432/educai_e2e";
process.env.E2E_DATABASE_URL = E2E_DATABASE_URL;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL: `http://localhost:${PORT}`, trace: "off", ...devices["Desktop Chrome"] },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      AI_PROVIDER: "scripted",
      ALLOW_SCRIPTED_AI: "true",
      SESSION_COOKIE_SECURE: "false",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
