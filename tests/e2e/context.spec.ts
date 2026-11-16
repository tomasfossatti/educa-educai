import { expect, test, type Page } from "@playwright/test";
import { login, world } from "./support";

/** Una charla desde el inicio (el chat de la materia) y "Terminar", que la cierra y la analiza. */
async function chatAndFinish(page: Page, questions: string[]) {
  await page.goto("/s");
  await page.waitForLoadState("networkidle");
  for (const q of questions) {
    await page.getByRole("textbox", { name: "Tu pregunta" }).fill(q);
    await page.getByRole("button", { name: "Preguntar", exact: true }).click();
    await expect(page.getByText(q)).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Tu pregunta" })).toHaveValue("");
  }
  await page.getByRole("button", { name: "Terminar", exact: true }).click();
  // La charla quedó cerrada cuando el chat ya no ofrece "Terminar".
  await expect(page.getByRole("button", { name: "Terminar", exact: true })).toHaveCount(0, { timeout: 20_000 });
  // El chat avisa mientras analiza la charla terminada; esperamos a que termine.
  await expect(page.getByText("Estoy mirando la charla")).toHaveCount(0, { timeout: 20_000 });
}

test("la IA guarda lo que sabe de la estudiante y ella lo corrige y borra desde Mis datos", async ({ page }) => {
  const w = await world();
  await login(page, w.students[0]);
  // Lo que la IA sabe de la estudiante está en Mis datos (#ia abre esa sección).
  const myDataUrl = "/s/mis-datos#ia";

  await chatAndFinish(page, ["No sé cómo medir una hipótesis", "¿Sirven las encuestas?"]);
  await chatAndFinish(page, ["Ahora pregunto por segmentación", "¿Por edad alcanza?"]);

  // Los hechos se generan después de responder: recargamos hasta verlos.
  await expect(async () => {
    await page.goto(myDataUrl);
    await page.reload();
    await page.waitForLoadState("networkidle");
    // Esperamos el resultado de la segunda conversación: el hecho viejo archivado y uno nuevo.
    await expect(page.getByRole("textbox", { name: "Hecho", exact: true })).toHaveValue(/segmentación/);
  }).toPass({ timeout: 20_000 });

  const facts = page.locator("#ia");
  await expect(facts.getByText("Lo que la IA sabe de mí")).toBeVisible();
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
  await facts.getByText("Historial de esta materia").click();
  await expect(facts.getByText("Conversación cerrada").first()).toBeVisible();

  page.once("dialog", (d) => d.accept());
  await page.locator("li", { has: page.getByRole("textbox", { name: "Hecho", exact: true }) }).getByRole("button", { name: "Borrar" }).click();
  await expect(page.getByRole("textbox", { name: "Hecho", exact: true })).toHaveCount(0);
});
