import Link from "next/link";
import { AutoRefresh } from "@/components/ui/client";
import { TEXT } from "@/lib/texts";
import { db } from "@/server/db";
import { expireStaleRuns } from "@/server/engine/trigger";
import { EVENT, track } from "@/server/events";

/**
 * Devolución de una entrega, en palabras simples: un párrafo y, detrás de "Ver más", lo que se miró
 * de cada criterio. Lo que el docente concluye sobre el estudiante está en Mis datos. Solo datos del
 * propio estudiante (filtra por `studentId`).
 */
export async function TaskResult({ experienceId, studentId, courseId }: { experienceId: string; studentId: string; courseId: string }) {
  await expireStaleRuns(studentId);
  const t = TEXT.student.task;
  const run = await db.interpretationRun.findFirst({
    where: { experienceId, studentId },
    orderBy: { createdAt: "desc" },
    include: { feedback: true },
  });
  if (!run) return null;
  if (run.status === "QUEUED" || run.status === "RUNNING") {
    return (
      <p className="text-sm text-muted" role="status">
        <AutoRefresh active />
        {t.looking}
      </p>
    );
  }
  if (run.status !== "COMPLETED") return <p className="text-sm text-muted">{t.lookFailed}</p>;

  const feedback = run.feedback;
  if (feedback && !feedback.viewedAt) {
    await db.feedback.update({ where: { id: feedback.id }, data: { viewedAt: new Date() } });
    await track(EVENT.studentFeedbackViewed, {
      userId: studentId,
      studentId,
      courseId,
      dedupeKey: `feedback_viewed:${feedback.id}`,
      properties: { feedbackId: feedback.id },
    });
  }
  const evaluations = await db.evaluation.findMany({
    where: { runId: run.id, studentId },
    include: { criterion: { select: { title: true } } },
  });

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-ink">{t.result}</h2>
      {feedback && <p className="whitespace-pre-wrap text-base text-ink">{feedback.summary}</p>}
      {evaluations.length > 0 && (
        <details>
          <summary className="min-h-11 cursor-pointer py-2 text-sm text-muted">{TEXT.student.myData.seeMore}</summary>
          <ul className="mt-2 space-y-3">
            {evaluations.map((e) => (
              <li key={e.id} className="rounded-xl border border-line p-3 text-sm">
                <p className="font-medium text-ink">
                  {e.criterion.title} · {t.criteriaResult[e.result]}
                </p>
                <p className="mt-1 text-ink-2">{e.rationale}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="text-sm text-muted">
        <Link href="/s/mis-datos#docente" className="underline">
          {t.more}
        </Link>
      </p>
    </section>
  );
}
