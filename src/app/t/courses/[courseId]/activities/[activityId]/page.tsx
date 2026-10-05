import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, TextLink } from "@/components/ui/button";
import { AutoRefresh, ConfirmSubmit, SubmitButton } from "@/components/ui/client";
import { KeyValue, List, ListItem, PageHeader, Section } from "@/components/ui/layout";
import { parseActivityPrompts } from "@/domain/activity";
import { activityKindLabel, activityStatusLabel, runStatusLabel } from "@/domain/labels";
import { formatDate, formatDateTime } from "@/lib/format";
import { setActivityStatusAction } from "@/server/actions/teacher";
import { requireCourseTeacher } from "@/server/auth/guards";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Actividad" };

export default async function TeacherActivityPage({ params }: { params: Promise<{ courseId: string; activityId: string }> }) {
  const { courseId, activityId } = await params;
  await requireCourseTeacher(courseId);
  const activity = await db.activity.findFirst({
    where: { id: activityId, courseId },
    include: { curriculumLinks: { include: { curriculumItem: true } } },
  });
  if (!activity) notFound();
  const [enrollments, submissions] = await Promise.all([
    db.enrollment.findMany({ where: { courseId, status: "ACTIVE" }, include: { student: { include: { user: { select: { name: true } } } } } }),
    db.submission.findMany({
      where: { activityId },
      orderBy: { attempt: "desc" },
      include: { experience: { include: { runs: { orderBy: { createdAt: "desc" }, take: 1 } } } },
    }),
  ]);
  const latestByStudent = new Map<string, (typeof submissions)[number]>();
  for (const s of submissions) if (!latestByStudent.has(s.studentId)) latestByStudent.set(s.studentId, s);
  const prompts = parseActivityPrompts(activity.prompts);
  const base = `/t/courses/${courseId}`;
  const submitted = submissions.filter((s) => s.status === "SUBMITTED");
  const analyzing = submitted.some((s) => ["QUEUED", "RUNNING"].includes(s.experience.runs[0]?.status ?? ""));
  const worked = activity.curriculumLinks.map((l) => l.curriculumItem);

  return (
    <>
      <AutoRefresh active={analyzing} intervalMs={5000} />
      <PageHeader
        eyebrow={<TextLink href={`${base}/activities`}>← Actividades</TextLink>}
        title={activity.title}
        actions={
          <>
            <ButtonLink href={`${base}/activities/${activity.id}/edit`} size="sm">
              Editar
            </ButtonLink>
            {activity.status !== "PUBLISHED" && (
              <form action={setActivityStatusAction.bind(null, activity.id, "PUBLISHED")}>
                <SubmitButton size="sm">Publicar</SubmitButton>
              </form>
            )}
            {activity.status === "PUBLISHED" && (
              <form action={setActivityStatusAction.bind(null, activity.id, "CLOSED")}>
                <ConfirmSubmit size="sm" variant="secondary" message="¿Cerrar la actividad? Los estudiantes ya no podrán entregar.">
                  Cerrar
                </ConfirmSubmit>
              </form>
            )}
          </>
        }
      />
      <div className="space-y-10">
        <Section title="Detalle">
          <dl>
            <KeyValue label="Estado">
              <Badge tone={activity.status === "PUBLISHED" ? "primary" : "muted"}>{activityStatusLabel[activity.status]}</Badge>
              {activity.publishedAt && <span className="ml-2 text-xs text-muted">publicada {formatDate(activity.publishedAt)}</span>}
            </KeyValue>
            <KeyValue label="Tipo">{activityKindLabel[activity.kind]}</KeyValue>
            <KeyValue label="Situación">
              <span className="prose-plain">{activity.scenario}</span>
            </KeyValue>
            <KeyValue label="Consigna">
              <span className="prose-plain">{activity.instructions}</span>
            </KeyValue>
            <KeyValue label="Consignas estructuradas">
              <ol className="list-decimal space-y-0.5 pl-4">
                {prompts.map((p) => (
                  <li key={p.key}>{p.label}</li>
                ))}
              </ol>
            </KeyValue>
            <KeyValue label="Trabaja">{worked.filter((w) => w.kind !== "CRITERION").map((w) => w.title).join(" · ") || "—"}</KeyValue>
            <KeyValue label="Criterios">{worked.filter((w) => w.kind === "CRITERION").map((w) => w.title).join(" · ") || "—"}</KeyValue>
          </dl>
        </Section>

        <Section title="Entregas" description={`${new Set(submitted.map((s) => s.studentId)).size} de ${enrollments.length} estudiantes entregaron.`}>
          <List>
            {enrollments
              .sort((a, b) => a.student.user.name.localeCompare(b.student.user.name))
              .map((e) => {
                const s = latestByStudent.get(e.studentId);
                const run = s?.experience.runs[0];
                return (
                  <ListItem key={e.studentId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    {s?.status === "SUBMITTED" ? (
                      <Link href={`${base}/submissions/${s.id}`} className="font-medium text-ink hover:text-primary">
                        {e.student.user.name}
                      </Link>
                    ) : (
                      <span className="text-ink-2">{e.student.user.name}</span>
                    )}
                    <span className="text-xs text-muted">
                      {!s ? "Sin empezar" : s.status === "DRAFT" ? "Borrador" : `Entregada ${formatDateTime(s.submittedAt)} · ${run ? runStatusLabel[run.status] : ""}`}
                    </span>
                  </ListItem>
                );
              })}
          </List>
        </Section>
      </div>
    </>
  );
}
