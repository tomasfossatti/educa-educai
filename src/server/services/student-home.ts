import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { CURRENT_COURSE_COOKIE } from "@/lib/constants";
import { db } from "@/server/db";
import { expireStaleRuns } from "@/server/engine/trigger";

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

/** Datos de la home del estudiante: Ahora · Tu desarrollo · Próximo paso · Evidencia · Tu contexto. */
export async function getStudentHome(studentId: string, courseId: string) {
  await expireStaleRuns(studentId);
  const [unseenFeedback, pendingActivities, processingRuns, failedRuns, inferences, actions, evidence, snapshot] = await Promise.all([
    db.feedback.findMany({
      where: { studentId, courseId, viewedAt: null },
      orderBy: { createdAt: "desc" },
      include: { experience: { include: { submission: { select: { activityId: true } }, conversation: { select: { id: true } } } } },
      take: 5,
    }),
    db.activity.findMany({
      where: { courseId, status: "PUBLISHED", submissions: { none: { studentId, status: "SUBMITTED" } } },
      orderBy: { publishedAt: "desc" },
      select: { id: true, title: true, kind: true },
      take: 5,
    }),
    db.interpretationRun.count({ where: { studentId, courseId, status: { in: ["QUEUED", "RUNNING"] } } }),
    db.interpretationRun.findMany({
      where: { studentId, courseId, status: "FAILED", experience: { runs: { every: { status: "FAILED" } } } },
      include: { experience: { include: { submission: { select: { activityId: true } }, conversation: { select: { id: true } } } } },
      take: 3,
    }),
    db.inference.findMany({
      where: { studentId, courseId, state: "ACTIVE", reviewStatus: { not: "INCORRECT" } },
      orderBy: { createdAt: "desc" },
      take: 4,
      include: { curriculumItem: { select: { title: true } }, supports: { select: { evidenceId: true } } },
    }),
    db.suggestedAction.findMany({
      where: { studentId, courseId, audience: "STUDENT", status: "OPEN" },
      orderBy: [{ source: "desc" }, { createdAt: "desc" }],
      include: { curriculumItem: { select: { id: true, title: true } }, activity: { select: { id: true, title: true } } },
      take: 4,
    }),
    db.evidenceObject.findMany({
      where: { studentId, courseId },
      orderBy: { occurredAt: "desc" },
      take: 3,
      include: { experience: { select: { title: true } } },
    }),
    db.developmentSnapshot.findFirst({ where: { studentId, courseId }, orderBy: { createdAt: "desc" }, select: { evidenceCount: true, experienceCount: true } }),
  ]);
  return { unseenFeedback, pendingActivities, processingRuns, failedRuns, inferences, actions, evidence, snapshot };
}
