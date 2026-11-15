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
