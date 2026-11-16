/**
 * Lógica pura de la importación desde el LMS: interpretar el pedido del chat, encontrar la materia
 * por nombre, convertir HTML a texto y ordenar lo que se descarga. Sin red ni base de datos.
 */

export type LmsCommand =
  | { action: "create_subject"; courseName: string }
  | { action: "list_courses" }
  | { action: "none" };

/** Minúsculas, sin tildes ni signos, espacios simples. */
export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const QUOTED = /[«"“'‘]([^»"”'’]{2,160})[»"”'’]/;
// Límites de palabra que entienden tildes (\b no las considera letras).
const CREATE_VERB = /(?<!\p{L})(cre[aá]r?|arm[aá]r?|import[aá]r?|tra[eé]r?|baj[aá]r?|descarg[aá]r?|sum[aá]r?|agreg[aá]r?|carg[aá]r?)(me|la|lo)?(?!\p{L})/iu;
const LIST =
  /(?<!\p{L})(qu[eé]|cu[aá]les)(?!\p{L}).*(?<!\p{L})materias(?!\p{L})|(?<!\p{L})(list[aá]|mostr[aá]|ver|decime)(me)?(?!\p{L}).*(?<!\p{L})materias(?!\p{L})|(?<!\p{L})materias (tengo|hay)(?!\p{L})/iu;

/**
 * Reconoce sin IA los pedidos más comunes: "creá la materia «Costos de proyectos»",
 * "importá Costos de proyectos desde Canvas", "qué materias tengo en el LMS".
 */
export function parseLmsCommand(message: string): LmsCommand {
  const text = message.trim().replace(/\s+/g, " ");
  if (!text) return { action: "none" };
  const verb = CREATE_VERB.exec(text);
  if (verb) {
    const quoted = QUOTED.exec(text);
    if (quoted) return { action: "create_subject", courseName: quoted[1].trim() };
    const after = text.slice(verb.index + verb[0].length);
    const match = /^\s*(?:(?:la|una|el|mi|nueva)\s+)*(?:materia|asignatura|curso|c[aá]tedra)\s*(?:de|llamada|que se llama|:)?\s+(.{2,160}?)\s*(?:(?:desde|del|de mi|en)\s+(?:el\s+)?(?:lms|canvas|moodle|campus|aula virtual)(?!\p{L}).*)?[.!?]*$/iu.exec(after);
    if (match && match[1]) return { action: "create_subject", courseName: match[1].trim() };
  }
  if (LIST.test(text)) return { action: "list_courses" };
  return { action: "none" };
}

export interface NamedCourse {
  id: string;
  name: string;
  code?: string | null;
}

export type CourseMatch<T extends NamedCourse> =
  | { kind: "found"; course: T }
  | { kind: "ambiguous"; candidates: T[] }
  | { kind: "not_found" };

function score(query: string, course: NamedCourse): number {
  const q = normalizeName(query);
  const name = normalizeName(course.name);
  const code = normalizeName(course.code ?? "");
  if (!q) return 0;
  if (name === q || (code && code === q)) return 100;
  if (name.startsWith(q) || name.includes(` ${q}`) || name.includes(q)) return 80;
  const words = q.split(" ").filter((w) => w.length > 2);
  if (words.length === 0) return 0;
  const nameWords = new Set(name.split(" "));
  const hits = words.filter((w) => nameWords.has(w) || [...nameWords].some((n) => n.startsWith(w) || w.startsWith(n) && n.length > 3)).length;
  return Math.round((hits / words.length) * 60);
}

/**
 * Busca la materia del LMS que corresponde al nombre pedido. Si hay una coincidencia exacta o una
 * sola razonable, la devuelve; si hay varias parecidas, las devuelve para que la persona elija.
 */
export function matchCourse<T extends NamedCourse>(query: string, courses: T[]): CourseMatch<T> {
  const ranked = courses
    .map((course) => ({ course, s: score(query, course) }))
    .filter((r) => r.s >= 40)
    .sort((a, b) => b.s - a.s);
  if (ranked.length === 0) return { kind: "not_found" };
  const best = ranked[0];
  const tied = ranked.filter((r) => r.s === best.s);
  if (best.s === 100 && tied.length === 1) return { kind: "found", course: best.course };
  if (tied.length === 1 && (ranked.length === 1 || best.s - ranked[1].s >= 20)) return { kind: "found", course: best.course };
  return { kind: "ambiguous", candidates: ranked.slice(0, 5).map((r) => r.course) };
}

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&aacute;": "á",
  "&eacute;": "é",
  "&iacute;": "í",
  "&oacute;": "ó",
  "&uacute;": "ú",
  "&ntilde;": "ñ",
  "&Aacute;": "Á",
  "&Eacute;": "É",
  "&Iacute;": "Í",
  "&Oacute;": "Ó",
  "&Uacute;": "Ú",
  "&Ntilde;": "Ñ",
  "&uuml;": "ü",
  "&iquest;": "¿",
  "&iexcl;": "¡",
};

