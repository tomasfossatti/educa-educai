import "server-only";
import { db } from "@/server/db";
import { computeAndStoreSnapshot } from "@/server/engine/snapshot";

/**
 * Eliminación de una experiencia del estudiante (conversación o entrega) y todo lo derivado:
 * evidencia, señales, inferencias que se quedan sin respaldo y snapshots que la incluían.
 */
export async function deleteExperienceCascade(experienceId: string, studentId: string, courseId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    // Las corridas, evidencias, señales, evaluaciones, feedback e inferencias producidas
    // por esta experiencia se eliminan en cascada desde Experience.
    await tx.experience.delete({ where: { id: experienceId } });

    // Inferencias de otras corridas que usaban esta evidencia como historial: si se quedan
    // sin evidencia que las respalde, dejan de ser trazables y se eliminan.
    await tx.inference.deleteMany({
      where: { studentId, courseId, supports: { none: { relation: "SUPPORTS" } } },
    });

    // Los snapshots anteriores pueden resumir evidencia eliminada: se descartan y se recalcula uno nuevo.
    await tx.developmentSnapshot.deleteMany({ where: { studentId, courseId } });
  });
  await computeAndStoreSnapshot({ studentId, courseId });
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
