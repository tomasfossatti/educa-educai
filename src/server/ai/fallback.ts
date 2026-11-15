import "server-only";
import { EXTRACTION_OPERATIONS } from "./config";
import { reasoningEffort } from "./deepseek";
import { OpenAICompatibleProvider, type OpenAICompatibleConfig } from "./openai-compatible";
import { AIError, type AIOperation, type ChatCall, type ChatStream, type LLMProvider, type StructuredCall, type UsageInfo } from "./types";

/**
 * Cadena de respaldo entre proveedores gratuitos o baratos (AI_PROVIDER=fallback), mientras no haya
 * un proveedor pago. Prueba en orden (AI_FALLBACK_ORDER) y pasa al siguiente si uno responde con
 * límite (429), sin saldo (402), error del servidor, salida inválida o rechazo. Los que no tienen
 * clave se saltean. Cada llamada queda registrada con el proveedor y el modelo que respondieron.
 *
 * Todos usan la API compatible con OpenAI. Los planes gratuitos pueden usar lo enviado para
 * entrenar o mejorar sus productos: solo datos sintéticos, nunca estudiantes reales.
 */

type Kind = "gemini" | "groq" | "cerebras" | "openrouter" | "deepseek";

const env = (key: string) => process.env[key]?.trim() || undefined;
const isExtraction = (op: string) => EXTRACTION_OPERATIONS.has(op as AIOperation);

/** Modelo por proveedor: <PROVEEDOR>_MODEL para el chat y <PROVEEDOR>_EXTRACTION_MODEL para el análisis. */
function model(kind: Kind, chatDefault: string, extractionDefault = chatDefault) {
  const k = kind.toUpperCase();
  return (op: string) => (isExtraction(op) ? env(`${k}_EXTRACTION_MODEL`) ?? env(`${k}_MODEL`) ?? extractionDefault : env(`${k}_MODEL`) ?? chatDefault);
}

/** Solo los modelos gpt-oss aceptan reasoning_effort en Groq y Cerebras. */
const gptOssEffort = (effort: string, model: string) => (model.includes("gpt-oss") ? effort : null);

export function providerConfig(kind: Kind): OpenAICompatibleConfig {
  switch (kind) {
    case "gemini": {
      const m = model("gemini", "gemini-2.5-flash", "gemini-3.5-flash-lite");
      return {
        name: "gemini",
        label: "Gemini",
        baseUrl: env("GEMINI_BASE_URL") ?? "https://generativelanguage.googleapis.com/v1beta/openai",
        apiKeyEnv: "GEMINI_API_KEY",
        effort: (e) => (process.env.GEMINI_REASONING_EFFORT === "off" ? null : e),
        model: m,
      };
    }
    case "groq": {
      const m = model("groq", "openai/gpt-oss-120b");
      return { name: "groq", label: "Groq", baseUrl: "https://api.groq.com/openai/v1", apiKeyEnv: "GROQ_API_KEY", effort: gptOssEffort, model: m };
    }
    case "cerebras": {
      const m = model("cerebras", "llama-3.3-70b");
      return { name: "cerebras", label: "Cerebras", baseUrl: "https://api.cerebras.ai/v1", apiKeyEnv: "CEREBRAS_API_KEY", effort: gptOssEffort, model: m };
    }
    case "openrouter":
      return { name: "openrouter", label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", apiKeyEnv: "OPENROUTER_API_KEY", effort: () => null, model: model("openrouter", "nvidia/nemotron-3-ultra-550b-a55b:free") };
    case "deepseek":
      return {
        name: "deepseek",
        label: "DeepSeek",
        baseUrl: env("DEEPSEEK_BASE_URL") ?? "https://api.deepseek.com",
        apiKeyEnv: "DEEPSEEK_API_KEY",
        effort: reasoningEffort,
        model: model("deepseek", "deepseek-flash"),
      };
  }
}

/** Groq primero (gpt-oss-120b, rápido); Gemini, que tiene la medición de precisión; después el resto. */
const KINDS: Kind[] = ["groq", "gemini", "openrouter", "deepseek", "cerebras"];

export function fallbackOrder(): Kind[] {
  const raw = env("AI_FALLBACK_ORDER");
  if (!raw) return KINDS;
  return raw
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter((k): k is Kind => (KINDS as string[]).includes(k));
}

export class FallbackProvider implements LLMProvider {
  readonly name = "fallback";
  private readonly chain: OpenAICompatibleProvider[];

  constructor(order: Kind[] = fallbackOrder()) {
    // Ante un límite por minuto conviene saltar al siguiente; solo el último espera y reintenta.
    this.chain = order.map((kind, i) => new OpenAICompatibleProvider({ ...providerConfig(kind), maxWaitMs: i === order.length - 1 ? undefined : 0 }));
  }

  private available(): OpenAICompatibleProvider[] {
    return this.chain.filter((p) => p.isConfigured());
  }

  isConfigured(): boolean {
    return this.available().length > 0;
  }

  async generateStructured<T>(call: StructuredCall<T>): Promise<{ data: T; usage: UsageInfo }> {
    const providers = this.available();
    if (providers.length === 0) throw new AIError("not_configured", "No hay ninguna clave de IA configurada para la cadena de respaldo.");
    const failures: string[] = [];
    for (const provider of providers) {
      try {
        return await provider.generateStructured(call);
      } catch (error) {
        const e = error instanceof AIError ? error : new AIError("provider", String(error), true);
        failures.push(`${provider.name}: ${e.message}`);
        console.warn(JSON.stringify({ event: "ai.fallback", operation: call.operation, provider: provider.name, kind: e.kind }));
      }
    }
    throw new AIError("rate_limited", `Ningún proveedor de IA respondió. ${failures.join(" | ")}`, true);
  }

  /** El chat por streaming pasa al siguiente proveedor solo si el actual falla antes de mandar texto. */
  streamChat(call: ChatCall): ChatStream {
    const providers = this.available();
    let resolveDone!: (v: { text: string; usage: UsageInfo }) => void;
    let rejectDone!: (e: unknown) => void;
    const done = new Promise<{ text: string; usage: UsageInfo }>((res, rej) => {
      resolveDone = res;
      rejectDone = rej;
    });
    done.catch(() => undefined);

    async function* textStream(): AsyncIterable<string> {
      const failures: string[] = [];
      for (const provider of providers) {
        const stream = provider.streamChat(call);
        let sent = false;
        try {
          for await (const piece of stream.textStream) {
            sent = true;
            yield piece;
          }
          resolveDone(await stream.done);
          return;
        } catch (error) {
          if (sent) {
            rejectDone(error);
            throw error;
          }
          failures.push(`${provider.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      const error = new AIError("rate_limited", `Ningún proveedor de IA respondió. ${failures.join(" | ") || "No hay claves configuradas."}`, true);
      rejectDone(error);
      throw error;
    }

    return { textStream: textStream(), done };
  }
}
