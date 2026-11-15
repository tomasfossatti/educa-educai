/**
 * Tope semanal de gasto de IA por estudiante (sección Costos del spec).
 * Funciones puras: la consulta a la base y el bloqueo están en `src/server/ai/budget.ts`.
 */

/** Argentina no tiene horario de verano: la semana empieza el lunes a las 00:00 (UTC-3). */
const AR_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Inicio de la semana del piloto (lunes 00:00 hora argentina) que contiene a `now`. */
export function weekStart(now: Date): Date {
  const local = new Date(now.getTime() - AR_OFFSET_MS);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  const mondayLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - daysSinceMonday * DAY_MS;
  return new Date(mondayLocal + AR_OFFSET_MS);
}

/** Momento en que se renueva el tope (el lunes siguiente). */
export function nextWeekStart(now: Date): Date {
  return new Date(weekStart(now).getTime() + 7 * DAY_MS);
}

/** Clave de la semana para no repetir alertas, por ejemplo "2026-11-09". */
export function weekKey(now: Date): string {
  return new Date(weekStart(now).getTime() - AR_OFFSET_MS).toISOString().slice(0, 10);
}

export type BudgetState = "ok" | "warning" | "exceeded";

export function budgetState(spentUsd: number, capUsd: number, alertRatio: number): BudgetState {
  if (capUsd <= 0) return "ok";
  if (spentUsd >= capUsd) return "exceeded";
  if (spentUsd >= capUsd * alertRatio) return "warning";
  return "ok";
}

/** Lee un monto en USD de una variable de entorno; vacío o inválido devuelve el valor por defecto. */
export function readUsd(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}
