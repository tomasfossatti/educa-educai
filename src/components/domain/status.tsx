import type { Dimension, EvaluationResult, Polarity, ReviewStatus, SupportStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import {
  dimensionLabel,
  evaluationResultLabel,
  polarityLabel,
  reviewStatusLabel,
  supportStatusHelp,
  supportStatusLabel,
} from "@/domain/labels";

const SUPPORT_SYMBOL: Record<SupportStatus, string> = {
  CONSISTENT: "●",
  PARTIAL: "◐",
  INSUFFICIENT: "○",
  CONTRADICTORY: "◑",
};

/** Estado cualitativo de respaldo. Nunca porcentajes. */
export function SupportBadge({ status }: { status: SupportStatus }) {
  return (
    <Badge tone={status === "CONTRADICTORY" ? "attention" : status === "INSUFFICIENT" ? "muted" : "neutral"} title={supportStatusHelp[status]}>
      <span aria-hidden>{SUPPORT_SYMBOL[status]}</span>
      {supportStatusLabel[status]}
    </Badge>
  );
}

export function ReviewBadge({ status, audience = "teacher" }: { status: ReviewStatus; audience?: "teacher" | "student" }) {
  if (status === "PENDING") {
    return <Badge tone="muted">{audience === "student" ? "Sin revisión docente todavía" : reviewStatusLabel.PENDING}</Badge>;
  }
  const tone = status === "CONFIRMED" ? "primary" : status === "INCORRECT" ? "danger" : "neutral";
  return <Badge tone={tone}>{reviewStatusLabel[status]}</Badge>;
}

export function PolarityText({ polarity }: { polarity: Polarity }) {
  return <span className={polarity === "DIFFICULTY" ? "text-[#c08532]" : "text-[#72706b]"}>{polarityLabel[polarity]}</span>;
}

export function DimensionTag({ dimension }: { dimension: Dimension }) {
  return <Badge tone="muted">{dimensionLabel[dimension]}</Badge>;
}

export function EvaluationBadge({ result }: { result: EvaluationResult }) {
  const tone = result === "MEETS" ? "primary" : result === "DOES_NOT_MEET" ? "attention" : result === "INSUFFICIENT_EVIDENCE" ? "muted" : "neutral";
  return <Badge tone={tone}>{evaluationResultLabel[result]}</Badge>;
}

/**
 * Etiqueta de capa: hace visible la separación Declarado → Observado → Inferido → Evaluado.
 */
const LAYER = {
  declared: { label: "Declarado", help: "Lo que el estudiante dice sobre sí mismo. No es evidencia." },
  observed: { label: "Observado", help: "Lo que el estudiante efectivamente produjo, con su fuente." },
  inferred: { label: "Inferido por IA", help: "Una hipótesis de Educai basada en evidencia. No es un hecho." },
  evaluated: { label: "Evaluado", help: "Comparación con un criterio explícito de la materia." },
  teacher: { label: "Docente", help: "Decisión o comentario de una persona." },
} as const;

export function LayerTag({ layer }: { layer: keyof typeof LAYER }) {
  return (
    <span
      title={LAYER[layer].help}
      className="inline-flex items-center rounded-full border border-[#d1d1cd] bg-[#fdfbfa] px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[#72706b]"
    >
      {LAYER[layer].label}
    </span>
  );
}
