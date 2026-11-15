/** Tope semanal de IA por estudiante y alertas de consumo. Requiere TEST_DATABASE_URL. */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { makePdf } from "../support/documents";
import { factories } from "../support/factories";

const scheduled: (() => unknown)[] = [];
vi.mock("next/server", () => ({ after: (fn: () => unknown) => scheduled.push(fn) }));

const TEST_DB = process.env.TEST_DATABASE_URL;
const ENV = ["AI_WEEKLY_STUDENT_CAP_USD", "AI_WEEKLY_TOTAL_ALERT_USD", "AI_BUDGET_ALERT_RATIO", "AI_ALERT_WEBHOOK_URL"];

describe.skipIf(!TEST_DB)("tope semanal de IA y alertas (integración)", () => {
  let db: typeof import("@/server/db").db;
  let chat: typeof import("@/server/services/folder-chat");
  let budget: typeof import("@/server/ai/budget");
  let f: ReturnType<typeof factories>;
  let courseId: string;
  const saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));

  async function enrolledStudent(opts: { consent?: boolean; name?: string } = {}) {
    const folders = await import("@/server/services/folders");
    const s = await f.student(opts);
    await db.enrollment.create({ data: { courseId, studentId: s.id } });
    await folders.ensureStudentFolders(s.id);
    const subject = await db.folder.findFirstOrThrow({ where: { studentId: s.id, kind: "SUBJECT" } });
    return { viewer: { id: s.id, role: "STUDENT" as const }, folderId: subject.id, name: s.name };
  }

  /** Simula gasto ya registrado esta semana. */
  async function spend(studentId: string, usd: number) {
    await db.aIUsageEvent.create({
      data: { studentId, courseId, operation: "folder.chat", provider: "anthropic", model: "claude-opus-5-5", estimatedCostUsd: usd, latencyMs: 1, success: true },
    });
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    process.env.AI_PROVIDER = "scripted";
    vi.stubGlobal("fetch", fetchMock);
    ({ db } = await import("@/server/db"));
    chat = await import("@/server/services/folder-chat");
    budget = await import("@/server/ai/budget");
    const material = await import("@/server/services/material");
    f = factories(db);
    const t = await f.teacher();
    courseId = (await f.course(t.id)).id;
    await material.ingestMaterial({
      courseId,
      uploadedById: t.id,
      fileName: "programa.pdf",
      mimeType: "application/pdf",
      data: makePdf(["Unidad 1. Una hipotesis falsable define el resultado que la refutaria."]),
    });
  });

  beforeEach(() => {
    process.env.AI_WEEKLY_STUDENT_CAP_USD = "2";
    process.env.AI_WEEKLY_TOTAL_ALERT_USD = "1000000";
    process.env.AI_BUDGET_ALERT_RATIO = "0.8";
    process.env.AI_ALERT_WEBHOOK_URL = "https://alertas.test.educai/hook";
    fetchMock.mockClear();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    for (const k of ENV) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("debajo del tope el chat responde; al llegar al tope se frena sin llamar al modelo ni registrar gasto", async () => {
    const ana = await enrolledStudent();
    const conv = await chat.startFolderConversation(ana.viewer, ana.folderId);
    await spend(ana.viewer.id, 1.9);
    await expect(chat.askInFolder(ana.viewer, conv.id, "¿Qué es una hipótesis falsable?")).resolves.toBeTruthy();

    await spend(ana.viewer.id, 0.2);
    const callsBefore = await db.aIUsageEvent.count({ where: { studentId: ana.viewer.id } });
    await expect(chat.askInFolder(ana.viewer, conv.id, "¿Y una que no lo es?")).rejects.toMatchObject({ kind: "budget_exceeded" });
    expect(await db.aIUsageEvent.count({ where: { studentId: ana.viewer.id } })).toBe(callsBefore);
  });

  it("el tope es por estudiante: el gasto de una no frena a otro", async () => {
    const ana = await enrolledStudent();
    const bruno = await enrolledStudent();
    await spend(ana.viewer.id, 5);
    const conv = await chat.startFolderConversation(bruno.viewer, bruno.folderId);
    await expect(chat.askInFolder(bruno.viewer, conv.id, "¿Qué es una hipótesis falsable?")).resolves.toBeTruthy();
  });

  it("el gasto de la semana anterior no cuenta", async () => {
    const ana = await enrolledStudent();
    await db.aIUsageEvent.create({
      data: {
        studentId: ana.viewer.id,
        operation: "folder.chat",
        provider: "anthropic",
        model: "claude-opus-5-5",
        estimatedCostUsd: 50,
        latencyMs: 1,
        success: true,
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      },
    });
    expect((await budget.getStudentBudget(ana.viewer.id)).state).toBe("ok");
  });

  it("un tope de 0 lo desactiva", async () => {
    process.env.AI_WEEKLY_STUDENT_CAP_USD = "0";
    const ana = await enrolledStudent();
    await spend(ana.viewer.id, 100);
    await expect(budget.assertStudentBudget(ana.viewer.id)).resolves.toBeUndefined();
  });

  it("rechaza una subida cuyo análisis pasaría el tope, y la acepta si el estudiante no dio consentimiento (no se analiza)", async () => {
    const ana = await enrolledStudent();
    await spend(ana.viewer.id, 1.95);
    const long = `Yo: ${"¿Cómo armo una hipótesis falsable para mi proyecto? ".repeat(4000)}\nChatGPT: Pensá qué resultado la refutaría.`;
    await expect(chat.uploadExternalConversation(ana.viewer, ana.folderId, { text: long })).rejects.toMatchObject({ kind: "budget_exceeded" });
    expect(await db.aIConversation.count({ where: { studentId: ana.viewer.id, origin: "UPLOAD" } })).toBe(0);

    const sinConsentimiento = await enrolledStudent({ consent: false });
    await spend(sinConsentimiento.viewer.id, 1.95);
    await expect(chat.uploadExternalConversation(sinConsentimiento.viewer, sinConsentimiento.folderId, { text: long })).resolves.toBeTruthy();
  });

  it("alerta una sola vez por umbral y semana, sin nombre ni contenido del estudiante", async () => {
    const ana = await enrolledStudent({ name: "Ana Nombre Real" });
    await spend(ana.viewer.id, 1.0);
    await budget.checkBudgetAlerts({ studentId: ana.viewer.id, courseId });
    expect(fetchMock).not.toHaveBeenCalled();

    await spend(ana.viewer.id, 0.7);
    await budget.checkBudgetAlerts({ studentId: ana.viewer.id, courseId });
    await budget.checkBudgetAlerts({ studentId: ana.viewer.id, courseId });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await spend(ana.viewer.id, 0.5);
    await budget.checkBudgetAlerts({ studentId: ana.viewer.id, courseId });
    await budget.checkBudgetAlerts({ studentId: ana.viewer.id, courseId });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const bodies = fetchMock.mock.calls.map((call) => String((call as unknown as [string, RequestInit])[1].body));
    expect(bodies[0]).toContain("80%");
    expect(bodies[1]).toContain("llegó al tope");
    for (const body of bodies) {
      expect(body).toContain(ana.viewer.id);
      expect(body).not.toContain("Ana Nombre Real");
    }
    const events = await db.productEvent.findMany({ where: { name: "ai.budget_alert", studentId: ana.viewer.id } });
    expect(events.map((e) => (e.properties as { state: string }).state).sort()).toEqual(["exceeded", "warning"]);
  });

  it("alerta cuando el consumo total de la semana pasa el umbral de la instalación", async () => {
    await db.productEvent.deleteMany({ where: { name: "ai.budget_alert", dedupeKey: { startsWith: "ai-budget:total:" } } });
    const ana = await enrolledStudent();
    await spend(ana.viewer.id, 0.01);
    const weekTotal = Number(
      (await db.aIUsageEvent.aggregate({ where: { createdAt: { gte: (await import("@/domain/ai-budget")).weekStart(new Date()) } }, _sum: { estimatedCostUsd: true } }))._sum
        .estimatedCostUsd ?? 0,
    );
    process.env.AI_WEEKLY_TOTAL_ALERT_USD = String(weekTotal);
    await budget.checkBudgetAlerts({});
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body)).toContain("consumo total");
  });

  it("sin webhook configurado la alerta queda registrada y no se llama a nadie", async () => {
    delete process.env.AI_ALERT_WEBHOOK_URL;
    const ana = await enrolledStudent();
    await spend(ana.viewer.id, 3);
    await budget.checkBudgetAlerts({ studentId: ana.viewer.id, courseId });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await db.productEvent.count({ where: { name: "ai.budget_alert", studentId: ana.viewer.id } })).toBe(1);
  });
});
