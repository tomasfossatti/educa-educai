/**
 * El seed crea usuarios de demostración: solo se permite en local o en una base de prueba.
 * En staging se habilita explícitamente con SEED_ALLOW_REMOTE=1. En producción nunca.
 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "db", "postgres"]);

export function seedBlockReason(env: Record<string, string | undefined>): string | null {
  if (env.NODE_ENV === "production" || env.APP_ENV === "production") {
    return "El seed de demostración no se ejecuta en producción.";
  }
  const url = env.DATABASE_URL;
  if (!url) return "Falta DATABASE_URL.";
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^\[|\]$/g, "");
  } catch {
    return "DATABASE_URL no es una URL válida.";
  }
  if (!LOCAL_HOSTS.has(host) && env.SEED_ALLOW_REMOTE !== "1") {
    return `La base (${host}) no es local. Para staging, definí SEED_ALLOW_REMOTE=1.`;
  }
  return null;
}
