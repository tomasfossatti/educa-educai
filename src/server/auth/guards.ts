import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/server/db";
import { getSessionUser, type SessionUser } from "./session";

/**
 * Capa de autorización. Toda página y toda acción del servidor pasa por acá:
 * - un estudiante solo accede a sus propios datos y a materias donde está inscripto;
 * - un docente solo accede a sus materias y a estudiantes inscriptos en ellas.
 * Ante un recurso ajeno se responde 404 para no revelar su existencia.
 */

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export const requireStudent = cache(async (options?: { allowIncompleteOnboarding?: boolean }) => {
  const user = await requireUser();
  if (user.role !== "STUDENT") redirect("/t");
  const profile = await db.studentProfile.findUnique({ where: { userId: user.id } });
  if (!profile) redirect("/login");
  if (!options?.allowIncompleteOnboarding && !profile.onboardingCompletedAt) redirect("/s/onboarding");
  return { user, profile };
});

export const requireTeacher = cache(async () => {
  const user = await requireUser();
  if (user.role !== "TEACHER") redirect("/s");
  const profile = await db.teacherProfile.findUnique({ where: { userId: user.id }, include: { institution: true } });
  if (!profile) redirect("/login");
  return { user, profile };
});

export const requireCourseTeacher = cache(async (courseId: string) => {
  const { user, profile } = await requireTeacher();
  const course = await db.course.findFirst({ where: { id: courseId, teacherId: user.id } });
  if (!course) notFound();
  return { user, profile, course };
});

export const requireEnrolledStudent = cache(async (courseId: string) => {
  const { user, profile } = await requireStudent();
  const enrollment = await db.enrollment.findFirst({
    where: { courseId, studentId: user.id, status: "ACTIVE" },
    include: { course: { include: { teacher: { include: { user: { select: { name: true } } } } } } },
  });
  if (!enrollment) notFound();
  return { user, profile, course: enrollment.course };
});

/** Docente que accede a un estudiante: el estudiante debe estar inscripto en una materia del docente. */
export const requireTeacherStudent = cache(async (courseId: string, studentId: string) => {
  const { user, course } = await requireCourseTeacher(courseId);
  const enrollment = await db.enrollment.findFirst({
    where: { courseId, studentId, status: "ACTIVE" },
    include: { student: { include: { user: { select: { id: true, name: true, email: true } } } } },
  });
  if (!enrollment) notFound();
  return { user, course, student: enrollment.student };
});
