/**
 * Reporte de métricas del piloto por consola.
 *   npm run metrics                 → todas las materias, últimos 30 días
 *   npm run metrics -- <courseId> 14 → una materia, últimos 14 días
 */
import { db } from "@/server/db";
import { computeMetrics, type Ratio } from "@/server/services/metrics";

const ratio = (r: Ratio) => (r.total === 0 ? "sin datos" : `${r.value}/${r.total} (${Math.round((r.value / r.total) * 100)}%)`);

async function main() {
  const [courseId, days] = process.argv.slice(2);
  const m = await computeMetrics({ courseId: courseId || undefined, days: days ? Number(days) : 30 });
  const rows: [string, string | number][] = [
    ["Período", `${m.period.from.toISOString().slice(0, 10)} → ${m.period.to.toISOString().slice(0, 10)}`],
    ["— Estudiantes", ""],
    ["Inscriptos", m.student.enrolled],
    ["Onboarding completado", m.student.onboardingCompleted],
    ["Con primera evidencia", m.student.withEvidence],
    ["Vieron su primer feedback", m.student.feedbackViewed],
    ["Recurrentes (2+ días activos)", m.student.recurrent],
    ["Próximos pasos realizados", ratio(m.student.nextSteps)],
    ["— Docente", ""],
    ["Materias / con currícula configurada", `${m.teacher.courses} / ${m.teacher.curriculumConfigured}`],
    ["Actividades analizadas", m.teacher.activitiesAnalyzed],
    ["Insights abiertos", m.teacher.insightsOpened],
    ["Inferencias revisadas", m.teacher.inferencesReviewed],
    ["Intervenciones", m.teacher.interventions],
    ["— Calidad", ""],
    ["Inferencias / revisadas", `${m.quality.inferences} / ${m.quality.reviewed}`],
    ["Confirmadas", m.quality.confirmed],
    ["Parcialmente correctas", m.quality.partiallyCorrect],
    ["Incorrectas", m.quality.incorrect],
    ["Falta contexto", m.quality.needsContext],
    ["Contradictorias", m.quality.contradictory],
    ["Corridas con evidencia insuficiente", m.quality.insufficientRuns],
    ["Ajustadas por política de respaldo", m.quality.policyAdjusted],
    ["— Loop", ""],
    ["Insight → acción", ratio(m.loop.insightToAction)],
    ["Acción → nueva evidencia", ratio(m.loop.actionToEvidence)],
    ["— Costo IA", ""],
    ["Costo total (USD)", m.cost.totalUsd.toFixed(4)],
    ["Cost-Active Students", m.cost.costActiveStudents],
    ["Costo por CAS (USD)", m.cost.costPerCas === null ? "—" : m.cost.costPerCas.toFixed(4)],
  ];
  for (const [label, value] of rows) console.log(value === "" ? `\n${label}` : `  ${label.padEnd(40)} ${value}`);
  if (m.cost.byOperation.length) {
    console.log("\n  Por operación:");
    for (const o of m.cost.byOperation) {
      console.log(`    ${o.operation.padEnd(22)} llamadas ${String(o.calls).padStart(4)}  fallidas ${String(o.failed).padStart(3)}  in ${o.inputTokens}  out ${o.outputTokens}  USD ${o.costUsd.toFixed(4)}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
