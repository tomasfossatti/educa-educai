import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TaskResult } from "@/components/student/task-result";
import { SubmitButton } from "@/components/ui/client";
import { KeyValue, Notice } from "@/components/ui/layout";
import { parseActivityPrompts, parseAnswers } from "@/domain/activity";
import { formatDateTime } from "@/lib/format";
import { TEXT } from "@/lib/texts";
import { startConversationAction, startNewAttemptAction } from "@/server/actions/student";
import { requireEnrolledStudent } from "@/server/auth/guards";
import { db } from "@/server/db";
import { SubmissionForm } from "./submission-form";

export const metadata: Metadata = { title: "Tarea" };

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

  const t = TEXT.student.task;

  return (
    <div className="shell mx-auto max-w-3xl space-y-8">
      <div className="space-y-1">
        <p className="text-sm text-muted">
          {course.name} · {t.kind[activity.kind]}
        </p>
        <h1 className="text-xl font-bold text-ink sm:text-2xl">{activity.title}</h1>
      </div>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-ink">{t.situation}</h2>
        <p className="prose-plain text-base text-ink">{activity.scenario}</p>
        <p className="prose-plain text-base text-ink-2">{activity.instructions}</p>
        {(worked.length > 0 || criteria.length > 0) && (
          <dl className="border-t border-line pt-2">
            {worked.length > 0 && <KeyValue label={t.topics}>{worked.map((w) => w.title).join(" · ")}</KeyValue>}
            {criteria.length > 0 && <KeyValue label={t.criteria}>{criteria.map((c) => c.title).join(" · ")}</KeyValue>}
          </dl>
        )}
        {activity.status === "PUBLISHED" && (
          <form action={startConversationAction} className="pt-1">
            <input type="hidden" name="courseId" value={courseId} />
            <input type="hidden" name="activityId" value={activity.id} />
            <SubmitButton variant="secondary" pendingText={t.opening} className="min-h-11">
              {t.thinkWithAI}
            </SubmitButton>
          </form>
        )}
      </section>

      {canWork ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">{t.answer}</h2>
          <p className="text-sm text-muted">{t.answerHint}</p>
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
        </section>
      ) : latest ? (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">{t.delivered(submissions.length > 1 ? latest.attempt : null)}</h2>
            <p className="text-sm text-muted">{t.sentOn(formatDateTime(latest.submittedAt))}</p>
            <div className="space-y-4 rounded-lg border border-line bg-surface p-4">
              {prompts.map((p) => (
                <div key={p.key} className="space-y-1">
                  <p className="text-sm font-medium text-ink">{p.label}</p>
                  <p className="prose-plain text-sm text-ink-2">{parseAnswers(latest.answers)[p.key] || "—"}</p>
                </div>
              ))}
              <dl className="border-t border-line pt-2">
                <KeyValue label={t.helpUsed}>
                  {latest.declaredAssistance ? t.helpOptions[latest.declaredAssistance] : t.noHelp}
                  {latest.assistanceNote ? ` — ${latest.assistanceNote}` : ""}
                </KeyValue>
                {latest.confidence && <KeyValue label={t.sureUsed}>{t.sureOptions[latest.confidence]}</KeyValue>}
              </dl>
            </div>
            {activity.status === "PUBLISHED" && (
              <form action={startNewAttemptAction.bind(null, activity.id)}>
                <SubmitButton variant="ghost" className="min-h-11">
                  {t.retry}
                </SubmitButton>
              </form>
            )}
          </section>
          <TaskResult experienceId={latest.experienceId} studentId={user.id} courseId={courseId} />
        </>
      ) : (
        <Notice>{t.closed}</Notice>
      )}
    </div>
  );
}
