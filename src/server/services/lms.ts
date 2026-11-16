import "server-only";
import type { LmsProvider } from "@prisma/client";
import { looksLikeUrl, matchCourse, normalizeName, planImport } from "@/domain/lms";
import { isAIConfigured } from "@/server/ai";
import { AccessDenied, type Viewer } from "@/server/auth/guards";
import { db } from "@/server/db";
import { clientForConnection, createLmsClient, LmsError, normalizeBaseUrl, type LmsClient, type LmsCourse, type LmsItem } from "@/server/lms";
import { encryptSecret } from "@/server/lms/crypto";
import { MoodleClient } from "@/server/lms/moodle";
import { createCourseForTeacher } from "./courses";
import { canProposeFromMaterial, claimMaterialProposal } from "./curriculum";
import { ingestMaterial } from "./material";

/**
 * Conexión con el LMS e importación de materias, para docentes y estudiantes.
 *
 * - El docente importa a una cátedra suya: el material queda en la cátedra y lo usan sus estudiantes.
 * - El estudiante importa a una carpeta propia: el material solo lo ve él (nunca otro estudiante ni
 *   un docente), porque vive en la carpeta y no en una cátedra.
 * - La credencial se guarda cifrada y nunca vuelve a la pantalla.
 * - La IA no decide nada acá: el pedido ya llega interpretado y la materia se busca con código.
 */

export class LmsServiceError extends Error {}

export interface ConnectInput {
  provider: LmsProvider;
  baseUrl: string;
  /** token: token de acceso; cookie: cookie de sesión de Canvas; password: usuario y contraseña de Moodle (se cambian por un token). */
  authKind: "token" | "cookie" | "password";
  token?: string;
  username?: string;
  password?: string;
}

function assertRole(viewer: Viewer) {
  if (viewer.role !== "TEACHER" && viewer.role !== "STUDENT") throw new AccessDenied();
}

export async function getLmsConnection(viewer: Viewer) {
  assertRole(viewer);
  const [connection, extension] = await Promise.all([
    db.lmsConnection.findUnique({
      where: { userId: viewer.id },
      select: { provider: true, baseUrl: true, authKind: true, accountName: true, lastUsedAt: true, createdAt: true },
    }),
    db.lmsExtensionLink.findUnique({ where: { userId: viewer.id }, select: { keyHash: true, lastSyncAt: true } }),
  ]);
  if (!connection) return null;
  // La conexión la mantiene la extensión si está vinculada y ya mandó la sesión.
  return { ...connection, viaExtension: Boolean(extension?.keyHash && extension.lastSyncAt && connection.authKind === "cookie") };
}

/** Valida la credencial contra el LMS (pide el perfil) antes de guardarla. */
export async function connectLms(viewer: Viewer, input: ConnectInput, makeClient = createLmsClient): Promise<{ accountName: string }> {
  assertRole(viewer);
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  let credential: string;
  let authKind: "token" | "cookie" = "token";
  if (input.authKind === "password") {
    if (input.provider !== "MOODLE") throw new LmsServiceError("El ingreso con usuario y contraseña es solo para Moodle.");
    if (!input.username?.trim() || !input.password) throw new LmsServiceError("Completá usuario y contraseña.");
    credential = await MoodleClient.requestToken(baseUrl, input.username.trim(), input.password);
  } else {
    credential = input.token?.trim() ?? "";
    if (looksLikeUrl(credential)) {
      throw new LmsServiceError(
        "Eso es un link, no la credencial. Si es el link de mcp-siglo, en Educai usá la extensión del navegador (opción «Extensión del navegador») o pegá el valor de la cookie canvas_session.",
      );
    }
    if (credential.length < 8) throw new LmsServiceError(input.authKind === "cookie" ? "Pegá la cookie de sesión completa." : "Pegá el token de acceso completo.");
    if (input.authKind === "cookie") {
      if (input.provider !== "CANVAS") throw new LmsServiceError("La cookie de sesión es solo para Canvas.");
      authKind = "cookie";
    }
  }
  const client = makeClient({ provider: input.provider, baseUrl, credential, authKind });
  const me = await client.whoAmI();
  const data = { provider: input.provider, baseUrl, credential: encryptSecret(credential), authKind, accountName: me.name.slice(0, 160), lastUsedAt: new Date() };
  await db.lmsConnection.upsert({ where: { userId: viewer.id }, create: { userId: viewer.id, ...data }, update: data });
  return { accountName: me.name };
}

