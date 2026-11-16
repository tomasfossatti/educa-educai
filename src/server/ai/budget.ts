import "server-only";
import { budgetState, nextWeekStart, readUsd, weekKey, weekStart, type BudgetState } from "@/domain/ai-budget";
import { formatDate } from "@/lib/format";
import { db } from "@/server/db";
import { EVENT } from "@/server/events";
import { modelFor } from "./config";
import { estimateCostUsd } from "./pricing";
import { AIError, type AIOperation } from "./types";

/**
 * Tope semanal de gasto de IA por estudiante y alertas de consumo.
 *
 * - Bloquea solo lo que el estudiante dispara (chat, quiz, subidas). El análisis de lo que ya
 *   conversó sigue corriendo: su costo depende de conversaciones que ya pasaron por el tope.
 * - Alerta una sola vez por semana y por umbral (80% y 100% del tope del estudiante, y del tope
 *   total de la instalación) con un log estructurado y, si está configurado, un webhook.
 * - Las alertas identifican al estudiante solo por id: nunca llevan nombre ni contenido.
 */

/** Operaciones que inicia el estudiante y que el tope frena. */
export const STUDENT_INITIATED: ReadonlySet<AIOperation> = new Set<AIOperation>(["folder.chat", "tutor.reply", "quiz.generate", "profile.improve", "lms.assistant"]);

export function weeklyStudentCapUsd(): number {
  return readUsd(process.env.AI_WEEKLY_STUDENT_CAP_USD, 2);
}

export function weeklyTotalAlertUsd(): number {
  return readUsd(process.env.AI_WEEKLY_TOTAL_ALERT_USD, 25);
}

export function budgetAlertRatio(): number {
  const ratio = readUsd(process.env.AI_BUDGET_ALERT_RATIO, 0.8);
  return ratio > 0 && ratio < 1 ? ratio : 0.8;
}

async function spentSince(from: Date, studentId?: string): Promise<number> {
  const result = await db.aIUsageEvent.aggregate({
    where: { createdAt: { gte: from }, ...(studentId ? { studentId } : {}) },
    _sum: { estimatedCostUsd: true },
  });
  return Number(result._sum.estimatedCostUsd ?? 0);
}

export interface StudentBudget {
  spentUsd: number;
  capUsd: number;
  state: BudgetState;
  resetsAt: Date;
}

export async function getStudentBudget(studentId: string, now: Date = new Date()): Promise<StudentBudget> {
  const capUsd = weeklyStudentCapUsd();
  const spentUsd = await spentSince(weekStart(now), studentId);
  return { spentUsd, capUsd, state: budgetState(spentUsd, capUsd, budgetAlertRatio()), resetsAt: nextWeekStart(now) };
}

/** "lunes 16 nov 2026": cuándo se renueva el tope, para los avisos al estudiante. */
export function budgetResetLabel(now: Date = new Date()): string {
  return `lunes ${formatDate(nextWeekStart(now))}`;
}

export const BUDGET_EXCEEDED_MESSAGE = "Llegaste al tope semanal de uso de la IA.";

/**
 * Corta antes de llamar al modelo si el estudiante ya llegó al tope, o si `estimateUsd`
 * (lo que costaría la operación) lo haría pasar.
 */
export async function assertStudentBudget(studentId: string, estimateUsd = 0, now: Date = new Date()): Promise<void> {
  const capUsd = weeklyStudentCapUsd();
  if (capUsd <= 0) return;
  const spent = await spentSince(weekStart(now), studentId);
  if (spent >= capUsd || (estimateUsd > 0 && spent + estimateUsd > capUsd)) {
    throw new AIError("budget_exceeded", BUDGET_EXCEEDED_MESSAGE);
  }
}

/**
 * Costo estimado de analizar una conversación subida de `chars` caracteres: el motor manda la
 * transcripción completa al paso de observación y unas cuatro llamadas más chicas después.
 * Estimación conservadora (3 caracteres por token).
 */
export function estimateUploadAnalysisUsd(chars: number): number {
  const transcriptTokens = Math.ceil(chars / 3);
  const cost = estimateCostUsd({
    model: modelFor("interpret.observe"),
    inputTokens: transcriptTokens + 4 * 6_000,
    outputTokens: 5 * 2_000,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  });
  return cost ?? 0;
}

type AlertScope = "student" | "total";

async function raiseAlert(params: {
  scope: AlertScope;
  state: Exclude<BudgetState, "ok">;
  now: Date;
  spentUsd: number;
  capUsd: number;
  studentId?: string;
  courseId?: string | null;
}): Promise<void> {
  const week = weekKey(params.now);
  const who = params.scope === "student" ? `student:${params.studentId}` : "total";
  const created = await db.productEvent.createMany({
    data: [
      {
        name: EVENT.aiBudgetAlert,
        studentId: params.studentId ?? null,
        courseId: params.courseId ?? null,
        dedupeKey: `ai-budget:${who}:${week}:${params.state}`,
        properties: { scope: params.scope, state: params.state, week, spentUsd: round(params.spentUsd), capUsd: params.capUsd },
      },
    ],
    skipDuplicates: true,
  });
  if (created.count === 0) return;

  const usd = (n: number) => n.toFixed(2).replace(".", ",");
  const subject = params.scope === "student" ? `El estudiante ${params.studentId}` : "El consumo total de Educai";
  const what = params.state === "exceeded" ? "llegó al tope" : `pasó el ${Math.round(budgetAlertRatio() * 100)}% del tope`;
  const text = `[Educai] ${subject} ${what} semanal de IA: ${usd(params.spentUsd)} de ${usd(params.capUsd)} USD (semana del ${week}).`;
  console.warn(JSON.stringify({ event: EVENT.aiBudgetAlert, scope: params.scope, state: params.state, week, studentId: params.studentId ?? null, spentUsd: round(params.spentUsd), capUsd: params.capUsd }));
  await sendWebhook(text);
}

function round(usd: number): number {
  return Math.round(usd * 10_000) / 10_000;
}

/** Webhook compatible con Slack ("text") y Discord ("content"). Nunca rompe el flujo. */
async function sendWebhook(text: string): Promise<void> {
  const url = process.env.AI_ALERT_WEBHOOK_URL?.trim();
  if (!url) return;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, content: text }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) console.error(`[ai-budget] el webhook de alertas respondió ${response.status}`);
  } catch (error) {
    console.error("[ai-budget] no se pudo enviar la alerta al webhook", error instanceof Error ? error.message : error);
  }
}

/** Revisa los umbrales después de registrar un gasto. Idempotente por semana y umbral. */
export async function checkBudgetAlerts(context: { studentId?: string | null; courseId?: string | null }, now: Date = new Date()): Promise<void> {
  try {
    const from = weekStart(now);
    const ratio = budgetAlertRatio();
    if (context.studentId) {
      const capUsd = weeklyStudentCapUsd();
      const spentUsd = await spentSince(from, context.studentId);
      const state = budgetState(spentUsd, capUsd, ratio);
      if (state !== "ok") await raiseAlert({ scope: "student", state, now, spentUsd, capUsd, studentId: context.studentId, courseId: context.courseId });
    }
    const totalCap = weeklyTotalAlertUsd();
    const totalSpent = await spentSince(from);
    const totalState = budgetState(totalSpent, totalCap, ratio);
    if (totalState !== "ok") await raiseAlert({ scope: "total", state: totalState, now, spentUsd: totalSpent, capUsd: totalCap });
  } catch (error) {
    console.error("[ai-budget] no se pudieron revisar las alertas", error instanceof Error ? error.message : error);
  }
}
