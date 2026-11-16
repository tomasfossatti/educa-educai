import "server-only";
import { AccessDenied } from "@/server/auth/guards";
import { db } from "@/server/db";
import { computeAndStoreSnapshot } from "@/server/engine/snapshot";

/**
 * Eliminación de una experiencia del estudiante (conversación o entrega) y todo lo derivado:
 * evidencia, señales, inferencias que se quedan sin respaldo y snapshots que la incluían.
 */
export async function deleteExperienceCascade(experienceId: string, studentId: string, courseId: string | null): Promise<void> {
  await db.$transaction(async (tx) => {
    const conversation = await tx.aIConversation.findUnique({ where: { experienceId }, select: { id: true } });
    const sourceIds = [experienceId, ...(conversation ? [conversation.id] : [])];

    // Los hechos de contexto de carpeta derivados de esta conversación también se borran.
    await tx.folderContext.deleteMany({ where: { folder: { studentId }, sourceIds: { hasSome: sourceIds } } });

    // Las corridas, evidencias, señales, evaluaciones, feedback e inferencias producidas
    // por esta experiencia se eliminan en cascada desde Experience.
    await tx.experience.delete({ where: { id: experienceId } });

    // La carpeta del proyecto no tiene cátedra: no hay inferencias ni snapshots que recalcular.
    if (!courseId) return;

    // Inferencias de otras corridas que usaban esta evidencia como historial: si se quedan
    // sin evidencia que las respalde, dejan de ser trazables y se eliminan.
    await tx.inference.deleteMany({
      where: { studentId, courseId, supports: { none: { relation: "SUPPORTS" } } },
    });

    // Los snapshots anteriores pueden resumir evidencia eliminada: se descartan y se recalcula uno nuevo.
    await tx.developmentSnapshot.deleteMany({ where: { studentId, courseId } });
  });
  if (courseId) await computeAndStoreSnapshot({ studentId, courseId });
}

/** Resumen de "qué sabe Educai sobre mí, de dónde salió y quién puede verlo". */
export async function getStudentDataSummary(studentId: string) {
  const [conversations, messages, submissions, evidence, inferences, reviews, interventions, usage] = await Promise.all([
    db.aIConversation.count({ where: { studentId } }),
    db.message.count({ where: { conversation: { studentId }, role: "STUDENT" } }),
    db.submission.count({ where: { studentId, status: "SUBMITTED" } }),
    db.evidenceObject.count({ where: { studentId } }),
    db.inference.count({ where: { studentId, state: "ACTIVE" } }),
    db.teacherReview.count({ where: { inference: { studentId } } }),
    db.interventionTarget.count({ where: { studentId } }),
    db.aIUsageEvent.count({ where: { studentId } }),
  ]);
  return { conversations, messages, submissions, evidence, inferences, reviews, interventions, usage };
}

/**
 * Borra la cuenta de un estudiante y todo lo que cuelga de ella (en cascada desde User), más sus
 * métricas de uso y las invitaciones con su correo. El registro de costo de IA queda sin vínculo.
 */
export async function deleteStudentAccount(studentId: string, email: string): Promise<void> {
  await db.$transaction([
    db.productEvent.deleteMany({ where: { OR: [{ userId: studentId }, { studentId }] } }),
    db.courseInvite.deleteMany({ where: { email: email.toLowerCase() } }),
    db.user.delete({ where: { id: studentId } }),
  ]);
}

/**
 * Copia de todos los datos del estudiante, para el derecho de acceso (Ley 25.326, art. 14).
 * Solo para el propio estudiante: no hay forma de pedir la copia de otra persona. No incluye el
 * hash de la contraseña ni las sesiones. De los accesos a su ficha incluye quién y cuándo (V9).
 */
export async function exportStudentData(viewer: { id: string; role: string }) {
  if (viewer.role !== "STUDENT") throw new AccessDenied();
  const studentId = viewer.id;
  const [user, profile, enrollments, folders, conversations, signals, inferences, responses, quizzes, mastery, accesses, aiCallsRecorded] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: studentId }, select: { name: true, email: true, role: true, createdAt: true } }),
    db.studentProfile.findUniqueOrThrow({ where: { userId: studentId } }),
    db.enrollment.findMany({ where: { studentId }, select: { status: true, joinedAt: true, course: { select: { name: true } } } }),
    db.folder.findMany({
      where: { studentId },
      select: {
        id: true,
        kind: true,
        name: true,
        createdBy: true,
        createdAt: true,
        materials: { orderBy: { fileName: "asc" }, select: { fileName: true, module: true, status: true, createdAt: true } },
        contexts: { orderBy: { createdAt: "asc" }, select: { layer: true, content: true, editedByStudent: true, archivedAt: true, createdAt: true } },
      },
    }),
    db.aIConversation.findMany({
      where: { studentId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        folderId: true,
        title: true,
        origin: true,
        status: true,
        createdAt: true,
        closedAt: true,
        messages: { orderBy: { createdAt: "asc" }, select: { role: true, content: true, threadId: true, createdAt: true } },
      },
    }),
    db.signal.findMany({
      where: { studentId },
      select: { description: true, confidence: true, studentStatus: true, respondedAt: true, createdAt: true, curriculumItem: { select: { title: true } }, evidence: { select: { content: true } } },
    }),
    db.inference.findMany({
      where: { studentId, reviewStatus: { not: "INCORRECT" } },
      select: { studentStatement: true, dimension: true, polarity: true, state: true, createdAt: true, curriculumItem: { select: { title: true } } },
    }),
    db.studentResponse.findMany({ where: { studentId }, select: { stance: true, note: true, createdAt: true } }),
    db.quizAttempt.findMany({ where: { studentId }, select: { questions: true, answers: true, correct: true, total: true, status: true, createdAt: true, curriculumItem: { select: { title: true } } } }),
    db.masteryRecord.findMany({ where: { studentId }, select: { score: true, attempts: true, lastEvidenceAt: true, curriculumItem: { select: { title: true } } } }),
    db.accessLog.findMany({ where: { studentId }, orderBy: { createdAt: "desc" }, select: { view: true, createdAt: true, viewer: { select: { name: true, role: true } } } }),
    db.aIUsageEvent.count({ where: { studentId } }),
  ]);
  // La conexión con el LMS, sin la credencial (que va cifrada y nunca sale de la base).
  const lmsConnection = await db.lmsConnection.findUnique({ where: { userId: studentId }, select: { provider: true, baseUrl: true, accountName: true, createdAt: true, lastUsedAt: true } });
  return {
    generatedAt: new Date().toISOString(),
    account: user,
    profile: { ...profile, userId: undefined },
    enrollments,
    lmsConnection,
    folders,
    conversations,
    doubts: signals,
    conclusions: inferences,
    responsesToConclusions: responses,
    quizzes,
    mastery,
    accessToMyFile: accesses,
    aiCallsRecorded,
  };
}
