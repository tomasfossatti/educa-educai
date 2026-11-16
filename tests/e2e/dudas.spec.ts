import { expect, test } from "@playwright/test";
import { db, login, subjectFolder, world } from "./support";

/** Una charla terminada con una duda detectada sobre un tema, como la dejaría el motor. */
async function doubtFrom(opts: { studentId: string; courseId: string; folderId: string; topicId: string; excerpt: string }) {
  const experience = await db.experience.create({ data: { courseId: opts.courseId, studentId: opts.studentId, type: "AI_CONVERSATION", title: "Charla" } });
  const conversation = await db.aIConversation.create({
    data: { experienceId: experience.id, courseId: opts.courseId, studentId: opts.studentId, folderId: opts.folderId, title: "Charla", status: "CLOSED", closedAt: new Date() },
  });
  const run = await db.interpretationRun.create({
    data: { courseId: opts.courseId, studentId: opts.studentId, experienceId: experience.id, source: "AI_CONVERSATION", status: "COMPLETED", promptVersion: "e2e", completedAt: new Date() },
  });
  const evidence = await db.evidenceObject.create({
    data: { runId: run.id, experienceId: experience.id, courseId: opts.courseId, studentId: opts.studentId, kind: "QUESTION", source: "AI_CONVERSATION", observation: "Pregunta", content: opts.excerpt, occurredAt: new Date(), provenance: { origin: "e2e" } },
  });
  const signal = await db.signal.create({
    data: { runId: run.id, evidenceId: evidence.id, courseId: opts.courseId, studentId: opts.studentId, curriculumItemId: opts.topicId, dimension: "COMPREHENSION", polarity: "DIFFICULTY", description: "Duda", confidence: "HIGH" },
  });
  return { conversation, signal };
}

test("las dudas detectadas se confirman en el chat con Sí y No", async ({ page }) => {
  const w = await world();
  const ana = w.students[0];
  await login(page, ana);
  const folder = await subjectFolder(ana.id, w.course.id);
  const first = await doubtFrom({ studentId: ana.id, courseId: w.course.id, folderId: folder.id, topicId: w.topics[0].id, excerpt: "No entiendo cómo refutar una hipótesis" });
  const second = await doubtFrom({ studentId: ana.id, courseId: w.course.id, folderId: folder.id, topicId: w.topics[1].id, excerpt: "¿Segmentar por edad alcanza?" });

  await page.goto("/s");
  const card = page.locator(`[data-doubt="${first.signal.id}"]`);
  await expect(card.getByText("Parece que te costó «Hipotesis falsables». ¿Es así?")).toBeVisible();
  // El fragmento que la respalda queda detrás de "Ver más".
  await expect(card.getByText("No entiendo cómo refutar una hipótesis")).toBeHidden();
  await card.getByText("Ver más").click();
  await expect(card.getByText("No entiendo cómo refutar una hipótesis")).toBeVisible();

  await card.getByRole("button", { name: "Sí", exact: true }).click();
  await expect(card).toHaveCount(0);
  expect((await db.signal.findUniqueOrThrow({ where: { id: first.signal.id } })).studentStatus).toBe("CONFIRMED");

  // La otra también aparece dentro de su charla.
  await page.goto(`/s/c/${second.conversation.id}`);
  const other = page.locator(`[data-doubt="${second.signal.id}"]`);
  await expect(other.getByText("Parece que te costó «Segmentacion de mercado». ¿Es así?")).toBeVisible();
  await other.getByRole("button", { name: "No", exact: true }).click();
  await expect(other).toHaveCount(0);
  expect((await db.signal.findUniqueOrThrow({ where: { id: second.signal.id } })).studentStatus).toBe("DISCARDED");

  await page.goto("/s");
  await expect(page.getByText(/Parece que te costó/)).toHaveCount(0);
});

test("otra estudiante no ve ni responde dudas ajenas", async ({ browser }) => {
  const w = await world({ students: 2 });
  const [ana, bruno] = w.students;
  const anaPage = await browser.newPage();
  await login(anaPage, ana);
  const folder = await subjectFolder(ana.id, w.course.id);
  const { signal } = await doubtFrom({ studentId: ana.id, courseId: w.course.id, folderId: folder.id, topicId: w.topics[0].id, excerpt: "Secreto de Ana" });

  const brunoPage = await browser.newPage();
  await login(brunoPage, bruno);
  await brunoPage.goto("/s");
  await expect(brunoPage.getByText(/Parece que te costó/)).toHaveCount(0);
  expect(await brunoPage.content()).not.toContain("Secreto de Ana");
  expect((await db.signal.findUniqueOrThrow({ where: { id: signal.id } })).studentStatus).toBe("PENDING");
});
