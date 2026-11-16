import { expect, test } from "@playwright/test";
import { makePdf } from "./documents";
import { db, login, subjectFolderUrl, world } from "./support";

test("el docente sube material y la estudiante hace un quiz del tema y ve su dominio", async ({ browser }) => {
  const w = await world();

  const teacher = await browser.newPage();
  await login(teacher, w.teacher);
  await teacher.goto(`/t/courses/${w.course.id}/material`);
  await teacher.setInputFiles("input[type=file]", {
    name: "programa.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(makePdf(["Unidad 2. Las hipotesis falsables definen el resultado que las refutaria, con metrica y plazo."])),
  });
  await teacher.getByRole("button", { name: "Subir e indexar" }).click();
  await expect(teacher.getByText("programa.pdf quedó indexado")).toBeVisible();

  const student = await browser.newPage();
  await login(student, w.students[0]);
  await student.goto(await subjectFolderUrl(w.students[0].id, w.course.id));
  const topic = student.locator("li", { hasText: "Hipotesis falsables" });
  await expect(topic.getByText("Sin intentos")).toBeVisible();
  await topic.getByRole("button", { name: "Hacer quiz" }).click();
  await student.waitForURL("**/quiz/**");

  // Antes de entregar, la página no trae las respuestas correctas.
  expect(await student.content()).not.toContain("correctIndex");
  await expect(student.getByText("Fuente: programa.pdf, pág. 1").first()).toBeVisible();
  const questions = await student.locator("fieldset").count();
  expect(questions).toBeGreaterThanOrEqual(3);
  for (let i = 0; i < questions; i++) await student.locator(`input[name=q${i}]`).first().check();
  await student.getByRole("button", { name: "Entregar" }).click();

  await expect(student.getByText(`${questions} de ${questions} correctas`)).toBeVisible();
  await expect(student.getByText("Dominio 50%")).toBeVisible(); // tope con un solo intento

  const course = await db.course.findUniqueOrThrow({ where: { id: w.course.id } });
  await student.goto(`/s/courses/${course.id}/ficha`);
  await expect(student.getByText("dominio 50% (1 intento)")).toBeVisible();
});
