import {
  TeacherDashboardHeatmapReport,
  HeatmapHotspot,
} from './types.js';

/**
 * ============================================================================
 * EDUCAI: VISTA Y DTO PARA EL PANEL DEL PROFESOR (TEACHER DASHBOARD)
 * ============================================================================
 */

export interface DashboardMetricCard {
  title: string;
  value: string | number;
  subtitle: string;
  trend?: 'positive' | 'warning' | 'negative' | 'neutral';
  color: string; // Código hexadecimal para badges UI (Tailwind / CSS)
}

export interface HotspotCardView {
  id: string;
  rank: number;
  conceptName: string;
  unitModule: string;
  affectedPercentageFormatted: string; // ej. "42.5%"
  affectedStudentsRatio: string; // ej. "17 de 40 alumnos"
  totalQueriesCount: number;
  severityBadge: {
    label: string; // "CRÍTICO", "ALTO", "MEDIO", "LEVE"
    colorHex: string;
    bgColorHex: string;
  };
  frictionScoreBar: {
    value: number; // 0 - 100
    colorHex: string;
  };
  resolutionStatusRatio: {
    resolvedPct: number;
    blockedPct: number;
  };
  rootMisconception: string;
  sampleQuestions: string[];
  actionPlan: {
    suggestedRecap: string;
    activityTitle: string;
    activityTypeLabel: string;
    activityDescription: string;
    estimatedMinutes: number;
    syllabusReference?: string;
  };
}

export interface TeacherDashboardViewDTO {
  courseId: string | number;
  courseName: string;
  period: string;
  generatedDateFormatted: string;
  metrics: {
    enrolledStudents: DashboardMetricCard;
    activeConsultants: DashboardMetricCard;
    resolutionRate: DashboardMetricCard;
    classHealthScore: DashboardMetricCard;
  };
  executiveBriefing: {
    priorityTopic: string;
    allocatedClassTime: string;
    actionHeadline: string;
    recommendedWarmup: string;
    recommendedDynamicExercise: string;
  };
  hotspotsList: HotspotCardView[];
}

/**
 * Transforma el reporte analítico en un DTO optimizado para el frontend del docente
 */
export function formatDashboardForFrontend(
  report: TeacherDashboardHeatmapReport
): TeacherDashboardViewDTO {
  const getSeverityInfo = (severity: string) => {
    switch (severity) {
      case 'critical':
        return { label: 'CRÍTICO', colorHex: '#DC2626', bgColorHex: '#FEE2E2' };
      case 'high':
        return { label: 'ALTO', colorHex: '#EA580C', bgColorHex: '#FFEDD5' };
      case 'medium':
        return { label: 'MEDIO', colorHex: '#D97706', bgColorHex: '#FEF3C7' };
      default:
        return { label: 'LEVE', colorHex: '#059669', bgColorHex: '#D1FAE5' };
    }
  };

  const getActivityTypeLabel = (type: string) => {
    switch (type) {
      case 'peer_instruction':
        return 'Peer Instruction (Discusión en Parejas)';
      case 'live_demo':
        return 'Live Coding / Demostración en Vivo';
      case 'fallacy_debunk':
        return 'Desmitificación de Falacia Conceptual';
      case 'concept_map':
        return 'Construcción de Mapa Conceptual Colaborativo';
      case 'quick_quiz':
        return 'Sondeo Rápido / Quiz Diagnóstico';
      default:
        return 'Actividad Práctica Dinámica';
    }
  };

  const hotspotsList: HotspotCardView[] = report.hotspots.map((h, index) => {
    const sev = getSeverityInfo(h.severity);
    return {
      id: h.conceptId,
      rank: index + 1,
      conceptName: h.conceptName,
      unitModule: h.unitModule,
      affectedPercentageFormatted: `${h.affectedStudentsPercentage}%`,
      affectedStudentsRatio: `${h.affectedStudentsCount} de ${h.totalCourseStudents} alumnos`,
      totalQueriesCount: h.totalInquiriesCount,
      severityBadge: sev,
      frictionScoreBar: {
        value: h.averageFrictionScore,
        colorHex: sev.colorHex,
      },
      resolutionStatusRatio: {
        resolvedPct: Math.round(100 - h.unresolvedRatePercentage),
        blockedPct: Math.round(h.unresolvedRatePercentage),
      },
      rootMisconception: h.rootMisconception,
      sampleQuestions: h.sampleStudentQuestions,
      actionPlan: {
        suggestedRecap: h.pedagogicalAction.suggestedRecap,
        activityTitle: h.pedagogicalAction.recommendedActivity.title,
        activityTypeLabel: getActivityTypeLabel(h.pedagogicalAction.recommendedActivity.type),
        activityDescription: h.pedagogicalAction.recommendedActivity.description,
        estimatedMinutes: h.pedagogicalAction.recommendedActivity.estimatedMinutes,
        syllabusReference: h.pedagogicalAction.syllabusReference,
      },
    };
  });

  return {
    courseId: report.courseId,
    courseName: report.courseName,
    period: report.period,
    generatedDateFormatted: new Date(report.generatedAt).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    metrics: {
      enrolledStudents: {
        title: 'Alumnos Matriculados',
        value: report.classOverview.totalEnrolledStudents,
        subtitle: 'Comisión activa',
        color: '#2563EB',
      },
      activeConsultants: {
        title: 'Alumnos que Consultaron',
        value: `${report.classOverview.activeConsultingStudents} (${Math.round(
          (report.classOverview.activeConsultingStudents /
            Math.max(report.classOverview.totalEnrolledStudents, 1)) *
            100
        )}%)`,
        subtitle: `${report.classOverview.totalDoubtSessions} diálogos con el tutor`,
        color: '#7C3AED',
      },
      resolutionRate: {
        title: 'Tasa de Resolución con Tutor',
        value: `${report.classOverview.overallResolutionRatePercentage}%`,
        subtitle: 'Dudas aclaradas socráticamente',
        color: report.classOverview.overallResolutionRatePercentage >= 70 ? '#059669' : '#DC2626',
        trend: report.classOverview.overallResolutionRatePercentage >= 70 ? 'positive' : 'warning',
      },
      classHealthScore: {
        title: 'Salud Conceptual del Aula',
        value: `${report.classOverview.classHealthScore}/100`,
        subtitle:
          report.classOverview.classHealthScore >= 75
            ? 'Ritmo óptimo'
            : report.classOverview.classHealthScore >= 50
            ? 'Atención requerida'
            : 'Fricción crítica',
        color:
          report.classOverview.classHealthScore >= 75
            ? '#059669'
            : report.classOverview.classHealthScore >= 50
            ? '#D97706'
            : '#DC2626',
      },
    },
    executiveBriefing: {
      priorityTopic: report.nextClassActionPlan.priorityFocusTopic,
      allocatedClassTime: `${report.nextClassActionPlan.totalSuggestedTimeMinutes} minutos`,
      actionHeadline: `Intervención recomendada para ${report.nextClassActionPlan.priorityFocusTopic}`,
      recommendedWarmup: report.nextClassActionPlan.recommendedWarmup,
      recommendedDynamicExercise: report.nextClassActionPlan.suggestedDynamicExercise,
    },
    hotspotsList,
  };
}

