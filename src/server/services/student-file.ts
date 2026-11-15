import "server-only";
import { assertCanViewStudentFile, type Viewer } from "@/server/auth/guards";
import { db } from "@/server/db";
import { logAccess } from "@/server/services/access-log";

/**
 * Ficha de un estudiante en una cátedra. Es una sola función para el docente y para el estudiante:
 * los dos ven exactamente el mismo contenido (V7). La autorización va primero (V2, V3, V6, V8, V11).
 */
export async function loadStudentFile(viewer: Viewer, studentId: string, courseId: string) {
  await assertCanViewStudentFile(viewer, studentId, courseId);
  await logAccess(viewer, studentId, courseId, "STUDENT_FILE");
  return buildStudentFile(studentId, courseId);
}

/**
 * Lo que la carpeta del proyecto personal vincula con una cátedra: solo los hechos que la IA asoció
 * a esa cátedra, con sus fuentes (V5). Nunca la carpeta ni sus conversaciones.
 */
export async function loadProjectLinks(viewer: Viewer, studentId: string, courseId: string) {
  await assertCanViewStudentFile(viewer, studentId, courseId);
  await logAccess(viewer, studentId, courseId, "PROJECT_LINKS");
  return db.folderContext.findMany({
    where: { folder: { studentId, kind: "PROJECT" }, layer: "FACTS", archivedAt: null, courseIds: { has: courseId } },
    orderBy: { createdAt: "desc" },
    select: { id: true, content: true, sourceIds: true, createdAt: true },
  });
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
