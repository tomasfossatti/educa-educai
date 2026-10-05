import type { AssistanceLevel, Dimension, EvidenceSource, Polarity, Priority, SupportStatus } from "@prisma/client";

/**
 * Política de respaldo de inferencias.
 *
 * El modelo propone un estado de respaldo; esta política lo ajusta con reglas
 * explícitas y auditables. Nunca sube el nivel propuesto, solo lo baja o lo
 * marca como contradictorio. Cada ajuste queda registrado en `notes`.
 */

export interface SupportEvidence {
  evidenceId: string;
  experienceId: string;
  source: EvidenceSource;
  assistanceLevel: AssistanceLevel;
}

export interface SupportInput {
  proposed: SupportStatus;
  dimension: Dimension;
  polarity: Polarity;
  supporting: SupportEvidence[];
  contradicting: SupportEvidence[];
}

export interface SupportDecision {
  status: SupportStatus;
  notes: string[];
}

const RANK: Record<Exclude<SupportStatus, "CONTRADICTORY">, number> = {
  INSUFFICIENT: 0,
  PARTIAL: 1,
  CONSISTENT: 2,
};

function capAt(current: SupportStatus, max: Exclude<SupportStatus, "CONTRADICTORY">): SupportStatus {
  if (current === "CONTRADICTORY") return current;
  return RANK[current] > RANK[max] ? max : current;
}

export function applySupportPolicy(input: SupportInput): SupportDecision {
  const notes: string[] = [];
  const evidenceIds = new Set(input.supporting.map((e) => e.evidenceId));
  const experienceIds = new Set(input.supporting.map((e) => e.experienceId));
  let status: SupportStatus = input.proposed;

  if (evidenceIds.size === 0) {
    return { status: "INSUFFICIENT", notes: ["No hay evidencia que respalde la inferencia."] };
  }

  if (input.contradicting.length > 0) {
    if (status !== "CONTRADICTORY") {
      notes.push("Existe evidencia en sentido opuesto: se marca como señales contradictorias.");
    }
    return { status: "CONTRADICTORY", notes };
  }

  if (status === "CONTRADICTORY") {
    notes.push("El modelo indicó contradicción pero no citó evidencia opuesta: se trata como evidencia parcial.");
    status = "PARTIAL";
  }

  if (status === "CONSISTENT" && (evidenceIds.size < 2 || experienceIds.size < 2)) {
    status = capAt(status, "PARTIAL");
    notes.push("Evidencia consistente requiere al menos dos evidencias en dos experiencias distintas.");
  }

  const onlyConversation = input.supporting.every((e) => e.source === "AI_CONVERSATION");
  if (onlyConversation && (input.dimension === "APPLICATION" || input.dimension === "TRANSFER")) {
    const before = status;
    status = capAt(status, "PARTIAL");
    if (before !== status || input.polarity === "STRENGTH") {
      notes.push("La evidencia proviene solo de conversación con IA: conversar no demuestra aplicación.");
    }
  }

  const allHighAssistance = input.supporting.every((e) => e.assistanceLevel === "HIGH");
  if (
    allHighAssistance &&
    input.polarity === "STRENGTH" &&
    (input.dimension === "APPLICATION" || input.dimension === "AUTONOMY" || input.dimension === "TRANSFER")
  ) {
    const before = status;
    status = capAt(status, "PARTIAL");
    if (before !== status) {
      notes.push("Toda la evidencia ocurrió con asistencia alta: no alcanza para afirmar desempeño autónomo.");
    }
  }

  return { status, notes };
}

/** Qué inferencias necesitan revisión humana antes de considerarse confiables. */
export function requiresTeacherReview(params: {
  polarity: Polarity;
  status: SupportStatus;
  priority: Priority;
}): boolean {
  return params.polarity !== "STRENGTH" || params.status === "CONTRADICTORY" || params.priority === "HIGH";
}
