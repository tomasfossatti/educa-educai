import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InterventionList } from "@/components/domain/interventions";
import { DimensionTag, LayerTag, ReviewBadge, SupportBadge } from "@/components/domain/status";
import { InterventionForm, ReviewForm } from "@/components/domain/teacher-forms";
import { TextLink } from "@/components/ui/button";
import { KeyValue, List, ListItem, Notice, PageHeader, Section } from "@/components/ui/layout";
import { actionTypeLabel, assistanceLevelLabel, curriculumKindLabel, dimensionLabel, evidenceSourceLabel, polarityLabel, supportStatusLabel } from "@/domain/labels";
import { truncate } from "@/domain/text-guards";
import { formatDate } from "@/lib/format";
import { requireCourseTeacher } from "@/server/auth/guards";
import { db } from "@/server/db";
import { EVENT, track } from "@/server/events";
import { getCourseInsight } from "@/server/services/attention";

export const metadata: Metadata = { title: "Insight" };

export default async function InsightPage({ params }: { params: Promise<{ courseId: string; key: string }> }) {
  const { courseId, key: rawKey } = await params;
  const key = decodeURIComponent(rawKey);
  const { user } = await requireCourseTeacher(courseId);
  const insight = await getCourseInsight(courseId, key);
  if (!insight) notFound();
  const base = `/t/courses/${courseId}`;
  await track(EVENT.teacherInsightOpened, {
    userId: user.id,
    courseId,
    dedupeKey: `insight_opened:${user.id}:${key}`,
    properties: { key },
  });

  const [activities, enrolled] = await Promise.all([
    db.activity.findMany({ where: { courseId, status: "PUBLISHED" }, select: { id: true, title: true }, orderBy: { publishedAt: "desc" } }),
    db.enrollment.findMany({ where: { courseId, status: "ACTIVE" }, include: { student: { include: { user: { select: { name: true } } } } } }),
  ]);

  const byStudent = new Map<string, typeof insight.inferences>();
  for (const inf of insight.inferences) byStudent.set(inf.studentId, [...(byStudent.get(inf.studentId) ?? []), inf]);

  const evidenceMap = new Map<
    string,
    { evidence: (typeof insight.inferences)[number]["supports"][number]["evidence"]; studentName: string; relation: string; signals: string[] }
  >();
  for (const inf of insight.inferences) {
    for (const s of inf.supports) {
      const entry = evidenceMap.get(s.evidenceId) ?? { evidence: s.evidence, studentName: inf.student.user.name, relation: s.relation, signals: [] };
      const label = `${polarityLabel[s.signal.polarity]} (${dimensionLabel[s.signal.dimension].toLowerCase()}): ${s.signal.description}`;
      if (!entry.signals.includes(label)) entry.signals.push(label);
      evidenceMap.set(s.evidenceId, entry);
    }
  }
  const evidence = [...evidenceMap.values()].sort((a, b) => a.evidence.occurredAt.getTime() - b.evidence.occurredAt.getTime());
  // Experiencias de origen agrupadas por título (cada estudiante tiene su propia experiencia).
  const experienceCounts = new Map<string, Set<string>>();
  for (const e of evidence) {
    const set = experienceCounts.get(e.evidence.experience.title) ?? new Set<string>();
    set.add(e.evidence.experience.id);
    experienceCounts.set(e.evidence.experience.title, set);
  }
  const experiences = [...experienceCounts.entries()].map(([title, set]) => (set.size > 1 ? `${title} (${set.size})` : title));
  const contradictions = insight.inferences.filter((i) => i.supportStatus === "CONTRADICTORY");
  const statusCounts = new Map<string, number>();
  for (const i of insight.inferences) statusCounts.set(i.supportStatus, (statusCounts.get(i.supportStatus) ?? 0) + 1);
  const suggestions = [...new Map(insight.inferences.flatMap((i) => i.suggestedActions).map((a) => [a.description, a])).values()];

  const title =
    insight.attention?.title ??
    (insight.kind === "gap" ? `${insight.item.title}: comprensión razonable, aplicación débil` : `Dificultad recurrente en ${insight.item.title}`);

  return (
    <>
      <PageHeader
        eyebrow={<TextLink href={`${base}/attention`}>← Atención</TextLink>}
        title={title}
        description={insight.attention?.description ?? "Con la evidencia actual este patrón ya no aparece; se conserva el historial."}
      />
      <div className="space-y-10">
        <Section title="Resumen">
          <dl>
            <KeyValue label="Concepto / competencia">
              {insight.item.title} <span className="text-muted">({curriculumKindLabel[insight.item.kind]})</span>
              {insight.item.description && <span className="block text-xs text-muted">{insight.item.description}</span>}
            </KeyValue>
            <KeyValue label="Dimensiones">
              <span className="flex flex-wrap gap-1">
                {insight.dimensions.map((d) => (
                  <DimensionTag key={d} dimension={d} />
                ))}
              </span>
            </KeyValue>
            <KeyValue label="Estudiantes afectados">{byStudent.size}</KeyValue>
            <KeyValue label="Estado de respaldo">
              {[...statusCounts.entries()].map(([s, n]) => `${supportStatusLabel[s as keyof typeof supportStatusLabel].toLowerCase()} (${n})`).join(" · ") || "—"}
            </KeyValue>
            <KeyValue label="Experiencias de origen">{experiences.join(" · ") || "—"}</KeyValue>
          </dl>
          <p className="text-xs text-muted">
            <LayerTag layer="inferred" /> Este insight agrupa inferencias individuales. No es un hecho: revisá la evidencia antes de decidir.
          </p>
        </Section>

        {contradictions.length > 0 && (
          <Notice tone="attention" title="Posibles contradicciones">
            <ul className="mt-1 space-y-1">
              {contradictions.map((c) => (
                <li key={c.id}>
                  {c.student.user.name}: {c.contradictionNote ?? c.statement}{" "}
                  <Link href={`${base}/inferences/${c.id}`} className="text-primary hover:underline">
                    Ver
                  </Link>
                </li>
              ))}
            </ul>
          </Notice>
        )}

        <Section title="Estudiantes e inferencias" description="Revisá cada inferencia: tus correcciones mejoran la calibración.">
          <List>
            {[...byStudent.entries()].map(([studentId, list]) => (
              <ListItem key={studentId} className="space-y-3">
                <Link href={`${base}/students/${studentId}`} className="text-sm font-medium text-ink hover:text-primary">
                  {list[0].student.user.name}
                </Link>
                {list.map((inf) => (
                  <div key={inf.id} className="space-y-2 border-l border-line pl-3">
                    <p className="text-sm text-ink-2">{inf.statement}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <DimensionTag dimension={inf.dimension} />
                      <SupportBadge status={inf.supportStatus} />
                      <ReviewBadge status={inf.reviewStatus} />
                      <Link href={`${base}/inferences/${inf.id}`} className="text-xs text-primary hover:underline">
                        Abrir inferencia
                      </Link>
                    </div>
                    {inf.reviewStatus === "PENDING" && (
                      <details>
                        <summary className="cursor-pointer text-xs text-primary hover:underline">Revisar acá</summary>
                        <div className="mt-2">
                          <ReviewForm inferenceId={inf.id} compact />
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </ListItem>
            ))}
          </List>
        </Section>

        <Section title="Evidencia" description="Lo que originó este insight, con su experiencia de origen, contexto y señales." action={<LayerTag layer="observed" />}>
          <List>
            {evidence.map(({ evidence: e, studentName, relation, signals }) => (
              <ListItem key={e.id} className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                  <span className="font-medium text-ink-2">{studentName}</span>
                  <span>· {evidenceSourceLabel[e.source]}</span>
                  <span>· {e.experience.title}</span>
                  <span>· {formatDate(e.occurredAt)}</span>
                  <span>· {assistanceLevelLabel[e.assistanceLevel]}</span>
                  {relation === "CONTRADICTS" && <span className="text-attention">· en sentido opuesto</span>}
                </div>
                <p className="prose-plain border-l-2 border-line-strong pl-3 text-sm text-ink">“{truncate(e.content, 400)}”</p>
                {e.context && <p className="text-xs text-muted">Contexto: {e.context}</p>}
                <ul className="text-xs text-ink-2">
                  {signals.map((s) => (
                    <li key={s}>Señal: {s}</li>
                  ))}
                </ul>
                <Link href={`${base}/evidence/${e.id}`} className="text-xs text-primary hover:underline">
                  Ver fuente
                </Link>
              </ListItem>
            ))}
          </List>
        </Section>

        {suggestions.length > 0 && (
          <Section title="Acción sugerida" description="Propuestas de Educai a partir de las inferencias. La decisión es tuya.">
            <List>
              {suggestions.map((a) => (
                <ListItem key={a.id} className="text-sm">
                  <span className="text-xs text-muted">{actionTypeLabel[a.type]} · </span>
                  {a.description}
                </ListItem>
              ))}
            </List>
          </Section>
        )}

        {insight.interventions.length > 0 && (
          <Section title="Intervenciones y seguimiento">
            <InterventionList interventions={insight.interventions} courseId={courseId} />
          </Section>
        )}

        <Section title="Registrar una intervención" description="Por ejemplo: dedicar parte de la próxima clase a practicar en vez de repetir la definición.">
          <InterventionForm
            courseId={courseId}
            insightKey={key}
            curriculumItemId={insight.item.id}
            activities={activities}
            suggestion={suggestions[0]?.description}
            students={enrolled
              .map((e) => ({ id: e.studentId, name: e.student.user.name, selected: insight.studentIds.includes(e.studentId) }))
              .sort((a, b) => a.name.localeCompare(b.name))}
          />
        </Section>
      </div>
    </>
  );
}
