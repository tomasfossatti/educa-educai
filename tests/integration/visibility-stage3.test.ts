/**
 * Reglas de visibilidad de la etapa 3: V7, V8, V10, V11 y V13 (docs/SPEC.md).
 * Usan usuarios y cátedras sintéticos creados en cada ejecución. Requieren TEST_DATABASE_URL.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { factories } from "../support/factories";

const TEST_DB = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DB)("reglas de visibilidad, etapa 3", () => {
  let db: typeof import("@/server/db").db;
  let guards: typeof import("@/server/auth/guards");
  let folders: typeof import("@/server/services/folders");
  let studentFile: typeof import("@/server/services/student-file");
  let consent: typeof import("@/server/services/consent");
  let privacy: typeof import("@/server/services/privacy");
  let trigger: typeof import("@/server/engine/trigger");
  let chatTools: typeof import("@/server/services/folder-chat-tools");
  let f: ReturnType<typeof factories>;

  let teacher: { id: string; role: "TEACHER" };
  let ana: { id: string; role: "STUDENT" };
  let bruno: { id: string; role: "STUDENT" };
  let courseId: string;
  let topicId: string;
  let anaFolderId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    process.env.AI_PROVIDER = "scripted";
    ({ db } = await import("@/server/db"));
    guards = await import("@/server/auth/guards");
    folders = await import("@/server/services/folders");
    studentFile = await import("@/server/services/student-file");
    consent = await import("@/server/services/consent");
    privacy = await import("@/server/services/privacy");
    trigger = await import("@/server/engine/trigger");
    chatTools = await import("@/server/services/folder-chat-tools");
    f = factories(db);

    const t = await f.teacher();
    teacher = { id: t.id, role: "TEACHER" };
    const course = await f.course(t.id, { name: "Estrategia" });
    courseId = course.id;
    topicId = (await f.topic(courseId, "Hipótesis falsables")).id;

    for (const name of ["Ana", "Bruno"]) {
      const s = await f.student({ name });
      await db.enrollment.create({ data: { courseId, studentId: s.id } });
      await folders.ensureStudentFolders(s.id);
      if (name === "Ana") ana = { id: s.id, role: "STUDENT" };
      else bruno = { id: s.id, role: "STUDENT" };
    }
    anaFolderId = (await db.folder.findFirstOrThrow({ where: { studentId: ana.id, courseId } })).id;
  });

  it("cada estudiante inscripto recibe la carpeta de la materia y la de su proyecto", async () => {
    const own = await db.folder.findMany({ where: { studentId: ana.id }, orderBy: { kind: "asc" } });
    expect(own.map((x) => x.kind).sort()).toEqual(["PROJECT", "SUBJECT"]);
    expect(own.find((x) => x.kind === "SUBJECT")?.courseId).toBe(courseId);
    expect(own.find((x) => x.kind === "PROJECT")?.courseId).toBeNull();
    // Idempotente: llamarla de nuevo no duplica carpetas.
    await folders.ensureStudentFolders(ana.id);
    expect(await db.folder.count({ where: { studentId: ana.id } })).toBe(2);
  });

  it("pedidos simultáneos no duplican carpetas ni fallan", async () => {
    const s = await f.student({ name: "Concurrente" });
    await db.enrollment.create({ data: { courseId, studentId: s.id } });
    await Promise.all(Array.from({ length: 5 }, () => folders.ensureStudentFolders(s.id)));
    expect(await db.folder.count({ where: { studentId: s.id } })).toBe(2);
  });

  describe("V7: el estudiante ve su propia ficha, con el mismo contenido que el docente", () => {
    it("permitido, e idéntico a lo que ve el docente", async () => {
      const { experience } = await f.conversation({ studentId: ana.id, folderId: anaFolderId, courseId });
      await f.evidenceFrom({ experienceId: experience.id, studentId: ana.id, courseId, topicId, excerpt: "No entiendo qué hace falsable a una hipótesis" });

      const asStudent = await studentFile.loadStudentFile(ana, ana.id, courseId);
      const asTeacher = await studentFile.loadStudentFile(teacher, ana.id, courseId);
      expect(asStudent).toEqual(asTeacher);
      expect(asStudent.evidence.map((e) => e.content)).toContain("No entiendo qué hace falsable a una hipótesis");
    });
  });

  describe("V8: un estudiante no ve datos de otro estudiante", () => {
    it("rechaza la ficha de otro estudiante", async () => {
      await expect(studentFile.loadStudentFile(bruno, ana.id, courseId)).rejects.toBeInstanceOf(guards.AccessDenied);
    });
    it("rechaza las conversaciones y la carpeta de otro estudiante", async () => {
      await expect(guards.assertCanViewConversations(bruno, ana.id, courseId)).rejects.toBeInstanceOf(guards.AccessDenied);
      await expect(guards.assertFolderOwner(bruno, anaFolderId)).rejects.toBeInstanceOf(guards.AccessDenied);
    });
    it("permite su propia carpeta", async () => {
      const folder = await guards.assertFolderOwner(ana, anaFolderId);
      expect(folder.id).toBe(anaFolderId);
    });
  });

  describe("V10: borrar una conversación borra todo lo derivado y recalcula", () => {
    it("borra conversación, evidencia, señales y hechos de contexto, y la duda deja de contar", async () => {
      const { experience, conversation } = await f.conversation({ studentId: bruno.id, folderId: (await db.folder.findFirstOrThrow({ where: { studentId: bruno.id, courseId } })).id, courseId });
      const { evidence, signal } = await f.evidenceFrom({ experienceId: experience.id, studentId: bruno.id, courseId, topicId, excerpt: "No sé cómo medir una hipótesis" });
      const fact = await db.folderContext.create({
        data: { folderId: conversation.folderId!, layer: "FACTS", content: "Le cuesta medir hipótesis", sourceIds: [conversation.id] },
      });
      const doubtsBefore = await db.signal.count({ where: { courseId, curriculumItemId: topicId, studentId: bruno.id } });
      expect(doubtsBefore).toBe(1);

      await privacy.deleteExperienceCascade(experience.id, bruno.id, courseId);

      expect(await db.aIConversation.findUnique({ where: { id: conversation.id } })).toBeNull();
      expect(await db.evidenceObject.findUnique({ where: { id: evidence.id } })).toBeNull();
      expect(await db.signal.findUnique({ where: { id: signal.id } })).toBeNull();
      expect(await db.folderContext.findUnique({ where: { id: fact.id } })).toBeNull();
      expect(await db.signal.count({ where: { courseId, curriculumItemId: topicId, studentId: bruno.id } })).toBe(0);
    });

    it("también funciona con una conversación de la carpeta del proyecto, sin cátedra", async () => {
      const project = await db.folder.findFirstOrThrow({ where: { studentId: bruno.id, kind: "PROJECT" } });
      const { experience, conversation } = await f.conversation({ studentId: bruno.id, folderId: project.id, courseId: null });
      await privacy.deleteExperienceCascade(experience.id, bruno.id, null);
      expect(await db.aIConversation.findUnique({ where: { id: conversation.id } })).toBeNull();
    });
  });

  describe("V11: retirar el consentimiento", () => {
    it("deja de analizar desde ese momento y el docente pierde acceso a las conversaciones", async () => {
      const s = await f.student({ name: "Carla" });
      await db.enrollment.create({ data: { courseId, studentId: s.id } });
      await folders.ensureStudentFolders(s.id);
      const carla = { id: s.id, role: "STUDENT" as const };
      const folder = await db.folder.findFirstOrThrow({ where: { studentId: s.id, courseId } });

      await expect(guards.assertCanViewConversations(teacher, carla.id, courseId)).resolves.toBeUndefined();

      await consent.setAnalysisConsent(carla.id, false);
      const profile = await db.studentProfile.findUniqueOrThrow({ where: { userId: carla.id } });
      expect(profile.consentAnalysisAt).toBeNull();
      expect(profile.consentWithdrawnAt).not.toBeNull();

      const { experience } = await f.conversation({ studentId: carla.id, folderId: folder.id, courseId });
      const run = await trigger.queueInterpretation({ experienceId: experience.id, courseId, studentId: carla.id, source: "AI_CONVERSATION" });
      expect(run.status).toBe("SKIPPED");

      await expect(guards.assertCanViewConversations(teacher, carla.id, courseId)).rejects.toBeInstanceOf(guards.AccessDenied);
      await expect(studentFile.loadStudentFile(teacher, carla.id, courseId)).rejects.toBeInstanceOf(guards.AccessDenied);
      // El estudiante sigue viendo lo suyo.
      await expect(guards.assertCanViewConversations(carla, carla.id, courseId)).resolves.toBeUndefined();
    });
  });

  describe("V13: el chat del estudiante no consulta datos de otro estudiante", () => {
    it("la herramienta rechaza el pedido aunque esté bien formulado", async () => {
      const tools = await chatTools.studentChatTools(bruno, (await db.folder.findFirstOrThrow({ where: { studentId: bruno.id, courseId } })).id);
      await expect(tools.execute("student_file", { studentId: ana.id })).rejects.toBeInstanceOf(guards.AccessDenied);
      const own = await tools.execute("student_file", { studentId: bruno.id });
      expect(own).toHaveProperty("student.id", bruno.id);
    });

    it("no se puede armar el contexto del chat sobre la carpeta de otro estudiante", async () => {
      await expect(chatTools.studentChatTools(bruno, anaFolderId)).rejects.toBeInstanceOf(guards.AccessDenied);
    });
  });
});
