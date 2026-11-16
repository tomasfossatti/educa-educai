/** Foco de personalización: el chat recibe solo el trabajo o solo el proyecto. Requiere TEST_DATABASE_URL. */
import { beforeAll, describe, expect, it } from "vitest";
import { factories } from "../support/factories";

const TEST_DB = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DB)("foco de personalización (integración)", () => {
  let db: typeof import("@/server/db").db;
  let folderContext: typeof import("@/server/services/folder-context");
  let studentFile: typeof import("@/server/services/student-file");
  let f: ReturnType<typeof factories>;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    ({ db } = await import("@/server/db"));
    folderContext = await import("@/server/services/folder-context");
    studentFile = await import("@/server/services/student-file");
    f = factories(db);
  });

  async function studentWith(focus: "WORK" | "PROJECT") {
    const folders = await import("@/server/services/folders");
    const t = await f.teacher();
    const courseId = (await f.course(t.id)).id;
    const s = await f.student();
    await db.studentProfile.update({
      where: { userId: s.id },
      data: { declaredCurrentContext: "Trabajo en una empresa petrolera", projectDescription: "Un centro de kinesiología", personalizationFocus: focus },
    });
    await db.enrollment.create({ data: { courseId, studentId: s.id } });
    await folders.ensureStudentFolders(s.id);
    const folderId = (await db.folder.findFirstOrThrow({ where: { studentId: s.id, courseId } })).id;
    return { id: s.id, courseId, folderId };
  }

  it("con foco en el proyecto, el chat recibe el proyecto y no el trabajo", async () => {
    const s = await studentWith("PROJECT");
    const prompt = await folderContext.contextForPrompt(s.folderId, s.id);
    expect(prompt).toContain("kinesiología");
    expect(prompt).not.toContain("petrolera");
  });

  it("con foco en el trabajo, el chat recibe el trabajo y no el proyecto, y la ficha lo muestra", async () => {
    const s = await studentWith("WORK");
    const prompt = await folderContext.contextForPrompt(s.folderId, s.id);
    expect(prompt).toContain("petrolera");
    expect(prompt).not.toContain("kinesiología");
    const file = await studentFile.loadStudentFile({ id: s.id, role: "STUDENT" }, s.id, s.courseId);
    expect(file.student.personalizationFocus).toBe("WORK");
  });
});
