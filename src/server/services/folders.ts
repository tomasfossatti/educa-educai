import "server-only";
import { db } from "@/server/db";

export const PROJECT_FOLDER_NAME = "Mi proyecto";

/**
 * Garantiza las carpetas del estudiante: una por cada materia en la que está inscripto
 * y una para su proyecto personal. Es idempotente.
 */
export async function ensureStudentFolders(studentId: string): Promise<void> {
  const enrollments = await db.enrollment.findMany({
    where: { studentId, status: "ACTIVE" },
    select: { courseId: true, course: { select: { name: true } } },
  });
  for (const e of enrollments) {
    await db.folder.upsert({
      where: { studentId_courseId: { studentId, courseId: e.courseId } },
      update: {},
      create: { studentId, courseId: e.courseId, kind: "SUBJECT", name: e.course.name, createdBy: "SYSTEM" },
    });
  }
  const project = await db.folder.findFirst({ where: { studentId, kind: "PROJECT" } });
  if (!project) {
    await db.folder.create({ data: { studentId, kind: "PROJECT", name: PROJECT_FOLDER_NAME, createdBy: "SYSTEM" } });
  }
}

/** Carpetas del estudiante con su última conversación, para la pantalla de inicio. */
export async function listStudentFolders(studentId: string) {
  await ensureStudentFolders(studentId);
  return db.folder.findMany({
    where: { studentId },
    orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
    include: {
      course: { select: { id: true, name: true } },
      conversations: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, title: true, createdAt: true, origin: true } },
    },
  });
}
