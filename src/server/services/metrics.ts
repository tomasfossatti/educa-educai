import "server-only";
import { db } from "@/server/db";
import { EVENT } from "@/server/events";

/**
 * Métricas del piloto: activación, engagement, calidad de inferencias, cierre del loop y costo IA.
 * Se calculan sobre los datos (no sobre contadores agregados) para que sean auditables.
 */

export interface Ratio {
  value: number;
  total: number;
}

export interface PilotMetrics {
  period: { from: Date; to: Date };
  student: {
    enrolled: number;
    onboardingCompleted: number;
    withEvidence: number;
    feedbackViewed: number;
    recurrent: number;
    nextSteps: Ratio;
  };
  teacher: {
    curriculumConfigured: number;
    courses: number;
    activitiesAnalyzed: number;
    insightsOpened: number;
    inferencesReviewed: number;
    interventions: number;
  };
  quality: {
    inferences: number;
    reviewed: number;
    confirmed: number;
    partiallyCorrect: number;
    incorrect: number;
    needsContext: number;
    contradictory: number;
    insufficientRuns: number;
    insufficientAreas: number;
    policyAdjusted: number;
  };
  loop: {
    insightToAction: Ratio;
    actionToEvidence: Ratio;
  };
  cost: {
    totalUsd: number;
    costActiveStudents: number;
    costPerCas: number | null;
    byOperation: { operation: string; calls: number; failed: number; costUsd: number; inputTokens: number; outputTokens: number }[];
  };
}

