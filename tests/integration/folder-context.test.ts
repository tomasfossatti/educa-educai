/** Contexto de carpeta en tres capas. Requiere TEST_DATABASE_URL. */
import { beforeAll, describe, expect, it } from "vitest";
import { factories } from "../support/factories";

const TEST_DB = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DB)("contexto de carpeta (integración)", () => {
  let db: typeof import("@/server/db").db;
  let ctx: typeof import("@/server/services/folder-context");
  let guards: typeof import("@/server/auth/guards");
  let f: ReturnType<typeof factories>;
  let ana: { id: string; role: "STUDENT" };
  let bruno: { id: string; role: "STUDENT" };
  let courseId: string;
  let subject: string;
  let project: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    process.env.AI_PROVIDER = "scripted";
    ({ db } = await import("@/server/db"));
    ctx = await import("@/server/services/folder-context");
    guards = await import("@/server/auth/guards");
    const folders = await import("@/server/services/folders");
    f = factories(db);
    const t = await f.teacher();
    courseId = (await f.course(t.id)).id;
    for (const who of ["ana", "bruno"] as const) {
      const s = await f.student({ consent: who === "ana" });
      await db.enrollment.create({ data: { courseId, studentId: s.id } });
      await folders.ensureStudentFolders(s.id);
      if (who === "ana") ana = { id: s.id, role: "STUDENT" };
      else bruno = { id: s.id, role: "STUDENT" };
    }
    subject = (await db.folder.findFirstOrThrow({ where: { studentId: ana.id, kind: "SUBJECT" } })).id;
    project = (await db.folder.findFirstOrThrow({ where: { studentId: ana.id, kind: "PROJECT" } })).id;
  });

  const chat = (studentId: string, folderId: string, cId: string | null, text: string) =>
    f.conversation({ studentId, folderId, courseId: cId, messages: [["STUDENT", text], ["TUTOR", "¿Por qué?"]] });

  it("agrega hechos con su fuente, archiva sin borrar y respeta lo editado por el estudiante", async () => {
    const c1 = await chat(ana.id, subject, courseId, "No sé cómo medir una hipótesis");
    expect(await ctx.updateFolderFacts(c1.conversation.id)).toEqual({ created: 1, archived: 0 });
    const [first] = await db.folderContext.findMany({ where: { folderId: subject, layer: "FACTS" } });
    expect(first.sourceIds).toEqual([c1.conversation.id]);
    expect(first.courseIds).toEqual([courseId]);

    // Segunda conversación: el proveedor propone archivar F1 → se archiva, no se borra.
    const c2 = await chat(ana.id, subject, courseId, "Ya entendí las métricas");
    expect(await ctx.updateFolderFacts(c2.conversation.id)).toEqual({ created: 1, archived: 1 });
    expect((await db.folderContext.findUniqueOrThrow({ where: { id: first.id } })).archivedAt).not.toBeNull();

    // Si el estudiante edita el hecho activo, el proceso ya no lo archiva.
    const active = await db.folderContext.findFirstOrThrow({ where: { folderId: subject, layer: "FACTS", archivedAt: null } });
    await ctx.editContextItem(ana, active.id, "Ya sabe medir hipótesis con preventas");
    const c3 = await chat(ana.id, subject, courseId, "Otra pregunta");
    expect(await ctx.updateFolderFacts(c3.conversation.id)).toEqual({ created: 1, archived: 0 });
    expect(await db.folderContext.findUniqueOrThrow({ where: { id: active.id } })).toMatchObject({ archivedAt: null, editedByStudent: true });
  });

  it("en la carpeta del proyecto vincula hechos con las cátedras del estudiante", async () => {
    const c = await chat(ana.id, project, null, "Mi emprendimiento necesita validar demanda");
    await ctx.updateFolderFacts(c.conversation.id);
    const fact = await db.folderContext.findFirstOrThrow({ where: { folderId: project, layer: "FACTS" } });
    expect(fact.courseIds).toEqual([courseId]);
  });

  it("el resumen cruza carpetas, se genera una vez por día y entra al prompt con los hechos", async () => {
    expect(await ctx.refreshSummaryIfStale(ana.id)).toBe(true);
    expect(await ctx.refreshSummaryIfStale(ana.id)).toBe(false); // ya está fresco
    const prompt = await ctx.contextForPrompt(subject, ana.id);
    expect(prompt).toMatch(/Resumen: Perfil de prueba basado en \d+ hechos/);
    expect(prompt).toContain("Ya sabe medir hipótesis con preventas");
    // Un día después y con hechos nuevos, se regenera; el viejo queda archivado.
    const c = await chat(ana.id, subject, courseId, "Pregunta nueva");
    await ctx.updateFolderFacts(c.conversation.id);
    expect(await ctx.refreshSummaryIfStale(ana.id, new Date(Date.now() + 25 * 3_600_000))).toBe(true);
    expect(await db.folderContext.count({ where: { folderId: project, layer: "SUMMARY", archivedAt: { not: null } } })).toBe(1);
  });

  it("sin consentimiento no se construye contexto", async () => {
    const brunoSubject = (await db.folder.findFirstOrThrow({ where: { studentId: bruno.id, kind: "SUBJECT" } })).id;
    const c = await chat(bruno.id, brunoSubject, courseId, "Hola, no entiendo nada");
    expect(await ctx.updateFolderFacts(c.conversation.id)).toBeNull();
    expect(await ctx.refreshSummaryIfStale(bruno.id)).toBe(false);
  });

  it("el estudiante ve y edita solo su contexto, y puede borrar un hecho", async () => {
    const view = await ctx.listFolderContext(ana, subject);
    expect(view.facts.length).toBeGreaterThan(0);
    await expect(ctx.listFolderContext(bruno, subject)).rejects.toBeInstanceOf(guards.AccessDenied);
    await expect(ctx.editContextItem(bruno, view.facts[0].id, "x")).rejects.toBeInstanceOf(guards.AccessDenied);
    await ctx.deleteContextItem(ana, view.facts[0].id);
    expect(await db.folderContext.findUnique({ where: { id: view.facts[0].id } })).toBeNull();
  });
});

