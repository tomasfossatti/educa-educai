import { z } from "zod";
import { ENGINE_PRINCIPLES, renderCurriculum, type RefCurriculumItem } from "./shared";

export const inferenceSchema = z.object({
  inferences: z.array(
    z.object({
      statement: z.string().describe("Redacción para el docente, tentativa y concreta"),
      studentStatement: z.string().describe("Redacción para el estudiante, en segunda persona (vos), sin etiquetas"),
      dimension: z.enum(["COMPREHENSION", "APPLICATION", "TRANSFER", "AUTONOMY"]),
      polarity: z.enum(["STRENGTH", "DIFFICULTY", "MIXED"]),
      curriculumRef: z.string().nullable(),
      supportingSignalRefs: z.array(z.string()).describe("Señales que la respaldan: S# (nuevas) o H# (históricas)"),
      contradictingSignalRefs: z.array(z.string()).describe("Señales S# o H# que apuntan en sentido opuesto"),
      proposedSupport: z.enum(["CONSISTENT", "PARTIAL", "INSUFFICIENT", "CONTRADICTORY"]),
      supportRationale: z.string().describe("Por qué ese nivel de respaldo"),
      contradictionNote: z.string().nullable().describe("Si hay señales opuestas, qué conviene revisar; si no, null"),
      supersedesInferenceRef: z.string().nullable().describe("Ref de una inferencia previa (I#) que esta actualiza, o null"),
      priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
      teacherAction: z
        .object({
          type: z.enum(["EXPLAIN_IN_CLASS", "ASK_STUDENT", "REGROUP", "ASSIGN_PRACTICE", "GIVE_FEEDBACK", "PROPOSE_CHALLENGE"]),
          description: z.string(),
        })
        .nullable(),
    }),
  ),
  insufficientAreas: z.array(
    z.object({
      curriculumRef: z.string().nullable(),
      dimension: z.enum(["COMPREHENSION", "APPLICATION", "TRANSFER", "AUTONOMY"]),
      note: z.string().describe("Qué falta observar para poder decir algo"),
    }),
  ),
});

export type InferenceOutput = z.infer<typeof inferenceSchema>;

export const INFER_SYSTEM = `Sos el módulo de INFERENCIA del Interpretation Engine de Educai.

Recibís señales nuevas de una experiencia (S#), señales históricas del mismo estudiante (H#) y las inferencias previas activas. Producís hipótesis sobre su desarrollo que un docente va a revisar. Una inferencia no es un hecho.

${ENGINE_PRINCIPLES}

Cómo formular:
- Lenguaje tentativo: "Aparece evidencia de…", "Las señales sugieren…", "En esta actividad…". Nunca "es", "no sabe", "tiene un problema".
- statement (para el docente): concreto, nombra el tema y las condiciones (fuente, asistencia, contexto).
- studentStatement (para el estudiante): segunda persona con voseo, describe lo observado y en qué condiciones, sin etiquetarlo.

Respaldo (proposedSupport):
- CONSISTENT: al menos dos evidencias en al menos dos experiencias distintas coinciden, sin señales opuestas.
- PARTIAL: hay evidencia, pero de una sola fuente o experiencia, o con condiciones que limitan la conclusión.
- CONTRADICTORY: hay señales en sentido opuesto sobre el mismo tema y dimensión que no se explican por una evolución en el tiempo. Citalas en contradictingSignalRefs y explicá qué revisar en contradictionNote.
- Si la evidencia no alcanza, no generes la inferencia: registrala en insufficientAreas.

Historia y evolución:
- Contrastá las señales nuevas con las históricas. Una dificultad anterior seguida de una fortaleza posterior es evolución, no contradicción: describila ("antes…, en esta actividad…") y, si actualiza una inferencia previa (I#), indicá supersedesInferenceRef.
- Si una inferencia previa fue revisada por el docente, respetá su veredicto y comentario.
- Las posibles contradicciones precalculadas son pistas: confirmalas o descartalas con criterio.

Prioridad y acción:
- HIGH: dificultad sobre un objetivo central, o contradicción que conviene mirar ya. MEDIUM: lo habitual. LOW: fortalezas sin acción urgente.
- teacherAction: una acción docente concreta y breve si aporta; si no, null.

Límites: máximo 5 inferencias, priorizando lo que puede cambiar una decisión docente. Solo podés citar refs que aparecen en el mensaje.`;

export interface InferInput {
  courseName: string;
  curriculum: RefCurriculumItem[];
  experienceDescription: string;
  newSignals: SignalLine[];
  historicalSignals: SignalLine[];
  priorInferences: {
    ref: string;
    statement: string;
    dimension: string;
    polarity: string;
    curriculumRef: string | null;
    supportStatus: string;
    reviewStatus: string;
    teacherComment: string | null;
    createdAt: string;
  }[];
  potentialContradictions: string[];
  evaluations: string[];
}

export interface SignalLine {
  ref: string;
  dimension: string;
  polarity: string;
  curriculumRef: string | null;
  description: string;
  source: string;
  assistanceLevel: string;
  occurredAt: string;
  experienceTitle: string;
  excerpt: string;
}

function renderSignal(s: SignalLine): string {
  return `[${s.ref}] ${s.dimension}/${s.polarity} sobre ${s.curriculumRef ?? "general"} — ${s.description} (fuente: ${s.source}, "${s.experienceTitle}", ${s.occurredAt}, asistencia: ${s.assistanceLevel}). Cita: "${s.excerpt}"`;
}

export function buildInferMessage(input: InferInput): string {
  return [
    `Materia: ${input.courseName}`,
    `Experiencia analizada: ${input.experienceDescription}`,
    `Currícula (refs):\n${renderCurriculum(input.curriculum)}`,
    `Señales nuevas:\n${input.newSignals.map(renderSignal).join("\n")}`,
    `Señales históricas relacionadas:\n${input.historicalSignals.length ? input.historicalSignals.map(renderSignal).join("\n") : "(ninguna)"}`,
    `Inferencias previas activas:\n${
      input.priorInferences.length
        ? input.priorInferences
            .map(
              (i) =>
                `[${i.ref}] ${i.dimension}/${i.polarity} sobre ${i.curriculumRef ?? "general"} (${i.createdAt}; respaldo ${i.supportStatus}; revisión docente: ${i.reviewStatus}${i.teacherComment ? `; comentario: "${i.teacherComment}"` : ""}): ${i.statement}`,
            )
            .join("\n")
        : "(ninguna)"
    }`,
    `Posibles contradicciones detectadas automáticamente:\n${input.potentialContradictions.length ? input.potentialContradictions.join("\n") : "(ninguna)"}`,
    input.evaluations.length ? `Evaluación contra criterios en esta experiencia:\n${input.evaluations.join("\n")}` : "",
    "Producí las inferencias.",
  ]
    .filter(Boolean)
    .join("\n\n");
}
