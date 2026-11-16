import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CourseSelector } from "@/components/student/course-selector";
import { SubmitButton } from "@/components/ui/client";
import { EmptyState, Notice } from "@/components/ui/layout";
import { TEXT } from "@/lib/texts";
import { startQuizAction } from "@/server/actions/folders";
import { budgetResetLabel } from "@/server/ai/budget";
import { requireStudent } from "@/server/auth/guards";
import { getPanelState, getPanelTasks, getPanelTopics } from "@/server/services/student-panel";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Practicar" };

/** Practicar: los temas de la materia actual. Tocar uno arma el quiz de 3 a 5 preguntas. */
export default async function PracticePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { user } = await requireStudent();
  const viewer = { id: user.id, role: user.role };
  const { options, current } = await getPanelState(viewer);
  if (!current) redirect("/s");
  const { error } = await searchParams;
  const [topics, tasks] = await Promise.all([getPanelTopics(viewer, current), getPanelTasks(viewer, current)]);
  const t = TEXT.student.practice;
  const errorText =
    error === "notEnough" ? t.notEnough : error === "budget" ? TEXT.budget.exceeded(budgetResetLabel()) : error === "busy" ? t.busy : null;

  return (
    <div className="shell mx-auto max-w-3xl space-y-5">
      <CourseSelector options={options} current={current} next="/s/practicar" />
      <p className="text-muted">{t.hint}</p>
      {errorText && <Notice tone="attention">{errorText}</Notice>}
      {topics.length === 0 ? (
        <EmptyState title={current.courseId ? t.empty : t.noTopics} />
      ) : (
        <ul className="space-y-2">
          {topics.map((topic) => (
            <li key={topic.id}>
              <form action={startQuizAction.bind(null, current.folderId, topic.id)}>
                <SubmitButton
                  variant="secondary"
                  pendingText={t.starting}
                  aria-label={`${t.start}: ${topic.title}`}
                  className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left text-base"
                >
                  <span>{topic.title}</span>
                  <ChevronRight className="size-5 shrink-0" aria-hidden />
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}
      {tasks.length > 0 && current.courseId && (
        <section className="space-y-2 pt-4">
          <h2 className="text-lg font-semibold text-ink">{t.tasks}</h2>
          <ul className="space-y-2">
            {tasks.map((task) => (
              <li key={task.id}>
                <Link
                  href={`/s/courses/${current.courseId}/activities/${task.id}`}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 text-base text-ink hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <span>{task.title}</span>
                  <span className="text-sm text-muted">{t.openTask}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