/** Texto legible de una página HTML del LMS, con un salto por párrafo, título o ítem. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|head)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>|<\/(p|div|h\d|li|tr|section|article|blockquote)>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-zA-Z]+;|&#39;/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Lecturas incrustadas en una página del curso con el formato de Siglo 21: cada lectura vive en un
 * elemento id="lectura{N}m{M}" con un iframe hacia el visor de lecturas. Devuelve módulo, lectura y
 * dirección de cada una, en orden. Portado de mcp-siglo (src/lecturas.ts).
 */
export function embeddedReadings(pageBody: string, allowedHosts: string[], allowHttp = false): { module: number; reading: number; url: string }[] {
  const marks = [...pageBody.matchAll(/id="lectura(\d+)m(\d+)"/gi)].map((m) => ({
    key: m[0].toLowerCase(),
    reading: Number(m[1]),
    module: Number(m[2]),
    at: m.index ?? 0,
  }));
  const seen = new Set<string>();
  const out: { module: number; reading: number; url: string }[] = [];
  for (let k = 0; k < marks.length; k++) {
    const mark = marks[k];
    if (seen.has(mark.key)) continue;
    const next = marks.slice(k + 1).find((x) => x.key !== mark.key);
    const span = pageBody.slice(mark.at, next ? next.at : mark.at + 20_000);
    for (const m of span.matchAll(/<iframe\b[^>]*\bsrc="([^"]+)"/gi)) {
      try {
        const u = new URL(m[1].replace(/&amp;/g, "&"));
        if ((u.protocol === "https:" || (allowHttp && u.protocol === "http:")) && allowedHosts.includes(u.hostname)) {
          out.push({ module: mark.module, reading: mark.reading, url: u.origin + u.pathname });
          seen.add(mark.key);
          break;
        }
      } catch {
        // dirección inválida: se ignora
      }
    }
  }
  return out.sort((a, b) => a.module - b.module || a.reading - b.reading);
}

export type LmsItemKind = "file" | "page" | "reading";

export interface PlannedItem {
  module: string;
  title: string;
  kind: LmsItemKind;
  /** Para deduplicar: no se baja dos veces la misma dirección. */
  key: string;
}

export const MAX_IMPORT_ITEMS = 80;

/**
 * Ordena lo que se va a bajar: módulo por módulo, sin repetidos y con un tope. Los tipos que no
 * se pueden leer (enlaces sueltos, foros, tareas) ya vienen filtrados por el cliente del LMS.
 */
export function planImport<T extends PlannedItem>(modules: { name: string; items: T[] }[], max = MAX_IMPORT_ITEMS): { items: T[]; modules: number; skipped: number } {
  const seen = new Set<string>();
  const items: T[] = [];
  let skipped = 0;
  let withContent = 0;
  for (const mod of modules) {
    let counted = false;
    for (const item of mod.items) {
      if (seen.has(item.key)) continue;
      seen.add(item.key);
      if (items.length >= max) {
        skipped++;
        continue;
      }
      items.push(item);
      if (!counted) {
        withContent++;
        counted = true;
      }
    }
  }
  return { items, modules: withContent, skipped };
}

