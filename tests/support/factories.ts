/**
 * Fábricas de datos sintéticos para tests. Cada llamada crea entidades nuevas con ids y emails
 * únicos, así los tests no dependen del orden ni de datos previos. Las contraseñas se generan
 * en cada ejecución y no se guardan en el código.
 */
import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

const uid = () => randomBytes(5).toString("hex");
const secret = () => randomBytes(24).toString("base64url");

export function factories(db: PrismaClient) {
  async function institution() {
    return db.institution.create({ data: { name: `Universidad ${uid()}` } });
  }

  async function teacher(opts: { institutionId?: string } = {}) {
    const institutionId = opts.institutionId ?? (await institution()).id;
    return db.user.create({
      data: {
        email: `docente-${uid()}@test.educai`,
        name: "Docente de prueba",
        passwordHash: secret(),
        role: "TEACHER",
        teacherProfile: { create: { institutionId } },
      },
    });
  }

  async function admin() {
    return db.user.create({
      data: { email: `admin-${uid()}@test.educai`, name: "Admin de prueba", passwordHash: secret(), role: "ADMIN" },
    });
  }

  async function student(opts: { consent?: boolean; name?: string } = {}) {
    return db.user.create({
      data: {
        email: `estudiante-${uid()}@test.educai`,
        name: opts.name ?? "Estudiante de prueba",
        passwordHash: secret(),
        role: "STUDENT",
        studentProfile: {
          create: {
            consentAnalysisAt: opts.consent === false ? null : new Date(),
            onboardingCompletedAt: new Date(),
            projectDescription: "Un emprendimiento de viandas saludables",
          },
        },
      },
    });
  }

  async function course(teacherId: string, opts: { name?: string } = {}) {
    const profile = await db.teacherProfile.findUniqueOrThrow({ where: { userId: teacherId } });
    return db.course.create({
      data: {
        institutionId: profile.institutionId,
        teacherId,
        name: opts.name ?? `Materia ${uid()}`,
        joinCode: uid().toUpperCase(),
        curriculumStatus: "CONFIGURED",
      },
    });
  }

  async function topic(courseId: string, title: string) {
    return db.curriculumItem.create({ data: { courseId, kind: "CONCEPT", title, origin: "TEACHER", status: "ACCEPTED" } });
  }

  /** Conversación cerrada dentro de una carpeta, con sus mensajes. */
  async function conversation(opts: {
    studentId: string;
    folderId: string;
    courseId: string | null;
    messages?: [role: "STUDENT" | "TUTOR", content: string][];
    origin?: "CHAT" | "UPLOAD";
  }) {
    const experience = await db.experience.create({
      data: { courseId: opts.courseId, studentId: opts.studentId, type: "AI_CONVERSATION", title: "Sesión de prueba" },
    });
    const conv = await db.aIConversation.create({
      data: {
        experienceId: experience.id,
        courseId: opts.courseId,
        studentId: opts.studentId,
        folderId: opts.folderId,
        origin: opts.origin ?? "CHAT",
        title: "Sesión de prueba",
        status: "CLOSED",
        closedAt: new Date(),
      },
    });
    for (const [i, [role, content]] of (opts.messages ?? [["STUDENT", "Hola"]]).entries()) {
      await db.message.create({ data: { conversationId: conv.id, role, content, createdAt: new Date(Date.now() + i) } });
    }
    return { experience, conversation: conv };
  }

  /** Evidencia y señal derivadas de una conversación, como las dejaría el motor. */
  async function evidenceFrom(opts: { experienceId: string; studentId: string; courseId: string; topicId: string; excerpt: string }) {
    const run = await db.interpretationRun.create({
      data: {
        courseId: opts.courseId,
        studentId: opts.studentId,
        experienceId: opts.experienceId,
        source: "AI_CONVERSATION",
        status: "COMPLETED",
        promptVersion: "test",
        completedAt: new Date(),
      },
    });
    const evidence = await db.evidenceObject.create({
      data: {
        runId: run.id,
        experienceId: opts.experienceId,
        courseId: opts.courseId,
        studentId: opts.studentId,
        kind: "QUESTION",
        source: "AI_CONVERSATION",
        observation: "El estudiante pregunta por el tema",
        content: opts.excerpt,
        occurredAt: new Date(),
        provenance: { origin: "test" },
        curriculumLinks: { create: [{ curriculumItemId: opts.topicId }] },
      },
    });
    const signal = await db.signal.create({
      data: {
        runId: run.id,
        evidenceId: evidence.id,
        courseId: opts.courseId,
        studentId: opts.studentId,
        curriculumItemId: opts.topicId,
        dimension: "COMPREHENSION",
        polarity: "DIFFICULTY",
        description: "Duda sobre el tema",
      },
    });
    return { run, evidence, signal };
  }

  return { institution, teacher, admin, student, course, topic, conversation, evidenceFrom };
}
