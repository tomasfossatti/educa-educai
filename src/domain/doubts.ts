/** Reglas del conteo de dudas (paso 4 del motor en docs/SPEC.md). Puras, sin base de datos. */

export const UNANSWERED_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface DoubtSignal {
  studentStatus: "PENDING" | "CONFIRMED" | "DISCARDED";
  confidence: "LOW" | "MEDIUM" | "HIGH" | null;
  createdAt: Date;
}

/** Una duda entra en los porcentajes si el estudiante la confirmó, o si no respondió en 7 días y la confianza es alta. */
export function countsForTeacher(signal: DoubtSignal, now: Date = new Date()): boolean {
  if (signal.studentStatus === "CONFIRMED") return true;
  if (signal.studentStatus === "DISCARDED") return false;
  return signal.confidence === "HIGH" && now.getTime() - signal.createdAt.getTime() >= UNANSWERED_DAYS * DAY_MS;
}

/** Porcentaje entero (redondeado) de estudiantes con duda sobre los que conversaron del tema. */
export function doubtPercent(withDoubt: number, conversed: number): number {
  return conversed === 0 ? 0 : Math.round((withDoubt / conversed) * 100);
}

/** Frase de la vista macro, siempre con el denominador. */
export function doubtSentence(topic: string, withDoubt: number, conversed: number): string {
  const pct = doubtPercent(withDoubt, conversed);
  return `El ${pct}% de la clase no entiende ${topic} (${withDoubt} de ${conversed} ${conversed === 1 ? "estudiante que conversó" : "estudiantes que conversaron"} sobre este tema).`;
}
