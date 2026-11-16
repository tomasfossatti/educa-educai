/** Lápiz mágico: sugerencia de redacción para el perfil. Requiere TEST_DATABASE_URL. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { factories } from "../support/factories";

const TEST_DB = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DB)("lápiz mágico (integración)", () => {
  let db: typeof import("@/server/db").db;
  let writing: typeof import("@/server/services/profile-writing");
  let guards: typeof import("@/server/auth/guards");
  let f: ReturnType<typeof factories>;
  const savedCap = process.env.AI_WEEKLY_STUDENT_CAP_USD;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    process.env.AI_PROVIDER = "scripted";
    ({ db } = await import("@/server/db"));
    writing = await import("@/server/services/profile-writing");
    guards = await import("@/server/auth/guards");
    f = factories(db);
  });
  afterAll(() => {
    if (savedCap === undefined) delete process.env.AI_WEEKLY_STUDENT_CAP_USD;
    else process.env.AI_WEEKLY_STUDENT_CAP_USD = savedCap;
  });

  it("devuelve una sugerencia y registra el costo del estudiante", async () => {
    const s = await f.student();
    const result = await writing.improveProfileText({ id: s.id, role: "STUDENT" }, "goals", "Mejorar la distribución de educai.");
    expect(result.suggestion).toContain("Mejorar la distribución de educai.");
    const usage = await db.aIUsageEvent.findFirst({ where: { studentId: s.id, operation: "profile.improve" } });
    expect(usage).not.toBeNull();
  });

  it("rechaza a quien no es estudiante, campos desconocidos y textos vacíos", async () => {
    const t = await f.teacher();
    await expect(writing.improveProfileText({ id: t.id, role: "TEACHER" }, "goals", "Algo para mejorar")).rejects.toBeInstanceOf(guards.AccessDenied);
    const s = await f.student();
    await expect(writing.improveProfileText({ id: s.id, role: "STUDENT" }, "passwordHash", "Algo")).rejects.toBeInstanceOf(writing.ImproveTextError);
    await expect(writing.improveProfileText({ id: s.id, role: "STUDENT" }, "goals", " a ")).rejects.toBeInstanceOf(writing.ImproveTextError);
  });

  it("cuenta para el tope semanal: al llegar al tope no llama a la IA", async () => {
    process.env.AI_WEEKLY_STUDENT_CAP_USD = "1";
    const s = await f.student();
    await db.aIUsageEvent.create({
      data: { studentId: s.id, operation: "folder.chat", provider: "anthropic", model: "claude-opus-5-5", estimatedCostUsd: 2, latencyMs: 1, success: true },
    });
    await expect(writing.improveProfileText({ id: s.id, role: "STUDENT" }, "goals", "Mejorar la distribución")).rejects.toMatchObject({ kind: "budget_exceeded" });
    expect(await db.aIUsageEvent.count({ where: { studentId: s.id, operation: "profile.improve" } })).toBe(0);
  });

  it("le pasa a la IA lo que ya escribió en otros campos, sin repetir el campo que se mejora", async () => {
    const ai = await import("@/server/ai");
    const prompts: string[] = [];
    ai.setProviderForTesting({
      name: "captura",
      isConfigured: () => true,
      generateStructured: async (call) => {
        prompts.push(call.messages.map((m) => m.content).join("\n"));
        return { data: call.schema.parse({ suggestion: "ok", tip: null }), usage: { model: "captura", inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 } };
      },
      streamChat: () => {
        throw new Error("no se usa");
      },
    });
    try {
      const s = await f.student();
      const viewer = { id: s.id, role: "STUDENT" as const };
      await writing.improveProfileText(viewer, "goals", "Mejorar la distribución de educai.", { projectDescription: "Educai, un producto digital para docentes", career: "Ingeniería en Innovación" });
      expect(prompts[0]).toContain("Proyecto personal: Educai, un producto digital para docentes");
      expect(prompts[0]).toContain("Carrera: Ingeniería en Innovación");
      await writing.improveProfileText(viewer, "projectDescription", "educai, una app", { projectDescription: "educai, una app" });
      expect(prompts[1]).not.toContain("Proyecto personal:");
    } finally {
      ai.setProviderForTesting(null);
    }
  });
});
