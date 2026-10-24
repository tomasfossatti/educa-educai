import { z } from 'zod';
import {
  StudentInteractionSession,
  HeatmapHotspot,
  ActivityType,
} from './types.js';

/**
 * Esquema de salida estructurada del LLM para el agrupamiento semántico
 */
export const LLMSemanticClusterOutputSchema = z.object({
  clusters: z.array(
    z.object({
      conceptKey: z.string().describe('Concepto central del programa de estudio'),
      unitModule: z.string().describe('Módulo o lectura del programa'),
      rootMisconception: z
        .string()
        .describe('La confusión conceptual subyacente que origina las dudas'),
      sessionIds: z
        .array(z.string())
        .describe('IDs de las sesiones que pertenecen a este grupo semántico'),
      sampleDoubts: z
        .array(z.string())
        .describe('2 a 3 dudas textuales representativas y anonimizadas'),
      pedagogicalIntervention: z.object({
        suggestedRecap: z
          .string()
          .describe('Explicación concisa sugerida para los primeros 10 minutos de la clase'),
        recommendedActivity: z.object({
          type: z.enum([
            'peer_instruction',
            'live_demo',
            'fallacy_debunk',
            'concept_map',
            'quick_quiz',
          ]),
          title: z.string(),
          description: z
            .string()
            .describe('Instrucciones paso a paso del ejercicio práctico para la clase'),
          estimatedMinutes: z.number().int().positive(),
        }),
      }),
    })
  ),
  globalObservation: z.string().describe('Síntesis del estado cognitivo de la comisión'),
});

export type LLMSemanticClusterOutput = z.infer<typeof LLMSemanticClusterOutputSchema>;

/**
 * Interfaz genérica para proveedores de LLM (OpenAI, Gemini, Anthropic o local)
 */
export interface ILLMProvider {
  generateStructuredCluster(prompt: string): Promise<LLMSemanticClusterOutput>;
}

/**
 * Agrupador semántico de dudas mediante LLM
 */
export class LLMSemanticClusterer {
  private llmProvider?: ILLMProvider;

  constructor(llmProvider?: ILLMProvider) {
    this.llmProvider = llmProvider;
  }

  /**
   * Genera el prompt analítico para el LLM
   */
  public buildPrompt(
    courseName: string,
    syllabusConcepts: string[],
    sessions: StudentInteractionSession[]
  ): string {
    const serializedSessions = sessions.map((s) => ({
      sessionId: s.id,
      studentId: s.anonymousStudentId,
      conceptReported: s.primaryConcept,
      doubt: s.synthesizedDoubt,
      status: s.resolutionStatus,
      frictionScore: s.cognitiveFrictionScore,
      durationSec: s.durationSeconds,
    }));

    return `
Eres el motor de inteligencia pedagógica de Educai para la plataforma de Universidad Siglo 21.
Tu misión es analizar las interacciones entre los alumnos y el tutor socrático en la materia "${courseName}", agrupar semánticamente las dudas recurrentes y generar el mapa de calor con recomendaciones de clase para el docente.

CONCEPTOS CLAVE DEL PLAN DE ESTUDIO:
${syllabusConcepts.map((c, i) => `${i + 1}. ${c}`).join('\n')}

TRAZAS DE INTERACCIONES DE ALUMNOS (${serializedSessions.length} consultas analizadas):
${JSON.stringify(serializedSessions, null, 2)}

INSTRUCCIONES ANALÍTICAS:
1. Agrupa las dudas que compartan el mismo obstáculo conceptual de raíz, incluso si los estudiantes las redactaron con palabras diferentes.
2. Identifica con precisión la "rootMisconception" (el error de base, por ejemplo: confundir herencia con composición, o no entender cuándo aplicar transacciones).
3. Asocia cada grupo al concepto del plan de estudio más relevante.
4. Diseña una intervención pedagógica accionable para la próxima clase sincrónica:
   - "suggestedRecap": Un resumen claro y sin rodeos que el profesor pueda explicar al iniciar la clase.
   - "recommendedActivity": Una actividad dinámica (Peer Instruction, Live Demo, Desmitificación de falacias, etc.) de 10 a 20 minutos con instrucciones concretas.

Debes responder estrictamente en formato JSON válido conforme a este esquema:
{
  "clusters": [
    {
      "conceptKey": "string",
      "unitModule": "string",
      "rootMisconception": "string",
      "sessionIds": ["string"],
      "sampleDoubts": ["string"],
      "pedagogicalIntervention": {
        "suggestedRecap": "string",
        "recommendedActivity": {
          "type": "peer_instruction" | "live_demo" | "fallacy_debunk" | "concept_map" | "quick_quiz",
          "title": "string",
          "description": "string",
          "estimatedMinutes": number
        }
      }
    }
  ],
  "globalObservation": "string"
}
`.trim();
  }

