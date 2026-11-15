import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { FallbackProvider, fallbackOrder } from "@/server/ai/fallback";

const schema = z.object({ ok: z.boolean() });
const call = (operation: "folder.chat" | "interpret.signals" = "folder.chat") => ({
  operation,
  model: "fallback",
  effort: "low" as const,
  maxTokens: 500,
  system: "Sistema",
  messages: [{ role: "user" as const, content: "Hola" }],
  schema,
});
const KEYS = ["GEMINI_API_KEY", "GROQ_API_KEY", "CEREBRAS_API_KEY", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_FALLBACK_ORDER", "GROQ_MODEL"];

const ok = () => new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' }, finish_reason: "stop" }], usage: { prompt_tokens: 5, completion_tokens: 2 } }), { status: 200 });
const dailyQuota = () => new Response('{"error":{"message":"requests per day limit exceeded","details":[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]}}', { status: 429 });

describe("cadena de respaldo entre proveedores gratuitos", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const k of KEYS) delete process.env[k];
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    for (const k of KEYS) delete process.env[k];
  });

  it("si Gemini agotó el cupo pasa a Groq, y el uso queda con el proveedor y el modelo que respondieron", async () => {
    process.env.AI_FALLBACK_ORDER = "gemini,groq";
    process.env.GEMINI_API_KEY = "g";
    process.env.GROQ_API_KEY = "q";
    fetchMock.mockImplementation(async (url: string) => (url.includes("googleapis") ? dailyQuota() : ok()));
    const { data, usage } = await new FallbackProvider().generateStructured(call());
    expect(data).toEqual({ ok: true });
    expect(usage).toMatchObject({ provider: "groq", model: "openai/gpt-oss-120b" });
    expect(fetchMock.mock.calls.map((c) => new URL(String(c[0])).host)).toEqual(["generativelanguage.googleapis.com", "api.groq.com"]);
    expect(process.env.AI_FALLBACK_ORDER).toBe("gemini,groq");
  });

  it("saltea los proveedores sin clave y respeta AI_FALLBACK_ORDER", async () => {
    process.env.CEREBRAS_API_KEY = "c";
    process.env.OPENROUTER_API_KEY = "o";
    process.env.AI_FALLBACK_ORDER = "openrouter, cerebras";
    expect(fallbackOrder()).toEqual(["openrouter", "cerebras"]);
    fetchMock.mockImplementation(async () => ok());
    const { usage } = await new FallbackProvider().generateStructured(call());
    expect(usage.provider).toBe("openrouter");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("manda reasoning_effort solo a los modelos gpt-oss", async () => {
    process.env.GROQ_API_KEY = "q";
    process.env.CEREBRAS_API_KEY = "c";
    process.env.AI_FALLBACK_ORDER = "groq,cerebras";
    fetchMock.mockImplementation(async (url: string) => (url.includes("groq") ? new Response("{}", { status: 503 }) : ok()));
    await new FallbackProvider().generateStructured(call());
    const bodies = fetchMock.mock.calls.map((c) => JSON.parse(String((c[1] as RequestInit).body)));
    expect(bodies[0].model).toBe("openai/gpt-oss-120b");
    expect(bodies[0].reasoning_effort).toBe("low");
    expect(bodies[bodies.length - 1].model).toBe("llama-3.3-70b");
    expect(bodies[bodies.length - 1].reasoning_effort).toBeUndefined();
  });

  it("una salida inválida también pasa al siguiente", async () => {
    process.env.GROQ_API_KEY = "q";
    process.env.OPENROUTER_API_KEY = "o";
    fetchMock.mockImplementation(async (url: string) =>
      url.includes("groq") ? new Response(JSON.stringify({ choices: [{ message: { content: "no es json" }, finish_reason: "stop" }] }), { status: 200 }) : ok(),
    );
    expect((await new FallbackProvider().generateStructured(call())).usage.provider).toBe("openrouter");
  });

  it("si ninguno responde, el error lo dice; sin claves, no está configurado", async () => {
    process.env.GROQ_API_KEY = "q";
    fetchMock.mockImplementation(async () => new Response("{}", { status: 402 }));
    await expect(new FallbackProvider().generateStructured(call())).rejects.toMatchObject({ message: expect.stringContaining("Ningún proveedor") });
    delete process.env.GROQ_API_KEY;
    expect(new FallbackProvider().isConfigured()).toBe(false);
    await expect(new FallbackProvider().generateStructured(call())).rejects.toMatchObject({ kind: "not_configured" });
  });

  it("el orden por defecto empieza por Groq", () => {
    expect(fallbackOrder()).toEqual(["groq", "gemini", "openrouter", "deepseek", "cerebras"]);
  });

  it("el chat por streaming pasa al siguiente si el primero falla antes de mandar texto", async () => {
    process.env.AI_FALLBACK_ORDER = "gemini,groq";
    process.env.GEMINI_API_KEY = "g";
    process.env.GROQ_API_KEY = "q";
    const sse = ['data: {"choices":[{"delta":{"content":"Hola"}}]}', 'data: {"choices":[],"usage":{"prompt_tokens":3,"completion_tokens":1}}', "data: [DONE]", ""].join("\n\n");
    fetchMock.mockImplementation(async (url: string) => (url.includes("googleapis") ? dailyQuota() : new Response(sse, { status: 200 })));
    const stream = new FallbackProvider().streamChat({ ...call(), schema: undefined } as never);
    let text = "";
    for await (const piece of stream.textStream) text += piece;
    expect(text).toBe("Hola");
    expect((await stream.done).usage.provider).toBe("groq");
  });
});
