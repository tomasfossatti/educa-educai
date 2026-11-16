import { expect, test } from "@playwright/test";
import { db, login, world } from "./support";

test("Mi avance: un semáforo por tema, sin porcentajes, calculado desde las prácticas", async ({ page }) => {
  const w = await world({ topics: ["Hipotesis falsables", "Segmentacion de mercado", "Costos hundidos"] });
  const student = w.students[0];
  // Una práctica perfecta (tope 0,5): en camino. Dos perfectas (0,8): lo domina. Ninguna: sin empezar.
  await db.masteryRecord.create({ data: { studentId: student.id, curriculumItemId: w.topics[0].id, score: 0.5, attempts: 1, lastEvidenceAt: new Date() } });
  await db.masteryRecord.create({ data: { studentId: student.id, curriculumItemId: w.topics[1].id, score: 0.8, attempts: 2, lastEvidenceAt: new Date() } });
  await login(page, student);
  await page.getByRole("link", { name: "Mi avance" }).click();
  await expect(page).toHaveURL(/\/s\/avance$/);

  await expect(page.getByRole("button", { name: "Hipotesis falsables: En camino" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Segmentacion de mercado: Lo domino" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Costos hundidos: Sin empezar" })).toBeVisible();
  expect(await page.getByRole("main").textContent()).not.toMatch(/%|dominio/i);

  // Tocar un tema abre Practicar sobre ese tema (sin material, lo avisa sin inventar preguntas).
  await page.getByRole("button", { name: "Costos hundidos: Sin empezar" }).click();
  await expect(page).toHaveURL(/\/s\/practicar/);
});

test("Mi avance sin temas aprobados lo dice en una frase", async ({ page }) => {
  const w = await world({ topics: [] });
  await login(page, w.students[0]);
  await page.goto("/s/avance");
  await expect(page.getByText("Tu docente todavía no eligió los temas de esta materia.")).toBeVisible();
});