describe.skipIf(!TEST_DB)("carrera entre el proceso y la edición del estudiante", () => {
  it("si el estudiante edita un hecho mientras corre el proceso, no se archiva", async () => {
    const { db } = await import("@/server/db");
    const ctx = await import("@/server/services/folder-context");
    const folders = await import("@/server/services/folders");
    const f = factories(db);
    const t = await f.teacher();
    const courseId = (await f.course(t.id)).id;
    const s = await f.student();
    await db.enrollment.create({ data: { courseId, studentId: s.id } });
    await folders.ensureStudentFolders(s.id);
    const folderId = (await db.folder.findFirstOrThrow({ where: { studentId: s.id, kind: "SUBJECT" } })).id;
    const fact = await db.folderContext.create({ data: { folderId, layer: "FACTS", content: "Hecho viejo", sourceIds: [] } });
    const { conversation } = await f.conversation({ studentId: s.id, folderId, courseId, messages: [["STUDENT", "Algo nuevo"]] });

    // El proveedor propone archivar F1; la edición llega "en el medio" (antes de escribir).
    const ai = await import("@/server/ai");
    const { ScriptedProvider } = await import("@/server/ai/scripted");
    const base = new ScriptedProvider();
    ai.setProviderForTesting({
      name: "scripted",
      isConfigured: () => true,
      streamChat: (c) => base.streamChat(c),
      async generateStructured(call) {
        const result = await base.generateStructured(call);
        if (call.operation === "context.facts") await ctx.editContextItem({ id: s.id, role: "STUDENT" }, fact.id, "Hecho corregido por el estudiante");
        return result;
      },
    });
    try {
      await ctx.updateFolderFacts(conversation.id);
    } finally {
      ai.setProviderForTesting(null);
    }
    expect(await db.folderContext.findUniqueOrThrow({ where: { id: fact.id } })).toMatchObject({ archivedAt: null, editedByStudent: true, content: "Hecho corregido por el estudiante" });
  });
});
