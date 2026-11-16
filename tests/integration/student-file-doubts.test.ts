/**
 * La ficha cuenta las dudas con la misma regla que la vista macro (paso 4 del motor en docs/SPEC.md):
 * solo las confirmadas, o las no respondidas en 7 días con confianza alta. Requiere TEST_DATABASE_URL.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { factories } from "../support/factories";

const TEST_DB = process.env.TEST_DATABASE_URL;
const DAY = 24 * 60 * 60 * 1000;

describe.skipIf(!TEST_DB)("ficha: conteo de dudas (integración)", () => {
  let db: typeof import("@/server/db").db;
  let studentFile: typeof import("@/server/services/student-file");
  let f: ReturnType<typeof factories>;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    ({ db } = await import("@/server/db"));
    studentFile = await import("@/server/services/student-file");
    f = factories(db);
  });

  it("no cuenta dudas sin confirmar ni descartadas, y sí las confirmadas y las de alta confianza sin respuesta en 7 días", async () => {
    const teacher = await f.teacher();
    const courseId = (await f.course(teacher.id)).id;
    const ana = await f.student({ name: "Ana" });
    await db.enrollment.create({ data: { courseId, studentId: ana.id } });
    const folder = await db.folder.create({ data: { studentId: ana.id, courseId, kind: "SUBJECT", name: "Materia", createdBy: "SYSTEM" } });
    const pendiente = await f.topic(courseId, "Pendiente");
    const descartada = await f.topic(courseId, "Descartada");
    const confirmada = await f.topic(courseId, "Confirmada");
    const vieja = await f.topic(courseId, "Vieja sin respuesta");

    const { experience } = await f.conversation({ studentId: ana.id, folderId: folder.id, courseId });
    const base = { experienceId: experience.id, studentId: ana.id, courseId };
    await f.evidenceFrom({ ...base, topicId: pendiente.id, excerpt: "a", studentStatus: "PENDING" });
    await f.evidenceFrom({ ...base, topicId: descartada.id, excerpt: "b", studentStatus: "DISCARDED" });
    await f.evidenceFrom({ ...base, topicId: confirmada.id, excerpt: "c", studentStatus: "CONFIRMED", confidence: "MEDIUM" });
    await f.evidenceFrom({ ...base, topicId: vieja.id, excerpt: "d", studentStatus: "PENDING", at: new Date(Date.now() - 8 * DAY) });

    for (const viewer of [{ id: ana.id, role: "STUDENT" as const }, { id: teacher.id, role: "TEACHER" as const }]) {
      const file = await studentFile.loadStudentFile(viewer, ana.id, courseId);
      const doubts = Object.fromEntries(file.topics.map((t) => [t.title, t.doubts]));
      expect(doubts).toEqual({ Pendiente: 0, Descartada: 0, Confirmada: 1, "Vieja sin respuesta": 1 });
    }
  });
});
