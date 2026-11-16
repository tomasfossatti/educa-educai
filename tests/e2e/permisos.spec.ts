import { expect, test, type Page } from "@playwright/test";
import { db, login, world } from "./support";

/**
 * Intentos de acceso cambiando ids en la URL (V3, V4, V8): cada uno tiene que terminar en la
 * página de "no encontramos", sin mostrar nada del otro estudiante ni de la otra cátedra.
 */
const NOT_FOUND = "No encontramos esta página";

/**
 * El código HTTP no alcanza como prueba: cuando la página ya empezó a transmitirse, Next responde
 * 200 con la pantalla de "no encontrada". Lo que importa es qué ve la persona.
 */
async function expectDenied(page: Page, url: string, secret: string) {
  const response = await page.goto(url);
  await page.waitForLoadState("networkidle");
  const html = await page.content();
  expect(html.includes(secret), `${url} muestra datos ajenos`).toBe(false);
  await expect(page.getByText(NOT_FOUND), url).toBeVisible();
  expect([200, 404], url).toContain(response?.status());
}

test("ni otro estudiante ni el docente de otra cátedra abren datos ajenos cambiando la URL", async ({ browser }) => {
  const a = await world({ students: 1 });
  const b = await world({ students: 1 });
  const ana = a.students[0];
  const secret = `Mensaje privado ${Date.now()}`;

  // Ana conversa en su carpeta de la materia A.
  const anaPage = await browser.newPage();
  await login(anaPage, ana);
  await anaPage.locator('a[href^="/s/folders/"]', { hasText: "Materia" }).first().click();
  await anaPage.waitForURL("**/s/folders/**");
  const folderUrl = new URL(anaPage.url()).pathname;
  await anaPage.getByRole("button", { name: "Nueva conversación" }).click();
  await anaPage.waitForURL("**/c/**");
  await anaPage.waitForLoadState("networkidle");
  await anaPage.fill("textarea[name=question]", secret);
  await anaPage.getByRole("button", { name: "Enviar" }).click();
  await expect(anaPage.getByText(secret)).toBeVisible();
  const conversationUrl = new URL(anaPage.url()).pathname;

  // Evidencia derivada de esa conversación, como la dejaría el motor.
  const conversation = await db.aIConversation.findFirstOrThrow({ where: { studentId: ana.id } });
  const run = await db.interpretationRun.create({
    data: { courseId: a.course.id, studentId: ana.id, experienceId: conversation.experienceId, source: "AI_CONVERSATION", status: "COMPLETED", promptVersion: "e2e", completedAt: new Date() },
  });
  const evidence = await db.evidenceObject.create({
    data: {
      runId: run.id,
      experienceId: conversation.experienceId,
      courseId: a.course.id,
      studentId: ana.id,
      kind: "QUESTION",
      source: "AI_CONVERSATION",
      observation: "Pregunta",
      content: secret,
      occurredAt: new Date(),
      provenance: { origin: "e2e" },
    },
  });

  // V8: otro estudiante no ve la carpeta ni la conversación de Ana.
  const bruno = await browser.newPage();
  await login(bruno, b.students[0]);
  await expectDenied(bruno, folderUrl, secret);
  await expectDenied(bruno, conversationUrl, secret);
  await expectDenied(bruno, `/s/courses/${a.course.id}/ficha`, secret);

  // V3 y V4: el docente de la cátedra B no abre la cátedra A ni a Ana desde su cátedra.
  const teacherB = await browser.newPage();
  await login(teacherB, b.teacher);
  await expectDenied(teacherB, `/t/courses/${a.course.id}`, secret);
  await expectDenied(teacherB, `/t/courses/${a.course.id}/evidence/${evidence.id}`, secret);
  await expectDenied(teacherB, `/t/courses/${b.course.id}/students/${ana.id}`, secret);
  await expectDenied(teacherB, `/t/courses/${b.course.id}/evidence/${evidence.id}`, secret);

  // Ninguno de esos intentos dejó un acceso registrado sobre Ana.
  expect(await db.accessLog.count({ where: { studentId: ana.id } })).toBe(0);

  // El docente de A sí la ve, y el acceso queda registrado (V2).
  const teacherA = await browser.newPage();
  await login(teacherA, a.teacher);
  await teacherA.goto(`/t/courses/${a.course.id}/evidence/${evidence.id}`);
  await expect(teacherA.getByText(secret).first()).toBeVisible();
  expect(await db.accessLog.count({ where: { studentId: ana.id, viewerId: a.teacher.id, view: "EVIDENCE" } })).toBe(1);
});

test("sin consentimiento, la ficha no muestra ni cuántas conversaciones tuvo el estudiante (V6)", async ({ browser }) => {
  const { teacher, course, students } = await world({ students: 1 });
  const beto = students[0];
  await db.studentProfile.update({ where: { userId: beto.id }, data: { consentAnalysisAt: null, consentVersion: null } });
  const folder = await db.folder.create({ data: { studentId: beto.id, courseId: course.id, kind: "SUBJECT", name: "Materia" } });
  const experience = await db.experience.create({ data: { courseId: course.id, studentId: beto.id, type: "AI_CONVERSATION", title: "Charla" } });
  await db.aIConversation.create({
    data: { experienceId: experience.id, courseId: course.id, studentId: beto.id, folderId: folder.id, title: "Charla", status: "CLOSED", closedAt: new Date() },
  });

  const page = await browser.newPage();
  await login(page, teacher);
  await page.goto(`/t/courses/${course.id}/students/${beto.id}`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("no podés ver su ficha ni sus conversaciones")).toBeVisible();
  await expect(page.getByText(/conversaci(ón|ones) con el tutor/)).toHaveCount(0);
});
