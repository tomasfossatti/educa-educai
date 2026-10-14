import type { AIOperation, Effort } from "./types";

export function defaultModel(): string {
  if (process.env.AI_MODEL?.trim()) return process.env.AI_MODEL.trim();
  const provider = (process.env.AI_PROVIDER || "").toLowerCase();
  if (provider === "google" || provider === "gemini" || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    return "gemini-2.5-flash";
  }
  return "claude-opus-5-5";
}

export const DEFAULT_MODEL = "gemini-2.5-flash";

/**
 * Configuración por operación. Cada responsabilidad del motor tiene su propio
 * prompt, esfuerzo de razonamiento y límite de salida.
 */
export const OPERATION_CONFIG: Record<AIOperation, { effort: Effort; maxTokens: number }> = {
  "curriculum.extract": { effort: "medium", maxTokens: 16000 },
  "tutor.reply": { effort: "low", maxTokens: 8000 },
  "interpret.observe": { effort: "medium", maxTokens: 16000 },
  "interpret.signals": { effort: "medium", maxTokens: 16000 },
  "interpret.evaluate": { effort: "medium", maxTokens: 12000 },
  "interpret.infer": { effort: "medium", maxTokens: 16000 },
  "interpret.feedback": { effort: "low", maxTokens: 8000 },
};

/**
 * Modelo para una operación. Se puede sobrescribir por operación con
 * AI_MODEL_<OPERACION> (p. ej. AI_MODEL_TUTOR_REPLY) o globalmente con AI_MODEL.
 */
export function modelFor(operation: AIOperation): string {
  const specific = process.env[`AI_MODEL_${operation.replace(/\W/g, "_").toUpperCase()}`]?.trim();
  return specific || defaultModel();
}

export function dailyTutorMessageLimit(): number {
  const value = Number(process.env.AI_DAILY_TUTOR_MESSAGES);
  return Number.isFinite(value) && value > 0 ? value : 150;
}
