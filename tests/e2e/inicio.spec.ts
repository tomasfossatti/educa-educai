import { expect, test } from "@playwright/test";
import { login, world } from "./support";

test("el inicio del estudiante muestra solo datos reales de la materia", async ({ page }) => {
  const w = await world();
  await login(page, w.students[0]);
  await page.goto("/s");
  await expect(page.getByRole("heading", { name: w.course.name })).toBeVisible();
  // Restos de un diseño viejo que mostraba datos inventados: no tienen que volver.
  await expect(page.getByText("Turno:")).toHaveCount(0);
  await expect(page.getByText(/Clase \d+ de \d+/)).toHaveCount(0);
  await expect(page.getByText("Tomar decisiones de negocio con evidencia")).toHaveCount(0);
  await expect(page.getByText("Ejemplos de:")).toBeVisible();
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
