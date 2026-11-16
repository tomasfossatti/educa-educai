import "server-only";
import { z } from "zod";
import { planFactsUpdate, summaryIsStale, type ActiveFact } from "@/domain/folder-context";
import { generateStructured } from "@/server/ai";
import { AccessDenied, assertFolderOwner, hasActiveConsent, type Viewer } from "@/server/auth/guards";
import { db } from "@/server/db";
import { focusText, personalizationPrompt } from "@/domain/personalization";

/**
 * Contexto de cada carpeta en tres capas (modelo de DeepTutor, reimplementado):
 * - TRACE: eventos de la carpeta; el sistema solo agrega; no entra al prompt.
 * - FACTS: lo que la IA aprendió del estudiante en esa materia, cada hecho con sus fuentes.
 * - SUMMARY: perfil corto que cruza carpetas; se guarda en la carpeta del proyecto y se renueva una vez por día.
 * El proceso nunca borra: archiva. El estudiante sí puede corregir o borrar.
 * Solo se construye con el consentimiento de análisis activo.
 */

const factsSchema = z.object({
  add: z.array(z.object({ content: z.string().min(3).max(300), courseRefs: z.array(z.string()).max(5).optional() })).max(5),
  archive: z.array(z.object({ ref: z.string(), reason: z.string().max(300) })).max(10),
});
const summarySchema = z.object({ summary: z.string().min(3).max(800) });

const FACTS_SYSTEM = `Mantenés la memoria de una carpeta de estudio de un estudiante universitario.
Recibís los HECHOS ACTUALES (F#) y una CONVERSACIÓN recién cerrada.
- En "add", agregá como máximo 5 hechos nuevos y útiles para ayudarlo en esta materia: qué le cuesta, qué ya entiende, cómo aprende, en qué trabaja su proyecto. Una oración cada uno, en tercera persona, sin datos sensibles (salud, religión, política, datos de terceros).
- En "archive", poné los F# que la conversación contradice o que quedaron viejos, con el motivo. No archives por archivar.
- Si hay CÁTEDRAS (C#), en "courseRefs" indicá con cuáles se vincula cada hecho nuevo. Solo si el vínculo es claro.
- No inventes: todo hecho tiene que salir de la conversación.`;

const SUMMARY_SYSTEM = `Escribí un perfil corto (3 a 5 oraciones, tercera persona, español rioplatense) de un estudiante a partir de sus HECHOS de todas sus carpetas: carrera, proyecto, qué le cuesta y cómo aprende. Sin datos sensibles. No inventes nada que no esté en los hechos.`;

export async function appendTrace(folderId: string, content: string, sourceIds: string[] = []): Promise<void> {
  await db.folderContext.create({ data: { folderId, layer: "TRACE", content, sourceIds } });
}

async function studentConsents(studentId: string) {
  return hasActiveConsent(await db.studentProfile.findUnique({ where: { userId: studentId }, select: { consentAnalysisAt: true } }));
}

/** Actualiza los hechos de la carpeta de una conversación recién cerrada. */
export async function updateFolderFacts(conversationId: string): Promise<{ created: number; archived: number } | null> {
  const conversation = await db.aIConversation.findUnique({
    where: { id: conversationId },
    include: { folder: true, messages: { orderBy: { createdAt: "asc" }, select: { role: true, content: true } } },
  });
  if (!conversation?.folder || conversation.messages.length === 0) return null;
  if (!(await studentConsents(conversation.studentId))) return null;
  const folder = conversation.folder;

  const factsRows = await db.folderContext.findMany({
    where: { folderId: folder.id, layer: "FACTS", archivedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, content: true, editedByStudent: true },
  });
  const active: ActiveFact[] = factsRows.map((f, i) => ({ ...f, ref: `F${i + 1}` }));

  // Solo la carpeta del proyecto vincula hechos con cátedras (V5); la de una materia ya pertenece a su cátedra.
  const courseRefs: Record<string, string> = {};
  let coursesBlock = "";
  if (folder.kind === "PROJECT") {
    const enrollments = await db.enrollment.findMany({
      where: { studentId: conversation.studentId, status: "ACTIVE" },
      select: { course: { select: { id: true, name: true, curriculumItems: { where: { status: "ACCEPTED" }, select: { title: true }, take: 20 } } } },
    });
    coursesBlock = enrollments
      .map((e, i) => {
        courseRefs[`C${i + 1}`] = e.course.id;
        return `C${i + 1}: ${e.course.name} — temas: ${e.course.curriculumItems.map((t) => t.title).join(", ")}`;
      })
      .join("\n");
  }

  const transcript = conversation.messages.map((m) => `${m.role === "STUDENT" ? "ESTUDIANTE" : "TUTOR"}: ${m.content}`).join("\n").slice(-12_000);
  const proposal = await generateStructured({
    operation: "context.facts",
    system: FACTS_SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          `HECHOS ACTUALES:\n${active.map((f) => `${f.ref}: ${f.content}`).join("\n") || "(ninguno)"}`,
          coursesBlock ? `CÁTEDRAS:\n${coursesBlock}` : "",
          `CONVERSACIÓN:\n${transcript}`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
    schema: factsSchema,
    context: { actorUserId: conversation.studentId, studentId: conversation.studentId, courseId: folder.courseId },
  });

  const plan = planFactsUpdate(active, proposal, courseRefs);
  const now = new Date();
  await db.$transaction([
    // Condicional en la base: si el estudiante editó el hecho mientras corría el proceso, no se archiva.
    db.folderContext.updateMany({ where: { id: { in: plan.archiveIds }, editedByStudent: false, archivedAt: null }, data: { archivedAt: now } }),
    db.folderContext.createMany({
      data: plan.create.map((c) => ({
        folderId: folder.id,
        layer: "FACTS" as const,
        content: c.content,
        sourceIds: [conversation.id],
        courseIds: folder.courseId ? [folder.courseId] : c.courseIds,
      })),
    }),
  ]);
  return { created: plan.create.length, archived: plan.archiveIds.length };
}

