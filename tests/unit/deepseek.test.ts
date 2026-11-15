import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { modelFor } from "@/server/ai/config";
import { DeepSeekProvider, toUsage } from "@/server/ai/deepseek";
import { estimateCostUsd } from "@/server/ai/pricing";
import { makePdf } from "../support/documents";

const schema = z.object({ answer: z.string(), n: z.number() });
const call = (extra: object = {}) => ({
  operation: "folder.chat" as const,
  model: "deepseek-flash",
  effort: "low" as const,
  maxTokens: 500,
  system: "Sos un tutor.",
  messages: [{ role: "user" as const, content: "Hola" }],
  schema,
  ...extra,
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("proveedor de DeepSeek", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    process.env.DEEPSEEK_API_KEY = "prueba";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.AI_PROVIDER;
  });

  it("pide modo JSON con el esquema en el prompt y valida la salida con zod", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        choices: [{ message: { content: '{"answer":"ok","n":2}' }, finish_reason: "stop" }],
        usage: { prompt_tokens: 100, completion_tokens: 10, prompt_cache_hit_tokens: 40, prompt_cache_miss_tokens: 60 },
      }),
    );
    const { data, usage } = await new DeepSeekProvider().generateStructured(call());
    expect(data).toEqual({ answer: "ok", n: 2 });
    expect(usage).toMatchObject({ model: "deepseek-flash", inputTokens: 60, cacheReadTokens: 40, outputTokens: 10 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.deepseek.com/chat/completions");
    const body = JSON.parse(String(init.body));
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.reasoning_effort).toBe("low");
    expect(body.messages[0].content).toContain("json");
    expect(body.messages[0].content).toContain('"answer"');
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer prueba");
  });

  it("una salida que no cumple el esquema es un error reintentable, no un dato", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ choices: [{ message: { content: '{"answer":3}' }, finish_reason: "stop" }] }));
    await expect(new DeepSeekProvider().generateStructured(call())).rejects.toMatchObject({ kind: "invalid_output", retryable: true });
    fetchMock.mockResolvedValue(jsonResponse({ choices: [{ message: { content: "no es json" }, finish_reason: "stop" }] }));
    await expect(new DeepSeekProvider().generateStructured(call())).rejects.toMatchObject({ kind: "invalid_output" });
  });

  it("traduce los errores HTTP", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 401 }));
    await expect(new DeepSeekProvider().generateStructured(call())).rejects.toMatchObject({ kind: "not_configured" });
    fetchMock.mockResolvedValue(new Response("{}", { status: 402 }));
    await expect(new DeepSeekProvider().generateStructured(call())).rejects.toMatchObject({ kind: "not_configured" });
    process.env.AI_RATE_LIMIT_MAX_WAIT_MS = "0";
    fetchMock.mockResolvedValue(new Response("{}", { status: 429 }));
    await expect(new DeepSeekProvider().generateStructured(call())).rejects.toMatchObject({ kind: "rate_limited", retryable: true });
    delete process.env.AI_RATE_LIMIT_MAX_WAIT_MS;
  });

  it("sin clave no llama a la API", async () => {
    delete process.env.DEEPSEEK_API_KEY;
    expect(new DeepSeekProvider().isConfigured()).toBe(false);
    await expect(new DeepSeekProvider().generateStructured(call())).rejects.toMatchObject({ kind: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("el PDF adjunto se manda como texto por página", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ choices: [{ message: { content: '{"answer":"ok","n":1}' }, finish_reason: "stop" }] }));
    const pdf = Buffer.from(makePdf(["Unidad 1. Segmentacion", "Unidad 2. Hipotesis"])).toString("base64");
    await new DeepSeekProvider().generateStructured(call({ attachments: [{ kind: "pdf", base64: pdf }] }));
    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.messages[1].content).toContain("[Página 2]");
    expect(body.messages[1].content).toContain("Hipotesis");
  });

  it("el chat llega por streaming y al final informa el uso", async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"Ho"}}]}',
      'data: {"choices":[{"delta":{"content":"la"}}]}',
      'data: {"choices":[],"usage":{"prompt_tokens":20,"completion_tokens":2,"prompt_cache_hit_tokens":0,"prompt_cache_miss_tokens":20}}',
      "data: [DONE]",
      "",
    ].join("\n\n");
    fetchMock.mockResolvedValue(new Response(sse, { status: 200 }));
    const stream = new DeepSeekProvider().streamChat({ ...call(), schema: undefined } as never);
    let text = "";
    for await (const piece of stream.textStream) text += piece;
    const done = await stream.done;
    expect(text).toBe("Hola");
    expect(done.usage).toMatchObject({ inputTokens: 20, outputTokens: 2 });
  });
});

describe("modelos y precios de DeepSeek", () => {
  afterEach(() => {
    for (const k of ["AI_PROVIDER", "DEEPSEEK_MODEL", "DEEPSEEK_EXTRACTION_MODEL", "DEEPSEEK_PRICE_INPUT"]) delete process.env[k];
  });

  it("con AI_PROVIDER=deepseek todas las operaciones usan modelos de DeepSeek", () => {
    process.env.AI_PROVIDER = "deepseek";
    expect(modelFor("folder.chat")).toBe("deepseek-flash");
    expect(modelFor("interpret.observe")).toBe("deepseek-flash");
    process.env.DEEPSEEK_EXTRACTION_MODEL = "deepseek-v4-pro";
    expect(modelFor("interpret.observe")).toBe("deepseek-v4-pro");
    expect(modelFor("folder.chat")).toBe("deepseek-flash");
  });

  it("el costo usa la tarifa de caché y se puede ajustar por variable", () => {
    const usage = toUsage("deepseek-flash", { prompt_tokens: 1_000_000, prompt_cache_hit_tokens: 0, completion_tokens: 1_000_000 });
    expect(estimateCostUsd(usage)).toBeCloseTo(1.5);
    process.env.DEEPSEEK_PRICE_INPUT = "0.14";
    expect(estimateCostUsd(usage)).toBeCloseTo(1.34);
    const cached = toUsage("deepseek-flash", { prompt_tokens: 1_000_000, prompt_cache_hit_tokens: 1_000_000, completion_tokens: 0 });
    expect(cached.inputTokens).toBe(0);
    expect(estimateCostUsd(cached)).toBeCloseTo(0.006);
  });
});
