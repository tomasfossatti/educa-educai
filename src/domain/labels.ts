import type {
  ActionType,
  ActivityKind,
  ActivityStatus,
  AssistanceLevel,
  Confidence,
  CurriculumKind,
  DeclaredAssistance,
  Dimension,
  EvaluationResult,
  EvidenceKind,
  EvidenceSource,
  InterventionType,
  Polarity,
  ReviewStatus,
  ReviewVerdict,
  RunStatus,
  SnapshotDimension,
  StudentStance,
  SupportStatus,
} from "@prisma/client";

/** Etiquetas en español para todos los enums visibles. Única fuente de copy para estados. */

export const supportStatusLabel: Record<SupportStatus, string> = {
  CONSISTENT: "Evidencia consistente",
  PARTIAL: "Evidencia parcial",
  INSUFFICIENT: "Evidencia insuficiente",
  CONTRADICTORY: "Señales contradictorias",
};

export const supportStatusHelp: Record<SupportStatus, string> = {
  CONSISTENT: "Aparece en más de una evidencia y en más de una experiencia, sin señales en contra.",
  PARTIAL: "Hay evidencia, pero proviene de una sola fuente o experiencia, o de condiciones que no alcanzan para afirmarlo.",
  INSUFFICIENT: "Todavía no hay evidencia suficiente para concluir algo.",
  CONTRADICTORY: "Hay evidencia que apunta en direcciones opuestas. Conviene revisarla.",
};

export const reviewStatusLabel: Record<ReviewStatus, string> = {
  PENDING: "Pendiente de revisión docente",
  CONFIRMED: "Confirmada por docente",
  PARTIALLY_CORRECT: "Parcialmente correcta",
  INCORRECT: "Marcada como incorrecta",
  NEEDS_CONTEXT: "Falta contexto",
};

export const reviewVerdictLabel: Record<ReviewVerdict, string> = {
  CONFIRMED: "Confirmar",
  PARTIALLY_CORRECT: "Parcialmente correcto",
  INCORRECT: "Incorrecto",
  NEEDS_CONTEXT: "Falta contexto",
};

export const dimensionLabel: Record<Dimension, string> = {
  COMPREHENSION: "Comprensión",
  APPLICATION: "Aplicación",
  TRANSFER: "Transferencia",
  AUTONOMY: "Autonomía",
};

export const snapshotDimensionLabel: Record<SnapshotDimension, string> = {
  COMPREHENSION: "Comprensión",
  APPLICATION: "Aplicación",
  TRANSFER: "Transferencia",
  AUTONOMY: "Autonomía",
  CONSISTENCY: "Consistencia",
  EVOLUTION: "Evolución",
};

export const snapshotDimensionQuestion: Record<SnapshotDimension, string> = {
  COMPREHENSION: "¿Hay evidencia de comprensión conceptual?",
  APPLICATION: "¿Puede utilizar el conocimiento?",
  TRANSFER: "¿Puede utilizarlo en contextos diferentes?",
  AUTONOMY: "¿Cuánta asistencia necesita?",
  CONSISTENCY: "¿La evidencia aparece repetidamente?",
  EVOLUTION: "¿Cómo cambia con el tiempo?",
};

export const polarityLabel: Record<Polarity, string> = {
  STRENGTH: "Fortaleza",
  DIFFICULTY: "Dificultad",
  MIXED: "Mixta",
};

export const curriculumKindLabel: Record<CurriculumKind, string> = {
  CONCEPT: "Concepto",
  OBJECTIVE: "Objetivo de aprendizaje",
  COMPETENCY: "Competencia",
  CRITERION: "Criterio de evaluación",
};

export const curriculumKindPlural: Record<CurriculumKind, string> = {
  CONCEPT: "Conceptos",
  OBJECTIVE: "Objetivos de aprendizaje",
  COMPETENCY: "Competencias",
  CRITERION: "Criterios de evaluación",
};

