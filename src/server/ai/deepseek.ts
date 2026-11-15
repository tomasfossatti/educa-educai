import "server-only";
import { z } from "zod";
import { extractPages } from "@/server/material/extract";
import { AIError, type ChatCall, type ChatStream, type LLMMessage, type LLMProvider, type StructuredCall, type UsageInfo } from "./types";

/**
 * Proveedor de DeepSeek (API compatible con OpenAI, `POST /chat/completions`).
 *
 * Uso provisorio decidido por Tomás mientras no haya clave de Anthropic. Diferencias con Claude:
 * - Salida estructurada: modo JSON (`response_format: json_object`) más el JSON Schema en el prompt;
 *   la validación final la hace zod, como con cualquier proveedor (regla 3).
 * - No acepta PDF: el programa adjunto se convierte a texto por página antes de enviarlo.
 * - El esfuerzo va en `reasoning_effort`. Los modelos V4 admiten low, high y max (por defecto high):
 *   low queda en low y medium o high pasan a high.
 * - No tiene respaldo del servidor ante rechazos.
 * La clave va en DEEPSEEK_API_KEY. En la nube de Claude Code la inyecta el proxy de red.
 */

const BASE_URL = () => (process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com").replace(/\/$/, "");

interface DeepSeekUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
}

/**
 * Tokens de entrada sin caché y leídos de caché por separado, para que el costo use la tarifa de
 * cada uno. Si la API no informa el desglose, todo cuenta como entrada sin caché (lo más caro).
 */
export function toUsage(model: string, usage: DeepSeekUsage | undefined): UsageInfo {
  const prompt = usage?.prompt_tokens ?? 0;
  const hit = usage?.prompt_cache_hit_tokens ?? 0;
  const miss = usage?.prompt_cache_miss_tokens ?? Math.max(0, prompt - hit);
  return { model, inputTokens: miss, outputTokens: usage?.completion_tokens ?? 0, cacheReadTokens: hit, cacheWriteTokens: 0 };
}

async function errorFromResponse(response: Response): Promise<AIError> {
  const body = await response.text().catch(() => "");
  if (response.status === 401 || response.status === 403) return new AIError("not_configured", "La clave de DeepSeek es inválida o no tiene permisos.");
  if (response.status === 402) return new AIError("not_configured", "La cuenta de DeepSeek no tiene saldo.");
  if (response.status === 429) return new AIError("rate_limited", "DeepSeek está limitando solicitudes. Intentá de nuevo en unos minutos.", true);
  if (response.status >= 500) return new AIError("provider", `Error de DeepSeek (${response.status}).`, true);
  return new AIError("provider", `Solicitud inválida a DeepSeek (${response.status}): ${body.slice(0, 300)}`);
}

/** El programa en PDF va como texto por página: DeepSeek no lee PDF. */
async function attachmentsAsText(call: StructuredCall<unknown>): Promise<string> {
  if (!call.attachments?.length) return "";
  const parts: string[] = [];
  for (const a of call.attachments) {
    const pages = await extractPages(Uint8Array.from(Buffer.from(a.base64, "base64")), "pdf");
    parts.push(pages.map((p) => `[Página ${p.page}]\n${p.text}`).join("\n\n"));
  }
  return `DOCUMENTO ADJUNTO (texto extraído del PDF):\n\n${parts.join("\n\n")}\n\n`;
}

/** Esfuerzo de Educai (low, medium, high) a los niveles que admiten los modelos V4 de DeepSeek. */
export function reasoningEffort(effort: string): "low" | "high" {
  return effort === "low" ? "low" : "high";
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

export class DeepSeekProvider implements LLMProvider {
  readonly name = "deepseek";

  isConfigured(): boolean {
    return Boolean(process.env.DEEPSEEK_API_KEY);
  }

  private headers(): Record<string, string> {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) throw new AIError("not_configured", "Falta configurar DEEPSEEK_API_KEY en el servidor.");
    return { "content-type": "application/json", authorization: `Bearer ${key}` };
  }

  async generateStructured<T>(call: StructuredCall<T>): Promise<{ data: T; usage: UsageInfo }> {
    const messages: LLMMessage[] = call.messages.map((m) => ({ ...m }));
    const prefix = await attachmentsAsText(call as StructuredCall<unknown>);
    if (prefix && messages[0]) messages[0] = { ...messages[0], content: prefix + messages[0].content };

    let response: Response;
    try {
      response = await fetch(`${BASE_URL()}/chat/completions`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          model: call.model,
          max_tokens: call.maxTokens,
          reasoning_effort: reasoningEffort(call.effort),
          response_format: { type: "json_object" },
          messages: [{ role: "system", content: `${call.system}\n\n${schemaInstruction(call.schema as z.ZodType<unknown>)}` }, ...messages],
        }),
        signal: AbortSignal.timeout(180_000),
      });
    } catch (error) {
      if (error instanceof AIError) throw error;
      throw new AIError("provider", `No se pudo conectar con DeepSeek: ${error instanceof Error ? error.message : String(error)}`, true);
    }
    if (!response.ok) throw await errorFromResponse(response);

    const body = (await response.json()) as { choices?: { message?: { content?: string }; finish_reason?: string }[]; usage?: DeepSeekUsage };
    const choice = body.choices?.[0];
    if (choice?.finish_reason === "length") throw new AIError("invalid_output", "La respuesta de DeepSeek quedó incompleta (límite de tokens).", true);
    if (choice?.finish_reason === "content_filter") throw new AIError("refusal", "DeepSeek declinó procesar este contenido.");
    let parsed: unknown;
    try {
      parsed = JSON.parse(choice?.message?.content ?? "");
    } catch {
      throw new AIError("invalid_output", "La salida de DeepSeek no es un json válido.", true);
    }
    const result = call.schema.safeParse(parsed);
    if (!result.success) throw new AIError("invalid_output", "La salida de DeepSeek no cumplió el schema esperado.", true);
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
    const request = fetch(`${BASE_URL()}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: call.model,
        max_tokens: call.maxTokens,
        reasoning_effort: reasoningEffort(call.effort),
        stream: true,
        stream_options: { include_usage: true },
        messages: [{ role: "system", content: call.system }, ...call.messages],
      }),
    });

    let text = "";
    let usage: DeepSeekUsage | undefined;
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
        if (!response.ok || !response.body) throw await errorFromResponse(response);
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
            const event = JSON.parse(data) as { choices?: { delta?: { content?: string } }[]; usage?: DeepSeekUsage };
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
