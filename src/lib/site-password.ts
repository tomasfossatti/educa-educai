/**
 * Contraseña de sitio para entornos que no son producción (staging): HTTP Basic con un usuario
 * cualquiera y la contraseña de SITE_PASSWORD. Sin la variable no hace nada. Evita que alguien
 * de afuera se registre en staging y gaste IA real. No reemplaza al login de la app.
 */
export const SITE_REALM = "Educai staging";

/** Rutas que responden sin contraseña: el chequeo de salud del proveedor. */
export function isPublicPath(pathname: string): boolean {
  return pathname === "/api/health";
}

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** true si el encabezado Authorization trae la contraseña correcta (el usuario se ignora). */
export function sitePasswordMatches(authorization: string | null, password: string): boolean {
  if (!authorization?.startsWith("Basic ")) return false;
  let decoded: string;
  try {
    decoded = atob(authorization.slice(6).trim());
  } catch {
    return false;
  }
  const sep = decoded.indexOf(":");
  return sep >= 0 && sameText(decoded.slice(sep + 1), password);
}
