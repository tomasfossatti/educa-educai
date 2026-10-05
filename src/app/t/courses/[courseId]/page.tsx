import type { Metadata } from "next";
import Link from "next/link";
import { AttentionItemRow } from "@/components/domain/attention-item";
import { InferenceRow } from "@/components/domain/rows";
import { TextLink } from "@/components/ui/button";
import { EmptyState, List, ListItem, PageHeader, Section } from "@/components/ui/layout";
import { dimensionLabel } from "@/domain/labels";
import { formatDate, formatRelative, plural } from "@/lib/format";
import { requireCourseTeacher } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getCourseOverview } from "@/server/services/attention";
import { supportingEvidenceCounts } from "@/server/services/development";

export const metadata: Metadata = { title: "Curso" };

export default async function CourseOverviewPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { course } = await requireCourseTeacher(courseId);
  const base = `/t/courses/${courseId}`;
  const [overview, publishedActivities] = await Promise.all([
    getCourseOverview(courseId),
    db.activity.count({ where: { courseId, status: "PUBLISHED" } }),
  ]);
  const evidenceCount = await supportingEvidenceCounts(overview.pendingInferences.slice(0, 5).map((i) => i.id));

  const setup = [
    { done: course.curriculumStatus === "CONFIGURED", label: "Cargar el programa y confirmar la currícula", href: `${base}/curriculum` },
    { done: publishedActivities > 0, label: "Publicar una actividad (por ejemplo, un challenge inicial)", href: `${base}/activities/new` },
    { done: overview.enrolledCount > 0, label: `Sumar estudiantes (código ${course.joinCode})`, href: `${base}/students` },
  ];
  const attention = overview.attention.filter((a) => a.kind !== "NO_EVIDENCE").slice(0, 5);
  const noEvidence = overview.attention.find((a) => a.kind === "NO_EVIDENCE");
  const watchStudents = overview.students.filter((s) => s.difficulties + s.contradictions > 0).slice(0, 6);

  return (
    <>
      <PageHeader
        title={course.name}
        description="Dónde conviene poner tu atención, qué evidencia lo sostiene y qué decidir."
        actions={
          <Link href={`${base}/metrics`} className="text-sm text-muted hover:text-ink">
            Métricas del piloto
          </Link>
        }
      />

      <div className="space-y-10">
        {setup.some((s) => !s.done) && (
          <Section title="Primeros pasos">
            <List>
              {setup.map((s) => (
                <ListItem key={s.label} className="flex items-center justify-between gap-2 text-sm">
                  <span className={s.done ? "text-muted line-through" : "text-ink"}>{s.label}</span>
                  {!s.done && <TextLink href={s.href}>Hacer</TextLink>}
                </ListItem>
              ))}
            </List>
          </Section>
        )}

        <Section
          title="Requiere atención"
          description="Problemas relevantes del curso, priorizados."
          action={<TextLink href={`${base}/attention`}>Ver cola completa</TextLink>}
        >
          {attention.length === 0 ? (
            <EmptyState title="Nada requiere atención por ahora">
              {overview.enrolledCount === 0
                ? "Todavía no hay estudiantes en la materia."
                : "Cuando los estudiantes generen evidencia, los patrones que necesiten tu atención aparecerán acá."}
            </EmptyState>
          ) : (
            <List>
              {attention.map((item) => (
                <ListItem key={item.key}>
                  <AttentionItemRow item={item} />
                </ListItem>
              ))}
            </List>
          )}
        </Section>

        <div className="grid gap-10 lg:grid-cols-2">
          <Section title="Cambios recientes" description="Qué parece haber mejorado o empeorado (últimas 3 semanas).">
            {overview.recentChanges.length === 0 ? (
              <p className="text-sm text-muted">Todavía no hay suficiente historial para observar cambios.</p>
            ) : (
              <List>
                {overview.recentChanges.slice(0, 8).map((c, i) => (
                  <ListItem key={`${c.studentId}-${c.curriculumItemId}-${c.dimension}-${i}`} className="space-y-0.5 text-sm">
                    <p>
                      <Link href={`${base}/students/${c.studentId}`} className="font-medium text-ink hover:text-primary">
                        {c.studentName}
                      </Link>{" "}
                      <span className={c.trend === "IMPROVING" ? "text-ink-2" : "text-attention"}>
                        {c.trend === "IMPROVING" ? "muestra mejora" : "muestra un cambio a revisar"}
                      </span>{" "}
                      en {c.title}
                    </p>
                    <p className="text-xs text-muted">
                      {dimensionLabel[c.dimension]} · última evidencia {formatDate(c.lastSeenAt)} · {c.evidenceIds.length} evidencias
                    </p>
                  </ListItem>
                ))}
              </List>
            )}
          </Section>

          <Section title="Brechas" description="Comprensión conceptual razonable pero aplicación débil.">
            {overview.gaps.length === 0 ? (
              <p className="text-sm text-muted">No se detectan brechas con la evidencia actual.</p>
            ) : (
              <List>
                {overview.gaps.map((g) => (
                  <ListItem key={g.key} className="space-y-0.5 text-sm">
                    <Link href={g.href} className="font-medium text-ink hover:text-primary">
                      {g.title}
                    </Link>
                    <p className="text-xs text-muted">{g.students.map((s) => s.name).join(", ")}</p>
                  </ListItem>
                ))}
              </List>
            )}
          </Section>
        </div>

        <Section
          title="Estudiantes"
          description="Quién podría necesitar una intervención."
          action={<TextLink href={`${base}/students`}>Ver todos ({overview.enrolledCount})</TextLink>}
        >
          {watchStudents.length === 0 && !noEvidence ? (
            <p className="text-sm text-muted">Ningún estudiante muestra dificultades con la evidencia actual.</p>
          ) : (
            <List>
              {watchStudents.map((s) => (
                <ListItem key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <Link href={`${base}/students/${s.id}`} className="font-medium text-ink hover:text-primary">
                    {s.name}
                  </Link>
                  <span className="text-xs text-muted">
                    {plural(s.difficulties, "dificultad", "dificultades")} · {plural(s.contradictions, "contradicción", "contradicciones")} · {s.pending} por revisar · última evidencia{" "}
                    {formatRelative(s.lastEvidenceAt)}
                  </span>
                </ListItem>
              ))}
              {noEvidence && (
                <ListItem className="text-sm text-muted">
                  Sin evidencia todavía: {noEvidence.students.map((s) => s.name).join(", ")}
                </ListItem>
              )}
            </List>
          )}
        </Section>

        <Section
          title="Inferencias pendientes"
          description={`${overview.pendingInferences.length} necesitan revisión humana antes de considerarse confiables.`}
          action={overview.pendingInferences.length > 0 ? <TextLink href={`${base}/attention#pendientes`}>Revisar todas</TextLink> : undefined}
        >
          {overview.pendingInferences.length === 0 ? (
            <p className="text-sm text-muted">No hay inferencias pendientes de revisión.</p>
          ) : (
            <List>
              {overview.pendingInferences.slice(0, 5).map((i) => (
                <ListItem key={i.id}>
                  <InferenceRow
                    audience="teacher"
                    href={`${base}/inferences/${i.id}`}
                    inference={{ ...i, evidenceCount: evidenceCount.get(i.id) ?? 0 }}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Section>
      </div>
    </>
  );
}
