import "server-only";
import { htmlToText, materialFileName } from "@/domain/lms";
import { LmsError, lmsFetch, readLimited, statusError } from "./net";
import { MAX_ITEM_BYTES, readableExtension, textItem, type LmsClient, type LmsCourse, type LmsItem, type LmsModule } from "./types";

/**
 * Cliente de Moodle por sus servicios web (el mismo que usa la app móvil). Se autentica con un token;
 * el token se puede pedir con usuario y contraseña (login/token.php), que no se guardan. Solo lee.
 */
interface MoodleContent {
  type: string;
  filename?: string;
  fileurl?: string;
  mimetype?: string;
  filesize?: number;
}

interface MoodleModule {
  id: number;
  name: string;
  modname: string;
  contents?: MoodleContent[];
}

export class MoodleClient implements LmsClient {
  readonly provider = "MOODLE" as const;
  private userId: number | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  /** Pide un token con usuario y contraseña. La contraseña no se guarda en ningún lado. */
  static async requestToken(baseUrl: string, username: string, password: string): Promise<string> {
    const body = new URLSearchParams({ username, password, service: "moodle_mobile_app" });
    const response = await lmsFetch(`${baseUrl}/login/token.php?${body.toString()}`, { headers: { accept: "application/json" } });
    if (!response.ok) throw statusError(response.status, "el acceso");
    const data = (await response.json().catch(() => ({}))) as { token?: string; error?: string };
    if (!data.token) throw new LmsError(data.error ? `Moodle no aceptó el ingreso: ${data.error}` : "Moodle no devolvió un token.", "auth");
    return data.token;
  }

  private async call<T>(fn: string, params: Record<string, string> = {}, what = "los datos"): Promise<T> {
    const query = new URLSearchParams({ wstoken: this.token, moodlewsrestformat: "json", wsfunction: fn, ...params });
    const response = await lmsFetch(`${this.baseUrl}/webservice/rest/server.php?${query.toString()}`, { headers: { accept: "application/json" } });
    if (!response.ok) throw statusError(response.status, what);
    const data = (await response.json().catch(() => null)) as (T & { exception?: string; errorcode?: string; message?: string }) | null;
    if (!data) throw new LmsError("El LMS no respondió como Moodle: revisá la dirección.", "other");
    if (typeof data === "object" && !Array.isArray(data) && data.exception) {
      const auth = data.errorcode === "invalidtoken" || data.errorcode === "accessexception";
      throw new LmsError(auth ? "Moodle rechazó el token: puede haber vencido. Volvé a conectarlo." : `Moodle no pudo darnos ${what}.`, auth ? "auth" : "other");
    }
    return data;
  }

  async whoAmI(): Promise<{ name: string }> {
    const info = await this.call<{ fullname?: string; userid?: number }>("core_webservice_get_site_info", {}, "tu perfil");
    this.userId = info.userid ?? null;
    return { name: info.fullname ?? "tu cuenta" };
  }

  async listCourses(): Promise<LmsCourse[]> {
    if (this.userId == null) await this.whoAmI();
    const courses = await this.call<{ id: number; fullname?: string; shortname?: string }[]>("core_enrol_get_users_courses", { userid: String(this.userId) }, "tus materias");
    return courses.filter((c) => c.fullname).map((c) => ({ id: String(c.id), name: c.fullname!, code: c.shortname ?? null, term: null }));
  }

  private fileItem(module: string, mod: MoodleModule, content: MoodleContent, ext: string): LmsItem {
    const title = mod.name || (content.filename ?? "Archivo").replace(/\.[a-z0-9]+$/i, "");
    return {
      module,
      title,
      kind: "file",
      key: `moodle-file:${content.fileurl}`,
      download: async () => {
        if ((content.filesize ?? 0) > MAX_ITEM_BYTES) throw new LmsError(`"${title}" supera los 20 MB.`, "too_large");
        const url = new URL(content.fileurl!);
        url.searchParams.set("token", this.token);
        const response = await lmsFetch(url.toString(), { timeoutMs: 60_000 });
        if (!response.ok) throw statusError(response.status, `"${title}"`);
        return { data: await readLimited(response, MAX_ITEM_BYTES), fileName: materialFileName(module, title, ext), mimeType: content.mimetype ?? "" };
      },
    };
  }

  async courseModules(courseId: string): Promise<LmsModule[]> {
    const sections = await this.call<{ name: string; modules?: MoodleModule[] }[]>("core_course_get_contents", { courseid: courseId }, "los módulos de la materia");
    return sections
      .map((section, index) => {
        const name = section.name?.trim() || `Sección ${index}`;
        const items: LmsItem[] = [];
        for (const mod of section.modules ?? []) {
          const files = (mod.contents ?? []).filter((c) => c.type === "file" && c.fileurl);
          if (mod.modname === "page") {
            const index = files.find((c) => /\.html?$/i.test(c.filename ?? ""));
            if (!index) continue;
            items.push({
              module: name,
              title: mod.name,
              kind: "page",
              key: `moodle-page:${mod.id}`,
              download: async () => {
                const url = new URL(index.fileurl!);
                url.searchParams.set("token", this.token);
                const response = await lmsFetch(url.toString());
                if (!response.ok) throw statusError(response.status, `"${mod.name}"`);
                const text = htmlToText(new TextDecoder().decode(await readLimited(response, MAX_ITEM_BYTES)));
                return textItem(mod.name, text, materialFileName(name, mod.name, ".txt"));
              },
            });
          } else if (mod.modname === "resource" || mod.modname === "folder") {
            for (const content of files) {
              const ext = readableExtension(content.mimetype, content.filename ?? "");
              if (ext) items.push(this.fileItem(name, mod.modname === "folder" ? { ...mod, name: (content.filename ?? mod.name).replace(/\.[a-z0-9]+$/i, "") } : mod, content, ext));
            }
          }
        }
        return { name, items };
      })
      .filter((m) => m.items.length > 0);
  }
}
