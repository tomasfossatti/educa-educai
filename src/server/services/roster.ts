import "server-only";
import { assertCourseTeacher, hasActiveConsent, type Viewer } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getCourseOverview } from "@/server/services/attention";

/**
 * Lista de inscriptos de una cátedra para su docente. Incluye a todos los inscriptos activos, con o
 * sin consentimiento, para que el docente sepa quién está y pueda quitarlo. De quien no dio el
 * consentimiento (o lo retiró) solo se muestran el nombre y su estado, sin evidencia ni señales (V6).
 */
export async function getCourseRoster(viewer: Viewer, courseId: string) {
  await assertCourseTeacher(viewer, courseId);
  const [overview, enrollments] = await Promise.all([
    getCourseOverview(courseId),
    db.enrollment.findMany({
      where: { courseId, status: "ACTIVE" },
      select: {
        studentId: true,
        joinedAt: true,
        student: { select: { onboardingCompletedAt: true, consentAnalysisAt: true, user: { select: { name: true } } } },
      },
    }),
  ]);
  const stats = new Map(overview.students.map((s) => [s.id, s]));
  return enrollments
    .map((e) => {
      const consent = hasActiveConsent(e.student);
      const s = consent ? stats.get(e.studentId) : undefined;
      return {
        id: e.studentId,
        name: e.student.user.name,
        joinedAt: e.joinedAt,
        onboardingCompleted: Boolean(e.student.onboardingCompletedAt),
        consent,
        stats: s
          ? { difficulties: s.difficulties, contradictions: s.contradictions, pending: s.pending, evidenceCount: s.evidenceCount, lastEvidenceAt: s.lastEvidenceAt }
          : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type RosterRow = Awaited<ReturnType<typeof getCourseRoster>>[number];
