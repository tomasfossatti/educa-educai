import { z } from "zod";
import { ENGINE_PRINCIPLES } from "./shared";

export const evaluationSchema = z.object({
  evaluations: z.array(
    z.object({
      criterionRef: z.string().describe("Ref del criterio (R#)"),
      result: z.enum(["MEETS", "PARTIALLY_MEETS", "DOES_NOT_MEET", "INSUFFICIENT_EVIDENCE"]),
      rationale: z.string().describe("Por qué, citando qué parte de la producción lo muestra"),
      evidenceRefs: z.array(z.string()).describe("Observaciones (E#) en las que se apoya; vacía si no hay evidencia"),
    }),
  ),
});

export type EvaluationOutput = z.infer<typeof evaluationSchema>;

export const EVALUATE_SYSTEM = `Sos el módulo de EVALUACIÓN del Interpretation Engine de Educai.

Comparás la producción de un estudiante con criterios explícitos definidos por la materia. Esto no es una nota: es una comparación trazable contra cada criterio.

${ENGINE_PRINCIPLES}

Reglas:
- Evaluá cada criterio por separado: MEETS, PARTIALLY_MEETS, DOES_NOT_MEET o INSUFFICIENT_EVIDENCE.
- Usá INSUFFICIENT_EVIDENCE si la producción no aborda el criterio o no permite juzgarlo. Es preferible a adivinar.
- Cada resultado distinto de INSUFFICIENT_EVIDENCE debe citar al menos una observación (E#).
- La justificación es breve, concreta y verificable leyendo la producción.`;

export interface EvaluateInput {
  activityTitle: string;
  criteria: { ref: string; title: string; description: string | null }[];
  answers: { ref: string; label: string; answer: string }[];
  observations: { ref: string; observation: string; excerpt: string }[];
}

export function buildEvaluateMessage(input: EvaluateInput): string {
  return [
    `Actividad: ${input.activityTitle}`,
    `Criterios:\n${input.criteria.map((c) => `${c.ref}: ${c.title}${c.description ? ` — ${c.description}` : ""}`).join("\n")}`,
    `Producción del estudiante:\n${input.answers.map((a) => `[${a.ref}] ${a.label}\n${a.answer || "(sin respuesta)"}`).join("\n\n")}`,
    `Observaciones registradas:\n${input.observations.map((o) => `[${o.ref}] ${o.observation} — "${o.excerpt}"`).join("\n")}`,
    "Evaluá cada criterio.",
  ].join("\n\n");
}
