import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { CURRENT_COURSE_COOKIE } from "@/lib/constants";
import { db } from "@/server/db";

export const getStudentCourses = cache(async (studentId: string) => {
  return db.enrollment.findMany({
    where: { studentId, status: "ACTIVE" },
    include: {
      course: {
        select: {
          id: true,
          name: true,
          description: true,
          teacher: { include: { user: { select: { name: true } } } },
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });
});

/** Materia actual del estudiante: la elegida (cookie) si sigue inscripto, o la primera. */
export async function getCurrentCourseId(studentId: string): Promise<string | null> {
  const enrollments = await getStudentCourses(studentId);
  const preferred = (await cookies()).get(CURRENT_COURSE_COOKIE)?.value;
  return enrollments.find((e) => e.courseId === preferred)?.courseId ?? enrollments[0]?.courseId ?? null;
}

export async function getPendingInvites(email: string) {
  return db.courseInvite.findMany({
    where: { email, acceptedAt: null },
    include: { course: { select: { name: true, teacher: { include: { user: { select: { name: true } } } } } } },
  });
}
