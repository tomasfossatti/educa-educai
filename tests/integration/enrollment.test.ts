/**
 * Inscripción por código e invitaciones cuando el docente quitó a un estudiante.
 * Requiere TEST_DATABASE_URL.
 */
import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { factories } from "../support/factories";

const TEST_DB = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DB)("inscripción e invitaciones (integración)", () => {
  let db: typeof import("@/server/db").db;
  let enrollment: typeof import("@/server/services/enrollment");
  let home: typeof import("@/server/services/student-home");
  let f: ReturnType<typeof factories>;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    ({ db } = await import("@/server/db"));
    enrollment = await import("@/server/services/enrollment");
    home = await import("@/server/services/student-home");
    f = factories(db);
  });

  async function scenario() {
    const teacher = await f.teacher();
    // Los códigos reales tienen 6 caracteres; el de la fábrica es más largo.
    const created = await f.course(teacher.id);
    const course = await db.course.update({ where: { id: created.id }, data: { joinCode: randomBytes(3).toString("hex").toUpperCase() } });
    const ana = await f.student({ name: "Ana" });
    return { course, ana };
  }

  it("se inscribe con el código, y repetirlo no duplica ni falla", async () => {
    const { course, ana } = await scenario();
    expect(await enrollment.enrollWithCode(ana.id, course.joinCode.toLowerCase())).toEqual({ courseId: course.id });
    expect(await enrollment.enrollWithCode(ana.id, course.joinCode)).toEqual({ courseId: course.id });
    expect(await db.enrollment.count({ where: { courseId: course.id, studentId: ana.id, status: "ACTIVE" } })).toBe(1);
    expect(await db.folder.count({ where: { studentId: ana.id, courseId: course.id } })).toBe(1);
  });

  it("un estudiante quitado no vuelve solo con el código", async () => {
    const { course, ana } = await scenario();
    await enrollment.enrollWithCode(ana.id, course.joinCode);
    await db.enrollment.updateMany({ where: { courseId: course.id, studentId: ana.id }, data: { status: "REMOVED" } });

    const result = await enrollment.enrollWithCode(ana.id, course.joinCode);
    expect(result).toHaveProperty("error");
    expect((await db.enrollment.findFirstOrThrow({ where: { courseId: course.id, studentId: ana.id } })).status).toBe("REMOVED");
  });

  it("invitar de nuevo a un estudiante quitado vuelve a abrir su invitación", async () => {
    const { course, ana } = await scenario();
    await enrollment.inviteEmails(course.id, [ana.email]);
    // Aceptó la invitación y después el docente la quitó.
    await db.enrollment.create({ data: { courseId: course.id, studentId: ana.id } });
    await db.courseInvite.updateMany({ where: { courseId: course.id, email: ana.email }, data: { acceptedAt: new Date() } });
    await db.enrollment.updateMany({ where: { courseId: course.id, studentId: ana.id }, data: { status: "REMOVED" } });
    expect(await home.getPendingInvites(ana.email)).toHaveLength(0);

    await enrollment.inviteEmails(course.id, [ana.email]);
    const pending = await home.getPendingInvites(ana.email);
    expect(pending.map((i) => i.courseId)).toEqual([course.id]);
  });

  it("invitar de nuevo a alguien ya inscripto no le reabre la invitación", async () => {
    const { course, ana } = await scenario();
    await enrollment.inviteEmails(course.id, [ana.email]);
    await db.enrollment.create({ data: { courseId: course.id, studentId: ana.id } });
    await db.courseInvite.updateMany({ where: { courseId: course.id, email: ana.email }, data: { acceptedAt: new Date() } });

    await enrollment.inviteEmails(course.id, [ana.email]);
    expect(await home.getPendingInvites(ana.email)).toHaveLength(0);
  });
});
