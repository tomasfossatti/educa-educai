import "server-only";
import { z } from "zod";
import { extractPages } from "@/server/material/extract";
import { AIError, type ChatCall, type ChatStream, type LLMMessage, type LLMProvider, type StructuredCall, type UsageInfo } from "./types";

/**
 * Proveedor para APIs compatibles con OpenAI (`POST /chat/completions`): DeepSeek y Gemini de Google.
 *
 * Diferencias con Claude:
 * - Salida estructurada: modo JSON (`response_format: json_object`) más el JSON Schema en el prompt;
 *   la validación final la hace zod, como con cualquier proveedor (regla 3).
 * - No aceptan PDF por esta vía: el programa adjunto se convierte a texto por página.
 * - El esfuerzo va en `reasoning_effort`, con niveles propios de cada proveedor.
 * - No hay respaldo del servidor ante rechazos.
 * La clave se lee de una variable por proveedor. En la nube de Claude Code la inyecta el proxy de red.
 */

export interface OpenAICompatibleConfig {
  /** Nombre que queda en AIUsageEvent.provider. */
  name: string;
  /** Nombre visible en los mensajes de error. */
  label: string;
  baseUrl: string;
  apiKeyEnv: string;
  /** Nivel de reasoning_effort para el esfuerzo de Educai, o null para no mandarlo. */
  effort: (effort: string) => string | null;
}

interface CompatUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  /** DeepSeek */
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
  /** Gemini y OpenAI */
  prompt_tokens_details?: { cached_tokens?: number };
}

/**
 * Tokens de entrada sin caché y leídos de caché por separado, para que el costo use la tarifa de
 * cada uno. Si la API no informa el desglose, todo cuenta como entrada sin caché (lo más caro).
 */
export function toUsage(model: string, usage: CompatUsage | undefined): UsageInfo {
  const prompt = usage?.prompt_tokens ?? 0;
  const hit = usage?.prompt_cache_hit_tokens ?? usage?.prompt_tokens_details?.cached_tokens ?? 0;
  const miss = usage?.prompt_cache_miss_tokens ?? Math.max(0, prompt - hit);
  const completion = usage?.completion_tokens ?? 0;
  // Gemini no incluye el razonamiento interno en completion_tokens pero sí en total_tokens; se
  // factura como salida, así que la diferencia cuenta como salida.
  const reasoning = Math.max(0, (usage?.total_tokens ?? 0) - prompt - completion);
  return { model, inputTokens: miss, outputTokens: completion + reasoning, cacheReadTokens: hit, cacheWriteTokens: 0 };
}

/** Demora que pide la API en un 429 (RetryInfo de Google, "retry in Xs" o Retry-After), en ms. */
export function retryDelayMs(body: string, retryAfter: string | null): number | null {
  const info = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(body);
  if (info) return Math.ceil(Number(info[1]) * 1000);
  const text = /retry in (?:(\d+)h)?(?:(\d+)m)?(\d+(?:\.\d+)?)s/i.exec(body);
  if (text) return Math.ceil(((Number(text[1] ?? 0) * 60 + Number(text[2] ?? 0)) * 60 + Number(text[3])) * 1000);
  if (retryAfter && /^\d+$/.test(retryAfter.trim())) return Number(retryAfter) * 1000;
  return null;
}

/** Espera máxima ante un límite por minuto antes de reintentar (AI_RATE_LIMIT_MAX_WAIT_MS, 60 s). */
function maxWaitMs(): number {
  const v = Number(process.env.AI_RATE_LIMIT_MAX_WAIT_MS);
  return Number.isFinite(v) && v >= 0 && process.env.AI_RATE_LIMIT_MAX_WAIT_MS?.trim() ? v : 60_000;
}

class RateLimited extends Error {
  constructor(
    readonly waitMs: number | null,
    readonly daily: boolean,
  ) {
    super("rate limited");
  }
}

async function errorFromResponse(label: string, response: Response): Promise<AIError | RateLimited> {
  const body = await response.text().catch(() => "");
  if (response.status === 401 || response.status === 403) return new AIError("not_configured", `La clave de ${label} es inválida o no tiene permisos.`);
  if (response.status === 402) return new AIError("not_configured", `La cuenta de ${label} no tiene saldo.`);
  if (response.status === 429) return new RateLimited(retryDelayMs(body, response.headers.get("retry-after")), /PerDay|per day/i.test(body));
  if (response.status >= 500) return new AIError("provider", `Error de ${label} (${response.status}).`, true);
  return new AIError("provider", `Solicitud inválida a ${label} (${response.status}): ${body.slice(0, 300)}`);
}

/**
 * Hace el pedido y, ante un límite por minuto con una demora corta, espera y reintenta (hasta 3
 * veces). Un cupo diario agotado o una demora larga cortan enseguida, con un mensaje que lo dice.
 */
async function fetchWithRateLimit(label: string, doFetch: () => Promise<Response>): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const response = await doFetch();
    if (response.ok) return response;
    const error = await errorFromResponse(label, response);
    if (!(error instanceof RateLimited)) throw error;
    if (error.daily) throw new AIError("rate_limited", `Se agotó el cupo diario de ${label}. Se renueva mañana.`);
    const wait = error.waitMs ?? 5_000;
    if (attempt >= 3 || wait > maxWaitMs()) {
      throw new AIError("rate_limited", `${label} está limitando solicitudes. Intentá de nuevo en unos minutos.`, true);
    }
    await new Promise((r) => setTimeout(r, wait + 250));
  }
}

