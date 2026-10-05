import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { computeSnapshot, computeTransitions, type SnapshotEvidence, type SnapshotSignal } from "@/domain/snapshot";

/**
 * Señales vigentes de un estudiante en una materia.
 * Se excluyen las señales cuyas inferencias fueron todas marcadas como incorrectas por el docente.
 */
export async function loadSnapshotSignals(studentId: string, courseId: string, asOf?: Date): Promise<SnapshotSignal[]> {
  const signals = await db.signal.findMany({
    where: { studentId, courseId, evidence: asOf ? { occurredAt: { lte: asOf } } : undefined },
    include: {
      evidence: { select: { experienceId: true, occurredAt: true, source: true, assistanceLevel: true } },
      curriculumItem: { select: { title: true } },
      supports: { select: { inference: { select: { reviewStatus: true } } } },
    },
  });
  return signals
    .filter((s) => s.supports.length === 0 || s.supports.some((sup) => sup.inference.reviewStatus !== "INCORRECT"))
    .map((s) => ({
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
    }));
}

async function loadSnapshotEvidence(studentId: string, courseId: string, asOf?: Date): Promise<SnapshotEvidence[]> {
  return db.evidenceObject.findMany({
    where: { studentId, courseId, occurredAt: asOf ? { lte: asOf } : undefined },
    select: { id: true, experienceId: true, occurredAt: true, assistanceLevel: true },
  });
}

/** Calcula y guarda un snapshot nuevo (los anteriores se conservan como historial). */
export async function computeAndStoreSnapshot(params: {
  studentId: string;
  courseId: string;
  runId?: string | null;
  asOf?: Date;
}): Promise<string> {
  const [signals, evidence] = await Promise.all([
    loadSnapshotSignals(params.studentId, params.courseId, params.asOf),
    loadSnapshotEvidence(params.studentId, params.courseId, params.asOf),
  ]);
  const computed = computeSnapshot(signals, evidence);
  const snapshot = await db.developmentSnapshot.create({
    data: {
      studentId: params.studentId,
      courseId: params.courseId,
      runId: params.runId ?? null,
      evidenceCount: computed.evidenceCount,
      experienceCount: computed.experienceCount,
      createdAt: params.asOf ?? new Date(),
      dimensions: {
        create: computed.dimensions.map((d) => ({
          dimension: d.dimension,
          status: d.status,
          summary: d.summary,
          details: d.details as unknown as Prisma.InputJsonValue,
          signalIds: d.signalIds,
          evidenceIds: d.evidenceIds,
        })),
      },
    },
  });
  return snapshot.id;
}

export async function loadTransitions(studentId: string, courseId: string) {
  return computeTransitions(await loadSnapshotSignals(studentId, courseId));
}