export async function disconnectLms(viewer: Viewer): Promise<void> {
  assertRole(viewer);
  await db.$transaction([db.lmsConnection.deleteMany({ where: { userId: viewer.id } }), db.lmsExtensionLink.deleteMany({ where: { userId: viewer.id } })]);
}

type ClientFactory = (connection: { provider: LmsProvider; baseUrl: string; credential: string; authKind: string; userAgent?: string | null }) => LmsClient;

async function clientFor(viewer: Viewer, factory: ClientFactory = clientForConnection): Promise<{ client: LmsClient; provider: LmsProvider } | null> {
  const connection = await db.lmsConnection.findUnique({ where: { userId: viewer.id } });
  if (!connection) return null;
  await db.lmsConnection.update({ where: { id: connection.id }, data: { lastUsedAt: new Date() } });
  return { client: factory(connection), provider: connection.provider };
}

export async function listLmsCourses(viewer: Viewer, factory?: ClientFactory): Promise<LmsCourse[] | null> {
  assertRole(viewer);
  const found = await clientFor(viewer, factory);
  return found ? found.client.listCourses() : null;
}

export type StartImportResult =
  | { kind: "no_connection" }
  | { kind: "not_found"; available: string[] }
  | { kind: "ambiguous"; candidates: string[] }
  | { kind: "teacher_course"; name: string; href: string }
  | { kind: "running"; importId: string; name: string; href: string }
  | { kind: "started"; importId: string; name: string; href: string; reused: boolean };

/** Una importación que lleva más de esto en RUNNING se cortó (el servidor se reinició o venció el tiempo). */
const STALE_MS = 15 * 60 * 1000;

function hrefFor(viewer: Viewer, target: { courseId: string | null; folderId: string | null }): string {
  return viewer.role === "TEACHER" ? `/t/courses/${target.courseId}/material` : `/s/folders/${target.folderId}`;
}

/**
 * Busca la materia en el LMS por nombre y deja lista la importación: crea la cátedra (docente) o la
 * carpeta (estudiante), o reutiliza la que ya tiene el mismo nombre. La descarga corre después con
 * runLmsImport, fuera del pedido.
 */
export async function startLmsImport(viewer: Viewer, courseName: string, factory?: ClientFactory): Promise<StartImportResult> {
  assertRole(viewer);
  const running = await db.lmsImport.findFirst({ where: { userId: viewer.id, status: "RUNNING" }, orderBy: { createdAt: "desc" } });
  if (running && Date.now() - running.createdAt.getTime() < STALE_MS) {
    return { kind: "running", importId: running.id, name: running.lmsCourseName, href: hrefFor(viewer, running) };
  }
  const found = await clientFor(viewer, factory);
  if (!found) return { kind: "no_connection" };
  const courses = await found.client.listCourses();
  const match = matchCourse(courseName, courses);
  if (match.kind === "not_found") return { kind: "not_found", available: courses.map((c) => c.name).slice(0, 30) };
  if (match.kind === "ambiguous") return { kind: "ambiguous", candidates: match.candidates.map((c) => c.name) };
  const lmsCourse = match.course;
  const name = lmsCourse.name.trim().slice(0, 160);
  const key = normalizeName(name);

  let target: { courseId: string | null; folderId: string | null };
  let reused = false;
  if (viewer.role === "TEACHER") {
    const own = await db.course.findMany({ where: { teacherId: viewer.id }, select: { id: true, name: true } });
    const existing = own.find((c) => normalizeName(c.name) === key);
    if (existing) {
      target = { courseId: existing.id, folderId: null };
      reused = true;
    } else {
      const profile = await db.teacherProfile.findUnique({ where: { userId: viewer.id } });
      if (!profile) throw new AccessDenied();
      const course = await createCourseForTeacher({ teacherId: viewer.id, institutionId: profile.institutionId, name, description: `Importada desde ${found.provider === "CANVAS" ? "Canvas" : "Moodle"}.` });
      if (!course) throw new LmsServiceError("No se pudo crear la materia. Probá de nuevo.");
      target = { courseId: course.id, folderId: null };
    }
  } else {
    const folders = await db.folder.findMany({ where: { studentId: viewer.id, kind: "SUBJECT" }, select: { id: true, name: true, courseId: true } });
    const existing = folders.find((f) => normalizeName(f.name) === key);
    if (existing?.courseId) {
      // La materia ya está en Educai con el material de su docente: no se mezcla con una copia propia.
      return { kind: "teacher_course", name: existing.name, href: `/s/folders/${existing.id}` };
    }
    if (existing) {
      target = { courseId: null, folderId: existing.id };
      reused = true;
    } else {
      const folder = await db.folder.create({ data: { studentId: viewer.id, kind: "SUBJECT", name, createdBy: "LMS" } });
      target = { courseId: null, folderId: folder.id };
    }
  }

  const job = await db.lmsImport.create({
    data: { userId: viewer.id, provider: found.provider, lmsCourseId: lmsCourse.id, lmsCourseName: name, ...target },
  });
  return { kind: "started", importId: job.id, name, href: hrefFor(viewer, target), reused };
}

