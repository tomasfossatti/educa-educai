import "server-only";
import { assertCanViewStudentFile, type Viewer } from "@/server/auth/guards";
import { db } from "@/server/db";

/**
 * Ficha de un estudiante en una cátedra. Es una sola función para el docente y para el estudiante:
 * los dos ven exactamente el mismo contenido (V7). La autorización va primero (V2, V3, V6, V8, V11).
 */
export async function loadStudentFile(viewer: Viewer, studentId: string, courseId: string) {
  await assertCanViewStudentFile(viewer, studentId, courseId);
  return buildStudentFile(studentId, courseId);
}

async function buildStudentFile(studentId: string, courseId: string) {
  const [profile, topics, evidence, conversations] = await Promise.all([
    db.studentProfile.findUniqueOrThrow({
      where: { userId: studentId },
      select: { userId: true, career: true, studyYear: true, projectDescription: true, user: { select: { name: true } } },
    }),
    db.curriculumItem.findMany({
      where: { courseId, status: "ACCEPTED" },
      orderBy: { position: "asc" },
      select: {
        id: true,
        title: true,
        _count: { select: { signals: { where: { studentId, polarity: "DIFFICULTY" } } } },
      },
    }),
    db.evidenceObject.findMany({
      where: { studentId, courseId },
      orderBy: { occurredAt: "desc" },
      take: 50,
      select: {
        id: true,
        content: true,
        occurredAt: true,
        curriculumLinks: { select: { curriculumItem: { select: { id: true, title: true } } } },
      },
    }),
    db.aIConversation.findMany({
      where: { studentId, courseId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, title: true, origin: true, createdAt: true },
    }),
  ]);

  return {
    student: {
      id: profile.userId,
      name: profile.user.name,
      career: profile.career,
      studyYear: profile.studyYear,
      projectDescription: profile.projectDescription,
    },
    topics: topics.map((t) => ({ id: t.id, title: t.title, doubts: t._count.signals })),
    evidence: evidence.map((e) => ({
      id: e.id,
      content: e.content,
      occurredAt: e.occurredAt,
      topics: e.curriculumLinks.map((l) => l.curriculumItem),
    })),
    recentActivity: conversations,
  };
}

export type StudentFile = Awaited<ReturnType<typeof buildStudentFile>>;
