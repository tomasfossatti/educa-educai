/** Quiz por tema y dominio. Requiere TEST_DATABASE_URL. */
import { beforeAll, describe, expect, it } from "vitest";
import { makePdf } from "../support/documents";
import { factories } from "../support/factories";

const TEST_DB = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DB)("quiz por tema y dominio (integración)", () => {
  let db: typeof import("@/server/db").db;
  let quiz: typeof import("@/server/services/quiz");
  let guards: typeof import("@/server/auth/guards");
  let ana: { id: string; role: "STUDENT" };
  let bruno: { id: string; role: "STUDENT" };
  let folderId: string;
  let projectId: string;
  let topicId: string;
  let emptyTopicId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    process.env.AI_PROVIDER = "scripted";
    ({ db } = await import("@/server/db"));
    quiz = await import("@/server/services/quiz");
    guards = await import("@/server/auth/guards");
    const folders = await import("@/server/services/folders");
    const material = await import("@/server/services/material");
    const f = factories(db);
    const t = await f.teacher();
    const courseId = (await f.course(t.id)).id;
    topicId = (await f.topic(courseId, "Hipótesis falsables")).id;
    emptyTopicId = (await f.topic(courseId, "Fotosíntesis")).id;
    await material.ingestMaterial({
      courseId,
      uploadedById: t.id,
      fileName: "programa.pdf",
      mimeType: "application/pdf",
      data: makePdf(["Unidad 2. Las hipotesis falsables definen el resultado que las refutaria."]),
    });
    for (const who of ["ana", "bruno"] as const) {
      const s = await f.student();
      await db.enrollment.create({ data: { courseId, studentId: s.id } });
      await folders.ensureStudentFolders(s.id);
      if (who === "ana") ana = { id: s.id, role: "STUDENT" };
      else bruno = { id: s.id, role: "STUDENT" };
    }
    folderId = (await db.folder.findFirstOrThrow({ where: { studentId: ana.id, kind: "SUBJECT" } })).id;
    projectId = (await db.folder.findFirstOrThrow({ where: { studentId: ana.id, kind: "PROJECT" } })).id;
  });

  it("genera un quiz con fuente y no expone la respuesta correcta antes de entregar", async () => {
    const created = await quiz.createQuiz(ana, folderId, topicId);
    const view = await quiz.getQuizForStudent(ana, created.id);
    expect(view.questions.length).toBeGreaterThanOrEqual(3);
    expect(view.questions[0].source).toEqual({ fileName: "programa.pdf", page: 1 });
    expect(JSON.stringify(view)).not.toMatch(/correctIndex|explanation/);
  });

  it("corrige en código, guarda el dominio con tope por pocos intentos y no se entrega dos veces", async () => {
    const q1 = await quiz.createQuiz(ana, folderId, topicId);
    const r1 = await quiz.submitQuiz(ana, q1.id, [0, 0, 0]);
    expect(r1).toMatchObject({ correct: 3, total: 3, mastery: 0.5 });
    await expect(quiz.submitQuiz(ana, q1.id, [0, 0, 0])).rejects.toThrow(/ya se entregó/);

    const q2 = await quiz.createQuiz(ana, folderId, topicId);
    const r2 = await quiz.submitQuiz(ana, q2.id, [0, 1, null]);
    // Intentos [1, 1/3] con pesos 0,95 y 1 → (0,95 + 0,333…)/1,95 ≈ 0,658 (debajo del tope de 0,8).
    expect(r2.mastery).toBeCloseTo((0.95 + 1 / 3) / 1.95, 6);
    const record = await db.masteryRecord.findUniqueOrThrow({ where: { studentId_curriculumItemId: { studentId: ana.id, curriculumItemId: topicId } } });
    expect(record.attempts).toBe(2);

    const after = await quiz.getQuizForStudent(ana, q2.id);
    expect(after.questions[1]).toMatchObject({ correctIndex: 0, chosen: 1 });
  });

  it("sin material sobre el tema no arma un quiz (no inventa)", async () => {
    await expect(quiz.createQuiz(ana, folderId, emptyTopicId)).rejects.toThrow(/No hay material/);
  });

  it("solo en la carpeta de una materia y solo el dueño", async () => {
    await expect(quiz.createQuiz(ana, projectId, topicId)).rejects.toThrow(/temas de una materia/);
    await expect(quiz.createQuiz(bruno, folderId, topicId)).rejects.toBeInstanceOf(guards.AccessDenied);
    const q = await quiz.createQuiz(ana, folderId, topicId);
    await expect(quiz.getQuizForStudent(bruno, q.id)).rejects.toBeInstanceOf(guards.AccessDenied);
    await expect(quiz.submitQuiz(bruno, q.id, [0, 0, 0])).rejects.toBeInstanceOf(guards.AccessDenied);
  });
});
