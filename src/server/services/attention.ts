import "server-only";
import type { Dimension, Priority, SupportStatus } from "@prisma/client";
import { computeTransitions, type SnapshotSignal, type Transition } from "@/domain/snapshot";
import { dimensionLabel } from "@/domain/labels";
import { db } from "@/server/db";

/**
 * Attention Queue y vista de curso del docente: priorización → evidencia → decisión.
 * Todo se calcula a partir de inferencias activas (no descartadas por el docente) y señales.
 */

export type AttentionKind = "GAP" | "PATTERN" | "CONTRADICTION" | "STUDENT_DIFFICULTY" | "FOLLOW_UP" | "NO_EVIDENCE";

export interface AttentionItem {
  key: string;
  kind: AttentionKind;
  priority: Priority;
  title: string;
  description: string;
  students: { id: string; name: string }[];
  href: string;
  pendingReview: number;
  supportStatuses: SupportStatus[];
  intervention: { id: string; occurredAt: Date; hasFollowUp: boolean } | null;
}

const PRIORITY_RANK: Record<Priority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

async function loadCourseState(courseId: string) {
  const [enrollments, inferences, interventions, evidenceCounts] = await Promise.all([
    db.enrollment.findMany({
      where: { courseId, status: "ACTIVE" },
      include: { student: { include: { user: { select: { id: true, name: true } } } } },
    }),
    db.inference.findMany({
      where: { courseId, state: "ACTIVE", reviewStatus: { not: "INCORRECT" } },
      include: { curriculumItem: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.intervention.findMany({
      where: { courseId },
      include: { targets: true },
      orderBy: { occurredAt: "desc" },
    }),
    db.evidenceObject.groupBy({ by: ["studentId"], where: { courseId }, _count: { _all: true }, _max: { occurredAt: true } }),
  ]);
  const names = new Map(enrollments.map((e) => [e.studentId, e.student.user.name]));
  return { enrollments, inferences, interventions, evidenceCounts, names };
}

type CourseState = Awaited<ReturnType<typeof loadCourseState>>;
type CourseInference = CourseState["inferences"][number];

function interventionFor(state: CourseState, key: string, since: Date) {
  const found = state.interventions.find((i) => i.insightKey === key && i.occurredAt >= since);
  return found ? { id: found.id, occurredAt: found.occurredAt, hasFollowUp: Boolean(found.followUpEvidenceAt) } : null;
}

interface ItemGroup {
  itemId: string;
  title: string;
  gapStudents: Set<string>;
  difficultyStudents: Set<string>;
  inferences: CourseInference[];
}

function groupByItem(inferences: CourseInference[]): Map<string, ItemGroup> {
  const groups = new Map<string, ItemGroup>();
  for (const inf of inferences) {
    if (!inf.curriculumItem) continue;
    const group = groups.get(inf.curriculumItem.id) ?? {
      itemId: inf.curriculumItem.id,
      title: inf.curriculumItem.title,
      gapStudents: new Set<string>(),
      difficultyStudents: new Set<string>(),
      inferences: [],
    };
    group.inferences.push(inf);
    groups.set(inf.curriculumItem.id, group);
  }
  for (const group of groups.values()) {
    const byStudent = new Map<string, CourseInference[]>();
    for (const inf of group.inferences) byStudent.set(inf.studentId, [...(byStudent.get(inf.studentId) ?? []), inf]);
    for (const [studentId, list] of byStudent) {
      const understands = list.some((i) => i.dimension === "COMPREHENSION" && i.polarity === "STRENGTH");
      const struggles = list.some((i) => (i.dimension === "APPLICATION" || i.dimension === "TRANSFER") && i.polarity === "DIFFICULTY");
      if (understands && struggles) group.gapStudents.add(studentId);
      else if (list.some((i) => i.polarity === "DIFFICULTY")) group.difficultyStudents.add(studentId);
    }
  }
  return groups;
}

function studentsOf(state: CourseState, ids: Iterable<string>) {
  return [...ids].map((id) => ({ id, name: state.names.get(id) ?? "Estudiante" })).sort((a, b) => a.name.localeCompare(b.name));
}

function latestDate(list: CourseInference[]): Date {
  return list.reduce((max, i) => (i.createdAt > max ? i.createdAt : max), new Date(0));
}

export function buildAttentionItems(courseId: string, state: CourseState): AttentionItem[] {
  const items: AttentionItem[] = [];
  const activeCount = Math.max(1, state.enrollments.length);
  const covered = new Set<string>();

  for (const group of groupByItem(state.inferences).values()) {
    if (group.gapStudents.size > 0) {
      const key = `gap:${group.itemId}`;
      const related = group.inferences.filter((i) => group.gapStudents.has(i.studentId));
      related.forEach((i) => covered.add(i.id));
      const n = group.gapStudents.size;
      items.push({
        key,
        kind: "GAP",
        priority: n >= 3 || n / activeCount >= 0.3 ? "HIGH" : "MEDIUM",
        title: `${group.title}: comprensión razonable, aplicación débil`,
        description: `${n} ${n === 1 ? "estudiante muestra" : "estudiantes muestran"} señales de comprensión del concepto pero dificultad al aplicarlo.`,
        students: studentsOf(state, group.gapStudents),
        href: `/t/courses/${courseId}/insights/${encodeURIComponent(key)}`,
        pendingReview: related.filter((i) => i.requiresReview && i.reviewStatus === "PENDING").length,
        supportStatuses: related.map((i) => i.supportStatus),
        intervention: interventionFor(state, key, latestDate(related)),
      });
    }
    if (group.difficultyStudents.size >= 2) {
      const key = `pattern:${group.itemId}`;
      const related = group.inferences.filter((i) => group.difficultyStudents.has(i.studentId) && i.polarity === "DIFFICULTY");
      related.forEach((i) => covered.add(i.id));
      const n = group.difficultyStudents.size;
      const dims = [...new Set(related.map((i) => dimensionLabel[i.dimension].toLowerCase()))].join(", ");
      items.push({
        key,
        kind: "PATTERN",
        priority: n >= 3 || n / activeCount >= 0.3 ? "HIGH" : "MEDIUM",
        title: `Dificultad recurrente en ${group.title}`,
        description: `${n} estudiantes muestran dificultad (${dims}).`,
        students: studentsOf(state, group.difficultyStudents),
        href: `/t/courses/${courseId}/insights/${encodeURIComponent(key)}`,
        pendingReview: related.filter((i) => i.requiresReview && i.reviewStatus === "PENDING").length,
        supportStatuses: related.map((i) => i.supportStatus),
        intervention: interventionFor(state, key, latestDate(related)),
      });
    }
  }

  for (const inf of state.inferences) {
    if (covered.has(inf.id) || inf.reviewStatus !== "PENDING") continue;
    const name = state.names.get(inf.studentId) ?? "Estudiante";
    const topic = inf.curriculumItem?.title ?? dimensionLabel[inf.dimension];
    if (inf.supportStatus === "CONTRADICTORY") {
      items.push({
        key: `inference:${inf.id}`,
        kind: "CONTRADICTION",
        priority: "MEDIUM",
        title: `Señales contradictorias: ${name} en ${topic}`,
        description: inf.contradictionNote ?? inf.statement,
        students: [{ id: inf.studentId, name }],
        href: `/t/courses/${courseId}/inferences/${inf.id}`,
        pendingReview: 1,
        supportStatuses: [inf.supportStatus],
        intervention: null,
      });
    } else if (inf.polarity === "DIFFICULTY" && inf.priority === "HIGH") {
      items.push({
        key: `inference:${inf.id}`,
        kind: "STUDENT_DIFFICULTY",
        priority: "MEDIUM",
        title: `${name}: dificultad en ${topic}`,
        description: inf.statement,
        students: [{ id: inf.studentId, name }],
        href: `/t/courses/${courseId}/inferences/${inf.id}`,
        pendingReview: 1,
        supportStatuses: [inf.supportStatus],
        intervention: null,
      });
    }
  }

  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  for (const intervention of state.interventions) {
    if (!intervention.followUpEvidenceAt || intervention.followUpEvidenceAt < twoWeeksAgo) continue;
    items.push({
      key: `followup:${intervention.id}`,
      kind: "FOLLOW_UP",
      priority: "MEDIUM",
      title: "Hay evidencia nueva después de una intervención",
      description: intervention.description,
      students: studentsOf(state, intervention.targets.map((t) => t.studentId)),
      href: intervention.inferenceId
        ? `/t/courses/${courseId}/inferences/${intervention.inferenceId}`
        : intervention.insightKey
          ? `/t/courses/${courseId}/insights/${encodeURIComponent(intervention.insightKey)}`
          : `/t/courses/${courseId}/attention`,
      pendingReview: 0,
      supportStatuses: [],
      intervention: { id: intervention.id, occurredAt: intervention.occurredAt, hasFollowUp: true },
    });
  }

  const withEvidence = new Set(state.evidenceCounts.map((e) => e.studentId));
  const withoutEvidence = state.enrollments.filter((e) => !withEvidence.has(e.studentId));
  if (withoutEvidence.length > 0) {
    items.push({
      key: "no-evidence",
      kind: "NO_EVIDENCE",
      priority: "LOW",
      title: `${withoutEvidence.length} ${withoutEvidence.length === 1 ? "estudiante todavía no tiene" : "estudiantes todavía no tienen"} evidencia`,
      description: "Todavía no hay evidencia suficiente para decir algo sobre su desarrollo.",
      students: studentsOf(state, withoutEvidence.map((e) => e.studentId)),
      href: `/t/courses/${courseId}/students`,
      pendingReview: 0,
      supportStatuses: ["INSUFFICIENT"],
      intervention: null,
    });
  }

  return items.sort(
    (a, b) =>
      Number(Boolean(a.intervention && a.kind !== "FOLLOW_UP")) - Number(Boolean(b.intervention && b.kind !== "FOLLOW_UP")) ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      b.pendingReview - a.pendingReview ||
      b.students.length - a.students.length,
  );
}

export async function getAttentionQueue(courseId: string): Promise<AttentionItem[]> {
  return buildAttentionItems(courseId, await loadCourseState(courseId));
}

export interface RecentChange extends Transition {
  studentId: string;
  studentName: string;
}

export interface StudentAttention {
  id: string;
  name: string;
  difficulties: number;
  contradictions: number;
  pending: number;
  evidenceCount: number;
  lastEvidenceAt: Date | null;
}

export async function getCourseOverview(courseId: string) {
  const state = await loadCourseState(courseId);
  const attention = buildAttentionItems(courseId, state);

  const signals = await db.signal.findMany({
    where: { courseId },
    include: {
      evidence: { select: { experienceId: true, occurredAt: true, source: true, assistanceLevel: true } },
      curriculumItem: { select: { title: true } },
      supports: { select: { inference: { select: { reviewStatus: true } } } },
    },
  });
  const byStudent = new Map<string, SnapshotSignal[]>();
  for (const s of signals) {
    if (s.supports.length > 0 && s.supports.every((sup) => sup.inference.reviewStatus === "INCORRECT")) continue;
    const list = byStudent.get(s.studentId) ?? [];
    list.push({
      id: s.id,
      evidenceId: s.evidenceId,
      experienceId: s.evidence.experienceId,
      occurredAt: s.evidence.occurredAt,
      source: s.evidence.source,
      assistanceLevel: s.evidence.assistanceLevel,
      dimension: s.dimension,
      polarity: s.polarity,
      curriculumItemId: s.curriculumItemId,
      curriculumItemTitle: s.curriculumItem?.title ?? null,
    });
    byStudent.set(s.studentId, list);
  }
  const since = Date.now() - 21 * 24 * 60 * 60 * 1000;
  const recentChanges: RecentChange[] = [...byStudent.entries()]
    .filter(([studentId]) => state.names.has(studentId))
    .flatMap(([studentId, list]) =>
      computeTransitions(list).map((t) => ({ ...t, studentId, studentName: state.names.get(studentId)! })),
    )
    .filter((t) => new Date(t.lastSeenAt).getTime() >= since)
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));

  const gaps = attention.filter((a) => a.kind === "GAP");

  const evidenceByStudent = new Map(state.evidenceCounts.map((e) => [e.studentId, e]));
  const students: StudentAttention[] = state.enrollments
    .map((e) => {
      const own = state.inferences.filter((i) => i.studentId === e.studentId);
      const evidence = evidenceByStudent.get(e.studentId);
      return {
        id: e.studentId,
        name: e.student.user.name,
        difficulties: own.filter((i) => i.polarity === "DIFFICULTY").length,
        contradictions: own.filter((i) => i.supportStatus === "CONTRADICTORY").length,
        pending: own.filter((i) => i.requiresReview && i.reviewStatus === "PENDING").length,
        evidenceCount: evidence?._count._all ?? 0,
        lastEvidenceAt: evidence?._max.occurredAt ?? null,
      };
    })
    .sort((a, b) => b.difficulties + b.contradictions - (a.difficulties + a.contradictions) || a.name.localeCompare(b.name));

  const pendingInferences = state.inferences
    .filter((i) => i.requiresReview && i.reviewStatus === "PENDING")
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.createdAt.getTime() - a.createdAt.getTime())
    .map((i) => ({ ...i, studentName: state.names.get(i.studentId) ?? "Estudiante" }));

  return { attention, recentChanges, gaps, students, pendingInferences, enrolledCount: state.enrollments.length };
}

