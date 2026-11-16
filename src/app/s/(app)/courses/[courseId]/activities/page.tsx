import { notFound, redirect } from "next/navigation";
import { requireEnrolledStudent } from "@/server/auth/guards";
import { db } from "@/server/db";

/** Dirección vieja de "Actividades": las tareas del docente están al pie de Practicar, en esa materia. */
export default async function OldActivitiesPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { user } = await requireEnrolledStudent(courseId);
  const folder = await db.folder.findFirst({ where: { studentId: user.id, courseId, kind: "SUBJECT" }, select: { id: true } });
  if (!folder) notFound();
  redirect(`/s/materia/${folder.id}?next=/s/practicar`);
}
