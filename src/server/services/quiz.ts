import "server-only";
import { z } from "zod";
import { computeMastery, quizCorrectness } from "@/domain/topic-mastery";
import { generateStructured } from "@/server/ai";
import { AccessDenied, assertFolderOwner, type Viewer } from "@/server/auth/guards";
import { db } from "@/server/db";
import { searchMaterial, type MaterialHit } from "@/server/services/material";

export class QuizError extends Error {}

const generatedSchema = z.object({
  questions: z
    .array(
      z.object({
        prompt: z.string().min(5).max(600),
        options: z.array(z.string().min(1).max(300)).min(3).max(5),
        correctIndex: z.number().int().min(0),
        explanation: z.string().min(1).max(800),
        /** Número del fragmento del material en el que se basa la pregunta. */
        source: z.number().int().positive().nullable(),
      }),
    )
    .min(1)
    .max(8),
});

export interface StoredQuestion {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  source: { fileName: string; page: number };
}

const SYSTEM = `Generás quizzes cortos para estudiantes universitarios, en español rioplatense.
Reglas:
- Entre 3 y 5 preguntas de opción múltiple sobre el TEMA, con 4 opciones y una sola correcta.
- Cada pregunta se basa en UN fragmento del material: poné su número en "source". No preguntes nada que no esté en los fragmentos.
- La explicación dice por qué la correcta es correcta, citando el fragmento.
- Evitá preguntas de memoria literal: preferí comprensión y aplicación.`;

/**
 * Validación determinística de la salida del modelo: se descartan las preguntas con un índice
 * correcto fuera de rango o sin un fragmento válido como fuente. Quedan como máximo 5.
 */
export function keepValidQuestions(questions: z.infer<typeof generatedSchema>["questions"], hits: MaterialHit[]): StoredQuestion[] {
  return questions
    .filter((q) => q.correctIndex < q.options.length && q.source !== null && q.source >= 1 && q.source <= hits.length)
    .slice(0, 5)
    .map((q) => ({
      prompt: q.prompt,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      source: { fileName: hits[q.source! - 1].fileName, page: hits[q.source! - 1].page },
    }));
}

/** Crea un quiz sobre un tema de la materia de una carpeta del estudiante. */
export async function createQuiz(viewer: Viewer, folderId: string, topicId: string) {
  const folder = await assertFolderOwner(viewer, folderId);
  if (!folder.courseId) throw new QuizError("Los quizzes son sobre temas de una materia.");
  const topic = await db.curriculumItem.findFirst({ where: { id: topicId, courseId: folder.courseId, status: "ACCEPTED" } });
  if (!topic) throw new AccessDenied();

  const hits = await searchMaterial(folder.courseId, `${topic.title} ${topic.description ?? ""}`, 8);
  if (hits.length === 0) throw new QuizError("No hay material de la cátedra sobre este tema todavía: no se puede armar un quiz con fuente.");

  const fragments = hits.map((h, i) => `[${i + 1}] ${h.fileName}, página ${h.page}:\n${h.text}`).join("\n");
  const output = await generateStructured({
    operation: "quiz.generate",
    system: SYSTEM,
    messages: [{ role: "user", content: `FRAGMENTOS DEL MATERIAL:\n${fragments}\nTEMA: ${topic.title}${topic.description ? ` — ${topic.description}` : ""}` }],
    schema: generatedSchema,
    context: { actorUserId: viewer.id, studentId: viewer.id, courseId: folder.courseId },
  });
  const questions = keepValidQuestions(output.questions, hits);
  if (questions.length < 3) throw new QuizError("No se pudieron armar al menos tres preguntas con fuente. Probá de nuevo más tarde.");

  return db.quizAttempt.create({
    data: { studentId: viewer.id, courseId: folder.courseId, curriculumItemId: topic.id, questions: questions as unknown as object, total: questions.length },
  });
}

async function ownedQuiz(viewer: Viewer, quizId: string) {
  if (viewer.role !== "STUDENT") throw new AccessDenied();
  const quiz = await db.quizAttempt.findFirst({ where: { id: quizId, studentId: viewer.id }, include: { curriculumItem: { select: { title: true } } } });
  if (!quiz) throw new AccessDenied();
  return quiz;
}

/**
 * Quiz para mostrar. Mientras está abierto, sin la respuesta correcta ni la explicación:
 * eso nunca llega al navegador antes de entregar.
 */
export async function getQuizForStudent(viewer: Viewer, quizId: string) {
  const quiz = await ownedQuiz(viewer, quizId);
  const questions = quiz.questions as unknown as StoredQuestion[];
  const answers = (quiz.answers as (number | null)[] | null) ?? [];
  return {
    id: quiz.id,
    topicId: quiz.curriculumItemId,
    topic: quiz.curriculumItem.title,
    status: quiz.status,
    correct: quiz.correct,
    total: quiz.total,
    questions: questions.map((q, i) =>
      quiz.status === "OPEN"
        ? { prompt: q.prompt, options: q.options, source: q.source }
        : { prompt: q.prompt, options: q.options, source: q.source, correctIndex: q.correctIndex, explanation: q.explanation, chosen: answers[i] ?? null },
    ),
  };
}

/** Corrige en código, guarda el intento y recalcula el dominio del tema con la fórmula portada. */
export async function submitQuiz(viewer: Viewer, quizId: string, answers: (number | null)[]) {
  const quiz = await ownedQuiz(viewer, quizId);
  if (quiz.status !== "OPEN") throw new QuizError("Este quiz ya se entregó.");
  const questions = quiz.questions as unknown as StoredQuestion[];
  const normalized = questions.map((_, i) => (Number.isInteger(answers[i]) ? (answers[i] as number) : null));
  const correct = questions.filter((q, i) => normalized[i] === q.correctIndex).length;
  const now = new Date();

  return db.$transaction(async (tx) => {
    const updated = await tx.quizAttempt.updateMany({
      where: { id: quiz.id, status: "OPEN" },
      data: { answers: normalized, correct, status: "SUBMITTED", submittedAt: now },
    });
    if (updated.count === 0) throw new QuizError("Este quiz ya se entregó.");
    const history = await tx.quizAttempt.findMany({
      where: { studentId: viewer.id, curriculumItemId: quiz.curriculumItemId, status: "SUBMITTED" },
      orderBy: { submittedAt: "asc" },
      select: { correct: true, total: true },
    });
    const score = computeMastery(history.map((h) => quizCorrectness(h.correct ?? 0, h.total)));
    await tx.masteryRecord.upsert({
      where: { studentId_curriculumItemId: { studentId: viewer.id, curriculumItemId: quiz.curriculumItemId } },
      create: { studentId: viewer.id, curriculumItemId: quiz.curriculumItemId, score, attempts: history.length, lastEvidenceAt: now },
      update: { score, attempts: history.length, lastEvidenceAt: now },
    });
    const folder = await tx.folder.findFirst({ where: { studentId: viewer.id, courseId: quiz.courseId }, select: { id: true } });
    if (folder) {
      await tx.folderContext.create({
        data: { folderId: folder.id, layer: "TRACE", content: `Quiz de ${quiz.curriculumItem.title}: ${correct} de ${questions.length}`, sourceIds: [quiz.id] },
      });
    }
    return { correct, total: questions.length, mastery: score };
  });
}
