// Código de vinculación que muestra Educai: "educai1." + base64url de {s: Educai, c: Canvas, k: secreto}.
// Es el mismo formato que decodeExtensionCode en src/domain/lms.ts.
const PREFIX = 'educai1.';

function local(url) {
  return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
}

export function decodeCode(raw) {
  const text = String(raw || '').trim();
  if (!text.startsWith(PREFIX)) return null;
  try {
    const b64 = text.slice(PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    const server = new URL(data.s);
    const canvas = new URL(data.c);
    if ((server.protocol !== 'https:' && !local(server)) || (canvas.protocol !== 'https:' && !local(canvas))) return null;
    if (typeof data.k !== 'string' || data.k.length < 20) return null;
    return { server: server.origin, canvas: canvas.origin + canvas.pathname.replace(/\/+$/, ''), canvasOrigin: canvas.origin, secret: data.k };
  } catch {
    return null;
  }
}

/** Patrones de permiso: solo los dos sitios del código, nada más. */
export function originsFor(code) {
  return [`${code.server}/*`, `${code.canvasOrigin}/*`];
}
