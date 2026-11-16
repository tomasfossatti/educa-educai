/**
 * LMS de mentira para los tests: responde como Canvas y como Moodle, solo lo que Educai pide, con
 * datos sintéticos. "Costos de Proyectos" tiene 4 módulos con 4 lecturas cada uno (15 PDF y una
 * página). "Estrategia y Validación de Negocios" usa el formato de Siglo 21 (lecturas incrustadas en
 * la página "modulos"). Cada persona se reconoce por su token y ve solo sus materias.
 *
 * Las descargas de archivos redirigen a 127.0.0.1 (otro servidor, como un bucket de S3), que rechaza
 * cualquier pedido que traiga la credencial: así se prueba que no se filtra al redirigir.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { makePdf } from "./documents";

export const FAKE_TOKENS = { teacher: "canvas-token-docente-sintetico", student: "canvas-token-estudiante-sintetico" } as const;
export const MOODLE_USER = { username: "estudiante.sintetico", password: "clave-sintetica-123", token: "moodle-token-sintetico" } as const;

const TOPICS = [
  ["Fundamentos de costos", ["Qué es un costo", "Costos fijos y variables", "Costos directos e indirectos", "Punto de equilibrio"]],
  ["Estimación de costos", ["Estimación análoga", "Estimación paramétrica", "Estimación ascendente", "Reservas de contingencia"]],
  ["Presupuesto del proyecto", ["Línea base de costos", "Curva S", "Flujo de fondos", "Aprobación del presupuesto"]],
  ["Control de costos", ["Valor ganado", "Índices CPI y SPI", "Pronósticos EAC", "Lecciones aprendidas"]],
] as const;

interface FakeFile {
  id: number;
  name: string;
  data: Uint8Array;
  mime: string;
}

const files = new Map<number, FakeFile>();
let nextFile = 5000;
function addFile(name: string, text: string): number {
  const id = nextFile++;
  files.set(id, { id, name, data: makePdf([text, `${text} (continuación). Fuente sintética para pruebas.`]), mime: "application/pdf" });
  return id;
}

const PAGE_TEXT = (title: string) =>
  `<h2>${title}</h2><p>Las lecciones aprendidas registran qué funcionó y qué no en el control de costos del proyecto. ` +
  `Se documentan al cierre de cada fase, con las desviaciones del presupuesto, sus causas y las acciones correctivas que se tomaron. ` +
  `Sirven para estimar mejor en el próximo proyecto. Texto sintético para pruebas.</p>`;

// Materia 101: 4 módulos × 4 lecturas. El módulo 4 trae una página en vez del último PDF, un enlace externo
// que se ignora y un archivo repetido que no se baja dos veces.
const COURSE_101 = TOPICS.map(([name, readings], m) => {
  const items: { id: number; title: string; type: string; content_id?: number; page_url?: string; external_url?: string }[] = [];
  readings.forEach((title, r) => {
    if (m === 3 && r === 3) items.push({ id: 900 + m * 10 + r, title, type: "Page", page_url: "lecciones-aprendidas" });
    else {
      const fileId = addFile(`${title}.pdf`, `Módulo ${m + 1}, lectura ${r + 1}: ${title}. Los costos del proyecto se analizan con ejemplos sintéticos.`);
      items.push({ id: 900 + m * 10 + r, title, type: "File", content_id: fileId });
    }
  });
  if (m === 3) {
    items.push({ id: 990, title: "Sitio externo", type: "ExternalUrl", external_url: "https://example.com" });
    items.push({ id: 991, title: "Repetido", type: "File", content_id: items[0].content_id });
  }
  return { id: 700 + m, name: `Módulo ${m + 1}: ${name}`, items };
});

const SIGLO_PDF = addFile("Canales y relaciones.pdf", "Canales y relaciones: el canal es cómo llega la propuesta de valor al cliente. Texto sintético.");
const RISE_PDF = addFile("Lectura con PDF.pdf", "Validación de negocios: la hipótesis del cliente se prueba con entrevistas. Texto sintético.");

const COURSES = [
  { id: 101, name: "Costos de Proyectos", course_code: "CP-2026" },
  { id: 102, name: "Gestión de Proyectos", course_code: "GP-2026" },
  { id: 103, name: "Contabilidad de Costos I", course_code: "CC1" },
  { id: 104, name: "Estrategia y Validación de Negocios", course_code: "EVN" },
];
const ACCESS: Record<string, number[]> = { [FAKE_TOKENS.teacher]: [101, 102, 103, 104], [FAKE_TOKENS.student]: [101, 102, 104] };

function riseHtml(title: string, body: string, attachment?: string): string {
  const data = { title, lessons: [{ title: "Lección", items: [{ heading: title, text: `<p>${body}</p>` }], ...(attachment ? { media: { attachment: { originalUrl: attachment } } } : {}) }] };
  return `<html><head><script>window.courseData = "${Buffer.from(JSON.stringify(data)).toString("base64")}";</script></head><body><div id="app"></div></body></html>`;
}

const LONG = (topic: string) =>
  `${topic}. La propuesta de valor se valida con clientes reales antes de invertir. Se definen hipótesis, se diseñan experimentos baratos y se mide la respuesta. ` +
  `Cuando la evidencia contradice la hipótesis, se ajusta el modelo de negocio. Este texto es sintético y sirve solo para pruebas automáticas de Educai.`;

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  const isBuffer = body instanceof Uint8Array;
  const isText = typeof body === "string";
  res.writeHead(status, { "content-type": isBuffer ? "application/octet-stream" : isText ? "text/html; charset=utf-8" : "application/json", ...headers });
  res.end(isBuffer ? Buffer.from(body) : isText ? body : JSON.stringify(body));
}

function moodle(url: URL, res: ServerResponse, base: string) {
  const fn = url.searchParams.get("wsfunction");
  if (url.searchParams.get("wstoken") !== MOODLE_USER.token) return send(res, 200, { exception: "moodle_exception", errorcode: "invalidtoken", message: "Invalid token" });
  if (fn === "core_webservice_get_site_info") return send(res, 200, { userid: 77, fullname: "Estudiante Sintético", sitename: "Moodle de prueba" });
  if (fn === "core_enrol_get_users_courses") return send(res, 200, [{ id: 11, fullname: "Costos de Proyectos", shortname: "CP" }, { id: 12, fullname: "Historia del Arte", shortname: "HA" }]);
  if (fn === "core_course_get_contents" && url.searchParams.get("courseid") === "11") {
    return send(
      res,
      200,
      TOPICS.slice(0, 2).map(([name, readings], s) => ({
        name: `Unidad ${s + 1}: ${name}`,
        modules: [
          ...readings.slice(0, 2).map((title, r) => ({
            id: 300 + s * 10 + r,
            name: title,
            modname: "resource",
            contents: [{ type: "file", filename: `${title}.pdf`, fileurl: `${base}/webservice/pluginfile.php/${s}/${r}/${encodeURIComponent(title)}.pdf`, mimetype: "application/pdf", filesize: 1000 }],
          })),
          { id: 399 + s, name: "Foro de consultas", modname: "forum", contents: [] },
        ],
      })),
    );
  }
  return send(res, 200, { exception: "moodle_exception", errorcode: "invalidrecord", message: "Not found" });
}

function handle(req: IncomingMessage, res: ServerResponse, base: string, altBase: string) {
  const url = new URL(req.url ?? "/", base);
  const path = url.pathname;

  if (path === "/health") return send(res, 200, { ok: true });
  // "Bucket" en otro servidor: rechaza credenciales, como S3 con una URL firmada.
  if (path.startsWith("/s3/")) {
    if (req.headers.authorization || req.headers.cookie) return send(res, 400, { error: "SignatureDoesNotMatch" });
    const file = files.get(Number(path.split("/")[2]));
    return file ? send(res, 200, file.data, { "content-type": file.mime }) : send(res, 404, {});
  }
  // Lecturas incrustadas (públicas, sin credenciales).
  if (path.startsWith("/meca/") && path.includes("/assets/")) return send(res, 200, files.get(RISE_PDF)!.data, { "content-type": "application/pdf" });
  if (path.startsWith("/meca/")) {
    const id = path.split("/")[2];
    if (id === "m1l1") return send(res, 200, riseHtml("Hipótesis y experimentos", LONG("Hipótesis y experimentos"), "assets/lectura.pdf"));
    if (id === "m1l2") return send(res, 200, riseHtml("Propuesta de valor", LONG("Propuesta de valor")));
    if (id === "m2l1") return send(res, 200, `<html><body><article><h1>Modelo de negocio</h1><p>${LONG("Modelo de negocio")}</p></article></body></html>`);
    // Formato real de Siglo 21: HTML común con el título en el cabezal y el PDF al lado, con su ícono.
    // La bibliografía enlaza PDF de otros sitios, que no se tienen que confundir con el de la lectura.
    if (id === "m3l1" || id === "m3l2") {
      if (path.endsWith(".pdf")) {
        // m3l1: PDF con texto; m3l2: PDF escaneado (páginas sin texto, como el módulo 1 de Costos de proyectos).
        return send(res, 200, id === "m3l1" ? files.get(SIGLO_PDF)!.data : makePdf(["", ""]), { "content-type": "application/pdf" });
      }
      const title = id === "m3l1" ? "Canales y relaciones" : "Métricas de tracción";
      return send(
        res,
        200,
        `<!doctype html><html><head><link rel="stylesheet" href="./css/style.css"></head><body>` +
          `<div id="intro" class="row cabezal"><div class="cell"><div id="iebh" class="titulomateria">${title}</div></div></div>` +
          `<div class="texto_simple">${LONG(title)}</div>` +
          `<div class="texto_simple">Referencias: <a href="https://biblioteca.example.org/otro.pdf">otro.pdf</a></div>` +
          `<a target="_blank" href="${id}.pdf" class="link borrar"><img src="https://content.example.org/logo_PDF.png" class="pdf"/></a>` +
          `</body></html>`,
      );
    }
    if (id === "m2l2") return send(res, 200, `<html><body><p>Corto.</p></body></html>`);
    return send(res, 404, "no");
  }

  // Moodle
  if (path === "/login/token.php") {
    const ok = url.searchParams.get("username") === MOODLE_USER.username && url.searchParams.get("password") === MOODLE_USER.password;
    return send(res, 200, ok ? { token: MOODLE_USER.token } : { error: "Invalid login, please try again", errorcode: "invalidlogin" });
  }
  if (path === "/webservice/rest/server.php") return moodle(url, res, base);
  if (path.startsWith("/webservice/pluginfile.php/")) {
    if (url.searchParams.get("token") !== MOODLE_USER.token) return send(res, 403, "forbidden");
    const title = decodeURIComponent(path.split("/").pop() ?? "").replace(/\.pdf$/, "");
    return send(res, 200, makePdf([`Moodle: ${title}. Lectura sintética de la unidad.`]), { "content-type": "application/pdf" });
  }

  // Canvas
  const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  const cookieToken = /canvas_session=([^;]+)/.exec(req.headers.cookie ?? "")?.[1];
  const who = ACCESS[token] ? token : cookieToken && ACCESS[cookieToken] ? cookieToken : null;
  if (path.startsWith("/files/") && path.endsWith("/download")) {
    if (!who) return send(res, 401, { errors: [{ message: "Invalid access token." }] });
    const id = path.split("/")[2];
    return send(res, 302, "", { location: `${altBase}/s3/${id}?firma=sintetica` });
  }
  if (!path.startsWith("/api/v1/")) return send(res, 404, "no");
  if (!who) return send(res, 401, { errors: [{ message: "Invalid access token." }] });
  const mine = COURSES.filter((c) => ACCESS[who].includes(c.id));

  if (path === "/api/v1/users/self/profile") return send(res, 200, { id: 1, name: who === FAKE_TOKENS.teacher ? "Docente Sintético" : "Estudiante Sintético" });
  if (path === "/api/v1/courses") {
    // Dos por página, para probar la paginación por el encabezado Link.
    const page = Number(url.searchParams.get("page") ?? 1);
    const slice = mine.slice((page - 1) * 2, page * 2);
    const hasNext = page * 2 < mine.length;
    const next = new URL(url);
    next.searchParams.set("page", String(page + 1));
    return send(res, 200, slice.map((c) => ({ ...c, workflow_state: "available", term: { name: "2026" } })), hasNext ? { link: `<${next.href}>; rel="next"` } : {});
  }
  const courseMatch = /^\/api\/v1\/courses\/(\d+)\/(modules|pages\/([^/]+))$/.exec(path);
  if (courseMatch) {
    const id = Number(courseMatch[1]);
    if (!ACCESS[who].includes(id)) return send(res, 401, { errors: [{ message: "user not authorized to perform that action" }] });
    if (courseMatch[2] === "modules") {
      if (id === 101) return send(res, 200, COURSE_101);
      if (id === 104) return send(res, 200, [{ id: 801, name: "Contenidos", items: [{ id: 1, title: "Módulos", type: "Page", page_url: "modulos" }] }]);
      return send(res, 200, []);
    }
    const slug = decodeURIComponent(courseMatch[3]);
    if (id === 101 && slug === "lecciones-aprendidas") return send(res, 200, { title: "Lecciones aprendidas", body: PAGE_TEXT("Lecciones aprendidas") });
    if (id === 104 && slug === "modulos") {
      const reading = (m: number, l: number) => `<div id="lectura${l}m${m}"><a href="#">Lectura ${l}</a></div><div id="lectura${l}m${m}"><iframe src="${base}/meca/m${m}l${l}/"></iframe></div>`;
      return send(res, 200, { title: "Módulos", body: `<h1>Módulos</h1>${reading(1, 1)}${reading(1, 2)}${reading(2, 1)}${reading(2, 2)}${reading(3, 1)}${reading(3, 2)}` });
    }
    return send(res, 404, { errors: [{ message: "The specified resource does not exist." }] });
  }
  const fileMatch = /^\/api\/v1\/files\/(\d+)$/.exec(path);
  if (fileMatch) {
    const file = files.get(Number(fileMatch[1]));
    if (!file) return send(res, 404, {});
    return send(res, 200, { id: file.id, display_name: file.name, filename: file.name, "content-type": file.mime, size: file.data.byteLength, url: `${base}/files/${file.id}/download?download_frd=1` });
  }
  return send(res, 404, { errors: [{ message: "The specified resource does not exist." }] });
}

/** Levanta el LMS de mentira. `port` 0 elige uno libre. */
export async function startFakeLms(port = 0): Promise<{ url: string; close: () => Promise<void>; server: Server }> {
  let base = "";
  let altBase = "";
  const server = createServer((req, res) => {
    try {
      handle(req, res, base, altBase);
    } catch (error) {
      send(res, 500, { error: String(error) });
    }
  });
  // Sin host: escucha en IPv4 e IPv6, así "localhost" y "127.0.0.1" llegan al mismo servidor.
  await new Promise<void>((resolve) => server.listen(port, resolve));
  const actual = (server.address() as AddressInfo).port;
  base = `http://localhost:${actual}`;
  altBase = `http://127.0.0.1:${actual}`;
  return { url: base, server, close: () => new Promise((resolve) => server.close(() => resolve())) };
}
