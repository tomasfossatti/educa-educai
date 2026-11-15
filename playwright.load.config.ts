import { defineConfig, devices } from "@playwright/test";

/**
 * Prueba de carga de la etapa 6: 60 estudiantes simulados conversando a la vez, sobre el build
 * de producción, con el proveedor guionado (con demora simulada) y una base propia.
 *   npm run build && npm run test:load
 * Variables: LOAD_STUDENTS (60), LOAD_ROUNDS (3), SCRIPTED_AI_LATENCY_MS (1500) y LOAD_SERVER_CPUS
 * (lista de CPU para el servidor, por ejemplo "0", para simular una instancia chica con taskset).
 */
const PORT = Number(process.env.LOAD_PORT ?? 3300);
const LOAD_DATABASE_URL = process.env.LOAD_DATABASE_URL ?? process.env.E2E_DATABASE_URL ?? "postgresql://educai:educai@localhost:5432/educai_e2e";
process.env.E2E_DATABASE_URL = LOAD_DATABASE_URL;
process.env.SCRIPTED_AI_LATENCY_MS ??= "1500";

export default defineConfig({
  testDir: "tests/load",
  timeout: 20 * 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL: `http://localhost:${PORT}`, trace: "off", ...devices["Desktop Chrome"] },
  webServer: {
    command: `${process.env.LOAD_SERVER_CPUS ? `taskset -c ${process.env.LOAD_SERVER_CPUS} ` : ""}npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      DATABASE_URL: LOAD_DATABASE_URL,
      AI_PROVIDER: "scripted",
      ALLOW_SCRIPTED_AI: "true",
      SCRIPTED_AI_LATENCY_MS: process.env.SCRIPTED_AI_LATENCY_MS,
      SESSION_COOKIE_SECURE: "false",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
