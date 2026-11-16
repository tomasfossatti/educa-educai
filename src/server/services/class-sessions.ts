import "server-only";
import PptxGenJS from "pptxgenjs";
import { z } from "zod";
import { generateStructured } from "@/server/ai";
import { AccessDenied, assertCourseTeacher, type Viewer } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getClassOverview } from "@/server/services/class-view";
import { citationLabelForModel } from "@/domain/citations";
import { TEXT } from "@/lib/texts";
import { searchMaterial, type MaterialHit } from "@/server/services/material";

export class SlidesError extends Error {}

export const SLIDE_KINDS = ["EXPLANATION", "ANALOGY", "EXERCISE", "CHECK"] as const;
export type SlideKind = (typeof SLIDE_KINDS)[number];

export interface Slide {
  kind: SlideKind;
  title: string;
  bullets: string[];
  notes: string;
  sources: { fileName: string; page: number }[];
}

const generatedSchema = z.object({
  slides: z
    .array(
      z.object({
        kind: z.enum(SLIDE_KINDS),
        title: z.string().min(1).max(120),
        bullets: z.array(z.string().min(1).max(300)).min(1).max(6),
        notes: z.string().max(1500),
        /** Números de los fragmentos del material en los que se basa la slide. */
        sources: z.array(z.number().int().positive()).max(5),
      }),
    )
    .min(1)
    .max(12),
});

const SYSTEM = `Armás el borrador de slides de una clase universitaria, en español rioplatense.
Para los TEMAS de la clase, hacé al menos una slide de cada tipo: EXPLANATION (explicación breve), ANALOGY (analogía),
EXERCISE (ejercicio de cinco minutos para hacer en clase) y CHECK (pregunta de chequeo).
Reglas:
- Usá SOLO los fragmentos del material; en "sources" poné los números de los fragmentos que usaste en cada slide.
- Priorizá las DUDAS FRECUENTES de la clase: la explicación y el ejercicio tienen que apuntar a ellas.
- Bullets cortos (una línea). Las notas son para el docente.`;

/**
 * Validación determinística: se descartan las slides sin un fragmento válido como fuente
 * y se resuelven las fuentes a archivo y página.
 */
export function keepSourcedSlides(slides: z.infer<typeof generatedSchema>["slides"], hits: MaterialHit[]): Slide[] {
  return slides
    .map((s) => ({
      ...s,
      sources: [...new Set(s.sources)].filter((n) => n >= 1 && n <= hits.length).map((n) => ({ fileName: hits[n - 1].fileName, page: hits[n - 1].page })),
    }))
    .filter((s) => s.sources.length > 0);
}

async function ownedSession(viewer: Viewer, sessionId: string) {
  if (viewer.role !== "TEACHER") throw new AccessDenied();
  const session = await db.classSession.findFirst({
    where: { id: sessionId, course: { teacherId: viewer.id } },
    include: { items: { include: { curriculumItem: { select: { id: true, title: true, description: true } } } }, course: { select: { id: true, name: true } } },
  });
  if (!session) throw new AccessDenied();
  return session;
}

export async function createClassSession(viewer: Viewer, courseId: string, input: { date: Date; topicIds: string[]; objective?: string | null }) {
  await assertCourseTeacher(viewer, courseId);
  const topics = await db.curriculumItem.findMany({ where: { id: { in: input.topicIds }, courseId, status: "ACCEPTED" }, select: { id: true } });
  if (topics.length === 0) throw new SlidesError("Elegí al menos un tema del programa.");
  return db.classSession.create({
    data: {
      courseId,
      date: input.date,
      objective: input.objective?.trim() || null,
      items: { create: topics.map((t) => ({ curriculumItemId: t.id })) },
    },
  });
}

export async function getClassSession(viewer: Viewer, sessionId: string) {
  const session = await ownedSession(viewer, sessionId);
  return { ...session, slides: (session.slidesDraft as Slide[] | null) ?? [] };
}