/** El programa en PDF va como texto por página. */
async function attachmentsAsText(call: StructuredCall<unknown>): Promise<string> {
  if (!call.attachments?.length) return "";
  const parts: string[] = [];
  for (const a of call.attachments) {
    const pages = await extractPages(Uint8Array.from(Buffer.from(a.base64, "base64")), "pdf");
    parts.push(pages.map((p) => `[Página ${p.page}]\n${p.text}`).join("\n\n"));
  }
  return `DOCUMENTO ADJUNTO (texto extraído del PDF):\n\n${parts.join("\n\n")}\n\n`;
}

function schemaInstruction(schema: z.ZodType<unknown>): string {
  let jsonSchema: unknown = null;
  try {
    jsonSchema = z.toJSONSchema(schema);
  } catch {
    jsonSchema = null;
  }
  return [
    "FORMATO DE RESPUESTA: respondé únicamente con un objeto json válido, sin texto antes ni después.",
    jsonSchema ? `El json tiene que cumplir este JSON Schema:\n${JSON.stringify(jsonSchema)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly name: string;

  constructor(private readonly config: OpenAICompatibleConfig) {
    this.name = config.name;
  }

  isConfigured(): boolean {
    return Boolean(process.env[this.config.apiKeyEnv]);
  }

  private url(): string {
    return `${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`;
  }

  private headers(): Record<string, string> {
    const key = process.env[this.config.apiKeyEnv];
    if (!key) throw new AIError("not_configured", `Falta configurar ${this.config.apiKeyEnv} en el servidor.`);
    return { "content-type": "application/json", authorization: `Bearer ${key}` };
  }

  private effort(effort: string): { reasoning_effort?: string } {
    const level = this.config.effort(effort);
    return level ? { reasoning_effort: level } : {};
  }

  async generateStructured<T>(call: StructuredCall<T>): Promise<{ data: T; usage: UsageInfo }> {
    const messages: LLMMessage[] = call.messages.map((m) => ({ ...m }));
    const prefix = await attachmentsAsText(call as StructuredCall<unknown>);
    if (prefix && messages[0]) messages[0] = { ...messages[0], content: prefix + messages[0].content };

    let response: Response;
    try {
      response = await fetchWithRateLimit(this.config.label, () => fetch(this.url(), {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          model: call.model,
          max_tokens: call.maxTokens,
          ...this.effort(call.effort),
          response_format: { type: "json_object" },
          messages: [{ role: "system", content: `${call.system}\n\n${schemaInstruction(call.schema as z.ZodType<unknown>)}` }, ...messages],
        }),
        signal: AbortSignal.timeout(180_000),
      }));
    } catch (error) {
      if (error instanceof AIError) throw error;
      throw new AIError("provider", `No se pudo conectar con ${this.config.label}: ${error instanceof Error ? error.message : String(error)}`, true);
    }
    const body = (await response.json()) as { choices?: { message?: { content?: string }; finish_reason?: string }[]; usage?: CompatUsage };
    const choice = body.choices?.[0];
    if (choice?.finish_reason === "length") throw new AIError("invalid_output", `La respuesta de ${this.config.label} quedó incompleta (límite de tokens).`, true);
    if (choice?.finish_reason === "content_filter") throw new AIError("refusal", `${this.config.label} declinó procesar este contenido.`);
    let parsed: unknown;
    try {
      parsed = JSON.parse(choice?.message?.content ?? "");
    } catch {
      throw new AIError("invalid_output", `La salida de ${this.config.label} no es un json válido.`, true);
    }
    const result = call.schema.safeParse(parsed);
    if (!result.success) throw new AIError("invalid_output", `La salida de ${this.config.label} no cumplió el schema esperado.`, true);
    return { data: result.data, usage: toUsage(call.model, body.usage) };
  }

  streamChat(call: ChatCall): ChatStream {
    let headers: Record<string, string>;
    try {
      headers = this.headers();
    } catch (error) {
      const failed = Promise.reject(error);
      failed.catch(() => undefined);
      return { textStream: (async function* () {})(), done: failed };
    }
    const label = this.config.label;
    const request = fetchWithRateLimit(label, () => fetch(this.url(), {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: call.model,
        max_tokens: call.maxTokens,
        ...this.effort(call.effort),
        stream: true,
        stream_options: { include_usage: true },
        messages: [{ role: "system", content: call.system }, ...call.messages],
      }),
    }));

    let text = "";
    let usage: CompatUsage | undefined;
    let resolveDone!: (v: { text: string; usage: UsageInfo }) => void;
    let rejectDone!: (e: unknown) => void;
    const done = new Promise<{ text: string; usage: UsageInfo }>((res, rej) => {
      resolveDone = res;
      rejectDone = rej;
    });
    done.catch(() => undefined);

    async function* textStream(): AsyncIterable<string> {
      try {
        const response = await request;
        if (!response.body) throw new AIError("provider", `${label} respondió sin contenido.`, true);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done: finished } = await reader.read();
          if (finished) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (data === "[DONE]") continue;
            const event = JSON.parse(data) as { choices?: { delta?: { content?: string } }[]; usage?: CompatUsage };
            if (event.usage) usage = event.usage;
            const piece = event.choices?.[0]?.delta?.content;
            if (piece) {
              text += piece;
              yield piece;
            }
          }
        }
        resolveDone({ text, usage: toUsage(call.model, usage) });
      } catch (error) {
        const aiError = error instanceof AIError ? error : new AIError("provider", error instanceof Error ? error.message : String(error), true);
        rejectDone(aiError);
        throw aiError;
      }
    }

    return { textStream: textStream(), done };
  }
}
