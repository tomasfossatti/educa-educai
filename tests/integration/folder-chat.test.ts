/** Chat de carpeta con citas y subida de conversaciones externas. Requiere TEST_DATABASE_URL. */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { makePdf } from "../support/documents";
import { factories } from "../support/factories";

// `after()` de Next solo existe dentro de un request: en los tests se encola y no se ejecuta.
const scheduled: (() => unknown)[] = [];
vi.mock("next/server", () => ({ after: (fn: () => unknown) => scheduled.push(fn) }));

const TEST_DB = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DB)("chat de carpeta y subidas (integración)", () => {
  let db: typeof import("@/server/db").db;
  let chat: typeof import("@/server/services/folder-chat");
  let guards: typeof import("@/server/auth/guards");
  let courseId: string;
  let ana: { id: string; role: "STUDENT" };
  let bruno: { id: string; role: "STUDENT" };
  let anaSubject: string;
  let anaProject: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    process.env.AI_PROVIDER = "scripted";
    ({ db } = await import("@/server/db"));
    chat = await import("@/server/services/folder-chat");
    guards = await import("@/server/auth/guards");
    const folders = await import("@/server/services/folders");
    const material = await import("@/server/services/material");
    const f = factories(db);

    const t = await f.teacher();
    courseId = (await f.course(t.id)).id;
    await material.ingestMaterial({
      courseId,
      uploadedById: t.id,
      fileName: "programa.pdf",
      mimeType: "application/pdf",
      data: makePdf(["Unidad 1. Segmentacion de clientes.", "Unidad 2. Una hipotesis falsable define el resultado que la refutaria."]),
    });
    for (const who of ["ana", "bruno"] as const) {
      const s = await f.student();
      await db.enrollment.create({ data: { courseId, studentId: s.id } });
      await folders.ensureStudentFolders(s.id);
      if (who === "ana") ana = { id: s.id, role: "STUDENT" };
      else bruno = { id: s.id, role: "STUDENT" };
    }
    anaSubject = (await db.folder.findFirstOrThrow({ where: { studentId: ana.id, kind: "SUBJECT" } })).id;
    anaProject = (await db.folder.findFirstOrThrow({ where: { studentId: ana.id, kind: "PROJECT" } })).id;
  });

  it("responde citando archivo y página del material, y registra el costo por estudiante y cátedra", async () => {
    const conv = await chat.startFolderConversation(ana, anaSubject);
    const reply = await chat.askInFolder(ana, conv.id, "¿Qué hace falsable a una hipótesis?");
    const citations = reply.citations as unknown as import("@/server/services/folder-chat").MessageCitations;
    expect(citations.noSource).toBe(false);
    expect(citations.items[0]).toMatchObject({ fileName: "programa.pdf", page: 2 });
    expect(reply.content).toContain("[1]");
    const usage = await db.aIUsageEvent.findFirst({ where: { operation: "folder.chat", studentId: ana.id }, orderBy: { createdAt: "desc" } });
    expect(usage?.courseId).toBe(courseId);
  });

  it("si el material no tiene fuente, la respuesta lo avisa", async () => {
    const conv = await chat.startFolderConversation(ana, anaSubject);
    const reply = await chat.askInFolder(ana, conv.id, "¿Cómo funciona la fotosíntesis?");
    expect(reply.citations).toEqual({ noSource: true, items: [] });
    expect(reply.content).toMatch(/No encontré/);
  });

  it("en la carpeta del proyecto no hay material de cátedra: avisa sin fuente", async () => {
    const conv = await chat.startFolderConversation(ana, anaProject);
    expect(conv.courseId).toBeNull();
    const reply = await chat.askInFolder(ana, conv.id, "¿Qué es una hipótesis falsable?");
    expect(reply.citations).toEqual({ noSource: true, items: [] });
  });

  it("otro estudiante no puede usar la carpeta ni la conversación", async () => {
    await expect(chat.startFolderConversation(bruno, anaSubject)).rejects.toBeInstanceOf(guards.AccessDenied);
    const conv = await chat.startFolderConversation(ana, anaSubject);
    await expect(chat.askInFolder(bruno, conv.id, "hola")).rejects.toBeInstanceOf(guards.AccessDenied);
  });

  it("pregunta sobre un fragmento: hilo aparte con el fragmento como foco, sin mezclar el historial", async () => {
    const conv = await chat.startFolderConversation(ana, anaSubject);
    await chat.askInFolder(ana, conv.id, "¿Qué hace falsable a una hipótesis?");
    const thread = await chat.startThread(ana, conv.id, "  define el resultado   que la refutaría ");
    expect(thread.anchor).toBe("define el resultado que la refutaría");

    // Capturamos lo que recibe el modelo para comprobar el foco y el historial del hilo.
    const ai = await import("@/server/ai");
    const { ScriptedProvider } = await import("@/server/ai/scripted");
    const base = new ScriptedProvider();
    let lastCall: { messages: { content: string }[] } | null = null;
    ai.setProviderForTesting({
      name: "scripted",
      isConfigured: () => true,
      streamChat: (c) => base.streamChat(c),
      async generateStructured(call) {
        if (call.operation === "folder.chat") lastCall = call;
        return base.generateStructured(call);
      },
    });
    try {
      const reply = await chat.askInFolder(ana, conv.id, "¿Me das un ejemplo?", thread.id);
      expect(reply.threadId).toBe(thread.id);
    } finally {
      ai.setProviderForTesting(null);
    }
    const sent = lastCall!.messages;
    expect(sent).toHaveLength(1); // el historial del hilo arranca vacío: no trae la conversación principal
    expect(sent[0].content).toContain("FRAGMENTO SELECCIONADO (la pregunta es sobre esto): «define el resultado que la refutaría»");

    const main = await db.message.count({ where: { conversationId: conv.id, threadId: null } });
    const inThread = await db.message.count({ where: { threadId: thread.id } });
    expect([main, inThread]).toEqual([2, 2]);
  });

  it("solo el dueño abre hilos y pregunta en ellos", async () => {
    const conv = await chat.startFolderConversation(ana, anaSubject);
    await expect(chat.startThread(bruno, conv.id, "un fragmento")).rejects.toBeInstanceOf(guards.AccessDenied);
    const thread = await chat.startThread(ana, conv.id, "un fragmento");
    await expect(chat.askInFolder(bruno, conv.id, "hola", thread.id)).rejects.toBeInstanceOf(guards.AccessDenied);
    const other = await chat.startFolderConversation(ana, anaSubject);
    await expect(chat.askInFolder(ana, other.id, "hola", thread.id)).rejects.toBeInstanceOf(guards.AccessDenied);
    await expect(chat.startThread(ana, conv.id, " a ")).rejects.toThrow(/más largo/);
  });

  it("sube una conversación de otra IA a la carpeta y la deja en cola para analizar", async () => {
    const conv = await chat.uploadExternalConversation(ana, anaSubject, {
      title: "Charla con ChatGPT",
      text: "Yo: no entiendo qué hace falsable a una hipótesis\nChatGPT: Que exista un resultado que la refute.",
    });
    expect(conv).toMatchObject({ origin: "UPLOAD", status: "CLOSED", folderId: anaSubject, courseId });
    expect(await db.message.count({ where: { conversationId: conv.id } })).toBe(2);
    const run = await db.interpretationRun.findFirstOrThrow({ where: { experienceId: conv.experienceId } });
    expect(run.status).toBe("QUEUED");
  });

  it("rechaza subidas de más de 2 MB, vacías o a la carpeta de otro", async () => {
    await expect(chat.uploadExternalConversation(ana, anaSubject, { text: "a".repeat(2 * 1024 * 1024 + 1) })).rejects.toThrow(/2 MB/);
    await expect(chat.uploadExternalConversation(ana, anaSubject, { text: "  " })).rejects.toThrow(/vacía/);
    await expect(chat.uploadExternalConversation(bruno, anaSubject, { text: "Yo: hola" })).rejects.toBeInstanceOf(guards.AccessDenied);
  });
});

