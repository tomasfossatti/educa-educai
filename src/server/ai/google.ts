import "server-only";
import { GoogleGenAI } from "@google/genai";
import {
  AIError,
  type ChatCall,
  type ChatStream,
  type LLMMessage,
  type LLMProvider,
  type StructuredCall,
  type UsageInfo,
} from "./types";

function toContents(messages: LLMMessage[]) {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

function normalizeGeminiModel(model: string): string {
  if (model.startsWith("claude") || !model.startsWith("gemini")) {
    return "gemini-2.5-flash";
  }
  return model;
}

export class GoogleProvider implements LLMProvider {
  readonly name = "google";
  private client: GoogleGenAI | null = null;

  isConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  }

  private getClient(): GoogleGenAI {
    if (!this.isConfigured()) {
      throw new AIError("not_configured", "Falta configurar GEMINI_API_KEY en el servidor.");
    }
    const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)!.trim();
    this.client ??= new GoogleGenAI({ apiKey });
    return this.client;
  }

  async generateStructured<T>(call: StructuredCall<T>): Promise<{ data: T; usage: UsageInfo }> {
    try {
      const model = normalizeGeminiModel(call.model);
      const ai = this.getClient();

      const contents = toContents(call.messages);
      if (call.attachments?.length && contents.length > 0) {
        for (const att of call.attachments) {
          contents[0].parts.unshift({
            inlineData: {
              mimeType: "application/pdf",
              data: att.base64,
            },
          } as any);
        }
      }

      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: call.system,
          responseMimeType: "application/json",
          maxOutputTokens: call.maxTokens,
        },
      });

      const rawText = response.text ?? "";
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[1]);
        } else {
          throw new AIError("invalid_output", "El modelo de Gemini no devolvió un JSON válido.", true);
        }
      }

      const validated = call.schema.safeParse(parsed);
      if (!validated.success) {
        throw new AIError("invalid_output", `La salida de Gemini no cumplió el esquema: ${validated.error.message}`, true);
      }

      const inputTokens = response.usageMetadata?.promptTokenCount ?? 0;
      const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0;

      return {
        data: validated.data,
        usage: {
          model,
          inputTokens,
          outputTokens,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
      };
    } catch (error) {
      if (error instanceof AIError) throw error;
      const msg = error instanceof Error ? error.message : String(error);
      if (/api key|apiKey|unauthorized|permission/i.test(msg)) {
        throw new AIError("not_configured", "La GEMINI_API_KEY es inválida o no tiene permisos.");
      }
      if (/rate limit|quota|429/i.test(msg)) {
        throw new AIError("rate_limited", "Límite de solicitudes de Gemini alcanzado. Reintentá en un minuto.", true);
      }
      throw new AIError("provider", `Error de Google Gemini: ${msg}`);
    }
  }

  streamChat(call: ChatCall): ChatStream {
    const model = normalizeGeminiModel(call.model);
    const ai = this.getClient();

    const responseStreamPromise = ai.models.generateContentStream({
      model,
      contents: toContents(call.messages),
      config: {
        systemInstruction: call.system,
        maxOutputTokens: call.maxTokens,
      },
    });

    async function* textStream(): AsyncIterable<string> {
      try {
        const responseStream = await responseStreamPromise;
        for await (const chunk of responseStream) {
          const text = chunk.text;
          if (text) yield text;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new AIError("provider", `Error en streaming de Gemini: ${msg}`);
      }
    }

    const done = (async () => {
      try {
        const responseStream = await responseStreamPromise;
        let fullText = "";
        let inputTokens = 0;
        let outputTokens = 0;
        for await (const chunk of responseStream) {
          const text = chunk.text;
          if (text) fullText += text;
          if (chunk.usageMetadata) {
            inputTokens = chunk.usageMetadata.promptTokenCount ?? inputTokens;
            outputTokens = chunk.usageMetadata.candidatesTokenCount ?? outputTokens;
          }
        }
        return {
          text: fullText,
          usage: {
            model,
            inputTokens,
            outputTokens,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
          },
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new AIError("provider", `Error en streaming de Gemini: ${msg}`);
      }
    })();

    done.catch(() => undefined);

    return { textStream: textStream(), done };
  }
}
