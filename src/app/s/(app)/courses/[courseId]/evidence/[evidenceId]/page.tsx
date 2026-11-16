import { notFound, redirect } from "next/navigation";
import { requireEnrolledStudent } from "@/server/auth/guards";
import { db } from "@/server/db";

/** Dirección vieja de una evidencia: las partes de las charlas que ve el docente están en Mis datos. */
export default async function OldEvidencePage({ params }: { params: Promise<{ courseId: string; evidenceId: string }> }) {
  const { courseId } = await params;
  const { user } = await requireEnrolledStudent(courseId);
  const folder = await db.folder.findFirst({ where: { studentId: user.id, courseId, kind: "SUBJECT" }, select: { id: true } });
  if (!folder) notFound();
  redirect(`/s/materia/${folder.id}?next=/s/mis-datos&seccion=docente`);
}
