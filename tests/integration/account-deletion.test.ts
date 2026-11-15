/** Borrado de la cuenta del estudiante: no queda nada que lo identifique. Requiere TEST_DATABASE_URL. */
import { beforeAll, describe, expect, it } from "vitest";
import { factories } from "../support/factories";

const TEST_DB = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DB)("borrado de la cuenta del estudiante (integración)", () => {
  let db: typeof import("@/server/db").db;
  let privacy: typeof import("@/server/services/privacy");
  let f: ReturnType<typeof factories>;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    ({ db } = await import("@/server/db"));
    privacy = await import("@/server/services/privacy");
    f = factories(db);
  });

  it("borra la cuenta, lo derivado, las métricas y la invitación; el costo de IA queda sin vínculo", async () => {
    const folders = await import("@/server/services/folders");
    const t = await f.teacher();
    const courseId = (await f.course(t.id)).id;
    const topicId = (await f.topic(courseId, "Tema")).id;
    const s = await f.student();
    await db.courseInvite.create({ data: { courseId, email: s.email, acceptedAt: new Date() } });
    await db.enrollment.create({ data: { courseId, studentId: s.id } });
    await folders.ensureStudentFolders(s.id);
    const folderId = (await db.folder.findFirstOrThrow({ where: { studentId: s.id, courseId } })).id;
    const { experience } = await f.conversation({ studentId: s.id, folderId, courseId });
    await f.evidenceFrom({ experienceId: experience.id, studentId: s.id, courseId, topicId, excerpt: "No entiendo" });
    await db.accessLog.create({ data: { viewerId: t.id, studentId: s.id, courseId, view: "STUDENT_FILE" } });
    await db.productEvent.create({ data: { name: "student.active_day", userId: s.id, studentId: s.id } });
    const usage = await db.aIUsageEvent.create({
      data: { studentId: s.id, courseId, operation: "folder.chat", provider: "anthropic", model: "claude-opus-5-5", estimatedCostUsd: 0.01, latencyMs: 1, success: true },
    });

    await privacy.deleteStudentAccount(s.id, s.email);

    expect(await db.user.count({ where: { id: s.id } })).toBe(0);
    expect(await db.studentProfile.count({ where: { userId: s.id } })).toBe(0);
    expect(await db.aIConversation.count({ where: { studentId: s.id } })).toBe(0);
    expect(await db.evidenceObject.count({ where: { studentId: s.id } })).toBe(0);
    expect(await db.folder.count({ where: { studentId: s.id } })).toBe(0);
    expect(await db.accessLog.count({ where: { studentId: s.id } })).toBe(0);
    expect(await db.productEvent.count({ where: { OR: [{ userId: s.id }, { studentId: s.id }] } })).toBe(0);
    expect(await db.courseInvite.count({ where: { email: s.email } })).toBe(0);
    expect((await db.aIUsageEvent.findUniqueOrThrow({ where: { id: usage.id } })).studentId).toBeNull();
  });
});
