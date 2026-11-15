import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { login, world } from "./support";

test("la estudiante descarga una copia de sus datos desde Tu contexto", async ({ page }) => {
  const w = await world();
  await login(page, w.students[0]);
  await page.locator('a[href^="/s/folders/"]', { hasText: "Materia" }).first().click();
  await page.waitForURL("**/s/folders/**");
  await page.getByRole("button", { name: "Nueva conversación" }).click();
  await page.waitForURL("**/c/**");
  await page.waitForLoadState("networkidle");
  await page.fill("textarea[name=question]", "Pregunta para mi copia de datos");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText("Pregunta para mi copia de datos")).toBeVisible();

  await page.goto("/s/context");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Descargar mis datos" }).click();
  const file = await (await download).path();
  const data = JSON.parse(readFileSync(file, "utf8"));
  expect(data.account.email).toBe(w.students[0].email);
  expect(JSON.stringify(data.conversations)).toContain("Pregunta para mi copia de datos");
  expect(JSON.stringify(data)).not.toContain("passwordHash");
});
