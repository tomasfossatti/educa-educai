import "server-only";
import { embeddedReadings, htmlToText, materialFileName } from "@/domain/lms";
import { allowInsecure, LmsError, lmsFetch, readLimited, statusError } from "./net";
import { downloadReading, readingHosts } from "./readings";
import { MAX_ITEM_BYTES, readableExtension, textItem, type LmsClient, type LmsCourse, type LmsItem, type LmsModule } from "./types";

/**
 * Cliente de Canvas LMS, portado de mcp-siglo (src/canvas-client.ts) a fetch. Se autentica con un
 * token de acceso o con la cookie de sesión del navegador (cuando la universidad no deja crear tokens).
 * Solo lee: perfil, materias, módulos, páginas y archivos.
 */
interface CanvasModuleItem {
  id: number | string;
  title: string;
  type: string;
  content_id?: number | string;
  page_url?: string;
  url?: string;
}

interface CanvasFile {
  id: number | string;
  display_name?: string;
  filename?: string;
  url?: string;
  "content-type"?: string;
  size?: number;
}

const MAX_PAGES_SCANNED = 40;
const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const MIN_PAGE_TEXT = 200;
const FILE_LINK = /\/(?:courses\/\d+\/)?files\/(\d+)(?:\/download|\/preview|\b)/gi;

export class CanvasClient implements LmsClient {
  readonly provider = "CANVAS" as const;
  private readonly headers: Record<string, string>;

  constructor(
    private readonly baseUrl: string,
    credential: string,
    authKind: "token" | "cookie" = "token",
    userAgent?: string | null,
  ) {
    // Con la cookie de sesión se usa el mismo navegador del que salió, como hace la extensión de mcp-siglo:
    // Canvas puede rechazar una sesión que llega desde otro agente.
    const agent = userAgent?.trim().slice(0, 400) || (authKind === "cookie" ? BROWSER_UA : "Educai (lectura de material)");
    this.headers = { accept: "application/json", "user-agent": agent };
    if (authKind === "cookie") {
      // Si se pegó solo el valor de la cookie, se le pone el nombre que usa Canvas.
      const cookie = credential.replace(/^cookie:\s*/i, "").trim();
      this.headers.cookie = cookie.includes("=") ? cookie : `canvas_session=${cookie}`;
      const csrf = this.headers.cookie.match(/(?:^|;\s*)_csrf_token=([^;]+)/)?.[1];
      if (csrf) this.headers["x-csrf-token"] = safeDecode(csrf);
    } else {
      this.headers.authorization = `Bearer ${credential}`;
    }
  }

  private url(path: string): string {
    return path.startsWith("http") ? path : `${this.baseUrl}${path}`;
  }

