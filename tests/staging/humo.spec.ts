import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { makePdf } from "../e2e/documents";

const uid = randomBytes(4).toString("hex");
const pass = () => randomBytes(15).toString("base64url");

async function register(page: Page, role: "Docente" | "Estudiante", name: string, email: string, password: string) {
  await page.goto("/register");
  await page.getByLabel(role).check();
  await page.fill("#name", name);
  await page.fill("#email", email);
  await page.fill("#password", password);
  if (role === "Docente") await page.fill("#institution", "Universidad de prueba");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.waitForURL(role === "Docente" ? "**/t**" : "**/s/onboarding**");
}

test("staging: materia con material, estudiante con consentimiento y respuesta con cita", async ({ browser }) => {
  // Docente: materia y material.
  const teacher = await (await browser.newContext()).newPage();
  await register(teacher, "Docente", "Docente Staging", `staging-docente-${uid}@test.educai`, pass());
  await teacher.goto("/t/new");
  await teacher.fill("#name", `Estrategia staging ${uid}`);
  await teacher.getByRole("button", { name: "Crear y cargar programa" }).click();
  await teacher.waitForURL("**/t/courses/**/curriculum");
  const courseId = new URL(teacher.url()).pathname.split("/")[3];
  await teacher.goto(`/t/courses/${courseId}/material`);
  await teacher.setInputFiles("input[type=file]", {
    name: "programa.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(makePdf(["Unidad 1. Segmentacion de mercado.", "Unidad 2. Una hipotesis falsable define el resultado que la refutaria."])),
  });
  await teacher.getByRole("button", { name: "Subir e indexar" }).click();
  await expect(teacher.getByText("programa.pdf quedó indexado")).toBeVisible({ timeout: 60_000 });
  await teacher.goto(`/t/courses/${courseId}/students`);
  const code = (await teacher.locator("span.font-mono").first().innerText()).trim();
  expect(code).toMatch(/^[A-Z0-9]{4,8}$/);

  // Estudiante: registro, consentimiento explícito, código de la materia.
  const student = await (await browser.newContext()).newPage();
  await register(student, "Estudiante", "Estudiante Staging", `staging-estudiante-${uid}@test.educai`, pass());
  await student.locator('input[name="consent"][value="yes"]').check();
  await student.getByRole("button", { name: "Continuar" }).click();
  await student.fill("#currentContext", "Estoy armando un emprendimiento de viandas.");
  await student.fill("#career", "Administración");
  await student.fill("#projectDescription", "Viandas saludables para oficinas.");
  await student.locator('input[name="personalizationFocus"][value="PROJECT"]').check();
  await student.getByRole("button", { name: "Continuar" }).click();
  await student.fill("#goals", "Validar si hay demanda.");
  await student.getByRole("button", { name: "Continuar" }).click();
  await student.getByRole("button", { name: "Continuar" }).click();
  await student.fill("#joinCode", code);
  await student.getByRole("button", { name: "Empezar" }).click();
  await student.waitForURL((u) => !u.pathname.startsWith("/s/onboarding"));

  // Chat de la carpeta de la materia, con cita del material.
  await student.goto("/s");
  await student.locator('a[href^="/s/folders/"]', { hasText: "Materia" }).first().click();
  await student.waitForURL("**/s/folders/**");
  await student.getByRole("button", { name: "Nueva conversación" }).click();
  await student.waitForURL("**/c/**");
  await student.fill("textarea[name=question]", "¿Qué hace falsable a una hipótesis?");
  await student.getByRole("button", { name: "Enviar" }).click();
  await expect(student.getByText("Fuentes:")).toBeVisible({ timeout: 90_000 });
  await expect(student.getByText(/programa\.pdf, pág\. 2/).first()).toBeVisible();
});

test("staging: el chequeo de salud responde con la base al día", async ({ page }) => {
  // Por el navegador: el cliente HTTP de Playwright no usa el proxy de red del entorno.
  const response = await page.goto("/api/health");
  const health = await response!.json();
  expect(health.ok).toBe(true);
  expect(health.migration).toMatch(/^\d{14}_/);
});
