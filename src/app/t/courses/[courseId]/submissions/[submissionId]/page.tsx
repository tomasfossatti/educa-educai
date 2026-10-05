import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EvidenceRow, InferenceRow } from "@/components/domain/rows";
import { RunStatusPanel } from "@/components/domain/run-status";
import { EvaluationBadge, LayerTag } from "@/components/domain/status";
import { TextLink } from "@/components/ui/button";
import { KeyValue, List, ListItem, PageHeader, Section } from "@/components/ui/layout";
import { parseActivityPrompts, parseAnswers } from "@/domain/activity";
import { confidenceLabel, declaredAssistanceLabel } from "@/domain/labels";
import { formatDateTime } from "@/lib/format";
import { requireCourseTeacher } from "@/server/auth/guards";
import { db } from "@/server/db";
import { supportingEvidenceCounts } from "@/server/services/development";

export const metadata: Metadata = { title: "Entrega" };

export default async function TeacherSubmissionPage({ params }: { params: Promise<{ courseId: string; submissionId: string }> }) {
  const { courseId, submissionId } = await params;
  await requireCourseTeacher(courseId);
  const submission = await db.submission.findFirst({
    where: {
      id: submissionId,
      status: "SUBMITTED",
      activity: { courseId },
      student: { enrollments: { some: { courseId, status: "ACTIVE" } } },
    },
    include: {
      activity: true,
      student: { include: { user: { select: { name: true } } } },
      evaluations: { include: { criterion: { select: { title: true } } } },
      experience: { include: { runs: { orderBy: { createdAt: "desc" }, take: 1 } } },
    },
  });
  if (!submission) notFound();
  const base = `/t/courses/${courseId}`;
  const run = submission.experience.runs[0] ?? null;
  const [evidence, inferences] = await Promise.all([
    db.evidenceObject.findMany({ where: { experienceId: submission.experienceId }, include: { experience: { select: { title: true } } } }),
    run ? db.inference.findMany({ where: { runId: run.id }, include: { curriculumItem: { select: { title: true } } } }) : [],
  ]);
  const counts = await supportingEvidenceCounts(inferences.map((i) => i.id));
  const prompts = parseActivityPrompts(submission.activity.prompts);
  const answers = parseAnswers(submission.answers);

  return (
    <>
      <PageHeader
        eyebrow={<TextLink href={`${base}/students/${submission.studentId}`}>{submission.student.user.name}</TextLink>}
        title={submission.activity.title}
        description={`Entregada ${formatDateTime(submission.submittedAt)} · intento ${submission.attempt}`}
      />
      <div className="space-y-10">
        <Section title="Producción original" action={<LayerTag layer="observed" />}>
          <div className="space-y-4 rounded-lg border border-line bg-surface p-4">
            {prompts.map((p) => (
              <div key={p.key} className="space-y-1">
                <p className="text-sm font-medium text-ink">{p.label}</p>
                <p className="prose-plain text-sm text-ink-2">{answers[p.key] || "—"}</p>
              </div>
            ))}
            <dl className="border-t border-line pt-2">
              <KeyValue label="Ayuda declarada">
                {submission.declaredAssistance ? declaredAssistanceLabel[submission.declaredAssistance] : "No declarada"}
                {submission.assistanceNote ? ` — ${submission.assistanceNote}` : ""}
              </KeyValue>
              {submission.confidence && <KeyValue label="Confianza declarada">{confidenceLabel[submission.confidence]}</KeyValue>}
            </dl>
          </div>
        </Section>

        <RunStatusPanel run={run} canRetry={false} />

        {submission.evaluations.length > 0 && (
          <Section title="Comparación con criterios" action={<LayerTag layer="evaluated" />}>
            <List>
              {submission.evaluations.map((e) => (
                <ListItem key={e.id} className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{e.criterion.title}</span>
                    <EvaluationBadge result={e.result} />
                  </div>
                  <p className="text-sm text-ink-2">{e.rationale}</p>
                </ListItem>
              ))}
            </List>
          </Section>
        )}

        {inferences.length > 0 && (
          <Section title="Inferencias de este análisis" action={<LayerTag layer="inferred" />}>
            <List>
              {inferences.map((i) => (
                <ListItem key={i.id}>
                  <InferenceRow audience="teacher" href={`${base}/inferences/${i.id}`} inference={{ ...i, evidenceCount: counts.get(i.id) ?? 0 }} />
                </ListItem>
              ))}
            </List>
          </Section>
        )}

        {evidence.length > 0 && (
          <Section title="Evidencia generada" action={<LayerTag layer="observed" />}>
            <List>
              {evidence.map((e) => (
                <ListItem key={e.id}>
                  <EvidenceRow evidence={e} href={`${base}/evidence/${e.id}`} />
                </ListItem>
              ))}
            </List>
          </Section>
        )}
      </div>
    </>
  );
}
