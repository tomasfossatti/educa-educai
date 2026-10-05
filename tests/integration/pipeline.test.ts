/**
 * Integración del Interpretation Engine con base de datos real y el ScriptedProvider.
 * Requiere TEST_DATABASE_URL apuntando a una base PostgreSQL de prueba (se vacía).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const TEST_DB = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DB)("Interpretation Engine (integración)", () => {
  // Importes diferidos: DATABASE_URL debe apuntar a la base de test antes de crear PrismaClient.
  let db: typeof import("@/server/db").db;
  let runInterpretation: typeof import("@/server/engine/pipeline").runInterpretation;
  let deleteExperienceCascade: typeof import("@/server/services/privacy").deleteExperienceCascade;
  let getAttentionQueue: typeof import("@/server/services/attention").getAttentionQueue;
  let computeMetrics: typeof import("@/server/services/metrics").computeMetrics;

  const ids = {} as {
    teacher: string;
    student: string;
    course: string;
    c4: string;
    c1: string;
    r1: string;
    activity: string;
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    process.env.AI_PROVIDER = "scripted";
    ({ db } = await import("@/server/db"));
    ({ runInterpretation } = await import("@/server/engine/pipeline"));
    ({ deleteExperienceCascade } = await import("@/server/services/privacy"));
    ({ getAttentionQueue } = await import("@/server/services/attention"));
    ({ computeMetrics } = await import("@/server/services/metrics"));

    const tables = await db.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);

    const institution = await db.institution.create({ data: { name: "Test" } });
    const teacher = await db.user.create({
      data: { email: "t@test.dev", name: "Docente", passwordHash: "x", role: "TEACHER", teacherProfile: { create: { institutionId: institution.id } } },
    });
    const student = await db.user.create({
      data: {
        email: "s@test.dev",
        name: "Estudiante",
        passwordHash: "x",
        role: "STUDENT",
        studentProfile: {
          create: {
            declaredCurrentContext: "Trabajo en gastronomía",
            declaredGoals: "Emprender",
            declaredDifficulties: "Me cuestan los datos",
            consentAnalysisAt: new Date(),
            onboardingCompletedAt: new Date(),
          },
        },
      },
    });
    const course = await db.course.create({
      data: { institutionId: institution.id, teacherId: teacher.id, name: "Estrategia", joinCode: "TEST01", curriculumStatus: "CONFIGURED" },
    });
    await db.enrollment.create({ data: { courseId: course.id, studentId: student.id } });
    const c1 = await db.curriculumItem.create({ data: { courseId: course.id, kind: "CONCEPT", title: "Segmentación", origin: "TEACHER", status: "ACCEPTED", position: 0 } });
    const c4 = await db.curriculumItem.create({ data: { courseId: course.id, kind: "CONCEPT", title: "Hipótesis falsables", origin: "TEACHER", status: "ACCEPTED", position: 1 } });
    const r1 = await db.curriculumItem.create({ data: { courseId: course.id, kind: "CRITERION", title: "Hipótesis con métrica, umbral y plazo", origin: "TEACHER", status: "ACCEPTED", position: 2 } });
    const activity = await db.activity.create({
      data: {
        courseId: course.id,
        title: "Challenge",
        kind: "BASELINE",
        scenario: "Lanzar un servicio de viandas por suscripción en una ciudad mediana.",
        instructions: "Respondé justificando.",
        prompts: [
          { key: "p1", label: "Formulá una hipótesis", help: "" },
          { key: "p2", label: "¿Qué mirarías?", help: "" },
        ],
        status: "PUBLISHED",
        publishedAt: new Date(),
        curriculumLinks: { create: [{ curriculumItemId: c4.id }, { curriculumItemId: r1.id }] },
      },
    });
    Object.assign(ids, { teacher: teacher.id, student: student.id, course: course.id, c1: c1.id, c4: c4.id, r1: r1.id, activity: activity.id });
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  async function conversationRun(messages: [role: "STUDENT" | "TUTOR", content: string][], daysAgo = 0) {
    const start = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const experience = await db.experience.create({
      data: { courseId: ids.course, studentId: ids.student, type: "AI_CONVERSATION", title: "Sesión", startedAt: start },
    });
    const conversation = await db.aIConversation.create({
      data: { experienceId: experience.id, courseId: ids.course, studentId: ids.student, title: "Sesión", status: "CLOSED", createdAt: start },
    });
    for (const [i, [role, content]] of messages.entries()) {
      await db.message.create({ data: { conversationId: conversation.id, role, content, createdAt: new Date(start.getTime() + i * 60_000) } });
    }
    const run = await db.interpretationRun.create({
      data: { courseId: ids.course, studentId: ids.student, experienceId: experience.id, source: "AI_CONVERSATION", promptVersion: "test" },
    });
    return { experience, run };
  }

  it("una conversación muy breve queda como evidencia insuficiente, sin llamar a la IA", async () => {
    const { run } = await conversationRun([["STUDENT", "Hola"]]);
    await runInterpretation(run.id);
    const after = await db.interpretationRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(after.status).toBe("INSUFFICIENT");
    expect(after.statusNote).toMatch(/breve/);
    expect(await db.aIUsageEvent.count({ where: { runId: run.id } })).toBe(0);
  });

  it("conversación → evidencia literal, señales, inferencia trazable, feedback, snapshot y costo", async () => {
    const studentText =
      "Creo que una hipótesis falsable define qué resultado la haría falsa, por ejemplo que al menos 40 de 200 oficinistas se suscriban en dos semanas, y si son menos de 20 la descarto.";
    const { run, experience } = await conversationRun([
      ["STUDENT", "No entiendo bien qué es una hipótesis falsable en un negocio de viandas."],
      ["TUTOR", "¿Cómo sabrías si tu idea resultó falsa?"],
      ["STUDENT", studentText],
    ]);
    await runInterpretation(run.id);

    const after = await db.interpretationRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(after.status).toBe("COMPLETED");
    expect((after.steps as { step: string }[]).map((s) => s.step)).toEqual(
      expect.arrayContaining(["observe", "signals", "history", "infer", "feedback", "persist", "snapshot"]),
    );

    const evidence = await db.evidenceObject.findMany({ where: { experienceId: experience.id }, include: { signals: true } });
    expect(evidence.length).toBeGreaterThan(0);
    for (const e of evidence) {
      const provenance = e.provenance as { excerptVerified: boolean; messageIds: string[]; runId: string };
      expect(provenance.excerptVerified).toBe(true);
      expect(provenance.runId).toBe(run.id);
      expect(provenance.messageIds.length).toBeGreaterThan(0);
      expect(e.assistanceSource).toBe("OBSERVED");
    }
    expect(evidence.some((e) => studentText.startsWith(e.content))).toBe(true);
    expect(evidence.flatMap((e) => e.signals).every((s) => s.curriculumItemId === ids.c1)).toBe(true);

    const inferences = await db.inference.findMany({ where: { runId: run.id }, include: { supports: true } });
    expect(inferences).toHaveLength(1);
    expect(inferences[0].supports.length).toBeGreaterThan(0);
    // Toda inferencia apunta a Evidence Objects reales.
    const evidenceIds = new Set(evidence.map((e) => e.id));
    expect(inferences[0].supports.every((s) => evidenceIds.has(s.evidenceId))).toBe(true);
    expect(["PARTIAL", "INSUFFICIENT"]).toContain(inferences[0].supportStatus);

    const feedback = await db.feedback.findUniqueOrThrow({ where: { runId: run.id } });
    expect(feedback.inferenceIds).toEqual([inferences[0].id]);
    expect(await db.suggestedAction.count({ where: { runId: run.id, audience: "STUDENT" } })).toBeGreaterThan(0);

    const snapshot = await db.developmentSnapshot.findFirstOrThrow({ where: { runId: run.id }, include: { dimensions: true } });
    expect(snapshot.dimensions).toHaveLength(6);

    const usage = await db.aIUsageEvent.findMany({ where: { runId: run.id } });
    expect(usage.map((u) => u.operation).sort()).toEqual(["interpret.feedback", "interpret.infer", "interpret.observe", "interpret.signals"]);
    expect(usage.every((u) => u.studentId === ids.student && u.success)).toBe(true);
  });

  it("entrega → evaluación contra criterios y contradicción con el historial", async () => {
    // Respuestas breves → el proveedor de prueba marca dificultad en aplicación de C1 (primer ítem).
    const experience = await db.experience.create({
      data: { courseId: ids.course, studentId: ids.student, type: "CHALLENGE", title: "Challenge", activityId: ids.activity },
    });
    const submission = await db.submission.create({
      data: {
        activityId: ids.activity,
        studentId: ids.student,
        experienceId: experience.id,
        answers: { p1: "A la gente le van a encantar las viandas.", p2: "Las ventas que tengamos en total." },
        declaredAssistance: "EXTERNAL_AI_PARTIAL",
        status: "SUBMITTED",
        submittedAt: new Date(),
      },
    });
    const run = await db.interpretationRun.create({
      data: { courseId: ids.course, studentId: ids.student, experienceId: experience.id, source: "CHALLENGE_SUBMISSION", promptVersion: "test" },
    });
    await runInterpretation(run.id);

    expect((await db.interpretationRun.findUniqueOrThrow({ where: { id: run.id } })).status).toBe("COMPLETED");
    const evidence = await db.evidenceObject.findMany({ where: { runId: run.id } });
    expect(evidence.every((e) => e.assistanceLevel === "MEDIUM" && e.assistanceSource === "DECLARED")).toBe(true);
    expect(evidence.every((e) => (e.provenance as { submissionId: string }).submissionId === submission.id)).toBe(true);

    const evaluations = await db.evaluation.findMany({ where: { runId: run.id }, include: { evidence: true } });
    expect(evaluations).toHaveLength(1);
    expect(evaluations[0].criterionId).toBe(ids.r1);
    expect(evaluations[0].evidence.length).toBeGreaterThan(0);

    const usage = await db.aIUsageEvent.findMany({ where: { runId: run.id } });
    expect(usage.map((u) => u.operation)).toContain("interpret.evaluate");
  });

  it("una nueva señal opuesta sobre el mismo tema produce señales contradictorias (política)", async () => {
    const { run } = await conversationRun([
      ["STUDENT", "Quiero repasar la segmentación de mercado con un ejemplo del rubro gastronómico, porque en el challenge me fue raro."],
      ["TUTOR", "Dale, ¿qué criterio usarías?"],
      ["STUDENT", "Corto."],
    ]);
    await runInterpretation(run.id);
    const inference = await db.inference.findFirst({ where: { runId: run.id }, include: { supports: true } });
    expect(inference).not.toBeNull();
    // Hay historia previa en el mismo ítem y dimensión con polaridad opuesta.
    expect(inference!.supports.some((s) => s.relation === "CONTRADICTS")).toBe(true);
    expect(inference!.supportStatus).toBe("CONTRADICTORY");
    expect(inference!.requiresReview).toBe(true);
    const history = await db.interpretationRun.findUniqueOrThrow({ where: { id: run.id } });
    expect((history.steps as { step: string; note?: string }[]).find((s) => s.step === "history")?.note).toMatch(/[1-9]\d* posibles contradicciones/);
    const queue = await getAttentionQueue(ids.course);
    expect(queue.length).toBeGreaterThan(0);
  });

  it("las métricas cuentan Cost-Active Students solo con costo > 0", async () => {
    const metrics = await computeMetrics({ courseId: ids.course });
    expect(metrics.student.withEvidence).toBe(1);
    expect(metrics.quality.inferences).toBeGreaterThan(0);
    // El proveedor de prueba no tiene precio: no genera CAS.
    expect(metrics.cost.costActiveStudents).toBe(0);
    expect(metrics.cost.byOperation.length).toBeGreaterThan(0);
  });

  it("eliminar una conversación borra su evidencia y las inferencias que quedan sin respaldo", async () => {
    const { run, experience } = await conversationRun([
      ["STUDENT", "Quiero entender cómo se arma una hipótesis falsable para mi emprendimiento de catering de eventos."],
      ["TUTOR", "¿Qué resultado te haría cambiar de idea?"],
      ["STUDENT", "Si en un mes no consigo al menos tres eventos pagos con el folleto, cambio de canal de venta."],
    ]);
    await runInterpretation(run.id);
    expect(await db.evidenceObject.count({ where: { experienceId: experience.id } })).toBeGreaterThan(0);

    await deleteExperienceCascade(experience.id, ids.student, ids.course);
    expect(await db.evidenceObject.count({ where: { experienceId: experience.id } })).toBe(0);
    expect(await db.inference.count({ where: { runId: run.id } })).toBe(0);
    const orphan = await db.inference.count({ where: { studentId: ids.student, supports: { none: { relation: "SUPPORTS" } } } });
    expect(orphan).toBe(0);
    expect(await db.developmentSnapshot.count({ where: { studentId: ids.student } })).toBe(1);
  });
});
