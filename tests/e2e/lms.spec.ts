import { expect, test, type Page } from "@playwright/test";
import { db, login, world } from "./support";

/**
 * Asistente del LMS: el docente (y el estudiante) conectan su Canvas y piden por chat
 * «crea la materia "costos de proyectos"». Educai arma la materia y baja 4 módulos con 4 lecturas
 * cada uno desde el LMS de mentira (datos sintéticos).
 */
const LMS_URL = `http://localhost:${process.env.E2E_FAKE_LMS_PORT ?? 4310}`;
const TOKENS = { teacher: "canvas-token-docente-sintetico", student: "canvas-token-estudiante-sintetico" };

async function connectCanvas(page: Page, token: string) {
  await page.getByLabel("Dirección del campus").fill(LMS_URL);
  await page.getByLabel("Token de acceso").fill(token);
  await page.getByRole("button", { name: "Conectar" }).click();
  await expect(page.getByText(/Conectado a Canvas como/)).toBeVisible();
}

async function ask(page: Page, message: string) {
  const box = page.getByRole("textbox", { name: /creá la materia/ });
  await box.fill(message);
  await box.press("Enter");
}

test("el docente conecta Canvas y crea «Costos de Proyectos» por chat con sus 16 lecturas", async ({ page }) => {
  const w = await world({ students: 0 });
  await login(page, w.teacher);
  await page.getByRole("link", { name: "Traer una materia del LMS" }).click();
  await expect(page).toHaveURL(/\/t\/asistente$/);

  // Sin conexión, el chat lo pide antes de buscar nada.
  await ask(page, 'crea la materia "costos de proyectos"');
  await expect(page.getByText(/Primero conectá tu LMS/)).toBeVisible();

  await connectCanvas(page, TOKENS.teacher);
  await expect(page.getByLabel("Token de acceso")).toBeHidden();

  await ask(page, 'crea la materia "costos de proyectos"');
  await expect(page.getByText("Creé la materia «Costos de Proyectos»", { exact: false })).toBeVisible();
  await expect(page.getByText(/Listo: «Costos de Proyectos» tiene 16 archivos de 4 módulos/)).toBeVisible({ timeout: 45_000 });

  await page.getByRole("link", { name: "Abrir la materia" }).click();
  await expect(page).toHaveURL(/\/t\/courses\/[^/]+\/material$/);
  await expect(page.getByText(/Módulo 1 Fundamentos de costos · Costos fijos y variables\.pdf/)).toBeVisible();
  await expect(page.getByText(/Lecciones aprendidas\.txt/)).toBeVisible();

  const course = await db.course.findFirstOrThrow({ where: { teacherId: w.teacher.id, name: "Costos de Proyectos" } });
  expect(await db.material.count({ where: { courseId: course.id, status: "READY" } })).toBe(16);
});

test("el estudiante trae una materia a su carpeta y el chat pregunta si el nombre es ambiguo", async ({ page }) => {
  const w = await world({ students: 1 });
  await login(page, w.students[0]);
  // El asistente del LMS está en el menú de arriba a la derecha.
  await page.getByRole("button", { name: "Abrir menú de usuario" }).click();
  await page.getByRole("link", { name: "Traer una materia de Canvas o Moodle" }).click();
  await expect(page).toHaveURL(/\/s\/asistente$/);
  await connectCanvas(page, TOKENS.student);

  await ask(page, "creá la materia proyectos");
  await expect(page.getByText(/varias materias parecidas/)).toBeVisible();

  await ask(page, "creá la materia «Costos de Proyectos»");
  await expect(page.getByText(/Listo: «Costos de Proyectos» tiene 16 archivos/)).toBeVisible({ timeout: 45_000 });
  await page.getByRole("link", { name: "Abrir la materia" }).click();
  await expect(page).toHaveURL(/\/s\/folders\/[^/]+$/);
  await expect(page.getByRole("heading", { name: "Costos de Proyectos" })).toBeVisible();
  await expect(page.getByText("Material de la materia")).toBeVisible();
  await expect(page.getByText(/Costos fijos y variables\.pdf/)).toBeVisible();
});
