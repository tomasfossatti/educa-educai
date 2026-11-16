import "server-only";
import { AccessDenied, assertFolderOwner, type Viewer } from "@/server/auth/guards";
import { db } from "@/server/db";

/** El estudiante confirma o descarta una duda detectada sobre él. Solo el dueño. */
export async function respondToSignal(viewer: Viewer, signalId: string, status: "CONFIRMED" | "DISCARDED") {
  if (viewer.role !== "STUDENT") throw new AccessDenied();
  const signal = await db.signal.findFirst({ where: { id: signalId, studentId: viewer.id } });
  if (!signal) throw new AccessDenied();
  return db.signal.update({ where: { id: signal.id }, data: { studentStatus: status, respondedAt: new Date() } });
}

/** Dudas detectadas en una conversación del estudiante, con su tema y el fragmento que las respalda. */
export async function listConversationDoubts(viewer: Viewer, conversationId: string) {
  if (viewer.role !== "STUDENT") throw new AccessDenied();
  const conversation = await db.aIConversation.findFirst({ where: { id: conversationId, studentId: viewer.id }, select: { experienceId: true } });
  if (!conversation) throw new AccessDenied();
  return db.signal.findMany({
    where: { studentId: viewer.id, polarity: "DIFFICULTY", curriculumItemId: { not: null }, evidence: { experienceId: conversation.experienceId } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      description: true,
      studentStatus: true,
      confidence: true,
      curriculumItem: { select: { title: true } },
      evidence: { select: { content: true } },
    },
  });
}

const DOUBT_CARD_SELECT = {
  id: true,
  studentStatus: true,
  createdAt: true,
  curriculumItem: { select: { title: true } },
  evidence: { select: { content: true } },
} as const;

/**
 * Dudas sin responder de una materia del estudiante, las más nuevas primero: el chat las muestra como
 * tarjetas con "Sí" y "No". Mostrarlas no cambia la regla de conteo (`countsForTeacher`).
 */
export async function listPendingDoubts(viewer: Viewer, folderId: string, take = 3) {
  await assertFolderOwner(viewer, folderId);
  return db.signal.findMany({
    where: {
      studentId: viewer.id,
      polarity: "DIFFICULTY",
      studentStatus: "PENDING",
      curriculumItemId: { not: null },
      evidence: { experience: { conversation: { folderId, studentId: viewer.id } } },
    },
    orderBy: { createdAt: "desc" },
    take,
    select: DOUBT_CARD_SELECT,
  });
}

/** Historial de dudas del estudiante (todas sus materias), para Mis datos. */
export async function listMyDoubts(viewer: Viewer) {
  if (viewer.role !== "STUDENT") throw new AccessDenied();
  return db.signal.findMany({
    where: { studentId: viewer.id, polarity: "DIFFICULTY", curriculumItemId: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { ...DOUBT_CARD_SELECT, respondedAt: true, course: { select: { name: true } } },
  });
}
