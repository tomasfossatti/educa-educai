import { expect, test } from "@playwright/test";
import { login, world } from "./support";

test("lápiz mágico: sugiere una mejor redacción y solo la aplica si el estudiante la usa", async ({ page }) => {
  const w = await world();
  await login(page, w.students[0]);
  await page.goto("/s/context");
  const goals = page.locator("#goals");
  const wand = goals.locator("..").getByRole("button", { name: "Mejorar la redacción con IA" });

  // Sin texto el lápiz está bloqueado: mejora lo escrito, no escribe desde cero.
  await goals.fill("");
  await expect(wand).toBeDisabled();
  await goals.fill("ab");
  await expect(wand).toBeDisabled();
  await goals.fill("Mejorar la distribución de educai.");
  await expect(wand).toBeEnabled();

  // Descartar no toca el texto.
  await wand.click();
  await expect(page.getByText("Sugerencia")).toBeVisible();
  await page.getByRole("button", { name: "Descartar" }).click();
  await expect(goals).toHaveValue("Mejorar la distribución de educai.");

  // Usar reemplaza el texto por la sugerencia.
  await wand.click();
  await expect(page.getByText("(redacción mejorada)")).toBeVisible();
  await page.getByRole("button", { name: "Usar" }).click();
  await expect(goals).toHaveValue("Mejorar la distribución de educai. (redacción mejorada)");
  await expect(page.getByText("Sugerencia")).toHaveCount(0);
});
