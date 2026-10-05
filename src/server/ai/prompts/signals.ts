import { z } from "zod";
import { ENGINE_PRINCIPLES, renderCurriculum, type RefCurriculumItem } from "./shared";

export const signalsSchema = z.object({
  signals: z.array(
    z.object({
      evidenceRef: z.string().describe("Ref de la observación (E#)"),
      dimension: z.enum(["COMPREHENSION", "APPLICATION", "TRANSFER", "AUTONOMY"]),
      polarity: z.enum(["STRENGTH", "DIFFICULTY", "MIXED"]),
      curriculumRef: z.string().nullable().describe("Ref del ítem curricular relacionado, o null si no corresponde a ninguno"),
      description: z.string().describe("La característica concreta observada, en una oración"),
      rationale: z.string().describe("Por qué la observación muestra esta señal"),
    }),
  ),
});

export type SignalsOutput = z.infer<typeof signalsSchema>;

export const SIGNALS_SYSTEM = `Sos el módulo de EXTRACCIÓN DE SEÑALES del Interpretation Engine de Educai.

Recibís observaciones ya registradas (E#) y la currícula de la materia (refs). Tu responsabilidad es identificar qué características relevantes muestra cada observación y vincularlas con la currícula. No sacás conclusiones sobre la persona: describís señales.

${ENGINE_PRINCIPLES}

Dimensiones:
- COMPREHENSION: explica, distingue o usa correctamente un concepto (STRENGTH), o muestra una confusión conceptual (DIFFICULTY).
- APPLICATION: usa el conocimiento para decidir o resolver un caso concreto. En conversaciones, solo si el estudiante efectivamente trabajó un caso; explicar no es aplicar.
- TRANSFER: aplica algo en un contexto distinto de aquel donde lo aprendió o del que le es familiar. Usala solo si el contexto es claramente diferente.
- AUTONOMY: cuánto pudo producir sin ayuda. Basate en el nivel de asistencia registrado: NONE/LOW con producción relevante → STRENGTH; HIGH → DIFFICULTY.

Polaridad: STRENGTH (aparece la capacidad), DIFFICULTY (aparece una dificultad), MIXED (la misma observación muestra ambas).

Reglas:
- Entre 0 y 3 señales por observación; no fuerces señales donde no las hay.
- "description" nombra la característica concreta ("Usa necesidades diferenciadas como criterio de segmentación", "Formula la hipótesis como afirmación no verificable").
- curriculumRef solo puede ser una ref de la lista o null.
- No uses lo que el estudiante declaró sobre sí mismo como señal.`;

export interface SignalsInput {
  courseName: string;
  curriculum: RefCurriculumItem[];
  sourceDescription: string;
  /** Contexto declarado por el estudiante: solo para juzgar si hay transferencia. */
  familiarContext: string | null;
  observations: {
    ref: string;
    kind: string;
    observation: string;
    excerpt: string;
    context: string;
    assistanceLevel: string;
    curriculumRefs: string[];
  }[];
}

export function buildSignalsMessage(input: SignalsInput): string {
  return [
    `Materia: ${input.courseName}`,
    `Fuente: ${input.sourceDescription}`,
    input.familiarContext
      ? `Contexto que el estudiante declaró como propio (no es evidencia; usalo solo para juzgar si hay transferencia a un contexto distinto): ${input.familiarContext}`
      : "El estudiante no declaró un contexto propio.",
    `Currícula (refs):\n${renderCurriculum(input.curriculum)}`,
    `Observaciones:\n${input.observations
      .map(
        (o) =>
          `[${o.ref}] (${o.kind}; asistencia: ${o.assistanceLevel}; posibles ítems: ${o.curriculumRefs.join(", ") || "ninguno"})\nObservación: ${o.observation}\nCita: "${o.excerpt}"\nContexto: ${o.context}`,
      )
      .join("\n\n")}`,
    "Extraé las señales.",
  ].join("\n\n");
}
