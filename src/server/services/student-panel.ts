import "server-only";
import { cookies } from "next/headers";
import { CURRENT_COURSE_COOKIE, CURRENT_FOLDER_COOKIE } from "@/lib/constants";
import { TEXT } from "@/lib/texts";
import { assertFolderOwner, type Viewer } from "@/server/auth/guards";
import { db } from "@/server/db";
import { ensureStudentFolders } from "@/server/services/folders";

/**
 * Panel simple del estudiante (decisión de Tomás del 2026-11-16). Lee solo datos del propio
 * estudiante: cada consulta filtra por `viewer.id` y las carpetas pasan por `assertFolderOwner`.
 */

/** Una opción del selector de materia: una materia de la cátedra, una traída del LMS o el proyecto. */
export interface PanelOption {
  folderId: string;
  label: string;
  kind: "SUBJECT" | "PROJECT";
  courseId: string | null;
}

/**
 * Opciones del selector, en orden: materias de la cátedra en las que está inscripto, materias traídas
 * del LMS y, al final, "Mi proyecto". Una carpeta de una materia de la que lo quitaron no aparece.
 */
export async function getPanelOptions(viewer: Viewer): Promise<PanelOption[]> {
  if (viewer.role !== "STUDENT") return [];
  const read = () =>
    Promise.all([
      db.folder.findMany({
        where: { studentId: viewer.id },
        orderBy: [{ createdAt: "asc" }],
        select: { id: true, name: true, kind: true, courseId: true },
      }),
      db.enrollment.findMany({ where: { studentId: viewer.id, status: "ACTIVE" }, select: { courseId: true } }),
    ]);
  let [folders, enrollments] = await read();
  const missing =
    !folders.some((f) => f.kind === "PROJECT") || enrollments.some((e) => !folders.some((f) => f.kind === "SUBJECT" && f.courseId === e.courseId));
  if (missing) {
    await ensureStudentFolders(viewer.id);
    [folders, enrollments] = await read();
  }
  const enrolled = new Set(enrollments.map((e) => e.courseId));
  const subjects = folders.filter((f) => f.kind === "SUBJECT" && f.courseId && enrolled.has(f.courseId));
  const lms = folders.filter((f) => f.kind === "SUBJECT" && !f.courseId);
  const project = folders.filter((f) => f.kind === "PROJECT").slice(0, 1);
  return [
    ...subjects.map((f) => ({ folderId: f.id, label: f.name, kind: "SUBJECT" as const, courseId: f.courseId })),
    ...lms.map((f) => ({ folderId: f.id, label: f.name, kind: "SUBJECT" as const, courseId: null })),
    ...project.map((f) => ({ folderId: f.id, label: TEXT.student.selector.project, kind: "PROJECT" as const, courseId: null })),
  ];
}

/** Hay materia para conversar: una de la cátedra o una traída del LMS (el proyecto solo no alcanza). */
export function hasSubject(options: PanelOption[]): boolean {
  return options.some((o) => o.kind === "SUBJECT");
}

/**
 * Materia actual: la elegida en el selector (cookie) si sigue siendo una opción; si no, la carpeta
 * de la materia elegida antes con la cookie de curso; si no, la primera materia.
 */
export async function getCurrentOption(options: PanelOption[]): Promise<PanelOption | null> {
  if (options.length === 0) return null;
  const jar = await cookies();
  const folderId = jar.get(CURRENT_FOLDER_COOKIE)?.value;
  const courseId = jar.get(CURRENT_COURSE_COOKIE)?.value;
  return (
    options.find((o) => o.folderId === folderId) ??
    options.find((o) => o.courseId && o.courseId === courseId) ??
    options.find((o) => o.kind === "SUBJECT") ??
    options[0]
  );
}

/** Opciones y materia actual juntas, como las usan las tres pantallas del panel. */
export async function getPanelState(viewer: Viewer) {
  const options = await getPanelOptions(viewer);
  const current = hasSubject(options) ? await getCurrentOption(options) : null;
  return { options, current };
}

/** La charla abierta más reciente de una carpeta propia, con sus mensajes principales. */
export async function getActiveConversation(viewer: Viewer, folderId: string) {
  await assertFolderOwner(viewer, folderId);
  return db.aIConversation.findFirst({
    where: { folderId, studentId: viewer.id, origin: "CHAT", status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    include: { messages: { where: { threadId: null }, orderBy: { createdAt: "asc" } } },
  });
}

/** Texto de los fragmentos citados en unos mensajes, del material de la carpeta (cátedra o LMS). */
export async function citedChunks(folder: { folderId: string; courseId: string | null }, citations: unknown[]) {
  const ids = citations.flatMap((c) => (c as { items?: { chunkId: string }[] } | null)?.items?.map((i) => i.chunkId) ?? []);
  if (ids.length === 0) return new Map<string, string>();
  const scope = folder.courseId ? { courseId: folder.courseId } : { folderId: folder.folderId };
  const rows = await db.materialChunk.findMany({ where: { id: { in: ids }, ...scope }, select: { id: true, text: true } });
  return new Map(rows.map((r) => [r.id, r.text]));
}

/**
 * Temas aprobados de la materia actual, con el registro de avance del propio estudiante.
 * Una materia sin cátedra (LMS o proyecto) no tiene temas aprobados.
 */
export async function getPanelTopics(viewer: Viewer, option: PanelOption) {
  await assertFolderOwner(viewer, option.folderId);
  if (!option.courseId) return [];
  return db.curriculumItem.findMany({
    where: { courseId: option.courseId, status: "ACCEPTED", kind: "CONCEPT" },
    orderBy: { position: "asc" },
    select: {
      id: true,
      title: true,
      masteryRecords: { where: { studentId: viewer.id }, select: { score: true, attempts: true } },
    },
  });
}

/** Tareas publicadas por el docente de la materia actual (solo si el estudiante está inscripto). */
export async function getPanelTasks(viewer: Viewer, option: PanelOption) {
  if (!option.courseId) return [];
  const enrolled = await db.enrollment.findFirst({ where: { studentId: viewer.id, courseId: option.courseId, status: "ACTIVE" } });
  if (!enrolled) return [];
  return db.activity.findMany({
    where: { courseId: option.courseId, status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    select: { id: true, title: true },
  });
}

/**
 * ¿Se está analizando la última charla terminada de esta materia? Mientras tanto el chat avisa que
 * está mirando la charla y se actualiza solo hasta que aparecen las dudas.
 */
export async function isAnalyzingLastConversation(viewer: Viewer, folderId: string): Promise<boolean> {
  await assertFolderOwner(viewer, folderId);
  const last = await db.aIConversation.findFirst({
    where: { folderId, studentId: viewer.id, status: "CLOSED" },
    orderBy: { closedAt: "desc" },
    select: { experience: { select: { runs: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } } } } },
  });
  const status = last?.experience.runs[0]?.status;
  return status === "QUEUED" || status === "RUNNING";
}