/** Insight de curso (patrón o brecha) con toda su evidencia. */
export async function getCourseInsight(courseId: string, key: string) {
  const [kind, itemId] = key.split(":");
  if ((kind !== "gap" && kind !== "pattern") || !itemId) return null;
  const item = await db.curriculumItem.findFirst({ where: { id: itemId, courseId } });
  if (!item) return null;
  const state = await loadCourseState(courseId);
  const group = groupByItem(state.inferences).get(itemId);
  const attention = buildAttentionItems(courseId, state).find((a) => a.key === key) ?? null;
  const studentIds = group ? [...(kind === "gap" ? group.gapStudents : group.difficultyStudents)] : [];

  const inferences = await db.inference.findMany({
    where: {
      courseId,
      curriculumItemId: itemId,
      studentId: { in: studentIds },
      state: "ACTIVE",
      reviewStatus: { not: "INCORRECT" },
      ...(kind === "pattern" ? { polarity: "DIFFICULTY" } : {}),
    },
    orderBy: [{ studentId: "asc" }, { createdAt: "desc" }],
    include: {
      student: { include: { user: { select: { name: true } } } },
      supports: {
        include: {
          signal: true,
          evidence: { include: { experience: { select: { id: true, title: true, type: true } } } },
        },
      },
      suggestedActions: { where: { audience: "TEACHER", status: "OPEN" } },
    },
  });

  const interventions = await db.intervention.findMany({
    where: { courseId, OR: [{ insightKey: key }, { curriculumItemId: itemId }] },
    orderBy: { occurredAt: "desc" },
    include: { targets: { include: { student: { include: { user: { select: { name: true } } } } } } },
  });

  const dimensions: Dimension[] = [...new Set(inferences.map((i) => i.dimension))];
  return { kind: kind as "gap" | "pattern", key, item, attention, inferences, interventions, dimensions, studentIds };
}
