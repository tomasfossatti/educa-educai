import { expect, test } from "@playwright/test";
import { db, login, world } from "./support";

test("cómo preferís trabajar: opción múltiple que se guarda y se vuelve a mostrar", async ({ page }) => {
  const w = await world();
  await login(page, w.students[0]);
  await page.goto("/s/context");
  await page.fill("#goals", "Aprender a validar un producto con usuarios.");
  await page.getByLabel("Con ejemplos prácticos primero").check();
  await page.getByLabel("En equipo, más que solo").check();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Contexto actualizado.")).toBeVisible();

  const profile = await db.studentProfile.findUniqueOrThrow({ where: { userId: w.students[0].id } });
  expect(profile.declaredWorkPreferences).toBe("Con ejemplos prácticos primero; En equipo, más que solo");

  await page.reload();
  await expect(page.getByLabel("Con ejemplos prácticos primero")).toBeChecked();
  await expect(page.getByLabel("En equipo, más que solo")).toBeChecked();
  await expect(page.getByLabel("Con la teoría primero")).not.toBeChecked();
});
