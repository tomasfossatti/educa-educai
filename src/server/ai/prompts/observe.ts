import { z } from "zod";
import { ENGINE_PRINCIPLES, renderCurriculum, type RefCurriculumItem } from "./shared";

export const observationSchema = z.object({
  observations: z.array(
    z.object({
      kind: z.enum([
        "QUESTION",
        "EXPLANATION",
        "ATTEMPT",
        "ERROR",
        "DECISION",
        "JUSTIFICATION",
        "HYPOTHESIS",
        "ANALYSIS",
        "REFLECTION",
        "ANSWER",
      ]),
      observation: z.string().describe("Qué hizo el estudiante, en tercera persona, sin juicios de valor"),
      excerpt: z.string().describe("Cita textual exacta de lo que escribió el estudiante (podés omitir partes con ...)"),
      sourceRefs: z.array(z.string()).describe("Refs de origen: M# de mensajes o P# de consignas"),
      context: z.string().describe("Condiciones en las que ocurrió: qué se le había pedido, si hubo pistas previas, en qué consigna"),
      assistanceLevel: z.enum(["NONE", "LOW", "MEDIUM", "HIGH", "UNKNOWN"]),
      assistanceNote: z.string().describe("Qué ayuda precedió a esta producción, o por qué es desconocida"),
      curriculumRefs: z.array(z.string()).describe("Refs de la currícula con las que se relaciona (puede ser vacía)"),
    }),
  ),
  insufficientReason: z
    .string()
    .nullable()
    .describe("Si no hay observaciones relevantes, explicá brevemente por qué; si las hay, null"),
});

export type ObservationOutput = z.infer<typeof observationSchema>;

export const OBSERVE_SYSTEM = `Sos el módulo de OBSERVACIÓN del Interpretation Engine de Educai.

Tu única responsabilidad es identificar qué hizo el estudiante en una experiencia educativa. No interpretás ni evaluás: otro módulo lo hará después.

${ENGINE_PRINCIPLES}

Qué es una observación:
- Un hecho concreto atribuible al estudiante: una pregunta, una explicación, un intento, un error, una decisión, una justificación, una hipótesis, un análisis, una reflexión o una respuesta.
- "observation" describe el hecho de forma neutral ("Propuso segmentar por frecuencia de compra", "Preguntó qué diferencia hay entre problema y solución"). Prohibido: "bien", "mal", "comprende", "sabe", "no sabe".
- "excerpt" es una cita textual exacta de lo que escribió el estudiante. Nunca cites al tutor como si fuera el estudiante.
- "sourceRefs" lista de dónde sale: los mensajes del estudiante (M#) o las consignas (P#). Podés incluir el mensaje del tutor que dio contexto.
- "context" registra las condiciones: qué le había preguntado el tutor, si venía de recibir pistas, en qué consigna estaba.

Nivel de asistencia (assistanceLevel):
- En conversaciones: NONE si lo produjo sin ayuda previa sobre ese punto; LOW si hubo una pregunta orientadora; MEDIUM si recibió pistas concretas; HIGH si el tutor aportó la mayor parte y el estudiante lo reformuló.
- En entregas de actividades: UNKNOWN (la asistencia declarada se registra por separado).

Criterio de selección:
- Ignorá saludos, agradecimientos y mensajes sin contenido de la materia.
- Máximo 8 observaciones. Priorizá las que más informan sobre comprensión, aplicación, decisiones y autonomía.
- Si no hay nada observable relevante, devolvé una lista vacía y explicá por qué en insufficientReason.`;

export interface ObserveConversationInput {
  courseName: string;
  curriculum: RefCurriculumItem[];
  focus: string | null;
  activityTitle: string | null;
  messages: { ref: string; role: "ESTUDIANTE" | "TUTOR"; content: string }[];
}

export interface ObserveSubmissionInput {
  courseName: string;
  curriculum: RefCurriculumItem[];
  activity: { title: string; scenario: string; instructions: string };
  answers: { ref: string; label: string; answer: string }[];
}

export function buildObserveConversationMessage(input: ObserveConversationInput): string {
  return [
    `Materia: ${input.courseName}`,
    `Fuente: conversación del estudiante con el tutor de IA.${input.focus ? ` Foco elegido: ${input.focus}.` : ""}${input.activityTitle ? ` Conversación iniciada desde la actividad "${input.activityTitle}".` : ""}`,
    `Currícula (refs):\n${renderCurriculum(input.curriculum)}`,
    `Conversación:\n${input.messages.map((m) => `[${m.ref}] ${m.role}: ${m.content}`).join("\n\n")}`,
    "Identificá las observaciones.",
  ].join("\n\n");
}

export function buildObserveSubmissionMessage(input: ObserveSubmissionInput): string {
  return [
    `Materia: ${input.courseName}`,
    `Fuente: entrega de la actividad "${input.activity.title}".`,
    `Situación planteada: ${input.activity.scenario}`,
    `Consigna general: ${input.activity.instructions}`,
    `Currícula (refs):\n${renderCurriculum(input.curriculum)}`,
    `Respuestas del estudiante:\n${input.answers.map((a) => `[${a.ref}] Consigna: ${a.label}\nRespuesta: ${a.answer || "(sin respuesta)"}`).join("\n\n")}`,
    "Identificá las observaciones.",
  ].join("\n\n");
}
