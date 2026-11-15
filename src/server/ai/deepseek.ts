import "server-only";
import { OpenAICompatibleProvider } from "./openai-compatible";

export { toUsage } from "./openai-compatible";

/**
 * DeepSeek (uso provisorio decidido por Tomás). Los modelos V4 admiten reasoning_effort
 * low, high y max (por defecto high): low queda en low y medium o high pasan a high.
 */
export function reasoningEffort(effort: string): "low" | "high" {
  return effort === "low" ? "low" : "high";
}

export class DeepSeekProvider extends OpenAICompatibleProvider {
  constructor() {
    super({
      name: "deepseek",
      label: "DeepSeek",
      baseUrl: process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com",
      apiKeyEnv: "DEEPSEEK_API_KEY",
      effort: reasoningEffort,
    });
  }
}
