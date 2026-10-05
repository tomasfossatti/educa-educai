import "server-only";
import type { Prisma, SnapshotDimension } from "@prisma/client";
import type { DimensionDetails } from "@/domain/snapshot";
import { db } from "@/server/db";

/**
 * Lecturas del desarrollo de un estudiante en una materia.
 * La autorización (quién puede ver a quién) se resuelve antes, en los guards.
 */

export type Viewer = "student" | "teacher";

const DIMENSION_ORDER: SnapshotDimension[] = ["COMPREHENSION", "APPLICATION", "TRANSFER", "AUTONOMY", "CONSISTENCY", "EVOLUTION"];

export async function getSnapshots(studentId: string, courseId: string) {
  const snapshots = await db.developmentSnapshot.findMany({
    where: { studentId, courseId },
    orderBy: { createdAt: "desc" },
    take: 12,
    include: { dimensions: true },
  });
  return snapshots.map((s) => ({
    ...s,
    dimensions: [...s.dimensions]
      .sort((a, b) => DIMENSION_ORDER.indexOf(a.dimension) - DIMENSION_ORDER.indexOf(b.dimension))
      .map((d) => ({ ...d, details: d.details as unknown as DimensionDetails })),
  }));
}

/** Filtro de inferencias visibles: el estudiante no ve las marcadas como incorrectas por su docente. */
export function inferenceVisibility(viewer: Viewer): Prisma.InferenceWhereInput {
  return viewer === "student" ? { reviewStatus: { not: "INCORRECT" } } : {};
}

export async function getActiveInferences(studentId: string, courseId: string, viewer: Viewer, take = 50) {
  return db.inference.findMany({
    where: { studentId, courseId, state: "ACTIVE", ...inferenceVisibility(viewer) },
    orderBy: [{ createdAt: "desc" }],
    take,
    include: {
      curriculumItem: { select: { id: true, title: true } },
      _count: { select: { supports: true } },
      supports: { select: { evidenceId: true, relation: true } },
    },
  });
}

export async function getEvidenceList(studentId: string, courseId: string, options?: { ids?: string[]; take?: number }) {
  return db.evidenceObject.findMany({
    where: { studentId, courseId, ...(options?.ids ? { id: { in: options.ids } } : {}) },
    orderBy: { occurredAt: "desc" },
    take: options?.take ?? 100,
    include: {
      experience: { select: { id: true, title: true, type: true } },
      curriculumLinks: { include: { curriculumItem: { select: { title: true } } } },
      _count: { select: { signals: true } },
    },
  });
}

