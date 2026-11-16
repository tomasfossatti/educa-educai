import "server-only";
import type { CurriculumKind } from "@prisma/client";
import { after } from "next/server";
import { isVerbatimExcerpt } from "@/domain/text-guards";
import { AIError, generateStructuredWithRetry } from "@/server/ai";
import { CURRICULUM_SYSTEM, buildCurriculumMessage, curriculumExtractionSchema } from "@/server/ai/prompts/curriculum";
import { db } from "@/server/db";

const KIND_ORDER: CurriculumKind[] = ["CONCEPT", "OBJECTIVE", "COMPETENCY", "CRITERION"];

/**
 * Inicia la extracción curricular con IA. Corre después de responder (after) y
 * deja la materia en EXTRACTING hasta terminar. El PDF no se persiste: solo se
 * envía al modelo y se guarda el nombre del archivo como referencia.
 */
export async function startCurriculumExtraction(params: {
  courseId: string;
  teacherId: string;
  programText: string | null;
  pdf: { name: string; base64: string } | null;
}): Promise<void> {
  await db.course.update({
    where: { id: params.courseId },
    data: {
      curriculumStatus: "EXTRACTING",
      curriculumError: null,
      programText: params.programText,
      programFileName: params.pdf?.name ?? null,
    },
  });
  after(async () => {
    await runCurriculumExtraction(params.courseId, params.teacherId, params.pdf?.base64 ?? null);
  });
}

export async function runCurriculumExtraction(courseId: string, teacherId: string, pdfBase64: string | null): Promise<void> {
  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) return;
  try {
    const output = await generateStructuredWithRetry({
      operation: "curriculum.extract",
      system: CURRICULUM_SYSTEM,
      messages: [
        {
          role: "user",
          content: buildCurriculumMessage({ courseName: course.name, description: course.description, programText: course.programText }),
        },
      ],
      attachments: pdfBase64 ? [{ kind: "pdf", base64: pdfBase64 }] : undefined,
      schema: curriculumExtractionSchema,
      context: { actorUserId: teacherId, courseId },
    });

    await db.$transaction(async (tx) => {
      // Se reemplazan solo las propuestas pendientes; lo aceptado o creado por el docente se conserva.
      await tx.curriculumItem.deleteMany({ where: { courseId, origin: "AI_PROPOSED", status: "PROPOSED" } });
      const existing = await tx.curriculumItem.count({ where: { courseId } });
      const idsByRef = new Map<string, string>();
      const ordered = [...output.items].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
      let position = existing;
      for (const item of ordered) {
        const excerpt =
          item.sourceExcerpt && (!course.programText || isVerbatimExcerpt(item.sourceExcerpt, course.programText))
            ? item.sourceExcerpt
            : null;
        const created = await tx.curriculumItem.create({
          data: {
            courseId,
            kind: item.kind,
            title: item.title.slice(0, 200),
            description: item.description,
            origin: "AI_PROPOSED",
            status: "PROPOSED",
            sourceExcerpt: excerpt,
            position: position++,
          },
        });
        idsByRef.set(item.ref, created.id);
      }
      for (const item of ordered) {
        const parentId = item.parentRef ? idsByRef.get(item.parentRef) : undefined;
        if (parentId) await tx.curriculumItem.update({ where: { id: idsByRef.get(item.ref)! }, data: { parentId } });
      }
      await tx.course.update({
        where: { id: courseId },
        data: { curriculumStatus: "IN_REVIEW", curriculumError: null, curriculumNotes: output.notes },
      });
    });
  } catch (error) {
    console.error("[curriculum] extracción fallida", error);
    await db.course.update({
      where: { id: courseId },
      data: {
        curriculumStatus: "FAILED",
        curriculumError: error instanceof AIError ? error.message : "No se pudo procesar el programa. Intentá de nuevo.",
      },
    });
  }
}

/** Caracteres del comienzo de cada lectura que se le pasan a la IA, y tope total. */
const EXCERPT_CHARS = 1500;
const MAX_MATERIAL_PROGRAM = 50_000;

/** Encabezado del texto armado con el material: deja claro que no es el programa oficial. */
export const MATERIAL_PROGRAM_HEADER =
  "Esta materia no tiene programa cargado. Lo que sigue es el material de lectura importado del LMS, en orden, con el comienzo de cada lectura. Proponé los temas a partir de esas lecturas.";

/**
 * Texto para proponer la currícula cuando no hay programa: una línea por archivo del material
 * (módulo, lectura y título) con el comienzo de su texto. Devuelve null si no hay material listo.
 */
export async function programTextFromMaterial(courseId: string): Promise<string | null> {
  const materials = await db.material.findMany({
    where: { courseId, status: "READY" },
    orderBy: [{ module: "asc" }, { fileName: "asc" }],
    select: { fileName: true, chunks: { orderBy: [{ page: "asc" }, { position: "asc" }], select: { text: true }, take: 4 } },
  });
  if (materials.length === 0) return null;
  const lines = [MATERIAL_PROGRAM_HEADER, ""];
  let size = MATERIAL_PROGRAM_HEADER.length;
  for (const m of materials) {
    const title = m.fileName.replace(/\.[a-z0-9]+$/i, "");
    let excerpt = "";
    for (const c of m.chunks) {
      if (excerpt.length >= EXCERPT_CHARS) break;
      excerpt += ` ${c.text}`;
    }
    excerpt = excerpt.replace(/\s+/g, " ").trim().slice(0, EXCERPT_CHARS);
    const block = `- ${title}\n  Comienzo: ${excerpt}`;
    if (size + block.length > MAX_MATERIAL_PROGRAM) break;
    lines.push(block);
    size += block.length;
  }
  return lines.join("\n");
}

/**
 * Después de traer una materia del LMS: si el docente todavía no cargó el programa, la IA propone los
 * temas a partir del material importado. Quedan "propuestos" hasta que el docente los revise y confirme,
 * como con el programa. No toca una currícula en revisión o ya configurada.
 */
export async function proposeCurriculumFromMaterial(courseId: string, teacherId: string): Promise<boolean> {
  const course = await db.course.findUnique({ where: { id: courseId }, select: { teacherId: true, curriculumStatus: true } });
  if (!course || course.teacherId !== teacherId) return false;
  if (course.curriculumStatus !== "NOT_STARTED" && course.curriculumStatus !== "FAILED") return false;
  const programText = await programTextFromMaterial(courseId);
  if (!programText) return false;
  await db.course.update({
    where: { id: courseId },
    data: { curriculumStatus: "EXTRACTING", curriculumError: null, programText, programFileName: null },
  });
  await runCurriculumExtraction(courseId, teacherId, null);
  return true;
}
