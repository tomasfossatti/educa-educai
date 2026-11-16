import { expect, test } from "@playwright/test";
import { db, login, world } from "./support";

test("la barra lateral del estudiante lleva a la materia, sus secciones y sus carpetas", async ({ page }) => {
  const w = await world();
  const student = w.students[0];
  await login(page, student);
  await page.goto("/s");

  await page.getByRole("button", { name: "Abrir menú lateral" }).click();
  const menu = page.getByRole("dialog", { name: "Menú lateral" });
  await expect(menu.getByRole("heading", { name: w.course.name })).toBeVisible();
  for (const label of ["Inicio", "Asistente", "Materia", "Actividades", "Desarrollo", "Mi ficha", "Tu contexto"]) {
    await expect(menu.getByRole("link", { name: label, exact: true })).toBeVisible();
  }

  // Las dos carpetas que se crean al entrar: la de la materia y la del proyecto.
  const folders = await db.folder.findMany({ where: { studentId: student.id }, orderBy: { kind: "asc" } });
  expect(folders).toHaveLength(2);
  await expect(menu.getByText("Tus carpetas", { exact: true })).toBeVisible();
  for (const f of folders) await expect(menu.locator(`a[href="/s/folders/${f.id}"]`)).toHaveText(f.name);

  // Una carpeta privada traída del LMS también aparece.
  await db.folder.create({ data: { studentId: student.id, kind: "SUBJECT", name: "Costos E2E", createdBy: "LMS" } });
  await page.reload();
  await page.getByRole("button", { name: "Abrir menú lateral" }).click();
  await menu.getByRole("link", { name: "Costos E2E" }).click();
  await expect(page).toHaveURL(/\/s\/folders\//);
  await expect(menu).toHaveCount(0);

  await page.getByRole("button", { name: "Abrir menú lateral" }).click();
  await expect(menu.getByRole("link", { name: "Costos E2E" })).toHaveAttribute("aria-current", "page");
  await menu.getByRole("link", { name: "Mi ficha" }).click();
  await expect(page).toHaveURL(new RegExp(`/s/courses/${w.course.id}/ficha`));
});

test("sin materias, la barra lateral ofrece sumarse con un código", async ({ page }) => {
  const w = await world();
  await db.enrollment.deleteMany({ where: { studentId: w.students[0].id } });
  await login(page, w.students[0]);
  await page.goto("/s");
  await page.getByRole("button", { name: "Abrir menú lateral" }).click();
  const menu = page.getByRole("dialog", { name: "Menú lateral" });
  await expect(menu.getByRole("link", { name: "Unirme con un código" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Actividades" })).toHaveCount(0);
});
