import { expect, test } from "@playwright/test";
import { makePdf } from "./documents";
import { db, login, world } from "./support";

test("el docente sube material y la estudiante practica un tema con un quiz que actualiza su avance", async ({ browser }) => {
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
  // Practicar: los temas de la materia; tocar uno arma el quiz.
  await student.getByRole("link", { name: "Mi avance" }).click();
  await expect(student.getByRole("button", { name: "Hipotesis falsables: Sin empezar" })).toBeVisible();
  await student.getByRole("link", { name: "Practicar" }).click();
  await student.waitForURL("**/s/practicar");
  await student.getByRole("button", { name: "Practicar: Hipotesis falsables" }).click();
  await student.waitForURL(/\/s\/practicar\/.+/);

  // Antes de entregar, la página no trae las respuestas correctas.
  expect(await student.content()).not.toContain("correctIndex");
  await expect(student.getByText("Sale de: programa.pdf, pág. 1").first()).toBeVisible();
  const questions = await student.locator("fieldset").count();
  expect(questions).toBeGreaterThanOrEqual(3);
  for (let i = 0; i < questions; i++) await student.locator(`input[name=q${i}]`).first().check();
  await student.getByRole("button", { name: "Entregar" }).click();

  // Un solo mensaje y un botón; el detalle queda detrás de "Ver más".
  await expect(student.getByRole("heading", { name: `Acertaste ${questions} de ${questions}.` })).toBeVisible();
  await expect(student.getByText("%")).toHaveCount(0);
  await expect(student.getByText("Tu respuesta").first()).toBeHidden();
  await student.getByText("Ver más").click();
  await expect(student.getByText("Tu respuesta").first()).toBeVisible();
  await student.getByRole("link", { name: "Seguir" }).click();
  await student.waitForURL("**/s/practicar");

  // El semáforo de Mi avance cambia de gris a amarillo (una práctica: tope 0,5).
  await student.getByRole("link", { name: "Mi avance" }).click();
  await expect(student.getByRole("button", { name: "Hipotesis falsables: En camino" })).toBeVisible();

  const course = await db.course.findUniqueOrThrow({ where: { id: w.course.id } });
  await student.goto(`/s/courses/${course.id}/ficha`);
  await expect(student.getByText("dominio 50% (1 intento)")).toBeVisible();
});
