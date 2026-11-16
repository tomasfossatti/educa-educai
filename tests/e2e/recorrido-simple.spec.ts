import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { makePdf } from "./documents";
import { db, login, world, type Person } from "./support";

/**
 * Recorrido de punta a punta del panel simple del estudiante (PR 12 de la simplificación), en el
 * celular (375 px) y en la computadora (1280 px): registrarse con código, aceptar, preguntar en dos
 * toques como máximo, ver la cita, practicar un tema, ver el semáforo cambiar, confirmar una duda con
 * "Sí", abrir Mis datos, retirar el consentimiento y comprobar que el docente pierde acceso.
 *
 * Con CAPTURAS_DIR, guarda una captura de cada pantalla (las del informe de QA).
 */
const SHOTS = process.env.CAPTURAS_DIR;

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true });
}

async function uploadMaterial(teacher: Page, courseId: string) {
  await teacher.goto(`/t/courses/${courseId}/material`);
  await teacher.setInputFiles("input[type=file]", {
    name: "programa.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(makePdf(["Unidad 1. Segmentacion de clientes.", "Unidad 2. Las hipotesis falsables definen el resultado que las refutaria, con metrica y plazo."])),
  });
  await teacher.getByRole("button", { name: "Subir e indexar" }).click();
  await expect(teacher.getByText("programa.pdf quedó indexado")).toBeVisible();
}

