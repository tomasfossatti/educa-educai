import { expect, test } from "@playwright/test";
import { db, login, world } from "./support";

test("el inicio del estudiante es el chat de su materia, con datos reales", async ({ page }) => {
  const w = await world();
  await login(page, w.students[0]);
  await page.goto("/s");
  await expect(page.getByRole("heading", { name: w.course.name })).toBeVisible();
  // Restos de un diseño viejo que mostraba datos inventados: no tienen que volver.
  await expect(page.getByText("Turno:")).toHaveCount(0);
  await expect(page.getByText(/Clase \d+ de \d+/)).toHaveCount(0);
  await expect(page.getByText("Tomar decisiones de negocio con evidencia")).toHaveCount(0);
  // La caja de pregunta está lista para escribir, sin tarjetas ni listados.
  await expect(page.getByRole("textbox", { name: "Tu pregunta" })).toBeFocused();
  await expect(page.getByPlaceholder("¿Qué querés aprender hoy?")).toBeVisible();
  for (const old of ["Tus carpetas", "Tu desarrollo", "Tu contexto declarado"]) {
    await expect(page.getByRole("main").getByText(old, { exact: true })).toHaveCount(0);
  }
});

test("la página de la materia muestra solo datos reales y estados vacíos honestos", async ({ page }) => {
  const w = await world();
  await login(page, w.students[0]);
  await page.goto(`/s/courses/${w.course.id}`);
  await expect(page.getByRole("heading", { name: w.course.name })).toBeVisible();
  // Sin clase aprobada, sin tareas y sin conversaciones: lo dice en vez de inventar.
  await expect(page.getByText("Tu docente todavía no publicó la próxima clase.")).toBeVisible();
  await expect(page.getByText("Tu docente todavía no publicó tareas.")).toBeVisible();
  await expect(page.getByText("Todavía no conversaste sobre esta materia.")).toBeVisible();
  const html = await page.content();
  for (const fake of [/hipótesis falsables/i, /Rosario/, /e-commerce/i, /última milla/i, /Clase \d+ de \d+/, /Simular/]) {
    expect(html).not.toMatch(fake);
  }
  // El botón principal lleva al chat de la materia, que cita el material.
  await page.getByRole("link", { name: "Preguntar" }).click();
  await expect(page).toHaveURL(/\/s\/folders\//);
});

test("sin materia, el inicio pide solo el código y entra al chat", async ({ page }) => {
  const w = await world();
  const other = await world({ students: 0 });
  await db.enrollment.deleteMany({ where: { studentId: w.students[0].id } });
  await login(page, w.students[0]);
  await page.goto("/s");
  await expect(page.getByRole("heading", { name: "Sumate a tu materia" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Tu pregunta" })).toHaveCount(0);
  await page.getByLabel("Código").fill(other.course.joinCode!);
  await page.getByRole("button", { name: "Unirme" }).click();
  await expect(page.getByRole("textbox", { name: "Tu pregunta" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("heading", { name: other.course.name })).toBeVisible();
});

test("una invitación pendiente se acepta con un toque desde el inicio", async ({ page }) => {
  const w = await world();
  const other = await world({ students: 0 });
  const student = await db.user.findUniqueOrThrow({ where: { id: w.students[0].id } });
  await db.courseInvite.create({ data: { courseId: other.course.id, email: student.email } });
  await login(page, w.students[0]);
  await page.goto("/s");
  await expect(page.getByText(`te invitó a ${other.course.name}`)).toBeVisible();
  await page.getByRole("button", { name: "Unirme" }).click();
  await expect(page.getByRole("main").getByRole("heading", { name: other.course.name })).toBeVisible();
});

test("preguntar desde el inicio: la respuesta cita el material o avisa que no hay fuente", async ({ page }) => {
  const w = await world();
  await login(page, w.students[0]);
  await page.getByRole("textbox", { name: "Tu pregunta" }).fill("¿Qué es una hipótesis?");
  await page.getByRole("button", { name: "Preguntar", exact: true }).click();
  await expect(page.getByText("¿Qué es una hipótesis?")).toBeVisible();
  // Sin material cargado, la IA lo dice en vez de inventar una fuente.
  await expect(page.getByText("No encontré esto en el material de tu docente")).toBeVisible();
  await expect(page).toHaveURL(/\/s$/);
});