export async function getFeedbackForExperience(studentId: string, experienceId: string) {
  return db.feedback.findFirst({
    where: { studentId, experienceId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getInferencesByIds(ids: string[], viewer: Viewer) {
  if (ids.length === 0) return [];
  return db.inference.findMany({
    where: { id: { in: ids }, ...inferenceVisibility(viewer) },
    include: { curriculumItem: { select: { title: true } }, _count: { select: { supports: true } } },
  });
}

/** Detalle de una inferencia con toda su trazabilidad. */
/** Un docente solo ve estudiantes con inscripción activa en su materia. */
function activeStudentIn(courseId: string) {
  return { enrollments: { some: { courseId, status: "ACTIVE" as const } } };
}

export async function getInferenceDetail(inferenceId: string, courseId: string, viewer: Viewer, studentId?: string) {
  const inference = await db.inference.findFirst({
    where: {
      id: inferenceId,
      courseId,
      ...(studentId ? { studentId } : { student: activeStudentIn(courseId) }),
      ...inferenceVisibility(viewer),
    },
    include: {
      student: { include: { user: { select: { id: true, name: true } } } },
      curriculumItem: true,
      run: { select: { id: true, createdAt: true, promptVersion: true, origin: true } },
      supports: {
        include: {
          signal: true,
          evidence: {
            include: {
              experience: { select: { id: true, title: true, type: true } },
              curriculumLinks: { include: { curriculumItem: { select: { title: true } } } },
            },
          },
        },
      },
      reviews: { orderBy: { createdAt: "desc" }, include: { teacher: { include: { user: { select: { name: true } } } } } },
      studentResponses: { orderBy: { createdAt: "desc" } },
      suggestedActions: { where: { audience: "TEACHER" } },
      supersedes: { select: { id: true, statement: true, studentStatement: true, createdAt: true, supportStatus: true, polarity: true } },
      supersededBy: { select: { id: true, statement: true, studentStatement: true, createdAt: true } },
      interventions: {
        orderBy: { occurredAt: "desc" },
        include: { targets: { include: { student: { include: { user: { select: { name: true } } } } } } },
      },
    },
  });
  return inference;
}

export type InferenceDetail = NonNullable<Awaited<ReturnType<typeof getInferenceDetail>>>;

/** Detalle de un Evidence Object con su fuente original (solo los mensajes referenciados). */
export async function getEvidenceDetail(evidenceId: string, courseId: string, viewer: Viewer, studentId?: string) {
  const evidence = await db.evidenceObject.findFirst({
    where: { id: evidenceId, courseId, ...(studentId ? { studentId } : { student: activeStudentIn(courseId) }) },
    include: {
      student: { include: { user: { select: { id: true, name: true } } } },
      experience: { include: { conversation: { select: { id: true } }, submission: { include: { activity: true } } } },
      run: { select: { id: true, createdAt: true, promptVersion: true, origin: true } },
      curriculumLinks: { include: { curriculumItem: true } },
      signals: { include: { curriculumItem: { select: { title: true } } } },
      supports: {
        where: { inference: inferenceVisibility(viewer) },
        include: { inference: { include: { curriculumItem: { select: { title: true } } } } },
      },
      evaluationLinks: { include: { evaluation: { include: { criterion: { select: { title: true } } } } } },
    },
  });
  if (!evidence) return null;

  const provenance = evidence.provenance as { messageIds?: string[]; promptKeys?: string[]; excerptVerified?: boolean; model?: string; origin?: string };
  const sourceMessages =
    evidence.experience.conversation && provenance.messageIds?.length
      ? await db.message.findMany({
          where: { id: { in: provenance.messageIds }, conversationId: evidence.experience.conversation.id },
          orderBy: { createdAt: "asc" },
        })
      : [];
  return { ...evidence, provenance, sourceMessages };
}

export type EvidenceDetail = NonNullable<Awaited<ReturnType<typeof getEvidenceDetail>>>;

/** Evidencia posterior a una intervención para sus destinatarios (seguimiento del loop). */
export async function getInterventionFollowUp(interventionId: string, courseId: string) {
  const intervention = await db.intervention.findFirst({
    where: { id: interventionId, courseId },
    include: { targets: true },
  });
  if (!intervention) return [];
  const studentIds = intervention.targets.map((t) => t.studentId);
  return db.evidenceObject.findMany({
    where: {
      courseId,
      studentId: { in: studentIds },
      occurredAt: { gt: intervention.occurredAt },
      ...(intervention.curriculumItemId
        ? {
            OR: [
              { curriculumLinks: { some: { curriculumItemId: intervention.curriculumItemId } } },
              { signals: { some: { curriculumItemId: intervention.curriculumItemId } } },
            ],
          }
        : {}),
    },
    orderBy: { occurredAt: "asc" },
    include: {
      student: { include: { user: { select: { name: true } } } },
      experience: { select: { title: true } },
      signals: { select: { dimension: true, polarity: true, curriculumItemId: true, description: true } },
    },
  });
}

/** Cantidad de Evidence Objects distintos detrás de cada inferencia (a favor y en contra). */
export async function supportingEvidenceCounts(inferenceIds: string[]): Promise<Map<string, number>> {
  if (inferenceIds.length === 0) return new Map();
  const rows = await db.inferenceSupport.findMany({
    where: { inferenceId: { in: inferenceIds } },
    select: { inferenceId: true, evidenceId: true },
    distinct: ["inferenceId", "evidenceId"],
  });
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.inferenceId, (counts.get(r.inferenceId) ?? 0) + 1);
  return counts;
}