/** Regenera el resumen cruzado del estudiante si corresponde (una vez por día, con hechos nuevos, sin pisar lo editado). */
export async function refreshSummaryIfStale(studentId: string, now: Date = new Date()): Promise<boolean> {
  if (!(await studentConsents(studentId))) return false;
  const project = await db.folder.findFirst({ where: { studentId, kind: "PROJECT" } });
  if (!project) return false;
  const [summary, facts] = await Promise.all([
    db.folderContext.findFirst({ where: { folderId: project.id, layer: "SUMMARY", archivedAt: null }, orderBy: { createdAt: "desc" } }),
    db.folderContext.findMany({
      where: { folder: { studentId }, layer: "FACTS", archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { id: true, content: true, createdAt: true },
    }),
  ]);
  if (!summaryIsStale(summary, facts[0]?.createdAt ?? null, now)) return false;

  const profile = await db.studentProfile.findUnique({
    where: { userId: studentId },
    select: { career: true, studyYear: true, projectDescription: true, declaredCurrentContext: true, personalizationFocus: true },
  });
  const focus = profile ? focusText(profile) : { focus: "PROJECT" as const, text: null };
  const output = await generateStructured({
    operation: "context.summary",
    system: SUMMARY_SYSTEM,
    messages: [
      {
        role: "user",
        content: `PERFIL DECLARADO: carrera ${profile?.career ?? "—"}, año ${profile?.studyYear ?? "—"}, foco para ejemplos (${focus.focus === "WORK" ? "lo que hace hoy" : "proyecto personal"}): ${focus.text ?? "—"}\nHECHOS:\n${facts.map((f) => `- ${f.content}`).join("\n")}`,
      },
    ],
    schema: summarySchema,
    context: { actorUserId: studentId, studentId },
  });
  await db.$transaction([
    ...(summary ? [db.folderContext.update({ where: { id: summary.id }, data: { archivedAt: now } })] : []),
    db.folderContext.create({ data: { folderId: project.id, layer: "SUMMARY", content: output.summary, sourceIds: facts.map((f) => f.id) } }),
  ]);
  return true;
}

/** Lo que entra al prompt de una carpeta: resumen cruzado y hechos activos de esa carpeta. */
export async function contextForPrompt(folderId: string, studentId: string): Promise<string> {
  const [summary, facts, profile] = await Promise.all([
    db.folderContext.findFirst({ where: { folder: { studentId, kind: "PROJECT" }, layer: "SUMMARY", archivedAt: null }, orderBy: { createdAt: "desc" }, select: { content: true } }),
    db.folderContext.findMany({ where: { folderId, layer: "FACTS", archivedAt: null }, orderBy: { createdAt: "asc" }, take: 30, select: { content: true } }),
    db.studentProfile.findUnique({ where: { userId: studentId }, select: { personalizationFocus: true, declaredCurrentContext: true, projectDescription: true } }),
  ]);
  // El foco elegido manda sobre el resumen: es la única fuente de ejemplos.
  const focusLine = profile ? personalizationPrompt(profile) : "";
  if (!summary && facts.length === 0 && !focusLine) return "";
  return [
    "CONTEXTO DEL ESTUDIANTE (corregible por él; usalo para adaptar ejemplos, no lo cites como fuente):",
    focusLine,
    summary ? `Resumen: ${summary.content}` : "",
    facts.length ? `Hechos de esta carpeta:\n${facts.map((f) => `- ${f.content}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Contexto visible para el estudiante en una carpeta. */
export async function listFolderContext(viewer: Viewer, folderId: string) {
  const folder = await assertFolderOwner(viewer, folderId);
  const [summary, facts, trace] = await Promise.all([
    db.folderContext.findFirst({ where: { folder: { studentId: viewer.id, kind: "PROJECT" }, layer: "SUMMARY", archivedAt: null }, orderBy: { createdAt: "desc" } }),
    db.folderContext.findMany({ where: { folderId: folder.id, layer: "FACTS", archivedAt: null }, orderBy: { createdAt: "asc" } }),
    db.folderContext.findMany({ where: { folderId: folder.id, layer: "TRACE" }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  return { summary, facts, trace };
}

async function ownedEditable(viewer: Viewer, contextId: string) {
  if (viewer.role !== "STUDENT") throw new AccessDenied();
  const row = await db.folderContext.findFirst({ where: { id: contextId, folder: { studentId: viewer.id }, layer: { in: ["FACTS", "SUMMARY"] } } });
  if (!row) throw new AccessDenied();
  return row;
}

/** El estudiante corrige un hecho o el resumen: queda marcado y el proceso no lo vuelve a tocar. */
export async function editContextItem(viewer: Viewer, contextId: string, content: string) {
  const row = await ownedEditable(viewer, contextId);
  const text = content.trim().slice(0, 800);
  if (!text) throw new Error("El texto no puede quedar vacío.");
  return db.folderContext.update({ where: { id: row.id }, data: { content: text, editedByStudent: true } });
}

/** El estudiante borra un hecho o el resumen (el proceso automático nunca borra; el estudiante sí). */
export async function deleteContextItem(viewer: Viewer, contextId: string) {
  const row = await ownedEditable(viewer, contextId);
  await db.folderContext.delete({ where: { id: row.id } });
}
