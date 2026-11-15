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
  // ON CONFLICT DO NOTHING: si dos pedidos llegan a la vez, ninguno falla ni duplica carpetas
  // (único por estudiante y cátedra, y un índice único parcial para la carpeta del proyecto).
  await db.folder.createMany({
    data: [
      ...enrollments.map((e) => ({ studentId, courseId: e.courseId, kind: "SUBJECT" as const, name: e.course.name, createdBy: "SYSTEM" as const })),
      { studentId, kind: "PROJECT" as const, name: PROJECT_FOLDER_NAME, createdBy: "SYSTEM" as const },
    ],
    skipDuplicates: true,
  });
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
