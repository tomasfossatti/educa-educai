import { z } from 'zod';

/**
 * ============================================================================
 * EDUCAI: MOTOR DE MAPA DE CALOR Y ANÁLISIS DE PREGUNTAS
 * Contratos de Tipos de Dominio y Esquemas de Validación
 * ============================================================================
 */

export type ResolutionStatus = 'resolved' | 'blocked' | 'partially_resolved' | 'escalated';
export type StruggleLevel = 'low' | 'medium' | 'high' | 'critical';
export type ActivityType = 'peer_instruction' | 'live_demo' | 'fallacy_debunk' | 'concept_map' | 'quick_quiz';

/**
 * Interacción individual entre el alumno y el Tutor Socrático
 */
export interface ChatMessageTurn {
  role: 'student' | 'tutor';
  content: string;
  timestamp: string; // ISO-8601
  detectedSubconcept?: string;
  socraticTechnique?: string; // ej. 'counter_example', 'guided_question', 'analogous_case'
}

/**
 * Sesión completa de tutoría entre un estudiante y Educai
 * Almacenada en Firestore: courses/{courseId}/interaction_sessions/{sessionId}
 */
export interface StudentInteractionSession {
  id: string;
  courseId: number | string;
  assignmentId?: number | string;
  moduleUnit?: string; // ej. "Módulo 2: Arquitectura en Capas"
  
  // Privacidad por diseño: Hash no reversible del ID del alumno (ej. SHA256(student_id + salt_institucional))
  anonymousStudentId: string;
  
  // Marcas de tiempo
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  
  // Metadatos pedagógicos del diálogo
  primaryConcept: string; // ej. "Inversión de Control y Dependency Injection"
  synthesizedDoubt: string; // Resumen sintetizado de la duda real
  dialogueTurnCount: number;
  
  // Estado de resolución y nivel de fricción cognitiva
  resolutionStatus: ResolutionStatus;
  struggleLevel: StruggleLevel;
  cognitiveFrictionScore: number; // 0 (fluyó rápido) a 100 (bloqueo total / frustración)
  
  // Trazas de la conversación
  turns?: ChatMessageTurn[];
  tags: string[];
}

/**
 * Punto caliente conceptual (Hotspot) identificado en el aula
 */
export interface HeatmapHotspot {
  conceptId: string;
  conceptName: string;
  unitModule: string;
  
  // Métricas de impacto en el aula
  affectedStudentsCount: number;
  totalCourseStudents: number;
  affectedStudentsPercentage: number; // ej. 38.5%
  totalInquiriesCount: number;
  
  // Diagnóstico de aprendizaje
  averageFrictionScore: number; // 0 - 100
  unresolvedRatePercentage: number; // Porcentaje de alumnos que persistieron con la duda
  severity: StruggleLevel;
  
  // Análisis cualitativo para el docente
  rootMisconception: string; // El error conceptual de raíz
  sampleStudentQuestions: string[]; // 2-3 dudas textuales representativas y anonimizadas
  
  // Recomendaciones pedagógicas accionables
  pedagogicalAction: {
    suggestedRecap: string; // Qué explicar en los primeros 10-15 min de la próxima clase
    recommendedActivity: {
      type: ActivityType;
      title: string;
      description: string;
      estimatedMinutes: number;
    };
    syllabusReference?: string; // Referencia a la lectura en Siglo 21 / MECA
  };
}

/**
 * Modelo de datos consolidado que consume el Dashboard del Docente
 */
export interface TeacherDashboardHeatmapReport {
  courseId: string | number;
  courseName: string;
  period: string; // ej. "Cursado Presencial 2/26"
  generatedAt: string;
  timeframeDays: number;
  
  // Resumen ejecutivo de la comisión
  classOverview: {
    totalEnrolledStudents: number;
    activeConsultingStudents: number;
    totalDoubtSessions: number;
    overallResolutionRatePercentage: number;
    classHealthScore: number; // 0 - 100 (100 = sin bloqueos)
  };
  
  // Matriz de Puntos Calientes (ordenados por impacto y severidad descendente)
  hotspots: HeatmapHotspot[];
  
  // Síntesis ejecutiva y plan de acción sugerido para la siguiente clase sincrónica
  nextClassActionPlan: {
    priorityFocusTopic: string;
    totalSuggestedTimeMinutes: number;
    recommendedWarmup: string;
    suggestedDynamicExercise: string;
  };
}

// ============================================================================
// Esquemas Zod para Validación en Tiempo de Ejecución
// ============================================================================

export const ChatMessageTurnSchema = z.object({
  role: z.enum(['student', 'tutor']),
  content: z.string().min(1),
  timestamp: z.string(),
  detectedSubconcept: z.string().optional(),
  socraticTechnique: z.string().optional(),
});

export const StudentInteractionSessionSchema = z.object({
  id: z.string(),
  courseId: z.union([z.number(), z.string()]),
  assignmentId: z.union([z.number(), z.string()]).optional(),
  moduleUnit: z.string().optional(),
  anonymousStudentId: z.string(),
  startedAt: z.string(),
  endedAt: z.string(),
  durationSeconds: z.number().nonnegative(),
  primaryConcept: z.string(),
  synthesizedDoubt: z.string(),
  dialogueTurnCount: z.number().int().nonnegative(),
  resolutionStatus: z.enum(['resolved', 'blocked', 'partially_resolved', 'escalated']),
  struggleLevel: z.enum(['low', 'medium', 'high', 'critical']),
  cognitiveFrictionScore: z.number().min(0).max(100),
  turns: z.array(ChatMessageTurnSchema).optional(),
  tags: z.array(z.string()),
});

export const HeatmapHotspotSchema = z.object({
  conceptId: z.string(),
  conceptName: z.string(),
  unitModule: z.string(),
  affectedStudentsCount: z.number().int().nonnegative(),
  totalCourseStudents: z.number().int().positive(),
  affectedStudentsPercentage: z.number().min(0).max(100),
  totalInquiriesCount: z.number().int().nonnegative(),
  averageFrictionScore: z.number().min(0).max(100),
  unresolvedRatePercentage: z.number().min(0).max(100),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  rootMisconception: z.string(),
  sampleStudentQuestions: z.array(z.string()),
  pedagogicalAction: z.object({
    suggestedRecap: z.string(),
    recommendedActivity: z.object({
      type: z.enum(['peer_instruction', 'live_demo', 'fallacy_debunk', 'concept_map', 'quick_quiz']),
      title: z.string(),
      description: z.string(),
      estimatedMinutes: z.number().positive(),
    }),
    syllabusReference: z.string().optional(),
  }),
});

export const TeacherDashboardHeatmapReportSchema = z.object({
  courseId: z.union([z.number(), z.string()]),
  courseName: z.string(),
  period: z.string(),
  generatedAt: z.string(),
  timeframeDays: z.number().positive(),
  classOverview: z.object({
    totalEnrolledStudents: z.number().int().nonnegative(),
    activeConsultingStudents: z.number().int().nonnegative(),
    totalDoubtSessions: z.number().int().nonnegative(),
    overallResolutionRatePercentage: z.number().min(0).max(100),
    classHealthScore: z.number().min(0).max(100),
  }),
  hotspots: z.array(HeatmapHotspotSchema),
  nextClassActionPlan: z.object({
    priorityFocusTopic: z.string(),
    totalSuggestedTimeMinutes: z.number(),
    recommendedWarmup: z.string(),
    suggestedDynamicExercise: z.string(),
  }),
});