export const evidenceKindLabel: Record<EvidenceKind, string> = {
  QUESTION: "Pregunta",
  EXPLANATION: "Explicación",
  ATTEMPT: "Intento",
  ERROR: "Error",
  DECISION: "Decisión",
  JUSTIFICATION: "Justificación",
  HYPOTHESIS: "Hipótesis",
  ANALYSIS: "Análisis",
  REFLECTION: "Reflexión",
  ANSWER: "Respuesta",
};

export const evidenceSourceLabel: Record<EvidenceSource, string> = {
  AI_CONVERSATION: "Conversación con el tutor",
  CHALLENGE_SUBMISSION: "Entrega de actividad",
};

export const assistanceLevelLabel: Record<AssistanceLevel, string> = {
  NONE: "Sin asistencia",
  LOW: "Asistencia baja",
  MEDIUM: "Asistencia media",
  HIGH: "Asistencia alta",
  UNKNOWN: "Asistencia desconocida",
};

export const declaredAssistanceLabel: Record<DeclaredAssistance, string> = {
  NONE: "No usé ayuda",
  TUTOR_ONLY: "Consulté al tutor de Educai",
  EXTERNAL_AI_PARTIAL: "Usé otra IA para algunas partes",
  EXTERNAL_AI_EXTENSIVE: "Usé otra IA para buena parte de la respuesta",
  PEER_OR_OTHER: "Me ayudó otra persona o material",
};

export const confidenceLabel: Record<Confidence, string> = {
  LOW: "Poca",
  MEDIUM: "Media",
  HIGH: "Mucha",
};

export const evaluationResultLabel: Record<EvaluationResult, string> = {
  MEETS: "Cumple el criterio",
  PARTIALLY_MEETS: "Cumple parcialmente",
  DOES_NOT_MEET: "No cumple todavía",
  INSUFFICIENT_EVIDENCE: "Evidencia insuficiente",
};

export const activityKindLabel: Record<ActivityKind, string> = {
  BASELINE: "Challenge inicial",
  CHALLENGE: "Challenge",
  PRACTICE: "Práctica",
};

export const activityStatusLabel: Record<ActivityStatus, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicada",
  CLOSED: "Cerrada",
};

export const interventionTypeLabel: Record<InterventionType, string> = {
  EXPLAIN: "Explicar en clase",
  ASK: "Hacer una pregunta",
  REGROUP: "Reagrupar estudiantes",
  PRACTICE: "Proponer práctica",
  FEEDBACK: "Enviar feedback",
  NEW_CHALLENGE: "Proponer otro challenge",
  OTHER: "Otra",
};

export const actionTypeLabel: Record<ActionType, string> = {
  REVIEW_CONCEPT: "Revisar un concepto",
  PRACTICE_WITH_TUTOR: "Practicar con el tutor",
  TRY_ACTIVITY: "Hacer una actividad",
  REFLECT: "Reflexionar",
  TEACHER_MESSAGE: "Mensaje de tu docente",
  EXPLAIN_IN_CLASS: "Explicar en clase",
  ASK_STUDENT: "Preguntar al estudiante",
  REGROUP: "Reagrupar",
  ASSIGN_PRACTICE: "Asignar práctica",
  GIVE_FEEDBACK: "Dar feedback",
  PROPOSE_CHALLENGE: "Proponer challenge",
};

export const runStatusLabel: Record<RunStatus, string> = {
  QUEUED: "En cola para análisis",
  RUNNING: "Analizando evidencia",
  COMPLETED: "Análisis completo",
  INSUFFICIENT: "Evidencia insuficiente",
  FAILED: "El análisis falló",
  SKIPPED: "No analizada",
};

export const studentStanceLabel: Record<StudentStance, string> = {
  AGREE: "Estoy de acuerdo",
  DISAGREE: "No estoy de acuerdo",
  MISSING_CONTEXT: "Falta contexto",
};
