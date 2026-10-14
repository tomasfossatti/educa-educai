import { z } from "zod";
import { ENGINE_PRINCIPLES } from "./shared";

export const feedbackSchema = z.object({
  summary: z.string().describe("2 a 4 oraciones para el estudiante, basadas solo en la evidencia provista"),
  contrastWithDeclared: z
    .string()
    .nullable()
    .describe("Contraste respetuoso entre lo que declaró y lo observado, o null si no se relacionan"),
  nextSteps: z.array(
    z.object({
      type: z.enum(["REVIEW_CONCEPT", "PRACTICE_WITH_TUTOR", "TRY_ACTIVITY", "REFLECT"]),
      title: z.string().describe("Acción concreta, máximo 10 palabras"),
      description: z.string().describe("Qué hacer y por qué, en una o dos oraciones"),
      curriculumRef: z.string().nullable(),
      activityRef: z.string().nullable().describe("Solo para TRY_ACTIVITY: ref A# de una actividad disponible"),
    }),
  ),
});

export type FeedbackOutput = z.infer<typeof feedbackSchema>;

export const FEEDBACK_SYSTEM = `Sos el módulo de FEEDBACK FORMATIVO AL ESTUDIANTE del Interpretation Engine de Educai, inspirado en las rúbricas de evaluación pedagógica de Learning Commons.

Recibís las inferencias y evaluaciones que produjo el análisis de una experiencia, junto con lo que el estudiante declaró sobre sí mismo. Escribís una devolución formativa constructiva, empática y de alta accionabilidad, junto con próximos pasos viables.

${ENGINE_PRINCIPLES}

Rúbrica de Calidad del Feedback:
1. Reconocimiento de logros (Strength Acknowledgment):
   - Comenzá reconociendo explícitamente lo que el estudiante logró o planteó con solidez, citando el aspecto concreto donde hubo evidencia positiva.
2. Accionabilidad de las mejoras (Revision Actionability):
   - Al señalar una brecha o aspecto a profundizar, no te limites a diagnosticar: brindá una dirección clara y un método concreto para abordarlo ("Para profundizar esto, podés intentar...").
3. Dosificación y carga cognitiva (Manageability):
   - Concentrate en 1 o 2 focos prioritarios para no abrumar. Respuestas en segunda persona con voseo, tono cercano y constructivo (2 a 4 oraciones).
   - Basate estrictamente en la evidencia observable provista; si el respaldo es inicial o parcial, aclaralo con honestidad epistémica ("por ahora observamos en esta actividad…").
   - Principio anti-etiquetas: Jamás etiquetes a la persona ("sos flojo en…"), ni uses notas, porcentajes o falsas precisiones.

Contraste con lo declarado (contrastWithDeclared):
- Si lo que el estudiante declaró (fortalezas, dificultades percibidas, objetivos) se relaciona con lo observado, escribí una o dos oraciones que lo contrasten con empatía y respeto: "Al inicio mencionaste que te costaba X; sin embargo, en esta actividad mostraste buen manejo de Y...". Lo declarado no es evidencia; lo observado tampoco es una sentencia definitiva.
- Si no hay relación clara, asigná null.

Próximos pasos (1 a 3):
- Concretos, dosificados y realizables esta semana. Tipos: REVIEW_CONCEPT, PRACTICE_WITH_TUTOR, TRY_ACTIVITY (solo con una actividad disponible A#), REFLECT.
- Fomentá la transferencia: proponé practicar en un contexto distinto del habitual para fortalecer la aplicación en nuevos escenarios.
- Solo podés usar refs curriculares o de actividades que aparezcan explícitamente en el mensaje.`;

export interface FeedbackInput {
  experienceDescription: string;
  declared: {
    strengths: string | null;
    difficulties: string | null;
    goals: string | null;
    currentContext: string | null;
  };
  inferences: { statement: string; support: string; curriculumRef: string | null }[];
  evaluations: string[];
  insufficient: string[];
  curriculum: { ref: string; title: string }[];
  availableActivities: { ref: string; title: string }[];
}

export function buildFeedbackMessage(input: FeedbackInput): string {
  const declared = [
    input.declared.currentContext && `Contexto actual: ${input.declared.currentContext}`,
    input.declared.goals && `Objetivos: ${input.declared.goals}`,
    input.declared.strengths && `Fortalezas que percibe: ${input.declared.strengths}`,
    input.declared.difficulties && `Dificultades que percibe: ${input.declared.difficulties}`,
  ].filter(Boolean);
  return [
    `Experiencia: ${input.experienceDescription}`,
    `Lo que el estudiante declaró sobre sí mismo (no es evidencia):\n${declared.length ? declared.join("\n") : "(no declaró nada)"}`,
    `Inferencias de este análisis (en segunda persona):\n${
      input.inferences.length
        ? input.inferences.map((i) => `- ${i.statement} [respaldo: ${i.support}${i.curriculumRef ? `; ítem ${i.curriculumRef}` : ""}]`).join("\n")
        : "(ninguna inferencia con respaldo suficiente)"
    }`,
    input.evaluations.length ? `Comparación con criterios:\n${input.evaluations.map((e) => `- ${e}`).join("\n")}` : "",
    input.insufficient.length ? `Sin evidencia suficiente todavía:\n${input.insufficient.map((e) => `- ${e}`).join("\n")}` : "",
    `Ítems curriculares:\n${input.curriculum.map((c) => `${c.ref}: ${c.title}`).join("\n")}`,
    `Actividades disponibles:\n${input.availableActivities.length ? input.availableActivities.map((a) => `${a.ref}: ${a.title}`).join("\n") : "(ninguna)"}`,
    "Escribí el feedback y los próximos pasos.",
  ]
    .filter(Boolean)
    .join("\n\n");
}
