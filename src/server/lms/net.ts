import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Pedidos al LMS. La dirección la escribe el usuario, así que se valida para que el servidor no
 * termine consultando su propia red (SSRF): solo https, sin IP privadas ni nombres internos.
 * LMS_ALLOW_INSECURE_URLS=true habilita http y localhost para los tests con un LMS de mentira.
 */
export class LmsError extends Error {
  constructor(
    message: string,
    readonly kind: "auth" | "not_found" | "network" | "invalid_url" | "too_large" | "other" = "other",
    /** Código HTTP con el que respondió el LMS, si lo hubo. */
    readonly status?: number,
  ) {
    super(message);
  }
}

/** Solo para los tests con el LMS de mentira (local y CI). Nunca en Vercel. */
export const allowInsecure = () => process.env.LMS_ALLOW_INSECURE_URLS === "true" && !process.env.VERCEL;

function privateAddress(ip: string): boolean {
  if (ip === "::1" || ip === "::" || /^f[cd]/i.test(ip) || /^fe80/i.test(ip)) return true;
  const v4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  const parts = v4.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

/** Normaliza la dirección base del LMS ("campus.uni.edu/" → "https://campus.uni.edu"). */
export function normalizeBaseUrl(input: string): string {
  let raw = input.trim();
  if (!raw) throw new LmsError("Escribí la dirección de tu LMS.", "invalid_url");
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new LmsError("La dirección del LMS no es válida.", "invalid_url");
  }
  if (url.username || url.password) throw new LmsError("La dirección no puede llevar usuario ni contraseña.", "invalid_url");
  if (url.protocol !== "https:" && !(allowInsecure() && url.protocol === "http:")) {
    throw new LmsError("La dirección del LMS tiene que empezar con https://.", "invalid_url");
  }
  const path = url.pathname.replace(/\/+$/, "");
  return `${url.protocol}//${url.host}${path}`;
}

export async function assertPublicHost(url: URL): Promise<void> {
  if (allowInsecure()) return;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (url.protocol !== "https:") throw new LmsError("Solo se aceptan direcciones https.", "invalid_url");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new LmsError("Esa dirección no es pública.", "invalid_url");
  }
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (addresses.length === 0) throw new LmsError(`No encontramos el servidor ${host}.`, "network");
  if (addresses.some(privateAddress)) throw new LmsError("Esa dirección no es pública.", "invalid_url");
}

const SENSITIVE = ["authorization", "cookie", "x-csrf-token", "x-requested-with"];
const MAX_REDIRECTS = 8;

/**
 * fetch con redirecciones seguidas a mano: cada salto se valida y, si cambia de servidor (por ejemplo
 * a un bucket de S3 con la URL firmada), se sacan la credencial y las cookies.
 */
export async function lmsFetch(input: string, init: { headers?: Record<string, string>; timeoutMs?: number } = {}): Promise<Response> {
  let url = new URL(input);
  const origin = url.host;
  let headers = { ...(init.headers ?? {}) };
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url);
    let response: Response;
    try {
      response = await fetch(url, { headers, redirect: "manual", signal: AbortSignal.timeout(init.timeoutMs ?? 30_000) });
    } catch (error) {
      const reason = error instanceof Error && error.name === "TimeoutError" ? "tardó demasiado en responder" : "no respondió";
      throw new LmsError(`El LMS ${reason} (${url.host}).`, "network");
    }
    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      url = new URL(response.headers.get("location")!, url);
      if (url.host !== origin) {
        headers = Object.fromEntries(Object.entries(headers).filter(([k]) => !SENSITIVE.includes(k.toLowerCase())));
      }
      continue;
    }
    return response;
  }
  throw new LmsError("El LMS redirigió demasiadas veces.", "network");
}

/** Lee el cuerpo con un tope de tamaño. */
export async function readLimited(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new LmsError("El archivo es demasiado grande.", "too_large");
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(await response.arrayBuffer());
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new LmsError("El archivo es demasiado grande.", "too_large");
    }
    parts.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.byteLength;
  }
  return out;
}

export function statusError(status: number, what: string): LmsError {
  if (status === 401) return new LmsError("El LMS rechazó la credencial: puede haber vencido. Volvé a conectarlo.", "auth", status);
  if (status === 403) return new LmsError(`El LMS no te deja ver ${what} (403).`, "auth", status);
  if (status === 404) return new LmsError(`El LMS no encontró ${what}.`, "not_found", status);
  return new LmsError(`El LMS respondió con un error (${status}) al pedir ${what}.`, "network", status);
}
