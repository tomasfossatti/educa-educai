import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AIError, type ChatCall, type ChatStream, type LLMMessage, type LLMProvider, type StructuredCall, type UsageInfo } from "./types";

// Fallback del lado del servidor ante rechazos de los clasificadores de seguridad:
// la API reintenta la misma solicitud en un modelo alternativo elegido por categoría.
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

type BetaMessage = Anthropic.Beta.BetaMessage;

function toUsage(message: BetaMessage): UsageInfo {
  return {
    model: message.model,
    inputTokens: message.usage.input_tokens ?? 0,
    outputTokens: message.usage.output_tokens ?? 0,
    cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
  };
}

function checkStop(message: BetaMessage): void {
  if (message.stop_reason === "refusal") {
    throw new AIError("refusal", "El modelo declinó procesar este contenido.");
  }
  if (message.stop_reason === "max_tokens") {
    throw new AIError("invalid_output", "La respuesta del modelo quedó incompleta (límite de tokens).", true);
  }
}

function normalizeError(error: unknown): AIError {
  if (error instanceof AIError) return error;
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new AIError("not_configured", "La clave del proveedor de IA es inválida o no tiene permisos.");
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AIError("rate_limited", "El proveedor de IA está limitando solicitudes. Intentá de nuevo en unos minutos.", true);
  }
  if (error instanceof Anthropic.BadRequestError) {
    return new AIError("provider", `Solicitud inválida al proveedor de IA: ${error.message}`);
  }
  if (error instanceof Anthropic.APIError) {
    const retryable = error.status === undefined || error.status >= 500 || error.status === 408 || error.status === 409;
    return new AIError("provider", `Error del proveedor de IA (${error.status ?? "red"}).`, retryable);
  }
  if (error instanceof Error && /authentication|api key|apiKey/i.test(error.message)) {
    return new AIError("not_configured", "No hay credenciales configuradas para el proveedor de IA.");
  }
  return new AIError("provider", error instanceof Error ? error.message : "Error desconocido del proveedor de IA.");
}

function toMessages(messages: LLMMessage[], attachments: StructuredCall<unknown>["attachments"]): Anthropic.Beta.BetaMessageParam[] {
  const result: Anthropic.Beta.BetaMessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }));
  if (attachments?.length && result[0]?.role === "user") {
    const first = result[0];
    result[0] = {
      role: "user",
      content: [
        ...attachments.map((a) => ({
          type: "document" as const,
          source: { type: "base64" as const, media_type: "application/pdf" as const, data: a.base64 },
        })),
        { type: "text" as const, text: String(first.content) },
      ],
    };
  }
  return result;
}

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  private client: Anthropic | null = null;

  isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  }

  private getClient(): Anthropic {
    if (!this.isConfigured()) {
      throw new AIError("not_configured", "Falta configurar ANTHROPIC_API_KEY en el servidor.");
    }
    this.client ??= new Anthropic();
    return this.client;
  }

  async generateStructured<T>(call: StructuredCall<T>): Promise<{ data: T; usage: UsageInfo }> {
    try {
      const response = await this.getClient().beta.messages.parse({
        model: call.model,
        max_tokens: call.maxTokens,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        system: [{ type: "text", text: call.system, cache_control: { type: "ephemeral" } }],
        messages: toMessages(call.messages, call.attachments),
        output_config: { effort: call.effort, format: zodOutputFormat(call.schema) },
      });
      checkStop(response);
      if (response.parsed_output == null) {
        throw new AIError("invalid_output", "La salida del modelo no cumplió el schema esperado.", true);
      }
      return { data: response.parsed_output as T, usage: toUsage(response) };
    } catch (error) {
      throw normalizeError(error);
    }
  }

  streamChat(call: ChatCall): ChatStream {
    const stream = this.getClient().beta.messages.stream({
      model: call.model,
      max_tokens: call.maxTokens,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      system: [{ type: "text", text: call.system, cache_control: { type: "ephemeral" } }],
      messages: toMessages(call.messages, undefined),
      cache_control: { type: "ephemeral" },
      output_config: { effort: call.effort },
    });

    async function* textStream(): AsyncIterable<string> {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            yield event.delta.text;
          }
        }
      } catch (error) {
        throw normalizeError(error);
      }
    }

    const done = stream
      .finalMessage()
      .then((message) => {
        if (message.stop_reason === "refusal") {
          throw new AIError("refusal", "El modelo declinó responder este mensaje.");
        }
        const text = message.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
          .map((b) => b.text)
          .join("");
        return { text, usage: toUsage(message) };
      })
      .catch((error: unknown) => {
        throw normalizeError(error);
      });
    // Evita rechazos no manejados si nadie espera `done` (p. ej. el cliente cortó la conexión).
    done.catch(() => undefined);

    return { textStream: textStream(), done };
  }
}
