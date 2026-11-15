/** Plazos de conservación: apagados por defecto, prueba sin cambios y borrado real. Requiere TEST_DATABASE_URL. */
import { beforeAll, describe, expect, it } from "vitest";
import { factories } from "../support/factories";

const TEST_DB = process.env.TEST_DATABASE_URL;
const DAY = 24 * 60 * 60 * 1000;

describe.skipIf(!TEST_DB)("plazos de conservación (integración)", () => {
  let db: typeof import("@/server/db").db;
  let retention: typeof import("@/server/services/retention");
  let f: ReturnType<typeof factories>;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    ({ db } = await import("@/server/db"));
    retention = await import("@/server/services/retention");
    f = factories(db);
  });

  /** Estudiante con una conversación vieja y una nueva, cada una con su evidencia, y un acceso viejo. */
  async function scenario(now: Date) {
    const folders = await import("@/server/services/folders");
    const t = await f.teacher();
    const courseId = (await f.course(t.id)).id;
    const topicId = (await f.topic(courseId, "Tema")).id;
    const s = await f.student();
    await db.enrollment.create({ data: { courseId, studentId: s.id } });
    await folders.ensureStudentFolders(s.id);
    const folderId = (await db.folder.findFirstOrThrow({ where: { studentId: s.id, courseId } })).id;
    const old = await f.conversation({ studentId: s.id, folderId, courseId, messages: [["STUDENT", "vieja"]] });
    await db.aIConversation.update({ where: { id: old.conversation.id }, data: { createdAt: new Date(now.getTime() - 400 * DAY), closedAt: new Date(now.getTime() - 400 * DAY) } });
    await f.evidenceFrom({ experienceId: old.experience.id, studentId: s.id, courseId, topicId, excerpt: "vieja" });
    const recent = await f.conversation({ studentId: s.id, folderId, courseId, messages: [["STUDENT", "nueva"]] });
    await f.evidenceFrom({ experienceId: recent.experience.id, studentId: s.id, courseId, topicId, excerpt: "nueva" });
    await db.accessLog.create({ data: { viewerId: t.id, studentId: s.id, courseId, view: "STUDENT_FILE", createdAt: new Date(now.getTime() - 400 * DAY) } });
    const usage = await db.aIUsageEvent.create({
      data: { studentId: s.id, actorUserId: s.id, courseId, operation: "folder.chat", provider: "anthropic", model: "claude-opus-5-5", estimatedCostUsd: 0.01, latencyMs: 1, success: true, createdAt: new Date(now.getTime() - 800 * DAY) },
    });
    return { studentId: s.id, old: old.conversation.id, recent: recent.conversation.id, usageId: usage.id };
  }

  it("sin variables configuradas, la política está apagada y no borra nada", async () => {
    for (const k of ["RETENTION_CONVERSATION_DAYS", "RETENTION_ACCESS_LOG_DAYS", "RETENTION_AI_USAGE_DAYS"]) delete process.env[k];
    expect(retention.retentionPolicy()).toEqual({ conversationDays: null, accessLogDays: null, aiUsageDays: null });
    process.env.RETENTION_CONVERSATION_DAYS = "7";
    expect(retention.retentionPolicy().conversationDays).toBeNull(); // menos de 30 días se ignora
    delete process.env.RETENTION_CONVERSATION_DAYS;
  });

  it("la prueba cuenta sin borrar, y la aplicación borra lo vencido con todo lo derivado", async () => {
    const now = new Date();
    const sc = await scenario(now);
    const policy = { conversationDays: 180, accessLogDays: 180, aiUsageDays: 730 };

    const dry = await retention.applyRetention(policy, { now, dryRun: true });
    expect(dry.conversations).toBeGreaterThanOrEqual(1);
    expect(await db.aIConversation.count({ where: { id: sc.old } })).toBe(1);

    await retention.applyRetention(policy, { now });
    expect(await db.aIConversation.count({ where: { id: sc.old } })).toBe(0);
    expect(await db.evidenceObject.count({ where: { studentId: sc.studentId, content: "vieja" } })).toBe(0);
    expect(await db.aIConversation.count({ where: { id: sc.recent } })).toBe(1);
    expect(await db.evidenceObject.count({ where: { studentId: sc.studentId, content: "nueva" } })).toBe(1);
    expect(await db.accessLog.count({ where: { studentId: sc.studentId } })).toBe(0);
    const usage = await db.aIUsageEvent.findUniqueOrThrow({ where: { id: sc.usageId } });
    expect(usage.studentId).toBeNull();
    expect(usage.actorUserId).toBeNull();
    expect(Number(usage.estimatedCostUsd)).toBeCloseTo(0.01);
  });
});
