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

test("con una materia, la estudiante encuentra cómo sumarse a otra y la barra sigue a la nueva", async ({ page }) => {
  const first = await world();
  const second = await world({ students: 0 });
  const student = first.students[0];
  await login(page, student);
  await page.goto("/s");

  // Desde el inicio y desde la barra lateral, aunque ya esté en una materia.
  await expect(page.getByRole("main").getByRole("link", { name: "Unirme a otra materia" })).toBeVisible();
  await page.getByRole("button", { name: "Abrir menú lateral" }).click();
  const menu = page.getByRole("dialog", { name: "Menú lateral" });
  await menu.getByRole("link", { name: "Unirme a otra materia" }).click();
  await expect(page).toHaveURL(/\/s\/join$/);

  await page.getByLabel("Código").fill(second.course.joinCode!);
  await page.getByRole("button", { name: "Unirme" }).click();
  await expect(page).toHaveURL(new RegExp(`/s/courses/${second.course.id}$`));

  // La barra muestra la materia nueva y su carpeta.
  await page.getByRole("button", { name: "Abrir menú lateral" }).click();
  await expect(menu.getByRole("heading", { name: second.course.name })).toBeVisible();
  const folder = await db.folder.findFirstOrThrow({ where: { studentId: student.id, courseId: second.course.id } });
  await expect(menu.locator(`a[href="/s/folders/${folder.id}"]`)).toHaveText(second.course.name);
  await menu.getByRole("button", { name: "Cerrar menú" }).click();

  // En el inicio, la materia anterior queda en "Otras materias inscriptas".
  await page.goto("/s");
  await expect(page.getByText("Otras materias inscriptas")).toBeVisible();
  await expect(page.getByRole("heading", { name: first.course.name })).toBeVisible();
});

test("después de navegar por la barra de arriba, el menú lateral se abre y queda abierto", async ({ page }) => {
  const w = await world();
  await login(page, w.students[0]);
  await page.goto("/s");
  await page.getByRole("banner").getByRole("link", { name: "Actividades" }).click();
  await expect(page).toHaveURL(/\/activities$/);
  await page.getByRole("button", { name: "Abrir menú lateral" }).click();
  const menu = page.getByRole("dialog", { name: "Menú lateral" });
  await expect(menu).toBeVisible();
  await page.waitForTimeout(500);
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("link", { name: "Actividades" })).toHaveAttribute("aria-current", "page");
});