for (const [label, viewport] of [
  ["375", { width: 375, height: 812 }],
  ["1280", { width: 1280, height: 800 }],
] as const) {
  test(`recorrido completo del estudiante a ${label} px`, async ({ browser }) => {
    test.setTimeout(120_000);
    const w = await world({ students: 0 });
    const teacherPage = await browser.newPage();
    await login(teacherPage, w.teacher);
    await uploadMaterial(teacherPage, w.course.id);

    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const n = (name: string) => `${name}-${label}`;

    // 1. Registrarse, aceptar (una pantalla, nada elegido) y sumarse con el código.
    const email = `e2e-recorrido-${randomBytes(4).toString("hex")}@test.educai`;
    const password = randomBytes(15).toString("base64url");
    await page.goto("/register");
    await page.fill("#name", "Lucía Recorrido");
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await page.waitForURL("**/s/onboarding**");
    await shot(page, n("01-consentimiento"));
    await page.getByRole("button", { name: "Acepto" }).click();
    await page.waitForURL(/\/s$/);
    await shot(page, n("02-codigo"));
    await page.getByLabel("Código").fill(w.course.joinCode!);
    await page.getByRole("button", { name: "Unirme" }).click();
    await expect(page.getByRole("textbox", { name: "Tu pregunta" })).toBeVisible();
    const student = await db.user.findUniqueOrThrow({ where: { email } });

    // 2. Del login a la primera pregunta enviada: como máximo 2 toques. La caja ya tiene el foco.
    await page.getByRole("button", { name: "Abrir menú de usuario" }).click();
    await page.getByRole("button", { name: "Salir" }).click();
    await page.waitForURL("**/login**");
    const person: Person = { id: student.id, email, password };
    await login(page, person);
    await expect(page).toHaveURL(/\/s$/);
    let taps = 0;
    const box = page.getByRole("textbox", { name: "Tu pregunta" });
    await expect(box).toBeFocused();
    await page.keyboard.type("¿Qué hace falsable a una hipótesis?");
    await page.getByRole("button", { name: "Preguntar", exact: true }).click();
    taps += 1;
    expect(taps).toBeLessThanOrEqual(2);

    // 3. La respuesta cita archivo y página.
    await expect(page.getByText("Fuentes:")).toBeVisible();
    await expect(page.getByText(/programa\.pdf, pág\. 2/).first()).toBeVisible();
    await shot(page, n("03-respuesta-con-cita"));

    // 4. Mi avance antes de practicar: gris.
    await page.getByRole("link", { name: "Mi avance" }).click();
    await expect(page.getByRole("button", { name: "Hipotesis falsables: Sin empezar" })).toBeVisible();
    await shot(page, n("04-avance-antes"));

    // 5. Practicar un tema: quiz, un solo resultado y "Seguir".
    await page.getByRole("link", { name: "Practicar" }).click();
    await shot(page, n("05-practicar"));
    await page.getByRole("button", { name: "Practicar: Hipotesis falsables" }).click();
    await page.waitForURL(/\/s\/practicar\/.+/);
    const questions = await page.locator("fieldset").count();
    for (let i = 0; i < questions; i++) await page.locator(`input[name=q${i}]`).first().check();
    await shot(page, n("06-quiz"));
    await page.getByRole("button", { name: "Entregar" }).click();
    await expect(page.getByRole("heading", { name: /Acertaste/ })).toBeVisible();
    await shot(page, n("07-resultado"));
    await page.getByRole("link", { name: "Seguir" }).click();

    // 6. El semáforo cambia: una práctica, en camino.
    await page.getByRole("link", { name: "Mi avance" }).click();
    await expect(page.getByRole("button", { name: "Hipotesis falsables: En camino" })).toBeVisible();
    await shot(page, n("08-avance-despues"));

    // 7. Una duda detectada en la charla (como la dejaría el motor) se confirma con "Sí".
    const conversation = await db.aIConversation.findFirstOrThrow({ where: { studentId: student.id } });
    const run = await db.interpretationRun.create({
      data: { courseId: w.course.id, studentId: student.id, experienceId: conversation.experienceId, source: "AI_CONVERSATION", status: "COMPLETED", promptVersion: "e2e", completedAt: new Date() },
    });
    const evidence = await db.evidenceObject.create({
      data: { runId: run.id, experienceId: conversation.experienceId, courseId: w.course.id, studentId: student.id, kind: "QUESTION", source: "AI_CONVERSATION", observation: "Pregunta", content: "¿Qué hace falsable a una hipótesis?", occurredAt: new Date(), provenance: { origin: "e2e" } },
    });
    const signal = await db.signal.create({
      data: { runId: run.id, evidenceId: evidence.id, courseId: w.course.id, studentId: student.id, curriculumItemId: w.topics[0].id, dimension: "COMPREHENSION", polarity: "DIFFICULTY", description: "Duda", confidence: "HIGH" },
    });
    await page.getByRole("link", { name: "Preguntar" }).first().click();
    await expect(page.getByText("Parece que te costó «Hipotesis falsables». ¿Es así?")).toBeVisible();
    await shot(page, n("09-duda"));
    await page.getByRole("button", { name: "Sí", exact: true }).click();
    await expect(page.getByText(/Parece que te costó/)).toHaveCount(0);
    expect((await db.signal.findUniqueOrThrow({ where: { id: signal.id } })).studentStatus).toBe("CONFIRMED");

    // 8. Mis datos: el docente veía su ficha; retira el consentimiento.
    await teacherPage.goto(`/t/courses/${w.course.id}/students/${student.id}`);
    await expect(teacherPage.getByText("Lucía Recorrido").first()).toBeVisible();
    await expect(teacherPage.getByText("no podés ver su ficha ni sus conversaciones")).toHaveCount(0);

    await page.getByRole("button", { name: "Abrir menú de usuario" }).click();
    await page.getByRole("link", { name: "Mis datos" }).first().click();
    await expect(page).toHaveURL(/\/s\/mis-datos$/);
    await shot(page, n("10-mis-datos"));
    await page.locator("#consentimiento summary").click();
    await page.getByRole("button", { name: "Retirar mi consentimiento" }).click();
    await expect(page.getByRole("button", { name: "Aceptar" })).toBeEnabled();
    await shot(page, n("11-consentimiento-retirado"));

    // 9. El docente pierde acceso.
    await teacherPage.reload();
    await expect(teacherPage.getByText("no podés ver su ficha ni sus conversaciones")).toBeVisible();
    await context.close();
  });
}
