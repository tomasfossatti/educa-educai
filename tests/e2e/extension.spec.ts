import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect, test } from "@playwright/test";
import { login, world } from "./support";

/**
 * Extensión del navegador con un Canvas que no deja crear tokens: la estudiante genera un código en
 * Educai, lo pega en la extensión real (cargada en Chromium) y la extensión manda la sesión del
 * Canvas de mentira. Después trae una materia por chat.
 */
const LMS_URL = `http://localhost:${process.env.E2E_FAKE_LMS_PORT ?? 4310}`;

test("la extensión conecta Canvas con la sesión del navegador y el chat trae la materia", async ({ baseURL }) => {
  const dir = mkdtempSync(join(tmpdir(), "educai-ext-"));
  execFileSync("node", ["scripts/build-extension.mjs", "--dir", dir, "--test"]);
  const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "educai-perfil-")), {
    channel: "chromium",
    baseURL,
    args: [`--disable-extensions-except=${dir}`, `--load-extension=${dir}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    const extensionId = new URL(worker.url()).host;
    // Sesión iniciada en el Canvas de mentira, como si la estudiante hubiera entrado.
    await context.addCookies([{ name: "canvas_session", value: "canvas-token-estudiante-sintetico", url: LMS_URL }]);

    const w = await world({ students: 1 });
    const page = await context.newPage();
    await login(page, w.students[0]);
    await page.goto("/s/asistente");
    await page.getByLabel("Cómo te conectás").selectOption("extension");
    await page.getByLabel("Dirección del campus").fill(LMS_URL);
    await page.getByRole("button", { name: "Generar código" }).click();
    const code = await page.getByRole("textbox", { name: "Copiar código" }).inputValue();
    expect(code).toMatch(/^educai1\./);

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.getByLabel("Código de Educai").fill(code);
    await popup.getByRole("button", { name: "Vincular" }).click();
    await expect(popup.getByText("Conectado como Estudiante Sintético")).toBeVisible({ timeout: 15_000 });

    // Educai se entera sola y muestra la conexión.
    await page.bringToFront();
    await expect(page.getByText(/Conectado a Canvas como Estudiante Sintético/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/La extensión del navegador mantiene la sesión al día/)).toBeVisible();

    const box = page.getByRole("textbox", { name: /creá la materia/ });
    await box.fill('crea la materia "costos de proyectos"');
    await box.press("Enter");
    await expect(page.getByText(/Listo: «Costos de Proyectos» tiene 16 archivos de 4 módulos/)).toBeVisible({ timeout: 45_000 });

    // Desvincular desde la extensión la deja sin clave.
    await popup.bringToFront();
    await popup.getByRole("button", { name: "Desvincular" }).click();
    await expect(popup.getByLabel("Código de Educai")).toBeVisible();
  } finally {
    await context.close();
  }
});
