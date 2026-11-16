import { expect, test, type Page } from "@playwright/test";
import { makePdf } from "./documents";
import { login, world } from "./support";

async function uploadMaterial(page: Page, courseId: string) {
  await page.goto(`/t/courses/${courseId}/material`);
  await page.waitForLoadState("networkidle");
  await page.setInputFiles("input[type=file]", {
    name: "programa.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(makePdf(["Unidad 2. Una hipotesis falsable define el resultado que la refutaria, con metrica, umbral y plazo."])),
  });
  await page.getByRole("button", { name: "Subir e indexar" }).click();
  await expect(page.getByText("programa.pdf quedó indexado")).toBeVisible();
}

/** Selecciona un texto dentro de un elemento, como lo haría el estudiante con el mouse. */
async function selectText(page: Page, containing: string) {
  await page.evaluate((needle) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const at = node.data.indexOf(needle);
      if (at >= 0) {
        const range = document.createRange();
        range.setStart(node, at);
        range.setEnd(node, at + needle.length);
        const sel = document.getSelection()!;
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
    }
    throw new Error(`No encontré «${needle}»`);
  }, containing);
}

test("pregunta sobre un fragmento seleccionado sin perder la conversación principal", async ({ browser }) => {
  const w = await world();
  const teacher = await browser.newPage();
  await login(teacher, w.teacher);
  await uploadMaterial(teacher, w.course.id);

  const page = await browser.newPage();
  await login(page, w.students[0]);
  await page.locator('a[href^="/s/folders/"]', { hasText: "Materia" }).first().click();
  await page.waitForURL("**/s/folders/**");
  await page.getByRole("button", { name: "Nueva conversación" }).click();
  await page.waitForURL("**/c/**");
  await page.waitForLoadState("networkidle");
  await page.fill("textarea[name=question]", "¿Qué hace falsable a una hipótesis?");
  await page.getByRole("button", { name: "Preguntar", exact: true }).click();
  await expect(page.getByText("Fuentes:")).toBeVisible();

  // El fragmento citado se puede ver debajo de la respuesta.
  await page.getByText("Ver el texto").click();
  await expect(page.locator("details p", { hasText: "define el resultado que la refutaria" })).toBeVisible();

  await selectText(page, "define el resultado que la refutaria");
  await page.getByRole("button", { name: "Preguntar sobre esto" }).click();
  await page.waitForURL(/hilo=/);
  await page.waitForLoadState("networkidle");

  const thread = page.getByRole("complementary", { name: "Pregunta sobre un pedazo de texto" });
  await expect(thread.locator("blockquote")).toContainText("define el resultado que la refutaria");
  await thread.locator("textarea[name=question]").fill("¿Me das un ejemplo de eso?");
  await thread.getByRole("button", { name: "Preguntar", exact: true }).click();
  await expect(thread.getByText("¿Me das un ejemplo de eso?")).toBeVisible();
  await expect(thread.getByText("Educai", { exact: true })).toBeVisible();

  // La conversación principal sigue con su pregunta y respuesta, sin los mensajes del hilo.
  const main = page.locator("ol").first();
  await expect(main.getByText("¿Qué hace falsable a una hipótesis?")).toBeVisible();
  await expect(main.getByText("¿Me das un ejemplo de eso?")).toHaveCount(0);

  await thread.getByRole("link", { name: "Cerrar", exact: true }).click();
  await expect(page.getByText("Preguntas sobre pedazos de texto (1)")).toBeVisible();
});
