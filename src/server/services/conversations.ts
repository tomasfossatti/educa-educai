import "server-only";
import { buildTutorSystem } from "@/server/ai/prompts/tutor";
import { db } from "@/server/db";

/** Conversación del estudiante dentro de una materia (siempre filtrada por dueño). */
export async function getOwnConversation(conversationId: string, studentId: string) {
  return db.aIConversation.findFirst({
    where: { id: conversationId, studentId, course: { enrollments: { some: { studentId, status: "ACTIVE" } } } },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      focusItem: true,
      activity: true,
      course: true,
      experience: { include: { runs: { orderBy: { createdAt: "desc" }, take: 1 } } },
    },
  });
}

/**
 * Contexto del tutor: materia, currícula, actividad, contexto declarado (si es útil)
 * y solo la evidencia previa estrictamente necesaria (inferencias activas sobre el foco).
 */
export async function buildTutorSystemPrompt(conversationId: string): Promise<string> {
  const conversation = await db.aIConversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: { course: true, focusItem: true, activity: true, student: true },
  });
  const curriculum = await db.curriculumItem.findMany({
    where: { courseId: conversation.courseId, status: "ACCEPTED", kind: { in: ["CONCEPT", "OBJECTIVE"] } },
    orderBy: [{ kind: "asc" }, { position: "asc" }],
    select: { kind: true, title: true, description: true },
  });

  const priorEvidenceNotes: string[] = [];
  if (conversation.focusItemId) {
    const inferences = await db.inference.findMany({
      where: {
        studentId: conversation.studentId,
        courseId: conversation.courseId,
        curriculumItemId: conversation.focusItemId,
        state: "ACTIVE",
        reviewStatus: { not: "INCORRECT" },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { statement: true },
    });
    priorEvidenceNotes.push(...inferences.map((i) => i.statement));
  }

  const student = conversation.student;
  return buildTutorSystem({
    courseName: conversation.course.name,
    curriculum: curriculum.map((c) => ({ kind: c.kind === "CONCEPT" ? "Concepto" : "Objetivo", title: c.title, description: c.description })),
    focusItem: conversation.focusItem ? { title: conversation.focusItem.title, description: conversation.focusItem.description } : null,
    activity: conversation.activity
      ? { title: conversation.activity.title, scenario: conversation.activity.scenario, instructions: conversation.activity.instructions }
      : null,
    declaredContext:
      student.declaredCurrentContext || student.declaredInterests || student.declaredGoals
        ? { currentContext: student.declaredCurrentContext, interests: student.declaredInterests, goals: student.declaredGoals }
        : null,
    priorEvidenceNotes,
  });
}
