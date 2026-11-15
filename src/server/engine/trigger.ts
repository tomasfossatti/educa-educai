import "server-only";
import type { EvidenceSource, RunStatus } from "@prisma/client";
import { after } from "next/server";
import { isAIConfigured } from "@/server/ai";
import { ENGINE_PROMPT_VERSION } from "@/server/ai/prompts/shared";
import { hasActiveConsent } from "@/server/auth/guards";
import { db } from "@/server/db";
import { runInterpretation } from "./pipeline";

/**
 * Crea una corrida de interpretación y la ejecuta después de responder al usuario.
 * Respeta el consentimiento: sin consentimiento la experiencia se guarda pero no se analiza.
 */
export async function queueInterpretation(params: {
  experienceId: string;
  courseId: string;
  studentId: string;
  source: EvidenceSource;
}): Promise<{ runId: string; status: RunStatus }> {
  const profile = await db.studentProfile.findUnique({
    where: { userId: params.studentId },
    select: { consentAnalysisAt: true },
  });

  let status: RunStatus = "QUEUED";
  let statusNote: string | null = null;
  let error: string | null = null;
  if (!hasActiveConsent(profile)) {
    status = "SKIPPED";
    statusNote = "No se analizó porque no diste consentimiento para el análisis. Podés activarlo en Tu contexto.";
  } else if (!isAIConfigured()) {
    status = "FAILED";
    error = "El servicio de IA no está configurado en el servidor. La experiencia quedó guardada y se puede analizar más tarde.";
  }

  const run = await db.interpretationRun.create({
    data: {
      courseId: params.courseId,
      studentId: params.studentId,
      experienceId: params.experienceId,
      source: params.source,
      status,
      statusNote,
      error,
      promptVersion: ENGINE_PROMPT_VERSION,
      completedAt: status === "QUEUED" ? null : new Date(),
    },
  });

  if (status === "QUEUED") scheduleRun(run.id);
  return { runId: run.id, status };
}

export function scheduleRun(runId: string): void {
  after(async () => {
    await runInterpretation(runId);
  });
}

/** Reintento de una corrida fallida: crea una corrida nueva para la misma experiencia. */
export async function retryInterpretation(runId: string, studentId: string): Promise<string | null> {
  const failed = await db.interpretationRun.findFirst({
    where: { id: runId, studentId, status: "FAILED" },
  });
  if (!failed) return null;
  const { runId: newRunId } = await queueInterpretation({
    experienceId: failed.experienceId,
    courseId: failed.courseId,
    studentId: failed.studentId,
    source: failed.source,
  });
  return newRunId;
}

const STALE_AFTER_MS = 10 * 60 * 1000;

/**
 * Corridas que quedaron en curso por un reinicio del proceso: se marcan como fallidas
 * para que el estudiante pueda reintentarlas (la experiencia original nunca se pierde).
 */
export async function expireStaleRuns(studentId: string): Promise<void> {
  await db.interpretationRun.updateMany({
    where: { studentId, status: { in: ["QUEUED", "RUNNING"] }, createdAt: { lt: new Date(Date.now() - STALE_AFTER_MS) } },
    data: { status: "FAILED", error: "El análisis se interrumpió antes de terminar. Podés reintentarlo.", completedAt: new Date() },
  });
}

export const INACTIVE_CLOSE_MINUTES = 20;

/**
 * Paso 1 del motor: una conversación del chat se procesa al quedar inactiva 20 minutos.
 * Cierra las conversaciones activas de una cátedra cuyo último mensaje es más viejo y las encola.
 * Se llama de forma oportunista al cargar el panel docente y el inicio del estudiante.
 */
export async function closeInactiveConversations(opts: { courseId?: string; studentId?: string; now?: Date } = {}): Promise<number> {
  const now = opts.now ?? new Date();
  const cutoff = new Date(now.getTime() - INACTIVE_CLOSE_MINUTES * 60 * 1000);
  const candidates = await db.aIConversation.findMany({
    where: {
      status: "ACTIVE",
      courseId: opts.courseId ?? { not: null },
      ...(opts.studentId ? { studentId: opts.studentId } : {}),
      messages: { some: {}, none: { createdAt: { gte: cutoff } } },
    },
    select: { id: true, experienceId: true, courseId: true, studentId: true },
    take: 50,
  });
  let closed = 0;
  for (const c of candidates) {
    // Cierre condicional: si otra petición ya la cerró, no se encola dos veces.
    const updated = await db.aIConversation.updateMany({ where: { id: c.id, status: "ACTIVE" }, data: { status: "CLOSED", closedAt: now } });
    if (updated.count === 0) continue;
    await onConversationClosed(c.id, "Conversación cerrada por inactividad");
    if (!c.courseId) continue;
    await db.experience.update({ where: { id: c.experienceId }, data: { completedAt: now } });
    await queueInterpretation({ experienceId: c.experienceId, courseId: c.courseId, studentId: c.studentId, source: "AI_CONVERSATION" });
    closed++;
  }
  return closed;
}

/**
 * Después de cerrar una conversación (o recibir una subida): traza en la carpeta, hechos nuevos
 * y, si corresponde, el resumen cruzado. Corre después de responder; un error no afecta al estudiante.
 */
export async function onConversationClosed(conversationId: string, label: string): Promise<void> {
  const { appendTrace, refreshSummaryIfStale, updateFolderFacts } = await import("@/server/services/folder-context");
  const conversation = await db.aIConversation.findUnique({ where: { id: conversationId }, select: { folderId: true, studentId: true } });
  if (!conversation?.folderId) return;
  await appendTrace(conversation.folderId, label, [conversationId]);
  after(async () => {
    try {
      await updateFolderFacts(conversationId);
      await refreshSummaryIfStale(conversation.studentId);
    } catch (error) {
      console.error("[contexto] no se pudo actualizar el contexto de la carpeta", error instanceof Error ? error.message : error);
    }
  });
}
