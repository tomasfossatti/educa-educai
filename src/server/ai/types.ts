import type { z } from "zod";

/**
 * Contrato entre el dominio y cualquier proveedor de LLM.
 * El dominio nunca importa SDKs de proveedores: solo estos tipos.
 */

export type AIOperation =
  | "curriculum.extract"
  | "tutor.reply"
  | "interpret.observe"
  | "interpret.signals"
  | "interpret.evaluate"
  | "interpret.infer"
  | "interpret.feedback"
  | "pagelm.chat"
  | "pagelm.quiz"
  | "pagelm.flashcards"
  | "pagelm.notes"
  | "pagelm.podcast"
  | "deepstudent.agent"
  | "getit.feynman"
  | "getit.evaluate";

export type Effort = "low" | "medium" | "high";

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LLMAttachment {
  kind: "pdf";
  base64: string;
}

export interface UsageInfo {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface StructuredCall<T> {
  operation: AIOperation;
  model: string;
  effort: Effort;
  maxTokens: number;
  system: string;
  messages: LLMMessage[];
  attachments?: LLMAttachment[];
  schema: z.ZodType<T>;
}

export interface ChatCall {
  operation: AIOperation;
  model: string;
  effort: Effort;
  maxTokens: number;
  system: string;
  messages: LLMMessage[];
}

export interface ChatStream {
  textStream: AsyncIterable<string>;
  done: Promise<{ text: string; usage: UsageInfo }>;
}

export interface LLMProvider {
  readonly name: string;
  isConfigured(): boolean;
  generateStructured<T>(call: StructuredCall<T>): Promise<{ data: T; usage: UsageInfo }>;
  streamChat(call: ChatCall): ChatStream;
}

/** Contexto para atribuir el costo de cada operación (AIUsageEvent). */
export interface UsageContext {
  actorUserId?: string | null;
  studentId?: string | null;
  courseId?: string | null;
  runId?: string | null;
}

export type AIErrorKind = "not_configured" | "refusal" | "invalid_output" | "rate_limited" | "provider";

export class AIError extends Error {
  constructor(
    public readonly kind: AIErrorKind,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "AIError";
  }
}
