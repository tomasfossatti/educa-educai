import "server-only";
import { db } from "@/server/db";

/** Fallos permitidos por email dentro de la ventana antes de bloquear. */
export const MAX_FAILURES_PER_EMAIL = 5;
/** Fallos permitidos por IP dentro de la ventana (cubre probar muchos emails desde un mismo lugar). */
export const MAX_FAILURES_PER_IP = 20;
export const WINDOW_MS = 15 * 60 * 1000;

/**
 * Decide si hay bloqueo a partir de las fechas de los fallos dentro de la ventana.
 * Devuelve cuándo se libera, o null si todavía se puede intentar.
 */
export function lockedUntil(failures: Date[], max: number, now: Date = new Date()): Date | null {
  const recent = failures.filter((f) => now.getTime() - f.getTime() < WINDOW_MS).sort((a, b) => a.getTime() - b.getTime());
  if (recent.length < max) return null;
  // Se libera cuando el fallo que completó el cupo sale de la ventana.
  const oldestCounting = recent[recent.length - max];
  return new Date(oldestCounting.getTime() + WINDOW_MS);
}

async function failuresSince(where: { email: string } | { ip: string }, since: Date): Promise<Date[]> {
  const rows = await db.loginAttempt.findMany({ where: { ...where, createdAt: { gt: since } }, select: { createdAt: true } });
  return rows.map((r) => r.createdAt);
}

/** Minutos que faltan para poder intentar de nuevo, o 0 si se puede intentar ya. */
export async function loginRetryAfterMinutes(email: string, ip: string | null, now: Date = new Date()): Promise<number> {
  const since = new Date(now.getTime() - WINDOW_MS);
  const candidates = [lockedUntil(await failuresSince({ email }, since), MAX_FAILURES_PER_EMAIL, now)];
  if (ip) candidates.push(lockedUntil(await failuresSince({ ip }, since), MAX_FAILURES_PER_IP, now));
  const until = candidates.reduce<Date | null>((max, d) => (d && (!max || d > max) ? d : max), null);
  if (!until) return 0;
  return Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 60_000));
}

export async function recordLoginFailure(email: string, ip: string | null): Promise<void> {
  await db.loginAttempt.create({ data: { email, ip } });
  // Limpieza oportunista: lo que pasó la ventana ya no sirve para nada.
  await db.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
}

/** Un login correcto borra los fallos previos de ese email. */
export async function clearLoginFailures(email: string): Promise<void> {
  await db.loginAttempt.deleteMany({ where: { email } });
}

/** IP del cliente detrás del proxy (primer valor de X-Forwarded-For). */
export function clientIp(forwardedFor: string | null, realIp: string | null): string | null {
  const first = forwardedFor?.split(",")[0]?.trim();
  return first || realIp?.trim() || null;
}
