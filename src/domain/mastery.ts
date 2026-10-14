/**
 * Educai — Motor de Consolidación, Retención y Recuperación Activa.
 * Inspirado en Mastery Loop (FSRS / Spaced Repetition) y CC Thinking Skills.
 *
 * Lógica pura de dominio, determinista y testeable.
 * Evalúa el decaimiento de memoria, programa intervalos de recuperación activa
 * y sugiere modelos mentales para desafíos de transferencia.
 */

import type { AssistanceLevel, Dimension, Polarity, SupportStatus } from "@prisma/client";

export type RetentionState = "FRESH" | "DUE_FOR_RECALL" | "AT_RISK" | "UNTESTED";

export type PracticeStrategy =
  | "ACTIVE_RECALL"         // Pregunta de recuperación sin apuntes
  | "INTERLEAVED_PRACTICE"  // Conectar 2 o más conceptos para entrenar discriminación
  | "GUIDED_SCAFFOLDING"    // Andamiaje gradual cuando hubo asistencia alta
  | "HYPERCORRECTION"       // Re-test rápido tras error para fijar corrección
  | "TRANSFER_CHALLENGE";   // Aplicar en contexto totalmente nuevo

export type MentalModelKey =
  | "FIRST_PRINCIPLES"
  | "INVERSION"
  | "SECOND_ORDER_THINKING"
  | "OCCAMS_RAZOR";

export interface MentalModelGuide {
  key: MentalModelKey;
  name: string;
  questionPrompt: string;
  rationale: string;
}

export const MENTAL_MODELS: Record<MentalModelKey, MentalModelGuide> = {
  FIRST_PRINCIPLES: {
    key: "FIRST_PRINCIPLES",
    name: "Primeros Principios",
    questionPrompt: "¿Cuáles son las verdades fundamentales innegables de este problema, y cómo podemos razonar a partir de ellas?",
    rationale: "Descompone el problema en hechos comprobables sin asumir analogías previas.",
  },
  INVERSION: {
    key: "INVERSION",
    name: "Pensamiento Inverso",
    questionPrompt: "¿Qué condiciones garantizarían el fracaso absoluto de esta solución, y cómo las evitamos?",
    rationale: "Aborda el desafío desde la prevención de errores en lugar de la búsqueda de perfección.",
  },
  SECOND_ORDER_THINKING: {
    key: "SECOND_ORDER_THINKING",
    name: "Pensamiento de Segundo Orden",
    questionPrompt: "Si aplicamos esta solución, ¿qué consecuencias de segundo y tercer orden se desatarán?",
    rationale: "Evalúa impacto sistémico y efectos secundarios a mediano plazo.",
  },
  OCCAMS_RAZOR: {
    key: "OCCAMS_RAZOR",
    name: "Parquedad (Navaja de Occam)",
    questionPrompt: "Entre las explicaciones posibles, ¿cuál es la más simple y económica que explica toda la evidencia?",
    rationale: "Evita sobrecomplicar hipótesis innecesariamente.",
  },
};

export interface ConceptPracticeRecord {
  curriculumItemId: string;
  title: string;
  lastPracticedAt: Date;
  status: SupportStatus;
  assistanceLevel: AssistanceLevel;
  polarity: Polarity;
  dimension: Dimension;
}

export interface MasteryEvaluation {
  curriculumItemId: string;
  title: string;
  retentionState: RetentionState;
  estimatedStabilityDays: number;
  daysSinceLastPractice: number;
  recommendedStrategy: PracticeStrategy;
  recommendedMentalModel: MentalModelGuide | null;
  suggestedActionTitle: string;
  suggestedActionDescription: string;
}

/**
 * Calcula la estabilidad estimada de memoria (en días) según la evidencia previa.
 * - Sin ayuda (NONE) y consistente: memoria más estable (~7-14 días).
 * - Asistencia media/baja: estabilidad moderada (~3-5 días).
 * - Error o asistencia alta: estabilidad baja (~1-2 días, requiere re-test rápido).
 */
