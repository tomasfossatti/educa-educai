/**
 * Constructores del seed de demostración.
 *
 * Los datos de demo escriben directamente lo que el Interpretation Engine
 * produciría (evidencia, señales, inferencias), marcados con origin "seed" en
 * su provenance. Lo derivado (snapshots) se calcula con la lógica real.
 */
import type {
  ActionType,
  AssistanceLevel,
  AssistanceSource,
  Dimension,
  EvaluationResult,
  EvidenceKind,
  EvidenceSource,
  Polarity,
  Priority,
  ReviewStatus,
  SupportStatus,
} from "@prisma/client";
import { isVerbatimExcerpt } from "@/domain/text-guards";
import { db } from "@/server/db";

export const DAY = 24 * 60 * 60 * 1000;

/** Fecha relativa a hoy (días atrás) a una hora fija, para que el demo sea reproducible. */
export function daysAgo(days: number, hour = 10, minute = 0): Date {
  const d = new Date(Date.now() - days * DAY);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export async function seedRun(params: { courseId: string; studentId: string; experienceId: string; source: EvidenceSource; at: Date }) {
  return db.interpretationRun.create({
    data: {
      courseId: params.courseId,
      studentId: params.studentId,
      experienceId: params.experienceId,
      source: params.source,
      status: "COMPLETED",
      promptVersion: "seed@demo",
      origin: "seed",
      createdAt: params.at,
      startedAt: params.at,
      completedAt: addMinutes(params.at, 1),
      steps: [],
    },
  });
}

export interface EvidenceInput {
  run: { id: string; courseId: string; studentId: string; experienceId: string; source: EvidenceSource };
  kind: EvidenceKind;
  observation: string;
  content: string;
  /** Texto fuente del que sale la cita (se verifica que sea literal). */
  sourceText: string;
  context: string;
  assistance: AssistanceLevel;
  assistanceSource: AssistanceSource;
  assistanceNote?: string;
  at: Date;
  itemIds: string[];
  messageIds?: string[];
  promptKeys?: string[];
  submissionId?: string;
}

export async function seedEvidence(input: EvidenceInput) {
  if (!isVerbatimExcerpt(input.content, input.sourceText)) {
    throw new Error(`Seed inconsistente: la cita no es literal → "${input.content.slice(0, 60)}"`);
  }
  return db.evidenceObject.create({
    data: {
      courseId: input.run.courseId,
      studentId: input.run.studentId,
      experienceId: input.run.experienceId,
      runId: input.run.id,
      source: input.run.source,
      kind: input.kind,
      observation: input.observation,
      content: input.content,
      context: input.context,
      assistanceLevel: input.assistance,
      assistanceSource: input.assistanceSource,
      assistanceNote: input.assistanceNote ?? null,
      occurredAt: input.at,
      createdAt: addMinutes(input.at, 1),
      provenance: {
        origin: "seed",
        runId: input.run.id,
        model: "seed",
        promptVersion: "seed@demo",
        messageIds: input.messageIds ?? [],
        submissionId: input.submissionId ?? null,
        promptKeys: input.promptKeys ?? [],
        excerptVerified: true,
      },
      curriculumLinks: { create: input.itemIds.map((curriculumItemId) => ({ curriculumItemId })) },
    },
  });
}

export async function seedSignal(params: {
  evidence: { id: string; courseId: string; studentId: string; runId: string | null; createdAt: Date };
  dimension: Dimension;
  polarity: Polarity;
  itemId: string | null;
  description: string;
  rationale: string;
}) {
  return db.signal.create({
    data: {
      evidenceId: params.evidence.id,
      courseId: params.evidence.courseId,
      studentId: params.evidence.studentId,
      runId: params.evidence.runId,
      dimension: params.dimension,
      polarity: params.polarity,
      curriculumItemId: params.itemId,
      description: params.description,
      rationale: params.rationale,
      createdAt: params.evidence.createdAt,
    },
  });
}

export async function seedInference(params: {
  run: { id: string; courseId: string; studentId: string };
  statement: string;
  studentStatement: string;
  dimension: Dimension;
  polarity: Polarity;
  itemId: string | null;
  support: SupportStatus;
  proposed?: SupportStatus;
  rationale: string;
  policyNotes?: string[];
  contradictionNote?: string;
  requiresReview: boolean;
  priority: Priority;
  supports: { signal: { id: string; evidenceId: string }; relation?: "SUPPORTS" | "CONTRADICTS" }[];
  at: Date;
  supersedesId?: string;
  reviewStatus?: ReviewStatus;
  teacherAction?: { type: ActionType; description: string; done?: boolean };
}) {
  if (params.supersedesId) {
    await db.inference.update({ where: { id: params.supersedesId }, data: { state: "SUPERSEDED" } });
  }
  const inference = await db.inference.create({
    data: {
      courseId: params.run.courseId,
      studentId: params.run.studentId,
      runId: params.run.id,
      statement: params.statement,
      studentStatement: params.studentStatement,
      dimension: params.dimension,
      polarity: params.polarity,
      curriculumItemId: params.itemId,
      supportStatus: params.support,
      proposedSupportStatus: params.proposed ?? params.support,
      supportRationale: params.rationale,
      policyNotes: params.policyNotes ?? [],
      contradictionNote: params.contradictionNote ?? null,
      requiresReview: params.requiresReview,
      reviewStatus: params.reviewStatus ?? "PENDING",
      priority: params.priority,
      supersedesId: params.supersedesId ?? null,
      createdAt: params.at,
      supports: {
        create: params.supports.map((s) => ({ signalId: s.signal.id, evidenceId: s.signal.evidenceId, relation: s.relation ?? "SUPPORTS" })),
      },
    },
  });
  if (params.teacherAction) {
    await db.suggestedAction.create({
      data: {
        courseId: params.run.courseId,
        studentId: params.run.studentId,
        audience: "TEACHER",
        source: "ENGINE",
        type: params.teacherAction.type,
        title: params.teacherAction.description.slice(0, 140),
        description: params.teacherAction.description,
        curriculumItemId: params.itemId,
        inferenceId: inference.id,
        runId: params.run.id,
        status: params.teacherAction.done ? "DONE" : "OPEN",
        createdAt: params.at,
      },
    });
  }
  return inference;
}

export async function seedEvaluation(params: {
  run: { id: string; courseId: string; studentId: string };
  submissionId: string;
  criterionId: string;
  result: EvaluationResult;
  rationale: string;
  evidenceIds: string[];
  at: Date;
}) {
  return db.evaluation.create({
    data: {
      courseId: params.run.courseId,
      studentId: params.run.studentId,
      submissionId: params.submissionId,
      criterionId: params.criterionId,
      runId: params.run.id,
      result: params.result,
      rationale: params.rationale,
      createdAt: params.at,
      evidence: { create: params.evidenceIds.map((evidenceId) => ({ evidenceId })) },
    },
  });
}

export async function seedFeedback(params: {
  run: { id: string; courseId: string; studentId: string; experienceId: string };
  summary: string;
  contrast?: string;
  inferenceIds: string[];
  evidenceIds: string[];
  at: Date;
  viewed: boolean;
  nextSteps?: { type: ActionType; title: string; description: string; itemId?: string; activityId?: string; status?: "OPEN" | "DONE" }[];
}) {
  const feedback = await db.feedback.create({
    data: {
      courseId: params.run.courseId,
      studentId: params.run.studentId,
      runId: params.run.id,
      experienceId: params.run.experienceId,
      summary: params.summary,
      contrastWithDeclared: params.contrast ?? null,
      inferenceIds: params.inferenceIds,
      evidenceIds: params.evidenceIds,
      createdAt: params.at,
      viewedAt: params.viewed ? addMinutes(params.at, 90) : null,
    },
  });
  const actions = [];
  for (const step of params.nextSteps ?? []) {
    actions.push(
      await db.suggestedAction.create({
        data: {
          courseId: params.run.courseId,
          studentId: params.run.studentId,
          audience: "STUDENT",
          source: "ENGINE",
          type: step.type,
          title: step.title,
          description: step.description,
          curriculumItemId: step.itemId ?? null,
          activityId: step.activityId ?? null,
          runId: params.run.id,
          status: step.status ?? "OPEN",
          completedAt: step.status === "DONE" ? addMinutes(params.at, 60 * 24) : null,
          createdAt: params.at,
        },
      }),
    );
  }
  return { feedback, actions };
}

/** Conversación con mensajes alternados y horarios plausibles. */
export async function seedConversation(params: {
  courseId: string;
  studentId: string;
  title: string;
  focusItemId?: string;
  suggestedActionId?: string;
  start: Date;
  messages: [role: "STUDENT" | "TUTOR", content: string][];
}) {
  const experience = await db.experience.create({
    data: {
      courseId: params.courseId,
      studentId: params.studentId,
      type: "AI_CONVERSATION",
      title: params.title,
      startedAt: params.start,
      completedAt: addMinutes(params.start, params.messages.length * 3 + 2),
    },
  });
  const conversation = await db.aIConversation.create({
    data: {
      experienceId: experience.id,
      courseId: params.courseId,
      studentId: params.studentId,
      title: params.title,
      focusItemId: params.focusItemId ?? null,
      suggestedActionId: params.suggestedActionId ?? null,
      status: "CLOSED",
      createdAt: params.start,
      closedAt: experience.completedAt,
    },
  });
  const messages = [];
  for (const [i, [role, content]] of params.messages.entries()) {
    messages.push(
      await db.message.create({ data: { conversationId: conversation.id, role, content, createdAt: addMinutes(params.start, i * 3) } }),
    );
  }
  return { experience, conversation, messages };
}

export async function seedSubmission(params: {
  courseId: string;
  studentId: string;
  activity: { id: string; title: string };
  answers: Record<string, string>;
  declaredAssistance: "NONE" | "TUTOR_ONLY" | "EXTERNAL_AI_PARTIAL" | "EXTERNAL_AI_EXTENSIVE" | "PEER_OR_OTHER";
  assistanceNote?: string;
  confidence?: "LOW" | "MEDIUM" | "HIGH";
  at: Date;
}) {
  const experience = await db.experience.create({
    data: {
      courseId: params.courseId,
      studentId: params.studentId,
      type: "CHALLENGE",
      title: params.activity.title,
      activityId: params.activity.id,
      startedAt: addMinutes(params.at, -40),
      completedAt: params.at,
    },
  });
  const submission = await db.submission.create({
    data: {
      activityId: params.activity.id,
      studentId: params.studentId,
      experienceId: experience.id,
      answers: params.answers,
      declaredAssistance: params.declaredAssistance,
      assistanceNote: params.assistanceNote ?? null,
      confidence: params.confidence ?? null,
      status: "SUBMITTED",
      submittedAt: params.at,
      createdAt: addMinutes(params.at, -40),
    },
  });
  return { experience, submission };
}
