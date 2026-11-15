/**
 * Reglas de visibilidad de la etapa 4: V1 a V6, V9, V12, V14 y V15 (docs/SPEC.md),
 * y el conteo de dudas de la vista macro. Datos sintéticos por ejecución. Requiere TEST_DATABASE_URL.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { factories } from "../support/factories";

const TEST_DB = process.env.TEST_DATABASE_URL;
const DAY = 24 * 60 * 60 * 1000;

describe.skipIf(!TEST_DB)("reglas de visibilidad, etapa 4", () => {
  let db: typeof import("@/server/db").db;
  let guards: typeof import("@/server/auth/guards");
  let folders: typeof import("@/server/services/folders");
  let studentFile: typeof import("@/server/services/student-file");
  let classView: typeof import("@/server/services/class-view");
  let access: typeof import("@/server/services/access-log");
  let teacherTools: typeof import("@/server/services/teacher-chat-tools");
  let doubts: typeof import("@/server/services/doubts");
  let f: ReturnType<typeof factories>;

  type V = { id: string; role: "STUDENT" | "TEACHER" | "ADMIN" };
  let teacherA: V, teacherB: V, admin: V;
  let courseA: string, courseB: string, topicA: string;
  let ana: V, bruno: V, carla: V, sinConsentimiento: V, soloEnB: V;

  async function enroll(studentId: string, courseId: string) {
    await db.enrollment.create({ data: { courseId, studentId } });
    await folders.ensureStudentFolders(studentId);
    return (await db.folder.findFirstOrThrow({ where: { studentId, courseId } })).id;
  }

  /** Conversación del estudiante en la carpeta de la materia, con una señal de duda sobre el tema. */
  async function doubt(student: V, opts: { confidence?: "LOW" | "MEDIUM" | "HIGH"; studentStatus?: "PENDING" | "CONFIRMED" | "DISCARDED"; at?: Date } = {}) {
    const folderId = (await db.folder.findFirstOrThrow({ where: { studentId: student.id, courseId: courseA } })).id;
    const { experience } = await f.conversation({ studentId: student.id, folderId, courseId: courseA });
    return f.evidenceFrom({ experienceId: experience.id, studentId: student.id, courseId: courseA, topicId: topicA, excerpt: "No entiendo el tema", ...opts });
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    process.env.AI_PROVIDER = "scripted";
    ({ db } = await import("@/server/db"));
    guards = await import("@/server/auth/guards");
    folders = await import("@/server/services/folders");
    studentFile = await import("@/server/services/student-file");
    classView = await import("@/server/services/class-view");
    access = await import("@/server/services/access-log");
    teacherTools = await import("@/server/services/teacher-chat-tools");
    doubts = await import("@/server/services/doubts");
    f = factories(db);

    const institution = await f.institution();
    const tA = await f.teacher({ institutionId: institution.id });
    const tB = await f.teacher({ institutionId: institution.id });
    teacherA = { id: tA.id, role: "TEACHER" };
    teacherB = { id: tB.id, role: "TEACHER" };
    admin = { id: (await f.admin()).id, role: "ADMIN" };
    courseA = (await f.course(tA.id, { name: "Estrategia" })).id;
    courseB = (await f.course(tB.id, { name: "Finanzas" })).id;
    topicA = (await f.topic(courseA, "Hipótesis falsables")).id;

    const mk = async (name: string, consent = true) => ({ id: (await f.student({ name, consent })).id, role: "STUDENT" as const });
    ana = await mk("Ana");
    bruno = await mk("Bruno");
    carla = await mk("Carla");
    sinConsentimiento = await mk("Dario", false);
    soloEnB = await mk("Eva");
    for (const s of [ana, bruno, carla, sinConsentimiento]) await enroll(s.id, courseA);
    await enroll(ana.id, courseB);
    await enroll(soloEnB.id, courseB);
  });

  describe("V1: el docente de A ve la vista macro de A", () => {
    it("permitido para el docente de A, rechazado para el de B, un estudiante o el admin", async () => {
      const view = await classView.getClassOverview(teacherA, courseA);
      expect(view.participation.enrolled).toBe(4);
      await expect(classView.getClassOverview(teacherB, courseA)).rejects.toBeInstanceOf(guards.AccessDenied);
      await expect(classView.getClassOverview(ana, courseA)).rejects.toBeInstanceOf(guards.AccessDenied);
      await expect(classView.getClassOverview(admin, courseA)).rejects.toBeInstanceOf(guards.AccessDenied);
    });
  });

  describe("V2: el docente de A abre la ficha de un inscripto en A", () => {
    it("permitido y registrado en AccessLog", async () => {
      const before = await db.accessLog.count({ where: { studentId: bruno.id } });
      await studentFile.loadStudentFile(teacherA, bruno.id, courseA);
      const logs = await db.accessLog.findMany({ where: { studentId: bruno.id }, orderBy: { createdAt: "desc" } });
      expect(logs.length).toBe(before + 1);
      expect(logs[0]).toMatchObject({ viewerId: teacherA.id, courseId: courseA, view: "STUDENT_FILE" });
    });
    it("el estudiante mirando su propia ficha no genera registro", async () => {
      const before = await db.accessLog.count({ where: { studentId: bruno.id } });
      await studentFile.loadStudentFile(bruno, bruno.id, courseA);
      expect(await db.accessLog.count({ where: { studentId: bruno.id } })).toBe(before);
    });
  });

  describe("V3: ficha de un estudiante no inscripto en A", () => {
    it("rechazado", async () => {
      await expect(studentFile.loadStudentFile(teacherA, soloEnB.id, courseA)).rejects.toBeInstanceOf(guards.AccessDenied);
      await expect(studentFile.loadStudentFile(teacherA, soloEnB.id, courseB)).rejects.toBeInstanceOf(guards.AccessDenied);
    });
  });

  describe("V4: el docente de A no ve la carpeta de la materia B del mismo estudiante", () => {
    it("rechazado", async () => {
      const folderB = (await db.folder.findFirstOrThrow({ where: { studentId: ana.id, courseId: courseB } })).id;
      await expect(guards.assertFolderOwner(teacherA, folderB)).rejects.toBeInstanceOf(guards.AccessDenied);
      await expect(guards.assertCanViewConversations(teacherA, ana.id, courseB)).rejects.toBeInstanceOf(guards.AccessDenied);
    });
  });

  describe("V5: carpeta del proyecto personal", () => {
    it("el docente de A ve solo los hechos vinculados a A, con su evidencia, y no la carpeta", async () => {
      const project = await db.folder.findFirstOrThrow({ where: { studentId: ana.id, kind: "PROJECT" } });
      await db.folderContext.createMany({
        data: [
          { folderId: project.id, layer: "FACTS", content: "Su proyecto necesita validar la demanda", sourceIds: ["conv-x"], courseIds: [courseA] },
          { folderId: project.id, layer: "FACTS", content: "Arma un flujo de caja", sourceIds: ["conv-y"], courseIds: [courseB] },
          { folderId: project.id, layer: "FACTS", content: "Le gusta cocinar", sourceIds: ["conv-z"], courseIds: [] },
        ],
      });
      const links = await studentFile.loadProjectLinks(teacherA, ana.id, courseA);
      expect(links.map((l) => l.content)).toEqual(["Su proyecto necesita validar la demanda"]);
      expect(links[0].sourceIds).toEqual(["conv-x"]);
      await expect(guards.assertFolderOwner(teacherA, project.id)).rejects.toBeInstanceOf(guards.AccessDenied);
      expect(await db.accessLog.count({ where: { studentId: ana.id, view: "PROJECT_LINKS" } })).toBe(1);
    });
  });

  describe("V6: estudiante sin consentimiento", () => {
    it("el docente no ve sus conversaciones ni su ficha, y no cuenta en los porcentajes", async () => {
      await expect(guards.assertCanViewConversations(teacherA, sinConsentimiento.id, courseA)).rejects.toBeInstanceOf(guards.AccessDenied);
      await expect(studentFile.loadStudentFile(teacherA, sinConsentimiento.id, courseA)).rejects.toBeInstanceOf(guards.AccessDenied);

      await doubt(sinConsentimiento, { studentStatus: "CONFIRMED" });
      const topic = (await classView.getClassOverview(teacherA, courseA)).topics.find((t) => t.topicId === topicA)!;
      expect(topic.studentIdsWithDoubt).not.toContain(sinConsentimiento.id);
      expect(topic.studentIdsConversed).not.toContain(sinConsentimiento.id);
    });
  });

  describe("conteo de dudas por tema (vista macro)", () => {
    it("cuenta lo confirmado y lo no respondido en 7 días con confianza alta, con denominador", async () => {
      await doubt(ana, { studentStatus: "CONFIRMED" });
      await doubt(bruno, { studentStatus: "DISCARDED" });
      await doubt(carla, { studentStatus: "PENDING", confidence: "MEDIUM", at: new Date(Date.now() - 2 * DAY) });

      let topic = (await classView.getClassOverview(teacherA, courseA)).topics.find((t) => t.topicId === topicA)!;
      expect(topic.studentIdsWithDoubt.sort()).toEqual([ana.id].sort());
      expect(topic.studentIdsConversed.sort()).toEqual([ana.id, bruno.id, carla.id].sort());
      expect(topic.percent).toBe(33);
      expect(topic.sentence).toBe("El 33% de la clase no entiende Hipótesis falsables (1 de 3 estudiantes que conversaron sobre este tema).");

      // Pendiente con confianza alta: cuenta solo pasados 7 días sin respuesta.
      const pending = await doubt(carla, { studentStatus: "PENDING", confidence: "HIGH", at: new Date(Date.now() - 3 * DAY) });
      topic = (await classView.getClassOverview(teacherA, courseA)).topics.find((t) => t.topicId === topicA)!;
      expect(topic.studentIdsWithDoubt).not.toContain(carla.id);
      await db.signal.update({ where: { id: pending.signal.id }, data: { createdAt: new Date(Date.now() - 8 * DAY) } });
      await db.evidenceObject.update({ where: { id: pending.evidence.id }, data: { occurredAt: new Date(Date.now() - 6 * DAY) } });
      topic = (await classView.getClassOverview(teacherA, courseA, { windowDays: 14 })).topics.find((t) => t.topicId === topicA)!;
      expect(topic.studentIdsWithDoubt).toContain(carla.id);
    });

    it("la participación cuenta consentimientos y quienes conversaron en la semana", async () => {
      const view = await classView.getClassOverview(teacherA, courseA);
      expect(view.participation).toMatchObject({ enrolled: 4, consented: 3 });
      expect(view.participation.conversedThisWeek).toBe(3);
    });
  });

  describe("confirmación de dudas por el estudiante", () => {
    it("solo el dueño confirma o descarta su señal", async () => {
      const { signal } = await doubt(bruno);
      await expect(doubts.respondToSignal(ana, signal.id, "CONFIRMED")).rejects.toBeInstanceOf(guards.AccessDenied);
      await expect(doubts.respondToSignal(teacherA, signal.id, "CONFIRMED")).rejects.toBeInstanceOf(guards.AccessDenied);
      await doubts.respondToSignal(bruno, signal.id, "DISCARDED");
      expect((await db.signal.findUniqueOrThrow({ where: { id: signal.id } })).studentStatus).toBe("DISCARDED");
    });
  });

  describe("V9: el estudiante ve quién abrió su ficha y cuándo", () => {
    it("permitido, solo lo suyo", async () => {
      await studentFile.loadStudentFile(teacherA, carla.id, courseA);
      const mine = await access.listAccessToMe(carla);
      expect(mine[0]).toMatchObject({ viewerName: "Docente de prueba", view: "STUDENT_FILE", courseId: courseA });
      expect((await access.listAccessToMe(bruno)).every((a) => a.viewerName)).toBe(true);
      await expect(access.listAccessToMe(teacherA)).rejects.toBeInstanceOf(guards.AccessDenied);
    });
  });

  describe("V12: el chat del docente no trae datos de otra cátedra", () => {
    it("la herramienta rechaza a un estudiante de otra cátedra aunque el pedido esté bien formulado", async () => {
      const tools = await teacherTools.teacherChatTools(teacherA, courseA);
      await expect(tools.execute("student_file", { studentId: soloEnB.id })).rejects.toBeInstanceOf(guards.AccessDenied);
      const own = await tools.execute("student_file", { studentId: bruno.id });
      expect(own).toHaveProperty("student.id", bruno.id);
      const overview = await tools.execute("class_overview", {});
      expect(overview).toHaveProperty("participation.enrolled", 4);
    });
    it("no se arma el contexto del chat sobre una cátedra ajena", async () => {
      await expect(teacherTools.teacherChatTools(teacherA, courseB)).rejects.toBeInstanceOf(guards.AccessDenied);
    });
  });

  describe("V14: el administrador no ve conversaciones", () => {
    it("rechazado", async () => {
      await expect(guards.assertCanViewConversations(admin, ana.id, courseA)).rejects.toBeInstanceOf(guards.AccessDenied);
      await expect(studentFile.loadStudentFile(admin, ana.id, courseA)).rejects.toBeInstanceOf(guards.AccessDenied);
      await expect(studentFile.loadProjectLinks(admin, ana.id, courseA)).rejects.toBeInstanceOf(guards.AccessDenied);
    });
  });

  describe("V15: la universidad no accede a conversaciones individuales", () => {
    it("no existe un rol institucional, y ser de la misma institución no da acceso", async () => {
      const { Role } = await import("@prisma/client");
      expect(Object.keys(Role).sort()).toEqual(["ADMIN", "STUDENT", "TEACHER"]);
      // El docente de B es de la misma universidad que A y aun así no ve a los estudiantes de A.
      await expect(guards.assertCanViewConversations(teacherB, bruno.id, courseA)).rejects.toBeInstanceOf(guards.AccessDenied);
    });
  });
});
