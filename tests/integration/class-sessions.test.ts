/** Clases y slides con citas, edición, aprobación y PowerPoint. Requiere TEST_DATABASE_URL. */
import JSZip from "jszip";
import { beforeAll, describe, expect, it } from "vitest";
import { makePdf } from "../support/documents";
import { factories } from "../support/factories";

const TEST_DB = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DB)("clases y slides (integración)", () => {
  let db: typeof import("@/server/db").db;
  let cs: typeof import("@/server/services/class-sessions");
  let guards: typeof import("@/server/auth/guards");
  let teacher: { id: string; role: "TEACHER" };
  let other: { id: string; role: "TEACHER" };
  let student: { id: string; role: "STUDENT" };
  let courseId: string;
  let topicId: string;
  let emptyCourseTopic: string;
  let emptyCourseId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    process.env.AI_PROVIDER = "scripted";
    ({ db } = await import("@/server/db"));
    cs = await import("@/server/services/class-sessions");
    guards = await import("@/server/auth/guards");
    const material = await import("@/server/services/material");
    const f = factories(db);
    const t = await f.teacher();
    teacher = { id: t.id, role: "TEACHER" };
    other = { id: (await f.teacher()).id, role: "TEACHER" };
    courseId = (await f.course(t.id)).id;
    topicId = (await f.topic(courseId, "Hipotesis falsables")).id;
    emptyCourseId = (await f.course(t.id)).id;
    emptyCourseTopic = (await f.topic(emptyCourseId, "Hipotesis falsables")).id;
    await material.ingestMaterial({
      courseId,
      uploadedById: t.id,
      fileName: "programa.pdf",
      mimeType: "application/pdf",
      data: makePdf(["Intro.", "Unidad 2. Las hipotesis falsables definen el resultado que las refutaria."]),
    });
    const s = await f.student();
    await db.enrollment.create({ data: { courseId, studentId: s.id } });
    student = { id: s.id, role: "STUDENT" };
  });

  it("genera slides de los cuatro tipos, cada una con archivo y página", async () => {
    const session = await cs.createClassSession(teacher, courseId, { date: new Date(Date.now() + 86_400_000), topicIds: [topicId], objective: "Formular hipótesis medibles" });
    await cs.generateSlides(teacher, session.id);
    const loaded = await cs.getClassSession(teacher, session.id);
    expect(loaded.slides.map((s) => s.kind)).toEqual(["EXPLANATION", "ANALOGY", "EXERCISE", "CHECK"]);
    expect(loaded.slides.every((s) => s.sources.length > 0 && s.sources[0].fileName === "programa.pdf" && s.sources[0].page === 2)).toBe(true);
  });

  it("edición, aprobación y PowerPoint con fuentes y notas; regenerar saca la aprobación", async () => {
    const session = await cs.createClassSession(teacher, courseId, { date: new Date(Date.now() + 86_400_000), topicIds: [topicId] });
    await cs.generateSlides(teacher, session.id);
    const { slides } = await cs.getClassSession(teacher, session.id);
    await cs.updateSlides(
      teacher,
      session.id,
      slides.map((s, i) => ({ title: i === 0 ? "Hipótesis que se pueden refutar" : s.title, bullets: s.bullets, notes: s.notes })),
    );
    await cs.approveSlides(teacher, session.id);
    expect(await cs.nextApprovedSession(courseId)).not.toBeNull();

    const { fileName, data } = await cs.exportSlidesPptx(teacher, session.id);
    expect(fileName).toMatch(/^slides-\d{4}-\d{2}-\d{2}\.pptx$/);
    const zip = await JSZip.loadAsync(data);
    const slideXml = await zip.file("ppt/slides/slide2.xml")!.async("string");
    expect(slideXml).toContain("Hipótesis que se pueden refutar");
    expect(slideXml).toContain("Fuente: programa.pdf, pág. 2");
    expect(Object.keys(zip.files).some((n) => n.startsWith("ppt/notesSlides/"))).toBe(true);

    await cs.generateSlides(teacher, session.id);
    expect((await db.classSession.findUniqueOrThrow({ where: { id: session.id } })).approvedAt).toBeNull();
  });

  it("sin material no genera slides (no inventa)", async () => {
    const session = await cs.createClassSession(teacher, emptyCourseId, { date: new Date(), topicIds: [emptyCourseTopic] });
    await expect(cs.generateSlides(teacher, session.id)).rejects.toThrow(/No hay material/);
  });

  it("solo el docente de la cátedra crea, ve, edita y exporta", async () => {
    await expect(cs.createClassSession(other, courseId, { date: new Date(), topicIds: [topicId] })).rejects.toBeInstanceOf(guards.AccessDenied);
    await expect(cs.createClassSession(student as never, courseId, { date: new Date(), topicIds: [topicId] })).rejects.toBeInstanceOf(guards.AccessDenied);
    const session = await cs.createClassSession(teacher, courseId, { date: new Date(), topicIds: [topicId] });
    await expect(cs.getClassSession(other, session.id)).rejects.toBeInstanceOf(guards.AccessDenied);
    await expect(cs.exportSlidesPptx(student as never, session.id)).rejects.toBeInstanceOf(guards.AccessDenied);
  });

  it("descarta slides sin fuente válida", () => {
    const hits = [{ chunkId: "c", materialId: "m", fileName: "a.pdf", page: 4, text: "", rank: 1 }];
    const kept = cs.keepSourcedSlides(
      [
        { kind: "EXPLANATION", title: "a", bullets: ["x"], notes: "", sources: [1, 1, 9] },
        { kind: "ANALOGY", title: "b", bullets: ["y"], notes: "", sources: [] },
        { kind: "CHECK", title: "c", bullets: ["z"], notes: "", sources: [3] },
      ],
      hits,
    );
    expect(kept).toHaveLength(1);
    expect(kept[0].sources).toEqual([{ fileName: "a.pdf", page: 4 }]);
  });
});
