/**
 * V6 y V11 en las vistas del docente heredadas de educa-educai (detalle de evidencia y de inferencia,
 * cola de atención, insights por tema y resumen de la clase): sin consentimiento activo, el docente
 * no ve evidencia, mensajes ni conclusiones del estudiante. Datos sintéticos. Requiere TEST_DATABASE_URL.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { factories } from "../support/factories";

const TEST_DB = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DB)("V6 y V11 en las vistas del docente", () => {
  let db: typeof import("@/server/db").db;
  let development: typeof import("@/server/services/development");
  let attention: typeof import("@/server/services/attention");
  let consent: typeof import("@/server/services/consent");
  let studentFile: typeof import("@/server/services/student-file");
  let guards: typeof import("@/server/auth/guards");
  let teacher: { id: string; role: "TEACHER" };
  let otherTeacher: { id: string; role: "TEACHER" };
  let f: ReturnType<typeof factories>;
  let courseId: string;
  let topicId: string;

  /** Estudiante inscripto con una conversación analizada: evidencia, señal y una conclusión activa. */
  async function analyzedStudent(name: string) {
    const folders = await import("@/server/services/folders");
    const s = await f.student({ name });
    await db.enrollment.create({ data: { courseId, studentId: s.id } });
    await folders.ensureStudentFolders(s.id);
    const folderId = (await db.folder.findFirstOrThrow({ where: { studentId: s.id, courseId } })).id;
    const { experience, conversation } = await f.conversation({
      studentId: s.id,
      folderId,
      courseId,
      messages: [["STUDENT", `Mensaje privado de ${name}: no entiendo qué hace falsable a una hipótesis`]],
    });
    const message = await db.message.findFirstOrThrow({ where: { conversationId: conversation.id } });
    const { run, evidence, signal } = await f.evidenceFrom({ experienceId: experience.id, studentId: s.id, courseId, topicId, excerpt: `No entiendo (${name})` });
    await db.evidenceObject.update({ where: { id: evidence.id }, data: { provenance: { origin: "test", messageIds: [message.id] } } });
    const inference = await db.inference.create({
      data: {
        courseId,
        studentId: s.id,
        runId: run.id,
        statement: `${name} tiene dificultades con hipótesis falsables`,
        studentStatement: "Te cuesta definir qué refutaría tu hipótesis",
        dimension: "COMPREHENSION",
        polarity: "DIFFICULTY",
        curriculumItemId: topicId,
        supportStatus: "CONSISTENT",
        proposedSupportStatus: "CONSISTENT",
        supportRationale: "Evidencia de prueba",
        priority: "HIGH",
        supports: { create: [{ evidenceId: evidence.id, signalId: signal.id, relation: "SUPPORTS" }] },
      },
    });
    return { id: s.id, name, evidenceId: evidence.id, inferenceId: inference.id };
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    process.env.AI_PROVIDER = "scripted";
    ({ db } = await import("@/server/db"));
    development = await import("@/server/services/development");
    attention = await import("@/server/services/attention");
    consent = await import("@/server/services/consent");
    studentFile = await import("@/server/services/student-file");
    guards = await import("@/server/auth/guards");
    f = factories(db);
    const t = await f.teacher();
    teacher = { id: t.id, role: "TEACHER" };
    otherTeacher = { id: (await f.teacher()).id, role: "TEACHER" };
    courseId = (await f.course(t.id)).id;
    topicId = (await f.topic(courseId, "Hipótesis falsables")).id;
  });

  it("con consentimiento, el docente ve la evidencia, los mensajes de origen y la conclusión", async () => {
    const ana = await analyzedStudent("Ana");
    const evidence = await development.getEvidenceDetail(ana.evidenceId, courseId, "teacher");
    expect(evidence?.sourceMessages.map((m) => m.content).join(" ")).toContain("Mensaje privado de Ana");
    expect(await development.getInferenceDetail(ana.inferenceId, courseId, "teacher")).not.toBeNull();
    const queue = await attention.getAttentionQueue(courseId);
    expect(queue.some((item) => item.students.some((s) => s.id === ana.id && item.kind !== "NO_EVIDENCE"))).toBe(true);
  });

  it("V11: al retirar el consentimiento, el docente deja de ver evidencia, mensajes y conclusiones", async () => {
    const bruno = await analyzedStudent("Bruno");
    await consent.setAnalysisConsent(bruno.id, false);

    expect(await development.getEvidenceDetail(bruno.evidenceId, courseId, "teacher")).toBeNull();
    expect(await development.getInferenceDetail(bruno.inferenceId, courseId, "teacher")).toBeNull();

    const queue = await attention.getAttentionQueue(courseId);
    expect(queue.flatMap((item) => item.students.map((s) => s.id))).not.toContain(bruno.id);

    const overview = await attention.getCourseOverview(courseId);
    expect(JSON.stringify(overview)).not.toContain(bruno.id);

    const insightKeys = queue.filter((i) => i.key.startsWith("gap:") || i.key.startsWith("pattern:")).map((i) => i.key);
    for (const key of insightKeys) {
      const insight = await attention.getCourseInsight(courseId, key);
      expect(insight?.studentIds ?? []).not.toContain(bruno.id);
      expect(JSON.stringify(insight?.inferences ?? [])).not.toContain(bruno.id);
    }
  });

  it("el estudiante sigue viendo lo suyo después de retirar el consentimiento", async () => {
    const carla = await analyzedStudent("Carla");
    await consent.setAnalysisConsent(carla.id, false);
    const evidence = await development.getEvidenceDetail(carla.evidenceId, courseId, "student", carla.id);
    expect(evidence?.sourceMessages.map((m) => m.content).join(" ")).toContain("Mensaje privado de Carla");
    expect(await development.getInferenceDetail(carla.inferenceId, courseId, "student", carla.id)).not.toBeNull();
  });

  it("V2 y V9: abrir una evidencia o una conclusión queda registrado y el estudiante lo ve", async () => {
    const dario = await analyzedStudent("Dario");
    expect(await studentFile.openEvidenceAsTeacher(teacher, dario.evidenceId, courseId)).not.toBeNull();
    expect(await studentFile.openInferenceAsTeacher(teacher, dario.inferenceId, courseId)).not.toBeNull();
    const logs = await db.accessLog.findMany({ where: { studentId: dario.id, viewerId: teacher.id } });
    expect(logs.map((l) => l.view)).toEqual(["EVIDENCE", "EVIDENCE"]);
    const access = await import("@/server/services/access-log");
    expect((await access.listAccessToMe({ id: dario.id, role: "STUDENT" })).length).toBe(2);
  });

  it("V3 y V11: otro docente no abre la evidencia, y sin consentimiento no se abre ni se registra", async () => {
    const eva = await analyzedStudent("Eva");
    await expect(studentFile.openEvidenceAsTeacher(otherTeacher, eva.evidenceId, courseId)).rejects.toBeInstanceOf(guards.AccessDenied);
    await consent.setAnalysisConsent(eva.id, false);
    expect(await studentFile.openEvidenceAsTeacher(teacher, eva.evidenceId, courseId)).toBeNull();
    expect(await studentFile.openInferenceAsTeacher(teacher, eva.inferenceId, courseId)).toBeNull();
    expect(await db.accessLog.count({ where: { studentId: eva.id } })).toBe(0);
  });
});
