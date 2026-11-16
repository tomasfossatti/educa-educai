import { expect, test } from "@playwright/test";
import { askFromHome, db, login, world } from "./support";

/**
 * Mis datos (PR 10 de la simplificación): V7, V9, V10 y V11 desde la ubicación nueva.
 * Las reglas se prueban también en la integración (visibility-stage3/4); acá, por la interfaz.
 */
test("V7 y V9: Mis datos muestra lo mismo que ve el docente y quién lo abrió", async ({ browser }) => {
  const w = await world();
  const ana = w.students[0];
  await db.signal.deleteMany({ where: { studentId: ana.id } });
  await db.masteryRecord.create({ data: { studentId: ana.id, curriculumItemId: w.topics[0].id, score: 0.5, attempts: 1, lastEvidenceAt: new Date() } });

  // El docente abre la ficha de Ana: queda registrado.
  const teacher = await browser.newPage();
  await login(teacher, w.teacher);
  await teacher.goto(`/t/courses/${w.course.id}/students/${ana.id}`);
  await expect(teacher.getByText("dominio 50% (1 intento)")).toBeVisible();
  await expect(teacher.getByText("Viandas")).toBeVisible();

  const page = await browser.newPage();
  await login(page, ana);
  await page.getByRole("button", { name: "Abrir menú de usuario" }).click();
  await page.getByRole("link", { name: "Mis datos" }).first().click();
  await expect(page).toHaveURL(/\/s\/mis-datos/);
  await page.getByText("Lo que ve mi docente sobre mí").click();
  const section = page.locator("#docente");
  // Los mismos datos con otras palabras: proyecto, carrera y el avance del tema.
  await expect(section.getByText("Viandas")).toBeVisible();
  await expect(section.getByText("Administración")).toBeVisible();
  await expect(section.getByText("1 práctica, avance 50 de 100")).toBeVisible();
  // V9: quién lo abrió y cuándo.
  await expect(section.getByText("Docente E2E").first()).toBeVisible();
  await expect(section.getByText("abrió lo que ve sobre vos").first()).toBeVisible();
  for (const word of ["evidencia", "dominio", "inferencia", "carpeta"]) {
    expect((await section.textContent())?.toLowerCase()).not.toContain(word);
  }
});

test("V10: borrar una charla desde Mis datos borra la charla y sus mensajes", async ({ page }) => {
  const w = await world();
  const ana = w.students[0];
  await login(page, ana);
  await askFromHome(page, "Charla para borrar");
  await expect(page.getByText("Charla para borrar").first()).toBeVisible();
  const conversation = await db.aIConversation.findFirstOrThrow({ where: { studentId: ana.id } });

  await page.goto("/s/mis-datos#charlas");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: `Borrar: ${conversation.title}` }).click();
  await expect.poll(() => db.aIConversation.count({ where: { id: conversation.id } })).toBe(0);
  expect(await db.message.count({ where: { conversationId: conversation.id } })).toBe(0);
});

test("V11: retirar el consentimiento desde Mis datos y el docente pierde acceso", async ({ browser }) => {
  const w = await world();
  const ana = w.students[0];
  const page = await browser.newPage();
  await login(page, ana);
  await page.goto("/s/mis-datos#consentimiento");
  await expect(page.getByText("Tu docente ve partes de tus charlas, las dudas que detecte la IA, tu avance, tu carrera y tu proyecto.")).toBeVisible();
  await page.getByRole("button", { name: "Retirar mi consentimiento" }).click();
  await expect(page.getByRole("button", { name: "Aceptar" })).toBeVisible();
  const profile = await db.studentProfile.findUniqueOrThrow({ where: { userId: ana.id } });
  expect(profile.consentAnalysisAt).toBeNull();
  expect(profile.consentWithdrawnAt).not.toBeNull();

  const teacher = await browser.newPage();
  await login(teacher, w.teacher);
  await teacher.goto(`/t/courses/${w.course.id}/students/${ana.id}`);
  await expect(teacher.getByText("no podés ver su ficha ni sus conversaciones")).toBeVisible();
});
