import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { modelFor } from "@/server/ai/config";
import { GeminiProvider } from "@/server/ai/gemini";
import { toUsage } from "@/server/ai/openai-compatible";
import { estimateCostUsd } from "@/server/ai/pricing";

const schema = z.object({ ok: z.boolean() });
const call = (effort: "low" | "medium" | "high" = "medium") => ({
  operation: "interpret.observe" as const,
  model: "gemini-3.5-flash",
  effort,
  maxTokens: 500,
  system: "Analizá.",
  messages: [{ role: "user" as const, content: "Hola" }],
  schema,
});

describe("proveedor de Gemini", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' }, finish_reason: "stop" }], usage: { prompt_tokens: 50, completion_tokens: 5, prompt_tokens_details: { cached_tokens: 20 } } }), {
        status: 200,
      }),
    );
    process.env.GEMINI_API_KEY = "prueba";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    for (const k of ["GEMINI_API_KEY", "GEMINI_REASONING_EFFORT", "AI_PROVIDER", "GEMINI_MODEL", "GEMINI_EXTRACTION_MODEL", "GEMINI_PRICE_INPUT"]) delete process.env[k];
  });

  it("usa el endpoint compatible con OpenAI de Google, con la clave como Bearer", async () => {
    const provider = new GeminiProvider();
    expect(provider.name).toBe("gemini");
    const { data, usage } = await provider.generateStructured(call());
    expect(data).toEqual({ ok: true });
    expect(usage).toMatchObject({ inputTokens: 30, cacheReadTokens: 20, outputTokens: 5 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer prueba");
    const body = JSON.parse(String(init.body));
    expect(body.reasoning_effort).toBe("medium");
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("GEMINI_REASONING_EFFORT=off no manda el esfuerzo", async () => {
    process.env.GEMINI_REASONING_EFFORT = "off";
    await new GeminiProvider().generateStructured(call());
    expect(JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body)).reasoning_effort).toBeUndefined();
  });

  it("un 429 del plan gratuito es un límite reintentable, con el nombre del proveedor", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 429 }));
    await expect(new GeminiProvider().generateStructured(call())).rejects.toMatchObject({ kind: "rate_limited", retryable: true, message: expect.stringContaining("Gemini") });
  });
});

describe("modelos y precios de Gemini", () => {
  afterEach(() => {
    for (const k of ["AI_PROVIDER", "GEMINI_MODEL", "GEMINI_EXTRACTION_MODEL", "GEMINI_PRICE_INPUT"]) delete process.env[k];
  });

  it("con AI_PROVIDER=gemini todas las operaciones usan modelos de Gemini", () => {
    process.env.AI_PROVIDER = "gemini";
    expect(modelFor("folder.chat")).toBe("gemini-3.5-flash");
    process.env.GEMINI_EXTRACTION_MODEL = "gemini-3.5-flash-lite";
    expect(modelFor("interpret.signals")).toBe("gemini-3.5-flash-lite");
    expect(modelFor("folder.chat")).toBe("gemini-3.5-flash");
  });

  it("el razonamiento interno, que no viene en completion_tokens, cuenta como salida", () => {
    expect(toUsage("gemini-3.5-flash", { prompt_tokens: 22, completion_tokens: 19, total_tokens: 296 }).outputTokens).toBe(274);
    expect(toUsage("deepseek-flash", { prompt_tokens: 10, completion_tokens: 5 }).outputTokens).toBe(5);
  });

  it("el plan gratuito cuesta 0, pero se puede configurar un precio", () => {
    const usage = toUsage("gemini-3.5-flash", { prompt_tokens: 1_000_000, completion_tokens: 1_000_000 });
    expect(estimateCostUsd(usage)).toBe(0);
    process.env.GEMINI_PRICE_INPUT = "0.3";
    expect(estimateCostUsd(usage)).toBeCloseTo(0.3);
  });
});
