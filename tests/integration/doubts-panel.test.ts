/**
 * Dudas en el chat (PR 9 de la simplificación): la lista de pendientes es solo del dueño, solo de la
 * materia elegida, y responder no cambia la regla de los 7 días. Requiere TEST_DATABASE_URL.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { factories } from "../support/factories";

const TEST_DB = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DB)("dudas pendientes en el chat (integración)", () => {
  let db: typeof import("@/server/db").db;
  let doubts: typeof import("@/server/services/doubts");
  let rule: typeof import("@/domain/doubts");
  let ana: { id: string; role: "STUDENT" };
  let bruno: { id: string; role: "STUDENT" };
  let anaFolder: string;
  let anaProject: string;
  let pendingId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    ({ db } = await import("@/server/db"));
    doubts = await import("@/server/services/doubts");
    rule = await import("@/domain/doubts");
    const folders = await import("@/server/services/folders");
    const f = factories(db);
    const t = await f.teacher();
    const courseId = (await f.course(t.id)).id;
    const topic = await f.topic(courseId, "Costos hundidos");
    for (const who of ["ana", "bruno"] as const) {
      const s = await f.student({ consent: true });
      await db.enrollment.create({ data: { courseId, studentId: s.id } });
      await folders.ensureStudentFolders(s.id);
      if (who === "ana") ana = { id: s.id, role: "STUDENT" };
      else bruno = { id: s.id, role: "STUDENT" };
    }
    anaFolder = (await db.folder.findFirstOrThrow({ where: { studentId: ana.id, kind: "SUBJECT" } })).id;
    anaProject = (await db.folder.findFirstOrThrow({ where: { studentId: ana.id, kind: "PROJECT" } })).id;
    const { experience } = await f.conversation({ studentId: ana.id, folderId: anaFolder, courseId });
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    pendingId = (await f.evidenceFrom({ experienceId: experience.id, studentId: ana.id, courseId, topicId: topic.id, excerpt: "No sé qué es", at: old })).signal.id;
    await f.evidenceFrom({ experienceId: experience.id, studentId: ana.id, courseId, topicId: topic.id, excerpt: "Ya lo confirmé", studentStatus: "CONFIRMED" });
  });

  it("lista solo las pendientes de la materia elegida de la dueña", async () => {
    const list = await doubts.listPendingDoubts(ana, anaFolder);
    expect(list.map((d) => d.id)).toEqual([pendingId]);
    expect(list[0].curriculumItem?.title).toBe("Costos hundidos");
    expect(await doubts.listPendingDoubts(ana, anaProject)).toEqual([]);
  });

  it("otra estudiante no puede pedir las dudas de una carpeta ajena", async () => {
    await expect(doubts.listPendingDoubts(bruno, anaFolder)).rejects.toThrow();
  });

  it("la regla de 7 días no cambia: una pendiente vieja de confianza alta ya cuenta para el docente", async () => {
    const signal = await db.signal.findUniqueOrThrow({ where: { id: pendingId } });
    expect(rule.countsForTeacher(signal)).toBe(true);
    await doubts.respondToSignal(ana, pendingId, "DISCARDED");
    expect(rule.countsForTeacher(await db.signal.findUniqueOrThrow({ where: { id: pendingId } }))).toBe(false);
  });

  it("el historial muestra todas las respuestas de la dueña", async () => {
    const history = await doubts.listMyDoubts(ana);
    expect(history.map((d) => d.studentStatus).sort()).toEqual(["CONFIRMED", "DISCARDED"]);
    expect(await doubts.listMyDoubts(bruno)).toEqual([]);
  });
});
