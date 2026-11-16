import { expect, test } from "@playwright/test";
import { db, login, subjectFolder, world } from "./support";

/** Un solo chat (PR 4 de la simplificación): las direcciones viejas llevan al chat nuevo. */
test("las direcciones viejas del chat llevan al único chat y conservan el hilo abierto", async ({ page }) => {
  const w = await world();
  const ana = w.students[0];
  await login(page, ana);
  const folder = await subjectFolder(ana.id, w.course.id);
  const experience = await db.experience.create({ data: { courseId: w.course.id, studentId: ana.id, type: "AI_CONVERSATION", title: "Charla vieja" } });
  const conversation = await db.aIConversation.create({
    data: { experienceId: experience.id, courseId: w.course.id, studentId: ana.id, folderId: folder.id, title: "Charla vieja" },
  });
  await db.message.create({ data: { conversationId: conversation.id, role: "STUDENT", content: "Mensaje de una charla vieja" } });

  await page.goto(`/s/folders/${folder.id}/c/${conversation.id}?hilo=abc`);
  await expect(page).toHaveURL(new RegExp(`/s/c/${conversation.id}\\?hilo=abc$`));
  await expect(page.getByText("Mensaje de una charla vieja")).toBeVisible();

  await page.goto(`/s/courses/${w.course.id}/tutor/${conversation.id}`);
  await expect(page).toHaveURL(new RegExp(`/s/c/${conversation.id}$`));
  await expect(page.getByText("Mensaje de una charla vieja")).toBeVisible();
});

test("pensar una tarea con la IA abre el único chat, en la materia y con fuentes", async ({ page }) => {
  const w = await world();
  const ana = w.students[0];
  const activity = await db.activity.create({
    data: { courseId: w.course.id, title: "TP de hipótesis", kind: "PRACTICE", scenario: "Una pyme quiere validar una idea.", instructions: "Formulá una hipótesis.", prompts: [], status: "PUBLISHED", publishedAt: new Date() },
  });
  await login(page, ana);
  await page.goto(`/s/courses/${w.course.id}/activities/${activity.id}`);
  await page.getByRole("button", { name: "Pensarla con el tutor" }).click();
  await page.waitForURL(/\/s\/c\//);
  const conversation = await db.aIConversation.findFirstOrThrow({ where: { studentId: ana.id, activityId: activity.id }, include: { folder: true } });
  expect(conversation.folder).toMatchObject({ kind: "SUBJECT", courseId: w.course.id });
  await expect(page.getByRole("textbox", { name: "Tu pregunta" })).toBeVisible();
});

test("otra estudiante no abre una charla ajena en la dirección nueva", async ({ browser }) => {
  const w = await world({ students: 2 });
  const [ana, bruno] = w.students;
  const anaPage = await browser.newPage();
  await login(anaPage, ana);
  const folder = await subjectFolder(ana.id, w.course.id);
  const experience = await db.experience.create({ data: { courseId: w.course.id, studentId: ana.id, type: "AI_CONVERSATION", title: "Privada" } });
  const conversation = await db.aIConversation.create({
    data: { experienceId: experience.id, courseId: w.course.id, studentId: ana.id, folderId: folder.id, title: "Privada" },
  });
  const secret = `Secreto ${Date.now()}`;
  await db.message.create({ data: { conversationId: conversation.id, role: "STUDENT", content: secret } });

  const brunoPage = await browser.newPage();
  await login(brunoPage, bruno);
  for (const url of [`/s/c/${conversation.id}`, `/s/folders/${folder.id}/c/${conversation.id}`, `/s/courses/${w.course.id}/tutor/${conversation.id}`]) {
    await brunoPage.goto(url);
    await expect(brunoPage.getByText("No encontramos esta página")).toBeVisible();
    expect(await brunoPage.content()).not.toContain(secret);
  }
});
