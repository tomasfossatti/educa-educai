import "server-only";
import type { EvidenceSource, RunStatus } from "@prisma/client";
import { after } from "next/server";
import { isAIConfigured } from "@/server/ai";
import { ENGINE_PROMPT_VERSION } from "@/server/ai/prompts/shared";
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
  if (!profile?.consentAnalysisAt) {
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
