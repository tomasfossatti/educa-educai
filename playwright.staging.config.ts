import { existsSync, readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * Prueba de humo contra staging (docs/ENTORNOS_Y_DESPLIEGUE.md, paso 4 del flujo de cambios).
 * Usa solo la interfaz: crea una docente, una materia y un estudiante sintéticos.
 *   npm run test:staging
 * STAGING_URL (por defecto https://educai-staging.vercel.app) y STAGING_SITE_PASSWORD
 * (por defecto, el archivo .secrets/staging/SITE_PASSWORD).
 */
const password =
  process.env.STAGING_SITE_PASSWORD ?? (existsSync(".secrets/staging/SITE_PASSWORD") ? readFileSync(".secrets/staging/SITE_PASSWORD", "utf8").trim() : "");

export default defineConfig({
  testDir: "tests/staging",
  timeout: 180_000,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.STAGING_URL ?? "https://educai-staging.vercel.app",
    httpCredentials: password ? { username: "educai", password } : undefined,
    trace: "off",
    ...devices["Desktop Chrome"],
  },
});