export async function computeMetrics(params: { courseId?: string; days?: number } = {}): Promise<PilotMetrics> {
  const to = new Date();
  const from = new Date(to.getTime() - (params.days ?? 30) * 24 * 60 * 60 * 1000);
  const course = params.courseId ? { courseId: params.courseId } : {};
  const inPeriod = { gte: from, lte: to };

  const enrollments = await db.enrollment.findMany({
    where: { ...course, status: "ACTIVE" },
    select: { studentId: true, student: { select: { onboardingCompletedAt: true } } },
  });
  const studentIds = [...new Set(enrollments.map((e) => e.studentId))];
  const onboardingCompleted = new Set(enrollments.filter((e) => e.student.onboardingCompletedAt).map((e) => e.studentId)).size;

  const [withEvidence, feedbackViewed, activeDays, actions] = await Promise.all([
    db.evidenceObject.findMany({ where: { ...course, studentId: { in: studentIds } }, distinct: ["studentId"], select: { studentId: true } }),
    db.feedback.findMany({ where: { ...course, studentId: { in: studentIds }, viewedAt: { not: null } }, distinct: ["studentId"], select: { studentId: true } }),
    db.productEvent.findMany({
      where: { name: EVENT.studentActiveDay, studentId: { in: studentIds }, createdAt: inPeriod },
      select: { studentId: true },
    }),
    db.suggestedAction.groupBy({
      by: ["status"],
      where: { ...course, audience: "STUDENT", studentId: { in: studentIds } },
      _count: { _all: true },
    }),
  ]);
  const daysByStudent = new Map<string, number>();
  for (const e of activeDays) if (e.studentId) daysByStudent.set(e.studentId, (daysByStudent.get(e.studentId) ?? 0) + 1);
  const totalActions = actions.reduce((n, a) => n + a._count._all, 0);
  const doneActions = actions.find((a) => a.status === "DONE")?._count._all ?? 0;

  const courseWhere = params.courseId ? { id: params.courseId } : {};
  const [courses, configured, analyzedEvents, insightEvents, reviewed, interventions] = await Promise.all([
    db.course.count({ where: courseWhere }),
    db.course.count({ where: { ...courseWhere, curriculumConfirmedAt: { not: null } } }),
    db.productEvent.count({ where: { ...course, name: EVENT.teacherActivityAnalyzed } }),
    db.productEvent.findMany({ where: { ...course, name: EVENT.teacherInsightOpened }, select: { properties: true } }),
    db.teacherReview.findMany({ where: { inference: course }, distinct: ["inferenceId"], select: { inferenceId: true } }),
    db.intervention.findMany({ where: course, select: { insightKey: true, inferenceId: true, followUpEvidenceAt: true } }),
  ]);

  const inferences = await db.inference.findMany({
    where: course,
    select: { reviewStatus: true, supportStatus: true, policyNotes: true },
  });
  const runs = await db.interpretationRun.findMany({
    where: { ...course, status: { in: ["COMPLETED", "INSUFFICIENT"] } },
    select: { status: true, insufficient: true },
  });
  const count = (status: string) => inferences.filter((i) => i.reviewStatus === status).length;

  const openedKeys = new Set(
    insightEvents.map((e) => (e.properties as { key?: string } | null)?.key).filter((k): k is string => Boolean(k)),
  );
  const actedKeys = new Set(
    interventions.flatMap((i) => [i.insightKey, i.inferenceId ? `inference:${i.inferenceId}` : null]).filter((k): k is string => Boolean(k)),
  );

  const usage = await db.aIUsageEvent.findMany({
    where: { ...course, createdAt: inPeriod },
    select: { operation: true, success: true, estimatedCostUsd: true, studentId: true, inputTokens: true, outputTokens: true },
  });
  const byOperation = new Map<string, PilotMetrics["cost"]["byOperation"][number]>();
  const casStudents = new Set<string>();
  let totalUsd = 0;
  for (const u of usage) {
    const cost = u.estimatedCostUsd ? Number(u.estimatedCostUsd) : 0;
    totalUsd += cost;
    if (u.studentId && cost > 0) casStudents.add(u.studentId);
    const row = byOperation.get(u.operation) ?? { operation: u.operation, calls: 0, failed: 0, costUsd: 0, inputTokens: 0, outputTokens: 0 };
    row.calls += 1;
    if (!u.success) row.failed += 1;
    row.costUsd += cost;
    row.inputTokens += u.inputTokens;
    row.outputTokens += u.outputTokens;
    byOperation.set(u.operation, row);
  }

  return {
    period: { from, to },
    student: {
      enrolled: studentIds.length,
      onboardingCompleted,
      withEvidence: withEvidence.length,
      feedbackViewed: feedbackViewed.length,
      recurrent: [...daysByStudent.values()].filter((d) => d >= 2).length,
      nextSteps: { value: doneActions, total: totalActions },
    },
    teacher: {
      curriculumConfigured: configured,
      courses,
      activitiesAnalyzed: analyzedEvents,
      insightsOpened: openedKeys.size,
      inferencesReviewed: reviewed.length,
      interventions: interventions.length,
    },
    quality: {
      inferences: inferences.length,
      reviewed: inferences.filter((i) => i.reviewStatus !== "PENDING").length,
      confirmed: count("CONFIRMED"),
      partiallyCorrect: count("PARTIALLY_CORRECT"),
      incorrect: count("INCORRECT"),
      needsContext: count("NEEDS_CONTEXT"),
      contradictory: inferences.filter((i) => i.supportStatus === "CONTRADICTORY").length,
      insufficientRuns: runs.filter((r) => r.status === "INSUFFICIENT").length,
      insufficientAreas: runs.reduce((n, r) => n + (Array.isArray(r.insufficient) ? r.insufficient.length : 0), 0),
      policyAdjusted: inferences.filter((i) => Array.isArray(i.policyNotes) && i.policyNotes.length > 0).length,
    },
    loop: {
      insightToAction: { value: [...openedKeys].filter((k) => actedKeys.has(k)).length, total: openedKeys.size },
      actionToEvidence: { value: interventions.filter((i) => i.followUpEvidenceAt).length, total: interventions.length },
    },
    cost: {
      totalUsd: Math.round(totalUsd * 10000) / 10000,
      costActiveStudents: casStudents.size,
      costPerCas: casStudents.size > 0 ? Math.round((totalUsd / casStudents.size) * 10000) / 10000 : null,
      byOperation: [...byOperation.values()].sort((a, b) => b.costUsd - a.costUsd),
    },
  };
}
