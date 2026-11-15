/**
 * Dominio por tema: promedio ponderado por recencia de los últimos cinco intentos, con tope
 * cuando hay pocos intentos (un acierto con suerte no "domina" un tema).
 *
 * Portado de DeepTutor, `deeptutor/learning/mastery.py` (Apache License 2.0,
 * Copyright 2025 Data Intelligence Lab, The University of Hong Kong). Ver THIRD_PARTY_NOTICES.md.
 */

/** Pesos de los intentos más recientes, del más viejo al más nuevo. */
export const RECENCY_WEIGHTS = [0.5, 0.7, 0.85, 0.95, 1.0] as const;

/** Tope del dominio según la cantidad de intentos (desde tres, sin tope). */
export const CONFIDENCE_CAP: Record<number, number> = { 1: 0.5, 2: 0.8 };

/**
 * Dominio de 0 a 1 a partir del acierto de cada intento (0..1), en orden cronológico.
 * Con menos de cinco intentos se usan los últimos pesos (los de los intentos más nuevos).
 */
export function computeMastery(correctness: number[]): number {
  if (correctness.length === 0) return 0;
  const recent = correctness.slice(-RECENCY_WEIGHTS.length);
  const weights = RECENCY_WEIGHTS.slice(-recent.length);
  const weighted = recent.reduce((sum, c, i) => sum + weights[i] * Math.max(0, Math.min(1, c)), 0);
  const score = weighted / weights.reduce((a, b) => a + b, 0);
  return Math.min(score, CONFIDENCE_CAP[recent.length] ?? 1);
}

/** Acierto de un intento de quiz: fracción de respuestas correctas. */
export function quizCorrectness(correct: number, total: number): number {
  return total === 0 ? 0 : correct / total;
}
