/**
 * Un solo chat (PR 4 de la simplificación): las charlas del tutor de la materia, que se creaban sin
 * carpeta, pasan a la carpeta de su materia sin perder mensajes. Requiere TEST_DATABASE_URL.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { factories } from "../support/factories";

const TEST_DB = process.env.TEST_DATABASE_URL;
const MIGRATION = join(__dirname, "..", "..", "prisma", "migrations", "20261116200000_unificar_chat", "migration.sql");

describe.skipIf(!TEST_DB)("un solo chat: charlas del tutor en la carpeta de la materia (integración)", () => {
  let db: typeof import("@/server/db").db;
  let chat: typeof import("@/server/services/folder-chat");
  let privacy: typeof import("@/server/services/privacy");
  let courseId: string;
  let ana: { id: string; role: "STUDENT" };
  let bruno: { id: string; role: "STUDENT" };

  /** Corre la migración versionada tal como está en el repo, sentencia por sentencia. */
  async function runMigration() {
    const sql = readFileSync(MIGRATION, "utf8")
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    for (const statement of sql.split(/;\s*$/m).map((s) => s.trim()).filter(Boolean)) {
      await db.$executeRawUnsafe(statement);
    }
  }

  /** Una charla como las que creaba el tutor de la materia: con cátedra y sin carpeta. */
  async function oldTutorConversation(studentId: string) {
    const experience = await db.experience.create({ data: { courseId, studentId, type: "AI_CONVERSATION", title: "Sesión de estudio" } });
    const conversation = await db.aIConversation.create({
      data: { experienceId: experience.id, courseId, studentId, title: "Sesión de estudio", status: "CLOSED", closedAt: new Date() },
    });
    await db.message.createMany({
      data: [
        { conversationId: conversation.id, role: "STUDENT", content: "¿Qué es un costo hundido?" },
        { conversationId: conversation.id, role: "TUTOR", content: "¿Qué pensás vos que significa «hundido»?" },
      ],
    });
    return { experience, conversation };
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    process.env.AI_PROVIDER = "scripted";
    ({ db } = await import("@/server/db"));
    chat = await import("@/server/services/folder-chat");
    privacy = await import("@/server/services/privacy");
    const f = factories(db);
    const t = await f.teacher();
    courseId = (await f.course(t.id, { name: "Costos de proyectos" })).id;
    for (const who of ["ana", "bruno"] as const) {
      const s = await f.student();
      await db.enrollment.create({ data: { courseId, studentId: s.id } });
      if (who === "ana") ana = { id: s.id, role: "STUDENT" };
      else bruno = { id: s.id, role: "STUDENT" };
    }
  });

  it("la migración pone la charla vieja en la carpeta de su materia, la crea si falta y no pierde mensajes", async () => {
    const { conversation } = await oldTutorConversation(ana.id);
    expect(await db.folder.count({ where: { studentId: ana.id } })).toBe(0);

    await runMigration();

    const moved = await db.aIConversation.findUniqueOrThrow({ where: { id: conversation.id }, include: { folder: true, messages: true } });
    expect(moved.folder).toMatchObject({ kind: "SUBJECT", courseId, studentId: ana.id, name: "Costos de proyectos" });
    expect(moved.messages).toHaveLength(2);
  });

  it("correrla de nuevo no duplica carpetas ni cambia nada", async () => {
    const before = await db.folder.findMany({ where: { studentId: ana.id }, orderBy: { id: "asc" } });
    await runMigration();
    expect(await db.folder.findMany({ where: { studentId: ana.id }, orderBy: { id: "asc" } })).toEqual(before);
  });

  it("usa la carpeta de la materia que ya existía", async () => {
    const folders = await import("@/server/services/folders");
    await folders.ensureStudentFolders(bruno.id);
    const existing = await db.folder.findFirstOrThrow({ where: { studentId: bruno.id, courseId } });
    const { conversation } = await oldTutorConversation(bruno.id);
    await runMigration();
    expect((await db.aIConversation.findUniqueOrThrow({ where: { id: conversation.id } })).folderId).toBe(existing.id);
    expect(await db.folder.count({ where: { studentId: bruno.id, courseId } })).toBe(1);
  });

  it("la charla migrada se abre en el único chat solo para su dueña (V8)", async () => {
    const conversation = await db.aIConversation.findFirstOrThrow({ where: { studentId: ana.id } });
    const own = await chat.getOwnFolderConversation(ana, conversation.id);
    expect(own?.conversation.messages.map((m) => m.content)).toEqual(["¿Qué es un costo hundido?", "¿Qué pensás vos que significa «hundido»?"]);
    expect(await chat.getOwnFolderConversation(bruno, conversation.id)).toBeNull();
    expect(await chat.getOwnFolderConversation({ id: ana.id, role: "TEACHER" } as never, conversation.id)).toBeNull();
  });

  it("borrar la charla migrada borra sus mensajes y lo derivado (V10)", async () => {
    const conversation = await db.aIConversation.findFirstOrThrow({ where: { studentId: ana.id } });
    await privacy.deleteExperienceCascade(conversation.experienceId, ana.id, courseId);
    expect(await db.aIConversation.findUnique({ where: { id: conversation.id } })).toBeNull();
    expect(await db.message.count({ where: { conversationId: conversation.id } })).toBe(0);
  });

  it("una charla nueva desde una tarea queda en la carpeta de la materia con la tarea", async () => {
    const folder = await db.folder.findFirstOrThrow({ where: { studentId: ana.id, courseId } });
    const activity = await db.activity.create({
      data: { courseId, title: "TP 1", kind: "PRACTICE", scenario: "Una pyme evalúa un proyecto.", instructions: "Calculá el VAN.", status: "PUBLISHED", prompts: [] },
    });
    const conversation = await chat.startFolderConversation(ana, folder.id, "Sobre la actividad: TP 1", { activityId: activity.id });
    expect(conversation).toMatchObject({ folderId: folder.id, courseId, activityId: activity.id });
    const experience = await db.experience.findUniqueOrThrow({ where: { id: conversation.experienceId } });
    expect(experience.activityId).toBe(activity.id);
  });
});
