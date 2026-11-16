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
 * Reserva la propuesta de temas con el material: pasa la currícula a EXTRACTING solo si está sin cargar
 * o con error y la cátedra es del docente. Es atómico, así que dos pedidos simultáneos no la corren dos
 * veces. Devuelve true si quien llama tiene que correr la extracción (`runCurriculumExtraction`).
 */
export async function claimMaterialProposal(courseId: string, teacherId: string): Promise<boolean> {
  const course = await db.course.findFirst({ where: { id: courseId, teacherId }, select: { curriculumStatus: true } });
  if (!course || (course.curriculumStatus !== "NOT_STARTED" && course.curriculumStatus !== "FAILED")) return false;
  const programText = await programTextFromMaterial(courseId);
  if (!programText) return false;
  const { count } = await db.course.updateMany({
    where: { id: courseId, teacherId, curriculumStatus: { in: ["NOT_STARTED", "FAILED"] } },
    data: { curriculumStatus: "EXTRACTING", curriculumError: null, curriculumNotes: null, programText, programFileName: null },
  });
  return count === 1;
}

/** ¿Se pueden proponer los temas con el material? Currícula sin cargar o con error, y material listo. */
export async function canProposeFromMaterial(courseId: string, teacherId: string): Promise<boolean> {
  const course = await db.course.findFirst({ where: { id: courseId, teacherId }, select: { curriculumStatus: true } });
  if (!course || (course.curriculumStatus !== "NOT_STARTED" && course.curriculumStatus !== "FAILED")) return false;
  return (await db.material.count({ where: { courseId, status: "READY" } })) > 0;
}

/**
 * Una extracción corre en segundo plano con un tope de 5 minutos (Vercel). Si el proceso se corta, la
 * materia quedaría en EXTRACTING para siempre: pasado este plazo se da por fallida y se puede pedir de nuevo.
 */
export const STALE_EXTRACTION_MS = 6 * 60 * 1000;

export async function recoverStaleExtractions(teacherId: string, now = new Date()): Promise<number> {
  const { count } = await db.course.updateMany({
    where: { teacherId, curriculumStatus: "EXTRACTING", updatedAt: { lt: new Date(now.getTime() - STALE_EXTRACTION_MS) } },
    data: { curriculumStatus: "FAILED", curriculumError: "La propuesta de temas se interrumpió antes de terminar. Pedila de nuevo." },
  });
  return count;
}
