import {
  StudentInteractionSession,
  TeacherDashboardHeatmapReport,
  TeacherDashboardHeatmapReportSchema,
} from './types.js';
import { IHeatmapRepository } from './firestore-schema.js';
import { LLMSemanticClusterer } from './llm-semantic-clusterer.js';

export interface AggregationJobOptions {
  courseId: string | number;
  courseName: string;
  periodName?: string;
  totalEnrolledStudents: number;
  syllabusConcepts: string[];
  timeframeDays?: number; // Ventana de tiempo (por defecto 7 días)
}

/**
 * Servicio Central de Agregación y Generación de Mapas de Calor para Educai
 * Puede ser ejecutado como rutina programada (Cron Job) o Cloud Function en Google Cloud / Firebase.
 */
export class HeatmapAggregationService {
  private repository: IHeatmapRepository;
  private clusterer: LLMSemanticClusterer;

  constructor(repository: IHeatmapRepository, clusterer?: LLMSemanticClusterer) {
    this.repository = repository;
    this.clusterer = clusterer || new LLMSemanticClusterer();
  }

  /**
   * Ejecuta el procesamiento analítico y genera el informe consolidado para el docente
   */
  public async generateCourseHeatmap(
    options: AggregationJobOptions
  ): Promise<TeacherDashboardHeatmapReport> {
    const timeframeDays = options.timeframeDays || 7;
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - timeframeDays);

    console.error(
      `[HeatmapAggregationService] Iniciando procesamiento para curso ${options.courseId} (${options.courseName})...`
    );

    // 1. Obtener trazas de interacción en la ventana temporal especificada
    const sessions = await this.repository.fetchRecentSessions(options.courseId, sinceDate);

    console.error(
      `[HeatmapAggregationService] Se recuperaron ${sessions.length} sesiones de interacción en los últimos ${timeframeDays} días.`
    );

    // 2. Calcular métricas generales del aula
    const uniqueStudents = new Set(sessions.map((s) => s.anonymousStudentId));
    const activeConsultingStudents = uniqueStudents.size;
    const totalDoubtSessions = sessions.length;

    const resolvedSessions = sessions.filter((s) => s.resolutionStatus === 'resolved').length;
    const overallResolutionRatePercentage =
      totalDoubtSessions > 0
        ? parseFloat(((resolvedSessions / totalDoubtSessions) * 100).toFixed(1))
        : 100;

    // 3. Ejecutar agrupamiento semántico de dudas contra el plan de estudio
    const { hotspots } = await this.clusterer.clusterSessions(
      options.courseName,
      options.syllabusConcepts,
      sessions,
      options.totalEnrolledStudents
    );

    // 4. Calcular índice de salud general del aula (0 a 100)
    // Se penaliza según el porcentaje de alumnos bloqueados y la fricción media
    let frictionPenalty = 0;
    if (hotspots.length > 0) {
      const criticalCount = hotspots.filter((h) => h.severity === 'critical').length;
      const highCount = hotspots.filter((h) => h.severity === 'high').length;
      frictionPenalty = Math.min(60, criticalCount * 20 + highCount * 10);
    }
    const classHealthScore = Math.max(20, Math.round(100 - frictionPenalty));

    // 5. Diseñar el plan de acción sugerido para la siguiente clase sincrónica
    const primaryHotspot = hotspots[0];
    const nextClassActionPlan = primaryHotspot
      ? {
          priorityFocusTopic: primaryHotspot.conceptName,
          totalSuggestedTimeMinutes:
            (primaryHotspot.pedagogicalAction.recommendedActivity.estimatedMinutes || 15) + 10,
          recommendedWarmup: primaryHotspot.pedagogicalAction.suggestedRecap,
          suggestedDynamicExercise: `[${primaryHotspot.pedagogicalAction.recommendedActivity.type.toUpperCase()}] ${
            primaryHotspot.pedagogicalAction.recommendedActivity.title
          }: ${primaryHotspot.pedagogicalAction.recommendedActivity.description}`,
        }
      : {
          priorityFocusTopic: 'Sin puntos críticos detectados',
          totalSuggestedTimeMinutes: 10,
          recommendedWarmup:
            'Los alumnos no han experimentado bloqueos significativos. Comenzar la clase con preguntas abiertas de sondeo general.',
          suggestedDynamicExercise: 'Espacio libre para consultas individuales y avance de proyectos.',
        };

    const report: TeacherDashboardHeatmapReport = {
      courseId: options.courseId,
      courseName: options.courseName,
      period: options.periodName || 'Período Activo',
      generatedAt: new Date().toISOString(),
      timeframeDays,
      classOverview: {
        totalEnrolledStudents: options.totalEnrolledStudents,
        activeConsultingStudents,
        totalDoubtSessions,
        overallResolutionRatePercentage,
        classHealthScore,
      },
      hotspots,
      nextClassActionPlan,
    };

    // Validar integridad estructural con Zod
    TeacherDashboardHeatmapReportSchema.parse(report);

    // 6. Guardar en el repositorio (Firestore)
    await this.repository.saveHeatmapReport(report);

    console.error(
      `[HeatmapAggregationService] Reporte de mapa de calor generado y persistido exitosamente (${hotspots.length} hotspots identificados).`
    );

    return report;
  }
}

/**
 * Adaptador para Cloud Functions de Firebase / Google Cloud
 * Puede invocarse mediante un trigger de Google Cloud Pub/Sub o petición HTTP protegida
 */
export async function handleHeatmapAggregationCloudFunction(
  req: { body: AggregationJobOptions },
  res: { status: (code: number) => { json: (data: any) => void } },
  repository: IHeatmapRepository
): Promise<void> {
  try {
    const service = new HeatmapAggregationService(repository);
    const report = await service.generateCourseHeatmap(req.body);
    res.status(200).json({ success: true, report });
  } catch (err) {
    console.error('[CloudFunction] Error en agregación:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
