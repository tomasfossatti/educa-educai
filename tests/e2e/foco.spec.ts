import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { db } from "./support";

test("en el primer ingreso el estudiante elige de dónde salen los ejemplos", async ({ page }) => {
  const email = `e2e-foco-${randomBytes(4).toString("hex")}@test.educai`;
  await page.goto("/register");
  await page.fill("#name", "Estudiante Foco");
  await page.fill("#email", email);
  await page.fill("#password", randomBytes(15).toString("base64url"));
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.waitForURL("**/s/onboarding**");

  await page.locator('input[name="consent"][value="yes"]').check();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.fill("#career", "Kinesiología");
  await page.fill("#projectDescription", "Un centro de kinesiología deportiva.");
  // Sin elegir el foco no avanza.
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("¿De dónde querés que la IA saque los ejemplos?")).toBeVisible();
  // Elegir el trabajo sin haberlo escrito: el servidor lo rechaza al final.
  await page.locator('input[name="personalizationFocus"][value="WORK"]').check();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.fill("#goals", "Aprender a validar ideas.");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Empezar" }).click();
  await expect(page.getByText("Contanos qué hacés hoy para poder usarlo en los ejemplos.").first()).toBeVisible();
  await page.fill("#currentContext", "Analista de compras en una empresa petrolera.");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Empezar" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/s/onboarding"));

  const user = await db.user.findUniqueOrThrow({ where: { email }, include: { studentProfile: true } });
  expect(user.studentProfile?.personalizationFocus).toBe("WORK");

  // Se puede cambiar después desde Mis datos, en Mi perfil.
  await page.goto("/s/mis-datos#perfil");
  await page.locator('input[name="personalizationFocus"][value="PROJECT"]').check();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Contexto actualizado.")).toBeVisible();
  expect((await db.studentProfile.findUniqueOrThrow({ where: { userId: user.id } })).personalizationFocus).toBe("PROJECT");
});
