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
