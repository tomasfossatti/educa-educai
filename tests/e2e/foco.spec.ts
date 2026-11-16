import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { db, world } from "./support";

/**
 * Alta mínima y perfil progresivo (PR 11 de la simplificación): una pantalla de consentimiento, después
 * solo el código; carrera, año, proyecto y foco se piden de a uno en el chat, con "Saltar".
 */
test("alta mínima: consentimiento en una pantalla, código y perfil de a una pregunta con Saltar", async ({ page }) => {
  const w = await world({ students: 0 });
  const email = `e2e-foco-${randomBytes(4).toString("hex")}@test.educai`;
  await page.goto("/register");
  await page.fill("#name", "Estudiante Foco");
  await page.fill("#email", email);
  await page.fill("#password", randomBytes(15).toString("base64url"));
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.waitForURL("**/s/onboarding**");

  // Una frase verdadera y dos botones, ninguno elegido de antemano.
  await expect(page.getByText("Tu docente ve partes de tus charlas, las dudas que detecte la IA, tu avance, tu carrera y tu proyecto.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Acepto" })).toBeVisible();
  await expect(page.getByRole("button", { name: "No, gracias" })).toBeVisible();
  await expect(page.locator("input[type=radio]:checked, input[type=checkbox]:checked")).toHaveCount(0);
  await expect(page.getByText("Nadie más ve tus charlas")).toBeHidden();
  await page.getByText("Ver más").click();
  await expect(page.getByText("Nadie más ve tus charlas")).toBeVisible();
  await page.getByRole("button", { name: "Acepto" }).click();

  // Solo el código de la materia.
  await page.waitForURL(/\/s$/);
  await page.getByLabel("Código").fill(w.course.joinCode!);
  await page.getByRole("button", { name: "Unirme" }).click();
  await expect(page.getByRole("textbox", { name: "Tu pregunta" })).toBeVisible();
  const user = await db.user.findUniqueOrThrow({ where: { email }, include: { studentProfile: true } });
  expect(user.studentProfile?.consentAnalysisAt).not.toBeNull();
  expect(user.studentProfile?.consentVersion).toBe("2026-11b");
  expect(user.studentProfile?.career).toBeNull();
  // Se siguen creando las dos carpetas, sin que el estudiante tenga que saberlo.
  expect(await db.folder.count({ where: { studentId: user.id } })).toBe(2);

  // Antes de la primera charla no se pregunta nada del perfil.
  await expect(page.getByText("¿Qué carrera estudiás?")).toHaveCount(0);
  await page.getByRole("textbox", { name: "Tu pregunta" }).fill("¿Qué es una hipótesis?");
  await page.getByRole("button", { name: "Preguntar", exact: true }).click();

  // Después, de a una: carrera (Saltar), año (Saltar), proyecto (Guardar), foco (Guardar).
  await expect(page.getByText("¿Qué carrera estudiás?")).toBeVisible();
  await page.getByRole("button", { name: "Saltar" }).click();
  await expect(page.getByText("¿En qué año estás?")).toBeVisible();
  await page.getByRole("button", { name: "Saltar" }).click();
  await expect(page.getByText(/¿Tenés un proyecto propio\?/)).toBeVisible();
  await page.getByRole("region", { name: "¿Me contás un poco de vos?" }).getByRole("textbox").fill("Un centro de kinesiología deportiva.");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("¿De dónde querés que saque los ejemplos?")).toBeVisible();
  // Elegir el trabajo pide escribirlo.
  await page.getByLabel("De lo que hago hoy").check();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Contanos qué hacés hoy para poder usarlo en los ejemplos.").first()).toBeVisible();
  await page.getByLabel("¿Qué hacés hoy además de estudiar?").fill("Analista de compras en una empresa petrolera.");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("¿De dónde querés que saque los ejemplos?")).toHaveCount(0);

  const profile = await db.studentProfile.findUniqueOrThrow({ where: { userId: user.id } });
  expect(profile).toMatchObject({ career: null, studyYear: null, projectDescription: "Un centro de kinesiología deportiva.", personalizationFocus: "WORK" });
  expect(profile.profilePromptsDone.sort()).toEqual(["career", "focus", "project", "studyYear"]);

  // El foco se puede cambiar después desde Mis datos, en Mi perfil.
  await page.goto("/s/mis-datos#perfil");
  await page.locator('input[name="personalizationFocus"][value="PROJECT"]').check();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Contexto actualizado.")).toBeVisible();
  expect((await db.studentProfile.findUniqueOrThrow({ where: { userId: user.id } })).personalizationFocus).toBe("PROJECT");
});

test("con «No, gracias» puede usar el chat igual y nada se analiza", async ({ page }) => {
  const w = await world({ students: 0 });
  const email = `e2e-no-${randomBytes(4).toString("hex")}@test.educai`;
  await page.goto("/register");
  await page.fill("#name", "Estudiante Sin Consentimiento");
  await page.fill("#email", email);
  await page.fill("#password", randomBytes(15).toString("base64url"));
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.waitForURL("**/s/onboarding**");
  await page.getByRole("button", { name: "No, gracias" }).click();
  await page.waitForURL(/\/s$/);
  await page.getByLabel("Código").fill(w.course.joinCode!);
  await page.getByRole("button", { name: "Unirme" }).click();
  await page.getByRole("textbox", { name: "Tu pregunta" }).fill("Pregunta sin consentimiento");
  await page.getByRole("button", { name: "Preguntar", exact: true }).click();
  await expect(page.getByText("Pregunta sin consentimiento")).toBeVisible();
  const user = await db.user.findUniqueOrThrow({ where: { email }, include: { studentProfile: true } });
  expect(user.studentProfile?.consentAnalysisAt).toBeNull();
});
