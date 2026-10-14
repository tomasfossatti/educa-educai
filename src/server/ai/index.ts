import "server-only";
import type { z } from "zod";
import { db } from "@/server/db";
import { AnthropicProvider } from "./anthropic";
import { GoogleProvider } from "./google";
import { OPERATION_CONFIG, modelFor } from "./config";
import { estimateCostUsd } from "./pricing";
import { ScriptedProvider } from "./scripted";
import {
  AIError,
  type AIOperation,
  type ChatStream,
  type LLMAttachment,
  type LLMMessage,
  type LLMProvider,
  type UsageContext,
  type UsageInfo,
} from "./types";

export { AIError } from "./types";
export type { AIOperation, UsageContext } from "./types";

let provider: LLMProvider | null = null;

function createProvider(): LLMProvider {
  const explicit = process.env.AI_PROVIDER?.toLowerCase();
  if (explicit === "google" || explicit === "gemini") {
    return new GoogleProvider();
  }
  if (explicit === "anthropic") {
    return new AnthropicProvider();
  }
  if (explicit === "scripted") {
    // Proveedor determinista para desarrollo y tests: nunca en producción.
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_SCRIPTED_AI !== "true") {
      throw new AIError("not_configured", "AI_PROVIDER=scripted no está permitido en producción.");
    }
    return new ScriptedProvider();
  }

  // Auto-detección: si hay clave de Gemini/Google configurada, usar Google
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    return new GoogleProvider();
  }
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) {
    return new AnthropicProvider();
  }

  return new GoogleProvider();
}

export function getProvider(): LLMProvider {
  provider ??= createProvider();
  return provider;
}

/** Solo para tests: inyecta un proveedor determinista. */
export function setProviderForTesting(next: LLMProvider | null): void {
  provider = next;
}

/** Modo de IA activo, para mostrarlo en la interfaz cuando no es el proveedor real. */
export function aiMode(): "live" | "scripted" | "unconfigured" {
  try {
    const current = getProvider();
    if (current.name === "scripted") return "scripted";
    return current.isConfigured() ? "live" : "unconfigured";
  } catch {
    return "unconfigured";
  }
}

export function isAIConfigured(): boolean {
  try {
    return getProvider().isConfigured();
  } catch {
    return false;
  }
}

async function recordUsage(params: {
  operation: AIOperation;
  context: UsageContext;
  usage: UsageInfo;
  latencyMs: number;
  success: boolean;
  errorType?: string;
}): Promise<void> {
  const cost = params.success || params.usage.inputTokens > 0 ? estimateCostUsd(params.usage) : 0;
  try {
    await db.aIUsageEvent.create({
      data: {
        actorUserId: params.context.actorUserId ?? null,
        studentId: params.context.studentId ?? null,
        courseId: params.context.courseId ?? null,
        runId: params.context.runId ?? null,
        operation: params.operation,
        provider: getProvider().name,
        model: params.usage.model,
        inputTokens: params.usage.inputTokens,
        outputTokens: params.usage.outputTokens,
        cacheReadTokens: params.usage.cacheReadTokens,
        cacheWriteTokens: params.usage.cacheWriteTokens,
        estimatedCostUsd: cost,
        latencyMs: params.latencyMs,
        success: params.success,
        errorType: params.errorType ?? null,
      },
    });
  } catch (error) {
    // La instrumentación nunca debe romper el flujo del usuario.
    console.error("[ai] no se pudo registrar AIUsageEvent", error);
  }
}

function emptyUsage(model: string): UsageInfo {
  return { model, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
}

export async function generateStructured<T>(params: {
  operation: AIOperation;
  system: string;
  messages: LLMMessage[];
  schema: z.ZodType<T>;
  attachments?: LLMAttachment[];
  context: UsageContext;
}): Promise<T> {
  const model = modelFor(params.operation);
  const config = OPERATION_CONFIG[params.operation];
  const started = Date.now();
  try {
    const { data, usage } = await getProvider().generateStructured({
      operation: params.operation,
      model,
      effort: config.effort,
      maxTokens: config.maxTokens,
      system: params.system,
      messages: params.messages,
      attachments: params.attachments,
      schema: params.schema,
    });
    await recordUsage({ operation: params.operation, context: params.context, usage, latencyMs: Date.now() - started, success: true });
    return data;
  } catch (error) {
    const aiError = error instanceof AIError ? error : new AIError("provider", String(error));
    if (aiError.kind !== "not_configured") {
      await recordUsage({
        operation: params.operation,
        context: params.context,
        usage: emptyUsage(model),
        latencyMs: Date.now() - started,
        success: false,
        errorType: aiError.kind,
      });
    }
    throw aiError;
  }
}

/** Reintenta una vez los errores transitorios (red, 5xx, salida truncada). */
export async function generateStructuredWithRetry<T>(params: Parameters<typeof generateStructured<T>>[0]): Promise<T> {
  try {
    return await generateStructured(params);
  } catch (error) {
    if (error instanceof AIError && error.retryable) return generateStructured(params);
    throw error;
  }
}

export function streamChat(params: {
  operation: AIOperation;
  system: string;
  messages: LLMMessage[];
  context: UsageContext;
}): ChatStream {
  const model = modelFor(params.operation);
  const config = OPERATION_CONFIG[params.operation];
  const started = Date.now();
  const stream = getProvider().streamChat({
    operation: params.operation,
    model,
    effort: config.effort,
    maxTokens: config.maxTokens,
    system: params.system,
    messages: params.messages,
  });
  const done = stream.done.then(
    async (result) => {
      await recordUsage({
        operation: params.operation,
        context: params.context,
        usage: result.usage,
        latencyMs: Date.now() - started,
        success: true,
      });
      return result;
    },
    async (error: unknown) => {
      const aiError = error instanceof AIError ? error : new AIError("provider", String(error));
      await recordUsage({
        operation: params.operation,
        context: params.context,
        usage: emptyUsage(model),
        latencyMs: Date.now() - started,
        success: false,
        errorType: aiError.kind,
      });
      throw aiError;
    },
  );
  done.catch(() => undefined);
  return { textStream: stream.textStream, done };
}
