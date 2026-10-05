import "server-only";
import type {
  ActionType,
  AssistanceLevel,
  AssistanceSource,
  DeclaredAssistance,
  Dimension,
  EvaluationResult,
  EvidenceKind,
  EvidenceSource,
  Polarity,
  Prisma,
  Priority,
  SupportStatus,
} from "@prisma/client";
import { parseActivityPrompts, parseAnswers } from "@/domain/activity";
import { applySupportPolicy, requiresTeacherReview, type SupportEvidence } from "@/domain/support-policy";
import { containsFalsePrecision, isVerbatimExcerpt, stripFalsePrecision, truncate } from "@/domain/text-guards";
import { dimensionLabel, evaluationResultLabel, polarityLabel, supportStatusLabel } from "@/domain/labels";
import { AIError, generateStructuredWithRetry } from "@/server/ai";
import { modelFor } from "@/server/ai/config";
import { evaluationSchema, EVALUATE_SYSTEM, buildEvaluateMessage } from "@/server/ai/prompts/evaluate";
import { feedbackSchema, FEEDBACK_SYSTEM, buildFeedbackMessage, type FeedbackOutput } from "@/server/ai/prompts/feedback";
import { inferenceSchema, INFER_SYSTEM, buildInferMessage, type SignalLine } from "@/server/ai/prompts/infer";
import {
  OBSERVE_SYSTEM,
  buildObserveConversationMessage,
  buildObserveSubmissionMessage,
  observationSchema,
  type ObservationOutput,
} from "@/server/ai/prompts/observe";
import { ENGINE_PROMPT_VERSION, type RefCurriculumItem } from "@/server/ai/prompts/shared";
import { SIGNALS_SYSTEM, buildSignalsMessage, signalsSchema } from "@/server/ai/prompts/signals";
import { db } from "@/server/db";
import { EVENT, track } from "@/server/events";
import { computeAndStoreSnapshot } from "./snapshot";

/**
 * Interpretation Engine — pipeline explícito:
 *  1. recibir evidencia (conversación o entrega)
 *  2. observar (qué ocurrió)                       → prompt interpret.observe
 *  3. extraer señales y vincular con la currícula  → prompt interpret.signals
 *  4. evaluar contra criterios (solo entregas)     → prompt interpret.evaluate
 *  5. contrastar con historial y detectar posibles contradicciones (determinista)
 *  6. inferir                                      → prompt interpret.infer
 *  7. aplicar política de respaldo (determinista)
 *  8. generar feedback y próximos pasos            → prompt interpret.feedback
 *  9. persistir todo en una transacción y dejar inferencias para revisión docente
 * 10. actualizar el Development Snapshot y cerrar el loop con intervenciones previas
 */

const MAX_OBSERVATIONS = 8;
const MAX_INFERENCES = 5;
const HISTORY_LIMIT = 25;

type StepName = "precheck" | "observe" | "signals" | "evaluate" | "history" | "infer" | "feedback" | "persist" | "snapshot";

interface StepEntry {
  step: StepName;
  status: "done" | "skipped" | "failed";
  at: string;
  note?: string;
}

const CURRICULUM_PREFIX = { CONCEPT: "C", OBJECTIVE: "O", COMPETENCY: "K", CRITERION: "R" } as const;

const DECLARED_TO_LEVEL: Record<DeclaredAssistance, AssistanceLevel> = {
  NONE: "NONE",
  TUTOR_ONLY: "LOW",
  EXTERNAL_AI_PARTIAL: "MEDIUM",
  EXTERNAL_AI_EXTENSIVE: "HIGH",
  PEER_OR_OTHER: "MEDIUM",
};

interface DraftEvidence {
  kind: EvidenceKind;
  observation: string;
  content: string;
  context: string;
  assistanceLevel: AssistanceLevel;
  assistanceSource: AssistanceSource;
  assistanceNote: string | null;
  occurredAt: Date;
  messageIds: string[];
  promptKeys: string[];
  excerptVerified: boolean;
  curriculumItemIds: string[];
}

interface DraftSignal {
  evidenceRef: string;
  dimension: Dimension;
  polarity: Polarity;
  curriculumItemId: string | null;
  description: string;
  rationale: string;
}

interface DraftEvaluation {
  criterionId: string;
  result: EvaluationResult;
  rationale: string;
  evidenceRefs: string[];
}

interface SignalRefTarget {
  /** "draft" = señal nueva de esta corrida; "db" = señal histórica. */
  origin: "draft" | "db";
  key: string;
  evidence: SupportEvidence;
  dimension: Dimension;
  polarity: Polarity;
  curriculumItemId: string | null;
}

interface DraftInference {
  statement: string;
  studentStatement: string;
  dimension: Dimension;
  polarity: Polarity;
  curriculumItemId: string | null;
  supporting: SignalRefTarget[];
  contradicting: SignalRefTarget[];
  proposedSupport: SupportStatus;
  supportStatus: SupportStatus;
  supportRationale: string;
  policyNotes: string[];
  contradictionNote: string | null;
  supersedesId: string | null;
  priority: Priority;
  requiresReview: boolean;
  teacherAction: { type: ActionType; description: string } | null;
}

