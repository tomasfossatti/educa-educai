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
