import { expect, test, type Page } from "@playwright/test";
import { db, login, world } from "./support";

/** Navegación del panel simple: solo Preguntar, Practicar, Mi avance y Mis datos. */
const DESTINATIONS = ["Preguntar", "Practicar", "Mi avance"];
const RETIRED = ["Inicio", "Asistente", "Materia", "Actividades", "Desarrollo", "Mi ficha", "Tu contexto", "Tus carpetas"];

async function navLinks(page: Page) {
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  await expect(nav).toHaveCount(1);
  return nav.getByRole("link");
}

test.describe("en la computadora (1280 px)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("la barra lateral tiene solo los tres destinos y Mis datos", async ({ page }) => {
    const w = await world();
    const student = w.students[0];
    await login(page, student);
    await page.goto("/s");

    const links = await navLinks(page);
    await expect(links).toHaveText([...DESTINATIONS, "Mis datos"]);
    await expect(page.getByRole("link", { name: "Preguntar" })).toHaveAttribute("aria-current", "page");
    for (const label of RETIRED) await expect(page.getByRole("link", { name: label, exact: true })).toHaveCount(0);

    // Las dos carpetas se siguen creando al entrar, aunque el estudiante no las vea.
    expect(await db.folder.count({ where: { studentId: student.id } })).toBe(2);

    // Cada destino tiene un objetivo táctil de al menos 44 px.
    for (const link of await links.all()) expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });

  test("Mis datos está en el menú de arriba a la derecha y desde ahí se suma otra materia", async ({ page }) => {
    const first = await world();
    const second = await world({ students: 0 });
    await login(page, first.students[0]);
    await page.goto("/s");

    await page.getByRole("button", { name: "Abrir menú de usuario" }).click();
    await page.getByRole("link", { name: "Mis datos" }).first().click();
    await expect(page).toHaveURL(/\/s\/mis-datos$/);
    await page.getByText("Unirme a otra materia").click();
    await page.getByLabel("Código").fill(second.course.joinCode!);
    await page.getByRole("button", { name: "Unirme" }).click();

    // Entra directo al chat de la materia nueva; la anterior queda en el selector.
    await expect(page).toHaveURL(/\/s$/);
    await expect(page.getByRole("main").getByRole("heading", { name: second.course.name })).toBeVisible();
    await page.getByLabel(`Elegir materia: ${second.course.name}`).click();
    await page.getByRole("button", { name: first.course.name }).click();
    await expect(page.getByRole("main").getByRole("heading", { name: first.course.name })).toBeVisible();
  });

  test("sin materias, la navegación es la misma y el inicio pide el código", async ({ page }) => {
    const w = await world();
    await db.enrollment.deleteMany({ where: { studentId: w.students[0].id } });
    await login(page, w.students[0]);
    await page.goto("/s");
    await expect(await navLinks(page)).toHaveText([...DESTINATIONS, "Mis datos"]);
    await expect(page.getByLabel("Código")).toBeVisible();
  });
});

test.describe("en el celular (375 px)", () => {
  test.use({ viewport: { width: 375, height: 740 } });

  test("los tres destinos van en una barra inferior y se marca el actual", async ({ page }) => {
    const w = await world();
    await login(page, w.students[0]);
    await page.goto("/s");

    const links = await navLinks(page);
    await expect(links).toHaveText(DESTINATIONS);
    const bar = (await page.getByRole("navigation", { name: "Navegación principal" }).boundingBox())!;
    expect(bar.y + bar.height).toBeGreaterThanOrEqual(740 - 1);
    for (const link of await links.all()) expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    // La página no se desborda a lo ancho.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

    await page.getByRole("link", { name: "Preguntar" }).focus();
    await expect(page.getByRole("link", { name: "Preguntar" })).toHaveAttribute("aria-current", "page");
    await page.getByRole("button", { name: "Abrir menú de usuario" }).click();
    await expect(page.getByRole("link", { name: "Mis datos" })).toBeVisible();
  });
});
