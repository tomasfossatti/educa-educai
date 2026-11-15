import "server-only";
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