/**
 * Genera una representación en Markdown lista para ser leída por un docente
 * en la interfaz de chat de Educai o exportada a reportes PDF.
 */
export function formatHeatmapReportAsMarkdown(report: TeacherDashboardHeatmapReport): string {
  let md = `# 📊 Mapa de Calor de Dudas y Análisis de Preguntas - Educai\n\n`;
  md += `**Curso**: ${report.courseName} (ID: \`${report.courseId}\`)  \n`;
  md += `**Período**: ${report.period} | **Generado**: ${new Date(report.generatedAt).toLocaleString('es-AR')}\n\n`;

  md += `### 📌 Estado General de la Comisión\n`;
  md += `- **Total de Alumnos**: ${report.classOverview.totalEnrolledStudents}\n`;
  md += `- **Alumnos con Consultas Activas**: ${report.classOverview.activeConsultingStudents} (${Math.round(
    (report.classOverview.activeConsultingStudents / Math.max(report.classOverview.totalEnrolledStudents, 1)) * 100
  )}%)\n`;
  md += `- **Total de Sesiones de Tutoría**: ${report.classOverview.totalDoubtSessions}\n`;
  md += `- **Tasa de Resolución Socrática**: ${report.classOverview.overallResolutionRatePercentage}%\n`;
  md += `- **Índice de Salud Conceptual**: ${report.classOverview.classHealthScore} / 100\n\n`;

  md += `---\n\n`;
  md += `### 🎯 Plan de Acción Recomendado para la Próxima Clase (${report.nextClassActionPlan.totalSuggestedTimeMinutes} min)\n`;
  md += `**Tema Prioritario**: *${report.nextClassActionPlan.priorityFocusTopic}*\n\n`;
  md += `**1. Repaso Inicial (Warm-up - 10 min)**:\n`;
  md += `> ${report.nextClassActionPlan.recommendedWarmup}\n\n`;
  md += `**2. Actividad Dinámica en el Aula**:\n`;
  md += `> ${report.nextClassActionPlan.suggestedDynamicExercise}\n\n`;

  md += `---\n\n`;
  md += `### 🌡️ Puntos Calientes (Hotspots) en el Aula (${report.hotspots.length} identificados)\n\n`;

  for (let i = 0; i < report.hotspots.length; i++) {
    const h = report.hotspots[i];
    const icon = h.severity === 'critical' ? '🔴' : h.severity === 'high' ? '🟠' : h.severity === 'medium' ? '🟡' : '🟢';
    md += `#### ${icon} #${i + 1} ${h.conceptName} [${h.severity.toUpperCase()}]\n`;
    md += `- **Módulo**: ${h.unitModule}\n`;
    md += `- **Alumnos Afectados**: **${h.affectedStudentsPercentage}%** (${h.affectedStudentsCount} de ${h.totalCourseStudents} alumnos)\n`;
    md += `- **Consultas Registradas**: ${h.totalInquiriesCount} (Bloqueo no resuelto: ${h.unresolvedRatePercentage}%)\n`;
    md += `- **Fricción Cognitiva Media**: ${h.averageFrictionScore} / 100\n`;
    md += `- **Obstáculo / Confusión de Base**: *${h.rootMisconception}*\n`;
    
    if (h.sampleStudentQuestions.length > 0) {
      md += `- **Preguntas Típicas Anonimizadas**:\n`;
      for (const q of h.sampleStudentQuestions) {
        md += `  - *" ${q} "*\n`;
      }
    }

    md += `- **Acción Pedagógica Sugerida**:\n`;
    md += `  - **Repaso**: ${h.pedagogicalAction.suggestedRecap}\n`;
    md += `  - **Dinámica**: **${h.pedagogicalAction.recommendedActivity.title}** (${h.pedagogicalAction.recommendedActivity.estimatedMinutes} min) - ${h.pedagogicalAction.recommendedActivity.description}\n\n`;
  }

  return md;
}
