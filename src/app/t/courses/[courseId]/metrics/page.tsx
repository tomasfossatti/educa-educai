import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PageHeader, Section } from "@/components/ui/layout";
import { formatDate } from "@/lib/format";
import { requireCourseTeacher } from "@/server/auth/guards";
import { computeMetrics, type Ratio } from "@/server/services/metrics";

export const metadata: Metadata = { title: "Métricas del piloto" };

function ratio(r: Ratio): string {
  return r.total === 0 ? "sin datos" : `${r.value} de ${r.total}`;
}

function Table({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-line rounded-lg border border-line bg-surface">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-4 px-4 py-2 text-sm">
          <dt className="text-ink-2">{label}</dt>
          <dd className="font-medium tabular-nums text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function MetricsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  await requireCourseTeacher(courseId);
  const m = await computeMetrics({ courseId, days: 30 });
  return (
    <>
      <PageHeader
        title="Métricas del piloto"
        description={`Instrumentación para validar si Educai cambia decisiones docentes. Período de engagement y costo: ${formatDate(m.period.from)} – ${formatDate(m.period.to)}.`}
      />
      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="Estudiantes">
          <Table
            rows={[
              ["Inscriptos", m.student.enrolled],
              ["Onboarding completado", m.student.onboardingCompleted],
              ["Con primera evidencia", m.student.withEvidence],
              ["Vieron su primer feedback", m.student.feedbackViewed],
              ["Recurrentes (2+ días activos)", m.student.recurrent],
              ["Próximos pasos realizados", ratio(m.student.nextSteps)],
            ]}
          />
        </Section>
        <Section title="Docente">
          <Table
            rows={[
              ["Currícula configurada", m.teacher.curriculumConfigured > 0 ? "sí" : "no"],
              ["Actividades analizadas", m.teacher.activitiesAnalyzed],
              ["Insights abiertos", m.teacher.insightsOpened],
              ["Inferencias revisadas", m.teacher.inferencesReviewed],
              ["Intervenciones registradas", m.teacher.interventions],
            ]}
          />
        </Section>
        <Section title="Calidad de las inferencias" description="Sobre las revisiones docentes.">
          <Table
            rows={[
              ["Inferencias generadas", m.quality.inferences],
              ["Revisadas", m.quality.reviewed],
              ["Confirmadas", m.quality.confirmed],
              ["Parcialmente correctas", m.quality.partiallyCorrect],
              ["Incorrectas", m.quality.incorrect],
              ["Falta contexto", m.quality.needsContext],
              ["Con señales contradictorias", m.quality.contradictory],
              ["Análisis con evidencia insuficiente", m.quality.insufficientRuns],
              ["Áreas sin evidencia suficiente", m.quality.insufficientAreas],
              ["Ajustadas por la política de respaldo", m.quality.policyAdjusted],
            ]}
          />
        </Section>
        <Section title="Loop">
          <Table
            rows={[
              ["Insights abiertos que llevaron a una acción", ratio(m.loop.insightToAction)],
              ["Acciones seguidas por nueva evidencia", ratio(m.loop.actionToEvidence)],
            ]}
          />
        </Section>
        <Section title="Costo IA" description="Cost-Active Student (CAS): estudiante con al menos una operación con costo variable en el período.">
          <Table
            rows={[
              ["Costo total estimado (USD)", m.cost.totalUsd.toFixed(4)],
              ["Cost-Active Students", m.cost.costActiveStudents],
              ["Costo por CAS (USD)", m.cost.costPerCas === null ? "—" : m.cost.costPerCas.toFixed(4)],
            ]}
          />
          {m.cost.byOperation.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-line bg-surface">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Operación</th>
                    <th className="px-3 py-2 font-medium">Llamadas</th>
                    <th className="px-3 py-2 font-medium">Fallidas</th>
                    <th className="px-3 py-2 font-medium">Tokens in/out</th>
                    <th className="px-3 py-2 font-medium">USD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line tabular-nums">
                  {m.cost.byOperation.map((o) => (
                    <tr key={o.operation}>
                      <td className="px-3 py-2 font-mono text-xs">{o.operation}</td>
                      <td className="px-3 py-2">{o.calls}</td>
                      <td className="px-3 py-2">{o.failed}</td>
                      <td className="px-3 py-2">
                        {o.inputTokens.toLocaleString("es-AR")} / {o.outputTokens.toLocaleString("es-AR")}
                      </td>
                      <td className="px-3 py-2">{o.costUsd.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </>
  );
}
