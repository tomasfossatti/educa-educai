import "server-only";
import { TEXT } from "@/lib/texts";
import { db } from "@/server/db";
import { ensureStudentFolders } from "@/server/services/folders";

/**
 * Inscripción con el código de la materia. Un estudiante que el docente quitó no vuelve solo con el
 * código: para sumarlo otra vez, el docente lo invita de nuevo por email.
 */
export async function enrollWithCode(studentId: string, rawCode: string): Promise<{ courseId: string } | { error: string }> {
  const code = rawCode.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) return { error: TEXT.enrollment.invalidCode };
  const course = await db.course.findUnique({ where: { joinCode: code } });
  if (!course) return { error: TEXT.enrollment.unknownCode };
  const existing = await db.enrollment.findUnique({ where: { courseId_studentId: { courseId: course.id, studentId } } });
  if (existing?.status === "REMOVED") return { error: TEXT.enrollment.removed };
  if (!existing) await db.enrollment.create({ data: { courseId: course.id, studentId } });
  await ensureStudentFolders(studentId);
  return { courseId: course.id };
}

/**
 * Registra invitaciones por email. Si una invitación ya se había aceptado y esa persona no está
 * inscripta hoy (por ejemplo, porque el docente la quitó), se vuelve a abrir para que la vea.
 */
export async function inviteEmails(courseId: string, emails: string[]): Promise<void> {
  await db.courseInvite.createMany({ data: emails.map((email) => ({ courseId, email })), skipDuplicates: true });
  const active = await db.enrollment.findMany({
    where: { courseId, status: "ACTIVE", student: { user: { email: { in: emails } } } },
    select: { student: { select: { user: { select: { email: true } } } } },
  });
  const enrolled = active.map((e) => e.student.user.email);
  await db.courseInvite.updateMany({
    where: { courseId, email: { in: emails, notIn: enrolled }, acceptedAt: { not: null } },
    data: { acceptedAt: null },
  });
}
