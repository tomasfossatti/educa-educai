/**
 * Lista de inscriptos del docente: incluye a quien no dio consentimiento, sin sus datos (V6).
 * Requiere TEST_DATABASE_URL.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { factories } from "../support/factories";

const TEST_DB = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DB)("lista de inscriptos (integración)", () => {
  let db: typeof import("@/server/db").db;
  let roster: typeof import("@/server/services/roster");
  let guards: typeof import("@/server/auth/guards");
  let f: ReturnType<typeof factories>;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    ({ db } = await import("@/server/db"));
    roster = await import("@/server/services/roster");
    guards = await import("@/server/auth/guards");
    f = factories(db);
  });

  it("lista a todos los inscriptos activos y de quien no dio consentimiento muestra solo nombre y estado", async () => {
    const teacher = await f.teacher();
    const courseId = (await f.course(teacher.id)).id;
    const topic = await f.topic(courseId, "Segmentación");
    const ana = await f.student({ name: "Ana" });
    const beto = await f.student({ name: "Beto", consent: false });
    const quitada = await f.student({ name: "Carla" });
    for (const s of [ana, beto]) await db.enrollment.create({ data: { courseId, studentId: s.id } });
    await db.enrollment.create({ data: { courseId, studentId: quitada.id, status: "REMOVED" } });
    // Beto tiene evidencia anterior al retiro del consentimiento: no tiene que aparecer.
    for (const s of [ana, beto]) {
      const folder = await db.folder.create({ data: { studentId: s.id, courseId, kind: "SUBJECT", name: "Materia" } });
      const { experience } = await f.conversation({ studentId: s.id, folderId: folder.id, courseId });
      await f.evidenceFrom({ experienceId: experience.id, studentId: s.id, courseId, topicId: topic.id, excerpt: "duda" });
    }

    const rows = await roster.getCourseRoster({ id: teacher.id, role: "TEACHER" }, courseId);
    expect(rows.map((r) => r.name)).toEqual(["Ana", "Beto"]);
    const [rowAna, rowBeto] = rows;
    expect(rowAna.consent).toBe(true);
    expect(rowAna.stats?.evidenceCount).toBe(1);
    expect(rowBeto.consent).toBe(false);
    expect(rowBeto.stats).toBeNull();
  });

  it("solo la ve el docente de la cátedra", async () => {
    const teacher = await f.teacher();
    const courseId = (await f.course(teacher.id)).id;
    const other = await f.teacher();
    const ana = await f.student();
    await db.enrollment.create({ data: { courseId, studentId: ana.id } });
    await expect(roster.getCourseRoster({ id: other.id, role: "TEACHER" }, courseId)).rejects.toBeInstanceOf(guards.AccessDenied);
    await expect(roster.getCourseRoster({ id: ana.id, role: "STUDENT" }, courseId)).rejects.toBeInstanceOf(guards.AccessDenied);
  });
});