  /**
   * Procesa las sesiones y construye los puntos calientes (Hotspots) consolidados
   */
  public async clusterSessions(
    courseName: string,
    syllabusConcepts: string[],
    sessions: StudentInteractionSession[],
    totalCourseStudents: number
  ): Promise<{ hotspots: HeatmapHotspot[]; globalObservation: string }> {
    if (sessions.length === 0) {
      return { hotspots: [], globalObservation: 'No se registraron consultas en este período.' };
    }

    let clusterOutput: LLMSemanticClusterOutput;

    if (this.llmProvider) {
      const prompt = this.buildPrompt(courseName, syllabusConcepts, sessions);
      clusterOutput = await this.llmProvider.generateStructuredCluster(prompt);
    } else {
      // Fallback heurístico inteligente (offline / entorno de desarrollo)
      clusterOutput = this.heuristicClusterFallback(syllabusConcepts, sessions);
    }

    // Mapear cada cluster a la estructura oficial de HeatmapHotspot
    const sessionMap = new Map<string, StudentInteractionSession>(
      sessions.map((s) => [s.id, s])
    );

    const hotspots: HeatmapHotspot[] = clusterOutput.clusters.map((cluster, idx) => {
      const clusterSessions = cluster.sessionIds
        .map((id) => sessionMap.get(id))
        .filter((s): s is StudentInteractionSession => Boolean(s));

      const uniqueStudents = new Set(clusterSessions.map((s) => s.anonymousStudentId));
      const affectedStudentsCount = uniqueStudents.size;
      const affectedStudentsPercentage = parseFloat(
        ((affectedStudentsCount / Math.max(totalCourseStudents, 1)) * 100).toFixed(1)
      );

      const unresolvedCount = clusterSessions.filter(
        (s) => s.resolutionStatus === 'blocked' || s.resolutionStatus === 'escalated'
      ).length;

      const unresolvedRatePercentage = parseFloat(
        ((unresolvedCount / Math.max(clusterSessions.length, 1)) * 100).toFixed(1)
      );

      const totalFriction = clusterSessions.reduce((sum, s) => sum + s.cognitiveFrictionScore, 0);
      const averageFrictionScore = Math.round(
        totalFriction / Math.max(clusterSessions.length, 1)
      );

      // Calcular severidad pedagógica basada en porcentaje de alumnos y fricción
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (affectedStudentsPercentage >= 35 || averageFrictionScore >= 75) {
        severity = 'critical';
      } else if (affectedStudentsPercentage >= 20 || averageFrictionScore >= 50) {
        severity = 'high';
      } else if (affectedStudentsPercentage >= 10 || averageFrictionScore >= 30) {
        severity = 'medium';
      }

      const conceptSlug = cluster.conceptKey
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      return {
        conceptId: `hotspot_${conceptSlug}_${idx + 1}`,
        conceptName: cluster.conceptKey,
        unitModule: cluster.unitModule || 'Módulo Principal',
        affectedStudentsCount,
        totalCourseStudents,
        affectedStudentsPercentage,
        totalInquiriesCount: clusterSessions.length,
        averageFrictionScore,
        unresolvedRatePercentage,
        severity,
        rootMisconception: cluster.rootMisconception,
        sampleStudentQuestions: cluster.sampleDoubts.slice(0, 3),
        pedagogicalAction: {
          suggestedRecap: cluster.pedagogicalIntervention.suggestedRecap,
          recommendedActivity: cluster.pedagogicalIntervention.recommendedActivity,
          syllabusReference: `Lectura Siglo 21 / MECA: ${cluster.conceptKey}`,
        },
      };
    });

    // Ordenar de mayor a menor impacto (severidad y porcentaje de alumnos afectados)
    hotspots.sort((a, b) => {
      const severityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
      const diff = severityWeight[b.severity] - severityWeight[a.severity];
      if (diff !== 0) return diff;
      return b.affectedStudentsPercentage - a.affectedStudentsPercentage;
    });

    return {
      hotspots,
      globalObservation: clusterOutput.globalObservation,
    };
  }

  /**
   * Motor heurístico de agrupamiento semántico para pruebas o entornos sin LLM activo
   */
  private heuristicClusterFallback(
    syllabusConcepts: string[],
    sessions: StudentInteractionSession[]
  ): LLMSemanticClusterOutput {
    const groups = new Map<string, StudentInteractionSession[]>();

    for (const session of sessions) {
      // Intentar coincidir con el concepto del syllabus más cercano
      const concept =
        syllabusConcepts.find((c) =>
          session.primaryConcept.toLowerCase().includes(c.toLowerCase()) ||
          c.toLowerCase().includes(session.primaryConcept.toLowerCase())
        ) || session.primaryConcept;

      const list = groups.get(concept) || [];
      list.push(session);
      groups.set(concept, list);
    }

    const clusters = Array.from(groups.entries()).map(([concept, sessionList]) => {
      const sampleDoubts = sessionList
        .map((s) => s.synthesizedDoubt)
        .filter(Boolean)
        .slice(0, 3);

      return {
        conceptKey: concept,
        unitModule: sessionList[0]?.moduleUnit || 'Módulo Teórico',
        rootMisconception: `Dificultad recurrente para asociar la definición formal de "${concept}" con su implementación práctica en las actividades.`,
        sessionIds: sessionList.map((s) => s.id),
        sampleDoubts: sampleDoubts.length > 0 ? sampleDoubts : [`Dudas sobre ${concept}`],
        pedagogicalIntervention: {
          suggestedRecap: `Dedicar 10 minutos al inicio de la clase para modelar en la pizarra un caso de uso real de ${concept}, contrastándolo con alternativas no recomendadas.`,
          recommendedActivity: {
            type: 'peer_instruction' as ActivityType,
            title: `Peer Instruction: Dilema conceptual sobre ${concept}`,
            description: `Presentar un fragmento de código con un error conceptual sutil sobre ${concept}. Pedir a los alumnos que voten individualmente (1 min), discutan en parejas (3 min) y revoten antes de la explicación del docente.`,
            estimatedMinutes: 15,
          },
        },
      };
    });

    return {
      clusters,
      globalObservation: `Se procesaron ${sessions.length} consultas en ${clusters.length} núcleos temáticos del curso.`,
    };
  }
}
