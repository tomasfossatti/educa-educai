import "server-only";
import { OpenAICompatibleProvider } from "./openai-compatible";

/**
 * Gemini de Google por su API compatible con OpenAI, en el plan gratuito, mientras la cuenta de
 * DeepSeek no tenga saldo (decisión de Tomás). En el plan gratuito Google puede usar lo enviado para
 * mejorar sus productos: solo datos sintéticos (desarrollo y staging), nunca estudiantes reales.
 * El esfuerzo se manda como reasoning_effort (low, medium o high) salvo GEMINI_REASONING_EFFORT=off.
 */
export class GeminiProvider extends OpenAICompatibleProvider {
  constructor() {
    super({
      name: "gemini",
      label: "Gemini",
      baseUrl: process.env.GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKeyEnv: "GEMINI_API_KEY",
      effort: (effort) => (process.env.GEMINI_REASONING_EFFORT === "off" ? null : effort),
    });
  }
}
