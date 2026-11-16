import { expect, test } from "@playwright/test";
import { db, login, world } from "./support";

test("practicar sin material del tema avisa en una frase y no inventa preguntas", async ({ page }) => {
  const w = await world();
  await login(page, w.students[0]);
  await page.goto("/s/practicar");
  await expect(page.getByText("Elegí un tema. Son de 3 a 5 preguntas.")).toBeVisible();
  await page.getByRole("button", { name: "Practicar: Segmentacion de mercado" }).click();
  await expect(page).toHaveURL(/\/s\/practicar\?error=notEnough$/);
  await expect(page.getByText("No hay suficiente material de este tema para armar preguntas.")).toBeVisible();
  expect(await db.quizAttempt.count({ where: { studentId: w.students[0].id } })).toBe(0);
});

test("sin temas aprobados, Practicar lo dice; las tareas del docente aparecen abajo", async ({ page }) => {
  const w = await world({ topics: [] });
  await db.activity.create({
    data: { courseId: w.course.id, title: "TP 1: validar una idea", kind: "PRACTICE", scenario: "Una pyme.", instructions: "Validá.", prompts: [], status: "PUBLISHED", publishedAt: new Date() },
  });
  await login(page, w.students[0]);
  await page.goto("/s/practicar");
  await expect(page.getByText("Tu docente todavía no eligió los temas de esta materia.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tareas de tu docente" })).toBeVisible();
  await page.getByRole("link", { name: /TP 1: validar una idea/ }).click();
  await expect(page).toHaveURL(/\/activities\//);
});

test("la dirección vieja de un quiz lleva a Practicar y otra estudiante no lo abre", async ({ browser }) => {
  const w = await world({ students: 2 });
  const [ana, bruno] = w.students;
  const quiz = await db.quizAttempt.create({
    data: {
      studentId: ana.id,
      courseId: w.course.id,
      curriculumItemId: w.topics[0].id,
      total: 3,
      questions: [0, 1, 2].map((i) => ({ prompt: `Pregunta ${i}`, options: ["a", "b"], correctIndex: 0, explanation: "x", source: { chunkId: "c", fileName: "programa.pdf", page: 1 } })),
    },
  });
  const anaPage = await browser.newPage();
  await login(anaPage, ana);
  await anaPage.goto(`/s/folders/cualquiera/quiz/${quiz.id}`);
  await expect(anaPage).toHaveURL(new RegExp(`/s/practicar/${quiz.id}$`));
  await expect(anaPage.getByText("Pregunta 0")).toBeVisible();

  const brunoPage = await browser.newPage();
  await login(brunoPage, bruno);
  await brunoPage.goto(`/s/practicar/${quiz.id}`);
  await expect(brunoPage.getByText("No encontramos esta página")).toBeVisible();
  expect(await brunoPage.content()).not.toContain("Pregunta 0");
});
