import { expect, test } from "@playwright/test";
import { db, login, world } from "./support";

/** Gasto sintético de la semana: el proveedor guionado no tiene precio, así que se carga a mano. */
async function spend(studentId: string, courseId: string, usd: number) {
  await db.aIUsageEvent.create({
    data: { studentId, courseId, operation: "folder.chat", provider: "anthropic", model: "claude-opus-5-5", estimatedCostUsd: usd, latencyMs: 1, success: true },
  });
}

test("tope semanal de IA: aviso al 80% y chat en pausa al llegar al tope", async ({ page }) => {
  const w = await world();
  const student = w.students[0];
  await login(page, student);
  await page.locator('a[href^="/s/folders/"]', { hasText: "Materia" }).first().click();
  await page.waitForURL("**/s/folders/**");
  await page.getByRole("button", { name: "Nueva conversación" }).click();
  await page.waitForURL("**/c/**");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("cupo semanal de IA")).toHaveCount(0);

  // Tope por defecto: 2 USD por semana, aviso desde el 80%.
  await spend(student.id, w.course.id, 1.7);
  await page.reload();
  await expect(page.getByText("Usaste el 85% de tu cupo semanal de IA")).toBeVisible();

  await spend(student.id, w.course.id, 0.5);
  await page.reload();
  await expect(page.getByText("Llegaste al tope semanal de uso de la IA").first()).toBeVisible();

  await page.fill("textarea[name=question]", "¿Qué hace falsable a una hipótesis?");
  await page.getByRole("button", { name: "Preguntar", exact: true }).click();
  await expect(page.getByText("Llegaste al tope semanal de uso de la IA")).toHaveCount(2);
  await expect(page.getByText("Fuentes:")).toHaveCount(0);
});
