import "server-only";
import { countsForTeacher, doubtPercent, doubtSentence } from "@/domain/doubts";
import { assertCourseTeacher, type Viewer } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getAttentionQueue } from "@/server/services/attention";

const DAY_MS = 24 * 60 * 60 * 1000;
const INACTIVE_DAYS = 14;

/**
 * Vista macro de una cátedra para su docente (V1). Solo cuentan los estudiantes inscriptos
 * con el consentimiento activo (V6). Cada porcentaje lleva su denominador: estudiantes que
 * conversaron sobre el tema en la ventana.
 */
export async function getClassOverview(viewer: Viewer, courseId: string, opts: { windowDays?: number; now?: Date } = {}) {
  await assertCourseTeacher(viewer, courseId);
  const now = opts.now ?? new Date();
  const since = new Date(now.getTime() - (opts.windowDays ?? 7) * DAY_MS);

  const enrollments = await db.enrollment.findMany({
    where: { courseId, status: "ACTIVE" },
    select: { studentId: true, student: { select: { consentAnalysisAt: true, user: { select: { name: true } } } } },
  });
  const consenting = new Set(enrollments.filter((e) => e.student.consentAnalysisAt).map((e) => e.studentId));
  const consentingIds = [...consenting];

  const [topics, evidence, signals, conversed, lastConversations] = await Promise.all([
    db.curriculumItem.findMany({ where: { courseId, status: "ACCEPTED" }, orderBy: { position: "asc" }, select: { id: true, title: true } }),
    // Quién conversó sobre cada tema: evidencia vinculada al tema dentro de la ventana.
    db.evidenceCurriculumItem.findMany({
      where: { evidence: { courseId, studentId: { in: consentingIds }, occurredAt: { gte: since } } },
      select: { curriculumItemId: true, evidence: { select: { studentId: true } } },
    }),
    db.signal.findMany({
      where: {
        courseId,
        studentId: { in: consentingIds },
        polarity: "DIFFICULTY",
        curriculumItemId: { not: null },
        evidence: { occurredAt: { gte: since } },
      },
      select: { studentId: true, curriculumItemId: true, studentStatus: true, confidence: true, createdAt: true },
    }),
    db.aIConversation.findMany({
      where: { courseId, studentId: { in: consentingIds }, createdAt: { gte: since } },
      distinct: ["studentId"],
      select: { studentId: true },
    }),
    db.aIConversation.groupBy({ by: ["studentId"], where: { courseId, studentId: { in: consentingIds } }, _max: { createdAt: true } }),
  ]);

  const conversedByTopic = new Map<string, Set<string>>();
  for (const e of evidence) {
    const set = conversedByTopic.get(e.curriculumItemId) ?? new Set();
    set.add(e.evidence.studentId);
    conversedByTopic.set(e.curriculumItemId, set);
  }
  const doubtByTopic = new Map<string, Set<string>>();
  for (const s of signals) {
    if (!s.curriculumItemId || !countsForTeacher(s, now)) continue;
    const set = doubtByTopic.get(s.curriculumItemId) ?? new Set();
    set.add(s.studentId);
    doubtByTopic.set(s.curriculumItemId, set);
  }

  const topicRows = topics
    .map((t) => {
      const conversedIds = [...(conversedByTopic.get(t.id) ?? [])];
      // Solo cuenta como duda si además conversó del tema en la ventana (mismo denominador).
      const doubtIds = [...(doubtByTopic.get(t.id) ?? [])].filter((id) => conversedIds.includes(id));
      return {
        topicId: t.id,
        title: t.title,
        studentIdsWithDoubt: doubtIds,
        studentIdsConversed: conversedIds,
        withDoubt: doubtIds.length,
        conversed: conversedIds.length,
        percent: doubtPercent(doubtIds.length, conversedIds.length),
        sentence: doubtSentence(t.title, doubtIds.length, conversedIds.length),
      };
    })
    .sort((a, b) => b.percent - a.percent || b.withDoubt - a.withDoubt);

  const lastByStudent = new Map(lastConversations.map((l) => [l.studentId, l._max.createdAt]));
  const inactiveSince = new Date(now.getTime() - INACTIVE_DAYS * DAY_MS);
  const inactive = enrollments
    .filter((e) => consenting.has(e.studentId))
    .filter((e) => {
      const last = lastByStudent.get(e.studentId);
      return !last || last < inactiveSince;
    })
    .map((e) => ({ studentId: e.studentId, name: e.student.user.name, lastConversationAt: lastByStudent.get(e.studentId) ?? null }));

  return {
    participation: { enrolled: enrollments.length, consented: consenting.size, conversedThisWeek: conversed.length },
    topics: topicRows,
    alerts: { inactive, attention: (await getAttentionQueue(courseId)).slice(0, 10) },
  };
}

export type ClassOverview = Awaited<ReturnType<typeof getClassOverview>>;