class RefMap<T> {
  private byRef = new Map<string, T>();
  private counter = 0;
  constructor(private prefix: string) {}
  add(value: T, ref?: string): string {
    const key = ref ?? `${this.prefix}${++this.counter}`;
    this.byRef.set(key, value);
    return key;
  }
  get(ref: string | null | undefined): T | undefined {
    return ref ? this.byRef.get(ref.trim()) : undefined;
  }
  entries(): [string, T][] {
    return [...this.byRef.entries()];
  }
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function loadRun(runId: string) {
  return db.interpretationRun.findUnique({
    where: { id: runId },
    include: {
      course: true,
      student: true,
      experience: {
        include: {
          activity: true,
          conversation: {
            include: {
              messages: { orderBy: { createdAt: "asc" } },
              focusItem: true,
              activity: true,
            },
          },
          submission: {
            include: {
              activity: { include: { curriculumLinks: { include: { curriculumItem: true } } } },
            },
          },
        },
      },
    },
  });
}

type LoadedRun = NonNullable<Awaited<ReturnType<typeof loadRun>>>;

export async function runInterpretation(runId: string): Promise<void> {
  // Reclama la corrida de forma atómica (evita ejecuciones duplicadas).
  const claimed = await db.interpretationRun.updateMany({
    where: { id: runId, status: "QUEUED" },
    data: { status: "RUNNING", startedAt: new Date() },
  });
  if (claimed.count === 0) return;

  const run = await loadRun(runId);
  if (!run) return;

  const steps: StepEntry[] = [];
  const logStep = async (entry: Omit<StepEntry, "at">) => {
    steps.push({ ...entry, at: new Date().toISOString() });
    await db.interpretationRun.update({
      where: { id: runId },
      data: { steps: steps as unknown as Prisma.InputJsonValue },
    });
  };

  try {
    const outcome = await interpret(run, logStep);
    await db.interpretationRun.update({
      where: { id: runId },
      data: {
        status: outcome.status,
        statusNote: outcome.note,
        completedAt: new Date(),
      },
    });
    await track(EVENT.engineRunFinished, {
      courseId: run.courseId,
      studentId: run.studentId,
      properties: { runId, status: outcome.status, ...outcome.counts },
    });
  } catch (error) {
    const message =
      error instanceof AIError
        ? error.message
        : error instanceof Error
          ? `Error interno del análisis: ${error.message}`
          : "Error interno del análisis.";
    console.error(`[engine] corrida ${runId} falló`, error);
    steps.push({ step: steps.length ? steps[steps.length - 1].step : "precheck", status: "failed", at: new Date().toISOString(), note: message });
    await db.interpretationRun.update({
      where: { id: runId },
      data: { status: "FAILED", error: message, completedAt: new Date(), steps: steps as unknown as Prisma.InputJsonValue },
    });
    await track(EVENT.engineRunFinished, {
      courseId: run.courseId,
      studentId: run.studentId,
      properties: { runId, status: "FAILED" },
    });
  }
}

interface Outcome {
  status: "COMPLETED" | "INSUFFICIENT";
  note: string | null;
  counts: Record<string, number>;
}

async function interpret(run: LoadedRun, logStep: (e: Omit<StepEntry, "at">) => Promise<void>): Promise<Outcome> {
  const usage = { actorUserId: run.studentId, studentId: run.studentId, courseId: run.courseId, runId: run.id };
  const experience = run.experience;
  const source: EvidenceSource = run.source;

  // ── Currícula con refs cortas ──
  const curriculumItems = await db.curriculumItem.findMany({
    where: { courseId: run.courseId, status: "ACCEPTED" },
    orderBy: [{ kind: "asc" }, { position: "asc" }],
  });
  const curriculumRefs = new RefMap<(typeof curriculumItems)[number]>("");
  const counters = { CONCEPT: 0, OBJECTIVE: 0, COMPETENCY: 0, CRITERION: 0 };
  const refById = new Map<string, string>();
  for (const item of curriculumItems) {
    const ref = `${CURRICULUM_PREFIX[item.kind]}${++counters[item.kind]}`;
    curriculumRefs.add(item, ref);
    refById.set(item.id, ref);
  }
  const promptCurriculum: RefCurriculumItem[] = curriculumItems
    .filter((i) => i.kind !== "CRITERION")
    .map((i) => ({ ref: refById.get(i.id)!, kind: i.kind, title: i.title, description: i.description }));
  const resolveItem = (ref: string | null | undefined): string | null => {
    const item = curriculumRefs.get(ref);
    return item && item.kind !== "CRITERION" ? item.id : null;
  };

  // ── 1. Precheck + fuente ──
  const conversation = experience.conversation;
  const submission = experience.submission;
  let observeMessage: string;
  let experienceDescription: string;
  const messageRefs = new RefMap<{ id: string; role: "STUDENT" | "TUTOR"; content: string; createdAt: Date }>("M");
  const promptRefs = new RefMap<{ key: string; label: string; answer: string }>("P");
  let declaredLevel: AssistanceLevel = "UNKNOWN";
  let declaredNote: string | null = null;

  if (source === "AI_CONVERSATION") {
    if (!conversation) throw new Error("La experiencia no tiene conversación asociada.");
    const studentMessages = conversation.messages.filter((m) => m.role === "STUDENT");
    const studentChars = studentMessages.reduce((n, m) => n + m.content.trim().length, 0);
    if (studentMessages.length < 2 || studentChars < 60) {
      await logStep({ step: "precheck", status: "done", note: "Conversación demasiado breve" });
      return {
        status: "INSUFFICIENT",
        note: "La conversación es muy breve para generar evidencia: hacen falta al menos dos intervenciones tuyas con contenido de la materia.",
        counts: {},
      };
    }
    const lines = conversation.messages.map((m) => {
      const ref = messageRefs.add({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt });
      return { ref, role: m.role === "STUDENT" ? ("ESTUDIANTE" as const) : ("TUTOR" as const), content: m.content };
    });
    experienceDescription = `Conversación con el tutor "${conversation.title}" (${formatDate(conversation.createdAt)})`;
    observeMessage = buildObserveConversationMessage({
      courseName: run.course.name,
      curriculum: promptCurriculum,
      focus: conversation.focusItem?.title ?? null,
      activityTitle: conversation.activity?.title ?? null,
      messages: lines,
    });
  } else {
    if (!submission || submission.status !== "SUBMITTED") throw new Error("La experiencia no tiene una entrega enviada.");
    const prompts = parseActivityPrompts(submission.activity.prompts);
    const answers = parseAnswers(submission.answers);
    const totalChars = prompts.reduce((n, p) => n + (answers[p.key]?.trim().length ?? 0), 0);
    if (totalChars < 40) {
      await logStep({ step: "precheck", status: "done", note: "Entrega sin contenido suficiente" });
      return {
        status: "INSUFFICIENT",
        note: "La entrega tiene muy poco contenido para generar evidencia.",
        counts: {},
      };
    }
    const answerLines = prompts.map((p) => {
      const ref = promptRefs.add({ key: p.key, label: p.label, answer: answers[p.key] ?? "" });
      return { ref, label: p.label, answer: answers[p.key] ?? "" };
    });
    if (submission.declaredAssistance) declaredLevel = DECLARED_TO_LEVEL[submission.declaredAssistance];
    const tutorMessages = await db.message.count({
      where: {
        role: "STUDENT",
        createdAt: { lte: submission.submittedAt ?? new Date() },
        conversation: { studentId: run.studentId, activityId: submission.activityId },
      },
    });
    declaredNote = [
      submission.declaredAssistance ? `Asistencia declarada por el estudiante: ${submission.declaredAssistance}.` : "El estudiante no declaró asistencia.",
      submission.assistanceNote ? `Nota: ${submission.assistanceNote}` : null,
      tutorMessages > 0 ? `Antes de entregar envió ${tutorMessages} mensajes al tutor en conversaciones sobre esta actividad.` : null,
    ]
      .filter(Boolean)
      .join(" ");
    experienceDescription = `Entrega de la actividad "${submission.activity.title}" (intento ${submission.attempt}, ${formatDate(submission.submittedAt ?? new Date())})`;
    observeMessage = buildObserveSubmissionMessage({
      courseName: run.course.name,
      curriculum: promptCurriculum,
      activity: submission.activity,
      answers: answerLines,
    });
  }
  await logStep({ step: "precheck", status: "done" });

  // ── 2. Observación ──
  const observed: ObservationOutput = await generateStructuredWithRetry({
    operation: "interpret.observe",
    system: OBSERVE_SYSTEM,
    messages: [{ role: "user", content: observeMessage }],
    schema: observationSchema,
    context: usage,
  });
  const drafts = new RefMap<DraftEvidence>("E");
  for (const obs of observed.observations.slice(0, MAX_OBSERVATIONS)) {
    const draft =
      source === "AI_CONVERSATION"
        ? buildConversationEvidence(obs, messageRefs, resolveItem)
        : buildSubmissionEvidence(obs, promptRefs, resolveItem, {
            occurredAt: submission!.submittedAt ?? new Date(),
            declaredLevel,
            declaredNote,
            activityTitle: submission!.activity.title,
          });
    if (draft) drafts.add(draft);
  }
  const evidenceList = drafts.entries();
  await logStep({ step: "observe", status: "done", note: `${evidenceList.length} observaciones` });
  if (evidenceList.length === 0) {
    return {
      status: "INSUFFICIENT",
      note: observed.insufficientReason ?? "No se identificaron observaciones relevantes para la materia.",
      counts: { evidence: 0 },
    };
  }

  // ── 3. Señales + vinculación curricular ──
  const declaredContext = [run.student.declaredCurrentContext, run.student.declaredInterests].filter(Boolean).join("; ") || null;
  const signalOutput = await generateStructuredWithRetry({
    operation: "interpret.signals",
    system: SIGNALS_SYSTEM,
    messages: [
      {
        role: "user",
        content: buildSignalsMessage({
          courseName: run.course.name,
          curriculum: promptCurriculum,
          sourceDescription: experienceDescription,
          familiarContext: declaredContext,
          observations: evidenceList.map(([ref, e]) => ({
            ref,
            kind: e.kind,
            observation: e.observation,
            excerpt: e.content,
            context: e.context,
            assistanceLevel: e.assistanceLevel,
            curriculumRefs: e.curriculumItemIds.map((id) => refById.get(id)!).filter(Boolean),
          })),
        }),
      },
    ],
    schema: signalsSchema,
    context: usage,
  });
  const signals = new RefMap<DraftSignal>("S");
  for (const s of signalOutput.signals) {
    const evidence = drafts.get(s.evidenceRef);
    if (!evidence) continue;
    const curriculumItemId = resolveItem(s.curriculumRef);
    signals.add({
      evidenceRef: s.evidenceRef.trim(),
      dimension: s.dimension,
      polarity: s.polarity,
      curriculumItemId,
      description: s.description,
      rationale: s.rationale,
    });
    if (curriculumItemId && !evidence.curriculumItemIds.includes(curriculumItemId)) evidence.curriculumItemIds.push(curriculumItemId);
  }
  const signalList = signals.entries();
  await logStep({ step: "signals", status: "done", note: `${signalList.length} señales` });

  // ── 4. Evaluación contra criterios (entregas) ──
  const evaluations: DraftEvaluation[] = [];
  if (source === "CHALLENGE_SUBMISSION" && submission) {
    const criteria = submission.activity.curriculumLinks
      .map((l) => l.curriculumItem)
      .filter((c) => c.kind === "CRITERION" && c.status === "ACCEPTED");
    if (criteria.length > 0) {
      const answers = parseAnswers(submission.answers);
      const output = await generateStructuredWithRetry({
        operation: "interpret.evaluate",
        system: EVALUATE_SYSTEM,
        messages: [
          {
            role: "user",
            content: buildEvaluateMessage({
              activityTitle: submission.activity.title,
              criteria: criteria.map((c) => ({ ref: refById.get(c.id)!, title: c.title, description: c.description })),
              answers: promptRefs.entries().map(([ref, p]) => ({ ref, label: p.label, answer: answers[p.key] ?? "" })),
              observations: evidenceList.map(([ref, e]) => ({ ref, observation: e.observation, excerpt: e.content })),
            }),
          },
        ],
        schema: evaluationSchema,
        context: usage,
      });
      for (const ev of output.evaluations) {
        const criterion = curriculumRefs.get(ev.criterionRef);
        if (!criterion || criterion.kind !== "CRITERION" || evaluations.some((e) => e.criterionId === criterion.id)) continue;
        const evidenceRefs = ev.evidenceRefs.map((r) => r.trim()).filter((r) => drafts.get(r));
        evaluations.push({
          criterionId: criterion.id,
          result: evidenceRefs.length === 0 ? "INSUFFICIENT_EVIDENCE" : ev.result,
          rationale: ev.rationale,
          evidenceRefs,
        });
      }
      await logStep({ step: "evaluate", status: "done", note: `${evaluations.length} criterios` });
    } else {
      await logStep({ step: "evaluate", status: "skipped", note: "La actividad no tiene criterios" });
    }
  }

  if (signalList.length === 0) {
    // Hay evidencia observada, pero sin señales: se guarda la evidencia y se informa.
    await persist(run, {
      drafts: evidenceList,
      signals: [],
      evaluations,
      inferences: [],
      feedback: null,
      insufficient: [],
      fallbackFeedback:
        "Registramos lo que hiciste en esta experiencia, pero todavía no aparecen señales suficientes para sacar conclusiones. A medida que trabajes en más actividades vas a ver qué muestra la evidencia.",
      experienceDescription,
    });
    await logStep({ step: "persist", status: "done" });
    await afterPersist(run, evidenceList, []);
    await logStep({ step: "snapshot", status: "done" });
    return {
      status: "COMPLETED",
      note: "Se registró evidencia, pero sin señales suficientes para inferir.",
      counts: { evidence: evidenceList.length, signals: 0, inferences: 0 },
    };
  }

  // ── 5. Historial y posibles contradicciones ──
  const touchedItems = [...new Set(signalList.map(([, s]) => s.curriculumItemId).filter((id): id is string => Boolean(id)))];
  const historical = await db.signal.findMany({
    where: {
      studentId: run.studentId,
      courseId: run.courseId,
      evidence: { experienceId: { not: run.experienceId } },
      OR: [{ curriculumItemId: { in: touchedItems } }, { curriculumItemId: null }],
    },
    include: {
      evidence: { include: { experience: { select: { title: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
  });
  const historyRefs = new RefMap<(typeof historical)[number]>("H");
  for (const h of [...historical].reverse()) historyRefs.add(h);

  const priorInferences = await db.inference.findMany({
    where: {
      studentId: run.studentId,
      courseId: run.courseId,
      state: "ACTIVE",
      OR: [{ curriculumItemId: { in: touchedItems } }, { curriculumItemId: null }],
    },
    include: { reviews: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
    take: 15,
  });
  const inferenceRefs = new RefMap<(typeof priorInferences)[number]>("I");
  for (const inf of priorInferences) inferenceRefs.add(inf);

  const potentialContradictions: string[] = [];
  for (const [ref, s] of signalList) {
    if (s.polarity === "MIXED") continue;
    for (const [hRef, h] of historyRefs.entries()) {
      if (h.dimension === s.dimension && h.curriculumItemId === s.curriculumItemId && h.polarity !== "MIXED" && h.polarity !== s.polarity) {
        potentialContradictions.push(
          `${ref} (${polarityLabel[s.polarity]}) vs ${hRef} (${polarityLabel[h.polarity]}, ${formatDate(h.evidence.occurredAt)}) en ${dimensionLabel[s.dimension]} / ${h.curriculumItemId ? refById.get(h.curriculumItemId) : "general"}`,
        );
      }
    }
  }
  await logStep({
    step: "history",
    status: "done",
    note: `${historical.length} señales previas, ${potentialContradictions.length} posibles contradicciones`,
  });

  // ── 6. Inferencias ──
  const signalLine = (ref: string, s: DraftSignal): SignalLine => {
    const e = drafts.get(s.evidenceRef)!;
    return {
      ref,
      dimension: s.dimension,
      polarity: s.polarity,
      curriculumRef: s.curriculumItemId ? (refById.get(s.curriculumItemId) ?? null) : null,
      description: s.description,
      source: source === "AI_CONVERSATION" ? "conversación con IA" : "entrega de actividad",
      assistanceLevel: e.assistanceLevel,
      occurredAt: formatDate(e.occurredAt),
      experienceTitle: experienceDescription,
      excerpt: truncate(e.content, 240),
    };
  };
  const inferOutput = await generateStructuredWithRetry({
    operation: "interpret.infer",
    system: INFER_SYSTEM,
    messages: [
      {
        role: "user",
        content: buildInferMessage({
          courseName: run.course.name,
          curriculum: promptCurriculum,
          experienceDescription,
          newSignals: signalList.map(([ref, s]) => signalLine(ref, s)),
          historicalSignals: historyRefs.entries().map(([ref, h]) => ({
            ref,
            dimension: h.dimension,
            polarity: h.polarity,
            curriculumRef: h.curriculumItemId ? (refById.get(h.curriculumItemId) ?? null) : null,
            description: h.description,
            source: h.evidence.source === "AI_CONVERSATION" ? "conversación con IA" : "entrega de actividad",
            assistanceLevel: h.evidence.assistanceLevel,
            occurredAt: formatDate(h.evidence.occurredAt),
            experienceTitle: h.evidence.experience.title,
            excerpt: truncate(h.evidence.content, 240),
          })),
          priorInferences: inferenceRefs.entries().map(([ref, i]) => ({
            ref,
            statement: i.statement,
            dimension: i.dimension,
            polarity: i.polarity,
            curriculumRef: i.curriculumItemId ? (refById.get(i.curriculumItemId) ?? null) : null,
            supportStatus: i.supportStatus,
            reviewStatus: i.reviewStatus,
            teacherComment: i.reviews[0]?.comment ?? null,
            createdAt: formatDate(i.createdAt),
          })),
          potentialContradictions,
          evaluations: evaluations.map((e) => {
            const criterion = curriculumItems.find((c) => c.id === e.criterionId)!;
            return `${criterion.title}: ${evaluationResultLabel[e.result]} — ${e.rationale}`;
          }),
        }),
      },
    ],
    schema: inferenceSchema,
    context: usage,
  });

  const resolveSignal = (ref: string): SignalRefTarget | undefined => {
    const key = ref.trim();
    const draft = signals.get(key);
    if (draft) {
      const e = drafts.get(draft.evidenceRef)!;
      return {
        origin: "draft",
        key,
        evidence: { evidenceId: `draft:${draft.evidenceRef}`, experienceId: run.experienceId, source, assistanceLevel: e.assistanceLevel },
        dimension: draft.dimension,
        polarity: draft.polarity,
        curriculumItemId: draft.curriculumItemId,
      };
    }
    const h = historyRefs.get(key);
    if (h) {
      return {
        origin: "db",
        key: h.id,
        evidence: { evidenceId: h.evidenceId, experienceId: h.evidence.experienceId, source: h.evidence.source, assistanceLevel: h.evidence.assistanceLevel },
        dimension: h.dimension,
        polarity: h.polarity,
        curriculumItemId: h.curriculumItemId,
      };
    }
    return undefined;
  };

  const inferences: DraftInference[] = [];
  for (const inf of inferOutput.inferences.slice(0, MAX_INFERENCES)) {
    const supporting = uniqueTargets(inf.supportingSignalRefs.map(resolveSignal));
    const contradicting = uniqueTargets(inf.contradictingSignalRefs.map(resolveSignal)).filter(
      (c) => !supporting.some((s) => s.origin === c.origin && s.key === c.key),
    );
    // Toda inferencia debe apoyarse en al menos una señal de esta corrida o del historial.
    if (supporting.length === 0) continue;
    let curriculumItemId = resolveItem(inf.curriculumRef);
    if (!curriculumItemId) {
      const items = new Set(supporting.map((s) => s.curriculumItemId));
      if (items.size === 1) curriculumItemId = [...items][0] ?? null;
    }
    const decision = applySupportPolicy({
      proposed: inf.proposedSupport,
      dimension: inf.dimension,
      polarity: inf.polarity,
      supporting: supporting.map((s) => s.evidence),
      contradicting: contradicting.map((s) => s.evidence),
    });
    const supersedes = inferenceRefs.get(inf.supersedesInferenceRef);
    inferences.push({
      statement: inf.statement,
      studentStatement: inf.studentStatement,
      dimension: inf.dimension,
      polarity: inf.polarity,
      curriculumItemId,
      supporting,
      contradicting,
      proposedSupport: inf.proposedSupport,
      supportStatus: decision.status,
      supportRationale: inf.supportRationale,
      policyNotes: decision.notes,
      contradictionNote: decision.status === "CONTRADICTORY" ? (inf.contradictionNote ?? "Hay evidencia en sentido opuesto que conviene revisar.") : inf.contradictionNote,
      supersedesId: supersedes?.id ?? null,
      priority: inf.priority,
      requiresReview: requiresTeacherReview({ polarity: inf.polarity, status: decision.status, priority: inf.priority }),
      teacherAction: inf.teacherAction,
    });
  }
  const insufficient = inferOutput.insufficientAreas.map((a) => ({
    curriculumItemId: resolveItem(a.curriculumRef),
    dimension: a.dimension,
    note: a.note,
  }));
  await logStep({ step: "infer", status: "done", note: `${inferences.length} inferencias` });

  // ── 7. Feedback y próximos pasos ──
  let feedback: FeedbackOutput | null = null;
  const availableActivities = await db.activity.findMany({
    where: {
      courseId: run.courseId,
      status: "PUBLISHED",
      submissions: { none: { studentId: run.studentId, status: "SUBMITTED" } },
    },
    select: { id: true, title: true },
    take: 10,
  });
  const activityRefs = new RefMap<{ id: string; title: string }>("A");
  for (const a of availableActivities) activityRefs.add(a);

  if (inferences.length > 0) {
    const feedbackMessage = buildFeedbackMessage({
      experienceDescription,
      declared: {
        strengths: run.student.declaredStrengths,
        difficulties: run.student.declaredDifficulties,
        goals: run.student.declaredGoals,
        currentContext: run.student.declaredCurrentContext,
      },
      inferences: inferences.map((i) => ({
        statement: i.studentStatement,
        support: supportStatusLabel[i.supportStatus],
        curriculumRef: i.curriculumItemId ? (refById.get(i.curriculumItemId) ?? null) : null,
      })),
      evaluations: evaluations.map((e) => {
        const criterion = curriculumItems.find((c) => c.id === e.criterionId)!;
        return `${criterion.title}: ${evaluationResultLabel[e.result]}`;
      }),
      insufficient: insufficient.map((a) => a.note),
      curriculum: promptCurriculum.map((c) => ({ ref: c.ref, title: c.title })),
      availableActivities: activityRefs.entries().map(([ref, a]) => ({ ref, title: a.title })),
    });
    feedback = await generateStructuredWithRetry({
      operation: "interpret.feedback",
      system: FEEDBACK_SYSTEM,
      messages: [{ role: "user", content: feedbackMessage }],
      schema: feedbackSchema,
      context: usage,
    });
    if (containsFalsePrecision(`${feedback.summary} ${feedback.contrastWithDeclared ?? ""}`)) {
      feedback = await generateStructuredWithRetry({
        operation: "interpret.feedback",
        system: FEEDBACK_SYSTEM,
        messages: [
          {
            role: "user",
            content: `${feedbackMessage}\n\nImportante: no uses porcentajes, puntajes ni números para describir al estudiante.`,
          },
        ],
        schema: feedbackSchema,
        context: usage,
      });
      feedback = {
        ...feedback,
        summary: stripFalsePrecision(feedback.summary),
        contrastWithDeclared: feedback.contrastWithDeclared ? stripFalsePrecision(feedback.contrastWithDeclared) || null : null,
      };
    }
    await logStep({ step: "feedback", status: "done" });
  } else {
    await logStep({ step: "feedback", status: "skipped", note: "Sin inferencias con respaldo" });
  }

  // ── 8. Persistencia atómica ──
  await persist(run, {
    drafts: evidenceList,
    signals: signalList,
    evaluations,
    inferences,
    feedback: feedback
      ? {
          ...feedback,
          nextSteps: feedback.nextSteps.slice(0, 3).map((n) => ({
            ...n,
            curriculumItemId: resolveItem(n.curriculumRef),
            activityId: n.type === "TRY_ACTIVITY" ? (activityRefs.get(n.activityRef)?.id ?? null) : null,
          })),
        }
      : null,
    insufficient,
    fallbackFeedback:
      "Registramos lo que hiciste en esta experiencia, pero la evidencia todavía no alcanza para sacar conclusiones. Seguí trabajando y Educai va a poder mostrarte qué aparece con más respaldo.",
    experienceDescription,
  });
  await logStep({ step: "persist", status: "done" });

  // ── 9. Snapshot y cierre del loop ──
  await afterPersist(run, evidenceList, touchedItems);
  await logStep({ step: "snapshot", status: "done" });

  return {
    status: "COMPLETED",
    note: null,
    counts: {
      evidence: evidenceList.length,
      signals: signalList.length,
      inferences: inferences.length,
      contradictions: inferences.filter((i) => i.supportStatus === "CONTRADICTORY").length,
      insufficient: insufficient.length,
      policyAdjusted: inferences.filter((i) => i.policyNotes.length > 0).length,
    },
  };
}

function uniqueTargets(list: (SignalRefTarget | undefined)[]): SignalRefTarget[] {
  const seen = new Set<string>();
  const result: SignalRefTarget[] = [];
  for (const t of list) {
    if (!t) continue;
    const id = `${t.origin}:${t.key}`;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(t);
  }
  return result;
}

type Observation = ObservationOutput["observations"][number];

function buildConversationEvidence(
  obs: Observation,
  messageRefs: RefMap<{ id: string; role: "STUDENT" | "TUTOR"; content: string; createdAt: Date }>,
  resolveItem: (ref: string) => string | null,
): DraftEvidence | null {
  const referenced = obs.sourceRefs.map((r) => messageRefs.get(r)).filter((m): m is NonNullable<typeof m> => Boolean(m));
  let studentMessages = referenced.filter((m) => m.role === "STUDENT");
  let verified = studentMessages.some((m) => isVerbatimExcerpt(obs.excerpt, m.content));
  if (!verified) {
    // La referencia pudo ser imprecisa: buscamos la cita en todos los mensajes del estudiante.
    const match = messageRefs
      .entries()
      .map(([, m]) => m)
      .find((m) => m.role === "STUDENT" && isVerbatimExcerpt(obs.excerpt, m.content));
    if (match) {
      studentMessages = [match];
      verified = true;
    }
  }
  // Sin un mensaje del estudiante no hay evidencia atribuible.
  if (studentMessages.length === 0) return null;
  const tutorContext = referenced.filter((m) => m.role === "TUTOR");
  return {
    kind: obs.kind,
    observation: obs.observation,
    content: verified ? obs.excerpt : truncate(studentMessages.map((m) => m.content).join("\n"), 600),
    context: obs.context,
    assistanceLevel: obs.assistanceLevel,
    assistanceSource: obs.assistanceLevel === "UNKNOWN" ? "UNKNOWN" : "OBSERVED",
    assistanceNote: obs.assistanceNote || null,
    occurredAt: studentMessages.reduce((latest, m) => (m.createdAt > latest ? m.createdAt : latest), studentMessages[0].createdAt),
    messageIds: [...studentMessages, ...tutorContext].map((m) => m.id),
    promptKeys: [],
    excerptVerified: verified,
    curriculumItemIds: [...new Set(obs.curriculumRefs.map(resolveItem).filter((id): id is string => Boolean(id)))],
  };
}

function buildSubmissionEvidence(
  obs: Observation,
  promptRefs: RefMap<{ key: string; label: string; answer: string }>,
  resolveItem: (ref: string) => string | null,
  meta: { occurredAt: Date; declaredLevel: AssistanceLevel; declaredNote: string | null; activityTitle: string },
): DraftEvidence | null {
  let prompts = obs.sourceRefs.map((r) => promptRefs.get(r)).filter((p): p is NonNullable<typeof p> => Boolean(p));
  let verified = prompts.some((p) => isVerbatimExcerpt(obs.excerpt, p.answer));
  if (!verified) {
    const match = promptRefs
      .entries()
      .map(([, p]) => p)
      .find((p) => isVerbatimExcerpt(obs.excerpt, p.answer));
    if (match) {
      prompts = [match];
      verified = true;
    }
  }
  if (prompts.length === 0) return null;
  const promptLabel = prompts.map((p) => `"${p.label}"`).join(", ");
  return {
    kind: obs.kind,
    observation: obs.observation,
    content: verified ? obs.excerpt : truncate(prompts.map((p) => p.answer).join("\n"), 600),
    context: `Actividad "${meta.activityTitle}", consigna ${promptLabel}. ${obs.context}`.trim(),
    assistanceLevel: meta.declaredLevel,
    assistanceSource: meta.declaredLevel === "UNKNOWN" ? "UNKNOWN" : "DECLARED",
    assistanceNote: meta.declaredNote,
    occurredAt: meta.occurredAt,
    messageIds: [],
    promptKeys: prompts.map((p) => p.key),
    excerptVerified: verified,
    curriculumItemIds: [...new Set(obs.curriculumRefs.map(resolveItem).filter((id): id is string => Boolean(id)))],
  };
}

interface PersistInput {
  drafts: [string, DraftEvidence][];
  signals: [string, DraftSignal][];
  evaluations: DraftEvaluation[];
  inferences: DraftInference[];
  feedback:
    | (Omit<FeedbackOutput, "nextSteps"> & {
        nextSteps: (FeedbackOutput["nextSteps"][number] & { curriculumItemId: string | null; activityId: string | null })[];
      })
    | null;
  insufficient: { curriculumItemId: string | null; dimension: Dimension; note: string }[];
  fallbackFeedback: string;
  experienceDescription: string;
}

async function persist(run: LoadedRun, input: PersistInput): Promise<void> {
  const model = modelFor("interpret.observe");
  await db.$transaction(
    async (tx) => {
      const evidenceIds = new Map<string, string>();
      for (const [ref, e] of input.drafts) {
        const created = await tx.evidenceObject.create({
          data: {
            courseId: run.courseId,
            studentId: run.studentId,
            experienceId: run.experienceId,
            runId: run.id,
            source: run.source,
            kind: e.kind,
            observation: e.observation,
            content: e.content,
            context: e.context,
            assistanceLevel: e.assistanceLevel,
            assistanceSource: e.assistanceSource,
            assistanceNote: e.assistanceNote,
            occurredAt: e.occurredAt,
            provenance: {
              origin: "engine",
              runId: run.id,
              model,
              promptVersion: ENGINE_PROMPT_VERSION,
              messageIds: e.messageIds,
              submissionId: run.experience.submission?.id ?? null,
              promptKeys: e.promptKeys,
              excerptVerified: e.excerptVerified,
            },
            curriculumLinks: { create: e.curriculumItemIds.map((curriculumItemId) => ({ curriculumItemId })) },
          },
        });
        evidenceIds.set(ref, created.id);
      }

      const signalIds = new Map<string, string>();
      for (const [ref, s] of input.signals) {
        const created = await tx.signal.create({
          data: {
            evidenceId: evidenceIds.get(s.evidenceRef)!,
            courseId: run.courseId,
            studentId: run.studentId,
            runId: run.id,
            dimension: s.dimension,
            polarity: s.polarity,
            description: s.description,
            rationale: s.rationale,
            curriculumItemId: s.curriculumItemId,
          },
        });
        signalIds.set(ref, created.id);
      }

      if (run.experience.submission) {
        for (const ev of input.evaluations) {
          await tx.evaluation.create({
            data: {
              courseId: run.courseId,
              studentId: run.studentId,
              submissionId: run.experience.submission.id,
              criterionId: ev.criterionId,
              runId: run.id,
              result: ev.result,
              rationale: ev.rationale,
              evidence: { create: ev.evidenceRefs.map((r) => ({ evidenceId: evidenceIds.get(r)! })) },
            },
          });
        }
      }

      const historicalSignalIds = [
        ...new Set(input.inferences.flatMap((i) => [...i.supporting, ...i.contradicting]).filter((t) => t.origin === "db").map((t) => t.key)),
      ];
      const historicalSignals = await tx.signal.findMany({ where: { id: { in: historicalSignalIds } }, select: { id: true, evidenceId: true } });
      const historicalEvidence = new Map(historicalSignals.map((s) => [s.id, s.evidenceId]));
      const resolveTarget = (t: SignalRefTarget): { signalId: string; evidenceId: string } | null => {
        if (t.origin === "db") {
          const evidenceId = historicalEvidence.get(t.key);
          return evidenceId ? { signalId: t.key, evidenceId } : null;
        }
        const signalId = signalIds.get(t.key);
        const draft = input.signals.find(([ref]) => ref === t.key)?.[1];
        const evidenceId = draft ? evidenceIds.get(draft.evidenceRef) : undefined;
        return signalId && evidenceId ? { signalId, evidenceId } : null;
      };

      const inferenceIds: string[] = [];
      const supersededIds = new Set<string>();
      for (const inf of input.inferences) {
        const supports = [
          ...inf.supporting.map((t) => ({ target: resolveTarget(t), relation: "SUPPORTS" as const })),
          ...inf.contradicting.map((t) => ({ target: resolveTarget(t), relation: "CONTRADICTS" as const })),
        ].filter((s): s is { target: { signalId: string; evidenceId: string }; relation: "SUPPORTS" | "CONTRADICTS" } => s.target !== null);
        if (!supports.some((s) => s.relation === "SUPPORTS")) continue;
        const created = await tx.inference.create({
          data: {
            courseId: run.courseId,
            studentId: run.studentId,
            runId: run.id,
            statement: inf.statement,
            studentStatement: inf.studentStatement,
            dimension: inf.dimension,
            polarity: inf.polarity,
            curriculumItemId: inf.curriculumItemId,
            supportStatus: inf.supportStatus,
            proposedSupportStatus: inf.proposedSupport,
            supportRationale: inf.supportRationale,
            policyNotes: inf.policyNotes,
            contradictionNote: inf.contradictionNote,
            requiresReview: inf.requiresReview,
            priority: inf.priority,
            supports: {
              createMany: {
                data: supports.map((s) => ({ signalId: s.target.signalId, evidenceId: s.target.evidenceId, relation: s.relation })),
                skipDuplicates: true,
              },
            },
          },
        });
        // Solo después de crear la nueva se reemplaza la anterior (una inferencia previa se reemplaza una sola vez).
        if (inf.supersedesId && !supersededIds.has(inf.supersedesId)) {
          const superseded = await tx.inference.updateMany({
            where: { id: inf.supersedesId, studentId: run.studentId, courseId: run.courseId, state: "ACTIVE" },
            data: { state: "SUPERSEDED" },
          });
          if (superseded.count > 0) {
            supersededIds.add(inf.supersedesId);
            await tx.inference.update({ where: { id: created.id }, data: { supersedesId: inf.supersedesId } });
          }
        }
        inferenceIds.push(created.id);
        if (inf.teacherAction) {
          await tx.suggestedAction.create({
            data: {
              courseId: run.courseId,
              studentId: run.studentId,
              audience: "TEACHER",
              source: "ENGINE",
              type: inf.teacherAction.type,
              title: inf.teacherAction.description.slice(0, 140),
              description: inf.teacherAction.description,
              curriculumItemId: inf.curriculumItemId,
              inferenceId: created.id,
              runId: run.id,
            },
          });
        }
      }

      await tx.feedback.create({
        data: {
          courseId: run.courseId,
          studentId: run.studentId,
          runId: run.id,
          experienceId: run.experienceId,
          summary: input.feedback?.summary ?? input.fallbackFeedback,
          contrastWithDeclared: input.feedback?.contrastWithDeclared ?? null,
          inferenceIds,
          evidenceIds: [...evidenceIds.values()],
        },
      });

      for (const step of input.feedback?.nextSteps ?? []) {
        await tx.suggestedAction.create({
          data: {
            courseId: run.courseId,
            studentId: run.studentId,
            audience: "STUDENT",
            source: "ENGINE",
            type: step.type === "TRY_ACTIVITY" && !step.activityId ? "REVIEW_CONCEPT" : step.type,
            title: step.title,
            description: step.description,
            curriculumItemId: step.curriculumItemId,
            activityId: step.activityId,
            runId: run.id,
          },
        });
      }

      await tx.interpretationRun.update({
        where: { id: run.id },
        data: { insufficient: input.insufficient as unknown as Prisma.InputJsonValue },
      });
    },
    { timeout: 30_000 },
  );
}

/** Snapshot, eventos de activación y cierre del loop intervención → nueva evidencia. */
async function afterPersist(run: LoadedRun, evidence: [string, DraftEvidence][], touchedItems: string[]): Promise<void> {
  await computeAndStoreSnapshot({ studentId: run.studentId, courseId: run.courseId, runId: run.id });

  await track(EVENT.studentFirstEvidence, {
    userId: run.studentId,
    courseId: run.courseId,
    studentId: run.studentId,
    dedupeKey: `first_evidence:${run.studentId}:${run.courseId}`,
  });

  const activityId = run.experience.activityId ?? run.experience.submission?.activityId ?? run.experience.conversation?.activityId ?? null;
  if (run.source === "CHALLENGE_SUBMISSION" && activityId) {
    await track(EVENT.teacherActivityAnalyzed, {
      userId: run.course.teacherId,
      courseId: run.courseId,
      dedupeKey: `activity_analyzed:${activityId}`,
      properties: { activityId },
    });
  }

  // Próximos pasos completados por esta experiencia.
  const completedActionIds = [
    run.experience.conversation?.suggestedActionId,
    ...(activityId
      ? (
          await db.suggestedAction.findMany({
            where: { studentId: run.studentId, courseId: run.courseId, audience: "STUDENT", status: "OPEN", activityId },
            select: { id: true },
          })
        ).map((a) => a.id)
      : []),
  ].filter((id): id is string => Boolean(id));
  if (completedActionIds.length > 0) {
    const updated = await db.suggestedAction.updateMany({
      where: { id: { in: completedActionIds }, status: "OPEN", studentId: run.studentId },
      data: { status: "DONE", completedAt: new Date() },
    });
    if (updated.count > 0) {
      await track(EVENT.studentNextStepCompleted, {
        userId: run.studentId,
        courseId: run.courseId,
        studentId: run.studentId,
        properties: { via: "experience", count: updated.count },
      });
    }
  }

  // Loop: ¿esta evidencia es posterior a una intervención sobre este estudiante y tema?
  const firstEvidenceAt = evidence.reduce<Date | null>((min, [, e]) => (!min || e.occurredAt < min ? e.occurredAt : min), null);
  if (!firstEvidenceAt) return;
  const interventions = await db.intervention.findMany({
    where: {
      courseId: run.courseId,
      occurredAt: { lt: firstEvidenceAt },
      targets: { some: { studentId: run.studentId } },
      OR: [
        { curriculumItemId: { in: touchedItems } },
        { curriculumItemId: null },
        ...(activityId ? [{ activityId }] : []),
      ],
    },
    select: { id: true, followUpEvidenceAt: true, teacherId: true },
  });
  for (const intervention of interventions) {
    if (!intervention.followUpEvidenceAt) {
      await db.intervention.update({ where: { id: intervention.id }, data: { followUpEvidenceAt: new Date() } });
    }
    await track(EVENT.loopActionToEvidence, {
      userId: intervention.teacherId,
      courseId: run.courseId,
      studentId: run.studentId,
      dedupeKey: `action_to_evidence:${intervention.id}:${run.studentId}`,
      properties: { interventionId: intervention.id, runId: run.id },
    });
  }
}
