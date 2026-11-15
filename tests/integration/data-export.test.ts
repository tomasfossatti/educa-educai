/** Descarga de los datos propios (Ley 25.326, art. 14). Requiere TEST_DATABASE_URL. */
import { beforeAll, describe, expect, it } from "vitest";
import { factories } from "../support/factories";

const TEST_DB = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DB)("descarga de mis datos (integración)", () => {
  let db: typeof import("@/server/db").db;
  let privacy: typeof import("@/server/services/privacy");
  let guards: typeof import("@/server/auth/guards");
  let f: ReturnType<typeof factories>;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    ({ db } = await import("@/server/db"));
    privacy = await import("@/server/services/privacy");
    guards = await import("@/server/auth/guards");
    f = factories(db);
  });

  it("incluye lo del estudiante y quién abrió su ficha, sin la contraseña ni datos de otra persona", async () => {
    const folders = await import("@/server/services/folders");
    const t = await f.teacher();
    const courseId = (await f.course(t.id)).id;
    const topicId = (await f.topic(courseId, "Hipótesis")).id;
    const [ana, bruno] = [await f.student({ name: "Ana" }), await f.student({ name: "Bruno" })];
    for (const s of [ana, bruno]) {
      await db.enrollment.create({ data: { courseId, studentId: s.id } });
      await folders.ensureStudentFolders(s.id);
    }
    const folderOf = async (id: string) => (await db.folder.findFirstOrThrow({ where: { studentId: id, courseId } })).id;
    const anaConv = await f.conversation({ studentId: ana.id, folderId: await folderOf(ana.id), courseId, messages: [["STUDENT", "Mensaje de Ana"]] });
    await f.conversation({ studentId: bruno.id, folderId: await folderOf(bruno.id), courseId, messages: [["STUDENT", "Mensaje de Bruno"]] });
    await f.evidenceFrom({ experienceId: anaConv.experience.id, studentId: ana.id, courseId, topicId, excerpt: "Duda de Ana" });
    await db.accessLog.create({ data: { viewerId: t.id, studentId: ana.id, courseId, view: "STUDENT_FILE" } });

    const data = await privacy.exportStudentData({ id: ana.id, role: "STUDENT" });
    const json = JSON.stringify(data);

    expect(data.account.email).toBe(ana.email);
    expect(data.conversations[0].messages[0].content).toBe("Mensaje de Ana");
    expect(data.doubts[0].evidence.content).toBe("Duda de Ana");
    expect(data.accessToMyFile).toHaveLength(1);
    expect(data.accessToMyFile[0].viewer.role).toBe("TEACHER");
    expect(data.folders).toHaveLength(2);
    expect(json).not.toContain("Mensaje de Bruno");
    expect(json).not.toContain(bruno.id);
    expect(json).not.toContain(ana.passwordHash);
    expect(json).not.toContain("passwordHash");
  });

  it("solo un estudiante pide su propia copia", async () => {
    const t = await f.teacher();
    await expect(privacy.exportStudentData({ id: t.id, role: "TEACHER" })).rejects.toBeInstanceOf(guards.AccessDenied);
    const admin = await f.admin();
    await expect(privacy.exportStudentData({ id: admin.id, role: "ADMIN" })).rejects.toBeInstanceOf(guards.AccessDenied);
  });
});