/** Nombre del archivo en Educai: "Módulo 1 · Lectura 2 - Costos fijos.pdf". */
export function materialFileName(module: string, title: string, extension: string): string {
  const clean = (s: string) => s.replace(/[\\/:*?"<>|\n\r\t]+/g, " ").replace(/\s+/g, " ").trim();
  const base = `${clean(module)} · ${clean(title)}`.slice(0, 180);
  const ext = extension.startsWith(".") ? extension : `.${extension}`;
  return base.toLowerCase().endsWith(ext.toLowerCase()) ? base : `${base}${ext}`;
}

/** Texto de un bloque de una lectura interactiva (Articulate Rise), recorriendo los hijos. */
function riseBlocksText(blocks: unknown): string[] {
  if (!Array.isArray(blocks)) return [];
  const lines: string[] = [];
  const clean = (v: unknown) => (typeof v === "string" ? htmlToText(v) : "");
  for (const raw of blocks) {
    if (!raw || typeof raw !== "object") continue;
    const block = raw as Record<string, unknown>;
    const heading = clean(block.heading ?? block.title);
    if (heading) lines.push(heading);
    const body = clean(block.text ?? block.paragraph ?? block.body ?? block.description);
    if (body) lines.push(body);
    if (Array.isArray(block.items)) {
      for (const item of block.items) {
        if (typeof item === "string") lines.push(`- ${clean(item)}`);
        else if (item && typeof item === "object") lines.push(...riseBlocksText([item]));
      }
    }
    if (Array.isArray(block.children)) lines.push(...riseBlocksText(block.children));
  }
  return lines.filter(Boolean);
}

/**
 * Contenido de una lectura interactiva hecha con Articulate Rise: el HTML trae los datos del curso en
 * base64 (courseData). Devuelve el título, el texto por lección y los adjuntos (el PDF de "Descarga en
 * PDF", si está). Portado de mcp-siglo (src/meca-parser.ts).
 */
export function parseRiseCourse(html: string, pageUrl: string): { title: string; text: string; attachments: string[] } | null {
  const match = html.match(/courseData\s*=\s*["']([A-Za-z0-9+/=]+)["']/);
  if (!match) return null;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(Buffer.from(match[1], "base64").toString("utf8"));
  } catch {
    return null;
  }
  const title = typeof data.title === "string" ? data.title : "Lectura";
  const parts: string[] = [title];
  const attachments: string[] = [];
  const lessons = Array.isArray(data.lessons) ? data.lessons : [];
  for (const raw of lessons) {
    if (!raw || typeof raw !== "object") continue;
    const lesson = raw as Record<string, unknown>;
    if (typeof lesson.title === "string") parts.push(lesson.title);
    const media = (lesson.media ?? {}) as Record<string, unknown>;
    const attachment = (media.attachment ?? media.download ?? lesson.attachment) as Record<string, unknown> | undefined;
    const ref = attachment && [attachment.originalUrl, attachment.key, attachment.url, attachment.filename].find((v) => typeof v === "string" && v);
    if (typeof ref === "string") {
      try {
        attachments.push(new URL(ref, pageUrl).href);
      } catch {
        // referencia inválida: se ignora
      }
    }
    parts.push(...riseBlocksText(lesson.items ?? lesson.sections));
  }
  return { title, text: parts.join("\n\n").trim(), attachments };
}

/**
 * Código de vinculación de la extensión: "educai1." + base64url de {s: origen de Educai, c: Canvas,
 * k: secreto}. Lleva los dos orígenes para que la extensión pida permiso sobre esos dos sitios, y
 * solo esos, antes de hacer cualquier pedido. La extensión lo decodifica igual (extension/codigo.js).
 */
export interface ExtensionCode {
  server: string;
  canvas: string;
  secret: string;
}

const CODE_PREFIX = "educai1.";

export function encodeExtensionCode(code: ExtensionCode): string {
  const json = JSON.stringify({ s: code.server, c: code.canvas, k: code.secret });
  return CODE_PREFIX + Buffer.from(json, "utf8").toString("base64url");
}

export function decodeExtensionCode(raw: string): ExtensionCode | null {
  const text = raw.trim();
  if (!text.startsWith(CODE_PREFIX)) return null;
  try {
    const data = JSON.parse(Buffer.from(text.slice(CODE_PREFIX.length), "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof data.s !== "string" || typeof data.c !== "string" || typeof data.k !== "string") return null;
    const server = new URL(data.s);
    const canvas = new URL(data.c);
    const local = (u: URL) => u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
    if ((server.protocol !== "https:" && !local(server)) || (canvas.protocol !== "https:" && !local(canvas))) return null;
    if (data.k.length < 20) return null;
    return { server: server.origin, canvas: `${canvas.origin}${canvas.pathname.replace(/\/+$/, "")}`, secret: data.k };
  } catch {
    return null;
  }
}

/** Lo que alguien puede pegar por error en vez de la cookie: un link (por ejemplo, el de mcp-siglo). */
export function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}
