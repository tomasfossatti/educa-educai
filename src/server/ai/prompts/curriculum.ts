import { z } from "zod";

export const CURRICULUM_PROMPT_VERSION = "curriculum.extract@2026-10-04";

export const curriculumExtractionSchema = z.object({
  items: z.array(
    z.object({
      ref: z.string().describe("Identificador corto y único: C1.. conceptos, O1.. objetivos, K1.. competencias, R1.. criterios"),
      kind: z.enum(["CONCEPT", "OBJECTIVE", "COMPETENCY", "CRITERION"]),
      title: z.string().describe("Nombre breve, máximo 12 palabras"),
      description: z.string().describe("Una o dos oraciones que expliquen qué incluye o qué se espera"),
      sourceExcerpt: z
        .string()
        .nullable()
        .describe("Cita textual del programa que lo respalda; null si el ítem es una propuesta derivada sin cita directa"),
      parentRef: z
        .string()
        .nullable()
        .describe("Solo para criterios: ref del objetivo o competencia que evalúa. null en otros casos"),
    }),
  ),
  notes: z
    .string()
    .nullable()
    .describe("Advertencias para el docente: ambigüedades del programa o partes que no se pudieron mapear"),
});

export type CurriculumExtraction = z.infer<typeof curriculumExtractionSchema>;

export const CURRICULUM_SYSTEM = `Sos el módulo de mapeo curricular de Educai, una plataforma que interpreta evidencia de aprendizaje.

Tu tarea: leer el programa de una materia y proponer una estructura curricular que el docente va a revisar, editar y confirmar. Esa estructura será la referencia para interpretar la evidencia que generen los estudiantes, así que tiene que ser fiel al programa y útil para observar aprendizaje.

Producí cuatro tipos de ítems:
- CONCEPT: conceptos o contenidos centrales que la materia trabaja (entre 4 y 12).
- OBJECTIVE: objetivos de aprendizaje, redactados como lo que el estudiante debería poder hacer (entre 3 y 8). Empezá con un verbo observable ("Formular…", "Elegir y justificar…").
- COMPETENCY: capacidades transversales que la materia busca desarrollar (entre 2 y 6).
- CRITERION: criterios de evaluación observables en una producción del estudiante (entre 2 y 8). Si el programa no los explicita, derivalos de los objetivos y dejá sourceExcerpt en null.

Reglas:
- No inventes contenidos que el programa no menciona. Si algo no está, mencionalo en notes.
- sourceExcerpt debe ser una cita textual exacta del programa (podés acortarla con "..."). Si el ítem es una derivación tuya, usá null.
- Títulos cortos y concretos. Descripciones en español, claras para un docente.
- Cada criterio debe tener parentRef apuntando al objetivo o competencia que evalúa, cuando exista.
- Preferí pocos ítems bien definidos antes que listas largas: el docente tiene que poder revisarlos en pocos minutos.`;

export function buildCurriculumMessage(params: { courseName: string; description: string | null; programText: string | null }): string {
  const header = `Materia: ${params.courseName}${params.description ? `\nDescripción: ${params.description}` : ""}`;
  if (params.programText) {
    return `${header}\n\nPrograma de la materia:\n<programa>\n${params.programText}\n</programa>\n\nProponé el mapeo curricular.`;
  }
  return `${header}\n\nEl programa de la materia está en el documento adjunto. Proponé el mapeo curricular.`;
}
