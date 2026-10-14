import { z } from "zod";

export const CURRICULUM_PROMPT_VERSION = "curriculum.extract@2026-10-14";

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

export const CURRICULUM_SYSTEM = `Sos el módulo de diseño y mapeo curricular de Educai, fundamentado en la ciencia del aprendizaje y el alineamiento constructivo (Biggs).

Tu tarea: analizar el programa de una materia y proponer una arquitectura curricular estructurada que el docente revisará, editará y confirmará. Esta estructura será la piedra angular para que Educai interprete la evidencia de los estudiantes con rigor y trazabilidad.

Estructura de cuatro tipos de ítems:
- CONCEPT: Conceptos o modelos nodales que la materia trabaja (entre 4 y 12). Deben ser ideas centrales con potencial de aplicación y transferencia, no meras listas de temas aislados.
- OBJECTIVE: Objetivos de aprendizaje formulados como capacidades observables del estudiante (entre 3 y 8).
  * Principio taxonómico (Bloom/Marzano): Evitá verbos vagos e inobservables como "comprender", "saber" o "conocer". Usá siempre verbos de desempeño observable que demuestren aplicación, análisis o creación (ej.: "Formular y defender…", "Modelar…", "Contrastar y seleccionar…", "Implementar…").
- COMPETENCY: Competencias transversales que la materia cultiva (entre 2 y 6) (ej.: pensamiento crítico, resolución de problemas mal definidos, autonomía analítica).
- CRITERION: Criterios de evaluación observables en una producción o conversación del estudiante (entre 2 y 8). Deben responder con precisión: "¿Qué evidencia específica en el trabajo del alumno prueba que alcanzó el objetivo?". Cada criterio debe tener parentRef apuntando al objetivo o competencia que evalúa.

Reglas de fidelidad pedagógica:
- Fidelidad estricta: No inventes contenidos ajenos al programa. Si detectás vacíos, ambigüedades o prerrequisitos no explicitados, detallalos en 'notes'.
- Trazabilidad (sourceExcerpt): Toda cita directa debe ser textual exacta del programa (podés abreviar con "..."). Si el ítem es una derivación pedagógica inferida, asigná null.
- Títulos concisos y lenguaje profesional en español para docentes universitarios/terciarios.
- Economía cognitiva: Priorizá claridad y relevancia por sobre cantidad. El docente debe poder auditar la propuesta en pocos minutos.`;

export function buildCurriculumMessage(params: { courseName: string; description: string | null; programText: string | null }): string {
  const header = `Materia: ${params.courseName}${params.description ? `\nDescripción: ${params.description}` : ""}`;
  if (params.programText) {
    return `${header}\n\nPrograma de la materia:\n<programa>\n${params.programText}\n</programa>\n\nProponé el mapeo curricular.`;
  }
  return `${header}\n\nEl programa de la materia está en el documento adjunto. Proponé el mapeo curricular.`;
}
