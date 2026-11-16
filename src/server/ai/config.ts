import type { AIOperation, Effort } from "./types";

export function defaultModel(): string {
  if (process.env.AI_MODEL?.trim()) return process.env.AI_MODEL.trim();
  return "claude-opus-5-5";
}

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
  "folder.chat": { effort: "low", maxTokens: 4000 },
  "quiz.generate": { effort: "medium", maxTokens: 6000 },
  "context.facts": { effort: "low", maxTokens: 3000 },
  "context.summary": { effort: "low", maxTokens: 1500 },
  "slides.generate": { effort: "medium", maxTokens: 8000 },
  "profile.improve": { effort: "low", maxTokens: 1500 },
  "lms.assistant": { effort: "low", maxTokens: 800 },
};

/**
 * Operaciones de análisis en segundo plano: extracción de evidencia, señales, inferencias y
 * contexto de carpeta. El spec pide que usen un modelo más económico que el chat.
 */
export const EXTRACTION_OPERATIONS: ReadonlySet<AIOperation> = new Set<AIOperation>([
  "interpret.observe",
  "interpret.signals",
  "interpret.evaluate",
  "interpret.infer",
  "interpret.feedback",
  "context.facts",
  "context.summary",
]);

export function defaultExtractionModel(): string {
  return process.env.AI_EXTRACTION_MODEL?.trim() || "claude-sonnet-5-5";
}

/**
 * Modelo para una operación. Orden: AI_MODEL_<OPERACION> (p. ej. AI_MODEL_TUTOR_REPLY),
 * después AI_EXTRACTION_MODEL para el análisis o AI_MODEL para el resto.
 */
export function modelFor(operation: AIOperation): string {
  // Con DeepSeek los modelos de Claude no aplican: un modelo para el chat y otro (o el mismo) para el análisis.
  // En la cadena de respaldo cada proveedor elige su modelo (src/server/ai/fallback.ts); esto es solo referencia.
  if (process.env.AI_PROVIDER?.toLowerCase() === "fallback") return "fallback";
  if (process.env.AI_PROVIDER?.toLowerCase() === "gemini") {
    // Modelos distintos para el chat y el análisis: en el plan gratuito cada modelo tiene su propio cupo diario.
    const chat = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
    return EXTRACTION_OPERATIONS.has(operation) ? process.env.GEMINI_EXTRACTION_MODEL?.trim() || "gemini-3.5-flash-lite" : chat;
  }
  if (process.env.AI_PROVIDER?.toLowerCase() === "deepseek") {
    const chat = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-flash";
    return EXTRACTION_OPERATIONS.has(operation) ? process.env.DEEPSEEK_EXTRACTION_MODEL?.trim() || chat : chat;
  }
  const specific = process.env[`AI_MODEL_${operation.replace(/\W/g, "_").toUpperCase()}`]?.trim();
  if (specific) return specific;
  return EXTRACTION_OPERATIONS.has(operation) ? defaultExtractionModel() : defaultModel();
}

export function dailyTutorMessageLimit(): number {
  const value = Number(process.env.AI_DAILY_TUTOR_MESSAGES);
  return Number.isFinite(value) && value > 0 ? value : 150;
}