/** Genera (o regenera) el borrador con el material de los temas y las dudas frecuentes de la clase. Saca la aprobación. */
export async function generateSlides(viewer: Viewer, sessionId: string) {
  const session = await ownedSession(viewer, sessionId);
  const topics = session.items.map((i) => i.curriculumItem);
  const hits = await searchMaterial(session.courseId, topics.map((t) => `${t.title} ${t.description ?? ""}`).join(" "), 10);
  if (hits.length === 0) throw new SlidesError("No hay material de la cátedra sobre estos temas: subí material para generar slides con fuente.");

  const overview = await getClassOverview(viewer, session.courseId, { windowDays: 14 });
  const doubts = overview.topics.filter((t) => t.withDoubt > 0).slice(0, 5).map((t) => t.sentence);

  const output = await generateStructured({
    operation: "slides.generate",
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          `FRAGMENTOS DEL MATERIAL:\n${hits.map((h, i) => `[${i + 1}] ${h.fileName}, ${citationLabelForModel(h.fileName, h.page)}:\n${h.text}`).join("\n")}`,
          `TEMAS: ${topics.map((t) => t.title).join(", ")}`,
          session.objective ? `OBJETIVO DE LA CLASE: ${session.objective}` : "",
          `DUDAS FRECUENTES: ${doubts.length ? doubts.join(" ") : "sin datos todavía"}`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
    schema: generatedSchema,
    context: { actorUserId: viewer.id, courseId: session.courseId },
  });
  const slides = keepSourcedSlides(output.slides, hits);
  if (slides.length < 2) throw new SlidesError("No se pudieron armar slides con fuente. Probá de nuevo más tarde.");
  return db.classSession.update({ where: { id: session.id }, data: { slidesDraft: slides as unknown as object, approvedAt: null } });
}

const editSchema = z.array(
  z.object({ title: z.string().trim().min(1).max(120), bullets: z.array(z.string().trim().min(1).max(300)).min(1).max(8), notes: z.string().max(1500) }),
);

/** Edición del docente: texto de cada slide. Las fuentes y el tipo no se editan. Saca la aprobación. */
export async function updateSlides(viewer: Viewer, sessionId: string, edits: z.input<typeof editSchema>) {
  const session = await getClassSession(viewer, sessionId);
  const parsed = editSchema.parse(edits);
  if (parsed.length !== session.slides.length) throw new SlidesError("La edición no coincide con el borrador.");
  const slides = session.slides.map((s, i) => ({ ...s, ...parsed[i] }));
  return db.classSession.update({ where: { id: session.id }, data: { slidesDraft: slides as unknown as object, approvedAt: null } });
}

export async function approveSlides(viewer: Viewer, sessionId: string) {
  const session = await getClassSession(viewer, sessionId);
  if (session.slides.length === 0) throw new SlidesError("Primero generá el borrador.");
  return db.classSession.update({ where: { id: session.id }, data: { approvedAt: new Date() } });
}

const KIND_LABEL: Record<SlideKind, string> = { EXPLANATION: "Explicación", ANALOGY: "Analogía", EXERCISE: "Ejercicio (5 minutos)", CHECK: "Pregunta de chequeo" };

/** Exporta el borrador a PowerPoint: una slide de portada y una por slide, con la fuente al pie y las notas del docente. */
export async function exportSlidesPptx(viewer: Viewer, sessionId: string): Promise<{ fileName: string; data: Buffer }> {
  const session = await getClassSession(viewer, sessionId);
  if (session.slides.length === 0) throw new SlidesError("Primero generá el borrador.");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  const topics = session.items.map((i) => i.curriculumItem.title).join(" · ");

  const cover = pptx.addSlide();
  cover.addText(session.course.name, { x: 0.6, y: 1.6, w: 12, h: 0.8, fontSize: 32, bold: true });
  cover.addText(topics, { x: 0.6, y: 2.5, w: 12, h: 0.6, fontSize: 20 });
  if (session.objective) cover.addText(`Objetivo: ${session.objective}`, { x: 0.6, y: 3.2, w: 12, h: 0.6, fontSize: 16 });

  for (const s of session.slides) {
    const slide = pptx.addSlide();
    slide.addText(KIND_LABEL[s.kind], { x: 0.6, y: 0.3, w: 12, h: 0.4, fontSize: 12, color: "666666" });
    slide.addText(s.title, { x: 0.6, y: 0.7, w: 12, h: 0.8, fontSize: 28, bold: true });
    slide.addText(
      s.bullets.map((b) => ({ text: b, options: { bullet: true } })),
      { x: 0.6, y: 1.7, w: 12, h: 4.6, fontSize: 18, valign: "top" },
    );
    slide.addText(`Fuente: ${s.sources.map((src) => TEXT.citation.source(src.fileName, src.page)).join("; ")}`, { x: 0.6, y: 6.7, w: 12, h: 0.4, fontSize: 11, color: "666666" });
    if (s.notes) slide.addNotes(s.notes);
  }
  const data = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  const date = session.date.toISOString().slice(0, 10);
  return { fileName: `slides-${date}.pptx`, data };
}

/** Próxima clase aprobada de una cátedra (para el inicio del estudiante). */
export async function nextApprovedSession(courseId: string, now: Date = new Date()) {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  return db.classSession.findFirst({
    where: { courseId, approvedAt: { not: null }, date: { gte: startOfDay } },
    orderBy: { date: "asc" },
    select: { date: true, objective: true, items: { select: { curriculumItem: { select: { title: true } } } } },
  });
}
