import { notFound, redirect } from "next/navigation";
import { requireEnrolledStudent } from "@/server/auth/guards";
import { db } from "@/server/db";

/** Dirección vieja de "Desarrollo": las conclusiones están en Mis datos, en "Lo que ve mi docente sobre mí". */
export default async function OldDevelopmentPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { user } = await requireEnrolledStudent(courseId);
  const folder = await db.folder.findFirst({ where: { studentId: user.id, courseId, kind: "SUBJECT" }, select: { id: true } });
  if (!folder) notFound();
  redirect(`/s/materia/${folder.id}?next=/s/mis-datos&seccion=docente`);
}
