import { expect, test, type Page } from "@playwright/test";
import { login, world } from "./support";

async function chatAndFinish(page: Page, folderUrl: string, questions: string[]) {
  await page.goto(folderUrl);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Nueva conversación" }).click();
  await page.waitForURL("**/c/**");
  await page.waitForLoadState("networkidle");
  for (const q of questions) {
    await page.fill("textarea[name=question]", q);
    await page.getByRole("button", { name: "Preguntar", exact: true }).click();
    await expect(page.getByText(q)).toBeVisible();
    await expect(page.locator("textarea[name=question]")).toHaveValue("");
  }
  await page.getByRole("button", { name: "Terminar", exact: true }).click();
  await page.waitForLoadState("networkidle");
}

test("la IA guarda hechos de la carpeta y la estudiante los corrige y borra", async ({ page }) => {
  const w = await world();
  await login(page, w.students[0]);
  await page.locator('a[href^="/s/folders/"]', { hasText: "Materia" }).first().click();
  await page.waitForURL("**/s/folders/**");
  const folderUrl = page.url();

  await chatAndFinish(page, folderUrl, ["No sé cómo medir una hipótesis", "¿Sirven las encuestas?"]);
  await chatAndFinish(page, folderUrl, ["Ahora pregunto por segmentación", "¿Por edad alcanza?"]);

  // Los hechos se generan después de responder: recargamos hasta verlos.
  await expect(async () => {
    await page.goto(folderUrl);
    await page.waitForLoadState("networkidle");
    // Esperamos el resultado de la segunda conversación: el hecho viejo archivado y uno nuevo.
    await expect(page.getByRole("textbox", { name: "Hecho", exact: true })).toHaveValue(/segmentación/);
  }).toPass({ timeout: 20_000 });

  const facts = page.locator("section", { hasText: "Lo que la IA sabe de vos" });
  const fact = facts.locator("li", { has: page.getByRole("textbox", { name: "Hecho", exact: true }) });
  await fact.getByRole("textbox").fill("Ya sabe medir hipótesis con preventas");
  await fact.getByRole("button", { name: "Guardar" }).click();
  await expect(fact.getByText("editado por vos")).toBeVisible();
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("textbox", { name: "Hecho", exact: true })).toHaveValue("Ya sabe medir hipótesis con preventas");
  // El resumen cruzado también se generó y es editable.
  await expect(page.getByRole("textbox", { name: "Resumen", exact: true })).toHaveCount(1);

  // Historial (traza): registra los cierres.
  await facts.getByText("Historial de la carpeta").click();
  await expect(facts.getByText("Conversación cerrada").first()).toBeVisible();

  page.once("dialog", (d) => d.accept());
  await page.locator("li", { has: page.getByRole("textbox", { name: "Hecho", exact: true }) }).getByRole("button", { name: "Borrar" }).click();
  await expect(page.getByRole("textbox", { name: "Hecho", exact: true })).toHaveCount(0);
});