describe.skipIf(!TEST_DB)("cierre por inactividad (integración)", () => {
  it("cierra y encola las conversaciones con el último mensaje hace más de 20 minutos", async () => {
    const { db } = await import("@/server/db");
    const { closeInactiveConversations } = await import("@/server/engine/trigger");
    const folders = await import("@/server/services/folders");
    const f = factories(db);
    const t = await f.teacher();
    const courseId = (await f.course(t.id)).id;
    const s = await f.student();
    await db.enrollment.create({ data: { courseId, studentId: s.id } });
    await folders.ensureStudentFolders(s.id);
    const folderId = (await db.folder.findFirstOrThrow({ where: { studentId: s.id, courseId } })).id;

    const mk = async (minutesAgo: number) => {
      const { conversation } = await f.conversation({ studentId: s.id, folderId, courseId, messages: [["STUDENT", "Pregunta"]] });
      await db.aIConversation.update({ where: { id: conversation.id }, data: { status: "ACTIVE", closedAt: null } });
      await db.message.updateMany({ where: { conversationId: conversation.id }, data: { createdAt: new Date(Date.now() - minutesAgo * 60_000) } });
      return conversation;
    };
    const old = await mk(25);
    const recent = await mk(5);

    expect(await closeInactiveConversations({ courseId })).toBe(1);
    expect((await db.aIConversation.findUniqueOrThrow({ where: { id: old.id } })).status).toBe("CLOSED");
    expect((await db.aIConversation.findUniqueOrThrow({ where: { id: recent.id } })).status).toBe("ACTIVE");
    expect(await db.interpretationRun.count({ where: { experienceId: old.experienceId } })).toBe(1);
    // Idempotente.
    expect(await closeInactiveConversations({ courseId })).toBe(0);
  });
});
