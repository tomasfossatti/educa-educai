import { notFound, redirect } from "next/navigation";
import { requireEnrolledStudent } from "@/server/auth/guards";
import { db } from "@/server/db";
import { ensureStudentFolders } from "@/server/services/folders";

/**
 * Dirección vieja de una materia: la materia es su chat (Preguntar). Elige la materia como la actual
 * y abre el chat; la próxima clase y las tareas están ahí y en Practicar.
 */
export default async function OldCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { user } = await requireEnrolledStudent(courseId);
  await ensureStudentFolders(user.id);
  const folder = await db.folder.findFirst({ where: { studentId: user.id, courseId, kind: "SUBJECT" }, select: { id: true } });
  if (!folder) notFound();
  redirect(`/s/materia/${folder.id}`);
}
