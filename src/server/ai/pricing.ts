import type { UsageInfo } from "./types";

/**
 * Precios en USD por millón de tokens (API de Anthropic, tarifas de primera parte).
 * Escritura de caché a 5 minutos = 1,25 × input. Actualizar cuando cambien las tarifas.
 */
interface Price {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

const PRICES: Record<string, Price> = {
  "claude-fable-5-2": { input: 8, output: 40, cacheRead: 0.2, cacheWrite: 10 },
  "claude-fable-5-1": { input: 10, output: 50, cacheRead: 0.25, cacheWrite: 12.5 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  // Haiku 5.5: tarifa hasta 100K tokens de entrada (más allá cuesta 5 veces más).
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
};

/**
 * DeepSeek: precios configurables porque cambian seguido y tienen tarifa pico y fuera de pico.
 * Por defecto, la tarifa pico más alta publicada para V4 Flash (noviembre de 2026), para que el tope
 * de gasto se active antes y no después. Verificar en la página de precios de DeepSeek.
 */
function deepseekPrice(): Price {
  const num = (key: string, fallback: number) => {
    const v = Number(process.env[key]);
    return Number.isFinite(v) && v >= 0 && process.env[key]?.trim() ? v : fallback;
  };
  return {
    input: num("DEEPSEEK_PRICE_INPUT", 0.3),
    output: num("DEEPSEEK_PRICE_OUTPUT", 1.2),
    cacheRead: num("DEEPSEEK_PRICE_CACHE_HIT", 0.006),
    cacheWrite: 0,
  };
}

/**
 * Gemini en el plan gratuito no cobra: el costo es 0 salvo que se configure un plan pago con
 * GEMINI_PRICE_*. El límite real del plan gratuito son las solicitudes por minuto y por día.
 */
function geminiPrice(): Price {
  const num = (key: string) => {
    const v = Number(process.env[key]);
    return Number.isFinite(v) && v >= 0 && process.env[key]?.trim() ? v : 0;
  };
  return { input: num("GEMINI_PRICE_INPUT"), output: num("GEMINI_PRICE_OUTPUT"), cacheRead: num("GEMINI_PRICE_CACHE_HIT"), cacheWrite: 0 };
}

function priceFor(model: string): Price | null {
  if (model.startsWith("deepseek")) return deepseekPrice();
  if (model.startsWith("gemini")) return geminiPrice();
  const key = Object.keys(PRICES)
    .filter((k) => model === k || model.startsWith(`${k}-`))
    .sort((a, b) => b.length - a.length)[0];
  return key ? PRICES[key] : null;
}

/** Costo estimado en USD; null si el modelo no tiene precio cargado. */
export function estimateCostUsd(usage: UsageInfo): number | null {
  const price = priceFor(usage.model);
  if (!price) return null;
  const cost =
    (usage.inputTokens * price.input +
      usage.outputTokens * price.output +
      usage.cacheReadTokens * price.cacheRead +
      usage.cacheWriteTokens * price.cacheWrite) /
    1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