const CONCURRENCY = 3;

/**
 * Baja los módulos y lecturas de la materia y los indexa como material, con archivo y página. Lo que
 * ya se había importado (misma dirección en el LMS) no se vuelve a bajar. Nunca tira: los errores
 * quedan en la importación.
 */
export async function runLmsImport(importId: string, factory?: ClientFactory): Promise<void> {
  const job = await db.lmsImport.findUnique({ where: { id: importId } });
  if (!job || job.status !== "RUNNING") return;
  try {
    const connection = await db.lmsConnection.findUnique({ where: { userId: job.userId } });
    if (!connection) throw new LmsError("La conexión con el LMS se borró antes de terminar.");
    const client = (factory ?? clientForConnection)(connection);
    const modules = await client.courseModules(job.lmsCourseId);
    const scope = job.courseId ? { courseId: job.courseId } : { folderId: job.folderId! };
    const already = new Set(
      (await db.material.findMany({ where: { ...scope, sourceUrl: { not: null }, status: "READY" }, select: { sourceUrl: true } })).map((m) => m.sourceUrl!),
    );
    const plan = planImport(modules.map((m) => ({ name: m.name, items: m.items.filter((i) => !already.has(i.key)) })));
    await db.lmsImport.update({ where: { id: job.id }, data: { total: plan.items.length, modules: plan.modules } });

    const queue: LmsItem[] = [...plan.items];
    const asText = { scanned_pdf: 0, no_pdf: 0 };
    const worker = async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        let ok = false;
        try {
          const file = await item.download();
          const result = await ingestMaterial({ ...scope, uploadedById: job.userId, fileName: file.fileName, mimeType: file.mimeType, data: file.data, module: item.module, sourceUrl: item.key });
          ok = result.status === "READY";
          if (ok && file.fallback && item.kind === "reading") asText[file.fallback]++;
          // Lo importado antes con otra clave (por ejemplo, la misma lectura como texto) se reemplaza.
          if (ok && item.replaces?.length) {
            await db.material.deleteMany({ where: { ...scope, sourceUrl: { in: item.replaces }, id: { not: result.id } } });
          }
        } catch (error) {
          // Solo el tipo de error: nunca el contenido ni la credencial.
          console.warn(JSON.stringify({ event: "lms.import.item_failed", importId: job.id, kind: error instanceof LmsError ? error.kind : "other" }));
        }
        await db.lmsImport.update({ where: { id: job.id }, data: ok ? { done: { increment: 1 } } : { failed: { increment: 1 } } });
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    const final = await db.lmsImport.findUniqueOrThrow({ where: { id: job.id } });
    const nothing = final.total === 0 && already.size === 0;
    const allFailed = final.total > 0 && final.done === 0;
    // En la cátedra de un docente sin programa cargado, la IA propone los temas con el material traído.
    // Corre en otro pedido (lo dispara el chat al ver la importación lista), con su propio tope de tiempo.
    const proposeTopics = !nothing && !allFailed && job.courseId && isAIConfigured() ? await canProposeFromMaterial(job.courseId, job.userId) : false;
    const notices = [readingsNotice(asText), proposeTopics ? CURRICULUM_NOTICE : null].filter(Boolean).join(" ");
    await db.lmsImport.update({
      where: { id: job.id },
      data: {
        status: nothing || allFailed ? "FAILED" : "DONE",
        // Con la importación terminada bien, `error` guarda los avisos (lecturas como texto, temas propuestos).
        error: nothing ? "La materia no tiene archivos ni lecturas que Educai pueda leer." : allFailed ? "No se pudo bajar ningún archivo de la materia." : notices || null,
        finishedAt: new Date(),
      },
    });
  } catch (error) {
    const message = error instanceof LmsError || error instanceof LmsServiceError ? error.message : "No se pudo completar la importación.";
    if (!(error instanceof LmsError)) console.error("[lms] importación fallida", error instanceof Error ? error.message : error);
    await db.lmsImport.update({ where: { id: job.id }, data: { status: "FAILED", error: message, finishedAt: new Date() } });
  }
}

