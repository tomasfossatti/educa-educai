import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExperienceResults } from "@/components/domain/experience-results";
import { LayerTag } from "@/components/domain/status";
import { SubmitButton } from "@/components/ui/client";
import { KeyValue, Notice, PageHeader, Section } from "@/components/ui/layout";
import { parseActivityPrompts, parseAnswers } from "@/domain/activity";
import { activityKindLabel, confidenceLabel, declaredAssistanceLabel } from "@/domain/labels";
import { formatDateTime } from "@/lib/format";
import { startConversationAction, startNewAttemptAction } from "@/server/actions/student";
import { requireEnrolledStudent } from "@/server/auth/guards";
import { db } from "@/server/db";
import { SubmissionForm } from "./submission-form";

export const metadata: Metadata = { title: "Actividad" };

export default async function StudentActivityPage({ params }: { params: Promise<{ courseId: string; activityId: string }> }) {
  const { courseId, activityId } = await params;
  const { user, course } = await requireEnrolledStudent(courseId);
  const activity = await db.activity.findFirst({
    where: { id: activityId, courseId, status: { in: ["PUBLISHED", "CLOSED"] } },
    include: { curriculumLinks: { include: { curriculumItem: true } } },
  });
  if (!activity) notFound();
  const submissions = await db.submission.findMany({
    where: { activityId, studentId: user.id },
    orderBy: { attempt: "desc" },
  });
  const latest = submissions[0];
  const prompts = parseActivityPrompts(activity.prompts);
  const worked = activity.curriculumLinks.map((l) => l.curriculumItem).filter((i) => i.kind !== "CRITERION" && i.status === "ACCEPTED");
  const criteria = activity.curriculumLinks.map((l) => l.curriculumItem).filter((i) => i.kind === "CRITERION" && i.status === "ACCEPTED");
  const canWork = activity.status === "PUBLISHED" && (!latest || latest.status === "DRAFT");

  return (
    <>
      <PageHeader eyebrow={`${course.name} · ${activityKindLabel[activity.kind]}`} title={activity.title} />
      <div className="space-y-10">
        <Section title="Situación">
          <p className="prose-plain text-sm text-ink">{activity.scenario}</p>
          <p className="prose-plain text-sm text-ink-2">{activity.instructions}</p>
          {(worked.length > 0 || criteria.length > 0) && (
            <dl className="border-t border-line pt-2">
              {worked.length > 0 && <KeyValue label="Trabaja">{worked.map((w) => w.title).join(" · ")}</KeyValue>}
              {criteria.length > 0 && <KeyValue label="Criterios">{criteria.map((c) => c.title).join(" · ")}</KeyValue>}
            </dl>
          )}
          {activity.status === "PUBLISHED" && (
            <form action={startConversationAction} className="pt-1">
              <input type="hidden" name="courseId" value={courseId} />
              <input type="hidden" name="activityId" value={activity.id} />
              <SubmitButton variant="secondary" size="sm" pendingText="Abriendo…">
                Pensarla con el tutor
              </SubmitButton>
            </form>
          )}
        </Section>

        {canWork ? (
          <Section
            title="Tu respuesta"
            description="Explicá tus decisiones y su porqué: eso es lo que permite observar cómo aplicás lo que sabés. Podés guardar un borrador."
          >
            <SubmissionForm
              activityId={activity.id}
              prompts={prompts}
              draft={
                latest
                  ? {
                      answers: parseAnswers(latest.answers),
                      declaredAssistance: latest.declaredAssistance,
                      assistanceNote: latest.assistanceNote,
                      confidence: latest.confidence,
                    }
                  : null
              }
            />
          </Section>
        ) : latest ? (
          <>
            <Section
              title={`Tu entrega${submissions.length > 1 ? ` (intento ${latest.attempt})` : ""}`}
              description={`Enviada el ${formatDateTime(latest.submittedAt)} · la producción original se conserva tal como la enviaste.`}
              action={<LayerTag layer="observed" />}
            >
              <div className="space-y-4 rounded-lg border border-line bg-surface p-4">
                {prompts.map((p) => (
                  <div key={p.key} className="space-y-1">
                    <p className="text-sm font-medium text-ink">{p.label}</p>
                    <p className="prose-plain text-sm text-ink-2">{parseAnswers(latest.answers)[p.key] || "—"}</p>
                  </div>
                ))}
                <dl className="border-t border-line pt-2">
                  <KeyValue label="Ayuda declarada">
                    {latest.declaredAssistance ? declaredAssistanceLabel[latest.declaredAssistance] : "No declarada"}
                    {latest.assistanceNote ? ` — ${latest.assistanceNote}` : ""}
                  </KeyValue>
                  {latest.confidence && <KeyValue label="Confianza declarada">{confidenceLabel[latest.confidence]}</KeyValue>}
                </dl>
              </div>
              {activity.status === "PUBLISHED" && (
                <form action={startNewAttemptAction.bind(null, activity.id)}>
                  <SubmitButton variant="ghost" size="sm">
                    Hacer un nuevo intento
                  </SubmitButton>
                </form>
              )}
            </Section>
            <ExperienceResults experienceId={latest.experienceId} studentId={user.id} courseId={courseId} />
          </>
        ) : (
          <Notice>Esta actividad está cerrada.</Notice>
        )}
      </div>
    </>
  );
}
