import { afterEach, describe, expect, it } from "vitest";
import { EXTRACTION_OPERATIONS, modelFor } from "@/server/ai/config";
import { estimateCostUsd } from "@/server/ai/pricing";

const ENV_KEYS = ["AI_MODEL", "AI_EXTRACTION_MODEL", "AI_MODEL_INTERPRET_OBSERVE", "AI_MODEL_FOLDER_CHAT"];
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function clearEnv() {
  for (const k of ENV_KEYS) delete process.env[k];
}

describe("modelo por operación", () => {
  it("el análisis usa un modelo más económico que el chat", () => {
    clearEnv();
    const chat = modelFor("folder.chat");
    const extraction = modelFor("interpret.observe");
    expect(chat).toBe("claude-opus-5-5");
    expect(extraction).toBe("claude-sonnet-5-5");

    const usage = { inputTokens: 10_000, outputTokens: 1_000, cacheReadTokens: 0, cacheWriteTokens: 0 };
    expect(estimateCostUsd({ ...usage, model: extraction })!).toBeLessThan(estimateCostUsd({ ...usage, model: chat })!);
  });

  it("todas las operaciones del motor y del contexto son de análisis", () => {
    for (const op of ["interpret.observe", "interpret.signals", "interpret.evaluate", "interpret.infer", "context.facts", "context.summary"] as const) {
      expect(EXTRACTION_OPERATIONS.has(op)).toBe(true);
    }
    for (const op of ["folder.chat", "tutor.reply", "quiz.generate", "slides.generate", "curriculum.extract"] as const) {
      expect(EXTRACTION_OPERATIONS.has(op)).toBe(false);
    }
  });

  it("AI_MODEL no pisa el modelo del análisis, pero AI_EXTRACTION_MODEL y el de la operación sí", () => {
    clearEnv();
    process.env.AI_MODEL = "claude-fable-5-2";
    expect(modelFor("folder.chat")).toBe("claude-fable-5-2");
    expect(modelFor("interpret.signals")).toBe("claude-sonnet-5-5");

    process.env.AI_EXTRACTION_MODEL = "claude-haiku-5-5";
    expect(modelFor("interpret.signals")).toBe("claude-haiku-5-5");

    process.env.AI_MODEL_INTERPRET_OBSERVE = "claude-opus-5-5";
    expect(modelFor("interpret.observe")).toBe("claude-opus-5-5");
    expect(modelFor("interpret.signals")).toBe("claude-haiku-5-5");
  });

  it("todos los modelos que se pueden elegir tienen precio", () => {
    for (const model of ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5", "claude-fable-5-2"]) {
      expect(estimateCostUsd({ model, inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 })).not.toBeNull();
    }
  });
});