  private async getJson<T>(path: string, what: string): Promise<{ data: T; next: string | null }> {
    const response = await lmsFetch(this.url(path), { headers: this.headers });
    if (!response.ok) throw statusError(response.status, what);
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("json")) throw new LmsError("El LMS no respondió como Canvas: revisá la dirección.", "other");
    const text = await response.text();
    // Canvas puede anteponer "while(1);" para evitar JSON hijacking.
    const data = JSON.parse(text.replace(/^while\(1\);/, "")) as T;
    const next = /<([^>]+)>;\s*rel="next"/.exec(response.headers.get("link") ?? "")?.[1] ?? null;
    // La paginación solo se sigue dentro del mismo Canvas.
    return { data, next: next && new URL(next).host === new URL(this.baseUrl).host ? next : null };
  }

  private async getAll<T>(path: string, what: string, maxPages = 10): Promise<T[]> {
    const out: T[] = [];
    let next: string | null = path;
    for (let i = 0; next && i < maxPages; i++) {
      const page: { data: T[]; next: string | null } = await this.getJson<T[]>(next, what);
      if (Array.isArray(page.data)) out.push(...page.data);
      next = page.next;
    }
    return out;
  }

  async whoAmI(): Promise<{ name: string }> {
    const { data } = await this.getJson<{ name?: string; short_name?: string }>("/api/v1/users/self/profile", "tu perfil");
    return { name: data.name ?? data.short_name ?? "tu cuenta" };
  }

  async listCourses(): Promise<LmsCourse[]> {
    const courses = await this.getAll<{ id: number | string; name?: string; course_code?: string; workflow_state?: string; term?: { name?: string } }>(
      "/api/v1/courses?per_page=100&include[]=term",
      "tus materias",
    );
    return courses
      .filter((c) => c.name && c.workflow_state !== "deleted")
      .map((c) => ({ id: String(c.id), name: c.name!, code: c.course_code ?? null, term: c.term?.name ?? null }));
  }

  private async pageBody(courseId: string, slug: string): Promise<string> {
    const { data } = await this.getJson<{ body?: string; title?: string }>(`/api/v1/courses/${courseId}/pages/${encodeURIComponent(slug)}`, "la página");
    return String(data.body ?? "");
  }

  private fileItem(module: string, fileId: string, fallbackTitle: string): LmsItem {
    return {
      module,
      title: fallbackTitle,
      kind: "file",
      key: `canvas-file:${fileId}`,
      download: async () => {
        const { data: meta } = await this.getJson<CanvasFile>(`/api/v1/files/${fileId}`, "el archivo");
        const name = meta.display_name ?? meta.filename ?? fallbackTitle;
        const ext = readableExtension(meta["content-type"], meta.filename ?? name);
        if (!ext) throw new LmsError(`"${name}" no es un formato que Educai pueda leer.`, "other");
        if ((meta.size ?? 0) > MAX_ITEM_BYTES) throw new LmsError(`"${name}" supera los 20 MB.`, "too_large");
        const response = await lmsFetch(meta.url ?? this.url(`/files/${fileId}/download?download_frd=1`), { headers: this.headers, timeoutMs: 60_000 });
        if (!response.ok) throw statusError(response.status, `"${name}"`);
        const title = name.replace(/\.[a-z0-9]+$/i, "");
        return { data: await readLimited(response, MAX_ITEM_BYTES), fileName: materialFileName(module, title, ext), mimeType: meta["content-type"] ?? "" };
      },
    };
  }

  async courseModules(courseId: string): Promise<LmsModule[]> {
    type RawModule = { id: number | string; name: string; items?: CanvasModuleItem[] };
    let raw: RawModule[];
    try {
      raw = await this.getAll<RawModule>(`/api/v1/courses/${courseId}/modules?include[]=items&per_page=100`, "los módulos de la materia");
    } catch (error) {
      // Algunas cátedras ocultan los módulos: se sigue con la página "modulos".
      if (error instanceof LmsError && (error.kind === "not_found" || error.message.includes("no te deja"))) raw = [];
      else throw error;
    }
    const modules: LmsModule[] = raw.map((m) => ({ name: m.name, items: [] }));
    const byReadingModule = new Map<number, LmsItem[]>();
    const hosts = readingHosts();
    const allowHttp = allowInsecure();
    let scanned = 0;

    const scanPage = async (moduleName: string, slug: string, title: string, target: LmsItem[]) => {
      if (scanned >= MAX_PAGES_SCANNED) return;
      scanned++;
      let body: string;
      try {
        body = await this.pageBody(courseId, slug);
      } catch {
        return;
      }
      // Formato Siglo 21: lecturas incrustadas por módulo ("lectura2m1").
      const readings = embeddedReadings(body, hosts, allowHttp);
      for (const r of readings) {
        const list = byReadingModule.get(r.module) ?? [];
        const moduleLabel = `Módulo ${r.module}`;
        const readingTitle = `Lectura ${r.reading}`;
        list.push({
          module: moduleLabel,
          title: readingTitle,
          kind: "reading",
          // "reading2": desde que se prefiere el PDF de la lectura y se usa su título. Reemplaza lo
          // importado con la clave anterior, que podía haber entrado como texto sin título.
          key: `reading2:${r.url}`,
          replaces: [`reading:${r.url}`],
          download: () => downloadReading(r.url, moduleLabel, readingTitle),
        });
        byReadingModule.set(r.module, list);
      }
      for (const m of body.matchAll(FILE_LINK)) target.push(this.fileItem(moduleName, m[1], `Archivo ${m[1]}`));
      if (readings.length === 0) {
        const text = htmlToText(body);
        if (text.length >= MIN_PAGE_TEXT) {
          target.push({
            module: moduleName,
            title,
            kind: "page",
            key: `canvas-page:${slug}`,
            download: async () => textItem(title, text, materialFileName(moduleName, title, ".txt")),
          });
        }
      }
    };

    for (let i = 0; i < raw.length; i++) {
      const target = modules[i].items;
      for (const item of raw[i].items ?? []) {
        if (item.type === "File" && item.content_id != null) target.push(this.fileItem(raw[i].name, String(item.content_id), item.title));
        else if (item.type === "Page" && item.page_url) await scanPage(raw[i].name, item.page_url, item.title, target);
      }
    }
    // Siglo 21 publica las lecturas en la página "modulos" aunque no figure en los módulos.
    if (byReadingModule.size === 0) {
      const extra: LmsItem[] = [];
      await scanPage("Material", "modulos", "Módulos", extra);
      if (extra.length && byReadingModule.size === 0) modules.push({ name: "Material", items: extra });
    }
    const readingModules = [...byReadingModule.entries()].sort((a, b) => a[0] - b[0]).map(([n, items]) => ({ name: `Módulo ${n}`, items }));
    return [...readingModules, ...modules.filter((m) => m.items.length > 0)];
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