export function estimateMemoryStability(record: {
  status: SupportStatus;
  assistanceLevel: AssistanceLevel;
  polarity: Polarity;
}): number {
  if (record.polarity === "DIFFICULTY") {
    // Si hubo dificultad, la ventana de re-evaluación debe ser corta (hipercorrección)
    return 1;
  }

  let baseDays = 3;
  if (record.status === "CONSISTENT") {
    baseDays = 7;
  } else if (record.status === "PARTIAL") {
    baseDays = 4;
  }

  // Modificador según nivel de asistencia previa
  switch (record.assistanceLevel) {
    case "NONE":
      return Math.round(baseDays * 1.5);
    case "LOW":
      return baseDays;
    case "MEDIUM":
      return Math.max(2, Math.round(baseDays * 0.7));
    case "HIGH":
    case "UNKNOWN":
      return 1;
  }
}

/**
 * Evalúa el estado de retención y genera la estrategia pedagógica de recuperación activa.
 */
export function evaluateConceptMastery(
  record: ConceptPracticeRecord,
  referenceDate: Date = new Date(),
  pairedConceptTitle?: string,
): MasteryEvaluation {
  const diffTime = Math.max(0, referenceDate.getTime() - record.lastPracticedAt.getTime());
  const daysSinceLastPractice = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const stabilityDays = estimateMemoryStability(record);

  let retentionState: RetentionState = "FRESH";
  if (daysSinceLastPractice >= stabilityDays * 2) {
    retentionState = "AT_RISK";
  } else if (daysSinceLastPractice >= stabilityDays) {
    retentionState = "DUE_FOR_RECALL";
  }

  let strategy: PracticeStrategy = "ACTIVE_RECALL";
  let mentalModel: MentalModelGuide | null = null;
  let title = "";
  let description = "";

  if (record.polarity === "DIFFICULTY") {
    strategy = "HYPERCORRECTION";
    title = `Revisión rápida: ${record.title}`;
    description = `Intentá resolver una pregunta breve sobre este concepto para consolidar lo que repasaste con el tutor.`;
  } else if (pairedConceptTitle && retentionState !== "FRESH") {
    strategy = "INTERLEAVED_PRACTICE";
    title = `Práctica intercalada: ${record.title} y ${pairedConceptTitle}`;
    description = `Poné a prueba tu comprensión comparando y diferenciando cómo aplican "${record.title}" y "${pairedConceptTitle}" en un mismo caso.`;
  } else if (record.dimension === "TRANSFER") {
    strategy = "TRANSFER_CHALLENGE";
    mentalModel = MENTAL_MODELS.FIRST_PRINCIPLES;
    title = `Desafío de transferencia: ${record.title}`;
    description = `Aplicá "${record.title}" a un contexto nuevo usando ${mentalModel.name}: ${mentalModel.questionPrompt}`;
  } else if (record.assistanceLevel === "HIGH" || record.assistanceLevel === "MEDIUM") {
    strategy = "GUIDED_SCAFFOLDING";
    title = `Práctica guiada: ${record.title}`;
    description = `Conversá con el tutor para aplicar este concepto con menor nivel de pistas y ganar autonomía.`;
  } else {
    strategy = "ACTIVE_RECALL";
    title = `Recuperación activa: ${record.title}`;
    description = `Sin mirar notas ni apuntes, explicá con tus palabras el concepto central y un caso de aplicación concreta.`;
  }

  return {
    curriculumItemId: record.curriculumItemId,
    title: record.title,
    retentionState,
    estimatedStabilityDays: stabilityDays,
    daysSinceLastPractice,
    recommendedStrategy: strategy,
    recommendedMentalModel: mentalModel,
    suggestedActionTitle: title,
    suggestedActionDescription: description,
  };
}
