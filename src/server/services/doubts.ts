import "server-only";
import { AccessDenied, type Viewer } from "@/server/auth/guards";
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