const CURRICULUM_NOTICE =
  "Como la materia no tiene programa cargado, armo una propuesta de temas a partir de las lecturas: la vas a ver en «Currícula» en un minuto para revisarla y confirmarla.";

/**
 * Arranca la propuesta de temas de la cátedra de una importación propia ya terminada. Devuelve la
 * cátedra si quien llama tiene que correr la extracción; null si no corresponde o ya está en curso.
 */
export async function claimTopicsForImport(viewer: Viewer, importId: string): Promise<{ courseId: string } | null> {
  assertRole(viewer);
  if (viewer.role !== "TEACHER" || !isAIConfigured()) return null;
  const job = await db.lmsImport.findFirst({ where: { id: importId, userId: viewer.id, status: "DONE" }, select: { courseId: true } });
  if (!job?.courseId) return null;
  return (await claimMaterialProposal(job.courseId, viewer.id)) ? { courseId: job.courseId } : null;
}

/**
 * Aviso para cuando alguna lectura entró como texto: ahí la IA cita secciones del texto ("sección 3"),
 * no páginas del PDF que ve el estudiante.
 */
export function readingsNotice(asText: { scanned_pdf: number; no_pdf: number }): string | null {
  const total = asText.scanned_pdf + asText.no_pdf;
  if (total === 0) return null;
  const which = total === 1 ? "1 lectura entró" : `${total} lecturas entraron`;
  const why =
    asText.no_pdf === 0
      ? total === 1 ? "porque su PDF es una imagen escaneada" : "porque sus PDF son imágenes escaneadas"
      : asText.scanned_pdf === 0
        ? total === 1 ? "porque no tiene PDF para bajar" : "porque no tienen PDF para bajar"
        : "porque no tienen PDF o es escaneado";
  return `${which} como texto ${why}: en esas, la IA cita secciones del texto en vez de páginas del PDF.`;
}

export interface ImportStatus {
  id: string;
  name: string;
  status: "RUNNING" | "DONE" | "FAILED";
  total: number;
  done: number;
  failed: number;
  modules: number;
  error: string | null;
  /** Aviso de una importación terminada (por ejemplo, lecturas que entraron como texto). */
  note: string | null;
  /** La cátedra no tiene temas: el chat tiene que pedir la propuesta (`proposeTopicsAction`). */
  proposeTopics: boolean;
  href: string;
}

/** Estado de una importación propia. La de otro usuario no existe para quien pregunta. */
export async function getLmsImportStatus(viewer: Viewer, importId: string): Promise<ImportStatus> {
  assertRole(viewer);
  const job = await db.lmsImport.findFirst({ where: { id: importId, userId: viewer.id } });
  if (!job) throw new AccessDenied();
  let { status, error } = job;
  if (status === "RUNNING" && Date.now() - job.createdAt.getTime() > STALE_MS) {
    status = "FAILED";
    error = "La importación se interrumpió. Pedímela de nuevo y sigo desde donde quedó.";
    await db.lmsImport.update({ where: { id: job.id }, data: { status, error, finishedAt: new Date() } });
  }
  const note = status === "DONE" ? error : null;
  const proposeTopics = status === "DONE" && viewer.role === "TEACHER" && !!job.courseId && isAIConfigured() && (await canProposeFromMaterial(job.courseId, viewer.id));
  return { id: job.id, name: job.lmsCourseName, status, total: job.total, done: job.done, failed: job.failed, modules: job.modules, error: status === "DONE" ? null : error, note, proposeTopics, href: hrefFor(viewer, job) };
}
