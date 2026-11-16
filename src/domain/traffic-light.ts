/**
 * Semáforo de "Mi avance" (panel simple del estudiante). Lo decide código determinístico a partir de
 * `MasteryRecord`, nunca el modelo. Los umbrales son fijos y están documentados en DECISIONES.md.
 *
 * - Verde ("Lo domino"): avance de al menos 0,8. Con el tope de la fórmula (0,5 con un intento y 0,8
 *   con dos), hacen falta al menos dos prácticas buenas.
 * - Amarillo ("En camino"): al menos una práctica, sin llegar al verde.
 * - Gris ("Sin empezar"): ninguna práctica del tema.
 */
export const TRAFFIC_LIGHT = {
  greenMinScore: 0.8,
  yellowMinAttempts: 1,
} as const;

export type TrafficLight = "GREEN" | "YELLOW" | "GRAY";

export function trafficLight(record: { score: number; attempts: number } | null | undefined): TrafficLight {
  if (!record || record.attempts < TRAFFIC_LIGHT.yellowMinAttempts) return "GRAY";
  // Tolerancia de punto flotante: 0,8 calculado con pesos puede quedar en 0,7999999.
  return record.score >= TRAFFIC_LIGHT.greenMinScore - 1e-9 ? "GREEN" : "YELLOW";
}
